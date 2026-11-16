/** Moment this API process started (one per deploy or restart). */
const STARTED_AT = new Date().toISOString();

export interface AppVersion {
  /** Short git commit of the running build ("dev" outside Render). */
  commit: string;
  branch: string | null;
  startedAt: string;
}

/**
 * Version of the running API, shown in the admin to confirm a deploy without opening Render. Render
 * fills RENDER_GIT_COMMIT and RENDER_GIT_BRANCH on every deploy from git; GIT_COMMIT covers other hosts.
 */
export function appVersion(env: NodeJS.ProcessEnv = process.env): AppVersion {
  const commit = (env.RENDER_GIT_COMMIT || env.GIT_COMMIT || "").trim();
  return {
    commit: commit ? commit.slice(0, 7) : "dev",
    branch: env.RENDER_GIT_BRANCH || null,
    startedAt: STARTED_AT,
  };
}
