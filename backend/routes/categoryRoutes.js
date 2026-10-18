import { Router } from "express";
import { createCategory, deleteCategory, listCategories } from "../controllers/categoryController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCategorySchema, idParam, listCategoriesQuery } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: listCategoriesQuery }), listCategories);
router.post("/", validate({ body: createCategorySchema }), createCategory);
router.delete("/:id", validate({ params: idParam }), deleteCategory);

export default router;
