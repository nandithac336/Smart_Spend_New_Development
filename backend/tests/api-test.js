import { once } from "node:events";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MongoBinary, MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_api_smoke_never_connect";
process.env.JWT_SECRET = "api_smoke_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "api_smoke_refresh_secret_value_123456";

const { default: app } = await import("../app.js");

let mongo;
let server;
let baseUrl;

before(async () => {
  await MongoBinary.getPath();
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      });
    }
  } finally {
    try {
      await mongoose.disconnect();
    } finally {
      if (mongo) await mongo.stop();
    }
  }
});

test("backend health endpoint returns the healthy status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, status: "ok" });
});

test("database health endpoint reports the connected database", async () => {
  const response = await fetch(`${baseUrl}/api/health/db`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, database: "connected" });
});
