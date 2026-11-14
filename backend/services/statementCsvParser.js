import { parse } from "csv-parse/sync";
import { ApiError } from "../utils/apiError.js";
import { MAX_STATEMENT_COLUMNS, MAX_STATEMENT_ROWS, normalizeStatementRows } from "./statementParsing.js";

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 30);
  const candidates = [",", ";", "\t", "|"].map((delimiter) => {
    let rowsWithColumns = 0;
    let totalSeparators = 0;
    for (const line of lines) {
      let quoted = false;
      let count = 0;
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] === '"') {
          if (quoted && line[index + 1] === '"') index += 1;
          else quoted = !quoted;
        } else if (!quoted && line[index] === delimiter) {
          count += 1;
        }
      }
      if (count) rowsWithColumns += 1;
      totalSeparators += count;
    }
    return { delimiter, score: rowsWithColumns * 100 + totalSeparators };
  });
  return candidates.sort((a, b) => b.score - a.score)[0].delimiter;
}

export function parseStatementCsv(buffer, options = {}) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw ApiError.badRequest("CSV must be valid UTF-8 text");
  }
  if (!text.trim() || text.includes("\0")) throw ApiError.badRequest("CSV is empty or contains invalid binary data");
  const delimiter = detectDelimiter(text);
  let rows;
  try {
    rows = parse(text, {
      bom: true,
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      max_record_size: 20_000,
      to: MAX_STATEMENT_ROWS + 31,
      record_delimiter: ["\r\n", "\n", "\r"],
    });
  } catch {
    throw ApiError.badRequest("CSV syntax is invalid; check quoting and row delimiters");
  }
  if (rows.length > MAX_STATEMENT_ROWS + 30) throw ApiError.badRequest(`Statement exceeds the ${MAX_STATEMENT_ROWS}-row limit`);
  if (rows.some((row) => row.length > MAX_STATEMENT_COLUMNS)) {
    throw ApiError.badRequest(`Statement exceeds the ${MAX_STATEMENT_COLUMNS}-column limit`);
  }
  return normalizeStatementRows(rows, options);
}
