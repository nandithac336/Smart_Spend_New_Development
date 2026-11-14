import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteAskSpartConversation,
  getAskSpartConversation,
  getAskSpartHealth,
  listAskSpartConversations,
  renameAskSpartConversation,
  sendAskSpartMessage,
} from "../services/askSpartService.js";

export const chatWithAskSpart = asyncHandler(async (req, res) => {
  const data = await sendAskSpartMessage(req.user, req.validated.body);
  res.status(201).json({ success: true, data });
});

export const getAskSpartConversations = asyncHandler(async (req, res) => {
  const result = await listAskSpartConversations(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getAskSpartConversationById = asyncHandler(async (req, res) => {
  const data = await getAskSpartConversation(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});

export const patchAskSpartConversation = asyncHandler(async (req, res) => {
  const data = await renameAskSpartConversation(
    req.user._id,
    req.validated.params.id,
    req.validated.body.title
  );
  res.json({ success: true, data });
});

export const removeAskSpartConversation = asyncHandler(async (req, res) => {
  const data = await deleteAskSpartConversation(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});

export const getAskSpartStatus = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getAskSpartHealth() });
});
