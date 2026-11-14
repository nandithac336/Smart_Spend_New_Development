import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  SCAN_STORAGE_DIR: z.string().default("private/scans"),
  SCAN_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  OCR_PROVIDER: z.enum(["google-vision"]).default("google-vision"),
  OCR_API_KEY: z.string().optional(),
  OCR_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  STATEMENT_STORAGE_DIR: z.string().default("private/statements"),
  STATEMENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(90),
  CATEGORIZATION_AI_PROVIDER: z.enum(["disabled", "openai-compatible"]).default("disabled"),
  CATEGORIZATION_AI_ENDPOINT: z.string().url().default("https://api.openai.com/v1/chat/completions"),
  CATEGORIZATION_AI_API_KEY: z.string().optional(),
  CATEGORIZATION_AI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  CATEGORIZATION_AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(5000),
  ASK_SPART_AI_PROVIDER: z.enum(["disabled", "openai-compatible", "gemini"]).default("disabled"),
  ASK_SPART_AI_ENDPOINT: z.string().url().default("https://api.openai.com/v1/chat/completions"),
  ASK_SPART_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ASK_SPART_AI_MODEL: z.string().min(1).optional(),
  ASK_SPART_AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  ASK_SPART_MAX_TOKENS: z.coerce.number().int().min(64).max(1200).default(400),
});

const parsed = schema.safeParse(process.env);
const envIssues = parsed.success ? [] : [...parsed.error.issues];
if (parsed.success && parsed.data.NODE_ENV === "production") {
  for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
    if (parsed.data[key].length < 32) {
      envIssues.push({
        path: [key],
        message: "must be at least 32 characters in production",
      });
    }
  }
  if (parsed.data.JWT_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    envIssues.push({
      path: ["JWT_REFRESH_SECRET"],
      message: "must differ from JWT_SECRET",
    });
  }
  if (!parsed.data.CLIENT_URL.startsWith("https://")) {
    envIssues.push({
      path: ["CLIENT_URL"],
      message: "must use HTTPS in production",
    });
  }
}
if (parsed.success && parsed.data.CATEGORIZATION_AI_PROVIDER === "openai-compatible") {
  if (!parsed.data.CATEGORIZATION_AI_API_KEY) {
    envIssues.push({
      path: ["CATEGORIZATION_AI_API_KEY"],
      message: "is required when CATEGORIZATION_AI_PROVIDER is enabled",
    });
  }
  if (parsed.success && parsed.data.NODE_ENV === "production" && !parsed.data.CATEGORIZATION_AI_ENDPOINT.startsWith("https://")) {
    envIssues.push({
      path: ["CATEGORIZATION_AI_ENDPOINT"],
      message: "must use HTTPS in production",
    });
  }
}
if (parsed.success && parsed.data.ASK_SPART_AI_PROVIDER === "openai-compatible") {
  if (!parsed.data.ASK_SPART_AI_API_KEY) {
    envIssues.push({
      path: ["ASK_SPART_AI_API_KEY"],
      message: "is required when ASK_SPART_AI_PROVIDER is enabled",
    });
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.ASK_SPART_AI_ENDPOINT.startsWith("https://")) {
    envIssues.push({
      path: ["ASK_SPART_AI_ENDPOINT"],
      message: "must use HTTPS in production",
    });
  }
}
if (parsed.success && parsed.data.ASK_SPART_AI_PROVIDER === "gemini") {
  if (!parsed.data.GEMINI_API_KEY && !parsed.data.ASK_SPART_AI_API_KEY) {
    envIssues.push({
      path: ["GEMINI_API_KEY"],
      message: "is required when ASK_SPART_AI_PROVIDER is gemini",
    });
  }
}
if (envIssues.length) {
  const msg = envIssues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  process.stderr.write(`Invalid environment variables -> ${msg}\n`);
  process.exit(1);
}

export const env = parsed.data;
