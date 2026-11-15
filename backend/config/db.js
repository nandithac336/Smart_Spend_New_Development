
import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

// Use working DNS resolvers for MongoDB Atlas SRV lookup.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URI);
  process.stdout.write("MongoDB connected\n");
}
