import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const databasePath = path.join(repositoryRoot, "backend", "prisma", "e2e.db");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db",
  // Prisma's native schema engine can exit without diagnostics on newer macOS
  // versions unless Rust logging is initialized.
  ...(process.platform === "darwin" ? { RUST_LOG: "info" } : {}),
};

for (const suffix of ["", "-journal", "-shm", "-wal"]) {
  rmSync(`${databasePath}${suffix}`, { force: true });
}

function run(args) {
  const result = spawnSync(pnpmCommand, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["--filter", "bouvet-bike-backend", "db:generate"]);
run(["--filter", "bouvet-bike-backend", "exec", "prisma", "migrate", "deploy"]);
run(["--filter", "bouvet-bike-backend", "admin:provision"]);

const backend = spawn(
  pnpmCommand,
  ["--filter", "bouvet-bike-backend", "exec", "tsx", "src/server.ts"],
  {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  },
);

backend.once("error", (error) => {
  console.error("Failed to start the end-to-end backend.", error);
  process.exit(1);
});

backend.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => backend.kill(signal));
}
