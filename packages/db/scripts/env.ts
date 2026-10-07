import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Loads the repository's root `.env` if present, then returns a required variable. */
export function requireEnv(name: string): string {
  const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}
