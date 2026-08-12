/**
 * Filinläsning i webbläsaren. CSV via PapaParse, xlsx via SheetJS.
 * Filen laddas aldrig upp någonstans — bara de tolkade raderna skickas vidare.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { decodeAs, decodeBuffer, sniffDelimiter, type Encoding } from "./decode";

export interface ReadResult {
  matrix: string[][];
  delimiter: string;
  encoding: Encoding;
  fellBack: boolean;
  kind: "csv" | "xlsx";
  fileName: string;
}

function isSpreadsheet(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name);
}

export async function readStatementFile(
  file: File,
  override?: { encoding?: Encoding; delimiter?: string },
): Promise<ReadResult> {
  const buffer = await file.arrayBuffer();

  if (isSpreadsheet(file.name)) {
    const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
    const sheetName = wb.SheetNames[0]!;
    const sheet = wb.Sheets[sheetName]!;
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return {
      matrix: matrix.map((r) => r.map((c) => String(c ?? "").trim())),
      delimiter: ";",
      encoding: "utf-8",
      fellBack: false,
      kind: "xlsx",
      fileName: file.name,
    };
  }

  const decoded = override?.encoding
    ? { text: decodeAs(buffer, override.encoding), encoding: override.encoding, fellBack: false }
    : decodeBuffer(buffer);

  const delimiter = override?.delimiter ?? sniffDelimiter(decoded.text);
  const parsed = Papa.parse<string[]>(decoded.text, {
    delimiter,
    skipEmptyLines: "greedy",
    newline: undefined,
  });

  return {
    matrix: (parsed.data ?? []).map((r) => (r ?? []).map((c) => String(c ?? "").trim())),
    delimiter,
    encoding: decoded.encoding,
    fellBack: decoded.fellBack,
    kind: "csv",
    fileName: file.name,
  };
}
