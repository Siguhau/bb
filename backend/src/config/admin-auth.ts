export const ADMIN_SESSION_COOKIE_NAME = "bouvet_bike_admin_session";
export const ADMIN_SESSION_COOKIE_PATH = "/api/admin";

export type AdminAuthConfig = {
  sessionTtlMs: number;
  secureCookie: boolean;
  loginAttemptLimit: number;
  loginBlockDurationMs: number;
};

export function getAdminAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AdminAuthConfig {
  const ttlSeconds = Number(environment.ADMIN_SESSION_TTL_SECONDS ?? 28_800);
  const loginAttemptLimit = Number(environment.ADMIN_LOGIN_ATTEMPT_LIMIT ?? 5);
  const loginBlockDurationSeconds = Number(
    environment.ADMIN_LOGIN_BLOCK_DURATION_SECONDS ?? 900,
  );

  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60) {
    throw new Error(
      "ADMIN_SESSION_TTL_SECONDS must be an integer of at least 60.",
    );
  }
  if (!Number.isInteger(loginAttemptLimit) || loginAttemptLimit < 1) {
    throw new Error("ADMIN_LOGIN_ATTEMPT_LIMIT must be a positive integer.");
  }
  if (
    !Number.isInteger(loginBlockDurationSeconds) ||
    loginBlockDurationSeconds < 1
  ) {
    throw new Error(
      "ADMIN_LOGIN_BLOCK_DURATION_SECONDS must be a positive integer.",
    );
  }

  return {
    sessionTtlMs: ttlSeconds * 1_000,
    secureCookie: environment.NODE_ENV === "production",
    loginAttemptLimit,
    loginBlockDurationMs: loginBlockDurationSeconds * 1_000,
  };
}
