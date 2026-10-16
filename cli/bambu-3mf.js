// Write a Bambu Studio–compatible .3mf: geometry + project/process settings +
// per-object overrides in Metadata/model_settings.config.
// Assembled as a raw ZIP (lib3mf would strip the Bambu sidecars).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { deflateRawSync } = require("zlib");

const TEMPLATE = path.join(__dirname, "bambu_profile_template.json");
const LINE_WIDTH = 0.4; // 0.4 mm nozzle line width used throughout the project

function uuid() {
  return crypto.randomUUID();
}

function xmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wall loops so a bar of `width` mm prints solid (walls meet in the middle). */
function solidWallLoops(width, lineWidth = LINE_WIDTH) {
  return Math.max(2, Math.ceil(width / (2 * lineWidth)));
}

function plateCols(n) {
  if (n <= 0) return 1;
  const v = Math.sqrt(n);
  const r = Math.floor(v + 0.5);
  return v > r ? r + 1 : Math.max(1, r);
}

/** Deduplicate vertices from a triangle list [[[x,y,z],…], …] → {verts, faces}. */
function meshFromTris(tris) {
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
  const map = new Map();
  const verts = [];
  const faces = [];
  const idx = (p) => {
    const k = key(p);
    let i = map.get(k);
    if (i === undefined) {
      i = verts.length;
      map.set(k, i);
      verts.push([p[0], p[1], p[2]]);
    }
    return i;
  };
  for (const [a, b, c] of tris) faces.push([idx(a), idx(b), idx(c)]);
  return { verts, faces };
}

function boundsOf(verts) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of verts) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Centre mesh in XY at (cx, cy) and drop lowest point to z = 0. */
function placeMesh(mesh, cx, cy) {
  const b = boundsOf(mesh.verts);
  const ox = cx - (b.minX + b.maxX) / 2;
  const oy = cy - (b.minY + b.maxY) / 2;
  const oz = -b.minZ;
  return {
    faces: mesh.faces,
    verts: mesh.verts.map(([x, y, z]) => [x + ox, y + oy, z + oz]),
  };
}

function meshXml(mesh) {
  const verts = mesh.verts
    .map(([x, y, z]) => `     <vertex x="${x.toFixed(6)}" y="${y.toFixed(6)}" z="${z.toFixed(6)}"/>`)
    .join("\n");
  const tris = mesh.faces
    .map(([a, b, c]) => `     <triangle v1="${a}" v2="${b}" v3="${c}"/>`)
    .join("\n");
  return (
    `   <mesh>\n    <vertices>\n${verts}\n    </vertices>\n` +
    `    <triangles>\n${tris}\n    </triangles>\n   </mesh>`
  );
}

// Minimal ZIP writer (store + deflate) so we stay dependency-free.
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zipBuffer(files) {
  // files: [{name, data: Buffer|string}]
  const locals = [];
  const centrals = [];
  let offset = 0;
  const enc = (s) => Buffer.from(s, "utf8");

  for (const f of files) {
    const name = enc(f.name);
    const raw = Buffer.isBuffer(f.data) ? f.data : enc(f.data);
    const compressed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localFull = Buffer.concat([local, name, compressed]);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    locals.push(localFull);
    offset += localFull.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralDir, end]);
}

/**
 * Write a multi-plate Bambu Studio project.
 *
 * @param {string} outPath
 * @param {Array<{name:string, tris:number[][][], obj_settings?:Record<string,string|number>}>} parts
 *   Each part becomes its own plate (tiles are near bed-sized).
 * @param {object} [overrides] project_settings.config keys
 * @param {{bed?:number}} [opts]
 */
function writeBambu3mf(outPath, parts, overrides = {}, opts = {}) {
  const bed = opts.bed ?? 256;
  const proj = JSON.parse(fs.readFileSync(TEMPLATE, "utf8"));
  Object.assign(proj, overrides);
  if (overrides.printable_area == null) {
    proj.printable_area = [`0x0`, `${bed}x0`, `${bed}x${bed}`, `0x${bed}`];
  }

  const plates = parts.map((p, i) => ({
    name: sanitizeName(p.name) || `Part ${i + 1}`,
    parts: [{ ...p, pos: [0, 0] }],
  }));

  const cols = plateCols(plates.length);
  const stride = bed * 1.2;
  const objs = [];
  const builds = [];
  const msobjs = [];
  const plateBlocks = [];
  let oid = 2;

  for (let pi = 0; pi < plates.length; pi++) {
    const plate = plates[pi];
    const row = Math.floor(pi / cols);
    const col = pi % cols;
    const ox = col * stride;
    const oy = -row * stride;
    const instances = [];

    for (const prt of plate.parts) {
      const mesh0 = meshFromTris(prt.tris);
      const mesh = placeMesh(mesh0, ox + bed / 2 + (prt.pos?.[0] || 0), oy + bed / 2 + (prt.pos?.[1] || 0));
      objs.push(`  <object id="${oid}" p:UUID="${uuid()}" type="model">\n${meshXml(mesh)}\n  </object>`);
      builds.push(
        `  <item objectid="${oid}" p:UUID="${uuid()}" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>`
      );
      const md = [
        `    <metadata key="name" value="${xmlAttr(prt.name)}"/>`,
        `    <metadata key="extruder" value="1"/>`,
      ];
      for (const [k, v] of Object.entries(prt.obj_settings || {})) {
        md.push(`    <metadata key="${xmlAttr(k)}" value="${xmlAttr(v)}"/>`);
      }
      msobjs.push(`  <object id="${oid}">\n${md.join("\n")}\n  </object>`);
      instances.push(
        `    <model_instance>\n` +
          `      <metadata key="object_id" value="${oid}"/>\n` +
          `      <metadata key="instance_id" value="0"/>\n` +
          `    </model_instance>`
      );
      oid += 1;
    }

    plateBlocks.push(
      `  <plate>\n` +
        `    <metadata key="plater_id" value="${pi + 1}"/>\n` +
        `    <metadata key="plater_name" value="${xmlAttr(plate.name)}"/>\n` +
        `    <metadata key="locked" value="false"/>\n` +
        `${instances.join("\n")}\n` +
        `  </plate>`
    );
  }

  const MODEL_OPEN =
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ` +
    `xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ` +
    `xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" ` +
    `requiredextensions="p">`;

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n${MODEL_OPEN}\n` +
    ` <metadata name="Application">BambuStudio-02.06.00.51</metadata>\n` +
    ` <metadata name="BambuStudio:3mfVersion">1</metadata>\n` +
    ` <resources>\n${objs.join("\n")}\n </resources>\n` +
    ` <build p:UUID="${uuid()}">\n${builds.join("\n")}\n </build>\n</model>\n`;

  const modelSettings =
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    `${msobjs.join("\n")}\n${plateBlocks.join("\n")}\n</config>\n`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    ` <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
    ` <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n` +
    ` <Default Extension="png" ContentType="image/png"/>\n</Types>\n`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    ` <Relationship Target="/3D/3dmodel.model" Id="rel-1" ` +
    `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n`;

  const sliceInfo =
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <header>\n` +
    `    <header_item key="X-BBL-Client-Type" value="slicer"/>\n` +
    `    <header_item key="X-BBL-Client-Version" value="02.06.00.51"/>\n` +
    `  </header>\n</config>\n`;

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  const buf = zipBuffer([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "3D/3dmodel.model", data: model },
    { name: "Metadata/project_settings.config", data: JSON.stringify(proj, null, 4) },
    { name: "Metadata/model_settings.config", data: modelSettings },
    { name: "Metadata/slice_info.config", data: sliceInfo },
  ]);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function sanitizeName(name) {
  return String(name || "").replace(/[<>:"/\\|?*]/g, "-").trim();
}

/** Default per-object print settings for kumiko lattice parts. */
function latticeObjectSettings(P) {
  const walls = solidWallLoops(Math.max(P.gw, P.iw));
  return {
    layer_height: "0.2",
    wall_loops: String(walls),
    brim_type: "outer_only",
    brim_width: "5",
    brim_object_gap: "0.1",
    enable_support: "0",
  };
}

/** Global project overrides matching DESIGN.md §6 printing notes. */
function latticeProjectOverrides(P) {
  const walls = solidWallLoops(Math.max(P.gw, P.iw));
  const bed = Math.min(Number(P.bx) || 256, Number(P.by) || 256);
  return {
    layer_height: "0.2",
    initial_layer_print_height: "0.2",
    wall_loops: String(walls),
    brim_type: "outer_only",
    brim_width: "5",
    brim_object_gap: "0.1",
    curr_bed_type: "Textured PEI Plate",
    enable_support: "0",
    sparse_infill_density: "15%",
    printable_area: [`0x0`, `${P.bx}x0`, `${P.bx}x${P.by}`, `0x${P.by}`],
    printable_height: String(P.by),
    // Keep A1 process profile (settings work on P2S; Studio remaps via upward_compatible_machine).
    _bed: bed,
  };
}

module.exports = {
  writeBambu3mf,
  solidWallLoops,
  latticeObjectSettings,
  latticeProjectOverrides,
  meshFromTris,
  LINE_WIDTH,
};
