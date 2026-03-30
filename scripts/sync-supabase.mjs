#!/usr/bin/env node
/**
 * Keeps the hosted Supabase DB in sync with supabase/migrations/.
 *
 * Use ONE of these (in order of preference):
 *
 * 1) DATABASE_URL, DIRECT_URL, or SUPABASE_DB_URL in .env.local
 *    → runs: supabase db push --db-url <url>
 *
 * 2) SUPABASE_ACCESS_TOKEN in .env.local (or env) + NEXT_PUBLIC_SUPABASE_URL
 *    → runs: supabase link --project-ref <ref> --yes && supabase db push --yes
 *
 * 3) Local Docker: if `docker` is available, offers `supabase start` + migration up
 *    (optional; does not run unless --local flag is passed)
 *
 * Does not print secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnvLocal() {
  if (!existsSync(envPath)) return "";
  return readFileSync(envPath, "utf8");
}

function getEnvKey(text, key) {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = text.match(re);
  if (!m) return "";
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function projectRefFromSupabaseUrl(url) {
  try {
    const host = new URL(url).hostname;
    const sub = host.replace(/\.supabase\.co$/i, "");
    if (!sub || sub.includes(".")) return "";
    return sub;
  } catch {
    return "";
  }
}

const args = process.argv.slice(2);
const wantLocal = args.includes("--local");

const text = loadEnvLocal();

const dbUrl =
  getEnvKey(text, "DATABASE_URL") ||
  getEnvKey(text, "DIRECT_URL") ||
  getEnvKey(text, "SUPABASE_DB_URL");

const accessToken =
  process.env.SUPABASE_ACCESS_TOKEN ||
  getEnvKey(text, "SUPABASE_ACCESS_TOKEN");

const publicUrl = getEnvKey(text, "NEXT_PUBLIC_SUPABASE_URL");
const projectRef =
  getEnvKey(text, "SUPABASE_PROJECT_REF") || projectRefFromSupabaseUrl(publicUrl);

function run(cmd, argv, extraEnv = {}) {
  const r = spawnSync(cmd, argv, {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...extraEnv },
  });
  return r.status === null ? 1 : r.status;
}

if (wantLocal) {
  const dockerOk = spawnSync("docker", ["version"], { stdio: "ignore" });
  if (dockerOk.status !== 0) {
    console.error(
      "Docker not found in PATH. Install Docker Desktop, then run:\n" +
        "  npx supabase start\n" +
        "  npx supabase migration up --local",
    );
    process.exit(1);
  }
  console.log("Starting local Supabase (Docker)…");
  let s = run("npx", ["supabase", "start"]);
  if (s !== 0) process.exit(s);
  console.log("Applying migrations to local DB…");
  s = run("npx", ["supabase", "migration", "up", "--local"]);
  process.exit(s);
}

if (dbUrl) {
  console.log("Using DATABASE_URL / DIRECT_URL / SUPABASE_DB_URL → db push");
  process.exit(
    run("npx", ["supabase", "db", "push", "--db-url", dbUrl, "--yes"]),
  );
}

if (accessToken && projectRef) {
  console.log(
    `Using SUPABASE_ACCESS_TOKEN + project ref ${projectRef} → link + db push`,
  );
  let s = run(
    "npx",
    ["supabase", "link", "--project-ref", projectRef, "--yes"],
    { SUPABASE_ACCESS_TOKEN: accessToken },
  );
  if (s !== 0) process.exit(s);
  s = run("npx", ["supabase", "db", "push", "--yes"], {
    SUPABASE_ACCESS_TOKEN: accessToken,
  });
  process.exit(s);
}

console.error(`
Could not sync: add one of the following to .env.local (or export in your shell):

  • DATABASE_URL=postgresql://…   (Dashboard → Project Settings → Database → URI)
    OR DIRECT_URL / SUPABASE_DB_URL

  • SUPABASE_ACCESS_TOKEN=sbp_…   (Dashboard → Account → Access tokens, or \`npx supabase login\`)
    AND ensure NEXT_PUBLIC_SUPABASE_URL is set (used to derive project ref)

Optional: SUPABASE_PROJECT_REF=pivutjovcqtbvdnbqrgh  (overrides URL parsing)

Then run:  node scripts/sync-supabase.mjs

Local Docker stack:  node scripts/sync-supabase.mjs --local
`);
process.exit(1);
