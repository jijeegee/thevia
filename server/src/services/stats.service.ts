import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { definitions, votes, sessions } from '../db/schema.js';

export async function getStats() {
  const [defStats] = await db
    .select({
      totalDefinitions: sql<number>`count(*)::int`,
      totalUpvotes: sql<number>`coalesce(sum(${definitions.upvotes}), 0)::int`,
      totalDownvotes: sql<number>`coalesce(sum(${definitions.downvotes}), 0)::int`,
      totalSessions: sql<number>`coalesce(sum(${definitions.sessionCount}), 0)::int`,
      avgTrustScore: sql<number>`coalesce(round(avg(${definitions.trustScore})), 0)::int`,
    })
    .from(definitions);

  const [voteStats] = await db
    .select({
      totalVotes: sql<number>`count(*)::int`,
      uniqueVoters: sql<number>`count(distinct ${votes.voterHash})::int`,
    })
    .from(votes);

  const [sessionStats] = await db
    .select({
      totalRecordedSessions: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${sessions.sessionHash})::int`,
    })
    .from(sessions);

  return {
    definitions: defStats.totalDefinitions,
    upvotes: defStats.totalUpvotes,
    downvotes: defStats.totalDownvotes,
    sessions: defStats.totalSessions,
    avgTrustScore: defStats.avgTrustScore,
    votes: voteStats.totalVotes,
    uniqueVoters: voteStats.uniqueVoters,
    recordedSessions: sessionStats.totalRecordedSessions,
    uniqueUsers: sessionStats.uniqueUsers,
  };
}
