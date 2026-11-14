import { Router } from "express";
import {
  confirmBankStatementImport,
  deleteBankStatementImport,
  getBankStatementImport,
  listBankStatementDrafts,
  listBankStatementImports,
  patchBankStatementDraft,
  uploadBankStatement,
} from "../controllers/statementImportController.js";
import { requireAuth } from "../middleware/auth.js";
import { receiveStatementFile } from "../middleware/statementUpload.js";
import { validate } from "../middleware/validate.js";
import {
  confirmStatementImportSchema,
  statementDraftListQuery,
  statementDraftParam,
  statementImportIdParam,
  statementImportListQuery,
  statementUploadSchema,
  updateStatementDraftSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.post("/statements", receiveStatementFile, validate({ body: statementUploadSchema }), uploadBankStatement);
router.get("/", validate({ query: statementImportListQuery }), listBankStatementImports);
router.get("/:id/transactions", validate({ params: statementImportIdParam, query: statementDraftListQuery }), listBankStatementDrafts);
router.patch("/:id/transactions/:transactionId", validate({ params: statementDraftParam, body: updateStatementDraftSchema }), patchBankStatementDraft);
router.post("/:id/confirm", validate({ params: statementImportIdParam, body: confirmStatementImportSchema }), confirmBankStatementImport);
router.get("/:id", validate({ params: statementImportIdParam }), getBankStatementImport);
router.delete("/:id", validate({ params: statementImportIdParam }), deleteBankStatementImport);

export default router;
