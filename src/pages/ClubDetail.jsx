import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  watchClub, watchMembers, watchChannels, watchMessages,
  joinClub, leaveClub, deleteClub, sendClubChat, deleteMessage,
  migrateClubIfNeeded, ROLES, JOIN_MODES, createChannel, deleteChannel,
  updateMemberRole, kickMember, banMember, unbanMember, transferOwnership,
  acceptJoinRequest, rejectJoinRequest, updateClubMetadata, watchJoinRequests,
  postAnnouncement, getClubLeaderboard, listPublicClubs, watchClubChallenges,
  createClubChallenge, respondClubChallenge
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
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const chatEndRef = useRef(null);

  const myMemberInfo = profile ? members.find(m => m.userId === profile.id) : null;
  const isMember = !!myMemberInfo;
  const myRole = myMemberInfo?.role || ROLES.MEMBER;
  const isOwner = myRole === ROLES.OWNER;
  const isAdmin = myRole === ROLES.OWNER || myRole === ROLES.ADMIN;
  const isMod = isAdmin || myRole === ROLES.MODERATOR;
  const activeChannel = channels.find(c => c.id === activeChannelId);
  const approvalOnly = club?.joinMode === JOIN_MODES.APPROVAL;
  const bannedIds = club?.bannedIds || [];

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

  if (!profile) return null;
  if (club === undefined) return <div className="font-mono text-xs opacity-50 text-center py-20">LOADING...</div>;
  if (!club) return (
    <div className="text-center py-20">
      <div className="font-display italic opacity-50">Club not found</div>
      <button onClick={() => navigate('/clubs')} className="btn-ghost mt-6">Back to Clubs</button>
    </div>
  );

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
              <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest mt-1">{club.memberCount || 0} members</div>
            </div>
            {isAdmin && <button onClick={() => setShowSettings(true)} className="p-2 opacity-50 hover:opacity-100 relative" aria-label="Club settings"><Settings size={18} />{joinRequests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--crimson)] rounded-full" />}</button>}
          </div>

          <div className="p-3 border-b hairline space-y-2">
            {(club.announcements || []).slice(-2).reverse().map(a => <Announcement key={a.id} item={a} />)}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="px-2 mb-2 font-mono text-[0.65rem] opacity-40 uppercase tracking-widest">Channels</div>
            <div className="space-y-0.5">
              {channels.map(chan => (
                <button key={chan.id} onClick={() => { setActiveChannelId(chan.id); navigate(`/clubs/${id}/${chan.id}`); }} disabled={!isMember} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-sm font-display ${activeChannelId === chan.id ? 'bg-black/10 font-medium' : 'hover:bg-black/5 opacity-70'}`}>
                  <Hash size={14} className="opacity-40" />{chan.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 border-t hairline space-y-2">
            {!isMember ? (
              <button onClick={handleJoin} disabled={busy || requestSent} className="btn-primary w-full text-[0.65rem] py-2"><UserPlus size={12} /> {requestSent ? 'Applied' : approvalOnly ? 'Apply to Join' : 'Join Club'}</button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-lg">{profile.avatar || '◆'}</span>
                <div className="min-w-0 flex-1"><div className="text-xs font-mono truncate">{profile.username}</div><div className="text-[0.55rem] font-mono opacity-50 uppercase tracking-tighter">{myRole}</div></div>
                {!isOwner && <button onClick={handleLeave} title="Leave club" className="opacity-40 hover:opacity-100"><LogOut size={14} /></button>}
              </div>
            )}
          </div>
        </aside>

        <main className="flex flex-col min-w-0 bg-[var(--paper)]">
          <div className="h-14 px-4 flex items-center justify-between border-b hairline shrink-0">
            <div className="flex items-center gap-2 font-display text-lg font-medium min-w-0"><button onClick={() => navigate('/clubs')} className="lg:hidden p-2 -ml-2 opacity-50"><ArrowLeft size={18} /></button><Hash size={18} className="opacity-40" /><span className="truncate">{activeChannel?.name || 'general'}</span></div>
            <div className="flex items-center gap-3 font-mono text-[0.6rem] uppercase tracking-widest opacity-50">{approvalOnly ? <><Lock size={12} /> Approval</> : <><Globe2 size={12} /> Open</>}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
            {!isMember ? <JoinGate requestSent={requestSent} approvalOnly={approvalOnly} busy={busy} onJoin={handleJoin} />
              : messages.length === 0 ? <Empty text="No messages here yet." icon={<MessageSquare size={48} className="mb-4 stroke-[1px]" />} />
              : messages.map(msg => <MessageItem key={msg.id} msg={msg} canDelete={msg.userId === profile.id || isMod} onDelete={() => handleDeleteMsg(msg.id)} />)}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 pt-0 shrink-0">
            {isMember ? (
              <form onSubmit={handleSendChat} className="flex items-end gap-2 border hairline rounded-lg bg-black/[0.02] p-2 focus-within:border-[var(--ink)] transition-colors">
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value.slice(0, 2000))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} placeholder={`Message #${activeChannel?.name || 'general'}`} className="flex-1 bg-transparent resize-none py-1 px-2 outline-none font-display text-base min-h-[40px] max-h-[160px]" rows={1} disabled={!activeChannelId} />
                <button type="submit" disabled={!activeChannelId || !chatInput.trim()} className="p-2 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity" aria-label="Send message"><Send size={18} /></button>
              </form>
            ) : <div className="text-center p-4 border hairline rounded-lg font-mono text-xs opacity-40 uppercase tracking-widest">Join this club to read and write messages</div>}
          </div>
        </main>

        <aside className="hidden lg:flex border-l hairline flex-col bg-black/[0.01]"><div className="h-14 px-4 flex items-center border-b hairline font-mono text-[0.65rem] uppercase tracking-widest opacity-50 shrink-0">Members - {members.length}</div><div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin"><MemberGroup title="Owner" members={members.filter(m => m.role === ROLES.OWNER)} /><MemberGroup title="Admins" members={members.filter(m => m.role === ROLES.ADMIN)} /><MemberGroup title="Moderators" members={members.filter(m => m.role === ROLES.MODERATOR)} /><MemberGroup title="Members" members={members.filter(m => m.role === ROLES.MEMBER)} /></div></aside>
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

  useEffect(() => { if (tab === 'leaderboard' && !leaderboard) getClubLeaderboard(club.id).then(setLeaderboard).catch(err => toast(err.message, 'error')); }, [tab, leaderboard, club.id]);
  useEffect(() => { if (tab === 'challenges') listPublicClubs().then(list => setDiscoverableClubs(list.filter(c => c.id !== club.id))).catch(err => toast(err.message, 'error')); }, [tab, club.id]);

  const saveGeneral = async () => { setBusy(true); try { await updateClubMetadata(club.id, currentUser, { name, description: desc, isPublic: true, joinMode }); toast('Club updated', 'success'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); } };
  const addChannel = async (e) => { e?.preventDefault(); if (!newChanName.trim()) return; setBusy(true); try { await createChannel(club.id, currentUser, { name: newChanName, order: channels.length }); setNewChanName(''); toast('Channel created', 'success'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); } };
  const removeChannel = async (cid) => { if (await confirm({ title: 'Delete channel?', body: 'All messages in it will be lost.', danger: true })) deleteChannel(club.id, cid, currentUser).catch(err => toast(err.message, 'error')); };
  const addAnnouncement = async (e) => { e?.preventDefault(); if (!announcement.trim()) return; setBusy(true); try { await postAnnouncement(club.id, currentUser, announcement); setAnnouncement(''); toast('Announcement posted', 'success'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); } };
  const addChallenge = async (e) => { e?.preventDefault(); if (!targetClubId) return; setBusy(true); try { await createClubChallenge(club, targetClubId, currentUser, challengeNote); setTargetClubId(''); setChallengeNote(''); toast('Club challenge sent', 'success'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); } };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in">{confirmEl}<div className="bg-[var(--paper-tint)] border hairline w-full max-w-5xl h-[84vh] shadow-2xl rounded-2xl flex overflow-hidden">
      <div className="w-56 border-r hairline bg-black/[0.02] p-4 space-y-1 overflow-y-auto"><div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest px-3 mb-2">Club Settings</div>{[
        ['general', 'General', Settings, 0], ['announcements', 'Announcements', Megaphone, 0], ['channels', 'Channels', Hash, 0], ['members', 'Members', Users, members.length], ['requests', 'Requests', UserPlus, requests.length], ['leaderboard', 'Leaderboard', Trophy, 0], ['challenges', 'Club Matches', Swords, challenges.filter(c => c.status === 'pending').length], ['bans', 'Bans', Ban, bannedIds.length]
      ].map(([id, label, Icon, count]) => <button key={id} onClick={() => setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm transition-colors ${tab === id ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-black/5 opacity-70'}`}><Icon size={16} /><span className="flex-1 text-left">{label}</span>{count > 0 && <span className={`text-[0.6rem] px-1.5 rounded-full ${tab === id ? 'bg-white/20' : 'bg-[var(--crimson)] text-white'}`}>{count}</span>}</button>)}<div className="pt-4 mt-4 border-t hairline space-y-1"><button onClick={onClose} className="w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm hover:bg-black/5"><LogOut size={16} /> Close</button>{isOwner && <button onClick={onDeleteClub} className="w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm text-[var(--crimson)] hover:bg-[var(--crimson)]/5"><Trash2 size={16} /> Delete Club</button>}</div></div>
      <div className="flex-1 p-8 overflow-y-auto bg-[var(--paper)]">
        {tab === 'general' && <div className="max-w-lg space-y-6"><h2 className="font-display text-2xl">General Settings</h2><input className="input-field" value={name} onChange={e => setName(e.target.value.slice(0, 40))} /><textarea className="input-field" value={desc} onChange={e => setDesc(e.target.value.slice(0, 200))} style={{ minHeight: 90 }} /><div className="grid grid-cols-2 gap-3"><AccessButton active={joinMode === JOIN_MODES.OPEN} onClick={() => setJoinMode(JOIN_MODES.OPEN)} icon={<Globe2 size={16} />} title="Open" body="Anyone can join" /><AccessButton active={joinMode === JOIN_MODES.APPROVAL} onClick={() => setJoinMode(JOIN_MODES.APPROVAL)} icon={<Lock size={16} />} title="Approval" body="Apply for permit" /></div><button onClick={saveGeneral} disabled={busy || !isAdmin} className="btn-primary w-full">Save Changes</button></div>}
        {tab === 'announcements' && <div className="space-y-6"><h2 className="font-display text-2xl">Announcements</h2><form onSubmit={addAnnouncement} className="border hairline rounded-xl p-4 space-y-3 bg-[var(--paper-tint)]"><textarea value={announcement} onChange={e => setAnnouncement(e.target.value.slice(0, 500))} placeholder="Post an announcement..." className="input-field" style={{ minHeight: 90 }} /><button type="submit" disabled={busy || !announcement.trim() || !isAdmin} className="btn-primary"><Megaphone size={14} /> Post</button></form><div className="space-y-3">{(club.announcements || []).slice().reverse().map(a => <Announcement key={a.id} item={a} />)}</div></div>}
        {tab === 'channels' && <div className="space-y-8"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl">Channels</h2><form onSubmit={addChannel} className="flex gap-2"><input placeholder="New channel..." value={newChanName} onChange={e => setNewChanName(e.target.value)} className="bg-black/5 border hairline rounded px-3 py-1.5 text-sm outline-none focus:border-[var(--ink)]" /><button type="submit" disabled={busy || !newChanName.trim() || !isAdmin} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} /></button></form></div><PanelList>{channels.map(c => <Row key={c.id} left={<><Hash size={16} className="opacity-40" />#{c.name}</>} right={c.name !== 'general' && isAdmin && <button onClick={() => removeChannel(c.id)} className="p-2 text-[var(--crimson)]"><Trash2 size={16} /></button>} />)}</PanelList></div>}
        {tab === 'members' && <MembersPanel club={club} members={members} currentUser={currentUser} isOwner={isOwner} isMod={isMod} />}
        {tab === 'requests' && <RequestsPanel club={club} requests={requests} currentUser={currentUser} />}
        {tab === 'leaderboard' && <LeaderboardPanel rows={leaderboard} />}
        {tab === 'challenges' && <ChallengesPanel club={club} challenges={challenges} discoverableClubs={discoverableClubs} targetClubId={targetClubId} setTargetClubId={setTargetClubId} challengeNote={challengeNote} setChallengeNote={setChallengeNote} addChallenge={addChallenge} currentUser={currentUser} isAdmin={isAdmin} />}
        {tab === 'bans' && <BansPanel club={club} bannedIds={bannedIds} currentUser={currentUser} isMod={isMod} />}
      </div>
    </div></div>
  );
}

function MembersPanel({ club, members, currentUser, isOwner, isMod }) { return <div className="space-y-6"><h2 className="font-display text-2xl">Members ({members.length})</h2><PanelList>{[...members].sort((a, b) => a.username.localeCompare(b.username)).map(m => <Row key={m.userId} left={<><span className="text-xl">{m.avatar}</span><span>{m.username}</span><span className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest">{m.role}</span></>} right={<MemberActions club={club} member={m} currentUser={currentUser} isOwner={isOwner} isMod={isMod} />} />)}</PanelList></div>; }
function MemberActions({ club, member, currentUser, isOwner, isMod }) { if (member.userId === currentUser.id || member.role === ROLES.OWNER) return null; if (!isOwner && !(isMod && member.role === ROLES.MEMBER)) return null; return <div className="flex gap-2 items-center">{isOwner && <select value={member.role} onChange={(e) => updateMemberRole(club.id, member.userId, currentUser, e.target.value).catch(err => toast(err.message, 'error'))} className="bg-black/5 border hairline rounded px-2 py-1 text-xs font-mono outline-none"><option value={ROLES.ADMIN}>Admin</option><option value={ROLES.MODERATOR}>Moderator</option><option value={ROLES.MEMBER}>Member</option></select>}{isOwner && <button onClick={() => transferOwnership(club.id, member.userId, currentUser).then(() => toast('Ownership transferred', 'success')).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--ochre)]" title="Transfer ownership"><Crown size={16} /></button>}<button onClick={() => kickMember(club.id, member.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)]" title="Kick"><UserMinus size={16} /></button><button onClick={() => banMember(club.id, member.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 text-[var(--crimson)]" title="Ban"><Ban size={16} /></button></div>; }
function RequestsPanel({ club, requests, currentUser }) { return <div className="space-y-6"><h2 className="font-display text-2xl">Join Requests ({requests.length})</h2>{requests.length === 0 ? <PlainEmpty text="No pending requests." /> : <PanelList>{requests.map(r => <Row key={r.userId} left={<><span className="text-xl">{r.avatar}</span><span>{r.username}</span><span className="font-mono text-[0.6rem] opacity-40 tracking-widest">Permit application</span></>} right={<div className="flex gap-2"><button onClick={() => acceptJoinRequest(club.id, r, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 bg-[var(--forest)]/10 text-[var(--forest)] rounded"><Check size={18} /></button><button onClick={() => rejectJoinRequest(club.id, r.userId, currentUser).catch(err => toast(err.message, 'error'))} className="p-2 bg-[var(--crimson)]/10 text-[var(--crimson)] rounded"><X size={18} /></button></div>} />)}</PanelList>}</div>; }
function LeaderboardPanel({ rows }) { return <div className="space-y-6"><h2 className="font-display text-2xl">Club Leaderboard</h2>{!rows ? <div className="font-mono text-xs opacity-50 py-10">LOADING...</div> : <PanelList>{rows.map((m, idx) => <Row key={m.userId} left={<><span className="font-mono text-xs opacity-50">#{idx + 1}</span><span className="text-xl">{m.avatar}</span><span>{m.username}</span></>} right={<><span className="font-display text-xl tabular-nums">{m.elo}</span><span className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest">{m.wins}W {m.losses}L</span></>} />)}</PanelList>}</div>; }
function ChallengesPanel({ club, challenges, discoverableClubs, targetClubId, setTargetClubId, challengeNote, setChallengeNote, addChallenge, currentUser, isAdmin }) { return <div className="space-y-8"><h2 className="font-display text-2xl">Club-vs-Club Matches</h2>{isAdmin && <form onSubmit={addChallenge} className="border hairline rounded-xl p-4 bg-[var(--paper-tint)] space-y-3"><select value={targetClubId} onChange={e => setTargetClubId(e.target.value)} className="input-field"><option value="">Choose a club to challenge</option>{discoverableClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea value={challengeNote} onChange={e => setChallengeNote(e.target.value.slice(0, 200))} placeholder="Suggested board size, time, or lineup..." className="input-field" style={{ minHeight: 70 }} /><button type="submit" disabled={!targetClubId} className="btn-primary"><Swords size={14} /> Send Challenge</button></form>}<div className="space-y-3">{challenges.length === 0 ? <PlainEmpty text="No club challenges yet." /> : challenges.map(ch => <ChallengeCard key={ch.id} club={club} challenge={ch} currentUser={currentUser} isAdmin={isAdmin} />)}</div></div>; }
function ChallengeCard({ club, challenge, currentUser, isAdmin }) { const incoming = challenge.toClubId === club.id; return <div className="border hairline rounded-xl p-4 bg-[var(--paper-tint)]"><div className="flex items-center justify-between gap-3"><div><div className="font-display text-lg">{challenge.fromClubName} vs {challenge.toClubName}</div><div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-45 mt-1">{challenge.status}</div></div>{incoming && isAdmin && challenge.status === 'pending' && <div className="flex gap-2"><button onClick={() => respondClubChallenge(challenge.id, currentUser, true).catch(err => toast(err.message, 'error'))} className="btn-primary text-xs py-1.5">Accept</button><button onClick={() => respondClubChallenge(challenge.id, currentUser, false).catch(err => toast(err.message, 'error'))} className="btn-ghost text-xs py-1.5">Decline</button></div>}</div>{challenge.note && <div className="font-display text-sm opacity-70 mt-3">{challenge.note}</div>}</div>; }
function BansPanel({ club, bannedIds, currentUser, isMod }) { return <div className="space-y-6"><h2 className="font-display text-2xl">Banned Players ({bannedIds.length})</h2>{bannedIds.length === 0 ? <PlainEmpty text="No banned players." /> : <PanelList>{bannedIds.map(uid => <Row key={uid} left={<span className="font-mono text-xs opacity-60 break-all">{uid}</span>} right={isMod && <button onClick={() => unbanMember(club.id, uid, currentUser).catch(err => toast(err.message, 'error'))} className="btn-ghost text-xs py-1.5">Unban</button>} />)}</PanelList>}</div>; }

function JoinGate({ requestSent, approvalOnly, busy, onJoin }) { return <div className="h-full flex flex-col items-center justify-center opacity-45 text-center px-8"><Shield size={48} className="mb-4 stroke-[1px]" /><div className="font-display text-xl mb-2">Members-only messages</div><p className="font-display text-sm max-w-md">This club is visible in Discover, but its channels stay private until you join.</p><button onClick={onJoin} disabled={busy || requestSent} className="btn-primary mt-6"><UserPlus size={14} /> {requestSent ? 'Application Sent' : approvalOnly ? 'Apply for Permit' : 'Join Club'}</button></div>; }
function MessageItem({ msg, canDelete, onDelete }) { return <div className="group relative flex items-start gap-4 hover:bg-black/[0.02] px-4 py-2 mx-[-1rem] transition-colors rounded"><span className="text-2xl mt-1 shrink-0">{msg.avatar}</span><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2 mb-0.5"><span className="font-mono text-xs font-bold">{msg.username}</span><span className="font-mono text-[0.55rem] opacity-30 uppercase">{new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{msg.status === 'edited' && <span className="text-[0.6rem] opacity-20 italic">edited</span>}</div><div className="font-display text-base leading-snug break-words whitespace-pre-wrap opacity-90">{msg.text}</div></div>{canDelete && <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--crimson)]" title="Delete"><Trash2 size={14} /></button>}</div>; }
function MemberGroup({ title, members }) { if (members.length === 0) return null; return <div><div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest mb-2">{title} - {members.length}</div><div className="space-y-1">{members.map(m => <Link key={m.userId} to={`/profile/${m.username}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-black/5 group"><span className="text-lg">{m.avatar}</span><span className="font-display text-sm truncate opacity-80 group-hover:opacity-100">{m.username}</span><RoleBadge role={m.role} /></Link>)}</div></div>; }
function RoleBadge({ role }) { if (role === ROLES.OWNER) return <Crown size={12} className="text-[var(--ochre)] ml-auto" />; if (role === ROLES.ADMIN) return <Shield size={12} className="text-[var(--crimson)] ml-auto" />; if (role === ROLES.MODERATOR) return <Shield size={12} className="text-[var(--forest)] ml-auto" />; return null; }
function Announcement({ item }) { return <div className="border hairline rounded-lg p-3 bg-[var(--ochre)]/5"><div className="font-mono text-[0.55rem] uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1"><Megaphone size={10} /> {item.byUsername || 'Announcement'}</div><div className="font-display text-sm leading-snug">{item.text}</div></div>; }
function AccessButton({ active, onClick, icon, title, body }) { return <button type="button" onClick={onClick} className={`border hairline rounded-lg p-4 text-left ${active ? 'bg-black/5 border-[var(--ink)]' : 'opacity-70'}`}>{icon}<div className="font-display mt-2">{title}</div><div className="font-mono text-[0.6rem] uppercase tracking-widest opacity-50 mt-1">{body}</div></button>; }
function PanelList({ children }) { return <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">{children}</div>; }
function Row({ left, right }) { return <div className="flex items-center justify-between gap-3 p-4 bg-[var(--paper-tint)]"><div className="flex items-center gap-3 min-w-0 font-display">{left}</div><div className="flex items-center gap-3 shrink-0">{right}</div></div>; }
function Empty({ text, icon }) { return <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-display">{icon}{text}</div>; }
function PlainEmpty({ text }) { return <div className="text-center py-16 opacity-30 italic font-display border hairline rounded-xl border-dashed">{text}</div>; }
