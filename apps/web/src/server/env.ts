import { z } from "zod";
import { loadRootEnv } from "../../../../scripts/load-env";

loadRootEnv();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_AUTH: z.string().min(1),
  DATABASE_URL_WORKER: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CRON_SECRET: z.string().min(16),
});

export function env() {
  return schema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_AUTH: process.env.DATABASE_URL_AUTH,
    DATABASE_URL_WORKER: process.env.DATABASE_URL_WORKER,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  });
}
