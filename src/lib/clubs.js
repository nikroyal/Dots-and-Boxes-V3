import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, limit, onSnapshot, serverTimestamp, runTransaction,
  arrayUnion, arrayRemove, setDoc, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Guard ────────────────────────────────────────────────────────────────
function guard(user) {
  if (user?._isImpersonated) {
    throw new Error('Action blocked: you are in read-only impersonation mode.');
  }
}

// Maximum club name / description lengths
const MAX_NAME = 40;
const MAX_DESC = 200;

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member'
};

/**
 * Create a new club with a default "general" channel and the creator as Owner.
 */
export async function createClub(currentUser, { name, description, isPublic = true }) {
  guard(currentUser);
  const cleanName = (name || '').trim().slice(0, MAX_NAME);
  if (cleanName.length < 3) throw new Error('Club name must be at least 3 characters');
  const cleanDesc = (description || '').trim().slice(0, MAX_DESC);

  // 1. Create Club Doc
  const clubRef = await addDoc(collection(db, 'clubs'), {
    name: cleanName,
    description: cleanDesc,
    ownerId: currentUser.id,
    memberIds: [currentUser.id], // For easy querying in listMyClubs
    memberCount: 1,
    createdAt: serverTimestamp(),
    isPublic,
    joinMode: isPublic ? 'open' : 'approval',
  });

  const batch = writeBatch(db);

  // 2. Add Owner as first member in subcollection
  const memberRef = doc(db, 'clubs', clubRef.id, 'members', currentUser.id);
  batch.set(memberRef, {
    userId: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
    role: ROLES.OWNER,
    joinedAt: serverTimestamp(),
  });

  // 3. Create default "general" channel
  const channelRef = doc(collection(db, 'clubs', clubRef.id, 'channels'));
  batch.set(channelRef, {
    name: 'general',
    type: 'text',
    order: 0,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return clubRef.id;
}

/**
 * Subscribe to club metadata.
 */
export function watchClub(clubId, callback) {
  return onSnapshot(doc(db, 'clubs', clubId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

/**
 * Subscribe to club members.
 */
export function watchMembers(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'members'), limit(500));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Subscribe to club channels.
 */
export function watchChannels(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'channels'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Subscribe to messages in a specific channel.
 */
export function watchMessages(clubId, channelId, callback) {
  if (!clubId || !channelId) return () => {};
  const q = query(
    collection(db, 'clubs', clubId, 'channels', channelId, 'messages'),
    orderBy('ts', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    // Reverse because we want oldest at top for Discord-style
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    callback(msgs);
  });
}

/**
 * List public clubs.
 */
export async function listPublicClubs() {
  const q = query(
    collection(db, 'clubs'),
    where('isPublic', '==', true),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

/**
 * List clubs the current user belongs to.
 */
export async function listMyClubs(uid) {
  const q = query(
    collection(db, 'clubs'),
    where('memberIds', 'array-contains', uid),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Join a club.
 */
export async function joinClub(clubId, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const memberRef = doc(db, 'clubs', clubId, 'members', currentUser.id);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) throw new Error('Club not found');
    const club = clubSnap.data();
    
    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists()) return; // Already a member

    if (club.joinMode === 'approval') {
      const reqRef = doc(db, 'clubs', clubId, 'joinRequests', currentUser.id);
      tx.set(reqRef, {
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar || '◆',
        ts: serverTimestamp(),
      });
      return 'requested';
    }

    tx.set(memberRef, {
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar || '◆',
      role: ROLES.MEMBER,
      joinedAt: serverTimestamp(),
    });

    tx.update(clubRef, {
      memberCount: (club.memberCount || 0) + 1,
      memberIds: arrayUnion(currentUser.id)
    });
    return 'joined';
  });
}

/**
 * Leave a club.
 */
export async function leaveClub(clubId, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const memberRef = doc(db, 'clubs', clubId, 'members', currentUser.id);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) return;
    const club = clubSnap.data();

    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) return;
    const member = memberSnap.data();

    if (member.role === ROLES.OWNER) {
      throw new Error('Owner can\'t leave — delete the club or transfer ownership first');
    }

    tx.delete(memberRef);
    tx.update(clubRef, {
      memberCount: Math.max(0, (club.memberCount || 1) - 1),
      memberIds: arrayRemove(currentUser.id)
    });
  });
}

/**
 * Delete a club (and all its subcollections - Note: Firestore delete is shallow,
 * but for this project we'll just delete the main doc and rely on rules to orphan others
 * or ideally we'd delete all, but batch limits apply).
 */
export async function deleteClub(clubId, currentUser) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== currentUser.id) throw new Error('Only the owner can delete');
  
  // Shallow delete is fine for hobby, orphans will just exist or we can clean up
  await deleteDoc(ref);
}

/**
 * Send a chat message.
 */
export async function sendClubChat(clubId, channelId, currentUser, text, replyTo = null) {
  guard(currentUser);
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;

  const msgRef = doc(collection(db, 'clubs', clubId, 'channels', channelId, 'messages'));
  await setDoc(msgRef, {
    userId: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
    text: trimmed,
    ts: Date.now(),
    replyTo, // ID of the message being replied to
    status: 'sent',
  });
}

/**
 * Edit a message.
 */
export async function editMessage(clubId, channelId, messageId, currentUser, newText) {
  guard(currentUser);
  const trimmed = newText.trim().slice(0, 2000);
  if (!trimmed) return;
  const ref = doc(db, 'clubs', clubId, 'channels', channelId, 'messages', messageId);
  await updateDoc(ref, {
    text: trimmed,
    status: 'edited',
    editedAt: Date.now(),
  });
}

/**
 * Delete a message.
 */
export async function deleteMessage(clubId, channelId, messageId, currentUser) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId, 'channels', channelId, 'messages', messageId);
  await deleteDoc(ref);
}

/**
 * Migration helper: If a club still has the old 'chat' or 'members' array,
 * this function can be called to move them to subcollections.
 */
export async function migrateClubIfNeeded(club) {
  if (!club || (!club.chat && !club.members)) return;
  
  const batch = writeBatch(db);
  const clubRef = doc(db, 'clubs', club.id);

  // 1. Migrate Members
  if (Array.isArray(club.members)) {
    for (const uid of club.members) {
      const info = club.memberInfo?.[uid] || { username: 'Unknown', avatar: '◆' };
      const mRef = doc(db, 'clubs', club.id, 'members', uid);
      batch.set(mRef, {
        userId: uid,
        username: info.username,
        avatar: info.avatar,
        role: uid === club.ownerId ? ROLES.OWNER : ROLES.MEMBER,
        joinedAt: serverTimestamp(),
      });
    }
  }

  // 2. Migrate Chat to a "general" channel
  let generalChannelId = null;
  if (Array.isArray(club.chat) && club.chat.length > 0) {
    const channelsSnap = await getDocs(collection(db, 'clubs', club.id, 'channels'));
    let generalChannel = channelsSnap.docs.find(d => d.data().name === 'general');
    
    if (!generalChannel) {
      const cRef = doc(collection(db, 'clubs', club.id, 'channels'));
      batch.set(cRef, { name: 'general', type: 'text', order: 0, createdAt: serverTimestamp() });
      generalChannelId = cRef.id;
    } else {
      generalChannelId = generalChannel.id;
    }

    for (const msg of club.chat) {
      const mRef = doc(collection(db, 'clubs', club.id, 'channels', generalChannelId, 'messages'));
      batch.set(mRef, {
        userId: msg.userId,
        username: msg.username,
        avatar: msg.avatar,
        text: msg.text,
        ts: msg.ts,
        status: 'sent'
      });
    }
  }

  // 3. Update club doc to remove old arrays and add new fields
  const updateData = {
    memberCount: club.members?.length || 1,
    memberIds: club.members || [club.ownerId],
    chat: null, // delete field
    members: null, // delete field
    memberInfo: null, // delete field
  };
  batch.update(clubRef, updateData);

  await batch.commit();
}

/**
 * Create a new channel.
 */
export async function createChannel(clubId, currentUser, { name, type = 'text', order = 0 }) {
  guard(currentUser);
  const ref = doc(collection(db, 'clubs', clubId, 'channels'));
  await setDoc(ref, {
    name: name.toLowerCase().replace(/\s+/g, '-').slice(0, 30),
    type,
    order,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update a channel.
 */
export async function updateChannel(clubId, channelId, currentUser, updates) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId, 'channels', channelId);
  await updateDoc(ref, updates);
}

/**
 * Delete a channel.
 */
export async function deleteChannel(clubId, channelId, currentUser) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId, 'channels', channelId);
  await deleteDoc(ref);
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(clubId, userId, currentUser, newRole) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId, 'members', userId);
  await updateDoc(ref, { role: newRole });
}

/**
 * Kick a member.
 */
export async function kickMember(clubId, userId, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const memberRef = doc(db, 'clubs', clubId, 'members', userId);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) return;
    tx.delete(memberRef);
    tx.update(clubRef, {
      memberCount: Math.max(0, (clubSnap.data().memberCount || 1) - 1),
      memberIds: arrayRemove(userId)
    });
  });
}

/**
 * Accept a join request.
 */
export async function acceptJoinRequest(clubId, userData, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const reqRef = doc(db, 'clubs', clubId, 'joinRequests', userData.userId);
  const memberRef = doc(db, 'clubs', clubId, 'members', userData.userId);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) return;
    tx.set(memberRef, {
      userId: userData.userId,
      username: userData.username,
      avatar: userData.avatar || '◆',
      role: ROLES.MEMBER,
      joinedAt: serverTimestamp(),
    });
    tx.update(clubRef, {
      memberCount: (clubSnap.data().memberCount || 0) + 1,
      memberIds: arrayUnion(userData.userId)
    });
    tx.delete(reqRef);
  });
}

/**
 * Reject a join request.
 */
export async function rejectJoinRequest(clubId, userId, currentUser) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId, 'joinRequests', userId);
  await deleteDoc(ref);
}

/**
 * Update club metadata (name, description, isPublic).
 */
export async function updateClubMetadata(clubId, currentUser, updates) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId);
  await updateDoc(ref, updates);
}

/**
 * Watch Join Requests.
 */
export function watchJoinRequests(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'joinRequests'), orderBy('ts', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
