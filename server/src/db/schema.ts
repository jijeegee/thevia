import {
  pgTable,
  uuid,
  integer,
  varchar,
  bigint,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Keyboard definitions table.
 * Stores metadata about each uploaded VIA JSON definition.
 */
export const definitions = pgTable(
  'definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: integer('vendor_id').notNull(),
    productId: integer('product_id').notNull(),
    productName: varchar('product_name', { length: 255 }).notNull(),
    vendorProductId: bigint('vendor_product_id', { mode: 'number' })
      .generatedAlwaysAs(sql`vendor_id * 65536 + product_id`),
    connectionType: varchar('connection_type', { length: 20 }).notNull().default('usb'),
    keyboardName: varchar('keyboard_name', { length: 255 }).notNull(),
    jsonUrl: varchar('json_url', { length: 512 }).notNull(),
    jsonHash: varchar('json_hash', { length: 64 }).notNull(),
    jsonVersion: integer('json_version').notNull().default(1),
    viaProtocol: varchar('via_protocol', { length: 10 }).notNull().default('v3'),
    trustScore: integer('trust_score').notNull().default(0),
    upvotes: integer('upvotes').notNull().default(0),
    downvotes: integer('downvotes').notNull().default(0),
    sessionCount: integer('session_count').notNull().default(0),
    replaceCount: integer('replace_count').notNull().default(0),
    uploaderName: varchar('uploader_name', { length: 100 }),
    uploaderHash: varchar('uploader_hash', { length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('definitions_unique_combo').on(
      table.vendorId,
      table.productId,
      table.productName,
      table.jsonHash,
      table.connectionType,
    ),
  ],
);

/**
 * Votes table.
 * Tracks upvotes/downvotes per definition, one vote per voter (identified by hash).
 */
export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => definitions.id, { onDelete: 'cascade' }),
    voterHash: varchar('voter_hash', { length: 64 }).notNull(),
    voteType: varchar('vote_type', { length: 10 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('votes_unique_voter').on(table.definitionId, table.voterHash),
  ],
);

/**
 * Sessions table.
 * Records when a user loads a definition into VIA and what the outcome was.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  definitionId: uuid('definition_id')
    .notNull()
    .references(() => definitions.id, { onDelete: 'cascade' }),
  sessionHash: varchar('session_hash', { length: 64 }).notNull(),
  outcome: varchar('outcome', { length: 20 }).notNull(),
  durationSec: integer('duration_sec'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Type exports for use in services
export type Definition = typeof definitions.$inferSelect;
export type NewDefinition = typeof definitions.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
