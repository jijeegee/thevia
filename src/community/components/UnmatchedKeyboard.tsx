// Screen shown when a keyboard is connected but has no JSON definition
// (neither official VIA nor community). Encourages the user to contribute.

import React, {useCallback, useState} from 'react';
import styled from 'styled-components';
import {useCommunitySelector} from '../hooks';
import {getMatchStatus} from '../communitySlice';
import {UploadDialog} from './UploadDialog';

// ── Styled components ──────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 48px 24px;
  text-align: center;
  max-width: 520px;
  margin: 0 auto;
`;

const IconContainer = styled.div`
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(15, 52, 96, 0.15);
  border: 2px solid rgba(15, 52, 96, 0.3);
`;

const KeyboardIcon = styled.span`
  font-size: 36px;
  color: #636e72;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #e0e0e0;
`;

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #b2bec3;
  max-width: 400px;
`;

const DeviceInfoBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  width: 100%;
  max-width: 320px;
`;

const DeviceInfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
`;

const InfoLabel = styled.span`
  color: #636e72;
`;

const InfoValue = styled.span`
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  font-weight: 500;
`;

const ProductNameValue = styled(InfoValue)`
  font-family: inherit;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: #0f3460;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #1a4a7a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 52, 96, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: transparent;
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const HelpText = styled.p`
  margin: 0;
  font-size: 12px;
  color: #636e72;
  max-width: 380px;
  line-height: 1.5;
`;

const HelpLink = styled.a`
  color: #74b9ff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

// ── Component ──────────────────────────────────────────────────────

interface UnmatchedKeyboardProps {
  vendorId: number;
  productId: number;
  productName: string;
  onUseLocally?: (json: unknown) => void;
}

export const UnmatchedKeyboard: React.FC<UnmatchedKeyboardProps> = ({
  vendorId,
  productId,
  productName,
  onUseLocally,
}) => {
  const matchStatus = useCommunitySelector(getMatchStatus);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleSearchCommunity = useCallback(() => {
    // Open the community search page (or trigger a manual search)
    // For now, this would be a link to the community website
    const searchUrl = `https://thevia.app/search?vid=${vendorId}&pid=${productId}`;
    window.open(searchUrl, '_blank', 'noopener');
  }, [vendorId, productId]);

  // Only show when the community search returned no results
  if (matchStatus !== 'not_found') {
    return null;
  }

  const vidHex = `0x${vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
  const pidHex = `0x${productId.toString(16).toUpperCase().padStart(4, '0')}`;

  return (
    <>
      <Container>
        <IconContainer>
          <KeyboardIcon>{'\u2328'}</KeyboardIcon>
        </IconContainer>

        <Title>Keyboard Not Recognized</Title>

        <Description>
          Your keyboard was detected but no VIA definition was found -- not in
          the official VIA database, and not in the community library either.
        </Description>

        <DeviceInfoBox>
          <DeviceInfoRow>
            <InfoLabel>Product</InfoLabel>
            <ProductNameValue title={productName}>
              {productName || 'Unknown'}
            </ProductNameValue>
          </DeviceInfoRow>
          <DeviceInfoRow>
            <InfoLabel>Vendor ID</InfoLabel>
            <InfoValue>{vidHex}</InfoValue>
          </DeviceInfoRow>
          <DeviceInfoRow>
            <InfoLabel>Product ID</InfoLabel>
            <InfoValue>{pidHex}</InfoValue>
          </DeviceInfoRow>
        </DeviceInfoBox>

        <ButtonGroup>
          <PrimaryButton onClick={() => setIsUploadOpen(true)}>
            {'\u2B06'} Upload JSON
          </PrimaryButton>
          <SecondaryButton onClick={handleSearchCommunity}>
            {'\uD83D\uDD0D'} Search Community
          </SecondaryButton>
        </ButtonGroup>

        <HelpText>
          If you have a VIA-compatible JSON file for this keyboard, upload it
          to help others with the same board. Don&apos;t have one? Check{' '}
          <HelpLink
            href="https://www.caniusevia.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            caniusevia.com
          </HelpLink>{' '}
          or your keyboard manufacturer&apos;s website.
        </HelpText>
      </Container>

      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUseLocally={onUseLocally}
        prefillVendorId={vendorId}
        prefillProductId={productId}
      />
    </>
  );
};
