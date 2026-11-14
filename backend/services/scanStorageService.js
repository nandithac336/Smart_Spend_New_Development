import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function assertStorageParts(userId, fileId, extension) {
  if (!/^[a-f0-9]{24}$/i.test(String(userId))) throw new TypeError("Invalid user identifier");
  if (!/^[a-f0-9-]{36}$/i.test(fileId)) throw new TypeError("Invalid scan file identifier");
  if (!Object.values(MIME_EXTENSIONS).includes(extension)) throw new TypeError("Invalid image extension");
}

function createLocalPrivateStorage(rootDirectory = env.SCAN_STORAGE_DIR) {
  const root = path.resolve(rootDirectory);

  function filePath(userId, fileId, extension) {
    assertStorageParts(userId, fileId, extension);
    const resolved = path.resolve(root, String(userId), `${fileId}.${extension}`);
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new TypeError("Invalid storage key");
    return resolved;
  }

  return {
    async put({ userId, fileId, mimeType, buffer }) {
      const extension = MIME_EXTENSIONS[mimeType];
      if (!extension) throw new TypeError("Unsupported image type");
      const destination = filePath(userId, fileId, extension);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
      return `${userId}/${fileId}.${extension}`;
    },
    async get({ storageKey, userId }) {
      const [keyUserId, filename] = storageKey.split("/");
      const match = /^([a-f0-9-]{36})\.(jpg|png|webp)$/i.exec(filename || "");
      if (keyUserId !== String(userId) || !match) throw new TypeError("Invalid storage key");
      return readFile(filePath(keyUserId, match[1], match[2]));
    },
    async delete({ storageKey, userId }) {
      const [keyUserId, filename] = storageKey.split("/");
      const match = /^([a-f0-9-]{36})\.(jpg|png|webp)$/i.exec(filename || "");
      if (keyUserId !== String(userId) || !match) throw new TypeError("Invalid storage key");
      try {
        await unlink(filePath(keyUserId, match[1], match[2]));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}

let storage = createLocalPrivateStorage();

export function getScanStorage() {
  return storage;
}

export function configureScanStorage(adapter) {
  if (!adapter || !["put", "get", "delete"].every((method) => typeof adapter[method] === "function")) {
    throw new TypeError("Storage adapter must implement put, get, and delete");
  }
  storage = adapter;
}

export function resetScanStorage() {
  storage = createLocalPrivateStorage();
}

export { createLocalPrivateStorage };
