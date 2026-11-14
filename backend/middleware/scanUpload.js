import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
});

export function receiveScanImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "FILE_TOO_LARGE", "Image must be 5 MB or smaller"));
    }
    if (error instanceof multer.MulterError) {
      return next(ApiError.badRequest(
        error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT"
          ? "Upload one image using the image field"
          : "Upload must contain only one image file"
      ));
    }
    next(error);
  });
}
