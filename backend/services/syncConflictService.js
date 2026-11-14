export function makeSyncConflict(code, message, serverData = null) {
  return {
    code,
    message,
    serverVersion: serverData?.updatedAt || null,
    serverData,
  };
}

export function sameSyncVersion(serverUpdatedAt, clientUpdatedAt) {
  return serverUpdatedAt instanceof Date
    && clientUpdatedAt instanceof Date
    && serverUpdatedAt.getTime() === clientUpdatedAt.getTime();
}

export function operationFingerprint(operation, createHash) {
  const normalize = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, normalize(value[key])])
      );
    }
    return value;
  };
  return createHash("sha256").update(JSON.stringify(normalize(operation))).digest("hex");
}
