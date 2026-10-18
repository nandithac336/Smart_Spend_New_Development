import { Router } from "express";
import {
  createTransaction, deleteTransaction, getTransaction, listTransactions,
  listTrash, restoreTransaction, updateTransaction,
} from "../controllers/transactionController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createTransactionSchema, idParam, listTransactionsQuery, updateTransactionSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listTransactionsQuery }), listTransactions);
router.post("/", validate({ body: createTransactionSchema }), createTransaction);

// "/trash" must be declared before "/:id"
router.get("/trash", listTrash);

router.get("/:id", validate({ params: idParam }), getTransaction);
router.patch("/:id", validate({ params: idParam, body: updateTransactionSchema }), updateTransaction);
router.put("/:id", validate({ params: idParam, body: updateTransactionSchema }), updateTransaction);
router.delete("/:id", validate({ params: idParam }), deleteTransaction);
router.post("/:id/restore", validate({ params: idParam }), restoreTransaction);

export default router;
