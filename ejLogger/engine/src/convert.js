'use strict';
// ejLogger core: RomRaider 1.1.0 parameter conversion + formatting, ported 1:1.
// Sources: EcuParameterConvertorImpl, JEPUtil (JEP arithmetic), java.text.DecimalFormat.

// ---------------------------------------------------------------------------
// Expression evaluation (JEP subset used by the SSM logger definitions):
// numbers, x / parameter refs (P8, [P9:km/h]), + - * / ( ), unary minus/plus.
// All arithmetic in IEEE doubles, left to right, like JEP's Double operators.
// ---------------------------------------------------------------------------
const exprCache = new Map();

function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if ('+-*/()'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    if (c === '[') { const j = src.indexOf(']', i); if (j < 0) throw new Error('Unclosed [ in ' + src);
      const body = src.slice(i + 1, j), k = body.indexOf(':');
      t.push({ k: 'ref', id: (k < 0 ? body : body.slice(0, k)).trim(), units: k < 0 ? null : body.slice(k + 1).trim() }); i = j + 1; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.eE]/.test(src[j])) { if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1])) j++; j++; }
      t.push({ k: 'num', v: Number(src.slice(i, j)) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      t.push({ k: 'ref', id: src.slice(i, j), units: null }); i = j; continue; }
    throw new Error('Unexpected "' + c + '" in expression ' + src);
  }
  return t;
}

// Recursive descent → closure tree. Precedence: unary > * / > + -, left associative.
function compile(src) {
  let f = exprCache.get(src); if (f) return f;
  const t = tokenize(src); let p = 0;
  const peek = () => t[p], take = () => t[p++];
  function primary() {
    const k = take(); if (!k) throw new Error('Unexpected end of ' + src);
    if (k.k === 'num') { const v = k.v; return () => v; }
    if (k.k === 'ref') { const id = k.id, key = k.units ? id + ':' + k.units : id;
      return id === 'x' ? (env) => env.x : (env) => { const v = env.refs ? env.refs(id, k.units) : undefined; if (v === undefined) throw new Error('No value for ' + key); return v; }; }
    if (k.k === 'op' && k.v === '(') { const e = sum(); const c = take(); if (!c || c.v !== ')') throw new Error('Missing ) in ' + src); return e; }
    if (k.k === 'op' && k.v === '-') { const e = unary(); return (env) => -e(env); }
    if (k.k === 'op' && k.v === '+') return unary();
    throw new Error('Unexpected ' + k.v + ' in ' + src);
  }
  function unary() { return primary(); }
  function prod() { let a = unary(); for (;;) { const k = peek(); if (!k || k.k !== 'op' || (k.v !== '*' && k.v !== '/')) return a;
      take(); const b = unary(), l = a; a = k.v === '*' ? (env) => l(env) * b(env) : (env) => l(env) / b(env); } }
  function sum() { let a = prod(); for (;;) { const k = peek(); if (!k || k.k !== 'op' || (k.v !== '+' && k.v !== '-')) return a;
      take(); const b = prod(), l = a; a = k.v === '+' ? (env) => l(env) + b(env) : (env) => l(env) - b(env); } }
  const root = sum(); if (p !== t.length) throw new Error('Trailing tokens in ' + src);
  f = root; exprCache.set(src, f); return f;
}
const evaluate = (expr, x, refs) => compile(expr)({ x, refs });

// ---------------------------------------------------------------------------
// Raw bytes → value (EcuParameterConvertorImpl.convert)
// ---------------------------------------------------------------------------
function convertBytes(conv, bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), le = conv.endian === 'little';
  const bit = conv.bit == null ? -1 : conv.bit, type = (conv.storagetype || 'uint8').toLowerCase();
  if (bit >= 0 && bit <= 31) { let u = 0; for (const x of b) u = ((u << 8) | x) >>> 0; return (u & (1 << bit)) !== 0 ? 1 : 0; } // asUnsignedInt: big-endian, all bytes
  let result;
  if (type === 'float') result = evaluate(conv.expr, dv.getFloat32(0, le));
  else {
    let v = 0;
    switch (b.length) {
      case 1: v = dv.getInt8(0); break;
      case 2: v = dv.getInt16(0, le); break;
      case 4: v = dv.getInt32(0, le); break;
      default: v = 0;
    }
    if (type.startsWith('uint')) { if (b.length === 1) v &= 0xff; else if (b.length === 2) v &= 0xffff; else if (b.length === 4) v = v >>> 0; }
    result = evaluate(conv.expr, v);
  }
  return Number.isFinite(result) ? result : 0.0;
}

// ---------------------------------------------------------------------------
// java.text.DecimalFormat for the patterns RomRaider defs use ("0", "0.0" … "0.000000"):
// exact binary value, RoundingMode.HALF_EVEN, no grouping, '-' kept on values that round to 0.
// ---------------------------------------------------------------------------
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
function exactDecimal(x) { // |x| as {digits: BigInt string, scale}: value = digits / 10^scale
  f64[0] = Math.abs(x); const lo = u32[0], hi = u32[1];
  const exp = (hi >>> 20) & 0x7ff; let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e; if (exp === 0) e = -1074; else { mant |= 1n << 52n; e = exp - 1075; }
  if (mant === 0n) return { d: 0n, s: 0 };
  if (e >= 0) return { d: mant << BigInt(e), s: 0 };
  return { d: mant * 5n ** BigInt(-e), s: -e };
}
function parsePattern(p) {
  if (!/^0(\.0+)?$/.test(p) && !/^#?0*(\.0*#*)?$/.test(p)) throw new Error('Unsupported DecimalFormat pattern ' + p);
  const dot = p.indexOf('.'), frac = dot < 0 ? '' : p.slice(dot + 1);
  return { minF: (frac.match(/0/g) || []).length, maxF: frac.length, minI: dot < 0 ? (p.match(/0/g) || []).length : (p.slice(0, dot).match(/0/g) || []).length };
}
const patCache = new Map();
// Java's DigitList: start from the shortest round-trip digits (FloatingDecimal), then round HALF_EVEN,
// using whether those digits are exact / were rounded up versus the true binary value to break ties.
function cmpShortest(digits, decExp, x) { // sign of (0.digits × 10^decExp) − |x|
  const { d, s } = exactDecimal(x); let a = BigInt(digits), b = d; const k = decExp - digits.length; // a×10^k vs b×10^-s
  if (k + s >= 0) a *= 10n ** BigInt(k + s); else b *= 10n ** BigInt(-(k + s));
  return a === b ? 0 : (a > b ? 1 : -1);
}
function formatDecimal(x, pattern) {
  let P = patCache.get(pattern); if (!P) { P = parsePattern(pattern); patCache.set(pattern, P); }
  if (Number.isNaN(x)) return '�';
  const neg = x < 0 || Object.is(x, -0);
  if (!Number.isFinite(x)) return (neg ? '-' : '') + '∞';
  let digits = '', decAt = 0;
  if (x !== 0) { const m = Math.abs(x).toExponential().match(/^(\d)(?:\.(\d+))?e([+-]\d+)$/);
    digits = (m[1] + (m[2] || '')).replace(/0+$/, ''); decAt = Number(m[3]) + 1; }
  const keep = decAt + P.maxF; // digits kept (fixed point)
  if (digits.length > keep) {
    let up = false;
    if (keep >= 0) {
      const c = digits.charCodeAt(keep) - 48;
      if (c > 5) up = true;
      else if (c === 5) {
        if (keep < digits.length - 1) up = true;
        else { const cmp = cmpShortest(digits, decAt, x); // >0: shortest was rounded up; <0: true value above it
          if (cmp > 0) up = false; else if (cmp < 0) up = true; else up = keep > 0 && ((digits.charCodeAt(keep - 1) - 48) & 1) === 1; }
      }
    }
    if (keep <= 0) { digits = up ? '1' : ''; if (up) decAt = 1 - P.maxF; } // keep==0 rounding up → one unit in the last place
    else { let a = digits.slice(0, keep).split('').map(Number); if (up) { let i = a.length - 1; while (i >= 0) { if (a[i] === 9) { a[i] = 0; i--; } else { a[i]++; break; } } if (i < 0) { a.unshift(1); decAt++; } }
      digits = a.join('').replace(/0+$/, ''); }
  }
  // lay out
  let ip, fp;
  if (!digits) { ip = ''; fp = ''; }
  else if (decAt <= 0) { ip = ''; fp = '0'.repeat(-decAt) + digits; }
  else if (decAt >= digits.length) { ip = digits + '0'.repeat(decAt - digits.length); fp = ''; }
  else { ip = digits.slice(0, decAt); fp = digits.slice(decAt); }
  fp = fp.slice(0, P.maxF); while (fp.length < P.minF) fp += '0'; while (fp.length > P.minF && fp.endsWith('0')) fp = fp.slice(0, -1);
  while (ip.length < P.minI) ip = '0' + ip;
  return (neg ? '-' : '') + ip + (fp.length ? '.' + fp : '');
}

// Convertor object = one <conversion>: {units, expr, format, storagetype, endian, bit, replace:{formatted:replacement}}
function format(conv, value) { const s = formatDecimal(value, conv.format || '0'); return conv.replace && Object.prototype.hasOwnProperty.call(conv.replace, s) ? conv.replace[s] : s; }

module.exports = { evaluate, compile, convertBytes, formatDecimal, format };
