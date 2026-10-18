import { ApiError } from "../utils/apiError.js";

// validate({ body, query, params }) -> results land in req.validated.{body,query,params}
export const validate = (schemas) => (req, _res, next) => {
  const out = {};
  for (const key of ["params", "query", "body"]) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(key === "body" ? (req.body ?? {}) : req[key]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return next(ApiError.badRequest("Validation failed", details));
    }
    out[key] = result.data;
  }
  req.validated = out;
  next();
};
