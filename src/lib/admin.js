import {
  collection, doc, deleteDoc, getDocs, limit, onSnapshot, query,
  serverTimestamp, updateDoc, addDoc,
} from 'firebase/firestore';
import { db } from './firebase';

function byNewest(field = 'createdAt') {
  return (a, b) => {
    const aTime = a[field]?.toMillis?.() || a[field] || 0;
    const bTime = b[field]?.toMillis?.() || b[field] || 0;
    return bTime - aTime;
  };
}

export function isAdminProfile(profile) {
  return profile?.role === 'admin';
}

export function watchAdminUsers(callback) {
  return onSnapshot(query(collection(db, 'users'), limit(100)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('watchAdminUsers error:', err);
    callback([]);
  });
}

export function watchAdminMatches(callback) {
  return onSnapshot(query(collection(db, 'matches'), limit(100)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byNewest('createdAt')));
  }, (err) => {
    console.warn('watchAdminMatches error:', err);
    callback([]);
  });
}

export function watchAdminClubs(callback) {
  return onSnapshot(query(collection(db, 'clubs'), limit(100)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byNewest('createdAt')));
  }, (err) => {
    console.warn('watchAdminClubs error:', err);
    callback([]);
  });
}

export function watchAdminConversations(callback) {
  return onSnapshot(query(collection(db, 'conversations'), limit(100)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byNewest('lastMessageAt')));
  }, (err) => {
    console.warn('watchAdminConversations error:', err);
    callback([]);
  });
}

export function watchAdminMessages(convId, callback) {
  if (!convId) return () => {};
  return onSnapshot(query(collection(db, 'conversations', convId, 'messages'), limit(200)), (snap) => {
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ts?.toMillis?.() || 0) - (b.ts?.toMillis?.() || 0));
    callback(list);
  }, (err) => {
    console.warn('watchAdminMessages error:', err);
    callback([]);
  });
}

async function audit(admin, action, targetType, targetId, details = {}) {
  await addDoc(collection(db, 'adminAudit'), {
    adminId: admin.id,
    adminUsername: admin.username,
    action,
    targetType,
    targetId,
    details,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

export async function setUserModeration(admin, user, patch) {
  await updateDoc(doc(db, 'users', user.id), patch);
  await audit(admin, 'update_user', 'user', user.id, patch);
}

export async function forceFinishMatch(admin, match) {
  await updateDoc(doc(db, 'matches', match.id), {
    status: 'finished',
    adminClosed: true,
    adminClosedAt: serverTimestamp(),
    finishedAt: serverTimestamp(),
  });
  await audit(admin, 'force_finish_match', 'match', match.id, {
    players: match.players || [],
  });
}

export async function deleteClubAsAdmin(admin, club) {
  await deleteDoc(doc(db, 'clubs', club.id));
  await audit(admin, 'delete_club', 'club', club.id, {
    name: club.name || '',
    ownerId: club.ownerId || '',
  });
}
