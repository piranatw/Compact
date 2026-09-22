// Local stand-in for Supabase Cron: invokes the protected reminders job every
// five minutes, the same way a hosted cron scheduler would in production.
// Run alongside `next dev`/`next start` with `npm run scheduler`.
import "dotenv/config";
import cron from "node-cron";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.SCHEDULER_BASE_URL ?? `http://localhost:${PORT}`;
const SECRET = process.env.SCHEDULER_SECRET;

if (!SECRET) {
  console.error("SCHEDULER_SECRET is not set; refusing to start.");
  process.exit(1);
}

async function runOnce() {
  try {
    const res = await fetch(`${BASE_URL}/api/jobs/reminders`, {
      method: "POST",
      headers: { "x-scheduler-secret": SECRET! },
    });
    const body = await res.json();
    console.log(new Date().toISOString(), res.status, JSON.stringify(body));
  } catch (err) {
    console.error(new Date().toISOString(), "scheduler request failed", err);
  }
}

cron.schedule("*/5 * * * *", runOnce);
console.log(`Local reminder scheduler started against ${BASE_URL}, every 5 minutes.`);
runOnce();
