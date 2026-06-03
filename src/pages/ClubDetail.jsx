import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  watchClub, watchMembers, watchChannels, watchMessages,
  joinClub, leaveClub, deleteClub, sendClubChat,
  editMessage, deleteMessage, migrateClubIfNeeded, ROLES, JOIN_MODES,
  createChannel, deleteChannel, updateMemberRole, kickMember, banMember,
  unbanMember, transferOwnership, acceptJoinRequest, rejectJoinRequest,
  updateClubMetadata, watchJoinRequests, postAnnouncement, getClubLeaderboard,
  listPublicClubs, watchClubChallenges, createClubChallenge, respondClubChallenge
} from '../lib/clubs';
import { toast } from '../components/Notifications';
import { useConfirm } from '../components/ConfirmDialog';
import { sfx } from '../lib/sound';
import {
  Send, ArrowLeft, Users, Trash2, LogOut, UserPlus, Hash, Settings,
  Shield, Crown, MessageSquare, Plus, Check, UserMinus, Ban, Trophy,
  Megaphone, Swords, Lock, Globe2, X
} from 'lucide-react';

export default function ClubDetail() {
  const { id, channelId: routeChannelId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialog: confirmEl } = useConfirm();

  const [club, setClub] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(routeChannelId || null);
  const [chatInput, setChatInput] = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    setClub(undefined);
    return watchClub(id, (c) => {
      setClub(c);
      if (c && (c.chat || c.members)) migrateClubIfNeeded(c).catch(console.error);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsubMembers = watchMembers(id, setMembers);
    const unsubChannels = watchChannels(id, (chans) => {
      setChannels(chans);
      setActiveChannelId((current) => {
        if (routeChannelId && chans.some(c => c.id === routeChannelId)) return routeChannelId;
        if (current && chans.some(c => c.id === current)) return current;
        return chans[0]?.id || null;
      });
    });
    return () => { unsubMembers(); unsubChannels(); };
  }, [id, routeChannelId]);

  if (!profile) return null;

  const myMemberInfo = members.find(m => m.userId === profile.id);
  const isMember = !!myMemberInfo;
  const myRole = myMemberInfo?.role || ROLES.MEMBER;
  const isOwner = myRole === ROLES.OWNER;
  const isAdmin = myRole === ROLES.OWNER || myRole === ROLES.ADMIN;
  const isMod = isAdmin || myRole === ROLES.MODERATOR;

  useEffect(() => {
    if (!id || !activeChannelId || !isMember) {
      setMessages([]);
      return;
    }
    return watchMessages(id, activeChannelId, setMessages);
  }, [id, activeChannelId, isMember]);

  useEffect(() => {
    if (!id || !isAdmin) {
      setJoinRequests([]);
      return;
    }
    return watchJoinRequests(id, setJoinRequests);
  }, [id, isAdmin]);

  useEffect(() => {
    if (!id || !isMember) {
      setChallenges([]);
      return;
    }
    return watchClubChallenges(id, setChallenges);
  }, [id, isMember]);

  useEffect(() => {
    if (routeChannelId && routeChannelId !== activeChannelId) setActiveChannelId(routeChannelId);
  }, [routeChannelId, activeChannelId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (club === undefined) return <div className="font-mono text-xs opacity-50 text-center py-20">LOADING...</div>;
  if (!club) return (
    <div className="text-center py-20">
      <div className="font-display italic opacity-50">Club not found</div>
      <button onClick={() => navigate('/clubs')} className="btn-ghost mt-6">Back to Clubs</button>
    </div>
  );

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const approvalOnly = club.joinMode === JOIN_MODES.APPROVAL;
  const bannedIds = club.bannedIds || [];

  const handleJoin = async () => {
    setBusy(true);
    try {
      const status = await joinClub(id, profile);
      if (status === 'requested') {
        setRequestSent(true);
        toast('Application sent to the club owner', 'success');
      } else {
        toast(`Joined ${club.name}`, 'success');
      }
      sfx.click();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    const ok = await confirm({ title: 'Leave club?', body: 'You will lose access to club messages.', confirmLabel: 'Leave' });
    if (!ok) return;
    try {
      await leaveClub(id, profile);
      toast('Left club', 'success');
      navigate('/clubs');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteClub = async () => {
    const ok = await confirm({ title: 'Delete club?', body: 'The club shell will be removed. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteClub(id, profile);
      toast('Club deleted', 'success');
      navigate('/clubs');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !activeChannelId) return;
    try {
      await sendClubChat(id, activeChannelId, profile, chatInput);
      setChatInput('');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleEditMsg = async (msgId, text) => {
    try {
      await editMessage(id, activeChannelId, msgId, profile, text);
      setEditingMsgId(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteMsg = async (msgId) => {
    const ok = await confirm({ title: 'Delete message?', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteMessage(id, activeChannelId, msgId, profile);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      {confirmEl}
      {showSettings && (
        <SettingsModal
          club={club}
          members={members}
          channels={channels}
          requests={joinRequests}
          challenges={challenges}
          bannedIds={bannedIds}
          currentUser={profile}
          myRole={myRole}
          onClose={() => setShowSettings(false)}
          onDeleteClub={handleDeleteClub}
        />
      )}

      <div className="fade-in grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-0 h-[calc(100vh-160px)] border hairline overflow-hidden bg-[var(--paper-tint)]">
        <aside className="hidden lg:flex border-r hairline flex-col bg-black/[0.02]">
          <div className="p-4 border-b hairline flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-medium truncate" title={club.name}>{club.name}</h2>
              <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest mt-1">
                {club.memberCount || 0} members
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} className="p-2 opacity-50 hover:opacity-100 relative" aria-label="Club settings">
                <Settings size={18} />
                {joinRequests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--crimson)] rounded-full" />}
              </button>
            )}
          </div>

          <div className="p-3 border-b hairline space-y-2">
            {(club.announcements || []).slice(-2).reverse().map(a => (
              <div key={a.id} className="border hairline rounded-lg p-3 bg-[var(--ochre)]/5">
                <div className="font-mono text-[0.55rem] uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1"><Megaphone size={10} /> Announcement</div>
                <div className="font-display text-sm leading-snug">{a.text}</div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="px-2 mb-2 font-mono text-[0.65rem] opacity-40 uppercase tracking-widest">Channels</div>
            <div className="space-y-0.5">
              {channels.map(chan => (
                <button
                  key={chan.id}
                  onClick={() => { setActiveChannelId(chan.id); navigate(`/clubs/${id}/${chan.id}`); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-sm font-display ${activeChannelId === chan.id ? 'bg-black/10 font-medium' : 'hover:bg-black/5 opacity-70'}`}
                  disabled={!isMember}
                >
                  <Hash size={14} className="opacity-40" />
                  {chan.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 border-t hairline space-y-2">
            {!isMember ? (
              <button onClick={handleJoin} disabled={busy || requestSent} className="btn-primary w-full text-[0.65rem] py-2">
                <UserPlus size={12} /> {requestSent ? 'Applied' : approvalOnly ? 'Apply to Join' : 'Join Club'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-lg">{profile.avatar || '◆'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono truncate">{profile.username}</div>
                  <div className="text-[0.55rem] font-mono opacity-50 uppercase tracking-tighter">{myRole}</div>
                </div>
                {!isOwner && <button onClick={handleLeave} title="Leave club" className="opacity-40 hover:opacity-100"><LogOut size={14} /></button>}
              </div>
            )}
          </div>
        </aside>

        <main className="flex flex-col min-w-0 bg-[var(--paper)]">
          <div className="h-14 px-4 flex items-center justify-between border-b hairline shrink-0">
            <div className="flex items-center gap-2 font-display text-lg font-medium min-w-0">
              <button onClick={() => navigate('/clubs')} className="lg:hidden p-2 -ml-2 opacity-50"><ArrowLeft size={18} /></button>
              <Hash size={18} className="opacity-40" />
              <span className="truncate">{activeChannel?.name || 'general'}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[0.6rem] uppercase tracking-widest opacity-50">
              {approvalOnly ? <><Lock size={12} /> Approval</> : <><Globe2 size={12} /> Open</>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
            {!isMember ? (
              <div className="h-full flex flex-col items-center justify-center opacity-45 text-center px-8">
                <Shield size={48} className="mb-4 stroke-[1px]" />
                <div className="font-display text-xl mb-2">Members-only messages</div>
                <p className="font-display text-sm max-w-md">
                  This club is visible in Discover, but its channels stay private until you join.
                </p>
                <button onClick={handleJoin} disabled={busy || requestSent} className="btn-primary mt-6">
                  <UserPlus size={14} /> {requestSent ? 'Application Sent' : approvalOnly ? 'Apply for Permit' : 'Join Club'}
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-display">
                <MessageSquare size={48} className="mb-4 stroke-[1px]" />
                No messages here yet.
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.userId === profile.id}
                  isMod={isMod}
                  onEdit={() => { setEditingMsgId(msg.id); setEditInput(msg.text); }}
                  onDelete={() => handleDeleteMsg(msg.id)}
                  editing={editingMsgId === msg.id}
                  editInput={editInput}
                  setEditInput={setEditInput}
                  onSaveEdit={(text) => handleEditMsg(msg.id, text)}
                  onCancelEdit={() => setEditingMsgId(null)}
                />
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 pt-0 shrink-0">
            {isMember ? (
              <form onSubmit={handleSendChat} className="flex items-end gap-2 border hairline rounded-lg bg-black/[0.02] p-2 focus-within:border-[var(--ink)] transition-colors">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value.slice(0, 2000))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder={`Message #${activeChannel?.name || 'general'}`}
                  className="flex-1 bg-transparent resize-none py-1 px-2 outline-none font-display text-base min-h-[40px] max-h-[160px]"
                  rows={1}
                  disabled={!activeChannelId}
                />
                <button type="submit" disabled={!activeChannelId || !chatInput.trim()} className="p-2 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity" aria-label="Send message">
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <div className="text-center p-4 border hairline rounded-lg font-mono text-xs opacity-40 uppercase tracking-widest">
                Join this club to read and write messages
              </div>
            )}
          </div>
        </main>

        <aside className="hidden lg:flex border-l hairline flex-col bg-black/[0.01]">
          <div className="h-14 px-4 flex items-center border-b hairline font-mono text-[0.65rem] uppercase tracking-widest opacity-50 shrink-0">
            Members - {members.length}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin">
            <MemberGroup title="Owner" members={members.filter(m => m.role === ROLES.OWNER)} />
            <MemberGroup title="Admins" members={members.filter(m => m.role === ROLES.ADMIN)} />
            <MemberGroup title="Moderators" members={members.filter(m => m.role === ROLES.MODERATOR)} />
            <MemberGroup title="Members" members={members.filter(m => m.role === ROLES.MEMBER)} />
          </div>
        </aside>
      </div>
    </>
  );
}

function SettingsModal({ club, members, channels, requests, challenges, bannedIds, currentUser, myRole, onClose, onDeleteClub }) {
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(club.name);
  const [desc, setDesc] = useState(club.description || '');
  const [joinMode, setJoinMode] = useState(club.joinMode || JOIN_MODES.OPEN);
  const [newChanName, setNewChanName] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);
  const [discoverableClubs, setDiscoverableClubs] = useState([]);
  const [targetClubId, setTargetClubId] = useState('');
  const [challengeNote, setChallengeNote] = useState('');
  const { confirm, dialog: confirmEl } = useConfirm();

  const isOwner = myRole === ROLES.OWNER;
  const isAdmin = isOwner || myRole === ROLES.ADMIN;
  const isMod = isAdmin || myRole === ROLES.MODERATOR;

  useEffect(() => {
    if (tab !== 'leaderboard' || leaderboard) return;
    getClubLeaderboard(club.id).then(setLeaderboard).catch(err => toast(err.message, 'error'));
  }, [tab, leaderboard, club.id]);

  useEffect(() => {
    if (tab !== 'challenges') return;
    listPublicClubs()
      .then(list => setDiscoverableClubs(list.filter(c => c.id !== club.id)))
      .catch(err => toast(err.message, 'error'));
  }, [tab, club.id]);

  const handleUpdateGeneral = async () => {
    setBusy(true);
    try {
      await updateClubMetadata(club.id, currentUser, { name, description: desc, isPublic: true, joinMode });
      toast('Club updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateChan = async (e) => {
    e?.preventDefault();
    if (!newChanName.trim()) return;
    setBusy(true);
    try {
      await createChannel(club.id, currentUser, { name: newChanName, order: channels.length });
      setNewChanName('');
      toast('Channel created', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteChan = async (cid) => {
    const ok = await confirm({ title: 'Delete channel?', body: 'All messages in it will be lost.', danger: true });
    if (!ok) return;
    try {
      await deleteChannel(club.id, cid, currentUser);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleAnnouncement = async (e) => {
    e?.preventDefault();
    if (!announcement.trim()) return;
    setBusy(true);
    try {
      await postAnnouncement(club.id, currentUser, announcement);
      setAnnouncement('');
      toast('Announcement posted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChallenge = async (e) => {
    e?.preventDefault();
    if (!targetClubId) return;
    setBusy(true);
    try {
      await createClubChallenge(club, targetClubId, currentUser, challengeNote);
      setTargetClubId('');
      setChallengeNote('');
      toast('Club challenge sent', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in">
      {confirmEl}
      <div className="bg-[var(--paper-tint)] border hairline w-full max-w-5xl h-[84vh] shadow-2xl rounded-2xl flex overflow-hidden">
        <div className="w-56 border-r hairline bg-black/[0.02] p-4 space-y-1 overflow-y-auto">
          <div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest px-3 mb-2">Club Settings</div>
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'channels', label: 'Channels', icon: Hash },
            { id: 'members', label: 'Members', icon: Users, count: members.length },
            { id: 'requests', label: 'Requests', icon: UserPlus, count: requests.length },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { id: 'challenges', label: 'Club Matches', icon: Swords, count: challenges.filter(c => c.status === 'pending').length },
            { id: 'bans', label: 'Bans', icon: Ban, count: bannedIds.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm transition-colors ${tab === t.id ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-black/5 opacity-70'}`}>
              <t.icon size={16} />
              <span className="flex-1 text-left">{t.label}</span>
              {t.count > 0 && <span className={`text-[0.6rem] px-1.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-[var(--crimson)] text-white'}`}>{t.count}</span>}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t hairline space-y-1">
            <button onClick={onClose} className="w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm hover:bg-black/5">
              <LogOut size={16} /> Close
            </button>
            {isOwner && (
              <button onClick={onDeleteClub} className="w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm text-[var(--crimson)] hover:bg-[var(--crimson)]/5">
                <Trash2 size={16} /> Delete Club
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto bg-[var(--paper)]">
          {tab === 'general' && (
            <div className="max-w-lg space-y-6">
              <h2 className="font-display text-2xl">General Settings</h2>
              <div>
                <label className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Club Name</label>
                <input className="input-field" value={name} onChange={e => setName(e.target.value.slice(0, 40))} />
              </div>
              <div>
                <label className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Description</label>
                <textarea className="input-field" value={desc} onChange={e => setDesc(e.target.value.slice(0, 200))} style={{ minHeight: 90 }} />
              </div>
              <div>
                <div className="font-mono block mb-3 text-[0.65rem] tracking-widest uppercase opacity-55">Join Access</div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setJoinMode(JOIN_MODES.OPEN)} className={`border hairline rounded-lg p-4 text-left ${joinMode === JOIN_MODES.OPEN ? 'bg-black/5 border-[var(--ink)]' : 'opacity-70'}`}>
                    <Globe2 size={16} className="mb-2" />
                    <div className="font-display">Open</div>
                    <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-50 mt-1">Anyone can join</div>
                  </button>
                  <button type="button" onClick={() => setJoinMode(JOIN_MODES.APPROVAL)} className={`border hairline rounded-lg p-4 text-left ${joinMode === JOIN_MODES.APPROVAL ? 'bg-black/5 border-[var(--ink)]' : 'opacity-70'}`}>
                    <Lock size={16} className="mb-2" />
                    <div className="font-display">Approval</div>
                    <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-50 mt-1">Apply for permit</div>
                  </button>
                </div>
              </div>
              <button onClick={handleUpdateGeneral} disabled={busy || !isAdmin} className="btn-primary w-full">Save Changes</button>
            </div>
          )}

          {tab === 'announcements' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Announcements</h2>
              <form onSubmit={handleAnnouncement} className="border hairline rounded-xl p-4 space-y-3 bg-[var(--paper-tint)]">
                <textarea value={announcement} onChange={e => setAnnouncement(e.target.value.slice(0, 500))} placeholder="Post an announcement for all members..." className="input-field" style={{ minHeight: 90 }} />
                <button type="submit" disabled={busy || !announcement.trim() || !isAdmin} className="btn-primary"><Megaphone size={14} /> Post</button>
              </form>
              <div className="space-y-3">
                {(club.announcements || []).slice().reverse().map(a => (
                  <div key={a.id} className="border hairline rounded-xl p-4 bg-[var(--paper-tint)]">
                    <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-45 mb-2">{a.byUsername} - {new Date(a.ts).toLocaleString()}</div>
                    <div className="font-display text-base leading-relaxed">{a.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'channels' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl">Channels</h2>
                <form onSubmit={handleCreateChan} className="flex gap-2">
                  <input placeholder="New channel..." value={newChanName} onChange={e => setNewChanName(e.target.value)} className="bg-black/5 border hairline rounded px-3 py-1.5 text-sm outline-none focus:border-[var(--ink)]" />
                  <button type="submit" disabled={busy || !newChanName.trim() || !isAdmin} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} /></button>
                </form>
              </div>
              <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                {channels.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                    <div className="flex items-center gap-3"><Hash size={16} className="opacity-40" /><span className="font-display font-medium">#{c.name}</span></div>
                    {c.name !== 'general' && isAdmin && <button onClick={() => handleDeleteChan(c.id)} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded"><Trash2 size={16} /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Members ({members.length})</h2>
              <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                {[...members].sort((a, b) => a.username.localeCompare(b.username)).map(m => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 p-4 bg-[var(--paper-tint)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{m.avatar}</span>
                      <div className="min-w-0">
                        <div className="font-display font-medium truncate">{m.username}</div>
                        <div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest">{m.role}</div>
                      </div>
                    </div>
                    {isOwner && m.userId !== currentUser.id && m.role !== ROLES.OWNER && (
                      <div className="flex gap-2 items-center">
                        <select value={m.role} onChange={(e) => updateMemberRole(club.id, m.userId, currentUser, e.target.value).catch(err => toast(err.message, 'error'))} className="bg-black/5 border hairline rounded px-2 py-1 text-xs font-mono outline-none">
                          <option value={ROLES.ADMIN}>Admin</option>
                          <option value={ROLES.MODERATOR}>Moderator</option>
                          <option value={ROLES.MEMBER}>Member</option>
                        </select>
                        <button onClick={() => transferOwnership(club.id, m.userId, currentUser).then(() => toast('Ownership transferred', 'success')).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--ochre)] hover:bg-[var(--ochre)]/10 rounded" title="Transfer ownership"><Crown size={16} /></button>
                        <button onClick={() => kickMember(club.id, m.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded" title="Kick"><UserMinus size={16} /></button>
                        <button onClick={() => banMember(club.id, m.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded" title="Ban"><Ban size={16} /></button>
                      </div>
                    )}
                    {!isOwner && isMod && m.role === ROLES.MEMBER && (
                      <div className="flex gap-2">
                        <button onClick={() => kickMember(club.id, m.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded" title="Kick"><UserMinus size={16} /></button>
                        <button onClick={() => banMember(club.id, m.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded" title="Ban"><Ban size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Join Requests ({requests.length})</h2>
              {requests.length === 0 ? <Empty text="No pending requests." /> : (
                <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                  {requests.map(r => (
                    <div key={r.userId} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                      <div className="flex items-center gap-3"><span className="text-xl">{r.avatar}</span><div><div className="font-display font-medium">{r.username}</div><div className="font-mono text-[0.6rem] opacity-40 tracking-widest">Permit application</div></div></div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptJoinRequest(club.id, r, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 bg-[var(--forest)]/10 text-[var(--forest)] hover:bg-[var(--forest)]/20 rounded"><Check size={18} /></button>
                        <button onClick={() => rejectJoinRequest(club.id, r.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 bg-[var(--crimson)]/10 text-[var(--crimson)] hover:bg-[var(--crimson)]/20 rounded"><X size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Club Leaderboard</h2>
              {!leaderboard ? <div className="font-mono text-xs opacity-50 py-10">LOADING...</div> : (
                <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                  {leaderboard.map((m, idx) => (
                    <div key={m.userId} className="grid grid-cols-[40px_1fr_80px_80px] items-center gap-3 p-4 bg-[var(--paper-tint)]">
                      <div className="font-mono text-xs opacity-50">#{idx + 1}</div>
                      <div className="flex items-center gap-3 min-w-0"><span className="text-xl">{m.avatar}</span><span className="font-display truncate">{m.username}</span></div>
                      <div className="font-display text-xl tabular-nums">{m.elo}</div>
                      <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest">{m.wins}W {m.losses}L</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'challenges' && (
            <div className="space-y-8">
              <h2 className="font-display text-2xl">Club-vs-Club Matches</h2>
              {isAdmin && (
                <form onSubmit={handleChallenge} className="border hairline rounded-xl p-4 bg-[var(--paper-tint)] space-y-3">
                  <select value={targetClubId} onChange={e => setTargetClubId(e.target.value)} className="input-field">
                    <option value="">Choose a club to challenge</option>
                    {discoverableClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <textarea value={challengeNote} onChange={e => setChallengeNote(e.target.value.slice(0, 200))} placeholder="Suggested board size, time, or lineup..." className="input-field" style={{ minHeight: 70 }} />
                  <button type="submit" disabled={busy || !targetClubId} className="btn-primary"><Swords size={14} /> Send Challenge</button>
                </form>
              )}
              <div className="space-y-3">
                {challenges.length === 0 ? <Empty text="No club challenges yet." /> : challenges.map(ch => {
                  const incoming = ch.toClubId === club.id;
                  return (
                    <div key={ch.id} className="border hairline rounded-xl p-4 bg-[var(--paper-tint)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-display text-lg">{ch.fromClubName} vs {ch.toClubName}</div>
                          <div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-45 mt-1">{ch.status}</div>
                        </div>
                        {incoming && isAdmin && ch.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => respondClubChallenge(ch.id, currentUser, true).catch(err => toast(err.message, 'error'))} className="btn-primary text-xs py-1.5">Accept</button>
                            <button onClick={() => respondClubChallenge(ch.id, currentUser, false).catch(err => toast(err.message, 'error'))} className="btn-ghost text-xs py-1.5">Decline</button>
                          </div>
                        )}
                      </div>
                      {ch.note && <div className="font-display text-sm opacity-70 mt-3">{ch.note}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'bans' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Banned Players ({bannedIds.length})</h2>
              {bannedIds.length === 0 ? <Empty text="No banned players." /> : (
                <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                  {bannedIds.map(uid => (
                    <div key={uid} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                      <div className="font-mono text-xs opacity-60 break-all">{uid}</div>
                      {isMod && <button onClick={() => unbanMember(club.id, uid, currentUser).catch(err => toast(err.message, 'error'))} className="btn-ghost text-xs py-1.5">Unban</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageItem({ msg, isOwn, isMod, onEdit, onDelete, editing, editInput, setEditInput, onSaveEdit, onCancelEdit }) {
  return (
    <div className="group relative flex items-start gap-4 hover:bg-black/[0.02] px-4 py-2 mx-[-1rem] transition-colors rounded">
      <span className="text-2xl mt-1 select-none shrink-0">{msg.avatar}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-mono text-xs font-bold">{msg.username}</span>
          <span className="font-mono text-[0.55rem] opacity-30 uppercase">{new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {msg.status === 'edited' && <span className="text-[0.6rem] opacity-20 italic">edited</span>}
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea value={editInput} onChange={e => setEditInput(e.target.value)} className="w-full bg-black/5 border hairline rounded p-2 outline-none font-display text-base" autoFocus />
            <div className="flex gap-2 mt-1 text-[0.65rem] font-mono">
              <button onClick={onCancelEdit} className="text-[var(--crimson)] hover:underline">cancel</button>
              <span>|</span>
              <button onClick={() => onSaveEdit(editInput)} className="text-[var(--forest)] hover:underline">save</button>
            </div>
          </div>
        ) : (
          <div className="font-display text-base leading-snug break-words whitespace-pre-wrap opacity-90">{msg.text}</div>
        )}
      </div>
      {!editing && (isOwn || isMod) && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-[var(--paper-tint)] border hairline rounded shadow-sm overflow-hidden">
          {isOwn && <button onClick={onEdit} className="p-1.5 hover:bg-black/5" title="Edit">edit</button>}
          <button onClick={onDelete} className="p-1.5 hover:bg-black/5 text-[var(--crimson)]" title="Delete"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function MemberGroup({ title, members }) {
  if (members.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest mb-2 flex items-center gap-2">{title} - {members.length}</div>
      <div className="space-y-1">
        {members.map(m => (
          <Link key={m.userId} to={`/profile/${m.username}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-black/5 group transition-colors">
            <span className="text-lg">{m.avatar}</span>
            <span className="font-display text-sm truncate opacity-80 group-hover:opacity-100">{m.username}</span>
            <RoleBadge role={m.role} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  if (role === ROLES.OWNER) return <Crown size={12} className="text-[var(--ochre)] ml-auto" />;
  if (role === ROLES.ADMIN) return <Shield size={12} className="text-[var(--crimson)] ml-auto" />;
  if (role === ROLES.MODERATOR) return <Shield size={12} className="text-[var(--forest)] ml-auto" />;
  return null;
}

function Empty({ text }) {
  return <div className="text-center py-16 opacity-30 italic font-display border hairline rounded-xl border-dashed">{text}</div>;
}
