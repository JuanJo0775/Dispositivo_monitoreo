// Harness adapter for OpenCode V2: file and shell tools are judged by .harness/bin/harness.mjs before they run (ADR 0007),
// and at turn end changes not verified reopen the turn once (ADR 0009).
// A deny throws; an ask waits for the permission step of the same call; any failure of the guard blocks.
import { spawn } from "node:child_process";
import path from "node:path";

const GUARDED = new Set(["shell", "bash", "read", "write", "edit", "patch", "apply_patch", "grep", "glob"]);
// Tools seen reaching permission.evaluate; an ask on any other is a deny, so it is never lost
const ASKABLE = new Set(["shell", "bash", "read", "write", "edit"]);
const LIMIT_MS = 15_000;

/** Runs a bundle command as a child process: node from the PATH, since OpenCode itself does not run on Node. */
function harness(dir, args, payload) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    let timer;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    let child;
    try {
      child = spawn("node", [path.join(dir, ".harness", "bin", "harness.mjs"), ...args, "--agent", "opencode"], { cwd: dir, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    } catch (e) {
      return resolve({ failed: e.code || e.message });
    }
    timer = setTimeout(() => {
      child.kill();
      finish({ failed: "timed out" });
    }, LIMIT_MS);
    child.on("error", (e) => finish({ failed: e.code || e.message }));
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => {
      if (code !== 0) return finish({ failed: `exit ${code}` });
      try {
        finish(JSON.parse(out));
      } catch {
        finish({ failed: "unreadable answer" });
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

const message = (v) => `harness: ${v.reason}${v.alternative ? ` — ${v.alternative}` : ""}`;

export default {
  id: "harness.guard",
  async setup(ctx) {
    const dir = ctx.location?.directory || process.cwd();
    const asks = new Map();
    ctx.tool.hook("execute.before", async (event) => {
      if (!GUARDED.has(event.tool)) return;
      const v = await harness(dir, ["guard"], { tool: event.tool, input: event.input, cwd: dir });
      if (v.failed || !v.decision) throw new Error(`harness: the guard failed (${v.failed || "no decision"}); blocked. Run: node .harness/bin/harness.mjs doctor`);
      if (v.decision === "deny" || (v.decision === "ask" && (!ASKABLE.has(event.tool) || !event.id))) throw new Error(message(v));
      if (v.decision === "ask") asks.set(event.id, message(v));
    });
    ctx.permission.hook("evaluate", async (event) => {
      const id = event.source?.id;
      if (!id || !asks.has(id)) return;
      event.effect = "ask";
      event.message = asks.get(id);
      asks.delete(id);
    });
    // Compaction (ADR 0015): the summary request carries the task state, bounded, so the agent resumes from it.
    // Any failure leaves the request as it was: a compaction is never broken by the harness
    // The hook API is not verified live: a registration that throws or rejects must never take the guard with it
    if (typeof ctx.session?.hook === "function") {
      try {
        const r = ctx.session.hook("compaction", async (event) => {
          try {
            const s = event.system;
            // Only shapes we know; anything else (an object, a list of parts) is left exactly as it was
            const known = s == null || typeof s === "string" || (Array.isArray(s) && s.every((x) => typeof x === "string"));
            if (!known) return;
            const v = await harness(dir, ["resume", "--json"], {});
            if (v.failed || typeof v.text !== "string" || !v.text) return;
            if (Array.isArray(s)) s.push(v.text);
            else event.system = s ? `${s}\n\n${v.text}` : v.text;
          } catch {
            // nothing to add
          }
        });
        if (typeof r?.catch === "function") r.catch(() => {});
      } catch {
        // no compaction hook in this OpenCode: the guard runs as before
      }
    }
    // Turn end (ADR 0009): changes not covered by a passing verify reopen the turn once; any failure stays silent
    if (typeof ctx.event?.subscribe === "function" && typeof ctx.session?.prompt === "function") {
      (async () => {
        try {
          for await (const ev of ctx.event.subscribe({})) {
            if (ev?.type !== "session.execution.succeeded") continue;
            const sessionID = ev.durable?.aggregateID;
            const v = await harness(dir, ["stop"], {});
            if (sessionID && v.block && v.reason) await ctx.session.prompt({ sessionID, text: v.reason }).catch(() => {});
          }
        } catch {
          // the event stream closed: nothing to stop
        }
      })();
    }
  },
};
