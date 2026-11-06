'use strict';
// ejLogger core: RomRaider 1.1.0 CSV file logging, ported 1:1
// (logger/ecu/ui/handler/file/FileLoggerImpl + FileUpdateHandlerImpl).
const fs = require('fs'), path = require('path');
const NEW_LINE = '\r\n'; // System line.separator on Windows
const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const clock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
// Delimiter: ',' except the locales RomRaider lists (then ';'). Teddy (en_CA) → ','.
const SEMI = new Set('be_BY bg_BG ca_ES cs_CZ da_DK de_AT de_CH de_DE de_LU el_CY el_GR es_AR es_BO es_CL es_CO es_EC es_ES es_PE es_PY es_UY es_VE et_EE fi_FI fr_BE fr_CA fr_CH fr_FR fr_LU hr_HR hu_HU in_ID is_IS it_CH it_IT lt_LT lv_LV mk_MK nl_BE nl_NL no_NO no_NO_NY pl_PL pt_BR pt_PT ro_RO ru_RU sk_SK sl_SI sq_AL sr_BA sr_CS sr_ME sr_RS sv_SE tr_TR uk_UA vi_VN'.split(' '));

// Port of FileUpdateHandlerImpl: registered data (in registration order, with use counts) → lines.
// item = { key, name, units() , format(value) }  (units/format come from the item's selected convertor)
class FileUpdateHandler {
  constructor(opt = {}) {
    this.dir = opt.dir; this.nameText = opt.logfileNameText || ''; this.absolute = !!opt.absoluteTimestamp;
    this.delim = SEMI.has(opt.locale || 'en_CA') ? ';' : ',';
    this.encoding = opt.encoding || 'latin1'; // Cp1252 on Windows; logs are ASCII in practice
    this.datas = new Map(); this.line = new Map(); this.fd = null; this.file = null; this.startTs = 0; this.listeners = [];
  }
  registerData(item) { const n = this.datas.get(item); if (n) this.datas.set(item, n + 1); else { this.datas.set(item, 1); this.resetLine(); this.writeHeaders(); } }
  deregisterData(item) { const n = this.datas.get(item); if (n && n > 1) this.datas.set(item, n - 1); else { this.datas.delete(item); this.resetLine(); this.writeHeaders(); } }
  notifyConvertorUpdate() { this.resetLine(); this.writeHeaders(); }
  resetLine() { this.line = new Map(); for (const d of this.datas.keys()) this.line.set(d, null); }
  isStarted() { return this.fd !== null; }
  start(now = new Date()) {
    if (this.isStarted()) return;
    let p = this.dir; if (!p.endsWith(path.sep)) p += path.sep; p += 'romraiderlog_' + (this.nameText ? this.nameText + '_' : '') + stamp(now) + '.csv';
    this.fd = fs.openSync(p, 'w'); this.file = p; this.startTs = 0; this.buf = [];
    this.listeners.forEach(l => l(true, p)); this.writeHeaders();
  }
  stop() { if (!this.isStarted()) return; this.flush(); fs.closeSync(this.fd); this.fd = null; const f = this.file; this.listeners.forEach(l => l(false, f)); }
  cleanUp() { this.stop(); }
  headers() { let s = ''; for (const d of this.line.keys()) s += this.delim + d.name + ' (' + d.units() + ')'; return s; }
  writeHeaders() { if (this.isStarted()) this.writeText((this.absolute ? 'Time' : 'Time (msec)') + this.headers()); }
  // response = {timestamp(ms), values: Map(item → number)}
  handleDataUpdate(response) {
    if (!this.isStarted()) return;
    for (const [d, v] of response.values) if (this.line.has(d)) this.line.set(d, d.format(v));
    for (const v of this.line.values()) if (v === null) return;
    let s = ''; for (const v of this.line.values()) s += this.delim + v;
    let ts; if (this.absolute) ts = clock(new Date(response.timestamp)); else { if (this.startTs === 0) this.startTs = response.timestamp; ts = String(response.timestamp - this.startTs); }
    this.writeText(ts + s); this.resetLine();
  }
  writeText(t) { this.buf.push(t.endsWith(NEW_LINE) ? t : t + NEW_LINE); if (this.buf.length >= 64) this.flush(); }
  flush() { if (this.fd !== null && this.buf.length) { fs.writeSync(this.fd, Buffer.from(this.buf.join(''), this.encoding)); this.buf = []; } }
}
module.exports = { FileUpdateHandler, NEW_LINE };
