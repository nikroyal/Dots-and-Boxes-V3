import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Heartbeat interval — how often we update the user's lastSeen timestamp.
// 20 seconds is a nice tradeoff: snappy enough for "they just disconnected"
// detection, infrequent enough that 100 active users barely dent the
// 20K free-tier writes/day quota (4320 writes/user/day = enough for ~4 users
// playing nonstop, or many more in casual play).
const HEARTBEAT_MS = 20 * 1000;

// How stale a lastSeen has to be before we consider the user disconnected.
export const DISCONNECT_THRESHOLD_MS = 60 * 1000;

let heartbeatTimer = null;
let focusHandler = null;
let activeUid = null;

// Start the heartbeat for the current user. Idempotent — calling twice with
// the same uid is a no-op; calling with a new uid transparently switches.
export function startHeartbeat(uid) {
  if (!uid) return;
  if (activeUid === uid && heartbeatTimer) return; // already running for this uid
  stopHeartbeat(); // tear down any previous listener/interval
  activeUid = uid;
  // Fire one immediately so the user shows online without waiting 20s
  beat(uid);
  heartbeatTimer = setInterval(() => beat(uid), HEARTBEAT_MS);
  // Also beat on focus — covers tab-switch-back cases. Store the
  // handler reference so we can remove it in stopHeartbeat.
  focusHandler = () => beat(uid);
  window.addEventListener('focus', focusHandler);
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler);
    focusHandler = null;
  }
  activeUid = null;
}

async function beat(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() });
  } catch (e) {
    // Could fail during sign-out etc. — swallow.
  }
}

// Given a user object, decide if they appear disconnected.
// Returns true if lastSeen is older than DISCONNECT_THRESHOLD_MS.
// Returns false if lastSeen is recent OR missing (we don't punish users
// who haven't opened the app since deploying this feature).
export function isDisconnected(userData) {
  if (!userData?.lastSeen) return false;
  const ts = userData.lastSeen.toMillis ? userData.lastSeen.toMillis() : 0;
  if (!ts) return false;
  return Date.now() - ts > DISCONNECT_THRESHOLD_MS;
}
