import { db } from '../db/index.js';
import { definitions, votes, sessions } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Trust score calculation weights.
 * The trust score is a composite metric that represents community confidence
 * in a keyboard definition's quality and correctness.
 *
 * Formula:
 *   trust_score = (upvotes * UP_WEIGHT)
 *               + (downvotes * DOWN_WEIGHT)
 *               + (successful_sessions * SESSION_SUCCESS_WEIGHT)
 *               + (failed_sessions * SESSION_FAIL_WEIGHT)
 *               + (replace_count * REPLACE_WEIGHT)
 */
const WEIGHTS = {
  UPVOTE: 10,           // Each upvote adds 10 points
  DOWNVOTE: -15,        // Each downvote removes 15 points (asymmetric to penalize bad defs)
  SESSION_SUCCESS: 3,   // Successful session (loaded and worked) adds 3 points
  SESSION_FAIL: -5,     // Failed session removes 5 points
  SESSION_PARTIAL: 1,   // Partial success (loaded but issues) adds 1 point
  REPLACE: 5,           // Each time a user replaces their current def with this one
} as const;

export type VoteType = 'up' | 'down';
export type SessionOutcome = 'success' | 'fail' | 'partial' | 'replaced';

/**
 * Calculate the trust score for a definition based on its current stats.
 */
export function calculateTrustScore(stats: {
  upvotes: number;
  downvotes: number;
  successSessions: number;
  failSessions: number;
  partialSessions: number;
  replaceCount: number;
}): number {
  return (
    stats.upvotes * WEIGHTS.UPVOTE +
    stats.downvotes * WEIGHTS.DOWNVOTE +
    stats.successSessions * WEIGHTS.SESSION_SUCCESS +
    stats.failSessions * WEIGHTS.SESSION_FAIL +
    stats.partialSessions * WEIGHTS.SESSION_PARTIAL +
    stats.replaceCount * WEIGHTS.REPLACE
  );
}

/**
 * Record a vote for a definition.
 * Uses upsert - if the voter already voted, their vote type is updated.
 *
 * @returns The updated definition with new trust score
 */
export async function recordVote(
  definitionId: string,
  voterHash: string,
  voteType: VoteType,
) {
  // Check if definition exists
  const [def] = await db
    .select()
    .from(definitions)
    .where(eq(definitions.id, definitionId))
    .limit(1);

  if (!def) {
    throw new Error(`Definition not found: ${definitionId}`);
  }

  // Check for existing vote
  const [existingVote] = await db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.definitionId, definitionId),
        eq(votes.voterHash, voterHash),
      ),
    )
    .limit(1);

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      // Same vote - no change needed
      return def;
    }

    // Update existing vote
    await db
      .update(votes)
      .set({ voteType })
      .where(eq(votes.id, existingVote.id));

    // Adjust counts: reverse old vote, apply new vote
    const upDelta =
      (voteType === 'up' ? 1 : 0) - (existingVote.voteType === 'up' ? 1 : 0);
    const downDelta =
      (voteType === 'down' ? 1 : 0) - (existingVote.voteType === 'down' ? 1 : 0);

    const newUpvotes = def.upvotes + upDelta;
    const newDownvotes = def.downvotes + downDelta;
    const newTrustScore = def.trustScore + upDelta * WEIGHTS.UPVOTE + downDelta * WEIGHTS.DOWNVOTE;

    const [updated] = await db
      .update(definitions)
      .set({
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        trustScore: newTrustScore,
        updatedAt: new Date(),
      })
      .where(eq(definitions.id, definitionId))
      .returning();

    return updated;
  }

  // Insert new vote
  await db.insert(votes).values({
    definitionId,
    voterHash,
    voteType,
  });

  // Update definition counts
  const upDelta = voteType === 'up' ? 1 : 0;
  const downDelta = voteType === 'down' ? 1 : 0;
  const scoreDelta = upDelta * WEIGHTS.UPVOTE + downDelta * WEIGHTS.DOWNVOTE;

  const [updated] = await db
    .update(definitions)
    .set({
      upvotes: sql`${definitions.upvotes} + ${upDelta}`,
      downvotes: sql`${definitions.downvotes} + ${downDelta}`,
      trustScore: sql`${definitions.trustScore} + ${scoreDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(definitions.id, definitionId))
    .returning();

  return updated;
}

/**
 * Record a session (user loaded a definition into VIA).
 *
 * @returns The updated definition with new trust score
 */
export async function recordSession(
  definitionId: string,
  sessionHash: string,
  outcome: SessionOutcome,
  durationSec?: number,
) {
  // Check if definition exists
  const [def] = await db
    .select()
    .from(definitions)
    .where(eq(definitions.id, definitionId))
    .limit(1);

  if (!def) {
    throw new Error(`Definition not found: ${definitionId}`);
  }

  // Insert session record
  await db.insert(sessions).values({
    definitionId,
    sessionHash,
    outcome,
    durationSec: durationSec ?? null,
  });

  // Calculate score delta based on outcome
  let scoreDelta = 0;
  const updates: Record<string, any> = {
    sessionCount: sql`${definitions.sessionCount} + 1`,
    updatedAt: new Date(),
  };

  switch (outcome) {
    case 'success':
      scoreDelta = WEIGHTS.SESSION_SUCCESS;
      break;
    case 'fail':
      scoreDelta = WEIGHTS.SESSION_FAIL;
      break;
    case 'partial':
      scoreDelta = WEIGHTS.SESSION_PARTIAL;
      break;
    case 'replaced':
      scoreDelta = WEIGHTS.REPLACE;
      updates.replaceCount = sql`${definitions.replaceCount} + 1`;
      break;
  }

  updates.trustScore = sql`${definitions.trustScore} + ${scoreDelta}`;

  const [updated] = await db
    .update(definitions)
    .set(updates)
    .where(eq(definitions.id, definitionId))
    .returning();

  return updated;
}

/**
 * Recalculate trust score from scratch for a definition.
 * Useful for periodic consistency checks.
 */
export async function recalculateTrustScore(definitionId: string): Promise<number> {
  const [def] = await db
    .select()
    .from(definitions)
    .where(eq(definitions.id, definitionId))
    .limit(1);

  if (!def) {
    throw new Error(`Definition not found: ${definitionId}`);
  }

  // Count session outcomes
  const sessionStats = await db
    .select({
      outcome: sessions.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(sessions)
    .where(eq(sessions.definitionId, definitionId))
    .groupBy(sessions.outcome);

  const outcomeMap: Record<string, number> = {};
  for (const row of sessionStats) {
    outcomeMap[row.outcome] = row.count;
  }

  const score = calculateTrustScore({
    upvotes: def.upvotes,
    downvotes: def.downvotes,
    successSessions: outcomeMap['success'] ?? 0,
    failSessions: outcomeMap['fail'] ?? 0,
    partialSessions: outcomeMap['partial'] ?? 0,
    replaceCount: def.replaceCount,
  });

  // Update the stored trust score
  await db
    .update(definitions)
    .set({ trustScore: score, updatedAt: new Date() })
    .where(eq(definitions.id, definitionId));

  return score;
}
