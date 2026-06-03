import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, limit, onSnapshot, serverTimestamp, runTransaction,
  arrayUnion, arrayRemove, setDoc, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

function guard(user) {
  if (user?._isImpersonated) {
    throw new Error('Action blocked: you are in read-only impersonation mode.');
  }
}

const MAX_NAME = 40;
const MAX_DESC = 200;
const MAX_ANNOUNCEMENT = 500;

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member'
};

export const JOIN_MODES = {
  OPEN: 'open',
  APPROVAL: 'approval'
};

function cleanJoinMode(joinMode) {
  return joinMode === JOIN_MODES.APPROVAL ? JOIN_MODES.APPROVAL : JOIN_MODES.OPEN;
}

export async function createClub(currentUser, { name, description, joinMode = JOIN_MODES.OPEN, isPublic = true }) {
  guard(currentUser);
  const cleanName = (name || '').trim().slice(0, MAX_NAME);
  if (cleanName.length < 3) throw new Error('Club name must be at least 3 characters');
  const cleanDesc = (description || '').trim().slice(0, MAX_DESC);
  const mode = cleanJoinMode(joinMode);

  const clubRef = doc(collection(db, 'clubs'));
  const batch = writeBatch(db);

  batch.set(clubRef, {
    name: cleanName,
    description: cleanDesc,
    ownerId: currentUser.id,
    memberIds: [currentUser.id],
    bannedIds: [],
    memberCount: 1,
    createdAt: serverTimestamp(),
    isPublic: !!isPublic,
    joinMode: mode,
    announcements: [],
  });

  batch.set(doc(db, 'clubs', clubRef.id, 'members', currentUser.id), {
    userId: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
    role: ROLES.OWNER,
    joinedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'clubs', clubRef.id, 'channels')), {
    name: 'general',
    type: 'text',
    order: 0,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return clubRef.id;
}

export function watchClub(clubId, callback) {
  return onSnapshot(doc(db, 'clubs', clubId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  }, (err) => {
    console.warn('watchClub error:', err);
    callback(null);
  });
}

export function watchMembers(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'members'), limit(500));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('watchMembers error:', err);
    callback([]);
  });
}

export function watchChannels(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'channels'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('watchChannels error:', err);
    callback([]);
  });
}

export function watchMessages(clubId, channelId, callback) {
  if (!clubId || !channelId) return () => {};
  const q = query(
    collection(db, 'clubs', clubId, 'channels', channelId, 'messages'),
    orderBy('ts', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
  }, (err) => {
    console.warn('watchClubMessages error:', err);
    callback([]);
  });
}

export async function listPublicClubs() {
  const q = query(collection(db, 'clubs'), where('isPublic', '==', true), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

export async function listMyClubs(uid) {
  const q = query(collection(db, 'clubs'), where('memberIds', 'array-contains', uid), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function joinClub(clubId, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const memberRef = doc(db, 'clubs', clubId, 'members', currentUser.id);

  return await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) throw new Error('Club not found');
    const club = clubSnap.data();
    if ((club.bannedIds || []).includes(currentUser.id)) throw new Error('You are banned from this club');

    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists()) return 'joined';

    if (club.joinMode === JOIN_MODES.APPROVAL) {
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
    if (memberSnap.data().role === ROLES.OWNER) {
      throw new Error('Owner cannot leave. Transfer ownership first.');
    }
    tx.delete(memberRef);
    tx.update(clubRef, {
      memberCount: Math.max(0, (club.memberCount || 1) - 1),
      memberIds: arrayRemove(currentUser.id)
    });
  });
}

export async function deleteClub(clubId, currentUser) {
  guard(currentUser);
  const ref = doc(db, 'clubs', clubId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== currentUser.id) throw new Error('Only the owner can delete');
  await deleteDoc(ref);
}

export async function sendClubChat(clubId, channelId, currentUser, text, replyTo = null) {
  guard(currentUser);
  if (!clubId || !channelId) throw new Error('No channel selected');
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;

  await setDoc(doc(collection(db, 'clubs', clubId, 'channels', channelId, 'messages')), {
    userId: currentUser.id,
    username: currentUser.username,
    avatar: currentUser.avatar || '◆',
    text: trimmed,
    ts: Date.now(),
    replyTo,
    status: 'sent',
  });
}

export async function editMessage(clubId, channelId, messageId, currentUser, newText) {
  guard(currentUser);
  const trimmed = newText.trim().slice(0, 2000);
  if (!trimmed) return;
  await updateDoc(doc(db, 'clubs', clubId, 'channels', channelId, 'messages', messageId), {
    text: trimmed,
    status: 'edited',
    editedAt: Date.now(),
  });
}

export async function deleteMessage(clubId, channelId, messageId, currentUser) {
  guard(currentUser);
  await deleteDoc(doc(db, 'clubs', clubId, 'channels', channelId, 'messages', messageId));
}

export async function migrateClubIfNeeded(club) {
  if (!club || (!club.chat && !club.members)) return;
  const batch = writeBatch(db);
  const clubRef = doc(db, 'clubs', club.id);

  if (Array.isArray(club.members)) {
    for (const uid of club.members) {
      const info = club.memberInfo?.[uid] || { username: 'Unknown', avatar: '◆' };
      batch.set(doc(db, 'clubs', club.id, 'members', uid), {
        userId: uid,
        username: info.username,
        avatar: info.avatar,
        role: uid === club.ownerId ? ROLES.OWNER : ROLES.MEMBER,
        joinedAt: serverTimestamp(),
      });
    }
  }

  if (Array.isArray(club.chat) && club.chat.length > 0) {
    const channelsSnap = await getDocs(collection(db, 'clubs', club.id, 'channels'));
    let generalChannel = channelsSnap.docs.find(d => d.data().name === 'general');
    let generalChannelId = generalChannel?.id;
    if (!generalChannelId) {
      const cRef = doc(collection(db, 'clubs', club.id, 'channels'));
      batch.set(cRef, { name: 'general', type: 'text', order: 0, createdAt: serverTimestamp() });
      generalChannelId = cRef.id;
    }
    for (const msg of club.chat) {
      batch.set(doc(collection(db, 'clubs', club.id, 'channels', generalChannelId, 'messages')), {
        userId: msg.userId,
        username: msg.username,
        avatar: msg.avatar,
        text: msg.text,
        ts: msg.ts,
        status: 'sent'
      });
    }
  }

  batch.update(clubRef, {
    memberCount: club.members?.length || 1,
    memberIds: club.members || [club.ownerId],
    bannedIds: club.bannedIds || [],
    joinMode: club.joinMode || (club.isPublic ? JOIN_MODES.OPEN : JOIN_MODES.APPROVAL),
    announcements: club.announcements || [],
    chat: null,
    members: null,
    memberInfo: null,
  });
  await batch.commit();
}

export async function createChannel(clubId, currentUser, { name, type = 'text', order = 0 }) {
  guard(currentUser);
  const cleanName = (name || '')
    .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  if (!cleanName) throw new Error('Channel name is required');
  const ref = doc(collection(db, 'clubs', clubId, 'channels'));
  await setDoc(ref, { name: cleanName, type, order, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateChannel(clubId, channelId, currentUser, updates) {
  guard(currentUser);
  await updateDoc(doc(db, 'clubs', clubId, 'channels', channelId), updates);
}

export async function deleteChannel(clubId, channelId, currentUser) {
  guard(currentUser);
  await deleteDoc(doc(db, 'clubs', clubId, 'channels', channelId));
}

export async function updateMemberRole(clubId, userId, currentUser, newRole) {
  guard(currentUser);
  if (![ROLES.ADMIN, ROLES.MODERATOR, ROLES.MEMBER].includes(newRole)) throw new Error('Invalid role');
  await updateDoc(doc(db, 'clubs', clubId, 'members', userId), { role: newRole });
}

export async function transferOwnership(clubId, newOwnerId, currentUser) {
  guard(currentUser);
  if (newOwnerId === currentUser.id) throw new Error('You already own this club');
  const clubRef = doc(db, 'clubs', clubId);
  const currentRef = doc(db, 'clubs', clubId, 'members', currentUser.id);
  const targetRef = doc(db, 'clubs', clubId, 'members', newOwnerId);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    const currentSnap = await tx.get(currentRef);
    const targetSnap = await tx.get(targetRef);
    if (!clubSnap.exists() || !currentSnap.exists() || !targetSnap.exists()) throw new Error('Member not found');
    if (clubSnap.data().ownerId !== currentUser.id || currentSnap.data().role !== ROLES.OWNER) {
      throw new Error('Only the owner can transfer ownership');
    }
    tx.update(clubRef, { ownerId: newOwnerId });
    tx.update(currentRef, { role: ROLES.ADMIN });
    tx.update(targetRef, { role: ROLES.OWNER });
  });
}

export async function kickMember(clubId, userId, currentUser) {
  return removeMember(clubId, userId, currentUser, false);
}

export async function banMember(clubId, userId, currentUser) {
  return removeMember(clubId, userId, currentUser, true);
}

async function removeMember(clubId, userId, currentUser, ban) {
  guard(currentUser);
  if (userId === currentUser.id) throw new Error('You cannot remove yourself');
  const clubRef = doc(db, 'clubs', clubId);
  const memberRef = doc(db, 'clubs', clubId, 'members', userId);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) return;
    const club = clubSnap.data();
    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists() && memberSnap.data().role === ROLES.OWNER) throw new Error('The owner cannot be removed');

    const updates = ban
      ? { bannedIds: arrayUnion(userId), memberIds: arrayRemove(userId) }
      : { memberIds: arrayRemove(userId) };

    if (memberSnap.exists()) {
      tx.delete(memberRef);
      updates.memberCount = Math.max(0, (club.memberCount || 1) - 1);
    }
    tx.update(clubRef, updates);
  });
}

export async function unbanMember(clubId, userId, currentUser) {
  guard(currentUser);
  await updateDoc(doc(db, 'clubs', clubId), { bannedIds: arrayRemove(userId) });
}

export async function acceptJoinRequest(clubId, userData, currentUser) {
  guard(currentUser);
  const clubRef = doc(db, 'clubs', clubId);
  const reqRef = doc(db, 'clubs', clubId, 'joinRequests', userData.userId);
  const memberRef = doc(db, 'clubs', clubId, 'members', userData.userId);

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists()) return;
    const club = clubSnap.data();
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) return;
    if ((club.bannedIds || []).includes(userData.userId)) throw new Error('This user is banned');
    const memberSnap = await tx.get(memberRef);
    const requestData = reqSnap.data();

    if (!memberSnap.exists()) {
      tx.set(memberRef, {
        userId: requestData.userId,
        username: requestData.username,
        avatar: requestData.avatar || '◆',
        role: ROLES.MEMBER,
        joinedAt: serverTimestamp(),
      });
      tx.update(clubRef, {
        memberCount: (club.memberCount || 0) + 1,
        memberIds: arrayUnion(requestData.userId)
      });
    }
    tx.delete(reqRef);
  });
}

export async function rejectJoinRequest(clubId, userId, currentUser) {
  guard(currentUser);
  await deleteDoc(doc(db, 'clubs', clubId, 'joinRequests', userId));
}

export async function updateClubMetadata(clubId, currentUser, updates) {
  guard(currentUser);
  const cleanUpdates = {};
  if (updates.name !== undefined) {
    const cleanName = String(updates.name).trim().slice(0, MAX_NAME);
    if (cleanName.length < 3) throw new Error('Club name must be at least 3 characters');
    cleanUpdates.name = cleanName;
  }
  if (updates.description !== undefined) cleanUpdates.description = String(updates.description).trim().slice(0, MAX_DESC);
  if (updates.isPublic !== undefined) cleanUpdates.isPublic = !!updates.isPublic;
  if (updates.joinMode !== undefined) cleanUpdates.joinMode = cleanJoinMode(updates.joinMode);
  await updateDoc(doc(db, 'clubs', clubId), cleanUpdates);
}

export function watchJoinRequests(clubId, callback) {
  const q = query(collection(db, 'clubs', clubId, 'joinRequests'), orderBy('ts', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('watchJoinRequests error:', err);
    callback([]);
  });
}

export async function postAnnouncement(clubId, currentUser, text) {
  guard(currentUser);
  const trimmed = text.trim().slice(0, MAX_ANNOUNCEMENT);
  if (!trimmed) throw new Error('Announcement cannot be empty');
  await updateDoc(doc(db, 'clubs', clubId), {
    announcements: arrayUnion({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      byId: currentUser.id,
      byUsername: currentUser.username,
      ts: Date.now(),
    })
  });
}

export async function getClubLeaderboard(clubId) {
  const membersSnap = await getDocs(query(collection(db, 'clubs', clubId, 'members'), limit(500)));
  const rows = await Promise.all(membersSnap.docs.map(async (memberDoc) => {
    const member = { id: memberDoc.id, ...memberDoc.data() };
    const userSnap = await getDoc(doc(db, 'users', member.userId));
    const stats = userSnap.exists() ? userSnap.data() : {};
    return {
      ...member,
      elo: stats.elo || 1000,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      gamesPlayed: stats.gamesPlayed || 0,
    };
  }));
  return rows.sort((a, b) => (b.elo || 1000) - (a.elo || 1000));
}

export function watchClubChallenges(clubId, callback) {
  const q = query(collection(db, 'clubChallenges'), where('clubIds', 'array-contains', clubId), orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('watchClubChallenges error:', err);
    callback([]);
  });
}

export async function createClubChallenge(fromClub, targetClubId, currentUser, note = '') {
  guard(currentUser);
  if (!fromClub?.id || !targetClubId) throw new Error('Choose a club to challenge');
  if (fromClub.id === targetClubId) throw new Error('Choose another club');
  const targetSnap = await getDoc(doc(db, 'clubs', targetClubId));
  if (!targetSnap.exists()) throw new Error('Target club not found');
  const target = targetSnap.data();
  await setDoc(doc(collection(db, 'clubChallenges')), {
    clubIds: [fromClub.id, targetClubId],
    fromClubId: fromClub.id,
    fromClubName: fromClub.name,
    toClubId: targetClubId,
    toClubName: target.name,
    createdBy: currentUser.id,
    createdByUsername: currentUser.username,
    note: String(note || '').trim().slice(0, 200),
    status: 'pending',
    createdAt: serverTimestamp(),
    respondedAt: null,
    respondedBy: null,
  });
}

export async function respondClubChallenge(challengeId, currentUser, accept) {
  guard(currentUser);
  await updateDoc(doc(db, 'clubChallenges', challengeId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
    respondedBy: currentUser.id,
  });
}
