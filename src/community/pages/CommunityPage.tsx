// Community keyboard browser/search page
// Allows users to search and browse community-contributed keyboard definitions

import React, {useCallback, useEffect, useState} from 'react';
import styled from 'styled-components';
import {getKeyboards, KeyboardListItem} from '../api';
import {TrustBadge} from '../components/TrustBadge';

// ── Styled components ──────────────────────────────────────────────

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  min-height: calc(100vh - 50px);
  background: var(--bg_gradient);
  color: var(--color_label);
  overflow-y: auto;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--color_label-highlighted);
`;

const PageSubtitle = styled.p`
  font-size: 14px;
  color: var(--color_label);
  margin: 0 0 32px 0;
  max-width: 500px;
  text-align: center;
  line-height: 1.5;
`;

const SearchContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  width: 100%;
  max-width: 600px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border_color_cell);
  border-radius: 8px;
  background: var(--bg_control);
  color: var(--color_label-highlighted);
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--color_accent);
  }

  &::placeholder {
    color: var(--color_label);
    opacity: 0.5;
  }
`;

const SortSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid var(--border_color_cell);
  border-radius: 8px;
  background: var(--bg_control);
  color: var(--color_label-highlighted);
  font-size: 14px;
  outline: none;
  cursor: pointer;
`;

const KeyboardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 900px;
`;

const KeyboardCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border_color_cell);
  border-radius: 8px;
  background: var(--bg_control);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--color_accent);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardName = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--color_label-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardMeta = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color_label);
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusMessage = styled.div`
  padding: 40px;
  font-size: 14px;
  color: var(--color_label);
  text-align: center;
`;

const PaginationContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 24px;
  align-items: center;
`;

const PageButton = styled.button<{$active?: boolean}>`
  padding: 6px 12px;
  border: 1px solid var(--border_color_cell);
  border-radius: 4px;
  background: ${(p) => (p.$active ? 'var(--color_accent)' : 'var(--bg_control)')};
  color: var(--color_label-highlighted);
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ── Component ──────────────────────────────────────────────────────

export const CommunityPage: React.FC = () => {
  const [keyboards, setKeyboards] = useState<KeyboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'trust' | 'recent' | 'popular'>('popular');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchKeyboards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getKeyboards({
        page,
        limit: 24,
        sort,
        search: search || undefined,
      });
      setKeyboards(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keyboards');
      setKeyboards([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search]);

  useEffect(() => {
    fetchKeyboards();
  }, [fetchKeyboards]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchKeyboards();
    }
  };

  return (
    <PageContainer>
      <PageTitle>Community Keyboards</PageTitle>
      <PageSubtitle>
        Browse keyboard definitions contributed by the community. These
        definitions enable VIA support for keyboards not yet in the official
        database.
      </PageSubtitle>

      <SearchContainer>
        <SearchInput
          placeholder="Search keyboards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <SortSelect
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(1);
          }}
        >
          <option value="popular">Most Popular</option>
          <option value="trust">Highest Trust</option>
          <option value="recent">Most Recent</option>
        </SortSelect>
      </SearchContainer>

      {loading && <StatusMessage>Loading...</StatusMessage>}
      {error && <StatusMessage>Error: {error}</StatusMessage>}
      {!loading && !error && keyboards.length === 0 && (
        <StatusMessage>
          No keyboards found. Try a different search term.
        </StatusMessage>
      )}

      {!loading && keyboards.length > 0 && (
        <>
          <KeyboardGrid>
            {keyboards.map((kb) => (
              <KeyboardCard key={kb.id}>
                <CardHeader>
                  <CardName>{kb.keyboardName}</CardName>
                  <TrustBadge score={kb.trustScore} size="small" />
                </CardHeader>
                <CardMeta>
                  <MetaItem>
                    {'\u2B06'} {kb.upvotes}
                  </MetaItem>
                  <MetaItem>
                    {'\u2B07'} {kb.downvotes}
                  </MetaItem>
                  <MetaItem>
                    {'\uD83D\uDCBB'} {kb.sessionCount} sessions
                  </MetaItem>
                  {kb.uploaderName && (
                    <MetaItem>by {kb.uploaderName}</MetaItem>
                  )}
                </CardMeta>
              </KeyboardCard>
            ))}
          </KeyboardGrid>

          {totalPages > 1 && (
            <PaginationContainer>
              <PageButton
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </PageButton>
              <span>
                Page {page} of {totalPages}
              </span>
              <PageButton
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </PageButton>
            </PaginationContainer>
          )}
        </>
      )}
    </PageContainer>
  );
};
