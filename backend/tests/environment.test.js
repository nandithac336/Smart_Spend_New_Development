import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function loadProductionEnvironment(overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://127.0.0.1:27017/smartspend",
    JWT_SECRET: "a".repeat(48),
    JWT_REFRESH_SECRET: "b".repeat(48),
    CLIENT_URL: "https://smartspend.example",
    CATEGORIZATION_AI_PROVIDER: "disabled",
    CATEGORIZATION_AI_API_KEY: "",
    ASK_SPART_AI_PROVIDER: "disabled",
    ASK_SPART_AI_API_KEY: "",
    ...overrides,
  };
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./config/env.js')"],
    { cwd: process.cwd(), env, encoding: "utf8", timeout: 10_000 }
  );
}

function runProductionScript(script, overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://127.0.0.1:27017/smartspend",
    JWT_SECRET: "a".repeat(48),
    JWT_REFRESH_SECRET: "b".repeat(48),
    CLIENT_URL: "https://smartspend.example",
    CATEGORIZATION_AI_PROVIDER: "disabled",
    ASK_SPART_AI_PROVIDER: "disabled",
    ...overrides,
  };
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
}

test("production environment rejects weak or reused JWT secrets and insecure client origins", () => {
  for (const overrides of [
    { JWT_SECRET: "short-secret" },
    { JWT_REFRESH_SECRET: "a".repeat(48) },
    { CLIENT_URL: "http://smartspend.example" },
  ]) {
    const result = loadProductionEnvironment(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid environment variables/);
  }
});

test("production trusts exactly one reverse proxy hop for client IP rate limits", () => {
  const result = runProductionScript(`
    const { default: app } = await import('./app.js');
    if (app.get('trust proxy') !== 1) process.exit(2);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Ask Spart requires its own key and HTTPS regardless of categorization provider", () => {
  const missingKey = loadProductionEnvironment({
    ASK_SPART_AI_PROVIDER: "openai-compatible",
    ASK_SPART_AI_ENDPOINT: "https://provider.example/chat",
    ASK_SPART_AI_API_KEY: "",
  });
  assert.notEqual(missingKey.status, 0);
  assert.match(missingKey.stderr, /ASK_SPART_AI_API_KEY/);

  const insecureEndpoint = loadProductionEnvironment({
    ASK_SPART_AI_PROVIDER: "openai-compatible",
    ASK_SPART_AI_ENDPOINT: "http://provider.example/chat",
    ASK_SPART_AI_API_KEY: "do-not-log-this-secret",
  });
  assert.notEqual(insecureEndpoint.status, 0);
  assert.match(insecureEndpoint.stderr, /ASK_SPART_AI_ENDPOINT/);
  assert.doesNotMatch(insecureEndpoint.stderr, /do-not-log-this-secret/);

  const valid = loadProductionEnvironment({
    ASK_SPART_AI_PROVIDER: "openai-compatible",
    ASK_SPART_AI_ENDPOINT: "https://provider.example/chat",
    ASK_SPART_AI_API_KEY: "valid-test-key",
  });
  assert.equal(valid.status, 0, valid.stderr);
});

test("Gemini Ask Spart requires a Gemini API key", () => {
  const missingKey = loadProductionEnvironment({
    ASK_SPART_AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "",
    ASK_SPART_AI_API_KEY: "",
  });
  assert.notEqual(missingKey.status, 0);
  assert.match(missingKey.stderr, /GEMINI_API_KEY/);

  const valid = loadProductionEnvironment({
    ASK_SPART_AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "test-only-gemini-key",
  });
  assert.equal(valid.status, 0, valid.stderr);
});

test("production API errors hide raw error details and query strings", () => {
  const result = runProductionScript(`
    const { errorHandler, notFound } = await import('./middleware/errorHandler.js');
    let response;
    let status;
    console.error = (...values) => { process.stdout.write(values.join(' ')); };
    const res = {
      status(value) { status = value; return this; },
      json(value) { response = value; return this; },
    };
    errorHandler(new Error('private financial payload sentinel'), {
      method: 'GET',
      route: { path: '/private/:id' },
    }, res, () => {});
    if (status !== 500 || response.error.message !== 'Something went wrong') process.exit(2);
    if (JSON.stringify(response).includes('sentinel')) process.exit(3);
    notFound({ method: 'GET', path: '/unknown', originalUrl: '/unknown?token=secret' }, res);
    if (JSON.stringify(response).includes('secret')) process.exit(4);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
