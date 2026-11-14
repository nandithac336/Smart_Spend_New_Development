import { Router } from "express";
import { getSyncState, pullSync, pushSync } from "../controllers/syncController.js";
import { requireAuth } from "../middleware/auth.js";
import { syncLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { pushSyncSchema, syncPullQuery, syncStatusQuery } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth, syncLimiter);
router.post("/push", validate({ body: pushSyncSchema }), pushSync);
router.get("/pull", validate({ query: syncPullQuery }), pullSync);
router.get("/status", validate({ query: syncStatusQuery }), getSyncState);

export default router;
