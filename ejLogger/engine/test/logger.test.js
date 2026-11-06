'use strict';
// End-to-end: def → profile (Teddy's master columns) → QueryManager over a simulated K-Line ECU → RomRaider CSV.
const fs = require('fs'), os = require('os'), path = require('path');
const D = require('../src/defs'), SSM = require('../src/ssm'), C = require('../src/convert'), { QueryManager } = require('../src/logger'), { FileUpdateHandler } = require('../src/csv'), { mockEcu } = require('../src/mockecu');
const [defPath, logPath] = process.argv.slice(2);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

// 1. well-known SSM init packet
ok(SSM.ecuInitRequest({ address: [0x10], tester: [0xF0] }).toString('hex') === '8010f001bf40', 'ECU init request = 80 10 F0 01 BF 40');

(async () => {
  const ecu = mockEcu({ burstMs: 250 });
  // 2. init + supported list
  let init = null; const qm0 = new QueryManager({ openPort: ecu.open, getPort: () => 'COM5', props: null, module: null });
  const xml = fs.readFileSync(defPath, 'utf8'), pre = D.load(xml, { protocol: 'SSM' }), mod = pre.modules.find(m => m.transport === 'iso9141' && m.id === 'ecu');
  Object.assign(qm0.o, { props: pre.connection, module: mod, onInit: i => { init = i; } });
  const t0 = Date.now(); ok(await qm0.doEcuInit(), `ECU init (${Date.now() - t0} ms incl. RomRaider's 2 s quiet wait)`);
  ok(init && init.ecuId === '5104504007', 'ECU id parsed: ' + (init && init.ecuId));
  const def = D.load(xml, { protocol: 'SSM', ecuInit: init });
  ok(def.ecuparams.length === 58, `extended params for 5104504007: ${def.ecuparams.length} (v370 lists 58)`);

  // 3. Teddy's master profile columns (from his Oct 31 log header)
  const header = fs.readFileSync(logPath, 'latin1').split('\r\n')[0], cols = header.split(',').slice(1);
  const all = [...def.params, ...def.ecuparams, ...def.switches], items = [];
  let aem = null;
  for (const col of cols) {
    const m = col.match(/^(.*) \(([^()]*)\)$/), name = m[1], units = m[2];
    if (name.startsWith('AEM UEGO Wideband')) { const conv = { units, expr: 'x', format: '0.00' }; aem = { external: true, name, units: () => units, format: v => C.format(conv, v), latest: () => 14.9 }; items.push(aem); continue; }
    const p = all.find(x => x.name === name); if (!p) { ok(false, 'definition has no parameter ' + name); continue; }
    const conv = p.convs.find(c => c.units === units) || p.convs[0];
    items.push({ name: p.name, addrs: p.address.addrs, conv: () => conv, units: () => conv.units, format: v => C.format(conv, v) });
  }
  ok(items.length === cols.length, `profile resolved: ${items.length}/${cols.length} columns`);
  const nAddr = items.filter(i => !i.external).reduce((s, i) => s + i.addrs.length, 0);

  // 4. log for ~4 s with fast poll over a bursty (Bluetooth-like) link
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ejos-')), fh = new FileUpdateHandler({ dir });
  items.forEach(i => fh.registerData(i));
  const qm = new QueryManager({ openPort: ecu.open, getPort: () => 'COM5', props: def.connection, module: mod, fastPoll: () => true, onResponse: r => fh.handleDataUpdate(r), onError: e => console.log('logger error', e.message) });
  items.forEach(i => qm.addQuery('dash', i));
  qm.stopFlag = false; qm.runLogger(); await new Promise(r => setTimeout(r, 300)); fh.start(); await new Promise(r => setTimeout(r, 4000)); fh.stop(); qm.stop(); await new Promise(r => setTimeout(r, 300)); ecu.stop();
  const out = fs.readFileSync(fh.file, 'latin1'), lines = out.split('\r\n').filter(Boolean);
  ok(/^romraiderlog_\d{8}_\d{6}\.csv$/.test(path.basename(fh.file)), 'file name ' + path.basename(fh.file));
  ok(lines[0] === header, 'header identical to the real RomRaider log');
  ok(!/[^\r]\n/.test(out) && out.endsWith('\r\n'), 'CRLF line endings');
  const t = lines.slice(1).map(l => +l.split(',')[0]); ok(t[0] === 0, 'first row Time = 0');
  const dts = t.slice(1).map((x, i) => x - t[i]), burst = dts.filter(d => d <= 2).length, rate = (t.length - 1) / ((t[t.length - 1]) / 1000), theo = 480 / (6 + nAddr);
  ok(burst > dts.length * 0.5, `bursty arrival like the car (rows ≤2 ms apart: ${burst}/${dts.length})`);
  ok(Math.abs(rate - theo) / theo < 0.15, `rate ${rate.toFixed(1)} Hz vs K-Line limit 480/(6+${nAddr}) = ${theo.toFixed(1)} Hz`);
  ok(lines.slice(1).every(l => l.split(',').length === cols.length + 1), 'every row has every column');
  console.log('  sample row:', lines[2]);
})();
