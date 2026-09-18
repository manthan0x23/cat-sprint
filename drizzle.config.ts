import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";
const local = url.startsWith("pglite:");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(local ? { driver: "pglite" as const, dbCredentials: { url: url.slice(7) } } : { dbCredentials: { url } }),
});
