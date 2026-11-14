import { ApiError } from "../utils/apiError.js";

export const MAX_STATEMENT_ROWS = 5_000;
export const MAX_STATEMENT_COLUMNS = 60;

const HEADER_ALIASES = {
  date: ["date", "transaction date", "txn date", "value date", "posting date", "transaction datetime"],
  description: ["description", "particulars", "narration", "transaction details", "remarks", "details"],
  debit: ["debit", "debit amount", "withdrawal", "withdrawal amount", "paid out", "dr amount"],
  credit: ["credit", "credit amount", "deposit", "deposit amount", "paid in", "cr amount"],
  amount: ["amount", "transaction amount", "txn amount"],
  direction: ["type", "transaction type", "dr cr", "debit credit", "cr dr"],
  balance: ["balance", "closing balance", "running balance", "available balance"],
  reference: ["reference", "reference number", "ref no", "ref number", "transaction id", "txn id", "utr", "cheque number"],
};

const ALIAS_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalizeHeader(alias), field])
  )
);

export function normalizeHeader(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function parseStatementDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, yearText, monthText, dayText, hour = "0", minute = "0", second = "0"] = match;
    return checkedDate(+yearText, +monthText, +dayText, +hour, +minute, +second);
  }

  match = text.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9}|\d{1,2})[-/. ](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (!match) return null;
  const [, dayText, monthText, yearText, hourText = "0", minute = "0", second = "0", meridiem] = match;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(monthText)
    ? Number(monthText)
    : monthNames.findIndex((name) => name === monthText.slice(0, 3).toLowerCase()) + 1;
  let year = Number(yearText);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  let hour = Number(hourText);
  if (meridiem?.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (meridiem?.toUpperCase() === "AM" && hour === 12) hour = 0;
  return checkedDate(year, month, Number(dayText), hour, Number(minute), Number(second));
}

function checkedDate(year, month, day, hour, minute, second) {
  if (
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

export function parseStatementMoney(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const paise = Math.round(Math.abs(value) * 100);
    return Number.isSafeInteger(paise) ? { paise, negative: value < 0 } : null;
  }
  let text = String(value ?? "").trim();
  if (!text || /^[-–—]+$/.test(text)) return null;
  const negative = /^\s*\(.*\)\s*$/.test(text) || /^\s*-/.test(text) || /\bDR\b/i.test(text);
  text = text.replace(/[₹$,\s]/g, "").replace(/^INR/i, "").replace(/[()]/g, "").replace(/(?:CR|DR)$/i, "");
  if (!/^\+?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/^\+/, "").split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? { paise, negative } : null;
}

function cellText(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object" && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text || "").join("");
  }
  return "";
}

function findHeader(rows, mapping) {
  if (mapping?.headerRow != null) {
    const rowIndex = mapping.headerRow - 1;
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
      throw ApiError.badRequest("mapping.headerRow must identify a row in the statement");
    }
    return { rowIndex, columns: mapColumns(rows[rowIndex], mapping) };
  }

  let best = null;
  const scanLength = Math.min(rows.length, 30);
  for (let rowIndex = 0; rowIndex < scanLength; rowIndex += 1) {
    const columns = mapColumns(rows[rowIndex], mapping);
    const score = Object.values(columns).filter((index) => index != null).length;
    const hasMoney = columns.debit != null || columns.credit != null || columns.amount != null;
    if (columns.date != null && hasMoney && (!best || score > best.score)) {
      best = { rowIndex, columns, score };
    }
  }
  if (!best) {
    throw ApiError.badRequest(
      "Could not identify transaction date and debit/credit or amount columns; provide a column mapping"
    );
  }
  return best;
}

function mapColumns(header, mapping) {
  const normalizedHeaders = header.map((value) => normalizeHeader(cellText(value)));
  const columns = {};
  for (const [field, mappedHeader] of Object.entries(mapping || {})) {
    if (field === "headerRow") continue;
    const index = normalizedHeaders.indexOf(normalizeHeader(mappedHeader));
    if (index < 0) throw ApiError.badRequest(`Mapped ${field} column "${mappedHeader}" was not found`);
    columns[field] = index;
  }
  for (let index = 0; index < normalizedHeaders.length; index += 1) {
    const field = ALIAS_LOOKUP.get(normalizedHeaders[index]);
    if (field && columns[field] == null) columns[field] = index;
  }
  return columns;
}

function getValue(row, columns, field) {
  return columns[field] == null ? null : cellText(row[columns[field]]);
}

function parseDirection(value, negative = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (/\b(debit|withdrawal|withdraw|dr|paid out)\b/.test(text)) return "debit";
  if (/\b(credit|deposit|cr|paid in)\b/.test(text)) return "credit";
  if (negative) return "debit";
  return null;
}

export function normalizeStatementRows(rows, { mapping, maxRows = MAX_STATEMENT_ROWS } = {}) {
  if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest("Statement contains no readable rows");
  if (rows.length > maxRows + 30) throw ApiError.badRequest(`Statement exceeds the ${maxRows}-row limit`);
  if (rows.some((row) => row.length > MAX_STATEMENT_COLUMNS)) {
    throw ApiError.badRequest(`Statement exceeds the ${MAX_STATEMENT_COLUMNS}-column limit`);
  }

  const { rowIndex, columns } = findHeader(rows, mapping);
  if (columns.date == null || (columns.debit == null && columns.credit == null && columns.amount == null)) {
    throw ApiError.badRequest("Statement mapping must include a transaction date and debit, credit, or amount column");
  }

  const drafts = [];
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row?.some((value) => String(cellText(value) ?? "").trim())) continue;
    if (drafts.length >= maxRows) throw ApiError.badRequest(`Statement exceeds the ${maxRows}-transaction limit`);

    const rawDebit = getValue(row, columns, "debit");
    const rawCredit = getValue(row, columns, "credit");
    const rawAmount = getValue(row, columns, "amount");
    const debit = parseStatementMoney(rawDebit);
    const credit = parseStatementMoney(rawCredit);
    const amount = parseStatementMoney(rawAmount);
    const errors = [];
    let amountPaise = null;
    let direction = null;

    if (debit?.paise && credit?.paise) {
      errors.push("Both debit and credit amounts are present");
    } else if (debit?.paise) {
      amountPaise = debit.paise;
      direction = "debit";
    } else if (credit?.paise) {
      amountPaise = credit.paise;
      direction = "credit";
    } else if (amount?.paise) {
      amountPaise = amount.paise;
      direction = parseDirection(getValue(row, columns, "direction"), amount.negative);
      if (!direction) errors.push("Transaction direction could not be determined");
    } else {
      errors.push("A valid debit or credit amount is required");
    }

    const date = parseStatementDate(getValue(row, columns, "date"));
    if (!date) errors.push("A valid transaction date is required");
    const description = String(getValue(row, columns, "description") ?? "").trim().slice(0, 300) || null;
    const reference = String(getValue(row, columns, "reference") ?? "").trim().slice(0, 100) || null;
    const balanceValue = parseStatementMoney(getValue(row, columns, "balance"));

    drafts.push({
      rowNumber: index + 1,
      txnDate: date,
      description,
      amountPaise,
      direction,
      transactionType: direction === "debit" ? "expense" : direction === "credit" ? "income" : null,
      referenceNumber: reference,
      balancePaise: balanceValue?.paise ?? null,
      duplicateStatus: "none",
      duplicateMatches: [],
      reviewStatus: "pending",
      validationErrors: errors,
    });
  }
  if (!drafts.length) throw ApiError.badRequest("Statement header was found but no transaction rows were readable");
  return drafts;
}

export function inferStatementColumns(header) {
  return mapColumns(header, {});
}
