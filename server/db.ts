import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL must be set. Please configure SUPABASE_DATABASE_URL or DATABASE_URL."
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.SUPABASE_DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined,
});
export const db = drizzle(pool, { schema });
