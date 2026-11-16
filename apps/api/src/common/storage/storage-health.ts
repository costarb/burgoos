/**
 * Spec 030: until 2026-11-16 production ran with the local asset storage, wiped on every deploy, and
 * nothing signaled it. Files written there (fiscal XML copies, images) do not survive a restart.
 */
export function isTemporaryStorage(env: { nodeEnv?: string; provider?: string }): boolean {
  return env.nodeEnv === "production" && env.provider !== "s3";
}
