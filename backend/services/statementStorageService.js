import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const EXTENSIONS = ["csv", "xlsx", "pdf"];

function assertParts(userId, fileId, extension) {
  if (!/^[a-f0-9]{24}$/i.test(String(userId))) throw new TypeError("Invalid user identifier");
  if (!/^[a-f0-9-]{36}$/i.test(fileId) || !EXTENSIONS.includes(extension)) {
    throw new TypeError("Invalid statement storage identifier");
  }
}

export function createLocalStatementStorage(rootDirectory = env.STATEMENT_STORAGE_DIR) {
  const root = path.resolve(rootDirectory);

  function resolvePath(userId, fileId, extension) {
    assertParts(userId, fileId, extension);
    const resolved = path.resolve(root, String(userId), `${fileId}.${extension}`);
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new TypeError("Invalid statement storage key");
    return resolved;
  }

  return {
    async put({ userId, fileId, format, buffer }) {
      const destination = resolvePath(userId, fileId, format);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
      return `${userId}/${fileId}.${format}`;
    },
    async get({ storageKey, userId }) {
      const [ownerId, filename] = String(storageKey).split("/");
      const match = /^([a-f0-9-]{36})\.(csv|xlsx|pdf)$/i.exec(filename || "");
      if (ownerId !== String(userId) || !match) throw new TypeError("Invalid statement storage key");
      return readFile(resolvePath(ownerId, match[1], match[2]));
    },
    async delete({ storageKey, userId }) {
      const [ownerId, filename] = String(storageKey).split("/");
      const match = /^([a-f0-9-]{36})\.(csv|xlsx|pdf)$/i.exec(filename || "");
      if (ownerId !== String(userId) || !match) throw new TypeError("Invalid statement storage key");
      try {
        await unlink(resolvePath(ownerId, match[1], match[2]));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}

let storage = createLocalStatementStorage();

export function getStatementStorage() {
  return storage;
}

export function configureStatementStorage(adapter) {
  if (!adapter || !["put", "get", "delete"].every((method) => typeof adapter[method] === "function")) {
    throw new TypeError("Statement storage adapter must implement put, get, and delete");
  }
  storage = adapter;
}

export function resetStatementStorage() {
  storage = createLocalStatementStorage();
}
