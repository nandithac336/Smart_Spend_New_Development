import { Router } from "express";
import {
  confirmUserScan,
  deleteUserScan,
  getUserScan,
  listUserScans,
  patchUserScan,
  uploadReceiptScan,
  uploadUpiScan,
} from "../controllers/scanController.js";
import { requireAuth } from "../middleware/auth.js";
import { receiveScanImage } from "../middleware/scanUpload.js";
import { validate } from "../middleware/validate.js";
import {
  confirmScanSchema,
  scanIdParam,
  scanListQuery,
  updateScanDraftSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.post("/receipt", receiveScanImage, uploadReceiptScan);
router.post("/upi", receiveScanImage, uploadUpiScan);
router.get("/", validate({ query: scanListQuery }), listUserScans);
router.get("/:id", validate({ params: scanIdParam }), getUserScan);
router.patch("/:id", validate({ params: scanIdParam, body: updateScanDraftSchema }), patchUserScan);
router.post("/:id/confirm", validate({ params: scanIdParam, body: confirmScanSchema }), confirmUserScan);
router.delete("/:id", validate({ params: scanIdParam }), deleteUserScan);

export default router;
