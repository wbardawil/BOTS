// Minimal RFC 4180 CSV parser/serializer. Handles quotes, embedded newlines, a UTF-8 BOM, and detects
// the delimiter (comma or semicolon, which es-MX Excel uses). No dependency.
export function detectDelimiter(text) {
  const head = text.slice(0, 4000).split(/\r?\n/).slice(0, 5).join("\n");
  const count = (ch) => (head.match(new RegExp(`\\${ch}`, "g")) || []).length;
  const semi = count(";"), comma = count(","), tab = count("\t");
  if (tab > semi && tab > comma) return "\t";
  return semi > comma ? ";" : ",";
}

export function parseCsv(text, delimiter) {
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const d = delimiter || detectDelimiter(src);
  const rows = []; let row = []; let field = ""; let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === d) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [], delimiter: d };
  const headers = nonEmpty[0].map((h) => String(h).trim());
  const body = nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").toString().trim()])));
  return { headers, rows: body, delimiter: d, replacementChars: /�/.test(src) };
}

const esc = (v) => {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows, delimiter = ",") {
  const lines = [headers.map(esc).join(delimiter)];
  rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(delimiter)));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Best-effort match of a CSV header to a manifest row: by key, then by es/en label (case/accents insensitive). */
export function matchHeader(header, rows) {
  const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const h = norm(header);
  const exact = rows.find((r) => norm(r.key) === h || norm(r.key.replace(/_/g, " ")) === h || norm(r.es) === h || norm(r.en) === h);
  if (exact) return exact.key;
  const partial = rows.find((r) => h && (norm(r.en).includes(h) || norm(r.es).includes(h) || h.includes(norm(r.key.replace(/_/g, " ")))));
  return partial ? partial.key : "";
}
