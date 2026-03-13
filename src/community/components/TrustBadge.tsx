// Trust level badge component
// Displays a colored badge indicating the trust level of a community definition

import React from 'react';
import styled from 'styled-components';
import {getTrustLevel, type TrustLevel} from '../api';

// ── Color mapping ──────────────────────────────────────────────────

const TRUST_COLORS: Record<TrustLevel, {bg: string; text: string; border: string}> = {
  verified: {bg: 'rgba(0, 184, 148, 0.15)', text: '#00b894', border: '#00b894'},
  trusted: {bg: 'rgba(0, 184, 148, 0.10)', text: '#00b894', border: 'rgba(0, 184, 148, 0.5)'},
  unverified: {bg: 'rgba(253, 203, 110, 0.12)', text: '#fdcb6e', border: 'rgba(253, 203, 110, 0.5)'},
  new: {bg: 'rgba(99, 110, 114, 0.12)', text: '#b2bec3', border: 'rgba(99, 110, 114, 0.5)'},
  flagged: {bg: 'rgba(225, 112, 85, 0.12)', text: '#e17055', border: 'rgba(225, 112, 85, 0.5)'},
};

const TRUST_LABELS: Record<TrustLevel, string> = {
  verified: 'Verified',
  trusted: 'Trusted',
  unverified: 'Unverified',
  new: 'New',
  flagged: 'Flagged',
};

const TRUST_ICONS: Record<TrustLevel, string> = {
  verified: '\u2713\u2713', // double check
  trusted: '\u2713',       // check
  unverified: '?',
  new: '\u2022',           // bullet
  flagged: '!',
};

// ── Styled components ──────────────────────────────────────────────

const BadgeContainer = styled.span<{
  $bg: string;
  $color: string;
  $border: string;
  $size: 'small' | 'medium';
}>`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => (p.$size === 'small' ? '3px' : '4px')};
  padding: ${(p) => (p.$size === 'small' ? '1px 6px' : '2px 8px')};
  border-radius: 10px;
  font-size: ${(p) => (p.$size === 'small' ? '10px' : '11px')};
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border: 1px solid ${(p) => p.$border};
  white-space: nowrap;
  user-select: none;
  line-height: 1.4;
`;

const IconSpan = styled.span`
  font-size: inherit;
  line-height: 1;
`;

// ── Component ──────────────────────────────────────────────────────

interface TrustBadgeProps {
  score: number;
  size?: 'small' | 'medium';
  showScore?: boolean;
  className?: string;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  score,
  size = 'medium',
  showScore = false,
  className,
}) => {
  const level = getTrustLevel(score);
  const colors = TRUST_COLORS[level];
  const label = TRUST_LABELS[level];
  const icon = TRUST_ICONS[level];

  return (
    <BadgeContainer
      $bg={colors.bg}
      $color={colors.text}
      $border={colors.border}
      $size={size}
      className={className}
      title={`Trust score: ${score}`}
    >
      <IconSpan>{icon}</IconSpan>
      {label}
      {showScore && ` (${score})`}
    </BadgeContainer>
  );
};
