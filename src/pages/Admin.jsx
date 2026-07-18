import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Ban, CheckCircle, Eye, Landmark, LogOut, MessageSquare, Save,
  Shield, Square, Swords, Trash2, UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  deleteClubAsAdmin, forceFinishMatch, isAdminProfile, setUserModeration,
  updateAdminDisplayName, watchAdminClubs, watchAdminConversations,
  watchAdminMatches, watchAdminMessages, watchAdminUsers,
} from '../lib/admin';
import { toast } from '../components/Notifications';

const TABS = [
  ['overview', 'Overview', Shield],
  ['users', 'Users', Users],
  ['games', 'Games', Swords],
  ['chats', 'Chats', MessageSquare],
  ['clubs', 'Clubs', Landmark],
  ['settings', 'Owner', UserRound],
];

export default function Admin() {
  const { profile, logout, startImpersonation } = useAuth();
  const [tab, setTab] = useState('overview');
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
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header className="border-b hairline sticky top-0 z-40" style={{ background: 'var(--paper-tint)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 flex items-center gap-2">
              <Shield size={13} /> Owner Console
            </div>
            <div className="font-display text-2xl leading-tight truncate">{profile.displayName || profile.username}</div>
          </div>
          <nav className="hidden lg:flex items-center gap-1">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className="font-mono px-3 py-2 text-[0.65rem] tracking-widest uppercase inline-flex items-center gap-2"
                      style={{ opacity: tab === id ? 1 : 0.5, borderBottom: `2px solid ${tab === id ? 'var(--ink)' : 'transparent'}` }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </nav>
          <button onClick={logout} className="btn-ghost"><LogOut size={13} aria-hidden="true" /> Log Out</button>
        </div>
        <nav className="lg:hidden flex overflow-x-auto border-t hairline px-3 py-2">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className="font-mono px-3 py-2 text-[0.65rem] tracking-widest uppercase inline-flex items-center gap-2 shrink-0"
                    style={{ opacity: tab === id ? 1 : 0.5 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {tab === 'overview' && <Overview users={users} matches={matches} clubs={clubs} conversations={conversations} />}
        {tab === 'users' && <UsersPanel admin={profile} users={users} onViewAs={startImpersonation} />}
        {tab === 'games' && <MatchesPanel admin={profile} matches={matches} />}
        {tab === 'chats' && <ConversationsPanel conversations={conversations} />}
        {tab === 'clubs' && <ClubsPanel admin={profile} clubs={clubs} />}
        {tab === 'settings' && <OwnerSettings admin={profile} />}
      </main>
    </div>
  );
}

function Overview({ users, matches, clubs, conversations }) {
  const metrics = [
    ['Users', users.length],
    ['Online', users.filter(u => u.online).length],
    ['Live Games', matches.filter(m => m.status === 'active' || m.status === 'paused').length],
    ['Clubs', clubs.length],
    ['Chats', conversations.length],
    ['Requests', conversations.filter(c => c.status === 'pending').length],
  ];
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Recent Games">
          {matches.slice(0, 6).map(m => <TinyMatch key={m.id} match={m} />)}
        </Panel>
        <Panel title="Recent Chats">
          {conversations.slice(0, 6).map(c => <TinyConversation key={c.id} conv={c} />)}
        </Panel>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="border hairline px-4 py-3">
      <div className="font-display text-3xl leading-none">{value}</div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 mt-2">{label}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="border hairline">
      <div className="border-b hairline px-4 py-3 font-mono text-[0.65rem] tracking-widest uppercase opacity-60">{title}</div>
      <div className="divide-y hairline">{children}</div>
    </section>
  );
}

function UsersPanel({ admin, users, onViewAs }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return users
      .filter(u => u.role !== 'admin')
      .filter(u => !q || u.username?.includes(q) || u.displayName?.toLowerCase?.().includes(q) || u.id.includes(q))
      .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.elo || 0) - (a.elo || 0));
  }, [users, filter]);

  return (
    <section className="space-y-3">
      <input value={filter} onChange={e => setFilter(e.target.value)} className="input-field max-w-sm" placeholder="Search players" aria-label="Search players" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(user => <UserRow key={user.id} admin={admin} user={user} onViewAs={onViewAs} />)}
      </div>
    </section>
  );
}

function UserRow({ admin, user, onViewAs }) {
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
          <div className="font-display text-xl truncate">{user.avatar || '◆'} {user.username || '?'}</div>
          <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">{user.id}</div>
        </div>
        <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60 text-right">
          {user.online ? 'online' : 'offline'}<br />{user.elo || 1000} elo
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => onViewAs(user)}><Eye size={12} aria-hidden="true" /> View As</button>
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
  const [selected, setSelected] = useState(null);
  const active = matches.find(m => m.id === selected) || matches[0] || null;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="border hairline divide-y hairline max-h-[650px] overflow-y-auto">
        {matches.map(match => <MatchButton key={match.id} match={match} active={active?.id === match.id} onClick={() => setSelected(match.id)} />)}
      </div>
      <MatchInspector admin={admin} match={active} />
    </section>
  );
}

function MatchButton({ match, active, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left p-3 hover:bg-black/5" style={{ background: active ? 'var(--bg-soft)' : 'transparent' }} aria-label={`View match ${match.id}`}>
      <TinyMatch match={match} />
    </button>
  );
}

function TinyMatch({ match }) {
  const players = match.players || [];
  const names = players.map(id => match.playerInfo?.[id]?.username || id.slice(0, 6)).join(' vs ');
  return (
    <div className="min-w-0 p-3">
      <div className="font-display text-base truncate">{names || 'Unknown players'}</div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">
        {match.status || 'unknown'} · {match.rows}x{match.cols} · {match.id}
      </div>
    </div>
  );
}

function MatchInspector({ admin, match }) {
  if (!match) return <div className="border hairline p-6 font-mono text-[0.65rem] opacity-40 uppercase tracking-widest">No game selected</div>;
  const players = match.players || [];
  return (
    <section className="border hairline p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">Game {match.id}</div>
          <h2 className="font-display text-2xl">{players.map(id => match.playerInfo?.[id]?.username || id.slice(0, 6)).join(' vs ')}</h2>
        </div>
        {(match.status === 'active' || match.status === 'paused') && (
          <button className="btn-danger" onClick={async () => {
            try { await forceFinishMatch(admin, match); toast('Match closed', 'success'); }
            catch (err) { toast(err.message, 'error'); }
          }}>Force Finish</button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Status" value={match.status || '?'} />
        <Metric label="Board" value={`${match.rows || '?'}x${match.cols || '?'}`} />
        <Metric label="Moves" value={match.game?.moveCount || 0} />
        <Metric label="Spectators" value={(Array.isArray(match.spectators) ? match.spectators.length : 0)} />
      </div>
      <Panel title="Scores">
        {players.map(id => (
          <div key={id} className="p-3 flex justify-between gap-3">
            <span className="font-display">{match.playerInfo?.[id]?.avatar || '◆'} {match.playerInfo?.[id]?.username || id}</span>
            <span className="font-mono tabular-nums">{match.game?.scores?.[id] || 0}</span>
          </div>
        ))}
      </Panel>
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
    <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] border hairline" style={{ minHeight: 560 }}>
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
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {clubs.map(club => (
        <article key={club.id} className="border hairline p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-xl truncate">{club.name || '?'}</div>
              <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50">{Array.isArray(club.members) ? club.members.length : 0} members</div>
            </div>
            <button className="btn-danger" onClick={async () => {
              try { await deleteClubAsAdmin(admin, club); toast('Club deleted', 'success'); }
              catch (err) { toast(err.message, 'error'); }
            }}><Trash2 size={12} aria-hidden="true" /> Delete</button>
          </div>
          {club.description && <div className="font-display text-sm opacity-70">{club.description}</div>}
        </article>
      ))}
    </section>
  );
}

function OwnerSettings({ admin }) {
  const [name, setName] = useState(admin.displayName || admin.username || '');
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await updateAdminDisplayName(admin, name);
      toast('Owner name updated', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setSaving(false);
  };
  return (
    <section className="max-w-xl border hairline p-4 space-y-4">
      <div>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Owner Identity</div>
        <h2 className="font-display text-2xl">Admin profile</h2>
      </div>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 block mb-2">Display name</span>
          <input className="input-field" value={name} onChange={e => setName(e.target.value.slice(0, 40))} />
        </label>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary"><Save size={13} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}</button>
      </form>
    </section>
  );
}

function TinyConversation({ conv }) {
  const people = Object.values(conv.participantInfo || {}).map(p => p.username || '?').join(' ↔ ');
  return (
    <div className="p-3">
      <div className="font-display text-base truncate">{people || conv.id}</div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 truncate">{conv.status || 'accepted'} · {conv.lastMessage?.text || 'no messages'}</div>
    </div>
  );
}
