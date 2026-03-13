// Community module barrel export
// All public APIs for the TheVIA community JSON matching feature

// API client
export {
  searchDefinitions,
  getDefinitionJson,
  uploadDefinition,
  recordVote,
  recordSession,
  getKeyboards,
  getRecentKeyboards,
  getPopularKeyboards,
  getTrustLevel,
  ApiError,
} from './api';
export type {
  CommunityDefinition,
  KeyboardListItem,
  PaginatedResponse,
  VoteResponse,
  SessionResponse,
  TrustLevel,
} from './api';

// Redux slice
export {
  default as communityReducer,
  searchCommunityDefinition,
  loadCommunityDefinitionJson,
  uploadCommunityDefinition,
  voteCommunityDefinition,
  setCommunityEnabled,
  selectDefinition,
  clearCommunityMatch,
  dismissNotification,
  resetUploadStatus,
  getCommunityState,
  getMatchedDefinition,
  getMatchedDefinitionJson,
  getAvailableDefinitions,
  getMatchStatus,
  getCommunityEnabled,
  getUploadStatus,
  getCommunityError,
  getUserVotes,
  getIsDismissed,
  getLastSearchedDevice,
} from './communitySlice';
export type {CommunityState, SearchedDevice} from './communitySlice';

// Community-scoped hooks (use until community reducer is added to the main store)
export {useCommunitySelector, useCommunityDispatch} from './hooks';
export type {RootStateWithCommunity} from './hooks';

// Session tracker
export {
  startSession,
  endSession,
  markReplaced,
  getFingerprint,
  recoverOrphanedSession,
  destroySessionTracker,
} from './session-tracker';

// JSON validator
export {validateViaDefinition, validateViaJsonString} from './json-validator';
export type {ValidationError, ValidationResult} from './json-validator';

// Components
export {TrustBadge} from './components/TrustBadge';
export {VoteButtons} from './components/VoteButtons';
export {JsonDropdown} from './components/JsonDropdown';
export {NotificationBar} from './components/NotificationBar';
export {UploadDialog} from './components/UploadDialog';
export {UnmatchedKeyboard} from './components/UnmatchedKeyboard';
