// Dropdown component for selecting from multiple matching community JSON definitions
// Shows keyboard name, trust level, and upload date for each option

import React, {useCallback, useRef, useState} from 'react';
import styled from 'styled-components';
import {useCommunityDispatch, useCommunitySelector} from '../hooks';
import type {CommunityDefinition} from '../api';
import {
  getAvailableDefinitions,
  getMatchedDefinition,
  loadCommunityDefinitionJson,
  selectDefinition,
} from '../communitySlice';
import {TrustBadge} from './TrustBadge';

// ── Styled components ──────────────────────────────────────────────

const DropdownWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const DropdownTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const ChevronIcon = styled.span<{$open: boolean}>`
  font-size: 10px;
  transition: transform 0.15s ease;
  transform: ${(p) => (p.$open ? 'rotate(180deg)' : 'rotate(0)')};
`;

const DropdownMenu = styled.div<{$visible: boolean}>`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 300px;
  max-height: 280px;
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? 'auto' : 'none')};
  transform: ${(p) => (p.$visible ? 'translateY(0)' : 'translateY(-4px)')};
  transition: all 0.15s ease;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
`;

const DropdownHeader = styled.div`
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #636e72;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;

const DropdownItem = styled.button<{$selected: boolean}>`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: ${(p) =>
    p.$selected ? 'rgba(15, 52, 96, 0.4)' : 'transparent'};
  color: #e0e0e0;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;

  &:hover {
    background: ${(p) =>
      p.$selected ? 'rgba(15, 52, 96, 0.5)' : 'rgba(255, 255, 255, 0.04)'};
  }

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemName = styled.div`
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 11px;
  color: #636e72;
`;

const SelectedIndicator = styled.span`
  color: #0f3460;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  align-self: center;
`;

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(15, 52, 96, 0.5);
  color: #e0e0e0;
  font-size: 11px;
  font-weight: 600;
`;

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return '';
  }
}

// ── Component ──────────────────────────────────────────────────────

interface JsonDropdownProps {
  className?: string;
}

export const JsonDropdown: React.FC<JsonDropdownProps> = ({className}) => {
  const dispatch = useCommunityDispatch();
  const availableDefinitions = useCommunitySelector(getAvailableDefinitions);
  const matchedDefinition = useCommunitySelector(getMatchedDefinition);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = useCallback(
    (definition: CommunityDefinition) => {
      dispatch(selectDefinition(definition));
      dispatch(loadCommunityDefinitionJson(definition.id));
      setIsOpen(false);
    },
    [dispatch],
  );

  // Don't render if there's only one or no definitions
  if (availableDefinitions.length <= 1) {
    return null;
  }

  return (
    <DropdownWrapper ref={wrapperRef} className={className}>
      <DropdownTrigger onClick={() => setIsOpen(!isOpen)}>
        Alternatives
        <CountBadge>{availableDefinitions.length}</CountBadge>
        <ChevronIcon $open={isOpen}>{'\u25BC'}</ChevronIcon>
      </DropdownTrigger>

      <DropdownMenu $visible={isOpen}>
        <DropdownHeader>
          {availableDefinitions.length} definitions available
        </DropdownHeader>
        {availableDefinitions.map((def) => {
          const isSelected = matchedDefinition?.id === def.id;
          return (
            <DropdownItem
              key={def.id}
              $selected={isSelected}
              onClick={() => handleSelect(def)}
            >
              <ItemContent>
                <ItemName>{def.keyboardName}</ItemName>
                <ItemMeta>
                  <TrustBadge score={def.trustScore} size="small" />
                  <span>
                    {'\u25B2'} {def.upvotes} {'\u25BC'} {def.downvotes}
                  </span>
                  {def.uploaderName && <span>by {def.uploaderName}</span>}
                  <span>{formatDate(def.createdAt)}</span>
                </ItemMeta>
              </ItemContent>
              {isSelected && <SelectedIndicator>{'\u2713'}</SelectedIndicator>}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </DropdownWrapper>
  );
};
