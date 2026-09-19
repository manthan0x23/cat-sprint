// `npm run users`: opens the local admin users page, starting `next dev` first if it isn't running.
// The page lives inside the app (src/app/admin/users) so it shares the app's DB connection.
import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? 3000);
const url = `http://localhost:${port}/admin/users`;

const up = () => fetch(`http://localhost:${port}/`, { redirect: "manual" }).then(() => true, () => false);

function open(target: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  console.log(`users: ${target}`);
}

async function main() {
  if (await up()) return open(url);
  console.log(`users: starting next dev on :${port}…`);
  const dev = spawn("npx", ["next", "dev", "-p", String(port)], { stdio: "inherit", shell: process.platform === "win32" });
  dev.on("exit", (code) => process.exit(code ?? 0));
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await up()) return open(url);
  }
  console.error("users: dev server didn't come up in 2 minutes");
}

main();
