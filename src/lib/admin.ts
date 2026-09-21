import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

// Local-only admin: `next dev` with DEV_LOGIN=1, opened via localhost. Never true in production builds.
export async function isLocalAdmin() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") return false;
  const host = ((await headers()).get("host") ?? "").replace(/:\d+$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

// Production admin: unlock with the admin password (checked against ADMIN_PASSWORD_HASH, made by
// `npm run admin:hash`). Unlocking sets a short-lived HMAC-signed cookie. No hash set = nobody is admin.
export const ADMIN_COOKIE = "cs_admin";
export const ADMIN_TTL_S = 8 * 60 * 60;

function sign(exp: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`admin:${exp}`).digest("base64url");
}

export function adminToken() {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL_S;
  return `${exp}.${sign(exp)}`;
}

function validToken(token: string | undefined) {
  const [expRaw, mac] = (token ?? "").split(".");
  const exp = Number(expRaw);
  if (!mac || !Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(mac);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Format: scrypt$<salt b64url>$<hash b64url>. */
export function checkAdminPassword(password: string) {
  const [alg, salt, hash] = (process.env.ADMIN_PASSWORD_HASH ?? "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = scryptSync(password, Buffer.from(salt, "base64url"), want.length, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(got, want);
}

/** Unlocked with the admin password (or the local dev admin). */
export async function isAdmin() {
  if (await isLocalAdmin()) return true;
  return validToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
