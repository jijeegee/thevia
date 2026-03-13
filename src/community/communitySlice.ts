// Redux slice for community JSON matching state
// Manages search results, matched definitions, voting, uploads, and session tracking

import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../store';
import {
  CommunityDefinition,
  getDefinitionJson,
  recordVote,
  searchDefinitions,
  uploadDefinition,
} from './api';
import {getFingerprint, markReplaced, startSession} from './session-tracker';


// ── Types ──────────────────────────────────────────────────────────

type MatchStatus = 'idle' | 'searching' | 'matched' | 'not_found';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface SearchedDevice {
  vendorId: number;
  productId: number;
  productName: string;
}

export interface CommunityState {
  matchedDefinition: CommunityDefinition | null;
  matchedDefinitionJson: unknown | null;
  availableDefinitions: CommunityDefinition[];
  matchStatus: MatchStatus;
  communityEnabled: boolean;
  uploadStatus: UploadStatus;
  error: string | null;
  userVotes: Record<string, 'up' | 'down'>; // definitionId -> vote type
  dismissed: boolean;
  lastSearchedDevice: SearchedDevice | null;
}

const COMMUNITY_ENABLED_KEY = 'thevia_community_enabled';

function loadCommunityEnabled(): boolean {
  const stored = localStorage.getItem(COMMUNITY_ENABLED_KEY);
  // Default to enabled
  if (stored === null) return true;
  return stored === 'true';
}

const initialState: CommunityState = {
  matchedDefinition: null,
  matchedDefinitionJson: null,
  availableDefinitions: [],
  matchStatus: 'idle',
  communityEnabled: loadCommunityEnabled(),
  uploadStatus: 'idle',
  error: null,
  userVotes: {},
  dismissed: false,
  lastSearchedDevice: null,
};

// ── Async Thunks ───────────────────────────────────────────────────

export const searchCommunityDefinition = createAsyncThunk<
  {definitions: CommunityDefinition[]; json: unknown} | null,
  {vendorId: number; productId: number; productName?: string},
  {state: RootState; rejectValue: string}
>(
  'community/searchDefinition',
  async ({vendorId, productId, productName}, {rejectWithValue}) => {
    try {
      const definitions = await searchDefinitions(
        vendorId,
        productId,
        productName,
      );

      if (definitions.length === 0) {
        return null;
      }

      // Pick the best match: highest trust score, then most upvotes
      const sorted = [...definitions].sort((a, b) => {
        if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
        return b.upvotes - a.upvotes;
      });

      const best = sorted[0];
      const json = await getDefinitionJson(best.id);

      return {definitions: sorted, json};
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to search community definitions';
      return rejectWithValue(message);
    }
  },
);

export const loadCommunityDefinitionJson = createAsyncThunk<
  unknown,
  string, // definitionId
  {state: RootState; rejectValue: string}
>(
  'community/loadDefinitionJson',
  async (definitionId, {rejectWithValue}) => {
    try {
      return await getDefinitionJson(definitionId);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to load definition JSON';
      return rejectWithValue(message);
    }
  },
);

export const uploadCommunityDefinition = createAsyncThunk<
  CommunityDefinition,
  {file: File; metadata: {uploaderName?: string; connectionType?: 'usb' | 'dongle'}},
  {state: RootState; rejectValue: string}
>(
  'community/uploadDefinition',
  async ({file, metadata}, {rejectWithValue}) => {
    try {
      const formData = new FormData();
      formData.append('json', file);
      if (metadata.uploaderName) {
        formData.append('uploaderName', metadata.uploaderName);
      }
      if (metadata.connectionType) {
        formData.append('connectionType', metadata.connectionType);
      }
      formData.append('uploaderHash', getFingerprint());

      return await uploadDefinition(formData);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to upload definition';
      return rejectWithValue(message);
    }
  },
);

export const voteCommunityDefinition = createAsyncThunk<
  {definitionId: string; vote: 'up' | 'down'; upvotes: number; downvotes: number; trustScore: number},
  {definitionId: string; voteType: 'up' | 'down'},
  {state: RootState; rejectValue: string}
>(
  'community/voteDefinition',
  async ({definitionId, voteType}, {rejectWithValue}) => {
    try {
      const voterHash = getFingerprint();
      const result = await recordVote(definitionId, voterHash, voteType);
      return {
        definitionId,
        vote: result.userVote,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        trustScore: result.trustScore,
      };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to record vote';
      return rejectWithValue(message);
    }
  },
);

// ── Slice ──────────────────────────────────────────────────────────

const communitySlice = createSlice({
  name: 'community',
  initialState,
  reducers: {
    setCommunityEnabled(state, action: PayloadAction<boolean>) {
      state.communityEnabled = action.payload;
      localStorage.setItem(COMMUNITY_ENABLED_KEY, String(action.payload));
    },

    selectDefinition(state, action: PayloadAction<CommunityDefinition>) {
      // Mark the old definition's session as replaced
      if (
        state.matchedDefinition &&
        state.matchedDefinition.id !== action.payload.id
      ) {
        markReplaced();
      }
      state.matchedDefinition = action.payload;
      state.matchedDefinitionJson = null; // Will be loaded by thunk
      state.dismissed = false;
    },

    clearCommunityMatch(state) {
      state.matchedDefinition = null;
      state.matchedDefinitionJson = null;
      state.availableDefinitions = [];
      state.matchStatus = 'idle';
      state.error = null;
      state.dismissed = false;
      state.lastSearchedDevice = null;
    },

    dismissNotification(state) {
      state.dismissed = true;
    },

    resetUploadStatus(state) {
      state.uploadStatus = 'idle';
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ── Search ───────────────────────────────────────────────
    builder
      .addCase(searchCommunityDefinition.pending, (state, action) => {
        state.matchStatus = 'searching';
        state.error = null;
        state.dismissed = false;
        state.lastSearchedDevice = {
          vendorId: action.meta.arg.vendorId,
          productId: action.meta.arg.productId,
          productName: action.meta.arg.productName || '',
        };
      })
      .addCase(searchCommunityDefinition.fulfilled, (state, action) => {
        if (action.payload === null) {
          state.matchStatus = 'not_found';
          state.matchedDefinition = null;
          state.matchedDefinitionJson = null;
          state.availableDefinitions = [];
        } else {
          state.matchStatus = 'matched';
          state.availableDefinitions = action.payload.definitions;
          state.matchedDefinition = action.payload.definitions[0];
          state.matchedDefinitionJson = action.payload.json;
          // Start session tracking for the matched definition
          startSession(action.payload.definitions[0].id);
        }
      })
      .addCase(searchCommunityDefinition.rejected, (state, action) => {
        state.matchStatus = 'not_found';
        state.error = action.payload || 'Search failed';
      });

    // ── Load specific definition JSON ────────────────────────
    builder
      .addCase(loadCommunityDefinitionJson.fulfilled, (state, action) => {
        state.matchedDefinitionJson = action.payload;
        // Start session tracking for the newly loaded definition
        if (state.matchedDefinition) {
          startSession(state.matchedDefinition.id);
        }
      })
      .addCase(loadCommunityDefinitionJson.rejected, (state, action) => {
        state.error = action.payload || 'Failed to load definition';
      });

    // ── Upload ───────────────────────────────────────────────
    builder
      .addCase(uploadCommunityDefinition.pending, (state) => {
        state.uploadStatus = 'uploading';
        state.error = null;
      })
      .addCase(uploadCommunityDefinition.fulfilled, (state, action) => {
        state.uploadStatus = 'success';
        // Add the new definition to the available list
        state.availableDefinitions = [
          action.payload,
          ...state.availableDefinitions,
        ];
      })
      .addCase(uploadCommunityDefinition.rejected, (state, action) => {
        state.uploadStatus = 'error';
        state.error = action.payload || 'Upload failed';
      });

    // ── Vote ─────────────────────────────────────────────────
    builder
      .addCase(voteCommunityDefinition.fulfilled, (state, action) => {
        const {definitionId, vote, upvotes, downvotes, trustScore} =
          action.payload;
        state.userVotes[definitionId] = vote;

        // Update the matched definition if it's the one being voted on
        if (state.matchedDefinition?.id === definitionId) {
          state.matchedDefinition.upvotes = upvotes;
          state.matchedDefinition.downvotes = downvotes;
          state.matchedDefinition.trustScore = trustScore;
        }

        // Update in available definitions list
        const idx = state.availableDefinitions.findIndex(
          (d) => d.id === definitionId,
        );
        if (idx !== -1) {
          state.availableDefinitions[idx].upvotes = upvotes;
          state.availableDefinitions[idx].downvotes = downvotes;
          state.availableDefinitions[idx].trustScore = trustScore;
        }
      })
      .addCase(voteCommunityDefinition.rejected, (state, action) => {
        state.error = action.payload || 'Vote failed';
      });
  },
});

export const {
  setCommunityEnabled,
  selectDefinition,
  clearCommunityMatch,
  dismissNotification,
  resetUploadStatus,
} = communitySlice.actions;

export default communitySlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────

export const getCommunityState = (state: RootState) =>
  state.community;
export const getMatchedDefinition = (state: RootState) =>
  state.community.matchedDefinition;
export const getMatchedDefinitionJson = (state: RootState) =>
  state.community.matchedDefinitionJson;
export const getAvailableDefinitions = (state: RootState) =>
  state.community.availableDefinitions;
export const getMatchStatus = (state: RootState) =>
  state.community.matchStatus;
export const getCommunityEnabled = (state: RootState) =>
  state.community.communityEnabled;
export const getUploadStatus = (state: RootState) =>
  state.community.uploadStatus;
export const getCommunityError = (state: RootState) =>
  state.community.error;
export const getUserVotes = (state: RootState) =>
  state.community.userVotes;
export const getIsDismissed = (state: RootState) =>
  state.community.dismissed;
export const getLastSearchedDevice = (state: RootState) =>
  state.community.lastSearchedDevice;
