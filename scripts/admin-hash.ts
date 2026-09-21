// `npm run admin:hash`: makes a strong random admin password and the ADMIN_PASSWORD_HASH to store
// in Vercel. Pass your own password as an argument to hash that instead. Nothing is written to disk.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2] ?? randomBytes(24).toString("base64url");
if (password.length < 20) {
  console.error("admin:hash: use at least 20 characters");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

console.log(`Admin password (save it in a password manager):\n  ${password}\n`);
console.log(`Vercel env var:\n  ADMIN_PASSWORD_HASH=scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
