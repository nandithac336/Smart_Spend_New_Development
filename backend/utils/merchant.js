import crypto from "crypto";

// "Raju  Tea Stall!" -> "raju tea stall"  (used later for merchant memory and duplicate checks)
export const toMerchantKey = (name) =>
  (name || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

export const makeDedupeHash = ({ userId, merchantKey, amount, txnDate }) => {
  const day = new Date(txnDate).toISOString().slice(0, 10);
  return crypto.createHash("sha1").update(`${userId}|${merchantKey}|${amount}|${day}`).digest("hex");
};
