import { Router } from "express";
import { exportTransactionsCsv, exportTransactionsPdf } from "../controllers/exportController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { exportQuery, pdfReportQuery } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/transactions/csv", validate({ query: exportQuery }), exportTransactionsCsv);
router.get("/transactions/pdf", validate({ query: pdfReportQuery }), exportTransactionsPdf);

export default router;
