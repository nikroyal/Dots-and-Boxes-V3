import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { acceptInvite, declineInvite } from '../lib/actions';
import { sfx } from '../lib/sound';
import { Check, X } from 'lucide-react';

export default function Notifications() {
  const { profile } = useAuth();
  const [invites, setInvites] = useState([]);
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();

  // Stale invite threshold. Mirror of the same constant in Dashboard.jsx —
  // both ends filter out invites older than this so a forgotten challenge
  // doesn't pile up a notification forever.
  const STALE_INVITE_MS = 60 * 60 * 1000;

  // Watch incoming invites. Skip the initial snapshot (which reports every
  // existing pending invite as "new") so we don't fire N notification beeps
  // in rapid succession on page load.
  //
  // Dep is `profile?.id` (NOT the whole `profile` object). Using `profile`
  // tore down and re-subscribed on every Firestore snapshot of the user
  // doc — i.e. every 20s heartbeat — which reset `isInitialSnapshot = true`
  // and silently suppressed the beep for any real invite that happened to
  // land in the same snapshot batch as a profile update.
  useEffect(() => {
    if (!profile?.id) return;
    const q = query(
      collection(db, 'invites'),
      where('toId', '==', profile.id),
      where('status', '==', 'pending')
    );
    let isInitialSnapshot = true;
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const list = all.filter(inv => {
        const created = inv.createdAt?.toMillis ? inv.createdAt.toMillis() : 0;
        return !created || now - created < STALE_INVITE_MS;
      });
      if (!isInitialSnapshot) {
        // Only play a beep when an invite was actually *added* this update.
        for (const change of snap.docChanges()) {
          if (change.type === 'added') { sfx.notify(); break; }
        }
      }
      isInitialSnapshot = false;
      setInvites(list);
    }, (err) => {
      console.warn('incoming invites listener failed:', err);
      setInvites([]);
      addToast('Unable to load invites right now', 'error');
    });
    return () => unsub();
  }, [profile?.id]);

  const handleAccept = async (inv) => {
    try {
      const matchId = await acceptInvite(inv.id, profile);
      sfx.click();
      navigate(`/match/${matchId}`);
    } catch (e) { addToast(e.message, 'error'); }
  };

  const handleDecline = async (inv) => {
    try { await declineInvite(inv.id, profile); sfx.click(); }
    catch (e) { addToast(e.message, 'error'); }
  };

  const addToast = (text, type) => {
    const id = crypto.randomUUID();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  // Listen for global toast events
  useEffect(() => {
    const handler = (e) => addToast(e.detail.text, e.detail.type || 'info');
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <>
      {/* Invite cards (top of screen) */}
      {invites.length > 0 && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 space-y-2 pointer-events-none">
          {invites.map(inv => (
            <div key={inv.id} className="card fade-in flex items-center justify-between gap-3 pointer-events-auto"
                 style={{ background: 'var(--paper-tint)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-display text-2xl" aria-hidden="true">{inv.fromAvatar}</span>
                <div className="min-w-0">
                  <div className="font-display text-base truncate">
                    <span className="font-medium">{inv.fromUsername}</span>
                    {inv.isRematch ? ' wants a rematch' : ' challenges you'}
                  </div>
                  <div className="font-mono text-[0.65rem] tracking-widest opacity-60 uppercase flex items-center gap-2">
                    <span>{inv.rows} × {inv.cols} board · {inv.fromElo} ELO</span>
                    {inv.isRematch && (
                      <span style={{ color: 'var(--ochre)' }}>● REMATCH</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleAccept(inv)} className="p-2 hover:bg-black/5 transition-colors focus-ring" aria-label={`Accept challenge from ${inv.fromUsername}`} title="Accept">
                  <Check size={18} style={{ color: 'var(--forest)' }} aria-hidden="true" />
                </button>
                <button onClick={() => handleDecline(inv)} className="p-2 hover:bg-black/5 transition-colors focus-ring" aria-label={`Decline challenge from ${inv.fromUsername}`} title="Decline">
                  <X size={18} style={{ color: 'var(--crimson)' }} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toasts (bottom of screen) */}
      <div className="fixed bottom-6 right-6 z-40 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="card fade-in font-mono text-xs tracking-wide" style={{
            background: 'var(--paper-tint)',
            color: t.type === 'error' ? 'var(--crimson)' : t.type === 'success' ? 'var(--forest)' : 'var(--ink)',
            boxShadow: 'var(--shadow)',
          }}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

// Helper to fire toasts from anywhere
export function toast(text, type = 'info') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { text, type } }));
}
