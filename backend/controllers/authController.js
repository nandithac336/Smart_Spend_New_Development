import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

async function issueTokens(user) {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, userType } = req.validated.body;

  if (await User.exists({ email })) throw ApiError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, phone, passwordHash, userType });

  // Every new user starts with a default cash wallet so they can add an expense immediately.
  await Wallet.create({ userId: user._id, name: "Cash", type: "cash", isDefault: true });

  const tokens = await issueTokens(user);
  res.status(201).json({ success: true, data: { user, ...tokens } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email }).select("+passwordHash");

  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized("Invalid email or password");

  const tokens = await issueTokens(user);
  res.json({ success: true, data: { user, ...tokens } });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.validated.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
    if (user) {
      // A reused or unknown refresh token: sign the user out everywhere to be safe.
      user.refreshTokenHash = undefined;
      await user.save();
    }
    throw ApiError.unauthorized("Invalid refresh token");
  }

  const tokens = await issueTokens(user); // rotation: the old refresh token stops working
  res.json({ success: true, data: tokens });
});

export const logout = asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save();
  res.json({ success: true, message: "Logged out" });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { settings, ...rest } = req.validated.body;
  const update = { ...rest };
  if (settings) {
    for (const [key, value] of Object.entries(settings)) update[`settings.${key}`] = value;
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true });
  res.json({ success: true, data: { user } });
});
