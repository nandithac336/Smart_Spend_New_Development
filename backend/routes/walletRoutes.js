import { Router } from "express";
import {
  archiveWallet, createWallet, listWallets, transfer, updateWallet,
} from "../controllers/walletController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createWalletSchema, idParam, listWalletsQuery, transferSchema, updateWalletSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listWalletsQuery }), listWallets);
router.post("/", validate({ body: createWalletSchema }), createWallet);
router.post("/transfer", validate({ body: transferSchema }), transfer);
router.patch("/:id", validate({ params: idParam, body: updateWalletSchema }), updateWallet);
router.delete("/:id", validate({ params: idParam }), archiveWallet);

export default router;
