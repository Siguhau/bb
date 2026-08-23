import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const suffix = process.argv[2];

if (!suffix || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix)) {
  console.error(
    "Usage: pnpm db:migration:create migration-name\n" +
      "Example: pnpm db:migration:create add-new-service-types",
  );
  process.exitCode = 1;
} else {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, "0"),
    )
    .join("");
  const directoryName = `${timestamp}_${suffix}`;
  const migrationsDirectory = fileURLToPath(
    new URL("../backend/prisma/migrations/", import.meta.url),
  );
  const migrationDirectory = new URL(
    `../backend/prisma/migrations/${directoryName}/`,
    import.meta.url,
  );
  const migrationFile = new URL("migration.sql", migrationDirectory);
  const words = suffix.replaceAll("-", " ");
  const displayName = words[0].toUpperCase() + words.slice(1);

  await mkdir(migrationsDirectory, { recursive: true });
  await mkdir(migrationDirectory);
  await writeFile(migrationFile, "", { flag: "wx" });

  console.log(`${displayName}`);
  console.log(`Created backend/prisma/migrations/${directoryName}/migration.sql`);
}
