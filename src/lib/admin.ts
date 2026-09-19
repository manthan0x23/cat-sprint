import "server-only";
import { headers } from "next/headers";

// Local-only admin: `next dev` with DEV_LOGIN=1, opened via localhost. Never true in production builds.
export async function isLocalAdmin() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") return false;
  const host = ((await headers()).get("host") ?? "").replace(/:\d+$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
