// API client for the TheVIA community backend
// Base URL configurable via environment variable or localStorage override

const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('thevia_api_url');
    if (override) return override;
  }
  return (
    import.meta.env.VITE_THEVIA_API_URL ||
    'https://api.thevia.app/api/v1'
  );
};

// ── Types ──────────────────────────────────────────────────────────

export interface CommunityDefinition {
  id: string;
  vendorId: number;
  productId: number;
  productName: string;
  connectionType: 'usb' | 'dongle';
  keyboardName: string;
  jsonUrl: string;
  trustScore: number;
  upvotes: number;
  downvotes: number;
  sessionCount: number;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeyboardListItem {
  id: string;
  vendorId: number;
  productId: number;
  keyboardName: string;
  connectionType: 'usb' | 'dongle';
  trustScore: number;
  upvotes: number;
  downvotes: number;
  sessionCount: number;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VoteResponse {
  upvotes: number;
  downvotes: number;
  trustScore: number;
  userVote: 'up' | 'down';
}

export interface SessionResponse {
  id: string;
  definitionId: string;
  outcome: string;
  trustScore: number;
}

export type TrustLevel = 'verified' | 'trusted' | 'unverified' | 'new' | 'flagged';

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 20) return 'verified';
  if (score >= 10) return 'trusted';
  if (score >= 1) return 'unverified';
  if (score === 0) return 'new';
  return 'flagged';
}

// ── Error handling ─────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    throw new ApiError(response.status, response.statusText, body);
  }
  return response.json() as Promise<T>;
}

// ── API functions ──────────────────────────────────────────────────

/**
 * Search for community definitions matching a specific VID/PID.
 * Optionally filter by product name for more precise matching.
 */
export async function searchDefinitions(
  vendorId: number,
  productId: number,
  productName?: string,
): Promise<CommunityDefinition[]> {
  const params = new URLSearchParams({
    vendorId: vendorId.toString(),
    productId: productId.toString(),
  });
  if (productName) {
    params.set('productName', productName);
  }
  const response = await fetch(
    `${getApiBase()}/definitions/search?${params.toString()}`,
  );
  return handleResponse<CommunityDefinition[]>(response);
}

/**
 * Fetch the actual JSON definition content for a community definition.
 */
export async function getDefinitionJson(id: string): Promise<unknown> {
  const response = await fetch(`${getApiBase()}/definitions/${id}/json`);
  return handleResponse<unknown>(response);
}

/**
 * Upload a new keyboard definition to the community.
 */
export async function uploadDefinition(
  formData: FormData,
): Promise<CommunityDefinition> {
  const response = await fetch(`${getApiBase()}/definitions`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<CommunityDefinition>(response);
}

/**
 * Record a vote (upvote or downvote) on a community definition.
 */
export async function recordVote(
  definitionId: string,
  voterHash: string,
  voteType: 'up' | 'down',
): Promise<VoteResponse> {
  const response = await fetch(
    `${getApiBase()}/definitions/${definitionId}/vote`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({voterHash, voteType}),
    },
  );
  return handleResponse<VoteResponse>(response);
}

/**
 * Record a usage session for trust scoring purposes.
 */
export async function recordSession(
  definitionId: string,
  sessionHash: string,
  outcome: 'completed' | 'replaced' | 'errored',
  durationSec: number,
): Promise<SessionResponse> {
  const response = await fetch(
    `${getApiBase()}/definitions/${definitionId}/session`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sessionHash, outcome, durationSec}),
    },
  );
  return handleResponse<SessionResponse>(response);
}

/**
 * Get paginated list of keyboards with optional filtering and sorting.
 */
export async function getKeyboards(params?: {
  page?: number;
  limit?: number;
  sort?: 'trust' | 'recent' | 'popular';
  search?: string;
}): Promise<PaginatedResponse<KeyboardListItem>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  const url = `${getApiBase()}/keyboards${query ? `?${query}` : ''}`;
  const response = await fetch(url);
  return handleResponse<PaginatedResponse<KeyboardListItem>>(response);
}

/**
 * Get recently uploaded keyboard definitions.
 */
export async function getRecentKeyboards(
  limit = 10,
): Promise<KeyboardListItem[]> {
  const response = await fetch(
    `${getApiBase()}/keyboards/recent?limit=${limit}`,
  );
  return handleResponse<KeyboardListItem[]>(response);
}

/**
 * Get most popular keyboard definitions by session count.
 */
export async function getPopularKeyboards(
  limit = 10,
): Promise<KeyboardListItem[]> {
  const response = await fetch(
    `${getApiBase()}/keyboards/popular?limit=${limit}`,
  );
  return handleResponse<KeyboardListItem[]>(response);
}
