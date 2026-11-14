import ExcelJS from "exceljs";
import { ApiError } from "../utils/apiError.js";
import { MAX_STATEMENT_COLUMNS, MAX_STATEMENT_ROWS, normalizeStatementRows } from "./statementParsing.js";

const MAX_ZIP_ENTRIES = 2_000;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export function inspectXlsxArchive(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 22 ||
    buffer.readUInt32LE(0) !== 0x04034b50
  ) throw ApiError.badRequest("XLSX file signature is invalid or corrupted");

  const searchStart = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0 || eocd + 22 > buffer.length) throw ApiError.badRequest("XLSX ZIP directory is missing or corrupted");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (
    entryCount < 1 ||
    entryCount > MAX_ZIP_ENTRIES ||
    directoryOffset + directorySize > eocd
  ) throw ApiError.badRequest("XLSX archive structure is invalid");

  let cursor = directoryOffset;
  let totalUncompressed = 0;
  let foundWorkbook = false;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw ApiError.badRequest("XLSX archive directory is corrupted");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const next = nameStart + nameLength + extraLength + commentLength;
    if (next > buffer.length || (flags & 1)) throw ApiError.badRequest("Encrypted or malformed XLSX files are not supported");
    const name = buffer.toString("utf8", nameStart, nameStart + nameLength).replace(/\\/g, "/");
    if (name.startsWith("/") || name.split("/").includes("..")) throw ApiError.badRequest("XLSX contains an unsafe archive path");
    if (/vbaProject\.bin|externalLinks|embeddings/i.test(name)) {
      throw ApiError.badRequest("Macro-enabled or externally linked workbooks are not supported");
    }
    if (name === "xl/workbook.xml") foundWorkbook = true;
    if (uncompressedSize === 0xffffffff) throw ApiError.badRequest("XLSX ZIP64 archives are not supported");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw ApiError.badRequest("XLSX expands beyond the 50 MB processing limit");
    }
    cursor = next;
  }
  if (!foundWorkbook || cursor !== directoryOffset + directorySize) {
    throw ApiError.badRequest("XLSX workbook contents are missing or corrupted");
  }
}

function getCellValue(cell) {
  const value = cell.value;
  if (value instanceof Date || typeof value === "number" || typeof value === "string") return value;
  if (value && typeof value === "object" && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text || "").join("");
  }
  return null;
}

export async function parseStatementXlsx(buffer, options = {}) {
  inspectXlsxArchive(buffer);
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer, { ignoreNodes: ["extLst", "dataValidations"] });
  } catch {
    throw ApiError.badRequest("XLSX workbook is corrupted or uses unsupported features");
  }
  const sheet = workbook.worksheets.find((worksheet) => worksheet.state === "visible");
  if (!sheet) throw ApiError.badRequest("XLSX has no visible worksheet to import");
  if (sheet.rowCount > MAX_STATEMENT_ROWS + 30 || sheet.columnCount > MAX_STATEMENT_COLUMNS) {
    throw ApiError.badRequest(`XLSX exceeds the ${MAX_STATEMENT_ROWS}-row or ${MAX_STATEMENT_COLUMNS}-column limit`);
  }

  const rows = [];
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    rows.push(Array.from({ length: Math.min(sheet.columnCount, MAX_STATEMENT_COLUMNS) }, (_, index) =>
      getCellValue(row.getCell(index + 1))
    ));
  }
  return normalizeStatementRows(rows, options);
}
