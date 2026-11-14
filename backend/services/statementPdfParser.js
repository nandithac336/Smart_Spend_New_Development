import { PDFParse } from "pdf-parse";
import { ApiError } from "../utils/apiError.js";
import { normalizeStatementRows, parseStatementDate } from "./statementParsing.js";

const MAX_PDF_PAGES = 50;

function extractReference(text) {
  const match = text.match(/(?:reference|ref(?:erence)?\s*(?:no|number)?|utr|rrn)\s*[:#-]?\s*([A-Z0-9-]{6,40})/i);
  return match?.[1] || null;
}

function splitPdfLine(line) {
  const cells = line.split(/\t+|\s{2,}/).map((cell) => cell.trim());
  return cells.filter((cell) => cell.length > 0);
}

export function parsePdfRows(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map(splitPdfLine);
  try {
    return normalizeStatementRows(rows);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  const datePattern = /^(\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3,9})[-/. ]\d{2,4}(?:[ T]+\d{1,2}:\d{2}(?:\s*[AP]M)?)?|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(.+)$/i;
  const moneyPattern = /(?:₹\s*)?-?\(?\d[\d,]*(?:\.\d{1,2})?\)?(?:\s*(?:DR|CR))?/gi;
  const parsedRows = [["Date", "Description", "Debit", "Credit", "Balance", "Reference"]];

  for (const line of lines) {
    const match = line.match(datePattern);
    if (!match || !parseStatementDate(match[1])) continue;
    const remainder = match[2];
    const matches = [...remainder.matchAll(moneyPattern)];
    if (!matches.length) {
      parsedRows.push([match[1], remainder.slice(0, 300), "", "", "", extractReference(remainder)]);
      continue;
    }

    const firstAmountStart = matches[0].index;
    const description = remainder.slice(0, firstAmountStart).trim().replace(/\s+/g, " ").slice(0, 300);
    const values = matches.map((item) => item[0].trim()).slice(-3);
    const reference = extractReference(remainder);
    let debit = "";
    let credit = "";
    let balance = "";

    if (values.length >= 3) {
      [debit, credit, balance] = values;
    } else {
      const directionText = remainder.toLowerCase();
      const singleDirection = /\b(debit|withdrawal|dr)\b/.test(directionText)
        ? "debit"
        : /\b(credit|deposit|cr)\b/.test(directionText)
          ? "credit"
          : values[0].startsWith("-") || values[0].startsWith("(")
            ? "debit"
            : null;
      if (singleDirection === "debit") debit = values[0];
      if (singleDirection === "credit") credit = values[0];
      if (values.length === 2) balance = values[1];
    }
    parsedRows.push([match[1], description, debit, credit, balance, reference]);
  }
  if (parsedRows.length === 1) {
    throw ApiError.badRequest("PDF contains no selectable text transaction rows in a supported bank-statement layout");
  }
  return normalizeStatementRows(parsedRows);
}

export async function parseStatementPdf(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 5) !== "%PDF-" ||
    !buffer.toString("latin1", Math.max(0, buffer.length - 2048)).includes("%%EOF")
  ) throw ApiError.badRequest("PDF signature is invalid or the file is incomplete");
  if (/\/Encrypt\b/.test(buffer.toString("latin1"))) {
    throw ApiError.badRequest("Encrypted PDFs are not supported");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    if (info.total < 1 || info.total > MAX_PDF_PAGES) {
      throw ApiError.badRequest(`PDF must contain between 1 and ${MAX_PDF_PAGES} pages`);
    }
    if (info.info?.IsEncrypted || info.info?.Encrypted) {
      throw ApiError.badRequest("Encrypted PDFs are not supported");
    }
    const result = await parser.getText({
      first: MAX_PDF_PAGES,
      cellSeparator: "  ",
      lineEnforce: true,
      imageBuffer: false,
      imageDataUrl: false,
    });
    if (!result.text?.trim()) {
      throw ApiError.badRequest("PDF contains no selectable text; scanned/image-only PDFs are not supported");
    }
    return parsePdfRows(result.text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (/password|encrypt/i.test(error?.message || "")) {
      throw ApiError.badRequest("Encrypted PDFs are not supported");
    }
    throw ApiError.badRequest("PDF is corrupted, encrypted, or could not be read");
  } finally {
    await parser.destroy();
  }
}
