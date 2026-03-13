// Session tracker for community JSON trust scoring
// Tracks usage sessions and reports outcomes to the backend

import {recordSession} from './api';

const FINGERPRINT_KEY = 'thevia_fingerprint';
const SESSION_KEY = 'thevia_active_session';

interface ActiveSession {
  definitionId: string;
  startedAt: number;
  replaced: boolean;
}

// ── Fingerprint ────────────────────────────────────────────────────

/**
 * Get or create a persistent UUID for this browser instance.
 * Used as a session hash for anonymous session tracking.
 */
export function getFingerprint(): string {
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

// ── Session state ──────────────────────────────────────────────────

let activeSession: ActiveSession | null = null;
let beforeUnloadRegistered = false;

function persistSession(session: ActiveSession | null): void {
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function loadPersistedSession(): ActiveSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// ── Session lifecycle ──────────────────────────────────────────────

/**
 * Start tracking a new session for a community definition.
 * If there is already an active session for a different definition,
 * it will be ended with 'replaced' outcome first.
 */
export function startSession(definitionId: string): void {
  // If we already have an active session for a different definition, mark it replaced
  if (activeSession && activeSession.definitionId !== definitionId) {
    endSession('replaced');
  }

  // If same definition is already active, do nothing
  if (activeSession && activeSession.definitionId === definitionId) {
    return;
  }

  activeSession = {
    definitionId,
    startedAt: Date.now(),
    replaced: false,
  };
  persistSession(activeSession);

  // Register beforeunload handler once
  if (!beforeUnloadRegistered) {
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Also handle visibilitychange for mobile browsers
    document.addEventListener('visibilitychange', handleVisibilityChange);
    beforeUnloadRegistered = true;
  }
}

/**
 * Mark that the current session's JSON was replaced (switched to another).
 * This will cause a 'replaced' outcome when the session ends.
 */
export function markReplaced(): void {
  if (activeSession) {
    activeSession.replaced = true;
    persistSession(activeSession);
  }
}

/**
 * End the current session and report the outcome to the backend.
 * This is called automatically on page unload, but can also be called
 * manually when switching definitions.
 */
export function endSession(
  outcome?: 'completed' | 'replaced' | 'errored',
): void {
  if (!activeSession) return;

  const session = activeSession;
  activeSession = null;
  persistSession(null);

  const resolvedOutcome =
    outcome || (session.replaced ? 'replaced' : 'completed');
  const durationSec = Math.round((Date.now() - session.startedAt) / 1000);

  // Only report sessions that lasted at least 5 seconds
  if (durationSec < 5) return;

  const fingerprint = getFingerprint();

  // Use sendBeacon for reliability during page unload
  // Fall back to regular fetch if sendBeacon is not available or fails
  const payload = JSON.stringify({
    sessionHash: fingerprint,
    outcome: resolvedOutcome,
    durationSec,
  });

  const apiBase =
    localStorage.getItem('thevia_api_url') ||
    import.meta.env.VITE_THEVIA_API_URL ||
    'https://api.thevia.app/api/v1';

  const url = `${apiBase}/definitions/${session.definitionId}/session`;

  const sent = navigator.sendBeacon?.(
    url,
    new Blob([payload], {type: 'application/json'}),
  );

  if (!sent) {
    // Fire-and-forget fetch as fallback
    recordSession(
      session.definitionId,
      fingerprint,
      resolvedOutcome,
      durationSec,
    ).catch(() => {
      // Silently ignore errors during cleanup
    });
  }
}

/**
 * Clean up any persisted session from a previous page load.
 * Should be called on app initialization.
 */
export function recoverOrphanedSession(): void {
  const orphaned = loadPersistedSession();
  if (orphaned) {
    // The previous session didn't get a chance to end properly
    activeSession = orphaned;
    endSession('completed');
  }
}

// ── Event handlers ─────────────────────────────────────────────────

function handleBeforeUnload(): void {
  endSession();
}

function handleVisibilityChange(): void {
  // On mobile, pages can be terminated without beforeunload
  // Report when the page becomes hidden (but don't clear the session
  // in case the user comes back)
  if (document.visibilityState === 'hidden' && activeSession) {
    const session = activeSession;
    const resolvedOutcome = session.replaced ? 'replaced' : 'completed';
    const durationSec = Math.round((Date.now() - session.startedAt) / 1000);

    if (durationSec < 5) return;

    const fingerprint = getFingerprint();
    const payload = JSON.stringify({
      sessionHash: fingerprint,
      outcome: resolvedOutcome,
      durationSec,
    });

    const apiBase =
      localStorage.getItem('thevia_api_url') ||
      import.meta.env.VITE_THEVIA_API_URL ||
      'https://api.thevia.app/api/v1';

    const url = `${apiBase}/definitions/${session.definitionId}/session`;

    navigator.sendBeacon?.(
      url,
      new Blob([payload], {type: 'application/json'}),
    );
  }
}

/**
 * Tear down session tracking. Useful for testing or cleanup.
 */
export function destroySessionTracker(): void {
  if (beforeUnloadRegistered) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    beforeUnloadRegistered = false;
  }
  activeSession = null;
  persistSession(null);
}
