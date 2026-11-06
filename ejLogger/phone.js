'use strict';
// ejLogger phone panel: a small web server inside ejStudio.
// Hub (/go), passcode keypad (/unlock), Tuner (/ = the real ejLogger in a phone layout) and the passenger Live view (/live).
// The Tuner talks to the same handlers as the desktop UI through /api/ejl/<name>; live data streams over /api/events.
// Port 80, falling back to 8787. Answers as ejlogger.local over mDNS. No passcode for this PC itself.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), dgram = require('dgram');

module.exports = function phonePanel(o) {
  // o = { H, root, cfg(), clusterDir(), zipLogs(names), zipConfig(), log(msg), version }
  const st = { srv: null, port: 0, clients: new Set(), mdns: null };
  const localIPs = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  // the passcode lives in network.properties; a new install gets its own random one (shown in Config → Phone panel)
  const passcode = () => { const f = path.join(o.clusterDir(), 'customize', 'network.properties'); let t = '';
    try { t = fs.readFileSync(f, 'utf8'); const m = t.match(/^\s*tuner\.passcode\s*=\s*(\d{4})\s*$/m); if (m) return m[1]; } catch (_) {}
    const pc = String(1000 + crypto.randomInt(9000)); try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, (t && !t.endsWith('\n') ? t + '\n' : t) + 'tuner.passcode = ' + pc + '\n'); o.onPass && o.onPass(); } catch (e) { o.log('passcode ' + e.message); } return pc; };
  const token = () => crypto.createHash('sha256').update('ejlogger-panel:' + passcode()).digest('hex').slice(0, 40);
  const remote = req => String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const isLocal = req => { const a = remote(req); return a === '127.0.0.1' || a === '::1' || localIPs().includes(a); };
  const cookie = req => { const m = String(req.headers.cookie || '').match(/(?:^|;\s*)ejt=([^;]+)/); return m ? m[1] : ''; };
  const authed = req => isLocal(req) || cookie(req) === token();
  const TYPES = { '.html': 'text/html; charset=utf-8', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.json': 'application/json' };
  const sendFile = (res, f, type) => { fs.readFile(f, (err, b) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type || TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(b); }); };
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const body = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch (_) { r({}); } }); });
  const icon = n => { const d = path.join(o.root, 'logos'); try { const f = fs.readdirSync(d).find(x => new RegExp('^ejlogger_' + n + '\\.png$').test(x)) || fs.readdirSync(d).find(x => /^ejlogger_512\.png$/.test(x)); return f && path.join(d, f); } catch (_) { return null; } };
  // what each side may call: the Tuner gets the full desktop API minus things that open dialogs on the car's screen
  const TUNER = new Set(['send', 'cfg', 'set', 'state', 'cluster', 'writeProp', 'logs', 'logsDo', 'usbSync', 'storageNow', 'saveProfile', 'profileOp', 'net', 'relaunch']);
  const PASSENGER = new Set(['cfg', 'state', 'cluster', 'net']);
  let lastStatus = { logging: false, profile: '', rec: false };

  async function handle(req, res) {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    try {
      if (p === '/go' || p === '/unlock') return sendFile(res, path.join(o.root, 'ejLogger', 'ui', 'panel.html'));
      if (p === '/' || p === '/app') { if (!authed(req)) { res.writeHead(302, { Location: '/go' }); return res.end(); }
        if (!u.searchParams.get('phone')) { res.writeHead(302, { Location: '/app?phone=1' }); return res.end(); } return sendFile(res, path.join(o.root, 'ejstudio.html')); }
      if (p === '/live') { if (!u.searchParams.get('phone')) { res.writeHead(302, { Location: '/live?phone=1&passenger=1' }); return res.end(); } return sendFile(res, path.join(o.root, 'ejstudio.html')); }
      if (p.startsWith('/ejLogger/ui/fonts/') || p.startsWith('/fonts/')) return sendFile(res, path.join(o.root, 'ejLogger', 'ui', 'fonts', path.basename(p)));
      if (p === '/manifest.webmanifest') return json(res, 200, { name: 'ejLogger', short_name: 'ejLogger', start_url: '/go', display: 'standalone', background_color: '#000000', theme_color: '#000000', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      if (p === '/icon-192.png' || p === '/icon-512.png') { const f = icon(p.includes('192') ? '256' : '512'); return f ? sendFile(res, f, 'image/png') : (res.writeHead(404), res.end()); }
      if (p === '/pub/status') return json(res, 200, lastStatus);
      if (p === '/api/gate' && req.method === 'POST') { const b = await body(req); if (String(b.code) === passcode()) { res.writeHead(200, { 'Set-Cookie': `ejt=${token()}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`, 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); } return json(res, 401, { ok: false }); }
      if (p === '/api/events') { // live stream; passengers and phones get values about 5 times a second
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write('retry: 2000\n\n');
        const c = { res, tuner: authed(req), last: 0 }; st.clients.add(c); req.on('close', () => st.clients.delete(c)); return; }
      if (p.startsWith('/api/ejl/') && req.method === 'POST') { const n = p.slice(9), ok = authed(req) ? TUNER.has(n) : PASSENGER.has(n);
        if (!ok) return json(res, 401, { error: 'locked' }); const b = await body(req), args = Array.isArray(b.args) ? b.args : [];
        if (n === 'send' && !authed(req)) return json(res, 401, { error: 'locked' });
        if (n === 'logsDo' && /^(export|graph)$/.test(args[0]) && !(args[2] && args[2].dest)) return json(res, 200, { r: { ok: false, error: 'Not available from a phone' } });
        if (n === 'logsDo' && args[0] === 'delete') args[2] = Object.assign({}, args[2], { confirmed: true });
        const fn = o.H['ejl:' + n]; if (!fn) return json(res, 404, { error: 'unknown' }); const r = await fn(null, ...args); return json(res, 200, { r }); }
      if (p === '/api/logszip') { if (!authed(req)) return json(res, 401, {}); let names = []; try { names = JSON.parse(u.searchParams.get('names') || '[]'); } catch (_) {}
        const b = o.zipLogs(names); res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="ejlogger_logs_${new Date().toISOString().slice(0, 10)}.zip"` }); return res.end(b); }
      if (p === '/api/backupzip') { if (!authed(req)) return json(res, 401, {}); const b = o.zipConfig(); res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="ejlogger_config_${new Date().toISOString().slice(0, 10)}.zip"` }); return res.end(b); }
      res.writeHead(404); res.end();
    } catch (e) { o.log('phone ' + p + ' ' + (e && e.stack || e)); if (!res.headersSent) json(res, 500, { error: 'server error' }); else res.end(); }
  }
  function broadcast(m) {
    if (!m) return;
    if (m.t === 'status') lastStatus.logging = m.state === 'logging'; if (m.t === 'rec') lastStatus.rec = !!m.on; if (m.t === 'cfg' && m.cfg) lastStatus.profile = m.cfg.profile || '';
    if (!st.clients.size) return; const now = Date.now();
    for (const c of st.clients) { if (m.t === 'frame') { if (now - c.last < 200) continue; c.last = now; } if (!c.tuner && /^(usb|usbProgress|cfg|error|log|msg)$/.test(m.t)) continue;
      try { c.res.write('data: ' + JSON.stringify(m) + '\n\n'); } catch (_) {} }
  }
  // minimal mDNS responder: answers A queries for ejlogger.local with this PC's addresses
  function mdns() { if (st.mdns) return; const NAME = 'ejlogger.local';
    try { const s = dgram.createSocket({ type: 'udp4', reuseAddr: true }); st.mdns = s;
      s.on('error', e => { o.log('mdns ' + e.message); try { s.close(); } catch (_) {} st.mdns = null; });
      s.on('message', (msg, rinfo) => { try { if (msg.length < 12 || (msg[2] & 0x80)) return; const qd = msg.readUInt16BE(4); let off = 12;
        for (let q = 0; q < qd; q++) { const labels = []; while (msg[off]) { labels.push(msg.slice(off + 1, off + 1 + msg[off]).toString()); off += msg[off] + 1; } off++; const type = msg.readUInt16BE(off); off += 4;
          if (labels.join('.').toLowerCase() === NAME && (type === 1 || type === 255)) { const ips = localIPs(); if (!ips.length) return;
            const nameB = Buffer.concat([...NAME.split('.').map(l => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)])), Buffer.from([0])]);
            const head = Buffer.alloc(12); head.writeUInt16BE(0x8400, 2); head.writeUInt16BE(ips.length, 6);
            const ans = ips.map(ip => { const r = Buffer.alloc(10); r.writeUInt16BE(1, 0); r.writeUInt16BE(0x8001, 2); r.writeUInt32BE(120, 4); r.writeUInt16BE(4, 8); return Buffer.concat([nameB, r, Buffer.from(ip.split('.').map(Number))]); });
            s.send(Buffer.concat([head, ...ans]), 5353, '224.0.0.251'); } } } catch (_) {} });
      s.bind(5353, () => { try { s.addMembership('224.0.0.251'); s.setMulticastTTL(255); } catch (e) { o.log('mdns join ' + e.message); } });
    } catch (e) { o.log('mdns ' + e.message); } }
  function stop() { if (st.srv) { try { st.srv.close(); } catch (_) {} st.srv = null; st.port = 0; } for (const c of st.clients) try { c.res.end(); } catch (_) {} st.clients.clear(); if (st.mdns) { try { st.mdns.close(); } catch (_) {} st.mdns = null; } }
  function start() { if (st.srv) return; passcode(); const tryPort = (ports) => { if (!ports.length) { o.log('phone panel: no free port'); return; }
      const srv = http.createServer(handle); srv.once('error', () => tryPort(ports.slice(1)));
      srv.listen(ports[0], '0.0.0.0', () => { st.srv = srv; st.port = ports[0]; o.log('phone panel on port ' + ports[0]); mdns(); o.onState && o.onState(); }); };
    tryPort([80, 8787]); }
  return { start, stop, broadcast, state: st, localIPs };
};
