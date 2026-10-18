import { Router } from "express";
import { getMe, login, logout, refresh, register, updateMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, refreshSchema, registerSchema, updateMeSchema } from "../validators/schemas.js";

const router = Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), register);
router.post("/login", authLimiter, validate({ body: loginSchema }), login);
router.post("/refresh", authLimiter, validate({ body: refreshSchema }), refresh);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, validate({ body: updateMeSchema }), updateMe);

export default router;
