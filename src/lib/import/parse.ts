/**
 * Deterministisk tolkning av kontoutdragsrader.
 *
 * Ingen AI läser filen. Kolumntolkning, belopp, datum och dubblettnyckel
 * räknas fram här i vanlig TypeScript.
 */

import { normalizeDescription } from "@/lib/leaks";

export type DateFormat = "YYYY-MM-DD" | "DD.MM.YYYY" | "DD/MM/YYYY" | "YYYYMMDD" | "DD-MM-YYYY";

export const DATE_FORMATS: DateFormat[] = [
  "YYYY-MM-DD",
  "DD.MM.YYYY",
  "DD/MM/YYYY",
  "YYYYMMDD",
  "DD-MM-YYYY",
];

export type AmountMode = "signed" | "two_column";

export interface ColumnMap {
  /** Transaktionsdatum — det som ska användas */
  date: number;
  description: number;
  /** Belopp när amount_mode = 'signed' */
  amount?: number;
  /** Insättning/uttag när amount_mode = 'two_column' */
  in?: number;
  out?: number;
  balance?: number;
  /** Bokföringsdatum, sparas men används inte för occurred_at */
  booking_date?: number;
  /** Löpnummer/referens, går in i dubblettnyckeln */
  reference?: number;
}

export interface ParseConfig {
  columnMap: ColumnMap;
  dateFormat: DateFormat;
  amountMode: AmountMode;
  signFlip: boolean;
  headerRow: number;
}

export interface ParsedRow {
  index: number;
  occurred_at: string;
  booking_date: string | null;
  description: string;
  raw_description: string;
  amount: number;
  balance: number | null;
  reference: string | null;
  /** Löpnummer inom filen för identiska rader samma dag */
  seq: number;
  import_hash?: string;
  error?: string;
}

const NBSP = /[\u00a0\u2007\u202f\u2009\s']/g;

/**
 * `1 234,56`, `1 234,56-`, `(1 234,56)`, `1.234,56` och `1234.56` blir tal.
 * Hårt mellanslag (U+00A0) är vanligare än vanligt mellanslag i exporterna.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, "");
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.replace(/^-/, "");
  }

  s = s.replace(/(kr|SEK)/gi, "").replace(NBSP, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Den sista av dem är decimaltecknet, den andra är tusentalsavskiljare.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  } else if (lastDot >= 0 && s.length - lastDot > 3) {
    // "1.234" är tusental, inte decimaler
    s = s.replace(/\./g, "");
  }

  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseDate(raw: string | null | undefined, format?: DateFormat): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(NBSP, "");
  if (s === "") return null;

  const tryFormat = (f: DateFormat): string | null => {
    let m: RegExpMatchArray | null = null;
    if (f === "YYYY-MM-DD") m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (f === "DD.MM.YYYY") m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (f === "DD/MM/YYYY") m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (f === "DD-MM-YYYY") m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (f === "YYYYMMDD") m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    const [y, mo, d] =
      f === "YYYY-MM-DD" || f === "YYYYMMDD"
        ? [m[1]!, m[2]!, m[3]!]
        : [m[3]!, m[2]!, m[1]!];
    const iso = `${y}-${mo}-${d}`;
    const check = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(check.getTime())) return null;
    return iso;
  };

  if (format) {
    const hit = tryFormat(format);
    if (hit) return hit;
  }
  for (const f of DATE_FORMATS) {
    const hit = tryFormat(f);
    if (hit) return hit;
  }
  return null;
}

export function detectDateFormat(samples: (string | undefined)[]): DateFormat {
  for (const f of DATE_FORMATS) {
    const hits = samples.filter((s) => s && parseDate(s, f) != null && matchesShape(s, f)).length;
    if (hits >= Math.max(1, Math.ceil(samples.filter(Boolean).length * 0.6))) return f;
  }
  return "YYYY-MM-DD";
}

function matchesShape(s: string, f: DateFormat): boolean {
  const t = s.trim();
  if (f === "YYYY-MM-DD") return /^\d{4}-\d{2}-\d{2}/.test(t);
  if (f === "DD.MM.YYYY") return /^\d{2}\.\d{2}\.\d{4}/.test(t);
  if (f === "DD/MM/YYYY") return /^\d{2}\/\d{2}\/\d{4}/.test(t);
  if (f === "DD-MM-YYYY") return /^\d{2}-\d{2}-\d{4}/.test(t);
  return /^\d{8}$/.test(t);
}

const HEADER_HINTS: Record<keyof ColumnMap, string[]> = {
  date: ["transaktionsdatum", "transaktionsdag", "affärsdag", "datum", "date"],
  booking_date: ["bokföringsdatum", "bokföringsdag", "bokfört", "valutadatum", "valutadag"],
  description: ["text", "beskrivning", "specifikation", "meddelande", "rubrik", "mottagare", "description"],
  amount: ["belopp", "summa", "amount"],
  in: ["insättning", "insatt", "in", "kredit", "credit"],
  out: ["uttag", "ut", "debet", "debit"],
  balance: ["saldo", "bokfört saldo", "balance"],
  reference: ["referens", "verifikationsnummer", "verifikation", "löpnummer", "id"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/["']/g, "").trim();
}

/** Hitta rubrikraden: den första raden med minst två kända rubriker. */
export function detectHeaderRow(matrix: string[][]): number {
  const limit = Math.min(matrix.length, 15);
  for (let r = 0; r < limit; r++) {
    const cells = (matrix[r] ?? []).map(norm);
    if (cells.filter((c) => c !== "").length < 2) continue;
    let hits = 0;
    for (const list of Object.values(HEADER_HINTS)) {
      if (cells.some((c) => list.some((h) => c === h || c.includes(h)))) hits++;
    }
    if (hits >= 2) return r;
  }
  return 0;
}

export interface GuessResult {
  columnMap: ColumnMap;
  amountMode: AmountMode;
  dateFormat: DateFormat;
}

/** Gissa kolumnmappningen en gång — sedan sparas den som bankprofil. */
export function guessColumns(headers: string[], body: string[][]): GuessResult {
  const cells = headers.map(norm);
  const find = (key: keyof ColumnMap): number | undefined => {
    const list = HEADER_HINTS[key];
    let exact = cells.findIndex((c) => list.some((h) => c === h));
    if (exact >= 0) return exact;
    exact = cells.findIndex((c) => c !== "" && list.some((h) => c.includes(h)));
    return exact >= 0 ? exact : undefined;
  };

  const map: ColumnMap = {
    date: find("date") ?? 0,
    description: find("description") ?? 1,
  };
  const booking = find("booking_date");
  // Om bara ett datum hittas: använd det som transaktionsdatum.
  if (booking != null && booking !== map.date) map.booking_date = booking;
  if (find("date") == null && booking != null) map.date = booking;

  const amount = find("amount");
  const inCol = find("in");
  const outCol = find("out");
  let amountMode: AmountMode = "signed";
  if (amount != null) {
    map.amount = amount;
  } else if (inCol != null && outCol != null) {
    amountMode = "two_column";
    map.in = inCol;
    map.out = outCol;
  } else {
    // Sista utväg: sista kolumnen som ser ut som tal på flera rader.
    const numeric = numericColumns(body);
    map.amount = numeric[0] ?? 2;
  }
  const balance = find("balance");
  if (balance != null && balance !== map.amount) map.balance = balance;
  const reference = find("reference");
  if (reference != null) map.reference = reference;

  const dateFormat = detectDateFormat(body.slice(0, 20).map((r) => r[map.date]));
  return { columnMap: map, amountMode, dateFormat };
}

function numericColumns(body: string[][]): number[] {
  const width = Math.max(0, ...body.map((r) => r.length));
  const out: { col: number; hits: number }[] = [];
  for (let c = 0; c < width; c++) {
    const hits = body.filter((r) => parseAmount(r[c]) != null).length;
    if (hits >= Math.ceil(body.length * 0.6)) out.push({ col: c, hits });
  }
  return out.map((o) => o.col);
}

/** Normaliserad beskrivning används för regler och dubblettnyckel. */
export function normalizeMerchant(raw: string | null | undefined): string {
  return normalizeDescription(raw);
}

export interface BuildResult {
  rows: ParsedRow[];
  skipped: number;
}

export function buildRows(matrix: string[][], config: ParseConfig): BuildResult {
  const body = matrix.slice(config.headerRow + 1);
  const rows: ParsedRow[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  body.forEach((cells, i) => {
    if (cells.every((c) => (c ?? "").trim() === "")) return;
    const m = config.columnMap;
    const occurred = parseDate(cells[m.date], config.dateFormat);
    if (!occurred) {
      skipped++;
      return;
    }

    let amount: number | null;
    if (config.amountMode === "two_column") {
      const inn = parseAmount(cells[m.in ?? -1]) ?? 0;
      const out = parseAmount(cells[m.out ?? -1]) ?? 0;
      amount = Math.abs(inn) - Math.abs(out);
    } else {
      amount = parseAmount(cells[m.amount ?? -1]);
    }
    if (amount == null || amount === 0) {
      skipped++;
      return;
    }
    if (config.signFlip) amount = -amount;

    const rawDescription = (cells[m.description] ?? "").trim();
    const reference = m.reference != null ? (cells[m.reference] ?? "").trim() || null : null;
    const booking = m.booking_date != null ? parseDate(cells[m.booking_date]) : null;

    const key = `${occurred}|${amount}|${normalizeMerchant(rawDescription)}|${reference ?? ""}`;
    const seq = (seen.get(key) ?? 0) + 1;
    seen.set(key, seq);

    rows.push({
      index: i,
      occurred_at: occurred,
      booking_date: booking,
      description: rawDescription,
      raw_description: rawDescription,
      amount: Math.round(amount * 100) / 100,
      balance: m.balance != null ? parseAmount(cells[m.balance]) : null,
      reference,
      seq,
    });
  });

  return { rows, skipped };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * import_hash = SHA-256 av
 * account_id | occurred_at | amount | normalize(description) | löpnummer
 */
export function rowHash(row: ParsedRow, accountId: string | null): Promise<string> {
  const seq = row.reference ? `${row.reference}#${row.seq}` : String(row.seq);
  return sha256Hex(
    [accountId ?? "", row.occurred_at, row.amount.toFixed(2), normalizeMerchant(row.raw_description), seq].join(
      "|",
    ),
  );
}

export async function withHashes(rows: ParsedRow[], accountId: string | null): Promise<ParsedRow[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, import_hash: await rowHash(r, accountId) })));
}
