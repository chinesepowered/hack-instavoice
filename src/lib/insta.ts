import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * InstaCloud's standout primitive is branching: a branch clones the Postgres
 * data, the bucket, and every compute service in about a second. We give every
 * person who tries the demo their own branch, so their cloned voiceprint and
 * recordings live in an isolated database that we can throw away afterwards.
 *
 * Everything here degrades to a no-op when the CLI or token is absent, so the
 * app runs locally without an InstaCloud account.
 */

export const instaConfigured = () => Boolean(process.env.INSTA_API_KEY);

export type InstaBranch = {
  name: string;
  createdAt?: string;
  services?: string[];
};

export type InstaInfra = {
  configured: boolean;
  project?: string;
  branch?: string;
  region?: string;
  services: { type: string; name: string; url?: string }[];
  branches: InstaBranch[];
  error?: string;
};

let loggedIn: Promise<void> | null = null;
async function ensureLogin() {
  if (!instaConfigured()) throw new Error("INSTA_API_KEY is not set");
  loggedIn ??= run("insta", ["login", "--api-key", process.env.INSTA_API_KEY!], {
    timeout: 20000,
  }).then(() => undefined);
  return loggedIn;
}

async function insta(args: string[], timeout = 45000): Promise<string> {
  await ensureLogin();
  const env = { ...process.env };
  if (process.env.INSTA_PROJECT_ID) env.INSTA_PROJECT_ID = process.env.INSTA_PROJECT_ID;
  const { stdout } = await run("insta", args, { timeout, env });
  return stdout;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Branch names must be filesystem-and-DNS safe. */
export function branchNameFor(learnerId: string) {
  return `learner-${learnerId.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export async function createLearnerBranch(
  learnerId: string,
): Promise<string | null> {
  if (!instaConfigured()) return null;
  const name = branchNameFor(learnerId);
  try {
    await insta(["branch", "create", name]);
    return name;
  } catch (err) {
    // A demo must never die because infrastructure was slow.
    console.error("[insta] branch create failed:", (err as Error).message);
    return null;
  }
}

export async function deleteLearnerBranch(name: string): Promise<void> {
  if (!instaConfigured()) return;
  try {
    await insta(["branch", "delete", name, "--yes"]);
  } catch (err) {
    console.error("[insta] branch delete failed:", (err as Error).message);
  }
}

export async function infra(): Promise<InstaInfra> {
  if (!instaConfigured()) {
    return { configured: false, services: [], branches: [] };
  }
  try {
    const [manifestOut, branchOut] = await Promise.all([
      insta(["manifest", "--json"], 20000).catch(() => "{}"),
      insta(["branch", "list", "--json"], 20000).catch(() => "[]"),
    ]);
    const manifest = parseJson<{
      project?: string | { id?: string; name?: string };
      branch?: string;
      region?: string;
      services?: { type?: string; name?: string; url?: string }[];
    }>(manifestOut, {});
    const branches = parseJson<
      ({ name?: string; branch?: string; created_at?: string } | string)[]
    >(branchOut, []);

    const project =
      typeof manifest.project === "string"
        ? manifest.project
        : (manifest.project?.name ?? manifest.project?.id);

    return {
      configured: true,
      project,
      branch: manifest.branch,
      region: manifest.region ?? process.env.INSTA_REGION,
      services: (manifest.services ?? []).map((s) => ({
        type: s.type ?? "service",
        name: s.name ?? "—",
        url: s.url,
      })),
      branches: branches.map((b) =>
        typeof b === "string"
          ? { name: b }
          : { name: b.name ?? b.branch ?? "—", createdAt: b.created_at },
      ),
    };
  } catch (err) {
    return {
      configured: true,
      services: [],
      branches: [],
      error: (err as Error).message,
    };
  }
}
