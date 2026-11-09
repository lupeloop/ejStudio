'use strict';
// ejLogger core: RomRaider logger definition loader (port of LoggerDefinitionHandler, SSM protocol).
// Reads logger_*.xml (e.g. logger_METRIC_EN_v370.xml) and returns the parameters, extended
// parameters and switches this ECU supports, exactly as RomRaider 1.1.0 decides it.

// Minimal XML reader: elements, attributes, text, comments, <?..?>, entities. Enough for RomRaider defs and profiles.
function decode(s) { return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'amp' ? '&' : e === 'quot' ? '"' : e === 'apos' ? "'" : String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))); }
function parseXml(src) {
  const root = { tag: '#root', attrs: {}, kids: [], text: '' }, stack = [root]; let i = 0;
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > i) top.text += decode(src.slice(i, m.index));
    i = re.lastIndex;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const el = { tag: m[3], attrs: {}, kids: [], text: '' }, ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let a;
      while ((a = ar.exec(m[4]))) el.attrs[a[1]] = decode(a[2] !== undefined ? a[2] : a[3]);
      top.kids.push(el); if (!m[5]) stack.push(el);
    }
  }
  return root;
}
const kids = (el, tag) => el.kids.filter(k => k.tag === tag);
const kid = (el, tag) => el.kids.find(k => k.tag === tag);
const hexBytes = s => { s = String(s).trim().replace(/^0x/i, ''); if (s.length % 2) s = '0' + s; return Buffer.from(s, 'hex'); };

// EcuAddressImpl: each <address> string is the start; length n expands to n consecutive byte addresses.
function makeAddress(strs, length, bit) {
  const out = [];
  for (const s of strs) { const v = parseInt(String(s).trim().replace(/^0x/i, ''), 16); for (let k = 0; k < (length || 1); k++) out.push(v + k); }
  return { addrs: out, length: length || 1, bit: bit == null ? -1 : bit };
}
function conversionsOf(el, derived) {
  return kids(kid(el, 'conversions') || { kids: [] }, 'conversion').map(c => {
    const replace = {}; for (const r of kids(c, 'replace')) replace[r.attrs.value] = r.attrs.with;
    return { units: c.attrs.units, expr: c.attrs.expr, format: c.attrs.format, storagetype: c.attrs.storagetype || null,
      endian: (c.attrs.endian || '').toLowerCase() === 'little' ? 'little' : 'big', replace, derived: !!derived,
      gauge: { min: num(c.attrs.gauge_min), max: num(c.attrs.gauge_max), step: num(c.attrs.gauge_step) } };
  });
}
const num = v => v == null ? null : Number(v);
// isSupportedParameter: (initBytes[ecubyteindex] & 1<<ecubit) != 0; index beyond the init data → unsupported.
function supported(init, idx, bit) {
  if (idx == null || bit == null || !init) return true;
  const i = parseInt(idx, 10); if (!(i < init.length)) return false;
  return (init[i] & (1 << parseInt(bit, 10))) !== 0;
}

// load(xmlText, {protocol:'SSM', ecuInit:{ecuId, bytes}}) → {version, connection, modules, params, ecuparams, switches, byId}
function load(xml, opt = {}) {
  const proto = (opt.protocol || 'SSM').toUpperCase(), init = opt.ecuInit ? opt.ecuInit.bytes : null, ecuId = opt.ecuInit ? opt.ecuInit.ecuId : null;
  const doc = parseXml(xml), logger = kid(doc, 'logger'); if (!logger) throw new Error('Not a RomRaider logger definition');
  const P = kids(kid(logger, 'protocols'), 'protocol').find(p => (p.attrs.id || '').toUpperCase() === proto);
  if (!P) throw new Error('Protocol ' + proto + ' not in definition');
  const a = P.attrs, connection = { baud: +a.baud, dataBits: +a.databits, stopBits: +a.stopbits, parity: +a.parity, connectTimeout: +a.connect_timeout, sendTimeout: +a.send_timeout };
  const modules = [];
  for (const tr of kids(kid(P, 'transports') || { kids: [] }, 'transport'))
    for (const m of kids(tr, 'module')) modules.push({ transport: tr.attrs.id, id: m.attrs.id, address: hexBytes(m.attrs.address), tester: hexBytes(m.attrs.tester), desc: m.attrs.desc, fastpoll: String(m.attrs.fastpoll).toLowerCase() === 'true' });
  const byId = {}, params = [], ecuparams = [], switches = [], verified = !!init;
  const base = el => ({ id: el.attrs.id, name: el.attrs.name, desc: el.attrs.desc, group: el.attrs.group, subgroup: el.attrs.subgroup, groupsize: el.attrs.groupsize, target: el.attrs.target });
  for (const el of kids(kid(P, 'parameters') || { kids: [] }, 'parameter')) { if (/merpmod/i.test(el.attrs.name || '')) continue;
    const dep = kid(el, 'depends');
    if (dep) { // derived: resolved after all direct parameters exist (RomRaider resolves refs already in its map)
      params.push({ ...base(el), kind: 'derived', depends: kids(dep, 'ref').map(r => r.attrs.parameter), convs: conversionsOf(el, true), ecubyteindex: el.attrs.ecubyteindex, ecubit: el.attrs.ecubit }); continue; }
    if (!supported(init, el.attrs.ecubyteindex, el.attrs.ecubit)) continue;
    const ad = kids(el, 'address'), len = ad.length && ad[0].attrs.length ? +ad[0].attrs.length : 1, bit = ad.length && ad[0].attrs.bit != null ? +ad[0].attrs.bit : -1;
    let convs = conversionsOf(el); if (!convs.length) convs = [{ units: 'Raw data', expr: 'x', format: '0', storagetype: 'uint', endian: 'big', replace: {}, gauge: {} }];
    const p = { ...base(el), kind: 'param', address: makeAddress(ad.map(x => x.text), len, bit), convs }; params.push(p); byId[p.id] = p;
  }
  // derived parameters: kept only if every dependency is a known parameter (as RomRaider's ecuDataMap lookup)
  for (let k = params.length - 1; k >= 0; k--) { const p = params[k]; if (p.kind !== 'derived') continue;
    if (p.depends.every(d => byId[d])) byId[p.id] = p; else params.splice(k, 1); }
  for (const el of kids(kid(P, 'ecuparams') || { kids: [] }, 'ecuparam')) { if (/merpmod/i.test(el.attrs.name || '')) continue;
    let hit = null; for (const e of kids(el, 'ecu')) { if (ecuId == null || String(e.attrs.id).split(',').map(s => s.trim()).includes(ecuId)) { hit = e; break; } }
    if (!hit) continue;
    const ad = kids(hit, 'address'), len = ad.length && ad[0].attrs.length ? +ad[0].attrs.length : 1, bit = ad.length && ad[0].attrs.bit != null ? +ad[0].attrs.bit : -1;
    const p = { ...base(el), kind: 'ecuparam', address: makeAddress(ad.map(x => x.text), len, bit), convs: conversionsOf(el) };
    ecuparams.push(p); byId[p.id] = p;
  }
  for (const el of kids(kid(P, 'switches') || { kids: [] }, 'switch')) { if (/merpmod/i.test(el.attrs.name || '')) continue;
    if (!supported(init, el.attrs.ecubyteindex, el.attrs.bit)) continue;
    const s = { ...base(el), kind: 'switch', address: makeAddress([el.attrs.byte], 1, +el.attrs.bit), convs: [{ units: el.attrs.units || 'On/Off', expr: 'x', format: '0', storagetype: el.attrs.storagetype || null, endian: 'big', replace: {}, gauge: {}, switchBit: +el.attrs.bit }] };
    switches.push(s); byId[s.id] = s;
  }
  return { version: logger.attrs.version, protocol: proto, connection, modules, params, ecuparams, switches, byId, verified };
}

module.exports = { load, parseXml, kids, kid, makeAddress, supported };
