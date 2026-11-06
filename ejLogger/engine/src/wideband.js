'use strict';
// ejLogger: external wideband plugins (RomRaider's external data sources).
// Each sensor is a logger "external" item: the logger writes its latest value into every row.
// A missing port retries every 1 s; logging carries on without it.
const C = require('./convert');

// Names and units exactly as RomRaider writes them in the CSV header.
const SENSORS = {
  aem: { label: 'AEM UEGO', baud: 9600, name: 'AEM UEGO Wideband [9600 baud]',
    convs: [{ units: 'AFR Gasoline', expr: 'x', format: '0.00' }, { units: 'Lambda', expr: 'x/14.7', format: '0.00' }] },
  innovate: { label: 'Innovate LC-2 (MTS)', baud: 19200, name: 'Innovate Wideband AFR',
    convs: [{ units: 'AFR Gasoline', expr: 'x', format: '0.00' }, { units: 'Lambda', expr: 'x/14.7', format: '0.00' }] },
  plx: { label: 'PLX', baud: 19200, name: 'PLX O2 - Wideband',
    convs: [{ units: 'AFR Gasoline', expr: 'x', format: '0.00' }, { units: 'Lambda', expr: 'x/14.7', format: '0.00' }] },
};

// --- parsers: bytes in, AFR (gasoline) out -----------------------------------------------
// AEM 30-0300/30-4110 serial: ASCII AFR per line ("14.7\r\n").
function aemParser(emit) { let s = ''; return b => { s += b.toString('latin1'); let i; while ((i = s.search(/[\r\n]/)) >= 0) { const line = s.slice(0, i).trim(); s = s.slice(i + 1); const v = parseFloat(line); if (line && Number.isFinite(v)) emit(v); } if (s.length > 64) s = ''; }; }
// Innovate MTS: header word (b0 & 0xA2) == 0xA2, b1 bit7 set; LC-1/LC-2 frame = 2 words: [010 FFF 1 AF7][0 AF6..0] [00 L12..L7][0 L6..L0]
function mtsParser(emit) { let buf = []; return b => { for (const x of b) buf.push(x); for (;;) {
  let h = -1; for (let i = 0; i + 1 < buf.length; i++) if ((buf[i] & 0xA2) === 0xA2 && (buf[i + 1] & 0x80)) { h = i; break; }
  if (h < 0) { if (buf.length > 64) buf = buf.slice(-2); return; }
  const words = ((buf[h] & 0x01) << 7) | (buf[h + 1] & 0x7F), len = 2 + words * 2; if (buf.length < h + len) { if (h) buf = buf.slice(h); return; }
  const p = buf.slice(h + 2, h + len); buf = buf.slice(h + len);
  if (p.length >= 4 && (p[0] & 0xE2) === 0x42) { const func = (p[0] >> 2) & 0x07, af = ((p[0] & 0x01) << 7) | (p[1] & 0x7F), l = ((p[2] & 0x3F) << 7) | (p[3] & 0x7F);
    if (func === 0) emit((l + 500) * 0.001 * af / 10); /* other functions (O2 %, calibrating, warm-up, error) carry no AFR */ } } }; }
// PLX iMFD: 0x80 start, [addrMSB addrLSB inst dataMSB dataLSB]… (6-bit fields), 0x40 end. Wideband AFR = sensor 0, λ = (raw/3.75 + 68)/100.
function plxParser(emit) { let buf = [], on = false; return b => { for (const x of b) {
  if (x === 0x80) { on = true; buf = []; continue; } if (!on) continue; if (x === 0x40) { on = false;
    for (let i = 0; i + 5 <= buf.length; i += 5) { const addr = (buf[i] << 6) | buf[i + 1], raw = (buf[i + 3] << 6) | buf[i + 4]; if (addr === 0 && buf[i + 2] === 0) { emit((raw / 3.75 + 68) / 100 * 14.7); break; } }
    continue; } buf.push(x & 0x3F); } }; }
const PARSERS = { aem: aemParser, innovate: mtsParser, plx: plxParser };

// Wideband(type, port, units, {openRaw, log, onState}) — external item + connection loop
class Wideband {
  constructor(type, port, units, o) {
    const S = SENSORS[type]; if (!S) throw new Error('Unknown wideband ' + type);
    this.type = type; this.port = port; this.o = o; this.S = S; this.value = 0; this.ok = false; this.stopped = false; this.sp = null; this.last = 0;
    this.conv = S.convs.find(c => c.units === units) || S.convs[0];
    const self = this;
    this.item = { external: true, key: 'wb:' + type + '|' + this.conv.units, id: 'wb:' + type, name: S.name, addrs: [], units: () => self.conv.units, conv: () => self.conv,
      format: v => C.format(self.conv, v), latest: () => C.evaluate(self.conv.expr, self.value) };
  }
  start() { this.stopped = false; this.loop(); }
  async loop() {
    while (!this.stopped) {
      if (!this.sp) {
        try {
          this.sp = await this.o.openRaw(this.port, { baud: this.S.baud, dataBits: 8, stopBits: 1, parity: 0 });
          const parse = PARSERS[this.type](v => { this.value = v; this.last = Date.now(); if (!this.ok) { this.ok = true; this.state(); } });
          this.sp.on('data', parse); this.sp.on('close', () => { this.sp = null; this.ok = false; this.state(); }); this.sp.on('error', () => {});
          this.state('open');
        } catch (e) { this.sp = null; this.state('missing', e.message); }
      } else if (this.ok && Date.now() - this.last > 3000) { this.ok = false; this.state(); }
      await new Promise(r => setTimeout(r, 1000)); // retry every 1 s
    }
  }
  state(s, msg) { this.o.onState && this.o.onState({ type: this.type, port: this.port, ok: this.ok, open: !!this.sp, state: s || (this.ok ? 'ok' : this.sp ? 'open' : 'missing'), msg }); }
  stop() { this.stopped = true; if (this.sp) { try { this.sp.close(); } catch (_) {} this.sp = null; } this.ok = false; }
}

module.exports = { SENSORS, Wideband, PARSERS };
