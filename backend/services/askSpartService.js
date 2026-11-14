import { ChatConversation } from "../models/ChatConversation.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { ApiError } from "../utils/apiError.js";
import { buildFinancialContext } from "./financialContextService.js";
import { askSpartProviderStatus, generateAskSpartResponse } from "./askSpartAiProvider.js";

const HISTORY_LIMIT = 8;
const CONVERSATION_MESSAGE_LIMIT = 100;
const MAX_STORED_MESSAGES = 200;
const ASSISTANT_MESSAGE_LIMIT = 1800;

function collectVerifiedMoney(value, parentKey = "", amounts = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectVerifiedMoney(item, parentKey, amounts);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      collectVerifiedMoney(nested, key, amounts);
    }
  } else if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !/(count|percent|rate|days|percentage|year|month)/i.test(parentKey)
  ) {
    amounts.add(value);
  }
  return amounts;
}

function hasOnlyVerifiedCurrencyClaims(message, context) {
  const verified = collectVerifiedMoney(context.financialData);
  const claims = [
    ...message.matchAll(/₹\s*([\d,]+(?:\.\d{1,2})?)/g),
    ...message.matchAll(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:INR|rupees?|rs\.?)\b/gi),
  ];
  return claims.every((claim) => verified.has(Math.round(Number(claim[1].replace(/,/g, "")) * 100)));
}

function safeMessage(message) {
  return {
    id: message._id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
}

function conversationTitle(message) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 77 ? `${compact.slice(0, 77)}...` : compact;
}

async function getProviderHistory(userId, conversationId, currentMessageId) {
  const messages = await ChatMessage.find({
    userId,
    conversationId,
    _id: { $ne: currentMessageId },
  })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .select("role content")
    .lean();
  return messages.reverse().map((message) => ({
    role: message.role,
    content: message.content.slice(0, 1200),
  }));
}

export async function sendAskSpartMessage(user, { conversationId, message }) {
  let conversation;
  if (conversationId) {
    conversation = await ChatConversation.findOne({
      _id: conversationId,
      userId: user._id,
      status: "active",
    });
    if (!conversation) throw ApiError.notFound("Conversation not found");
  } else {
    conversation = await ChatConversation.create({
      userId: user._id,
      title: conversationTitle(message),
    });
  }

  const storedCount = await ChatMessage.countDocuments({ userId: user._id, conversationId: conversation._id });
  if (storedCount >= MAX_STORED_MESSAGES) {
    throw ApiError.conflict("Conversation message limit reached; start a new conversation");
  }

  const userMessage = await ChatMessage.create({
    conversationId: conversation._id,
    userId: user._id,
    role: "user",
    content: message,
  });

  const context = await buildFinancialContext(user, message);
  let answer = context.deterministicAnswer;
  let answerSource = "verified_data";
  if (
    context.intent !== "unsupported" &&
    context.intent !== "financial_health" &&
    context.financialData &&
    askSpartProviderStatus() === "ai_enabled"
  ) {
    try {
      const history = await getProviderHistory(user._id, conversation._id, userMessage._id);
      const response = await generateAskSpartResponse({ message, context, history });
      if (hasOnlyVerifiedCurrencyClaims(response.message, context)) {
        answer = response.message.slice(0, ASSISTANT_MESSAGE_LIMIT);
        answerSource = "ai_with_verified_data";
      } else {
        answerSource = "verified_data_fallback";
      }
    } catch {
      answerSource = "verified_data_fallback";
    }
  }

  const assistantMessage = await ChatMessage.create({
    conversationId: conversation._id,
    userId: user._id,
    role: "assistant",
    content: answer,
    metadata: {
      intent: context.intent,
      financialData: context.financialData,
      recommendations: context.recommendations,
    },
  });
  conversation.updatedAt = new Date();
  await conversation.save();

  return {
    conversationId: conversation._id,
    message: answer,
    financialData: context.financialData,
    recommendations: context.recommendations,
    answerSource,
    assistantMessage: safeMessage(assistantMessage),
  };
}

export async function listAskSpartConversations(userId, { page, limit, status }) {
  const filter = { userId };
  if (status) filter.status = status;
  const [conversations, total] = await Promise.all([
    ChatConversation.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ChatConversation.countDocuments(filter),
  ]);
  const ids = conversations.map((item) => item._id);
  const latestMessages = await ChatMessage.aggregate([
    { $match: { userId, conversationId: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    { $project: { _id: 1, "message.role": 1, "message.content": 1, "message.createdAt": 1 } },
  ]);
  const lastByConversation = new Map(latestMessages.map((item) => [String(item._id), item.message]));
  return {
    data: conversations.map((conversation) => ({
      ...conversation,
      lastMessage: lastByConversation.get(String(conversation._id)) || null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getAskSpartConversation(userId, conversationId) {
  const conversation = await ChatConversation.findOne({ _id: conversationId, userId }).lean();
  if (!conversation) throw ApiError.notFound("Conversation not found");
  const [messages, messageCount] = await Promise.all([
    ChatMessage.find({ userId, conversationId })
      .sort({ createdAt: -1 })
      .limit(CONVERSATION_MESSAGE_LIMIT)
      .lean(),
    ChatMessage.countDocuments({ userId, conversationId }),
  ]);
  return {
    ...conversation,
    messages: messages.reverse().map(safeMessage),
    messageCount,
    messagesTruncated: messageCount > messages.length,
  };
}

export async function renameAskSpartConversation(userId, conversationId, title) {
  const conversation = await ChatConversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { $set: { title } },
    { returnDocument: "after", runValidators: true }
  );
  if (!conversation) throw ApiError.notFound("Conversation not found");
  return conversation;
}

export async function deleteAskSpartConversation(userId, conversationId) {
  const conversation = await ChatConversation.findOneAndDelete({ _id: conversationId, userId });
  if (!conversation) throw ApiError.notFound("Conversation not found");
  await ChatMessage.deleteMany({ conversationId, userId });
  return { id: conversation._id, deleted: true };
}

export async function getAskSpartHealth() {
  return {
    assistant: "Spart",
    status: askSpartProviderStatus(),
    capabilities: ["spending", "income", "budgets", "savings_goals", "wallets", "recurring_transactions", "expense_predictions", "subscriptions", "financial_health_score"],
  };
}
