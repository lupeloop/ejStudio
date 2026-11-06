'use strict';
// ejLogger engine — runs as its own background process (Electron utilityProcess, or child_process.fork in tests).
// Owns the serial ports, the RomRaider polling loop and the CSV writer. The UI only draws what this sends.
//
// In  (UI → engine): {t:'config', cfg}  {t:'ports'}  {t:'connect'}  {t:'disconnect'}  {t:'select', list:[{id,units}]}
//                    {t:'rec', on}  {t:'params'}  {t:'quit'}
// Out (engine → UI): {t:'ports', list}  {t:'status', state, msg}  {t:'init', ecuId, romId}  {t:'params', list, verified}
//                    {t:'frame', ts, v:{key:number}, f:{key:text}}  {t:'stats', hz, theo, bytes}  {t:'rec', on, file}
//                    {t:'wb', ok, state, port, type}  {t:'log', text}  {t:'error', text}
const fs = require('fs'), path = require('path');
const D = require('./src/defs'), C = require('./src/convert'), SSM = require('./src/ssm');
const { QueryManager } = require('./src/logger'), { FileUpdateHandler } = require('./src/csv');
const SER = require('./src/serial'), WB = require('./src/wideband'), { mockEcu } = require('./src/mockecu');

const PP = process.parentPort || null;
const post = m => { try { PP ? PP.postMessage(m) : process.send && process.send(m); } catch (_) {} };
const onMsg = cb => PP ? PP.on('message', e => cb(e.data)) : process.on('message', cb);
const log = text => post({ t: 'log', text: String(text) });
process.on('uncaughtException', e => post({ t: 'error', text: 'engine: ' + (e && e.stack || e) }));
process.on('unhandledRejection', e => post({ t: 'error', text: 'engine: ' + (e && e.stack || e) }));

const MOCK = 'MOCK';
let cfg = { appVersion: '', profile: '', defPath: '', ecuPort: '', wbType: 'none', wbPort: '', wbUnits: 'AFR Gasoline', logDir: '', fastPoll: true, logfileNameText: '', locale: 'en_CA' };
let xml = null, def = null, mod = null, init = null, qm = null, fh = null, wb = null, mock = null, state = 'idle';
let sel = []; // [{id, units}] in registration (CSV column) order
const items = new Map(); // 'id|units' → item (identity kept so the CSV handler and query map stay consistent)
let frames = [], firstFrame = false, lastStats = 0;

function setState(s, msg) { state = s; post({ t: 'status', state: s, msg: msg || '' }); }

// ── definition ─────────────────────────────────────────────────────────────
function loadDef() {
  xml = null; def = null; mod = null;
  if (!cfg.defPath) { post({ t: 'error', text: 'No logger definition chosen (logger_METRIC_EN_v370.xml).' }); return false; }
  try { xml = fs.readFileSync(cfg.defPath, 'utf8'); } catch (e) { post({ t: 'error', text: 'Cannot read logger definition: ' + e.message }); return false; }
  try { def = D.load(xml, { protocol: 'SSM', ecuInit: init }); }
  catch (e) { post({ t: 'error', text: 'Logger definition: ' + e.message }); xml = null; return false; }
  mod = def.modules.find(m => m.transport === 'iso9141' && m.id === 'ecu') || def.modules.find(m => m.id === 'ecu');
  return true;
}
const allParams = () => def ? [...def.params, ...def.ecuparams, ...def.switches] : [];
function sendParams() {
  const list = allParams().map(p => ({ id: p.id, name: p.name, desc: p.desc || '', kind: p.kind, group: p.group || '',
    units: p.convs.map(c => c.units), bytes: p.kind === 'derived' ? derivedAddrs(p).length : p.address.addrs.length }));
  for (const [type, S] of Object.entries(WB.SENSORS)) list.push({ id: 'wb:' + type, name: S.name, desc: S.label + ' (external)', kind: 'external', units: S.convs.map(c => c.units), bytes: 0, wb: type });
  post({ t: 'params', list, verified: !!(def && def.verified), ecuId: init ? init.ecuId : null, version: def ? def.version : null });
}

// ── items: one per selected parameter + units ─────────────────────────────
function derivedAddrs(p) { const out = []; for (const id of p.depends) { const d = def.byId[id]; if (d && d.address) out.push(...d.address.addrs); } return out; }
function bindItem(it, p, units) {
  const conv = p.convs.find(c => c.units === units) || p.convs[0];
  it.name = p.name; it.p = p; it.cv = p.kind === 'switch' ? Object.assign({}, conv, { bit: p.address.bit }) : conv;
  it.units = () => it.cv.units; it.conv = () => it.cv; it.format = v => C.format(it.cv, v);
  if (p.kind === 'derived') {
    const deps = p.depends.map(id => def.byId[id]);
    it.addrs = derivedAddrs(p); it.decode = bytes => {
      const vals = {}; let i = 0;
      for (const d of deps) { const n = d.address.addrs.length; vals[d.id] = { d, b: bytes.subarray(i, i + n) }; i += n; }
      const refs = (id, u) => { const r = vals[id]; if (!r) return undefined; const c = (u && r.d.convs.find(c => c.units === u)) || r.d.convs[0]; return C.convertBytes(c, r.b); };
      const v = C.evaluate(it.cv.expr, 0, refs); return Number.isFinite(v) ? v : 0;
    };
  } else { it.addrs = p.address.addrs; it.decode = null; }
  return it;
}
function itemFor(s) {
  const key = s.id + '|' + (s.units || '');
  if (String(s.id).startsWith('wb:')) { if (!wb || 'wb:' + wb.type !== s.id) return null; return wb.item; }
  const p = def && def.byId[s.id]; if (!p) return null;
  let it = items.get(key); if (!it) { it = { key, id: s.id }; items.set(key, it); }
  return bindItem(it, p, s.units);
}
function current() { return sel.map(itemFor).filter(Boolean); }

// apply the selection to the logger and the CSV handler (diffing so registration order holds)
let applied = [];
function applySelection() {
  const want = current();
  for (const it of applied) if (!want.includes(it)) { qm && qm.removeQuery('ejl', it); fh && fh.deregisterData(it); }
  for (const it of want) if (!applied.includes(it)) { qm && qm.addQuery('ejl', it); fh && fh.registerData(it); }
  applied = want; stats(true);
}
function resetLogger() { // after (re)init: same objects, rebound to the verified definition
  if (qm) { qm.queryMap.clear(); qm.addList.clear(); qm.removeList = []; }
  const want = current();
  if (fh && !fh.isStarted()) { fh = newFileHandler(); want.forEach(it => fh.registerData(it)); }
  else if (fh) { for (const it of applied) if (!want.includes(it)) fh.deregisterData(it); for (const it of want) if (!applied.includes(it)) fh.registerData(it); fh.notifyConvertorUpdate(); }
  if (qm) want.forEach(it => qm.addQuery('ejl', it));
  applied = want; stats(true);
}
// ejLogger log names: ejlogger_YYYY-MM-DD_HHmm_<profile>.csv (+ _2… if that minute is taken; _split when a profile switch cuts one)
const pad = n => String(n).padStart(2, '0');
const safe = s => String(s || 'log').replace(/[^\w.-]+/g, '_').slice(0, 40);
function logName(now, dirSlash) { const d = new Date(now), base = `ejlogger_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}_${safe(cfg.profile)}`;
  let p = dirSlash + base + '.csv', k = 2; while (fs.existsSync(p)) p = dirSlash + base + '_' + (k++) + '.csv'; return p; }
// metadata beside each log, in a hidden .meta folder: written at start, completed at stop
const metaPath = f => path.join(path.dirname(f), '.meta', path.basename(f).replace(/\.csv$/i, '.json'));
let meta = null, metaFull = null, recRows = 0;
function writeMeta() { if (!meta || !metaFull) return; try { const m = metaPath(metaFull); fs.mkdirSync(path.dirname(m), { recursive: true });
  if (process.platform === 'win32' && !fs.existsSync(m)) { try { require('child_process').execFile('attrib', ['+h', path.dirname(m)], () => {}); } catch (_) {} }
  fs.writeFileSync(m + '.tmp', JSON.stringify(meta, null, 1)); fs.renameSync(m + '.tmp', m); } catch (e) { post({ t: 'error', text: 'Log metadata: ' + e.message }); } }
function newFileHandler() {
  const h = new FileUpdateHandler({ dir: cfg.logDir, logfileNameText: cfg.logfileNameText, locale: cfg.locale });
  h.makeName = (now, dirSlash) => logName(now, dirSlash);
  h.listeners.push((on, file) => {
    if (on) { recRows = 0; meta = { file: path.basename(file), profile: cfg.profile || '', ecuId: init ? init.ecuId : null, ejLogger: cfg.appVersion || '', definition: cfg.defPath ? path.basename(cfg.defPath) : '',
      ecuPort: cfg.ecuPort, wideband: cfg.wbType !== 'none' ? cfg.wbType : null, columns: ['Time (msec)'].concat(applied.map(i => i.name + ' (' + i.units() + ')')), started: new Date().toISOString(), stopped: null, stopReason: null, rows: 0, rateHz: null, theoreticalHz: null };
      metaFull = file; writeMeta(); }
    else if (meta) { meta.stopped = new Date().toISOString(); meta.stopReason = meta.stopReason || stopWhy || 'stopped'; meta.rows = recRows; const dur = (Date.parse(meta.stopped) - Date.parse(meta.started)) / 1000; meta.rateHz = dur > 0 ? +(recRows / dur).toFixed(2) : null;
      const ecu = applied.filter(i => !i.external), uniq = SSM.filterDuplicates(ecu.map(i => ({ addrs: i.addrs }))), bytes = uniq.reduce((s, q) => s + q.addrs.length, 0); meta.theoreticalHz = bytes ? +(480 / (6 + bytes)).toFixed(2) : null;
      writeMeta(); meta = null; metaFull = null; }
    post({ t: 'rec', on, file }); });
  return h;
}
let stopWhy = null;
// a log whose metadata never got a stop time was cut by a power loss or crash
function markOrphans() { try { const md = path.join(cfg.logDir, '.meta'); for (const f of fs.readdirSync(md)) { if (!/\.json$/i.test(f)) continue; const p = path.join(md, f), j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.stopped) { let mt = null; try { mt = fs.statSync(path.join(cfg.logDir, j.file)).mtime.toISOString(); } catch (_) {} j.stopped = mt; j.stopReason = 'power cut or crash'; fs.writeFileSync(p + '.tmp', JSON.stringify(j, null, 1)); fs.renameSync(p + '.tmp', p); } } } catch (_) {} }
function stats(force) {
  const now = Date.now(); if (!force && now - lastStats < 500) return; lastStats = now;
  const ecu = applied.filter(i => !i.external), uniq = SSM.filterDuplicates(ecu.map(i => ({ addrs: i.addrs }))), bytes = uniq.reduce((s, q) => s + q.addrs.length, 0);
  frames = frames.filter(t => now - t <= 2000);
  const hz = frames.length > 1 ? (frames.length - 1) / ((frames[frames.length - 1] - frames[0]) / 1000) : 0;
  post({ t: 'stats', hz: Number.isFinite(hz) ? hz : 0, theo: bytes ? 480 / (6 + bytes) : 0, bytes, n: applied.length });
}

// ── connection ─────────────────────────────────────────────────────────────
async function openPort(name, props) {
  if (name === MOCK) { if (!mock) mock = mockEcu({ burstMs: 0 }); return mock.open(); }
  return SER.openPort(name, props);
}
async function connect() {
  if (qm && qm.isRunning()) return;
  if (!cfg.ecuPort) { post({ t: 'error', text: 'Choose the ECU port first (☰ → Connection).' }); return; }
  init = null; if (!loadDef()) return;
  if (!cfg.logDir) cfg.logDir = path.join(require('os').homedir(), 'Documents', 'ejStudio', 'logs');
  fh = newFileHandler(); firstFrame = false; frames = [];
  startWb();
  setState('connecting', 'Sending ECU Init to ' + cfg.ecuPort + '…');
  qm = new QueryManager({
    openPort, getPort: () => cfg.ecuPort, props: def.connection, module: mod, fastPoll: () => cfg.fastPoll !== false,
    onInit: i => { init = i; loadDef(); resetLogger(); sendParams(); post({ t: 'init', ecuId: i.ecuId }); firstFrame = false; setState('settling', 'ECU ' + i.ecuId); },
    onStatus: s => { if (s === 'connecting' && state !== 'connecting') setState('connecting', 'Sending ECU Init to ' + cfg.ecuPort + '…'); },
    onResponse: r => onFrame(r), onMessage: m => post({ t: 'msg', text: m }), onLog: log, onError: e => post({ t: 'error', text: 'logger: ' + (e && e.message || e) }),
  });
  qm.run().then(() => { if (mock) { mock.stop(); mock = null; } setState('idle', 'Disconnected'); });
}
function onFrame(r) {
  if (!firstFrame) { firstFrame = true; setState('logging', 'ECU ' + (init ? init.ecuId : '')); }
  if (fh && fh.isStarted()) recRows++;
  try { fh && fh.handleDataUpdate(r); } catch (e) { post({ t: 'error', text: 'CSV: ' + e.message }); stopRec(); }
  const v = {}, f = {};
  for (const [it, val] of r.values) { v[it.key] = val; try { f[it.key] = it.format(val); } catch (_) { f[it.key] = String(val); } }
  frames.push(r.timestamp); post({ t: 'frame', ts: r.timestamp, v, f }); stats(false);
}
function disconnect() { stopRec('disconnected'); if (qm) qm.stop(); stopWb(); }
function startWb() {
  stopWb(); if (!cfg.wbType || cfg.wbType === 'none' || !cfg.wbPort) { post({ t: 'wb', state: 'off' }); return; }
  wb = new WB.Wideband(cfg.wbType, cfg.wbPort, cfg.wbUnits, { openRaw: SER.openRaw, onState: s => post(Object.assign({ t: 'wb' }, s)) });
  wb.start(); applySelection();
}
function stopWb() { if (wb) { const it = wb.item; wb.stop(); wb = null; if (applied.includes(it)) applySelection(); } }

// ── recording ──────────────────────────────────────────────────────────────
function startRec() {
  if (!fh || state !== 'logging') { post({ t: 'error', text: 'Connect first, then record.' }); return; }
  try { fs.mkdirSync(cfg.logDir, { recursive: true }); fh.dir = cfg.logDir; fh.nameText = cfg.logfileNameText || ''; fh.start(); }
  catch (e) { post({ t: 'error', text: 'Cannot start the log file: ' + e.message }); }
}
function stopRec(why) { stopWhy = why || null; if (fh && fh.isStarted()) { try { fh.stop(); } catch (e) { post({ t: 'error', text: 'Closing the log: ' + e.message }); } } }

// ── messages ───────────────────────────────────────────────────────────────
onMsg(async m => {
  if (!m || !m.t) return;
  try {
    switch (m.t) {
      case 'config': {
        const old = cfg; cfg = Object.assign({}, cfg, m.cfg || {}); if (cfg.logDir && cfg.logDir !== old.logDir) markOrphans();
        if (cfg.defPath !== old.defPath || !def) { init = qm && qm.isRunning() ? init : null; if (loadDef()) { if (qm && qm.isRunning()) resetLogger(); sendParams(); } }
        if (qm && qm.isRunning() && (cfg.wbType !== old.wbType || cfg.wbPort !== old.wbPort || cfg.wbUnits !== old.wbUnits)) startWb();
        if (fh && !fh.isStarted()) fh.dir = cfg.logDir;
        break; }
      case 'ports': {
        let list = []; try { list = await SER.listPorts(); } catch (e) { post({ t: 'error', text: 'Port scan: ' + e.message }); }
        if (m.mock !== false) list.push({ path: MOCK, name: 'Simulated ECU (testing)' });
        post({ t: 'ports', list, serial: SER.available() }); break; }
      case 'params': if (!def) loadDef(); if (def) sendParams(); break;
      case 'select': sel = (m.list || []).filter(s => s && s.id); applySelection(); break;
      case 'connect': await connect(); break;
      case 'disconnect': disconnect(); break;
      case 'rec': m.on ? startRec() : stopRec(m.why || 'stopped by hand'); break;
      case 'split': if (fh && fh.isStarted()) { const old = fh.file; stopRec('profile switch'); try { const nf = old.replace(/\.csv$/i, '_split.csv'); fs.renameSync(old, nf); const om = metaPath(old); if (fs.existsSync(om)) { const j = JSON.parse(fs.readFileSync(om, 'utf8')); j.file = path.basename(nf); fs.writeFileSync(metaPath(nf), JSON.stringify(j, null, 1)); fs.unlinkSync(om); } } catch (e) { post({ t: 'error', text: 'Split rename: ' + e.message }); } startRec(); } break;
      case 'state': post({ t: 'status', state, msg: '' }); post({ t: 'rec', on: !!(fh && fh.isStarted()), file: fh && fh.file }); stats(true); break;
      case 'quit': disconnect(); setTimeout(() => process.exit(0), 400); break;
    }
  } catch (e) { post({ t: 'error', text: m.t + ': ' + (e && e.message || e) }); }
});
post({ t: 'status', state: 'idle', msg: 'Engine ready' });
