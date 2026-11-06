'use strict';
// ejLogger core: Subaru SSM over K-Line (ISO 9141), ported 1:1 from RomRaider 1.1.0
// (io/protocol/ssm/iso9141/SSMProtocol, SSMLoggerProtocol, SSMResponseProcessor, SSMChecksumCalculator, SSMEcuInit).

const HEADER = 0x80, READ_ONCE = 0x00, READ_CONTINUOUS = 0x01;
const CMD = { READ_MEMORY: 0xA0, READ_ADDRESS: 0xA8, WRITE_MEMORY: 0xB0, WRITE_ADDRESS: 0xB8, ECU_INIT: 0xBF };
const RSP = { READ_MEMORY: 0xE0, READ_ADDRESS: 0xE8, WRITE_MEMORY: 0xF0, WRITE_ADDRESS: 0xF8, ECU_INIT: 0xFF };
const ADDRESS_SIZE = 3, DATA_SIZE = 1, RESPONSE_NON_DATA_BYTES = 6, REQUEST_NON_DATA_BYTES = 7;

// low byte of the sum of every byte except the last (the checksum slot)
function checksum(bytes) { let t = 0; for (let i = 0; i < bytes.length - 1; i++) t += bytes[i] & 0xff; return (t - ((t >>> 16) << 16)) & 0xff; }

// buildRequest: 80 <module> <tester> <len> <cmd> [mode] <content…> <cs>; len = content + (pad ? 2 : 1)
function buildRequest(module, command, pad, fastPoll, ...content) {
  const body = [].concat(...content.map(c => Array.from(c)));
  const out = [HEADER, module.address[0], module.tester[0], (body.length + (pad ? 2 : 1)) & 0xff, command];
  if (pad) out.push(fastPoll ? READ_CONTINUOUS : READ_ONCE);
  out.push(...body, 0); const b = Buffer.from(out); b[b.length - 1] = checksum(b); return b;
}
const ecuInitRequest = module => buildRequest(module, CMD.ECU_INIT, false, false, []);
const addr3 = a => [(a >>> 16) & 0xff, (a >>> 8) & 0xff, a & 0xff];

// queries: [{key, addrs:[int…]}]. Duplicates (same address list) are sent once (filterDuplicates keeps first).
function filterDuplicates(queries) { const seen = new Set(), out = []; for (const q of queries) { const k = q.addrs.join(','); if (!seen.has(k)) { seen.add(k); out.push(q); } } return out; }
function readAddressRequest(module, queries, fastPoll) {
  const f = filterDuplicates(queries), addrs = []; for (const q of f) for (const a of q.addrs) addrs.push(addr3(a));
  return buildRequest(module, CMD.READ_ADDRESS, true, fastPoll, ...addrs);
}
// size of the buffer RomRaider waits for: STATE_0 includes the K-Line echo of the request
function readAddressResponseSize(queries, state) {
  let n = 0; for (const q of filterDuplicates(queries)) n += q.addrs.length;
  return state === 1 ? n * DATA_SIZE + RESPONSE_NON_DATA_BYTES : (n * DATA_SIZE + RESPONSE_NON_DATA_BYTES) + (n * ADDRESS_SIZE + REQUEST_NON_DATA_BYTES);
}
// filterRequestFromResponse: strip echo unless (read-address in STATE_1)
function stripEcho(request, response, state) {
  if (request[4] !== CMD.READ_ADDRESS || state === 0) return response.subarray(request.length);
  return response;
}
class InvalidResponse extends Error {}
function validate(module, r) {
  if (!(r.length > RESPONSE_NON_DATA_BYTES)) throw new InvalidResponse('Invalid response length');
  if (r[0] !== HEADER) throw new InvalidResponse('Invalid header');
  if (r[1] !== module.tester[0]) throw new InvalidResponse('Invalid diagnostic tool id');
  if (r[2] !== module.address[0]) throw new InvalidResponse('Invalid ' + module.id + ' id');
  if (r[3] !== ((r.length - RESPONSE_NON_DATA_BYTES + 1) & 0xff)) throw new InvalidResponse('Invalid response data length');
  if (![RSP.ECU_INIT, RSP.READ_ADDRESS, RSP.READ_MEMORY, RSP.WRITE_ADDRESS, RSP.WRITE_MEMORY].includes(r[4])) throw new InvalidResponse('Invalid response code');
  if (checksum(r) !== r[r.length - 1]) throw new InvalidResponse('Invalid checksum');
}
function extractData(module, r) { validate(module, r); return r.subarray(RESPONSE_NON_DATA_BYTES - 1, r.length - 1); }
// SSMEcuInit: id = data bytes 3..7 as upper-case hex
function parseEcuInit(module, processed) {
  validate(module, processed); if (processed[4] !== RSP.ECU_INIT) throw new InvalidResponse('Unexpected ' + module.id + ' Init response type');
  const bytes = Buffer.from(extractData(module, processed));
  return { bytes, ecuId: bytes.subarray(3, 8).toString('hex').toUpperCase() };
}
// processReadAddressResponses: data split in request order per unique query, then copied to every query with the same addresses
function splitResponse(module, queries, processed) {
  const data = extractData(module, processed), map = new Map(); let i = 0;
  for (const q of filterDuplicates(queries)) { const n = q.addrs.length * DATA_SIZE; map.set(q.addrs.join(','), Buffer.from(data.subarray(i, i + n))); i += n; }
  return queries.map(q => map.get(q.addrs.join(',')));
}
// SerialConnectionManager streaming check on each STATE_1 packet
function streamPacketOk(r) { return r[0] === 0x80 && r[1] === 0xF0 && (r[2] === 0x10 || r[2] === 0x18) && r[3] === r.length - 5 && r[r.length - 1] === checksum(r); }

module.exports = { HEADER, CMD, RSP, checksum, buildRequest, ecuInitRequest, readAddressRequest, readAddressResponseSize, stripEcho, validate, extractData, parseEcuInit, splitResponse, filterDuplicates, streamPacketOk, InvalidResponse };
