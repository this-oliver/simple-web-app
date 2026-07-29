import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import express from "express";
import helmet from "helmet";

const PORT = Number(process.env.PORT) || 3000;
const LOGS_FILEPATH = process.env.LOGS_FILEPATH || "logs/requests.txt";

const LOG_LINE_RE = /^\[(\S+)\]\s+SRC:(\S+)\s+DST:(\S+):(\d+)\s+UA:(.+)$/;

function initLogfile(filepath: string): void {
  const logDir = path.dirname(filepath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, "");
  }
}

function writeToLogfile(filepath: string, content: string): void {
  fs.appendFileSync(filepath, content);
}

function initApp(port: number, logfile: string) {
  initLogfile(logfile);

  const app = express();
  app.use(helmet());

  app.use((req, _res, next) => {
    const srcIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const dstIp = req.socket.localAddress;
    const dstPort = req.socket.localPort;
    const ua = req.headers["user-agent"] || "unknown";
    const ts = new Date().toISOString();
    const log = `[${ts}] SRC:${srcIp} DST:${dstIp}:${dstPort} UA:${ua}\n`;
    writeToLogfile(logfile, log);
    next();
  });

  app.get("/", (_req, res) => {
    const raw = fs.readFileSync(logfile, "utf-8").trim();
    if (!raw) {
      return res.send("<h1>Request Logs</h1><p>No requests yet.</p>");
    }

    interface LogEntry { ts: string, dstIp: string, dstPort: string, ua: string }
    const groups = new Map<string, LogEntry[]>();

    for (const line of raw.split("\n")) {
      const m = line.match(LOG_LINE_RE);
      if (!m)
        continue;
      const [, ts, srcIp, dstIp, dstPort, ua] = m;
      if (!groups.has(srcIp))
        groups.set(srcIp, []);
      groups.get(srcIp)!.push({ ts, dstIp, dstPort, ua });
    }

    const rows: Array<{ srcIp: string, dstIp: string, dstPort: string, visitCount: number, uas: string, firstTs: string, lastTs: string, timesList: string }> = [];
    for (const [srcIp, entries] of groups) {
      const visitCount = entries.length;
      const dstIp = entries[0].dstIp;
      const dstPort = entries[0].dstPort;
      const uas = [...new Set(entries.map(e => e.ua))];
      const firstTs = entries[0].ts;
      const lastTs = entries[entries.length - 1].ts;
      const timesList = entries.map(e => e.ts).join("<br>");
      rows.push({ srcIp, dstIp, dstPort, visitCount, uas: uas.join("<br>"), firstTs, lastTs, timesList });
    }

    const tableRows = rows.map(r => `
      <tr>
        <td>${r.srcIp}</td>
        <td>${r.dstIp}:${r.dstPort}</td>
        <td>${r.visitCount}</td>
        <td>${r.uas}</td>
        <td>${r.firstTs}</td>
        <td>${r.lastTs}</td>
      </tr>`).join("\n");

    res.send(`
      <h1>Simple Web App</h1>
      <p>This simple web app keeps track of its visitors</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:monospace">
        <thead>
          <tr>
            <th>Source IP</th>
            <th>Destination</th>
            <th>Visits</th>
            <th>User Agents</th>
            <th>First Seen</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`);
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.info(`Example app listening on port ${port}`);
  });
}

initApp(PORT, LOGS_FILEPATH);
