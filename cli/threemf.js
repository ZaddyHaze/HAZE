// Bambu Studio project (.3mf) writer: named objects, several plates, per-object print settings, optional pause.
// No dependencies (zip + deflate via Node's zlib; store-method ZIP in the browser).
// Works in Node (require) and in the browser (<script> → globalThis.ThreeMF).
//   write3mf(file, opts)                          // Node only
//   build3mf(opts) → Buffer|Uint8Array            // Node + browser
//   planPanelPlates(objects, bed)                 // one plate per large part; pack hardware
//   panelObjectSettings(name)                     // HANDOFF per-object print settings
// opts: { bed: [256, 256], plates: [{ name, pauseAt, objects: [{ name, tris, settings }] }], title, designer }
// tris: [[[x,y,z],[x,y,z],[x,y,z]], ...] already in print orientation (z up from the bed).
(function (root) {
  "use strict";
  const isNode = typeof module === "object" && module.exports && typeof require === "function";
  const zlib = isNode ? require("zlib") : null;
  const fs = isNode ? require("fs") : null;
  const TextEnc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

  // ---- bytes ----
  function toU8(data) {
    if (typeof data === "string") {
      if (isNode) return Buffer.from(data, "utf8");
      return TextEnc.encode(data);
    }
    if (isNode && Buffer.isBuffer(data)) return data;
    if (data instanceof Uint8Array) return isNode ? Buffer.from(data) : data;
    return isNode ? Buffer.from(data) : new Uint8Array(data);
  }
  function concatU8(parts) {
    if (isNode) return Buffer.concat(parts.map(toU8));
    let n = 0; for (const p of parts) n += toU8(p).length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { const u = toU8(p); out.set(u, o); o += u.length; }
    return out;
  }
  function alloc(n) { return isNode ? Buffer.alloc(n) : new Uint8Array(n); }
  function writeU16(b, o, n) { if (isNode) b.writeUInt16LE(n, o); else new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true); }
  function writeU32(b, o, n) { if (isNode) b.writeUInt32LE(n >>> 0, o); else new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(o, n >>> 0, true); }

  // ---- zip ----
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { const u = toU8(b); let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) { // [{name, data: Buffer|Uint8Array|string}]
    const locals = [], centrals = []; let off = 0;
    const useDeflate = !!(zlib && zlib.deflateRawSync);
    for (const f of files) {
      const raw = toU8(f.data);
      const comp = useDeflate ? zlib.deflateRawSync(raw, { level: 6 }) : raw;
      const method = useDeflate ? 8 : 0;
      const name = toU8(f.name), crc = crc32(raw);
      const lh = alloc(30); writeU32(lh, 0, 0x04034b50); writeU16(lh, 4, 20); writeU16(lh, 6, 0x0800); writeU16(lh, 8, method);
      writeU32(lh, 10, 0); writeU32(lh, 14, crc); writeU32(lh, 18, comp.length); writeU32(lh, 22, raw.length); writeU16(lh, 26, name.length); writeU16(lh, 28, 0);
      const ch = alloc(46); writeU32(ch, 0, 0x02014b50); writeU16(ch, 4, 20); writeU16(ch, 6, 20); writeU16(ch, 8, 0x0800); writeU16(ch, 10, method);
      writeU32(ch, 12, 0); writeU32(ch, 16, crc); writeU32(ch, 20, comp.length); writeU32(ch, 24, raw.length); writeU16(ch, 28, name.length);
      writeU32(ch, 42, off);
      locals.push(lh, name, comp); centrals.push(ch, name); off += 30 + name.length + comp.length;
    }
    const cd = concatU8(centrals), end = alloc(22);
    writeU32(end, 0, 0x06054b50); writeU16(end, 8, files.length); writeU16(end, 10, files.length); writeU32(end, 12, cd.length); writeU32(end, 16, off);
    return concatU8([...locals, cd, end]);
  }

  // ---- mesh ----
  function mesh(tris) { // dedupe vertices; return {verts, faces, min, max}
    const map = new Map(), verts = [], faces = [], min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    const id = p => { const k = p.map(v => Math.round(v * 1e4)).join(","); let i = map.get(k);
      if (i === undefined) { i = verts.length; map.set(k, i); verts.push(p); for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); } } return i; };
    for (const t of tris) { const f = t.map(id); if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]) faces.push(f); }
    return { verts, faces, min, max };
  }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmt = v => (Math.abs(v) < 5e-7 ? 0 : +v.toFixed(5)).toString();

  // shelf-pack objects on a plate, centred; returns [x, y] offsets for each object's min corner
  function pack(sizes, bed, gap = 8, margin = 12) {
    const W = bed[0] - 2 * margin, pos = []; let x = 0, y = 0, row = 0;
    sizes.forEach((s, i) => { if (x > 0 && x + s[0] > W) { x = 0; y += row + gap; row = 0; } pos[i] = [x, y]; x += s[0] + gap; row = Math.max(row, s[1]); });
    const totalH = y + row, usedW = Math.max(...sizes.map((s, i) => pos[i][0] + s[0]));
    const ox = (bed[0] - usedW) / 2, oy = (bed[1] - totalH) / 2;
    if (usedW > bed[0] - 2 || totalH > bed[1] - 2) throw new Error("objects don't fit on one plate: " + usedW.toFixed(0) + " x " + totalH.toFixed(0));
    return pos.map((p, i) => [p[0] + ox, oy + totalH - p[1] - sizes[i][1]]); // first row at the back
  }

  function footprint(tris) {
    const m = mesh(tris);
    return [m.max[0] - m.min[0], m.max[1] - m.min[1]];
  }

  /** Pucks, shims, standoffs, keys, clips, cleats/hooks — no brim. Tiles, frame, backers — mouse-ear brim. */
  function isHardwarePart(name) {
    const n = String(name || "").toLowerCase();
    return /^(wall_puck|puck_shim|frame_standoff|bowtie_key|furniture_clip|wall_cleat|cleat_hook)/.test(n);
  }

  /**
   * Per-object settings from HANDOFF.md:
   * 0.2 mm layers, 4 walls, mouse-ear brim on tiles/frame/backers, no brim on hardware,
   * supports off, X-Y hole/contour compensation 0.
   */
  function panelObjectSettings(partName) {
    const brim = isHardwarePart(partName)
      ? { brim_type: "no_brim", brim_width: "0" }
      : { brim_type: "brim_ears", brim_width: "5", brim_object_gap: "0.1" };
    return Object.assign({
      layer_height: "0.2",
      wall_loops: "4",
      enable_support: "0",
      xy_hole_compensation: "0",
      xy_contour_compensation: "0",
    }, brim);
  }

  function isLargePart(name, size, bed) {
    if (/^tile_/i.test(name) || /^backer_/i.test(name)) return true;
    if (isHardwarePart(name)) return false;
    const usable = Math.min(bed[0], bed[1]) - 24;
    const [w, h] = size;
    return w > usable * 0.45 || h > usable * 0.45 || w * h > usable * usable * 0.2;
  }

  function withSettings(o) {
    return { name: o.name, tris: o.tris, settings: o.settings || panelObjectSettings(o.name) };
  }

  /**
   * Prefer one plate per large part (tiles near bed-sized); pack smaller hardware
   * onto shared plates when they fit. objects: [{ name, tris, settings? }]
   */
  function planPanelPlates(objects, bed) {
    bed = bed || [256, 256];
    const sized = objects.map(o => ({ ...withSettings(o), size: footprint(o.tris) }));
    const plates = [];
    const small = [];
    for (const o of sized) {
      if (isLargePart(o.name, o.size, bed)) plates.push({ name: o.name, objects: [withSettings(o)] });
      else small.push(o);
    }
    let cur = [];
    for (const o of small) {
      const trial = cur.concat([o]);
      try {
        pack(trial.map(x => x.size), bed);
        cur = trial;
      } catch (_) {
        if (cur.length) plates.push({ name: cur.map(x => x.name).join(" + ").slice(0, 80), objects: cur.map(withSettings) });
        cur = [o];
      }
    }
    if (cur.length) plates.push({ name: cur.map(x => x.name).join(" + ").slice(0, 80), objects: cur.map(withSettings) });
    return plates;
  }

  function build3mfFiles({ bed = [256, 256], plates, title = "Living Lattice", designer = "Travis Hergenreder" }) {
    const cols = (() => { const v = Math.sqrt(plates.length), r = Math.round(v); return v > r ? r + 1 : r; })();
    const stride = [bed[0] * 1.2, bed[1] * 1.2];
    let oid = 0, objXml = "", items = "", settings = "", plateXml = "", pauses = "";
    plates.forEach((pl, pi) => {
      const col = pi % cols, row = Math.floor(pi / cols), base = [col * stride[0], -row * stride[1]];
      const meshes = pl.objects.map(o => mesh(o.tris));
      const sizes = meshes.map(m => [m.max[0] - m.min[0], m.max[1] - m.min[1]]);
      const at = pack(sizes, bed);
      let inst = "";
      pl.objects.forEach((o, k) => {
        const m = meshes[k], id = ++oid, c = [(m.min[0] + m.max[0]) / 2, (m.min[1] + m.max[1]) / 2, m.min[2]];
        // mesh centred on its own origin (x, y) with z from 0; the item transform places it on the plate
        const v = m.verts.map(p => `<vertex x="${fmt(p[0] - c[0])}" y="${fmt(p[1] - c[1])}" z="${fmt(p[2] - c[2])}"/>`).join("");
        const f = m.faces.map(q => `<triangle v1="${q[0]}" v2="${q[1]}" v3="${q[2]}"/>`).join("");
        objXml += `<object id="${id}" name="${esc(o.name)}" type="model"><mesh><vertices>${v}</vertices><triangles>${f}</triangles></mesh></object>\n`;
        const tx = base[0] + at[k][0] + sizes[k][0] / 2, ty = base[1] + at[k][1] + sizes[k][1] / 2;
        items += `<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${fmt(tx)} ${fmt(ty)} 0" printable="1"/>\n`;
        const s = Object.entries(o.settings || {}).map(([key, val]) => `    <metadata key="${key}" value="${esc(val)}"/>\n`).join("");
        settings += `  <object id="${id}">\n    <metadata key="name" value="${esc(o.name)}"/>\n    <metadata key="extruder" value="1"/>\n${s}    <part id="${id}" subtype="normal_part">\n      <metadata key="name" value="${esc(o.name)}"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n    </part>\n  </object>\n`;
        inst += `    <model_instance>\n      <metadata key="object_id" value="${id}"/>\n      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="${1000 + id}"/>\n    </model_instance>\n`;
      });
      plateXml += `  <plate>\n    <metadata key="plater_id" value="${pi + 1}"/>\n    <metadata key="plater_name" value="${esc(pl.name)}"/>\n    <metadata key="locked" value="false"/>\n${inst}  </plate>\n`;
      if (pl.pauseAt) pauses += `<plate>\n<plate_info id="${pi + 1}"/>\n<layer top_z="${fmt(pl.pauseAt + 0.2)}" type="1" extruder="1" color="" extra="Drop the magnets in" gcode="M400 U1"/>\n<mode value="SingleExtruder"/>\n</plate>\n`;
    });
    const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
 <metadata name="Application">Living Lattice builder</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(title)}</metadata>
 <metadata name="Designer">${esc(designer)}</metadata>
 <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
 <resources>
${objXml} </resources>
 <build>
${items} </build>
</model>
`;
    const files = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n <Default Extension="png" ContentType="image/png"/>\n</Types>\n` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n` },
      { name: "3D/3dmodel.model", data: model },
      { name: "Metadata/model_settings.config", data: `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${settings}${plateXml}</config>\n` },
    ];
    if (pauses) files.push({ name: "Metadata/custom_gcode_per_layer.xml", data: `<?xml version="1.0" encoding="utf-8"?>\n<custom_gcodes_per_layer>\n${pauses}</custom_gcodes_per_layer>\n` });
    return { files, plates: plates.length, objects: oid };
  }

  function build3mf(opts) {
    const built = build3mfFiles(opts);
    const buf = zip(built.files);
    return { buffer: buf, plates: built.plates, objects: built.objects };
  }

  function write3mf(file, opts) {
    if (!isNode) throw new Error("write3mf is Node-only; use build3mf() in the browser");
    const r = build3mf(opts);
    fs.writeFileSync(file, r.buffer);
    return { plates: r.plates, objects: r.objects };
  }

  /** Build a panel .3mf from a flat part list (applies settings + plate packing). */
  function buildPanel3mf(parts, opts) {
    opts = opts || {};
    const bed = opts.bed || [256, 256];
    const plates = planPanelPlates(parts, bed);
    const r = build3mf({
      bed,
      plates,
      title: opts.title || "Living Lattice",
      designer: opts.designer || "Travis Hergenreder",
    });
    return Object.assign(r, { plateList: plates });
  }

  function writePanel3mf(file, parts, opts) {
    if (!isNode) throw new Error("writePanel3mf is Node-only");
    const r = buildPanel3mf(parts, opts);
    fs.writeFileSync(file, r.buffer);
    return { plates: r.plates, objects: r.objects, plateList: r.plateList };
  }

  const api = {
    write3mf, build3mf, build3mfFiles, zip, mesh, pack, footprint,
    isHardwarePart, panelObjectSettings, planPanelPlates, buildPanel3mf, writePanel3mf,
  };
  if (isNode) module.exports = api;
  else root.ThreeMF = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
