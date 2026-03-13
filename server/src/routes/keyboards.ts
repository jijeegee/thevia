import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  listKeyboards,
  getRecentDefinitions,
  getPopularDefinitions,
} from '../services/definition.service.js';

// Query parameter schemas
const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['trust', 'recent', 'name']).optional().default('trust'),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const popularQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

/**
 * Keyboards routes.
 * Public-facing endpoints for browsing available keyboard definitions.
 *
 * GET /          - List/search keyboards with pagination
 * GET /recent    - Get recently added definitions
 * GET /popular   - Get popular definitions by trust score
 */
export async function keyboardsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/keyboards
   * List all keyboard definitions with pagination, search, and sorting.
   *
   * Query params:
   * - search: Filter by keyboard name, product name, or uploader name
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20, max: 100)
   * - sort: Sort order - "trust" (default), "recent", "name"
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = listQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const result = await listKeyboards(parseResult.data);

    return reply.send(result);
  });

  /**
   * GET /api/v1/keyboards/recent
   * Get the most recently uploaded definitions.
   *
   * Query params:
   * - limit: Number of results (default: 10, max: 50)
   */
  fastify.get('/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = recentQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const items = await getRecentDefinitions(parseResult.data.limit);

    return reply.send({
      items,
      count: items.length,
    });
  });

  /**
   * GET /api/v1/keyboards/popular
   * Get the most popular definitions by trust score.
   *
   * Query params:
   * - limit: Number of results (default: 10, max: 50)
   */
  fastify.get('/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = popularQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const items = await getPopularDefinitions(parseResult.data.limit);

    return reply.send({
      items,
      count: items.length,
    });
  });
}
