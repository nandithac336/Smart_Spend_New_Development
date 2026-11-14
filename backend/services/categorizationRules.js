import { toMerchantKey } from "../utils/merchant.js";

const RULES = [
  {
    type: "expense",
    categoryNames: ["Food", "Groceries"],
    merchants: ["swiggy", "zomato", "dominos", "mcdonalds"],
    keywords: ["restaurant", "food delivery", "dining"],
  },
  {
    type: "expense",
    categoryNames: ["Groceries", "Food"],
    merchants: ["bigbasket", "blinkit", "zepto", "dmart"],
    keywords: ["grocery", "groceries", "supermarket"],
  },
  {
    type: "expense",
    categoryNames: ["Transport"],
    merchants: ["uber", "ola", "rapido"],
    keywords: ["metro card", "bus pass", "fuel", "petrol", "diesel", "taxi"],
  },
  {
    type: "expense",
    categoryNames: ["Shopping"],
    merchants: ["amazon", "flipkart", "myntra"],
    keywords: ["shopping", "online order"],
  },
  {
    type: "expense",
    categoryNames: ["Entertainment", "Subscriptions"],
    merchants: ["netflix", "spotify", "hotstar"],
    keywords: ["movie ticket", "streaming subscription"],
  },
  {
    type: "expense",
    categoryNames: ["Bills"],
    merchants: [],
    keywords: ["electricity bill", "water bill", "gas bill", "internet bill", "mobile bill", "utility bill"],
  },
  {
    type: "expense",
    categoryNames: ["Education"],
    merchants: [],
    keywords: ["college fees", "school fees", "tuition fee", "education fee"],
  },
  {
    type: "expense",
    categoryNames: ["Health"],
    merchants: ["apollo pharmacy", "pharmeasy", "1mg"],
    keywords: ["pharmacy", "medicine", "hospital", "clinic"],
  },
  {
    type: "income",
    categoryNames: ["Salary"],
    merchants: [],
    keywords: ["salary", "payroll"],
  },
  {
    type: "income",
    categoryNames: ["Refund"],
    merchants: [],
    keywords: ["refund", "reversal"],
  },
  {
    type: "income",
    categoryNames: ["Freelance"],
    merchants: [],
    keywords: ["freelance payment", "project payment"],
  },
];

const normalize = (value) => toMerchantKey(value).replace(/\s+/g, " ").trim();
const includesPhrase = (text, phrase) => ` ${text} `.includes(` ${normalize(phrase)} `);

function findCategory(categories, names) {
  const targets = names.map(normalize);
  return categories.find((category) => targets.includes(normalize(category.name))) ?? null;
}

export function findKeywordCategory({ merchant, description, transactionType, categories }) {
  const normalizedMerchant = normalize(merchant);
  const normalizedDescription = normalize(description);
  const combined = `${normalizedMerchant} ${normalizedDescription}`.trim();

  for (const rule of RULES) {
    if (rule.type !== transactionType) continue;
    const category = findCategory(categories, rule.categoryNames);
    if (!category) continue;
    if (rule.merchants.some((name) => includesPhrase(normalizedMerchant, name))) {
      return {
        category,
        confidence: 0.93,
        source: "keyword_rule",
        explanation: "Merchant matched a built-in categorization rule.",
      };
    }
    if (rule.keywords.some((keyword) => includesPhrase(combined, keyword))) {
      return {
        category,
        confidence: 0.87,
        source: "keyword_rule",
        explanation: "Description matched a built-in categorization keyword.",
      };
    }
  }
  return null;
}

export function confidenceLevel(confidence) {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
