import { asyncHandler } from "../utils/asyncHandler.js";
import {
  confirmStatementImport,
  createStatementImport,
  deleteStatementImport,
  getOwnedStatementImport,
  listStatementDrafts,
  listStatementImports,
  updateStatementDraft,
} from "../services/statementImportService.js";

export const uploadBankStatement = asyncHandler(async (req, res) => {
  const record = await createStatementImport({
    user: req.user,
    file: req.file,
    ...req.validated.body,
  });
  res.status(201).json({ success: true, data: record });
});

export const listBankStatementImports = asyncHandler(async (req, res) => {
  const result = await listStatementImports(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getBankStatementImport = asyncHandler(async (req, res) => {
  const record = await getOwnedStatementImport(req.user._id, req.validated.params.id);
  res.json({ success: true, data: record });
});

export const listBankStatementDrafts = asyncHandler(async (req, res) => {
  const result = await listStatementDrafts(
    req.user._id,
    req.validated.params.id,
    req.validated.query
  );
  res.json({ success: true, ...result });
});

export const patchBankStatementDraft = asyncHandler(async (req, res) => {
  const draft = await updateStatementDraft(
    req.user._id,
    req.validated.params.id,
    req.validated.params.transactionId,
    req.validated.body
  );
  res.json({ success: true, data: draft });
});

export const confirmBankStatementImport = asyncHandler(async (req, res) => {
  const result = await confirmStatementImport({
    userId: req.user._id,
    importId: req.validated.params.id,
    ...req.validated.body,
  });
  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    data: result.data,
    duplicate: result.duplicate,
  });
});

export const deleteBankStatementImport = asyncHandler(async (req, res) => {
  const result = await deleteStatementImport(req.user._id, req.validated.params.id);
  res.json({ success: true, data: result });
});
