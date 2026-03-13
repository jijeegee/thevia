// Top notification bar for community JSON matches
// Appears when a community definition is automatically matched to a connected keyboard
// Shows keyboard info, trust badge, vote buttons, and alternative definition dropdown

import React from 'react';
import styled, {keyframes} from 'styled-components';
import {useCommunityDispatch, useCommunitySelector} from '../hooks';
import {
  dismissNotification,
  getAvailableDefinitions,
  getIsDismissed,
  getMatchedDefinition,
  getMatchStatus,
} from '../communitySlice';
import {TrustBadge} from './TrustBadge';
import {VoteButtons} from './VoteButtons';
import {JsonDropdown} from './JsonDropdown';

// ── Animations ─────────────────────────────────────────────────────

const slideDown = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// ── Styled components ──────────────────────────────────────────────

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-bottom: 1px solid rgba(15, 52, 96, 0.5);
  animation: ${slideDown} 0.25s ease-out;
  flex-wrap: wrap;
  min-height: 40px;
  position: relative;
  z-index: 100;
`;

const CommunityLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(15, 52, 96, 0.5);
  color: #74b9ff;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
`;

const KeyboardName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
`;

const MetaInfo = styled.span`
  font-size: 11px;
  color: #636e72;
  white-space: nowrap;
  flex-shrink: 0;
`;

const Spacer = styled.div`
  flex: 1;
  min-width: 8px;
`;

const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #636e72;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e0e0e0;
  }
`;

const SearchingBar = styled(Bar)`
  justify-content: center;
`;

const SearchingText = styled.span`
  font-size: 12px;
  color: #b2bec3;
`;

const pulseAnimation = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const PulsingDot = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #74b9ff;
  margin-right: 8px;
  animation: ${pulseAnimation} 1.2s ease-in-out infinite;
`;

// ── Component ──────────────────────────────────────────────────────

export const NotificationBar: React.FC = () => {
  const dispatch = useCommunityDispatch();
  const matchStatus = useCommunitySelector(getMatchStatus);
  const matchedDefinition = useCommunitySelector(getMatchedDefinition);
  const availableDefinitions = useCommunitySelector(getAvailableDefinitions);
  const isDismissed = useCommunitySelector(getIsDismissed);

  // Show searching state
  if (matchStatus === 'searching') {
    return (
      <SearchingBar>
        <PulsingDot />
        <SearchingText>
          Searching community definitions...
        </SearchingText>
      </SearchingBar>
    );
  }

  // Only show when matched and not dismissed
  if (matchStatus !== 'matched' || !matchedDefinition || isDismissed) {
    return null;
  }

  const uploaderInfo = matchedDefinition.uploaderName
    ? `by ${matchedDefinition.uploaderName}`
    : '';

  return (
    <Bar>
      <CommunityLabel>Community</CommunityLabel>
      <KeyboardName title={matchedDefinition.keyboardName}>
        {matchedDefinition.keyboardName}
      </KeyboardName>
      <TrustBadge score={matchedDefinition.trustScore} size="small" />
      {uploaderInfo && <MetaInfo>{uploaderInfo}</MetaInfo>}
      <MetaInfo>
        {matchedDefinition.sessionCount > 0 &&
          `${matchedDefinition.sessionCount} sessions`}
      </MetaInfo>

      <Spacer />

      <ActionGroup>
        <VoteButtons
          definitionId={matchedDefinition.id}
          upvotes={matchedDefinition.upvotes}
          downvotes={matchedDefinition.downvotes}
        />
        {availableDefinitions.length > 1 && <JsonDropdown />}
        <CloseButton
          onClick={() => dispatch(dismissNotification())}
          title="Dismiss notification"
        >
          {'\u2715'}
        </CloseButton>
      </ActionGroup>
    </Bar>
  );
};
