const MONEY_PATTERN = String.raw`(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;

function moneyToPaise(value) {
  if (!value) return null;
  const normalized = value.replace(/[,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [rupees, fraction = ""] = normalized.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

function findAmount(text, labels) {
  const labelPattern = new RegExp(
    `(?:${labels})\\s*[:\\-]?\\s*(?:₹|Rs\\.?|INR)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)`,
    "i"
  );
  const labeled = text.match(labelPattern);
  if (labeled) return moneyToPaise(labeled[1]);
  const currencyMatch = text.match(new RegExp(MONEY_PATTERN, "i"));
  return currencyMatch ? moneyToPaise(currencyMatch[1]) : null;
}

function parseDate(text) {
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?/i);
  if (!match) {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!iso) return null;
    const [, year, month, day, hour = "00", minute = "00"] = iso;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+05:30`);
  }
  const [, dayText, monthText, yearText, hourText, minuteText, meridiem] = match;
  let year = Number(yearText);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  let hour = Number(hourText || "0");
  if (meridiem?.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (meridiem?.toUpperCase() === "AM" && hour === 12) hour = 0;
  const day = Number(dayText);
  const month = Number(monthText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, Number(minuteText || "0")) - 330 * 60_000);
  const check = new Date(date.getTime() + 330 * 60_000);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return date;
}

function parseItems(text) {
  return text.split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(new RegExp(`^(.{2,80}?)\\s+(?:₹|Rs\\.?|INR)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)$`, "i"));
      if (!match || /total|tax|gst|subtotal|change|cash|paid/i.test(match[1])) return null;
      const amountPaise = moneyToPaise(match[2]);
      return amountPaise ? { name: match[1].trim(), amountPaise } : null;
    })
    .filter(Boolean)
    .slice(0, 100);
}

function extractMerchant(text) {
  const explicit = text.match(/(?:merchant|store|restaurant|shop)\s*[:\-]\s*([^\r\n]{2,80})/i);
  if (explicit) return explicit[1].trim();
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => /^[A-Za-z][A-Za-z0-9 &'.,-]{2,60}$/.test(line)) || null;
}

function extractReference(text) {
  const match = text.match(/(?:UPI\s*(?:ref(?:erence)?|transaction)?\s*(?:id|no\.?)?|UTR|RRN|reference\s*(?:id|no\.?)?)\s*[:#\-]?\s*([A-Z0-9]{8,40})/i);
  return match?.[1] || null;
}

function extractPaymentStatus(text) {
  if (/\b(successful|success|completed|paid successfully)\b/i.test(text)) return "success";
  if (/\b(failed|failure|declined|unsuccessful)\b/i.test(text)) return "failed";
  if (/\b(pending|processing)\b/i.test(text)) return "pending";
  return "unknown";
}

function extractDirection(text) {
  if (/\b(received from|money received|credited to|you received)\b/i.test(text)) return "in";
  if (/\b(paid to|sent to|money sent|debited from|you paid)\b/i.test(text)) return "out";
  return null;
}

export function normalizeOcrText(type, text, providerConfidence = null) {
  const warnings = [];
  const amountPaise = findAmount(
    text,
    type === "receipt" ? "grand\\s*total|total\\s*amount|amount\\s*due|total" : "amount|paid"
  );
  const transactionDate = parseDate(text);
  const currency = /₹|\bINR\b|\bRs\.?/i.test(text) ? "INR" : null;
  const taxPaise = type === "receipt" ? findAmount(text, "tax|GST|CGST|SGST") : null;
  const merchant = extractMerchant(text);
  const paymentStatus = type === "upi" ? extractPaymentStatus(text) : null;
  const paymentDirection = type === "upi" ? extractDirection(text) : null;
  const transactionType = paymentDirection === "out" ? "expense" : paymentDirection === "in" ? "income" : null;
  const upiRef = type === "upi" ? extractReference(text) : null;

  if (!text.trim()) warnings.push("No readable text was detected");
  if (!amountPaise) warnings.push("Amount was not reliably detected; enter it before confirming");
  if (!transactionDate) warnings.push("Transaction date was not detected; enter it before confirming");
  if (!merchant) warnings.push("Merchant or recipient was not detected");
  if (type === "upi" && paymentStatus !== "success") warnings.push("Payment success was not verified; this screenshot cannot be confirmed as paid");
  if (type === "upi" && !paymentDirection) warnings.push("Payment direction could not be reliably identified; select income or expense");

  const fields = {
    merchant,
    transactionDate,
    amountPaise,
    currency,
    taxPaise,
    items: type === "receipt" ? parseItems(text) : [],
    upiRef,
    paymentStatus,
    paymentDirection,
    transactionType,
  };
  const fieldConfidence = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value == null || (Array.isArray(value) && !value.length) ? null : providerConfidence])
  );
  return {
    fields,
    confidence: { overall: providerConfidence, fields: fieldConfidence },
    warnings,
  };
}

export { moneyToPaise, parseDate };
