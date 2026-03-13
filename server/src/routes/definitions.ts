import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  searchDefinitions,
  createDefinition,
  getDefinitionJson,
  getDefinitionById,
  ValidationError,
  DuplicateError,
} from '../services/definition.service.js';
import {
  recordVote,
  recordSession,
  type VoteType,
  type SessionOutcome,
} from '../services/trust.service.js';
import { isValidFingerprint, hashIp } from '../utils/fingerprint.js';

// Request schemas
const searchBodySchema = z.object({
  vendorId: z.number().int().min(0).max(0xFFFF),
  productId: z.number().int().min(0).max(0xFFFF),
  productName: z.string().optional(),
});

const createBodySchema = z.object({
  vendorId: z.coerce.number().int().min(0).max(0xFFFF),
  productId: z.coerce.number().int().min(0).max(0xFFFF),
  productName: z.string().min(1).max(255),
  connectionType: z.enum(['usb', 'bluetooth', 'wireless']).optional().default('usb'),
  keyboardName: z.string().min(1).max(255),
  viaProtocol: z.enum(['v2', 'v3']).optional().default('v3'),
  uploaderName: z.string().max(100).optional(),
  uploaderHash: z.string().max(64).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Definitions routes.
 *
 * POST /search     - Search for matching definitions
 * POST /           - Upload a new definition
 * GET  /:id/json   - Get the JSON file for a definition
 */
export async function definitionsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/definitions/search?vendorId=...&productId=...&productName=...
   * Frontend-compatible search endpoint (query params).
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const parseResult = searchBodySchema.safeParse({
      vendorId: query.vendorId ? Number(query.vendorId) : undefined,
      productId: query.productId ? Number(query.productId) : undefined,
      productName: query.productName,
    });
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const results = await searchDefinitions(parseResult.data);
    return reply.send(results);
  });

  /**
   * POST /api/v1/definitions/search
   * Search for definitions by vendorId + productId (+ optional productName).
   * Returns matches sorted by trust_score descending.
   */
  fastify.post('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = searchBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const results = await searchDefinitions(parseResult.data);

    return reply.send({
      results,
      count: results.length,
    });
  });

  /**
   * POST /api/v1/definitions
   * Upload a new keyboard definition.
   * Expects multipart form data with metadata fields and a JSON file.
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Parse multipart data
    const parts = request.parts();
    const fields: Record<string, string> = {};
    let jsonBuffer: Buffer | null = null;
    let jsonFilename: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        // Limit file size to 1MB
        const chunks: Buffer[] = [];
        let totalSize = 0;
        for await (const chunk of part.file) {
          totalSize += chunk.length;
          if (totalSize > 1024 * 1024) {
            return reply.status(413).send({
              error: 'File too large',
              message: 'JSON file must be under 1MB',
            });
          }
          chunks.push(chunk);
        }
        jsonBuffer = Buffer.concat(chunks);
        jsonFilename = part.filename;
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!jsonBuffer) {
      return reply.status(400).send({
        error: 'Missing file',
        message: 'A JSON file must be uploaded',
      });
    }

    // Validate metadata fields
    const parseResult = createBodySchema.safeParse(fields);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid metadata',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    try {
      const definition = await createDefinition(parseResult.data, jsonBuffer);

      return reply.status(201).send({
        definition,
        message: 'Definition uploaded successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return reply.status(400).send({
          error: 'Validation failed',
          message: error.message,
        });
      }
      if (error instanceof DuplicateError) {
        return reply.status(409).send({
          error: 'Duplicate definition',
          message: error.message,
          existingId: error.existingId,
        });
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/definitions/:id
   * Get definition metadata by ID.
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid ID format',
        message: 'ID must be a valid UUID',
      });
    }

    const definition = await getDefinitionById(parseResult.data.id);
    if (!definition) {
      return reply.status(404).send({
        error: 'Not found',
        message: 'Definition not found',
      });
    }

    return reply.send({ definition });
  });

  /**
   * GET /api/v1/definitions/:id/json
   * Get the raw JSON file for a definition.
   * This is the endpoint VIA calls to load the keyboard definition.
   */
  fastify.get('/:id/json', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid ID format',
        message: 'ID must be a valid UUID',
      });
    }

    const jsonContent = await getDefinitionJson(parseResult.data.id);
    if (!jsonContent) {
      return reply.status(404).send({
        error: 'Not found',
        message: 'Definition JSON not found',
      });
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'public, max-age=3600')
      .send(jsonContent);
  });

  /**
   * POST /api/v1/definitions/:id/vote
   * Frontend-compatible vote endpoint (ID in URL path).
   */
  fastify.post('/:id/vote', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = idParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({ error: 'Invalid ID format' });
    }

    const body = request.body as Record<string, unknown>;
    const voteType = body.voteType as string;
    if (voteType !== 'up' && voteType !== 'down') {
      return reply.status(400).send({ error: 'voteType must be "up" or "down"' });
    }

    let voterHash = body.voterHash as string | undefined;
    if (!voterHash || !isValidFingerprint(voterHash)) {
      voterHash = hashIp(request.ip);
    }

    try {
      const updated = await recordVote(paramResult.data.id, voterHash, voteType as VoteType);
      return reply.send({
        upvotes: updated.upvotes,
        downvotes: updated.downvotes,
        trustScore: updated.trustScore,
        userVote: voteType,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return reply.status(404).send({ error: 'Not found', message: error.message });
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/definitions/:id/session
   * Frontend-compatible session endpoint (ID in URL path).
   * Maps frontend outcomes (completed/errored) to backend outcomes (success/fail).
   */
  fastify.post('/:id/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = idParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({ error: 'Invalid ID format' });
    }

    const body = request.body as Record<string, unknown>;

    // Map frontend outcome names to backend names
    const outcomeMap: Record<string, SessionOutcome> = {
      completed: 'success',
      errored: 'fail',
      replaced: 'replaced',
      success: 'success',
      fail: 'fail',
      partial: 'partial',
    };
    const rawOutcome = body.outcome as string;
    const outcome = outcomeMap[rawOutcome];
    if (!outcome) {
      return reply.status(400).send({ error: 'Invalid outcome' });
    }

    const durationSec = typeof body.durationSec === 'number' ? body.durationSec : undefined;

    let sessionHash = body.sessionHash as string | undefined;
    if (!sessionHash || !isValidFingerprint(sessionHash)) {
      sessionHash = hashIp(request.ip);
    }

    try {
      const updated = await recordSession(paramResult.data.id, sessionHash, outcome, durationSec);
      return reply.send({
        id: updated.id,
        definitionId: paramResult.data.id,
        outcome: rawOutcome,
        trustScore: updated.trustScore,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return reply.status(404).send({ error: 'Not found', message: error.message });
      }
      throw error;
    }
  });
}
