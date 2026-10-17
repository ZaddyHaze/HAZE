// Bambu Studio–compatible .3mf builder: geometry + project settings + per-object
// overrides. Works in Node (CLI) and in the browser (script tag → globalThis.Bambu3mf).
// The ZIP is assembled by hand — lib3mf would strip the Bambu sidecars.
(function (root) {
  "use strict";

  const LINE_WIDTH = 0.4; // 0.4 mm nozzle line width used throughout the project
  const isNode = typeof module === "object" && module.exports && typeof require === "function";

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function xmlAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Wall loops so a bar of `width` mm prints solid (walls meet in the middle). */
  function solidWallLoops(width, lineWidth) {
    const lw = lineWidth == null ? LINE_WIDTH : lineWidth;
    return Math.max(2, Math.ceil(width / (2 * lw)));
  }

  function plateCols(n) {
    if (n <= 0) return 1;
    const v = Math.sqrt(n);
    const r = Math.floor(v + 0.5);
    return v > r ? r + 1 : Math.max(1, r);
  }

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
    for (const t of tris) faces.push([idx(t[0]), idx(t[1]), idx(t[2])]);
    return { verts, faces };
  }

  function boundsOf(verts) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < verts.length; i++) {
      const p = verts[i], x = p[0], y = p[1], z = p[2];
      if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

  function placeMesh(mesh, cx, cy) {
    const b = boundsOf(mesh.verts);
    const ox = cx - (b.minX + b.maxX) / 2;
    const oy = cy - (b.minY + b.maxY) / 2;
    const oz = -b.minZ;
    const verts = [];
    for (let i = 0; i < mesh.verts.length; i++) {
      const p = mesh.verts[i];
      verts.push([p[0] + ox, p[1] + oy, p[2] + oz]);
    }
    return { faces: mesh.faces, verts };
  }

  function meshXml(mesh) {
    const vlines = [];
    for (let i = 0; i < mesh.verts.length; i++) {
      const p = mesh.verts[i];
      vlines.push(`     <vertex x="${p[0].toFixed(6)}" y="${p[1].toFixed(6)}" z="${p[2].toFixed(6)}"/>`);
    }
    const tlines = [];
    for (let i = 0; i < mesh.faces.length; i++) {
      const f = mesh.faces[i];
      tlines.push(`     <triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`);
    }
    return (
      `   <mesh>\n    <vertices>\n${vlines.join("\n")}\n    </vertices>\n` +
      `    <triangles>\n${tlines.join("\n")}\n    </triangles>\n   </mesh>`
    );
  }

  function sanitizeName(name) {
    return String(name || "").replace(/[<>:"/\\|?*]/g, "-").trim();
  }

  /** Tiles + frame pieces get mouse-ear brims; pucks/shims/standoffs/keys get none. */
  function isLatticePart(name) {
    const n = String(name || "").toLowerCase();
    if (/^(tile_|border_|splice_)/.test(n)) return true;
    if (/^(wall_puck|puck_shim|frame_standoff|bowtie_key|wall_cleat|cleat_hook)/.test(n)) return false;
    // default: treat unknown printables as lattice (brim ears)
    return true;
  }

  /**
   * Per-object settings from HANDOFF.md:
   * 0.2 mm layers, 4 walls, mouse-ear brim on tiles/frame, no brim on hardware,
   * supports off, X-Y hole/contour compensation 0.
   */
  function latticeObjectSettings(P, partName) {
    const brim = isLatticePart(partName)
      ? { brim_type: "brim_ears", brim_width: "5", brim_object_gap: "0.1" }
      : { brim_type: "no_brim", brim_width: "0" };
    return Object.assign({
      layer_height: "0.2",
      wall_loops: "4",
      enable_support: "0",
      xy_hole_compensation: "0",
      xy_contour_compensation: "0",
    }, brim);
  }

  function latticeProjectOverrides(P) {
    const bed = Math.min(Number(P.bx) || 256, Number(P.by) || 256);
    return {
      layer_height: "0.2",
      initial_layer_print_height: "0.2",
      wall_loops: "4",
      brim_type: "brim_ears",
      brim_width: "5",
      brim_object_gap: "0.1",
      curr_bed_type: "Textured PEI Plate",
      enable_support: "0",
      xy_hole_compensation: "0",
      xy_contour_compensation: "0",
      sparse_infill_density: "15%",
      printable_area: [`0x0`, `${P.bx}x0`, `${P.bx}x${P.by}`, `0x${P.by}`],
      printable_height: String(P.by),
      _bed: bed,
    };
  }

  /**
   * Build the file map for a multi-plate Bambu Studio project (no ZIP yet).
   * @param {Array<{name:string, tris:any[], obj_settings?:object}>} parts
   * @param {object} overrides project_settings keys (merged onto template)
   * @param {{bed?:number, template:object}} opts template is required in the browser
   * @returns {{files: Record<string,string>, objectCount:number}}
   */
  function buildBambuPackage(parts, overrides, opts) {
    opts = opts || {};
    const bed = opts.bed != null ? opts.bed : 256;
    let template = opts.template;
    if (!template) {
      if (!isNode) throw new Error("Bambu3mf.buildBambuPackage needs opts.template in the browser");
      template = loadTemplate();
    }
    const proj = Object.assign({}, template, overrides || {});
    delete proj._bed;
    if (!(overrides && overrides.printable_area)) {
      proj.printable_area = [`0x0`, `${bed}x0`, `${bed}x${bed}`, `0x${bed}`];
    }

    const plates = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      plates.push({
        name: sanitizeName(p.name) || `Part ${i + 1}`,
        parts: [{ name: p.name, tris: p.tris, obj_settings: p.obj_settings, pos: [0, 0] }],
      });
    }

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

      for (let j = 0; j < plate.parts.length; j++) {
        const prt = plate.parts[j];
        const mesh0 = meshFromTris(prt.tris);
        const px = prt.pos && prt.pos[0] != null ? prt.pos[0] : 0;
        const py = prt.pos && prt.pos[1] != null ? prt.pos[1] : 0;
        const mesh = placeMesh(mesh0, ox + bed / 2 + px, oy + bed / 2 + py);
        objs.push(`  <object id="${oid}" p:UUID="${uuid()}" type="model">\n${meshXml(mesh)}\n  </object>`);
        builds.push(
          `  <item objectid="${oid}" p:UUID="${uuid()}" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>`
        );
        const md = [
          `    <metadata key="name" value="${xmlAttr(prt.name)}"/>`,
          `    <metadata key="extruder" value="1"/>`,
        ];
        const settings = prt.obj_settings || {};
        for (const k of Object.keys(settings)) {
          md.push(`    <metadata key="${xmlAttr(k)}" value="${xmlAttr(settings[k])}"/>`);
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

    return {
      objectCount: parts.length,
      files: {
        "[Content_Types].xml": contentTypes,
        "_rels/.rels": rels,
        "3D/3dmodel.model": model,
        "Metadata/project_settings.config": JSON.stringify(proj, null, 4),
        "Metadata/model_settings.config": modelSettings,
        "Metadata/slice_info.config": sliceInfo,
      },
    };
  }

  function loadTemplate() {
    const fs = require("fs");
    const path = require("path");
    return JSON.parse(fs.readFileSync(path.join(__dirname, "bambu_profile_template.json"), "utf8"));
  }

  // Minimal ZIP writer (store + raw deflate) — Node only.
  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }

  function zipBuffer(fileList) {
    const { deflateRawSync } = require("zlib");
    const locals = [];
    const centrals = [];
    let offset = 0;
    const enc = (s) => Buffer.from(s, "utf8");

    for (let fi = 0; fi < fileList.length; fi++) {
      const f = fileList[fi];
      const name = enc(f.name);
      const raw = Buffer.isBuffer(f.data) ? f.data : enc(f.data);
      const compressed = deflateRawSync(raw, { level: 9 });
      const crc = crc32(raw);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 6);
      local.writeUInt16LE(8, 8);
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
    end.writeUInt16LE(fileList.length, 8);
    end.writeUInt16LE(fileList.length, 10);
    end.writeUInt32LE(centralDir.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat(locals.concat([centralDir, end]));
  }

  function writeBambu3mf(outPath, parts, overrides, opts) {
    if (!isNode) throw new Error("writeBambu3mf is Node-only; use buildBambuPackage + JSZip in the browser");
    const fs = require("fs");
    const path = require("path");
    opts = opts || {};
    if (!opts.template) opts = Object.assign({}, opts, { template: loadTemplate() });
    const pack = buildBambuPackage(parts, overrides, opts);
    const list = Object.keys(pack.files).map((name) => ({ name, data: pack.files[name] }));
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, zipBuffer(list));
    return outPath;
  }

  const api = {
    buildBambuPackage,
    writeBambu3mf,
    solidWallLoops,
    isLatticePart,
    latticeObjectSettings,
    latticeProjectOverrides,
    meshFromTris,
    loadTemplate,
    LINE_WIDTH,
  };

  if (isNode) module.exports = api;
  else root.Bambu3mf = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
