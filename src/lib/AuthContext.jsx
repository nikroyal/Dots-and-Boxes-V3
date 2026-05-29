import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { AVATAR_OPTIONS } from './achievements';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // Firebase user
  const [profile, setProfile] = useState(null);    // Firestore user doc
  const [loading, setLoading] = useState(true);
  const [impersonatedProfile, setImpersonatedProfile] = useState(null);

  // Listen for auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setImpersonatedProfile(null);
        setLoading(false);
        return;
      }
      // Mark online — fire and forget. If Firestore is slow/offline we still
      // want to drop the loading screen rather than hang on it. This also
      // tolerates the brand-new-signup case where the user doc doesn't exist
      // yet (updateDoc would error; signup's setDoc creates it moments later).
      updateDoc(doc(db, 'users', u.uid), {
        online: true,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to profile doc whenever user changes
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() });
      } else {
        setProfile(null);
        setImpersonatedProfile(null);
      }
    }, (err) => {
      console.warn('profile subscription failed:', err);
      setProfile(null);
      setImpersonatedProfile(null);
    });
    return () => unsub();
  }, [user]);

  // Mark offline on tab close
  useEffect(() => {
    if (!user) return;
    const handleUnload = () => {
      // Best-effort — beacon would be ideal but Firestore doesn't expose one
      updateDoc(doc(db, 'users', user.uid), { online: false }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [user]);

  // Sign up requires a real email so the user can recover their account if
  // they forget their password. The username is displayed publicly; the
  // email is only used by Firebase Auth.
  const signup = async (username, email, password) => {
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername))
      throw new Error('Username must be 3-20 chars: letters, numbers, underscore');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      throw new Error('Please enter a valid email address');
    if (password.length < 6)
      throw new Error('Password must be at least 6 characters');

    // Pre-check that the username isn't already taken. /usernames is
    // publicly readable specifically to support this.
    let existing;
    try {
      existing = await getDoc(doc(db, 'usernames', cleanUsername));
    } catch {
      throw new Error(
        'Unable to check username availability — please verify your ' +
        'Firebase project\'s Firestore rules allow public reads on ' +
        '/usernames, then try again.'
      );
    }
    if (existing.exists()) throw new Error('Username taken');

    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const uid = cred.user.uid;

    // Now write the two Firestore docs. If either write fails (rules
    // change, network blip, quota exceeded), we'd otherwise be left with
    // an Auth user but no profile — a zombie state where the user can
    // log in but the app shows blank pages because every page guards on
    // `profile`. Delete the Auth user in that case so the user can retry
    // cleanly without "email already in use" errors.
    //
    // If the second setDoc fails, we ALSO need to delete the first
    // /users/<uid> doc. Otherwise the rollback path leaves an orphan doc
    // that claims the username — and the Firestore rule for
    // /users/{uid}.delete requires `isSelf`, which becomes impossible once
    // we've deleted the Auth user. We delete the user doc *before* the
    // Auth user so the rule still sees an authenticated owner.
    let userDocWritten = false;
    try {
      await setDoc(doc(db, 'users', uid), {
        username: cleanUsername,
        displayName: username.trim(),
        email: cleanEmail, // for the user's own reference; never displayed publicly
        role: 'player',
        status: 'active',
        avatar: AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)],
        title: '',
        bio: '',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
        // Stats
        elo: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
        totalBoxes: 0,
        biggestChain: 0,
        perfectWins: 0,
        bigBoardWins: 0,
        comebackWins: 0,
        winStreak: 0,
        bestWinStreak: 0,
        fastestWin: null,
        // Social
        friends: [],
        friendRequests: [], // incoming
        blocked: [],
        // Achievements
        unlockedAchievements: [],
      });
      userDocWritten = true;
      await setDoc(doc(db, 'usernames', cleanUsername), { uid, email: cleanEmail });
    } catch (firestoreErr) {
      // Roll back the partial writes in reverse dependency order: user
      // doc first (while we're still authenticated), then Auth user.
      if (userDocWritten) {
        await deleteDoc(doc(db, 'users', uid)).catch(() => {});
      }
      // deleteUser requires the user be the currently-signed-in subject (it
      // is — we just created them).
      await cred.user.delete().catch(() => {});
      throw new Error('Signup failed — please try again. (' + (firestoreErr.message || 'unknown error') + ')');
    }
  };

  const login = async (username, password) => {
    const cleanUsername = username.toLowerCase().trim();
    // Translate username → email via the public lookup doc.
    const lookupSnap = await getDoc(doc(db, 'usernames', cleanUsername));
    if (!lookupSnap.exists()) {
      // Throw a Firebase-style code so Login.jsx's error mapping shows
      // the friendly "Wrong username or password" message instead of
      // leaking that the username doesn't exist.
      const err = new Error('auth/invalid-credential');
      err.code = 'auth/invalid-credential';
      throw err;
    }
    const { email } = lookupSnap.data();
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Send a password-reset email. Takes a username; we look up the email
  // from the public /usernames doc. To avoid leaking which usernames
  // exist, we don't differentiate "no such user" from "email sent" — the
  // user just sees a generic success message regardless.
  const resetPassword = async (username) => {
    const cleanUsername = username.toLowerCase().trim();
    if (!cleanUsername) throw new Error('Enter your username');
    const lookupSnap = await getDoc(doc(db, 'usernames', cleanUsername));
    if (!lookupSnap.exists()) return; // silently succeed
    const { email } = lookupSnap.data();
    if (!email) return; // legacy account with no recovery email
    await sendPasswordResetEmail(auth, email);
  };

  // Permanently delete the current user's account. Requires the password
  // for re-authentication (Firebase requires recent auth for delete).
  //
  // What this does NOT clean up: match docs (where the user appears as a
  // player), club memberships (their entries in clubs.members/memberInfo),
  // friend entries on other users' docs, activities they recorded. Doing
  // those properly requires a Cloud Function fan-out; for the free-tier
  // hobby setup we accept the orphan references. The user's own data
  // (profile, username, auth) is fully removed, which is the GDPR
  // right-to-erasure baseline.
  const deleteAccount = async (password) => {
    if (impersonatedProfile) throw new Error('Cannot delete account while impersonating');
    if (!auth.currentUser) throw new Error('Not signed in');
    if (!profile) throw new Error('Profile not loaded yet');

    // Re-authenticate. Firebase rejects deleteUser if the last sign-in
    // was too long ago.
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    try {
      await reauthenticateWithCredential(auth.currentUser, cred);
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        throw new Error('Wrong password');
      }
      throw e;
    }

    const uid = auth.currentUser.uid;
    const username = profile.username;

    // Delete /usernames/<name> BEFORE /users/<uid> because the username
    // create rule reads /users/<uid>.username to verify ownership — and
    // we want symmetry: the deletion uses /usernames.uid to verify
    // ownership, so /usernames must still exist when its delete rule
    // runs. Order: usernames → users → auth.
    await deleteDoc(doc(db, 'usernames', username)).catch(() => {});
    await deleteDoc(doc(db, 'users', uid)).catch(() => {});
    await deleteUser(auth.currentUser);
  };

  const logout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { online: false }).catch(() => {});
    }
    setImpersonatedProfile(null);
    await signOut(auth);
  };

  const startImpersonation = (target) => {
    if (profile?.role !== 'admin') return;
    setImpersonatedProfile(target);
  };

  const stopImpersonation = () => {
    setImpersonatedProfile(null);
  };

  const value = {
    user,
    profile: impersonatedProfile ? { ...impersonatedProfile, _isImpersonated: true } : profile,
    realProfile: profile,
    isImpersonating: !!impersonatedProfile,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    deleteAccount,
    startImpersonation,
    stopImpersonation
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
