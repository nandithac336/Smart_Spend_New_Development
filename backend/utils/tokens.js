import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

export const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });

export const signRefreshToken = (userId) =>
  jwt.sign({ sub: String(userId), jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

// Refresh tokens are stored hashed. SHA-256 is fine here because the token is high-entropy.
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
