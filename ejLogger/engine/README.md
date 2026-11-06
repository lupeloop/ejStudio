# ejLogger engine

RomRaider 1.1.0 Logger's logging layer, ported 1:1 to Node (no dependencies yet; `serialport` 13 comes in when wired to real ports).

- `src/convert.js`: conversion expressions, byte decoding, Java DecimalFormat (HALF_EVEN, `-0.00`).
- `src/defs.js`: RomRaider logger definition loader (`logger_*.xml`); supported-parameter rules.
- `src/ssm.js`: SSM K-Line packets: init, A8 reads, checksum, echo strip, validation, response split.
- `src/logger.js`: QueryManager / SerialConnectionManager loop: fast-poll state machine, line break, bad-packet reuse, reconnect.
- `src/csv.js`: FileLoggerImpl / FileUpdateHandlerImpl: filename, headers, rows, CRLF.
- `golden/`: Java harness running RomRaider's own classes (stock 1.1.0 jar + jep) to produce reference outputs.

Tests:
- `node test/golden.test.js`: JS vs RomRaider outputs (22,275/22,275).
- `node test/logger.test.js <logger_METRIC_EN_v370.xml> <a master log.csv>`: init, supported params, header identical to the real log, CRLF, burst pattern, rate at the K-Line limit, using a simulated ECU (`test/mockecu.js`).

## ejLogger engine (2026-11-05)
- `engine.js`: the background process ejStudio starts (Electron utilityProcess). Owns the ports, the polling loop and the CSV writer; talks to the UI over IPC (message list at the top of the file).
- `src/serial.js`: serialport 13 transport for `logger.js`. `src/wideband.js`: AEM UEGO, Innovate LC-2 (MTS), PLX external sources; a missing port retries every 1 s.
- `src/mockecu.js`: the simulated ECU, also offered as port `MOCK` for desk testing.
- `node test/engine.test.js [logger_METRIC_EN_v370.xml]`: forks the engine like the app does, logs from the mock ECU, records, checks header/CRLF/Time 0/columns.
