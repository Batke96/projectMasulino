import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { migrate } from "./migrate";
import { ensureRoles } from "./roles";

const port = 54329;
const databaseDir = resolve(process.cwd(), ".data/pg");
mkdirSync(databaseDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir,
  port,
  user: "postgres",
  password: "postgres",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=en_US.UTF-8"],
});

await postgres.initialise().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.toLowerCase().includes("already")) throw error;
});
await postgres.start();
await postgres.createDatabase("masulino").catch(() => undefined);

const migrateUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/masulino`;
await ensureRoles(migrateUrl);
await migrate(migrateUrl);
console.log("Local Postgres is ready on 127.0.0.1:54329 database masulino");
console.log("This process keeps Postgres running. Stop it with Ctrl+C.");

const shutdown = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
await new Promise(() => undefined);
