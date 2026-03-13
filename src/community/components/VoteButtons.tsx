// Vote buttons component for upvoting/downvoting community definitions
// Uses localStorage fingerprint for voter identification

import React, {useCallback} from 'react';
import styled from 'styled-components';
import {useCommunityDispatch, useCommunitySelector} from '../hooks';
import {getUserVotes, voteCommunityDefinition} from '../communitySlice';

// ── Styled components ──────────────────────────────────────────────

const VoteContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 2px;
`;

const VoteButton = styled.button<{$active: boolean; $type: 'up' | 'down'}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  line-height: 1;

  background: ${(p) => {
    if (p.$active && p.$type === 'up') return 'rgba(0, 184, 148, 0.2)';
    if (p.$active && p.$type === 'down') return 'rgba(225, 112, 85, 0.2)';
    return 'transparent';
  }};

  color: ${(p) => {
    if (p.$active && p.$type === 'up') return '#00b894';
    if (p.$active && p.$type === 'down') return '#e17055';
    return '#b2bec3';
  }};

  &:hover {
    background: ${(p) => {
      if (p.$type === 'up') return 'rgba(0, 184, 148, 0.15)';
      return 'rgba(225, 112, 85, 0.15)';
    }};
    color: ${(p) => (p.$type === 'up' ? '#00b894' : '#e17055')};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const VoteCount = styled.span`
  font-variant-numeric: tabular-nums;
  min-width: 14px;
  text-align: center;
`;

const ThumbIcon = styled.span`
  font-size: 13px;
  line-height: 1;
`;

const Divider = styled.div`
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
`;

// ── Component ──────────────────────────────────────────────────────

interface VoteButtonsProps {
  definitionId: string;
  upvotes: number;
  downvotes: number;
  compact?: boolean;
  className?: string;
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({
  definitionId,
  upvotes,
  downvotes,
  compact = false,
  className,
}) => {
  const dispatch = useCommunityDispatch();
  const userVotes = useCommunitySelector(getUserVotes);
  const currentVote = userVotes[definitionId] || null;

  const handleVote = useCallback(
    (voteType: 'up' | 'down') => {
      dispatch(voteCommunityDefinition({definitionId, voteType}));
    },
    [dispatch, definitionId],
  );

  return (
    <VoteContainer className={className}>
      <VoteButton
        $active={currentVote === 'up'}
        $type="up"
        onClick={() => handleVote('up')}
        title="This JSON works well"
      >
        <ThumbIcon>{'\u25B2'}</ThumbIcon>
        {!compact && <VoteCount>{upvotes}</VoteCount>}
      </VoteButton>
      <Divider />
      <VoteButton
        $active={currentVote === 'down'}
        $type="down"
        onClick={() => handleVote('down')}
        title="This JSON has issues"
      >
        <ThumbIcon>{'\u25BC'}</ThumbIcon>
        {!compact && <VoteCount>{downvotes}</VoteCount>}
      </VoteButton>
    </VoteContainer>
  );
};
