import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Shield, Users, Swords, MessageSquare, Landmark, Ban, CheckCircle, Trash2, Square } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  deleteClubAsAdmin, forceFinishMatch, isAdminProfile, setUserModeration,
  watchAdminClubs, watchAdminConversations, watchAdminMatches,
  watchAdminMessages, watchAdminUsers,
} from '../lib/admin';
import { toast } from '../components/Notifications';

const TABS = [
  ['users', 'Users', Users],
  ['matches', 'Games', Swords],
  ['conversations', 'Chats', MessageSquare],
  ['clubs', 'Clubs', Landmark],
];

export default function Admin() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!isAdminProfile(profile)) return;
    const unsubs = [
      watchAdminUsers(setUsers),
      watchAdminMatches(setMatches),
      watchAdminClubs(setClubs),
      watchAdminConversations(setConversations),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [profile?.id, profile?.role]);

  if (!profile) return null;
  if (!isAdminProfile(profile)) return <Navigate to="/" />;

  const activeMatches = matches.filter(m => m.status === 'active' || m.status === 'paused');
  const pendingRequests = conversations.filter(c => c.status === 'pending');
  const onlineUsers = users.filter(u => u.online);

  return (
    <div className="fade-in space-y-6">
      <section className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2 flex items-center gap-2">
            <Shield size={13} /> Admin Console
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight">Operations</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <Metric label="Online" value={onlineUsers.length} />
          <Metric label="Live Games" value={activeMatches.length} />
          <Metric label="Requests" value={pendingRequests.length} />
        </div>
      </section>

      <nav className="flex gap-1 border-b hairline overflow-x-auto">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
                  className="px-4 py-2 font-mono text-[0.7rem] tracking-widest uppercase inline-flex items-center gap-2"
                  style={{ borderBottom: `2px solid ${tab === id ? 'var(--ink)' : 'transparent'}`, opacity: tab === id ? 1 : 0.5 }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </nav>

      {tab === 'users' && <UsersPanel admin={profile} users={users} />}
      {tab === 'matches' && <MatchesPanel admin={profile} matches={matches} />}
      {tab === 'conversations' && <ConversationsPanel conversations={conversations} />}
      {tab === 'clubs' && <ClubsPanel admin={profile} clubs={clubs} />}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="border hairline px-3 py-2 min-w-[88px]">
      <div className="font-display text-2xl leading-none">{value}</div>
      <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50 mt-1">{label}</div>
    </div>
  );
}

function UsersPanel({ admin, users }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return users
      .filter(u => !q || u.username?.includes(q) || u.id.includes(q))
      .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.elo || 0) - (a.elo || 0));
  }, [users, filter]);

  return (
    <section className="space-y-3">
      <input value={filter} onChange={e => setFilter(e.target.value)} className="input-field max-w-sm" placeholder="Search users" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(user => <UserRow key={user.id} admin={admin} user={user} />)}
      </div>
    </section>
  );
}

function UserRow({ admin, user }) {
  const banned = user.status === 'banned';
  const muted = user.chatMuted === true;
  const setPatch = async (patch, ok) => {
    try {
      await setUserModeration(admin, user, patch);
      toast(ok, 'success');
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <article className="border hairline p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/profile/${user.username}`} className="font-display text-xl hover:opacity-70 truncate block">
            {user.avatar || '◆'} {user.username || '?'}
          </Link>
          <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">{user.id}</div>
        </div>
        <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60 text-right">
          {user.online ? 'online' : 'offline'}<br />{user.elo || 1000} elo
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => setPatch({ status: banned ? 'active' : 'banned' }, banned ? 'User unbanned' : 'User banned')}>
          {banned ? <CheckCircle size={12} /> : <Ban size={12} />} {banned ? 'Unban' : 'Ban'}
        </button>
        <button className="btn-ghost" onClick={() => setPatch({ chatMuted: !muted }, muted ? 'Chat unmuted' : 'Chat muted')}>
          <MessageSquare size={12} /> {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </article>
  );
}

function MatchesPanel({ admin, matches }) {
  return (
    <section className="grid grid-cols-1 gap-3">
      {matches.map(match => {
        const players = match.players || [];
        const names = players.map(id => match.playerInfo?.[id]?.username || id.slice(0, 6)).join(' vs ');
        return (
          <article key={match.id} className="border hairline p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-display text-lg truncate">{names || 'Unknown players'}</div>
              <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">
                {match.status || 'unknown'} · {match.rows}x{match.cols} · {match.id}
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/match/${match.id}`} className="btn-ghost"><Square size={12} /> View</Link>
              {(match.status === 'active' || match.status === 'paused') && (
                <button className="btn-danger" onClick={async () => {
                  try { await forceFinishMatch(admin, match); toast('Match closed', 'success'); }
                  catch (err) { toast(err.message, 'error'); }
                }}>Force Finish</button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ConversationsPanel({ conversations }) {
  const [selected, setSelected] = useState(null);
  const active = conversations.find(c => c.id === selected) || conversations[0] || null;
  useEffect(() => {
    if (!selected && conversations[0]) setSelected(conversations[0].id);
  }, [conversations, selected]);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] border hairline" style={{ minHeight: 520 }}>
      <aside className="border-r hairline overflow-y-auto">
        {conversations.map(conv => <ConversationButton key={conv.id} conv={conv} active={active?.id === conv.id} onClick={() => setSelected(conv.id)} />)}
        {conversations.length === 0 && <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic">No conversations</div>}
      </aside>
      <ConversationReader conv={active} />
    </section>
  );
}

function ConversationButton({ conv, active, onClick }) {
  const people = Object.values(conv.participantInfo || {}).map(p => p.username || '?').join(' ↔ ');
  return (
    <button onClick={onClick} className="w-full text-left p-3 border-b hairline hover:bg-black/5"
            style={{ background: active ? 'var(--bg-soft)' : 'transparent' }}>
      <div className="font-display text-base truncate">{people || conv.id}</div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">
        {conv.status || 'accepted'} · {conv.lastMessage?.text || 'no messages'}
      </div>
    </button>
  );
}

function ConversationReader({ conv }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (!conv?.id) { setMessages([]); return; }
    return watchAdminMessages(conv.id, setMessages);
  }, [conv?.id]);

  if (!conv) {
    return <div className="flex items-center justify-center font-mono text-[0.65rem] opacity-40 tracking-widest uppercase">Select a chat</div>;
  }

  const people = Object.values(conv.participantInfo || {}).map(p => p.username || '?').join(' ↔ ');
  return (
    <div className="flex flex-col min-w-0">
      <div className="border-b hairline p-3">
        <div className="font-display text-lg truncate">{people}</div>
        <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">{conv.id}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic">No message documents yet</div>}
        {messages.map(msg => (
          <div key={msg.id} className="max-w-[80%] border hairline p-3">
            <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mb-1">
              {msg.fromUsername || msg.fromId || '?'} · {msg.ts?.toMillis ? new Date(msg.ts.toMillis()).toLocaleString() : ''}
            </div>
            <div className="font-display text-base break-words">{msg.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClubsPanel({ admin, clubs }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {clubs.map(club => (
        <article key={club.id} className="border hairline p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/clubs/${club.id}`} className="font-display text-xl hover:opacity-70 truncate block">{club.name || '?'}</Link>
              <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">{club.members?.length || 0} members</div>
            </div>
            <button className="btn-danger" onClick={async () => {
              try { await deleteClubAsAdmin(admin, club); toast('Club deleted', 'success'); }
              catch (err) { toast(err.message, 'error'); }
            }}><Trash2 size={12} /> Delete</button>
          </div>
          {club.description && <div className="font-display text-sm opacity-70">{club.description}</div>}
        </article>
      ))}
    </section>
  );
}
