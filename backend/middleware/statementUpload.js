import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 4_096 },
});

export function receiveStatementFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "FILE_TOO_LARGE", "Statement file must be 10 MB or smaller"));
    }
    if (error instanceof multer.MulterError) {
      return next(ApiError.badRequest(
        error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT"
          ? "Upload one statement using the file field"
          : "Statement upload contains too many or oversized form fields"
      ));
    }
    next(error);
  });
}
