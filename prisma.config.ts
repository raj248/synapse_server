import dotenvFlow from "dotenv-flow";
import path from "path";
import { defineConfig, env } from "prisma/config";

dotenvFlow.config({
  node_env: process.env.NODE_ENV || "development",
  debug: process.env.NODE_ENV === "development",
});

export default defineConfig({
  schema: path.join(__dirname, "src", "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "src", "prisma", "migrations"),
    seed: `ts-node ./src/prisma/seed.ts`, // Or 'ts-node prisma/seed.ts' if using ts-node
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
