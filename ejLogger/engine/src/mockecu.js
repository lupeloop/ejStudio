'use strict';
// Simulated Subaru ECU on a K-Line at 4800 baud: echoes requests, answers init and A8 reads,
// streams continuously in fast-poll mode, and (optionally) delivers bytes in Bluetooth-style bursts.
const SSM = require('./ssm');
function mockEcu({ ecuId = '5104504007', initBytes = null, memory = (a, t) => (a * 7 + t) & 0xff, baud = 4800, burstMs = 0, corruptEvery = 0 } = {}) {
  let rx = Buffer.alloc(0), stream = null, sent = 0, timer = null, brk = false; const pending = []; let tick = 0; const t0 = Date.now();
  const deliver = (buf) => { if (!burstMs) { setTimeout(() => { rx = Buffer.concat([rx, buf]); }, Math.ceil(buf.length * 10000 / baud)); } else pending.push(buf); };
  if (burstMs) timer = setInterval(() => { if (pending.length) { rx = Buffer.concat([rx, ...pending.splice(0)]); } }, burstMs);
  const reply = (cmd, data) => { const b = Buffer.from([0x80, 0xF0, 0x10, data.length + 1, cmd, ...data, 0]); b[b.length - 1] = SSM.checksum(b); return b; };
  const id = Buffer.from(ecuId, 'hex'), init = initBytes || Buffer.concat([Buffer.from([0xA2, 0x10, 0x11]), id, Buffer.alloc(40, 0xFF)]);
  function onRequest(req) {
    rx = Buffer.concat([rx, req]); // K-Line echo
    if (req[4] === 0xBF) { deliver(reply(0xFF, init)); return; }
    if (req[4] === 0xA8) {
      const addrs = []; for (let i = 6; i + 3 <= req.length - 1; i += 3) addrs.push((req[i] << 16) | (req[i + 1] << 8) | req[i + 2]);
      const pkt = () => { tick++; const r = reply(0xE8, addrs.map(a => memory(a, tick))); if (corruptEvery && tick % corruptEvery === 0) r[r.length - 1] ^= 0xff; return r; };
      if (stream) clearInterval(stream), stream = null;
      if (req[5] === 0x01) { const ms = Math.ceil((6 + addrs.length) * 10000 / baud); deliver(pkt()); stream = setInterval(() => { if (!brk) deliver(pkt()); }, ms); }
      else deliver(pkt());
    }
  }
  const port = {
    write(b) { sent += b.length; onRequest(Buffer.from(b)); },
    available() { return rx.length; },
    read(n) { const o = rx.subarray(0, n); rx = rx.subarray(n); return Buffer.from(o); },
    readAll() { const o = rx; rx = Buffer.alloc(0); return Buffer.from(o); },
    async setBreak(on) { brk = on; if (on && stream) { clearInterval(stream); stream = null; } },
    close() {},
  };
  return { open: async () => port, stop() { if (stream) clearInterval(stream); if (timer) clearInterval(timer); }, get ticks() { return tick; } };
}
module.exports = { mockEcu };
