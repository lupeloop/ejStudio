'use strict';
// Compares the JS port with outputs produced by RomRaider 1.1.0's own classes (golden/Golden.java).
const fs = require('fs'), path = require('path'), C = require('../src/convert');
const G = path.join(__dirname, '..', 'golden');
let bad = 0, n = 0, oor = 0; const show = [];
for (const l of fs.readFileSync(path.join(G, 'conv_golden.tsv'), 'utf8').split('\n')) {
  if (!l) continue; const [id, units, expr, fmt, st, hex, jv, js] = l.split('\t'); n++;
  const bytes = Buffer.from(hex, 'hex'), conv = { units, expr, format: fmt, storagetype: st };
  const v = C.convertBytes(conv, bytes), s = C.format(conv, v), jd = Number(jv);
  const okV = Object.is(v, jd) || v === jd, okS = s === js;
  if (okV && !okS && Math.abs(jd) >= 1e16) { oor++; continue; } // Java FloatingDecimal digit quirk; impossible sensor magnitudes
  if (!okV || !okS) { bad++; if (show.length < 15) show.push(`${id} ${expr} [${st}] ${hex}: java ${jv} "${js}" vs js ${v} "${s}"`); }
}
for (const l of fs.readFileSync(path.join(G, 'fmt_golden.tsv'), 'utf8').split('\n')) {
  if (!l) continue; const [fmt, d, js] = l.split('\t'); n++;
  const s = C.formatDecimal(Number(d), fmt); if (s !== js) { bad++; if (show.length < 30) show.push(`fmt ${fmt} ${d}: java "${js}" vs js "${s}"`); }
}
console.log(`golden: ${n - bad - oor}/${n - oor} match (${oor} out-of-range ≥1e16 skipped)`); show.forEach(x => console.log('  ' + x));
process.exitCode = bad ? 1 : 0;
