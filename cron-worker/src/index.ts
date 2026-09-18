// Free cron for CAT Sprint: Cloudflare calls this every 30 min, it pings the app's tick endpoint.
// The app decides what (if anything) to send; this worker only keeps time.

interface Env {
  APP_URL: string; // e.g. https://cat-sprint.vercel.app
  CRON_SECRET: string; // wrangler secret put CRON_SECRET (same value as on Vercel)
}

async function tick(env: Env) {
  const res = await fetch(`${env.APP_URL.replace(/\/$/, "")}/api/cron/tick`, {
    method: "POST",
    headers: { "x-cron-secret": env.CRON_SECRET },
  });
  const body = await res.text();
  console.log(`tick ${res.status}: ${body.slice(0, 300)}`);
  if (!res.ok) throw new Error(`tick failed: ${res.status}`);
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(tick(env));
  },
  // Manual trigger for testing: GET /?secret=<CRON_SECRET>
  async fetch(req: Request, env: Env) {
    if (new URL(req.url).searchParams.get("secret") !== env.CRON_SECRET) return new Response("not found", { status: 404 });
    await tick(env);
    return new Response("ticked");
  },
} satisfies ExportedHandler<Env>;
