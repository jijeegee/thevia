// Community module typed hooks
// These are typed to include the community slice in the store type,
// so components in the community module can use selectors without
// modifying the main store type until integration is complete.

import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux';
import type {RootState, AppDispatch} from '../store';
import type {CommunityState} from './communitySlice';

// Augmented RootState that includes the community reducer
export type RootStateWithCommunity = RootState & {
  community: CommunityState;
};

export const useCommunitySelector: TypedUseSelectorHook<RootStateWithCommunity> =
  useSelector;
export const useCommunityDispatch: () => AppDispatch = useDispatch;
