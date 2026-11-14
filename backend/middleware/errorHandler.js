import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

export const notFound = (req, res) =>
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });

export const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong";
  let details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = "VALIDATION_ERROR"; message = `Invalid ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400; code = "VALIDATION_ERROR"; message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err?.code === 11000) {
    status = 409; code = "CONFLICT"; message = "A record with these details already exists";
  } else if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    status = 401; code = "UNAUTHORIZED"; message = "Invalid or expired token";
  } else if (err?.type === "entity.parse.failed") {
    status = 400; code = "VALIDATION_ERROR"; message = "Request body is not valid JSON";
  } else if (err?.type === "entity.too.large") {
    status = 413; code = "PAYLOAD_TOO_LARGE"; message = "Request body must be 1 MB or smaller";
  }

  if (status === 500) {
    if (env.NODE_ENV === "production") {
      process.stderr.write(`${JSON.stringify({
        event: "api_error",
        errorName: err?.name || "Error",
        errorCode: err?.code || "INTERNAL_ERROR",
        method: req.method,
        route: req.route?.path || "unmatched",
      })}\n`);
      message = "Something went wrong";
    } else {
      process.stderr.write(`${JSON.stringify({
        event: "api_error",
        errorName: err?.name || "Error",
        errorCode: err?.code || "INTERNAL_ERROR",
        method: req.method,
        route: req.route?.path || "unmatched",
      })}\n`);
      message = err?.message || message;
    }
  }

  res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });
};
