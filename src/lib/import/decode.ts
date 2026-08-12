/**
 * Teckenkodning och avgränsare för svenska kontoutdrag.
 *
 * Filen lämnar aldrig webbläsaren — allt här körs klientsidan på en
 * ArrayBuffer som användaren valt i en filväljare.
 */

export type Encoding = "utf-8" | "windows-1252";

export interface DecodeResult {
  text: string;
  encoding: Encoding;
  /** true om filen inleddes med UTF-8 BOM */
  bom: boolean;
  /** true om UTF-8-tolkningen gav mojibake och vi bytte till windows-1252 */
  fellBack: boolean;
}

const MOJIBAKE = /Ã¥|Ã¤|Ã¶|Ã…|Ã„|Ã–|â€|Ã©|ï¿½/;

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

/**
 * Läs BOM, försök UTF-8 strikt, faller det ut med å/ä/ö som Ã¥Ã¤Ã¶ läses
 * filen om som windows-1252. Det är det överlägset vanligaste felet i
 * exporter från svenska banker.
 */
export function decodeBuffer(buffer: ArrayBuffer): DecodeResult {
  const bytes = new Uint8Array(buffer);
  const bom = hasUtf8Bom(bytes);
  const body = bom ? bytes.subarray(3) : bytes;

  if (bom) {
    return { text: new TextDecoder("utf-8").decode(body), encoding: "utf-8", bom, fellBack: false };
  }

  let utf8: string | null = null;
  try {
    utf8 = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    utf8 = null;
  }

  if (utf8 != null && !MOJIBAKE.test(utf8)) {
    return { text: utf8, encoding: "utf-8", bom, fellBack: false };
  }

  const latin = new TextDecoder("windows-1252").decode(body);
  return { text: latin, encoding: "windows-1252", bom, fellBack: true };
}

/** Avkoda med en uttrycklig kodning (när profilen redan vet svaret). */
export function decodeAs(buffer: ArrayBuffer, encoding: Encoding): string {
  const bytes = new Uint8Array(buffer);
  const body = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes;
  return new TextDecoder(encoding).decode(body);
}

const CANDIDATES = [";", ",", "\t", "|"] as const;

/**
 * Sniffa avgränsaren på de första raderna istället för att anta komma.
 * Semikolon är vanligast i svenska exporter.
 */
export function sniffDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 5);
  if (lines.length === 0) return ";";

  let best = ";";
  let bestScore = -1;
  for (const d of CANDIDATES) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    // Belöna avgränsare som ger samma antal kolumner på varje rad.
    const consistent = counts.every((c) => c === first);
    const score = first * (consistent ? 10 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === delimiter) count++;
  }
  return count;
}
