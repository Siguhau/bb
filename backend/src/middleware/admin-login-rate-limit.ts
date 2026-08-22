export type AdminLoginRateLimiter = {
  isBlocked(clientId: string): boolean;
  recordFailure(clientId: string): void;
  reset(clientId: string): void;
};

export function createAdminLoginRateLimiter(options: {
  attemptLimit: number;
  blockDurationMs: number;
  now?: () => number;
}): AdminLoginRateLimiter {
  const failures = new Map<
    string,
    { count: number; blockedUntil: number; windowEndsAt: number }
  >();
  const now = options.now ?? Date.now;

  return {
    isBlocked(clientId) {
      const failure = failures.get(clientId);
      if (!failure) return false;
      if (failure.blockedUntil > now()) return true;
      if (failure.windowEndsAt <= now()) failures.delete(clientId);
      return false;
    },
    recordFailure(clientId) {
      const currentTime = now();
      const failure = failures.get(clientId) ?? {
        count: 0,
        blockedUntil: 0,
        windowEndsAt: currentTime + options.blockDurationMs,
      };
      failure.count += 1;
      if (failure.count >= options.attemptLimit) {
        failure.blockedUntil = currentTime + options.blockDurationMs;
      }
      failures.set(clientId, failure);
    },
    reset(clientId) {
      failures.delete(clientId);
    },
  };
}
