// Modal dialog for uploading VIA JSON definitions to the community
// Includes file picker, validation preview, optional nickname, and upload/local-only actions

import React, {useCallback, useRef, useState} from 'react';
import styled, {keyframes} from 'styled-components';
import {useCommunityDispatch, useCommunitySelector} from '../hooks';
import {
  getUploadStatus,
  getCommunityError,
  uploadCommunityDefinition,
  resetUploadStatus,
} from '../communitySlice';
import {
  validateViaJsonString,
  type ValidationResult,
} from '../json-validator';

// ── Animations ─────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

// ── Styled components ──────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: ${fadeIn} 0.15s ease;
`;

const Dialog = styled.div`
  width: 480px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: ${scaleIn} 0.2s ease;
`;

const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;

const DialogTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #636e72;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e0e0e0;
  }
`;

const DialogBody = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DropZone = styled.div<{$isDragging: boolean; $hasFile: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed
    ${(p) => {
      if (p.$isDragging) return '#74b9ff';
      if (p.$hasFile) return 'rgba(0, 184, 148, 0.4)';
      return 'rgba(255, 255, 255, 0.12)';
    }};
  border-radius: 8px;
  background: ${(p) => {
    if (p.$isDragging) return 'rgba(116, 185, 255, 0.05)';
    if (p.$hasFile) return 'rgba(0, 184, 148, 0.03)';
    return 'rgba(255, 255, 255, 0.02)';
  }};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.03);
  }
`;

const DropZoneIcon = styled.span`
  font-size: 28px;
  color: #636e72;
`;

const DropZoneText = styled.span`
  font-size: 13px;
  color: #b2bec3;
  text-align: center;
`;

const DropZoneHint = styled.span`
  font-size: 11px;
  color: #636e72;
`;

const HiddenInput = styled.input`
  display: none;
`;

const FileName = styled.div`
  font-size: 13px;
  color: #00b894;
  font-weight: 500;
`;

const ValidationSection = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
`;

const ValidationHeader = styled.div<{$valid: boolean}>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: ${(p) =>
    p.$valid
      ? 'rgba(0, 184, 148, 0.08)'
      : 'rgba(225, 112, 85, 0.08)'};
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => (p.$valid ? '#00b894' : '#e17055')};
`;

const ValidationIcon = styled.span`
  font-size: 14px;
`;

const ValidationDetails = styled.div`
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DetailRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
`;

const DetailLabel = styled.span`
  color: #636e72;
  min-width: 80px;
`;

const DetailValue = styled.span`
  color: #e0e0e0;
  font-weight: 500;
  font-family: 'Courier New', monospace;
`;

const ErrorList = styled.ul`
  margin: 0;
  padding: 0 0 0 16px;
  list-style: disc;
`;

const ErrorItem = styled.li`
  font-size: 11px;
  color: #e17055;
  margin: 2px 0;

  code {
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #fdcb6e;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: #b2bec3;
`;

const TextInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #e0e0e0;
  font-size: 13px;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: rgba(15, 52, 96, 0.8);
  }

  &::placeholder {
    color: #636e72;
  }
`;

const SelectInput = styled.select`
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #e0e0e0;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: rgba(15, 52, 96, 0.8);
  }

  option {
    background: #1a1a2e;
    color: #e0e0e0;
  }
`;

const DialogFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
`;

const Button = styled.button<{$variant: 'primary' | 'secondary' | 'ghost'}>`
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  ${(p) => {
    switch (p.$variant) {
      case 'primary':
        return `
          background: #0f3460;
          color: #ffffff;
          &:hover { background: #1a4a7a; }
          &:disabled {
            background: rgba(15, 52, 96, 0.4);
            color: rgba(255, 255, 255, 0.4);
            cursor: not-allowed;
          }
        `;
      case 'secondary':
        return `
          background: rgba(255, 255, 255, 0.06);
          color: #e0e0e0;
          &:hover { background: rgba(255, 255, 255, 0.1); }
        `;
      case 'ghost':
        return `
          background: transparent;
          color: #636e72;
          &:hover { color: #e0e0e0; }
        `;
    }
  }}
`;

const SuccessMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
`;

const SuccessIcon = styled.div`
  font-size: 40px;
  color: #00b894;
`;

const SuccessText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
`;

const SuccessSubtext = styled.div`
  font-size: 12px;
  color: #636e72;
`;

const ErrorBanner = styled.div`
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(225, 112, 85, 0.1);
  border: 1px solid rgba(225, 112, 85, 0.2);
  color: #e17055;
  font-size: 12px;
`;

// ── Component ──────────────────────────────────────────────────────

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseLocally?: (json: unknown) => void;
  prefillVendorId?: number;
  prefillProductId?: number;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
  isOpen,
  onClose,
  onUseLocally,
  prefillVendorId,
  prefillProductId,
}) => {
  const dispatch = useCommunityDispatch();
  const uploadStatus = useCommunitySelector(getUploadStatus);
  const communityError = useCommunitySelector(getCommunityError);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [validation, setValidation] = useState<
    (ValidationResult & {parsedJson: unknown}) | null
  >(null);
  const [isDragging, setIsDragging] = useState(false);
  const [nickname, setNickname] = useState('');
  const [connectionType, setConnectionType] = useState<'usb' | 'dongle'>('usb');

  const handleFile = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileContent(content);
        const result = validateViaJsonString(content);
        setValidation(result);
      };
      reader.readAsText(selectedFile);
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.name.endsWith('.json')) {
        handleFile(droppedFile);
      }
    },
    [handleFile],
  );

  const handleUpload = useCallback(() => {
    if (!file || !validation?.valid) return;
    dispatch(
      uploadCommunityDefinition({
        file,
        metadata: {
          uploaderName: nickname.trim() || undefined,
          connectionType,
        },
      }),
    );
  }, [dispatch, file, validation, nickname, connectionType]);

  const handleUseLocally = useCallback(() => {
    if (validation?.parsedJson && onUseLocally) {
      onUseLocally(validation.parsedJson);
      onClose();
    }
  }, [validation, onUseLocally, onClose]);

  const handleClose = useCallback(() => {
    setFile(null);
    setFileContent(null);
    setValidation(null);
    setNickname('');
    setConnectionType('usb');
    dispatch(resetUploadStatus());
    onClose();
  }, [dispatch, onClose]);

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Upload Keyboard JSON</DialogTitle>
          <CloseButton onClick={handleClose}>{'\u2715'}</CloseButton>
        </DialogHeader>

        <DialogBody>
          {/* Upload success state */}
          {uploadStatus === 'success' ? (
            <SuccessMessage>
              <SuccessIcon>{'\u2713'}</SuccessIcon>
              <SuccessText>Definition uploaded successfully!</SuccessText>
              <SuccessSubtext>
                Thank you for contributing to the community. Your definition
                will be available to other users immediately.
              </SuccessSubtext>
              <Button $variant="primary" onClick={handleClose}>
                Done
              </Button>
            </SuccessMessage>
          ) : (
            <>
              {/* File picker / drop zone */}
              <DropZone
                $isDragging={isDragging}
                $hasFile={!!file}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <HiddenInput
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <>
                    <DropZoneIcon>{'\uD83D\uDCC4'}</DropZoneIcon>
                    <FileName>{file.name}</FileName>
                    <DropZoneHint>Click to choose a different file</DropZoneHint>
                  </>
                ) : (
                  <>
                    <DropZoneIcon>{'\u2B06'}</DropZoneIcon>
                    <DropZoneText>
                      Drop a VIA JSON file here, or click to browse
                    </DropZoneText>
                    <DropZoneHint>Supports .json files</DropZoneHint>
                  </>
                )}
              </DropZone>

              {/* Validation results */}
              {validation && (
                <ValidationSection>
                  <ValidationHeader $valid={validation.valid}>
                    <ValidationIcon>
                      {validation.valid ? '\u2713' : '\u2717'}
                    </ValidationIcon>
                    {validation.valid
                      ? 'Valid VIA definition'
                      : 'Invalid VIA definition'}
                  </ValidationHeader>
                  <ValidationDetails>
                    {validation.parsed.name && (
                      <DetailRow>
                        <DetailLabel>Name:</DetailLabel>
                        <DetailValue>{validation.parsed.name}</DetailValue>
                      </DetailRow>
                    )}
                    {validation.parsed.vendorId !== null && (
                      <DetailRow>
                        <DetailLabel>Vendor ID:</DetailLabel>
                        <DetailValue>
                          0x{validation.parsed.vendorId.toString(16).toUpperCase().padStart(4, '0')}
                        </DetailValue>
                      </DetailRow>
                    )}
                    {validation.parsed.productId !== null && (
                      <DetailRow>
                        <DetailLabel>Product ID:</DetailLabel>
                        <DetailValue>
                          0x{validation.parsed.productId.toString(16).toUpperCase().padStart(4, '0')}
                        </DetailValue>
                      </DetailRow>
                    )}
                    {validation.parsed.matrix && (
                      <DetailRow>
                        <DetailLabel>Matrix:</DetailLabel>
                        <DetailValue>
                          {validation.parsed.matrix.rows} x{' '}
                          {validation.parsed.matrix.cols}
                        </DetailValue>
                      </DetailRow>
                    )}
                    {validation.errors.length > 0 && (
                      <ErrorList>
                        {validation.errors.map((err, i) => (
                          <ErrorItem key={i}>
                            <code>{err.path}</code>: {err.message}
                          </ErrorItem>
                        ))}
                      </ErrorList>
                    )}
                  </ValidationDetails>
                </ValidationSection>
              )}

              {/* Metadata inputs */}
              {validation?.valid && (
                <>
                  <InputGroup>
                    <Label>Nickname (optional)</Label>
                    <TextInput
                      type="text"
                      placeholder="Your name or alias"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={50}
                    />
                  </InputGroup>

                  <InputGroup>
                    <Label>Connection type</Label>
                    <SelectInput
                      value={connectionType}
                      onChange={(e) =>
                        setConnectionType(e.target.value as 'usb' | 'dongle')
                      }
                    >
                      <option value="usb">USB (wired)</option>
                      <option value="dongle">Dongle (wireless receiver)</option>
                    </SelectInput>
                  </InputGroup>
                </>
              )}

              {/* Error message */}
              {communityError && uploadStatus === 'error' && (
                <ErrorBanner>{communityError}</ErrorBanner>
              )}
            </>
          )}
        </DialogBody>

        {/* Footer actions - only show when not in success state */}
        {uploadStatus !== 'success' && (
          <DialogFooter>
            <Button $variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            {onUseLocally && validation?.valid && (
              <Button $variant="secondary" onClick={handleUseLocally}>
                Use locally only
              </Button>
            )}
            <Button
              $variant="primary"
              onClick={handleUpload}
              disabled={
                !file ||
                !validation?.valid ||
                uploadStatus === 'uploading'
              }
            >
              {uploadStatus === 'uploading'
                ? 'Uploading...'
                : 'Share with community'}
            </Button>
          </DialogFooter>
        )}
      </Dialog>
    </Overlay>
  );
};
