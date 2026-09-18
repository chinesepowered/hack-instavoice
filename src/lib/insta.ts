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
  isDefault?: boolean;
};

export type InstaService = {
  type: string;
  name: string;
  region?: string;
  url?: string;
  status?: string;
};

export type InstaInfra = {
  configured: boolean;
  project?: string;
  branch?: string;
  region?: string;
  services: InstaService[];
  branches: InstaBranch[];
  error?: string;
};

/**
 * On Windows the global CLI is a `.CMD` shim, which `execFile` will not resolve
 * without a shell — hence `spawn insta ENOENT` even when it works in a terminal.
 * `INSTA_BIN` overrides the lookup entirely.
 */
const BIN = process.env.INSTA_BIN ?? "insta";
const useShell = process.platform === "win32";

let loggedIn: Promise<void> | null = null;
async function ensureLogin() {
  if (!instaConfigured()) throw new Error("INSTA_API_KEY is not set");
  loggedIn ??= run(BIN, ["login", "--api-key", process.env.INSTA_API_KEY!], {
    timeout: 25_000,
    shell: useShell,
  }).then(() => undefined);
  return loggedIn;
}

async function insta(args: string[], timeout = 45_000): Promise<string> {
  await ensureLogin();
  const { stdout } = await run(BIN, args, {
    timeout,
    shell: useShell,
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    // The CLI occasionally prints a hint line after the JSON body.
    const start = text.search(/[[{]/);
    return start === -1 ? fallback : (JSON.parse(text.slice(start)) as T);
  } catch {
    return fallback;
  }
}

/** Branch names must be filesystem- and DNS-safe. */
export function branchNameFor(learnerId: string) {
  return `learner-${learnerId.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export async function createLearnerBranch(
  learnerId: string,
): Promise<string | null> {
  if (!instaConfigured()) return null;
  const name = branchNameFor(learnerId);
  try {
    await insta(["branch", "create", name], 30_000);
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
    // `branch delete` takes the name only — there is no confirmation flag.
    await insta(["branch", "delete", name], 30_000);
  } catch (err) {
    console.error("[insta] branch delete failed:", (err as Error).message);
  }
}

type RawService = {
  type?: string;
  name?: string;
  region?: string;
  domain?: string | null;
  status?: string;
};

type RawBranch = {
  name?: string;
  created_at?: string;
  is_default?: boolean;
};

type RawStatus = {
  project?: { projectId?: string; name?: string; branch?: string };
};

export async function infra(): Promise<InstaInfra> {
  if (!instaConfigured()) {
    return { configured: false, services: [], branches: [] };
  }
  try {
    // This CLI has no `manifest` command — compose the view from the pieces.
    const [statusOut, servicesOut, branchOut] = await Promise.all([
      insta(["status", "--json"], 20_000).catch(() => "{}"),
      insta(["services", "list", "--json"], 20_000).catch(() => "[]"),
      insta(["branch", "list", "--json"], 20_000).catch(() => "[]"),
    ]);

    const status = parseJson<RawStatus>(statusOut, {});
    const services = parseJson<RawService[]>(servicesOut, []);
    const branches = parseJson<RawBranch[]>(branchOut, []);

    return {
      configured: true,
      project: status.project?.name ?? status.project?.projectId,
      branch: status.project?.branch,
      region:
        services.find((s) => s.region)?.region ?? process.env.INSTA_REGION,
      services: services.map((s) => ({
        type: s.type ?? "service",
        name: s.name ?? "—",
        region: s.region,
        url: s.domain ?? undefined,
        status: s.status,
      })),
      branches: branches.map((b) => ({
        name: b.name ?? "—",
        createdAt: b.created_at,
        isDefault: b.is_default,
      })),
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
