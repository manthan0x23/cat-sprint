// Applies migrations/*.sql once each, in filename order, and records them in "_migrations".
// Runs before `next build`. On Vercel it only touches the DB for production builds, so
// preview deploys never migrate the shared database.
// Statements inside a file are separated by "--> statement-breakpoint" and run in one transaction.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? "";
const dir = join(process.cwd(), "migrations");

type Runner = { query(q: string): Promise<{ name: string }[]>; apply(stmts: string[]): Promise<void>; close(): Promise<void> };

async function runner(): Promise<Runner> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(url.slice("pglite:".length));
    return {
      query: async (q) => (await pg.query<{ name: string }>(q)).rows,
      apply: async (stmts) => { await pg.transaction(async (tx) => { for (const s of stmts) await tx.exec(s); }); },
      close: () => pg.close(),
    };
  }
  const sql = neon(url);
  return {
    query: async (q) => (await sql.query(q)) as { name: string }[],
    apply: async (stmts) => { await sql.transaction(stmts.map((s) => sql.query(s))); },
    close: async () => {},
  };
}

async function main() {
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") return console.log("migrate: skipped (not a production build)");
  if (!url) throw new Error("migrate: DATABASE_URL is not set");
  const db = await runner();
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS "_migrations" ("name" text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await db.query(`SELECT "name" FROM "_migrations"`)).map((r) => r.name));
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files.filter((f) => !done.has(f))) {
      const stmts = readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      await db.apply([...stmts, `INSERT INTO "_migrations" ("name") VALUES ('${f.replace(/'/g, "''")}')`]);
      console.log(`migrate: applied ${f}`);
    }
    console.log(`migrate: up to date (${files.length} file${files.length === 1 ? "" : "s"})`);
  } finally {
    await db.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
