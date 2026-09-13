import type { Express } from "express";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import express from "express";
import helmet from "helmet";

const PORT = Number(process.env.PORT) || 3000;
const LOGS_FILEPATH = process.env.LOGS_FILEPATH || "logs/requests.txt";

const LOG_LINE_RE = /^\[(\S+)\]\s+SRC:(\S+)\s+PATH:(\S+)\s+UA:(.+)$/;

interface LogEntry {
  ts: string
  path: string
  ua: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function selectOptions(values: Array<{ value: string, label: string }>): string {
  return values
    .map(v => `<option value="${escapeHtml(v.value)}">${escapeHtml(v.label)}</option>`)
    .join("");
}

function visibleWithCount(list: string[], maxVisibleItems: number = 5): string[] {
  if (list.length <= maxVisibleItems)
    return list;
  const extra = list.length - maxVisibleItems;
  return [...list.slice(0, maxVisibleItems), `\u2026 (+${extra} more)`];
}

function formatList(items: string[], escape: (v: string) => string): string {
  return visibleWithCount(items).map(escape).join("<br>");
}

function buildFilterDetails(entries: LogEntry[]): string {
  const comboMap = new Map<string, { path: string, ua: string, visits: LogEntry[] }>();
  for (const e of entries) {
    const key = `${e.path}\u0000${e.ua}`;
    const combo = comboMap.get(key);
    if (combo)
      combo.visits.push(e);
    else
      comboMap.set(key, { path: e.path, ua: e.ua, visits: [e] });
  }
  const combos = [...comboMap.values()];
  const paths = [...new Set(combos.map(c => c.path))];
  const uas = [...new Set(combos.map(c => c.ua))];
  const pathOptions = selectOptions([
    { value: "", label: "All paths" },
    ...paths.map(p => ({ value: p, label: p }))
  ]);
  const uaOptions = selectOptions([
    { value: "", label: "All user agents" },
    ...uas.map(u => ({ value: u, label: u }))
  ]);
  const totalVisits = entries.length;
  const comboRows = combos.map(c => `
    <tr data-path="${escapeHtml(c.path)}" data-ua="${escapeHtml(c.ua)}" data-visits="${c.visits.length}">
      <td>${escapeHtml(c.path)}</td>
      <td>${c.visits.length}</td>
      <td>${escapeHtml(c.ua)}</td>
      <td>${escapeHtml(c.visits[0].ts)}</td>
      <td>${escapeHtml(c.visits[c.visits.length - 1].ts)}</td>
    </tr>`).join("\n");
  return `<div class="filter-panel">
    <div class="filter-controls">
      <label>Path <select class="path-filter">${pathOptions}</select></label>
      <label>User agent <select class="ua-filter">${uaOptions}</select></label>
    </div>
    <p class="match-count">Showing ${totalVisits} of ${totalVisits} visits</p>
    <table class="nested-table" border="1" cellpadding="4">
      <thead>
        <tr>
          <th>Path</th>
          <th>Visits</th>
          <th>User Agent</th>
          <th>First Seen</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>${comboRows}</tbody>
    </table>
  </div>`;
}

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

function initApp(logfile: string): Express {
  initLogfile(logfile);

  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));

  app.use((req, _res, next) => {
    const srcIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const reqPath = req.originalUrl;
    const ua = req.headers["user-agent"] || "unknown";
    const ts = new Date().toISOString();
    const log = `[${ts}] SRC:${srcIp} PATH:${reqPath} UA:${ua}\n`;
    writeToLogfile(logfile, log);
    next();
  });

  app.get("/", (_req, res) => {
    const raw = fs.readFileSync(logfile, "utf-8").trim();
    if (!raw) {
      return res.send("<h1>Request Logs</h1><p>No requests yet.</p>");
    }

    const groups = new Map<string, LogEntry[]>();

    for (const line of raw.split("\n")) {
      const m = line.match(LOG_LINE_RE);
      if (!m)
        continue;
      const [, ts, srcIp, reqPath, ua] = m;
      if (!groups.has(srcIp))
        groups.set(srcIp, []);
      groups.get(srcIp)!.push({ ts, path: reqPath, ua });
    }

    const rows: Array<{ srcIp: string, path: string, visitCount: number, uas: string, firstTs: string, lastTs: string, details: string }> = [];
    for (const [srcIp, entries] of groups) {
      const distinctPaths = [...new Set(entries.map(e => e.path))];
      const distinctUas = [...new Set(entries.map(e => e.ua))];
      const details = (distinctPaths.length > 1 || distinctUas.length > 1)
        ? buildFilterDetails(entries)
        : "";
      rows.push({
        srcIp,
        path: formatList(distinctPaths, escapeHtml),
        visitCount: entries.length,
        uas: formatList(distinctUas, escapeHtml),
        firstTs: entries[0].ts,
        lastTs: entries[entries.length - 1].ts,
        details
      });
    }

    const tableRows = rows.map((r, index) => `
      <tr${r.details ? ` class="filterable" data-filter-target="${index}"` : ""}>
        <td>${escapeHtml(r.srcIp)}</td>
        <td>${r.path}</td>
        <td>${r.visitCount}</td>
        <td>${r.uas}</td>
        <td>${escapeHtml(r.firstTs)}</td>
        <td>${escapeHtml(r.lastTs)}</td>
      </tr>
      ${r.details ? `<tr class="filter-row" data-filter-source="${index}" hidden><td colspan="6">${r.details}</td></tr>` : ""}`).join("\n");

    res.send(`
      <style>
        th { cursor: pointer; user-select: none; }
        th:hover { background-color: #f0f0f0; }
        th .arrow { font-size: 0.7em; }
        .filter-details { margin: 0; }
.filter-row td { background-color: #fdf0f2; }
        .filter-row td > .filter-panel { padding: 4px; }
        .filter-panel .filter-controls label { margin-right: 12px; font-weight: normal; }
        .nested-table { margin: 6px 0; background-color: #fff; }
        .filterable { cursor: pointer; }
        .filterable:hover td { background-color: #f5f5f5; }
        .filter-details > div { padding: 4px 0 0 12px; }
        .filter-details label { margin-right: 12px; font-weight: normal; }
        .matches { margin: 6px 0; padding-left: 18px; }
        .matches li { margin: 2px 0; }
        .matches .time { color: #666; }
        .matches .fp-path { color: #1a0dab; }
        .matches .fp-ua { color: #444; }
      </style>
      <h1>Guestbook</h1>
      <p>We hope you enjoyed your visit and look forward to your returns.</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:monospace">
        <thead>
          <tr>
            <th>Source IP</th>
            <th>Path</th>
            <th>Visits</th>
            <th>User Agents</th>
            <th>First Seen</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <script>
        document.querySelectorAll("tr.filterable").forEach(row => {
          row.addEventListener("click", () => {
            const sibling = document.querySelector('tr[data-filter-source="' + row.dataset.filterTarget + '"]');
            if (sibling) sibling.hidden = !sibling.hidden;
          });
        });
        document.querySelectorAll(".filter-panel").forEach(panel => {
          const pathSel = panel.querySelector(".path-filter");
          const uaSel = panel.querySelector(".ua-filter");
          const rows = [...panel.querySelectorAll(".nested-table tbody tr")];
          const matchCount = panel.querySelector(".match-count");
          const totalVisits = rows.reduce((sum, row) => sum + Number(row.dataset.visits), 0);
          const applyFilter = () => {
            const path = pathSel.value;
            const ua = uaSel.value;
            let visibleVisits = 0;
            rows.forEach(row => {
              const show = (!path || row.dataset.path === path) && (!ua || row.dataset.ua === ua);
              row.style.display = show ? "" : "none";
              if (show) visibleVisits += Number(row.dataset.visits);
            });
            matchCount.textContent = "Showing " + visibleVisits + " of " + totalVisits + " visits";
          };
          pathSel.addEventListener("change", applyFilter);
          uaSel.addEventListener("change", applyFilter);
        });
        const table = document.querySelector("table");
        const tbody = table.querySelector("tbody");
        const headers = [...table.querySelectorAll("th")];

        const NUMERIC_COLS = new Set([2]);

        function cellValue(row, index) {
          const text = row.cells[index].textContent.trim();
          return NUMERIC_COLS.has(index) ? Number(text) : text;
        }

        headers.forEach((header, index) => {
          header.addEventListener("click", () => {
            const isAsc = header.dataset.dir !== "asc";
            const dir = isAsc ? 1 : -1;
            headers.forEach(h => {
              delete h.dataset.dir;
              const arrow = h.querySelector(".arrow");
              if (arrow) arrow.remove();
            });
            header.dataset.dir = isAsc ? "asc" : "desc";
            const arrow = document.createElement("span");
            arrow.className = "arrow";
            arrow.textContent = isAsc ? " \\u25B2" : " \\u25BC";
            header.appendChild(arrow);

            const rows = [...tbody.rows].sort((a, b) => {
              const av = cellValue(a, index);
              const bv = cellValue(b, index);
              if (av < bv) return -1 * dir;
              if (av > bv) return 1 * dir;
              return 0;
            });
            rows.forEach(row => tbody.appendChild(row));
          });
        });
      </script>`);
  });

  return app;
}

function shutdown(signal: string, server: Server): void {
  // eslint-disable-next-line no-console
  console.info(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
};

const app: Express = initApp(LOGS_FILEPATH);
const server: Server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.info(`Listening on port ${PORT}`);
});
process.on("SIGTERM", () => shutdown("SIGTERM", server));
process.on("SIGINT", () => shutdown("SIGINT", server));
