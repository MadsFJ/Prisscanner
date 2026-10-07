import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export function createDb(
  connectionString: string,
  poolConfig: Omit<PoolConfig, "connectionString"> = {},
) {
  const pool = new Pool({ connectionString, ...poolConfig });
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
