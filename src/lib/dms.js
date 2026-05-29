import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Guard ────────────────────────────────────────────────────────────────
function guard(user) {
  if (user?._isImpersonated) {
    throw new Error('Action blocked: you are in read-only impersonation mode.');
  }
}

// Conversation IDs are deterministic — sort the two UIDs and join. This means
// "is there an existing conversation between A and B" is just a doc lookup
// instead of a query, which is faster and cheaper.
export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

// Get or create a message request between current user and target.
// Returns the conversation id.
export async function openConversation(currentUser, target) {
  guard(currentUser);
  const convId = conversationId(currentUser.id, target.id);
  const convRef = doc(db, 'conversations', convId);

  try {
    const snap = await getDoc(convRef);
    if (snap.exists()) return convId;
  } catch (err) {
    // A first-time conversation may be denied by rules on getDoc because the
    // document does not exist yet, so there is no participants array to check.
    // Creating the deterministic document below is still validated by rules.
    if (err.code !== 'permission-denied') throw err;
  }

  // The Firestore rule requires participants[0] < participants[1] to match
  // the sorted-uid convId — so we sort here, not just in conversationId().
  // (conversationId is a pure helper; this is the create site.)
  const participants = [currentUser.id, target.id].sort();
  const now = Date.now();

  await setDoc(convRef, {
    participants,
    participantInfo: {
      [currentUser.id]: {
        username: currentUser.username,
        avatar: currentUser.avatar || '◆',
      },
      [target.id]: {
        username: target.username,
        avatar: target.avatar || '◆',
      },
    },
    status: 'pending',
    requestedBy: currentUser.id,
    requestedAt: serverTimestamp(),
    lastMessage: { text: 'Message request', fromId: currentUser.id, ts: now, system: true },
    lastMessageAt: serverTimestamp(),
    unreadFor: { [currentUser.id]: 0, [target.id]: 1 },
    createdAt: serverTimestamp(),
  });
  return convId;
}

// Subscribe to all conversations involving the current user, newest first.
// Returns the unsubscribe function.
export function watchMyConversations(uid, callback) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.lastMessageAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    callback(list);
  }, (err) => {
    console.warn('watchMyConversations error:', err);
    callback([]);
  });
}

// Subscribe to the newest messages within a conversation, displayed oldest first.
export function watchMessages(convId, callback) {
  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('ts', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.ts?.toMillis?.() || 0;
        const bTime = b.ts?.toMillis?.() || 0;
        return aTime - bTime;
      });
    callback(list);
  }, (err) => {
    console.warn('watchMessages error:', err);
    callback([]);
  });
}

export async function acceptMessageRequest(convId, currentUser) {
  guard(currentUser);
  const convRef = doc(db, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const conv = snap.data();
  if (!conv.participants.includes(currentUser.id)) throw new Error('Not a participant');
  if (conv.requestedBy === currentUser.id) throw new Error('Waiting for the other player to accept');
  await updateDoc(convRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    [`unreadFor.${currentUser.id}`]: 0,
  });
}

export async function declineMessageRequest(convId, currentUser) {
  guard(currentUser);
  const convRef = doc(db, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const conv = snap.data();
  if (!conv.participants.includes(currentUser.id)) throw new Error('Not a participant');
  if (conv.requestedBy === currentUser.id) throw new Error('Only the recipient can decline');
  await updateDoc(convRef, {
    status: 'declined',
    declinedAt: serverTimestamp(),
    lastMessage: { text: 'Request declined', fromId: currentUser.id, ts: Date.now(), system: true },
    lastMessageAt: serverTimestamp(),
    [`unreadFor.${currentUser.id}`]: 0,
    [`unreadFor.${conv.requestedBy}`]: increment(1),
  });
}

// Send a message. Updates lastMessage on the conversation doc and increments
// the recipient's unread count.
export async function sendMessage(convId, currentUser, text) {
  guard(currentUser);
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;

  const convRef = doc(db, 'conversations', convId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) throw new Error('Conversation not found');
  const conv = convSnap.data();
  if (!conv.participants.includes(currentUser.id)) throw new Error('Not a participant');
  if (conv.status && conv.status !== 'accepted') throw new Error('This message request has not been accepted yet');

  // Add the message
  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    fromId: currentUser.id,
    fromUsername: currentUser.username,
    fromAvatar: currentUser.avatar || '◆',
    text: trimmed,
    ts: serverTimestamp(),
  });

  // Update conversation summary + recipient unread counter.
  // Use Firestore `increment` so two concurrent messages from the other
  // side don't both read unread=0 and both write unread=1. Dot-path
  // updates leave the other participant's unread count untouched.
  const otherId = conv.participants.find(p => p !== currentUser.id);
  await updateDoc(convRef, {
    lastMessage: { text: trimmed, fromId: currentUser.id, ts: Date.now() },
    lastMessageAt: serverTimestamp(),
    [`unreadFor.${otherId}`]: increment(1),
    [`unreadFor.${currentUser.id}`]: 0, // I just sent, so I've read up to now
  });
}

// Mark a conversation as read for the current user. Called when they open it.
export async function markConversationRead(convId, currentUser) {
  if (currentUser?._isImpersonated) return;
  const convRef = doc(db, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;
  const conv = snap.data();
  if (!conv.participants.includes(currentUser.id)) return;
  if ((conv.unreadFor?.[currentUser.id] || 0) === 0) return;
  // Dot-path so a concurrent send from the other side doesn't get clobbered.
  await updateDoc(convRef, { [`unreadFor.${currentUser.id}`]: 0 });
}

// Sum of unread counts across all conversations — for the header badge.
export function watchTotalUnread(uid, callback) {
  return watchMyConversations(uid, (convs) => {
    const total = convs.reduce((sum, c) => sum + (c.unreadFor?.[uid] || 0), 0);
    callback(total);
  });
}
