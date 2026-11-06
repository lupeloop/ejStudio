'use strict';
// ejLogger core: the RomRaider 1.1.0 logging loop, ported 1:1
// (QueryManagerImpl, TransmissionManagerImpl, SSMLoggerConnection, SerialConnectionManager, SerialConnectionImpl, PollingStateImpl).
// Transport-agnostic: give it openPort(name, props) → {write(buf), available(), read(n), readAll(), setBreak(on), close()}.
// Real use: serialport (see serial.js). Tests: the simulated ECU in test/mockecu.js.
const SSM = require('./ssm'), C = require('./convert');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// SerialConnectionManager
class ConnectionManager {
  constructor(port, props) { this.port = port; this.props = props; this.timeout = props.connectTimeout; this.readTimeout = this.timeout; this.last = null; }
  async readStaleData() { if (this.port.available() <= 0) return; const end = Date.now() + 100; do { this.port.readAll(); await sleep(2); } while (this.port.available() > 0 && Date.now() <= end); }
  // send(request, responseSize, pollState) → Buffer (response) — STATE_1 packets checked, last good one reused on corruption
  async sendPoll(request, size, ps) {
    if (ps.current === 0 && ps.last === 1) await this.clearLine();
    if (ps.current === 0) { await this.readStaleData(); this.port.write(request); }
    const response = Buffer.alloc(size);
    while (this.port.available() < size) { await sleep(1); this.readTimeout -= 1; if (this.readTimeout <= 0) { this.port.readAll(); return response; } } // bad read → zeros → invalid → reconnect
    this.readTimeout = this.timeout; this.port.read(size).copy(response);
    if (ps.current === 1) {
      if (SSM.streamPacketOk(response)) this.last = Buffer.from(response);
      else { this.onBadData && this.onBadData(response); if (this.last) this.last.copy(response); ps.newQuery = true; }
    }
    return response;
  }
  // send(bytes): write, then collect until no new byte for connectTimeout ms
  async sendOnce(bytes) {
    await this.readStaleData(); this.port.write(bytes);
    let avail = 0, lastChange = Date.now(); for (;;) { await sleep(2); const a = this.port.available(); if (a !== avail) { avail = a; lastChange = Date.now(); } if (Date.now() - lastChange >= this.timeout) break; }
    return this.port.readAll();
  }
  async clearLine() { // line break of (10000/baud)*(data+stop+parity+1) ms, then drain
    const ms = Math.floor(10000 / this.props.baud) * (this.props.dataBits + this.props.stopBits + this.props.parity + 1);
    await this.port.setBreak(true); await sleep(ms); await this.port.setBreak(false);
    do { await sleep(2); this.port.readAll(); await sleep(10); } while (this.port.available() > 0);
  }
  close() { this.port.close(); }
}

// QueryManagerImpl
class QueryManager {
  // o: {openPort, getPort:()=>name, props, module, fastPoll:()=>bool, onInit(ecuInit), onResponse(resp), onStatus(s), onMessage(m), onError(e), onStats(s)}
  constructor(o) { this.o = o; this.queryMap = new Map(); this.addList = new Map(); this.removeList = []; this.ps = { current: 0, last: 0, newQuery: true, lastQuery: false, fastPoll: false }; this.stopFlag = true; this.counter = 1; this.start = Date.now(); }
  addQuery(callerId, item) { this.counter = 1; this.start = Date.now(); const id = callerId + '_' + item.name; this.addList.set(id, item); if (!item.external) { this.ps.lastQuery = false; this.ps.newQuery = true; } }
  removeQuery(callerId, item) { this.counter = 1; this.start = Date.now(); this.removeList.push(callerId + '_' + item.name); if (!item.external) this.ps.newQuery = true; }
  updateQueryList() { for (const [k, v] of this.addList) this.queryMap.set(k, v); this.addList.clear(); for (const k of this.removeList) this.queryMap.delete(k); this.removeList = []; }
  stop() { this.stopFlag = true; }
  isRunning() { return this.started && !this.stopFlag; }
  async run() {
    this.started = true; this.stopFlag = false; const o = this.o;
    try {
      while (!this.stopFlag) {
        o.onStatus && o.onStatus('connecting');
        if (await this.doEcuInit()) { o.onStatus && o.onStatus('reading'); await this.runLogger(); }
        else await sleep(1000);
      }
    } catch (e) { o.onError && o.onError(e); }
    finally { o.onStatus && o.onStatus('stopped'); o.onMessage && o.onMessage('Disconnected'); }
  }
  async doEcuInit() { // J2534 branch dropped (no OpenPort); serial port only
    const o = this.o, name = o.getPort(); let cm = null;
    try {
      o.onMessage && o.onMessage(`Sending ${o.module.id.toUpperCase()} Init to ${name}…`);
      cm = new ConnectionManager(await o.openPort(name, o.props), o.props);
      const req = SSM.ecuInitRequest(o.module), resp = await cm.sendOnce(req);
      const init = SSM.parseEcuInit(o.module, SSM.stripEcho(req, resp, 0));
      o.onInit && o.onInit(init); o.onMessage && o.onMessage(`${o.module.id.toUpperCase()} Init on ${name} done`); return true;
    } catch (e) { o.onMessage && o.onMessage(`${o.module.id.toUpperCase()} Init failed`); o.onLog && o.onLog('Error sending init: ' + e.message); return false; }
    finally { if (cm) cm.close(); }
  }
  async runLogger() {
    const o = this.o, ps = this.ps; let cm = null; this.start = Date.now(); this.counter = 1;
    try {
      cm = new ConnectionManager(await o.openPort(o.getPort(), o.props), o.props); cm.onBadData = r => o.onLog && o.onLog('Serial Bad Data response: ' + r.toString('hex'));
      let lastPollState = o.fastPoll();
      while (!this.stopFlag) {
        ps.fastPoll = o.fastPoll(); this.updateQueryList();
        if (this.queryMap.size === 0) {
          if (ps.lastQuery && ps.current === 0) { await cm.clearLine(); ps.lastQuery = false; ps.last = 0; }
          o.onMessage && o.onMessage('Select parameters to be logged…'); await sleep(100); continue;
        }
        const end = Date.now() + 1;
        const ecu = [...this.queryMap.values()].filter(q => !q.external);
        if (ecu.length) {
          if (o.switchQuery && o.switchActive && o.switchActive()) ecu.push(o.switchQuery);
          const req = SSM.readAddressRequest(o.module, ecu, ps.fastPoll), size = SSM.readAddressResponseSize(ecu, ps.current);
          const resp = await cm.sendPoll(req, size, ps);
          const raw = SSM.splitResponse(o.module, ecu, SSM.stripEcho(req, resp, ps.current));
          ecu.forEach((q, i) => { q.response = q.decode ? q.decode(raw[i]) : C.convertBytes(q.conv(), raw[i]); }); // decode: derived parameters (ejLogger)
          if (!ps.fastPoll && lastPollState) { await cm.clearLine(); ps.lastQuery = false; }
          if (ps.fastPoll) {
            if (ps.current === 0 && ps.newQuery) { ps.current = 1; ps.newQuery = false; }
            if (ps.current === 0 && !ps.newQuery) ps.current = 1;
            if (ps.current === 1 && ps.newQuery) { ps.current = 0; ps.last = 1; ps.newQuery = false; }
            if (ps.current === 1 && !ps.newQuery) ps.last = 1;
            ps.lastQuery = true;
          } else { ps.current = 0; ps.last = 0; ps.newQuery = false; }
          lastPollState = ps.fastPoll;
        } else if (ps.lastQuery && ps.last === 1) { await cm.clearLine(); ps.lastQuery = false; ps.last = 0; ps.current = 0; ps.newQuery = true; }
        for (const q of this.queryMap.values()) if (q.external) q.response = q.latest(); // external plugin: latest value
        while (Date.now() < end) await sleep(1);
        if (o.switchQuery && o.switchActive && o.switchActive() && o.onSwitch) o.onSwitch(o.switchQuery.response);
        const values = new Map(); for (const q of this.queryMap.values()) values.set(q, q.response);
        o.onResponse && o.onResponse({ timestamp: Date.now(), values });
        this.counter++; o.onStats && o.onStats({ fast: ps.fastPoll, perSec: this.counter / ((Date.now() - this.start) / 1000) });
      }
    } catch (e) { o.onError && o.onError(e); await sleep(500); }
    finally { if (cm) { try { await cm.clearLine(); } catch (_) {} cm.close(); } ps.current = 0; ps.newQuery = true; }
  }
}
module.exports = { QueryManager, ConnectionManager };
