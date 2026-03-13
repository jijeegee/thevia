import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

/**
 * PostgreSQL connection via postgres.js driver.
 * In production, max connections should be tuned based on expected load.
 */
const queryClient = postgres(config.DATABASE_URL, {
  max: config.NODE_ENV === 'production' ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Drizzle ORM instance with schema for type-safe queries.
 */
export const db = drizzle(queryClient, { schema });

/**
 * Graceful shutdown helper - closes DB connections.
 */
export async function closeDb(): Promise<void> {
  await queryClient.end();
}
