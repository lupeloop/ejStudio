'use strict';
// ejLogger: real serial ports for the logger core (serialport 13).
// openPort(name, props) returns the transport logger.js expects:
// {write(buf), available(), read(n), readAll(), setBreak(on), close()}, fed by serialport's data events.
let SP = null; try { SP = require('serialport'); } catch (_) { SP = null; }
const PARITY = ['none', 'odd', 'even', 'mark', 'space']; // RomRaider: 0 = NONE

async function listPorts() {
  if (!SP) return [];
  const l = await SP.SerialPort.list();
  return l.map(p => ({ path: p.path, name: p.friendlyName || [p.manufacturer, p.serialNumber].filter(Boolean).join(' ') || '', vid: p.vendorId || '', pid: p.productId || '' }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

function openRaw(name, o) {
  if (!SP) return Promise.reject(new Error('serialport module not available'));
  return new Promise((res, rej) => {
    const sp = new SP.SerialPort({ path: name, baudRate: o.baud, dataBits: o.dataBits || 8, stopBits: o.stopBits || 1, parity: PARITY[o.parity | 0] || 'none', autoOpen: false, rtscts: false });
    sp.open(err => err ? rej(err) : res(sp));
  });
}

async function openPort(name, props) {
  const sp = await openRaw(name, props);
  let chunks = [], n = 0, closed = false;
  sp.on('data', d => { chunks.push(d); n += d.length; });
  sp.on('close', () => { closed = true; });
  sp.on('error', () => {});
  const take = k => { const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, n); const out = Buffer.from(all.subarray(0, k)), rest = all.subarray(k); chunks = rest.length ? [rest] : []; n = rest.length; return out; };
  return {
    write(b) { if (closed) throw new Error('Port ' + name + ' closed'); sp.write(Buffer.from(b)); },
    available() { if (closed) throw new Error('Port ' + name + ' closed'); return n; },
    read(k) { return take(k); },
    readAll() { return take(n); },
    setBreak(on) { return new Promise(r => { if (closed) return r(); sp.set({ brk: !!on }, () => r()); }); },
    close() { closed = true; try { if (sp.isOpen) sp.close(); } catch (_) {} },
  };
}

module.exports = { listPorts, openPort, openRaw, available: () => !!SP };
