import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getStats } from '../services/stats.service.js';

/**
 * Stats routes.
 * Public endpoint for aggregate platform statistics.
 *
 * GET / - Platform-wide stats (total definitions, votes, sessions, etc.)
 */
export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await getStats();
    return reply.send(stats);
  });
}
