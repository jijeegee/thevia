import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  recordVote,
  recordSession,
  type VoteType,
  type SessionOutcome,
} from '../services/trust.service.js';
import { isValidFingerprint, hashIp } from '../utils/fingerprint.js';

// Request schemas
const voteBodySchema = z.object({
  definitionId: z.string().uuid(),
  voterHash: z.string().min(1).max(64).optional(),
  voteType: z.enum(['up', 'down']),
});

const sessionBodySchema = z.object({
  definitionId: z.string().uuid(),
  sessionHash: z.string().min(1).max(64).optional(),
  outcome: z.enum(['success', 'fail', 'partial', 'replaced']),
  durationSec: z.number().int().min(0).max(86400).optional(),
});

/**
 * Trust routes.
 *
 * POST /vote    - Record a vote on a definition
 * POST /session - Record a session (user loaded a definition)
 */
export async function trustRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/trust/vote
   * Record an upvote or downvote on a definition.
   * Uses voterHash for identification; falls back to IP-based hash.
   */
  fastify.post('/vote', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = voteBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { definitionId, voteType } = parseResult.data;

    // Determine voter identity
    let voterHash = parseResult.data.voterHash;
    if (!voterHash || !isValidFingerprint(voterHash)) {
      // Fallback to IP-based hash
      voterHash = hashIp(request.ip);
    }

    try {
      const updated = await recordVote(definitionId, voterHash, voteType as VoteType);

      return reply.send({
        definition: updated,
        message: `Vote '${voteType}' recorded successfully`,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return reply.status(404).send({
          error: 'Not found',
          message: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/trust/session
   * Record a session - when a user loads a definition into VIA.
   *
   * Outcomes:
   * - "success" - Definition loaded and keyboard worked correctly
   * - "fail" - Definition failed to load or keyboard didn't work
   * - "partial" - Loaded but some keys/features didn't work
   * - "replaced" - User chose this definition over their current one
   */
  fastify.post('/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = sessionBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { definitionId, outcome, durationSec } = parseResult.data;

    // Determine session identity
    let sessionHash = parseResult.data.sessionHash;
    if (!sessionHash || !isValidFingerprint(sessionHash)) {
      sessionHash = hashIp(request.ip);
    }

    try {
      const updated = await recordSession(
        definitionId,
        sessionHash,
        outcome as SessionOutcome,
        durationSec,
      );

      return reply.send({
        definition: updated,
        message: `Session '${outcome}' recorded successfully`,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return reply.status(404).send({
          error: 'Not found',
          message: error.message,
        });
      }
      throw error;
    }
  });
}
