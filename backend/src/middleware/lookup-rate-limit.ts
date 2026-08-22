type Attempt = {
  attempts: number;
  failures: number;
  blockedUntil: number;
  windowEndsAt: number;
};

export type LookupRateLimiter = {
  isBlocked(clientId: string): boolean;
  recordAttempt(clientId: string): void;
  recordFailure(clientId: string): void;
};

type LookupRateLimiterOptions = {
  attemptLimit: number;
  blockDurationMs: number;
  now?: () => number;
};

export function createLookupRateLimiter({
  attemptLimit,
  blockDurationMs,
  now = Date.now,
}: LookupRateLimiterOptions): LookupRateLimiter {
  const attempts = new Map<string, Attempt>();

  return {
    isBlocked(clientId) {
      const attempt = attempts.get(clientId);

      if (!attempt) return false;
      if (attempt.blockedUntil > now()) return true;
      if (attempt.windowEndsAt <= now()) attempts.delete(clientId);

      return false;
    },
    recordAttempt(clientId) {
      const currentTime = now();
      const attempt = attempts.get(clientId) ?? {
        attempts: 0,
        failures: 0,
        blockedUntil: 0,
        windowEndsAt: currentTime + blockDurationMs,
      };
      attempt.attempts += 1;

      if (attempt.attempts >= attemptLimit) {
        attempt.blockedUntil = currentTime + blockDurationMs;
      }

      attempts.set(clientId, attempt);
    },
    recordFailure(clientId) {
      const currentTime = now();
      const attempt = attempts.get(clientId) ?? {
        attempts: 0,
        failures: 0,
        blockedUntil: 0,
        windowEndsAt: currentTime + blockDurationMs,
      };
      attempt.failures += 1;

      if (attempt.failures >= attemptLimit) {
        attempt.blockedUntil = currentTime + blockDurationMs;
      }

      attempts.set(clientId, attempt);
    },
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

export function createConfiguredLookupRateLimiter(): LookupRateLimiter {
  return createLookupRateLimiter({
    attemptLimit: positiveInteger(process.env.LOOKUP_ATTEMPT_LIMIT, 5),
    blockDurationMs: positiveInteger(process.env.LOOKUP_BLOCK_DURATION_SECONDS, 900) * 1_000,
  });
}
