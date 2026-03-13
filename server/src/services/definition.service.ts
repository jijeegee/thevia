import { db } from '../db/index.js';
import { definitions, type NewDefinition } from '../db/schema.js';
import { eq, and, desc, sql, ilike, or, asc } from 'drizzle-orm';
import { getStorageService } from './storage.service.js';
import { hashJsonContent } from '../utils/fingerprint.js';
import { validateViaJson } from '../validators/via-json.validator.js';

/**
 * Search for definitions matching a vendor/product ID combination.
 * Results are sorted by trust_score descending (best match first).
 */
export async function searchDefinitions(params: {
  vendorId: number;
  productId: number;
  productName?: string;
}) {
  const conditions = [
    eq(definitions.vendorId, params.vendorId),
    eq(definitions.productId, params.productId),
  ];

  if (params.productName) {
    conditions.push(eq(definitions.productName, params.productName));
  }

  const results = await db
    .select()
    .from(definitions)
    .where(and(...conditions))
    .orderBy(desc(definitions.trustScore));

  return results;
}

/**
 * Get a single definition by ID.
 */
export async function getDefinitionById(id: string) {
  const [def] = await db
    .select()
    .from(definitions)
    .where(eq(definitions.id, id))
    .limit(1);

  return def ?? null;
}

/**
 * Get the JSON file content for a definition.
 */
export async function getDefinitionJson(id: string): Promise<Buffer | null> {
  const def = await getDefinitionById(id);
  if (!def) return null;

  const storage = getStorageService();
  const key = `definitions/${id}.json`;
  return storage.get(key);
}

/**
 * Create a new definition from an uploaded JSON file.
 *
 * @param metadata - Definition metadata from the upload request
 * @param jsonContent - The raw JSON file content
 * @returns The created definition record
 */
export async function createDefinition(
  metadata: {
    vendorId: number;
    productId: number;
    productName: string;
    connectionType?: string;
    keyboardName: string;
    viaProtocol?: string;
    uploaderName?: string;
    uploaderHash?: string;
  },
  jsonContent: Buffer,
) {
  // Parse the JSON content
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonContent.toString('utf-8'));
  } catch {
    throw new ValidationError('Invalid JSON file: could not parse');
  }

  // Validate VIA JSON structure
  const validation = validateViaJson(parsedJson, metadata.vendorId, metadata.productId);
  if (!validation.valid) {
    throw new ValidationError(
      `Invalid VIA JSON: ${validation.errors.join('; ')}`
    );
  }

  // Compute content hash
  const jsonHash = hashJsonContent(jsonContent);

  // Check for duplicate (same vendor, product, name, hash, connection)
  const connectionType = metadata.connectionType ?? 'usb';
  const [existing] = await db
    .select()
    .from(definitions)
    .where(
      and(
        eq(definitions.vendorId, metadata.vendorId),
        eq(definitions.productId, metadata.productId),
        eq(definitions.productName, metadata.productName),
        eq(definitions.jsonHash, jsonHash),
        eq(definitions.connectionType, connectionType),
      ),
    )
    .limit(1);

  if (existing) {
    throw new DuplicateError(
      'An identical definition already exists',
      existing.id,
    );
  }

  // Generate a temporary ID for storage key (we'll use the DB-generated UUID)
  // First insert the record, then store the file
  const newDef: NewDefinition = {
    vendorId: metadata.vendorId,
    productId: metadata.productId,
    productName: metadata.productName,
    connectionType,
    keyboardName: metadata.keyboardName,
    jsonUrl: '', // Will be updated after file storage
    jsonHash,
    viaProtocol: metadata.viaProtocol ?? 'v3',
    uploaderName: metadata.uploaderName ?? null,
    uploaderHash: metadata.uploaderHash ?? null,
  };

  const [created] = await db
    .insert(definitions)
    .values(newDef)
    .returning();

  // Store the JSON file
  const storage = getStorageService();
  const storageKey = `definitions/${created.id}.json`;
  const jsonUrl = await storage.put(storageKey, jsonContent);

  // Update the record with the actual URL
  const [updated] = await db
    .update(definitions)
    .set({ jsonUrl })
    .where(eq(definitions.id, created.id))
    .returning();

  return updated;
}

/**
 * List keyboards with pagination and search.
 */
export async function listKeyboards(params: {
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'trust' | 'recent' | 'name';
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;

  // Build where clause
  const conditions = [];
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    conditions.push(
      or(
        ilike(definitions.keyboardName, searchTerm),
        ilike(definitions.productName, searchTerm),
        ilike(definitions.uploaderName, searchTerm),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order by
  let orderBy;
  switch (params.sort) {
    case 'recent':
      orderBy = desc(definitions.createdAt);
      break;
    case 'name':
      orderBy = asc(definitions.keyboardName);
      break;
    case 'trust':
    default:
      orderBy = desc(definitions.trustScore);
      break;
  }

  // Execute query
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(definitions)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(definitions)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get recently added definitions.
 */
export async function getRecentDefinitions(limit: number = 10) {
  return db
    .select()
    .from(definitions)
    .orderBy(desc(definitions.createdAt))
    .limit(Math.min(50, limit));
}

/**
 * Get popular definitions by trust score.
 */
export async function getPopularDefinitions(limit: number = 10) {
  return db
    .select()
    .from(definitions)
    .orderBy(desc(definitions.trustScore))
    .limit(Math.min(50, limit));
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateError extends Error {
  public existingId: string;

  constructor(message: string, existingId: string) {
    super(message);
    this.name = 'DuplicateError';
    this.existingId = existingId;
  }
}
