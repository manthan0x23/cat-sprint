import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// DATABASE_URL=pglite:./.pglite → embedded Postgres (WASM) for zero-setup local dev.
// Anything else → Neon over HTTP (production / Vercel).
const url = process.env.DATABASE_URL ?? "";

function make() {
  if (url.startsWith("pglite:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const g = globalThis as unknown as { __pglite?: InstanceType<typeof PGlite> };
    if (!g.__pglite) {
      const pg = (g.__pglite = new PGlite(url.slice("pglite:".length)));
      // PGlite keeps its data dir half-written unless closed; an unclean exit (Ctrl+C) leaves it unopenable.
      const shutdown = () => { pg.close().finally(() => process.exit(0)); };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    }
    return drizzle(g.__pglite, { schema }) as unknown as ReturnType<typeof drizzleNeon<typeof schema>>;
  }
  return drizzleNeon(neon(url), { schema });
}

export const db = make();
export { schema };
