'use strict';
// ejLogger engine end-to-end: fork engine.js as its own process, talk to it over IPC like the app does,
// log from the simulated ECU, record, and check the CSV is RomRaider's format.
// node test/engine.test.js [logger_METRIC_EN_v370.xml]   (no argument → a small built-in definition)
const fs = require('fs'), os = require('os'), path = require('path'), { fork } = require('child_process');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ejl-'));
let defPath = process.argv[2];
if (!defPath) {
  defPath = path.join(tmp, 'logger_test.xml');
  fs.writeFileSync(defPath, `<?xml version="1.0" encoding="UTF-8"?>
<logger version="test"><protocols><protocol id="SSM" baud="4800" databits="8" stopbits="1" parity="0" connect_timeout="2000" send_timeout="55">
<transports><transport id="iso9141" name="K-Line"><module id="ecu" address="0x10" desc="Engine Control Unit" tester="0xF0" fastpoll="true"/></transport></transports>
<parameters>
 <parameter id="P2" name="Coolant Temperature" desc="P2" ecubyteindex="8" ecubit="6"><address>0x000008</address><conversions><conversion units="C" expr="x-40" format="0" /><conversion units="F" expr="32+9*(x-40)/5" format="0" /></conversions></parameter>
 <parameter id="P8" name="Engine Speed" desc="P8" ecubyteindex="8" ecubit="0"><address length="2">0x00000E</address><conversions><conversion units="rpm" expr="x/4" format="0" /></conversions></parameter>
 <parameter id="P9" name="Vehicle Speed" desc="P9" ecubyteindex="9" ecubit="7"><address>0x000010</address><conversions><conversion units="km/h" expr="x" format="0" /></conversions></parameter>
 <parameter id="P17" name="Battery Voltage" desc="P17" ecubyteindex="10" ecubit="2"><address>0x00001C</address><conversions><conversion units="V" expr="x*8/100" format="0.00" /></conversions></parameter>
 <parameter id="P200" name="Test Derived" desc="P200"><depends><ref parameter="P8"/><ref parameter="P9"/></depends><conversions><conversion units="rpm/kmh" expr="[P8:rpm]/([P9:km/h]+1)" format="0.0" /></conversions></parameter>
</parameters></protocol></protocols></logger>`);
}
const eng = fork(path.join(__dirname, '..', 'engine.js'), [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
const seen = []; const wait = (pred, ms = 8000) => new Promise((res, rej) => { const t0 = Date.now(); const k = setInterval(() => { const m = seen.find(pred); if (m) { clearInterval(k); res(m); } else if (Date.now() - t0 > ms) { clearInterval(k); rej(new Error('timeout')); } }, 20); });
eng.on('message', m => { seen.push(m); if (m.t === 'error') console.log('  engine error:', m.text); });
const send = m => eng.send(m);
(async () => {
  try {
    await wait(m => m.t === 'status' && m.msg === 'Engine ready');
    send({ t: 'ports' }); const ports = await wait(m => m.t === 'ports'); ok(ports.list.some(p => p.path === 'MOCK'), 'port list includes the simulated ECU (' + ports.list.length + ' ports)');
    send({ t: 'config', cfg: { defPath, ecuPort: 'MOCK', logDir: tmp } });
    const pl = await wait(m => m.t === 'params'); ok(pl.list.length >= 4, 'definition loaded: ' + pl.list.length + ' parameters (incl. externals)');
    const want = ['P2', 'P8', 'P9', 'P17', 'P200'].filter(id => pl.list.some(p => p.id === id)).map(id => ({ id, units: pl.list.find(p => p.id === id).units[0] }));
    send({ t: 'select', list: want });
    const t0 = Date.now(); send({ t: 'connect' });
    await wait(m => m.t === 'status' && m.state === 'connecting'); ok(true, 'state → connecting');
    const ini = await wait(m => m.t === 'init'); ok(!!ini.ecuId, 'ECU init id ' + ini.ecuId + ' after ' + (Date.now() - t0) + ' ms (2 s quiet wait)');
    await wait(m => m.t === 'status' && m.state === 'settling'); ok(true, 'state → settling');
    await wait(m => m.t === 'status' && m.state === 'logging'); ok(true, 'state → logging');
    const fr = await wait(m => m.t === 'frame'); ok(Object.keys(fr.v).length === want.length, 'live frame carries ' + Object.keys(fr.v).length + ' values: ' + Object.values(fr.f).join(', '));
    send({ t: 'rec', on: true }); const r1 = await wait(m => m.t === 'rec' && m.on); ok(/ejlogger_\d{4}-\d\d-\d\d_\d{4}_[\w.-]+\.csv$/.test(r1.file), 'recording ' + path.basename(r1.file));
    await new Promise(r => setTimeout(r, 2500));
    const st = seen.filter(m => m.t === 'stats').pop(); ok(st && st.hz > 0, `true rate ${st.hz.toFixed(1)} Hz, theoretical 480/(6+${st.bytes}) = ${st.theo.toFixed(1)} Hz`);
    send({ t: 'rec', on: false }); await wait(m => m.t === 'rec' && !m.on);
    const out = fs.readFileSync(r1.file, 'latin1'), lines = out.split('\r\n').filter(Boolean);
    ok(lines[0] === 'Time (msec),Coolant Temperature (C),Engine Speed (rpm),Vehicle Speed (km/h),Battery Voltage (V),Test Derived (rpm/kmh)'.split(',').slice(0, want.length + 1).join(','), 'header: ' + lines[0]);
    ok(!/[^\r]\n/.test(out) && out.endsWith('\r\n'), 'CRLF line endings');
    ok(+lines[1].split(',')[0] === 0, 'first row Time = 0');
    ok(lines.slice(1).every(l => l.split(',').length === want.length + 1), (lines.length - 1) + ' rows, every row has every column');
    send({ t: 'disconnect' }); await wait(m => m.t === 'status' && m.state === 'idle'); ok(true, 'disconnect → idle');
  } catch (e) { ok(false, 'test aborted: ' + e.message); }
  send({ t: 'quit' }); setTimeout(() => process.exit(), 800);
})();
