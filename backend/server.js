import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { seedDefaultCategories } from "./utils/seedCategories.js";
import app from "./app.js";

async function start() {
  await connectDB();
  await seedDefaultCategories();
  app.listen(env.PORT, () => console.log(`Smart Spend API running on http://localhost:${env.PORT}`));
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
