import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { 
  watchClub, watchMembers, watchChannels, watchMessages, 
  joinClub, leaveClub, deleteClub, sendClubChat, 
  editMessage, deleteMessage, migrateClubIfNeeded, ROLES,
  createChannel, updateChannel, deleteChannel,
  updateMemberRole, kickMember,
  acceptJoinRequest, rejectJoinRequest, updateClubMetadata,
  watchJoinRequests
} from '../lib/clubs';
import { toast } from '../components/Notifications';
import { useConfirm } from '../components/ConfirmDialog';
import { sfx } from '../lib/sound';
import { 
  Send, ArrowLeft, Users, Trash2, LogOut, UserPlus, 
  Hash, Settings, MoreVertical, Reply, Edit3, X, 
  ChevronRight, Shield, Crown, MessageSquare, Pin,
  Plus, Check, UserMinus
} from 'lucide-react';

export default function ClubDetail() {
  const { id, channelId: routeChannelId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  const [club, setClub] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(routeChannelId || null);
  
  const [chatInput, setChatInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editInput, setEditInput] = useState('');
  
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef(null);

  // 1. Watch Club & Migration
  useEffect(() => {
    if (!id) return;
    setClub(undefined);
    return watchClub(id, (c) => {
      setClub(c);
      if (c && (c.chat || c.members)) {
        migrateClubIfNeeded(c).catch(console.error);
      }
    });
  }, [id]);

  // 2. Watch Members & Channels
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

  // 3. Watch Messages
  useEffect(() => {
    if (!id || !activeChannelId) return;
    return watchMessages(id, activeChannelId, setMessages);
  }, [id, activeChannelId]);

  // 4. Watch Join Requests (if admin)
  useEffect(() => {
    if (!id || !profile?.id || !club) {
      setJoinRequests([]);
      return;
    }
    const myMember = members.find(m => m.userId === profile.id);
    if (myMember?.role === ROLES.OWNER || myMember?.role === ROLES.ADMIN) {
      return watchJoinRequests(id, setJoinRequests);
    }
    setJoinRequests([]);
  }, [id, club, members, profile?.id]);

  // 5. Sync activeChannelId with URL
  useEffect(() => {
    if (routeChannelId && routeChannelId !== activeChannelId) {
      setActiveChannelId(routeChannelId);
    }
  }, [routeChannelId, activeChannelId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const messageMap = useMemo(() => new Map(messages.map(m => [m.id, m])), [messages]);

  if (!profile) return null;
  if (club === undefined) return <div className="font-mono text-xs opacity-50 text-center py-20">LOADING...</div>;
  if (!club) return (
    <div className="text-center py-20">
      <div className="font-display italic opacity-50">Club not found</div>
      <button onClick={() => navigate('/clubs')} className="btn-ghost mt-6">Back to Clubs</button>
    </div>
  );

  const myMemberInfo = members.find(m => m.userId === profile.id);
  const isMember = !!myMemberInfo;
  const isPublic = club.isPublic;
  const canViewChat = isPublic || isMember;
  const myRole = myMemberInfo?.role || ROLES.MEMBER;
  const isAdmin = myRole === ROLES.OWNER || myRole === ROLES.ADMIN;

  const handleJoin = async () => {
    setBusy(true);
    try {
      const status = await joinClub(id, profile);
      if (status === 'requested') toast('Join request sent', 'success');
      else toast(`Joined ${club.name}`, 'success');
      sfx.click();
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    if (!activeChannelId) {
      toast('No channel is available yet.', 'error');
      return;
    }
    try {
      await sendClubChat(id, activeChannelId, profile, chatInput, replyTo?.id);
      setChatInput('');
      setReplyTo(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleEditMsg = async (msgId, text) => {
    try {
      await editMessage(id, activeChannelId, msgId, profile, text);
      setEditingMsgId(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleDeleteMsg = async (msgId) => {
    const ok = await confirm({ title: 'Delete message?', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteMessage(id, activeChannelId, msgId, profile);
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
    {confirmDialogEl}
    {showSettings && (
      <SettingsModal 
        club={club} 
        members={members} 
        channels={channels} 
        requests={joinRequests}
        onClose={() => setShowSettings(false)} 
        currentUser={profile}
        myRole={myRole}
      />
    )}
    <div className="fade-in grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-0 h-[calc(100vh-160px)] border hairline overflow-hidden bg-[var(--paper-tint)] relative">
      
      {/* Sidebar: Channels */}
      <aside className={`
        ${showMobileSidebar ? 'fixed inset-y-0 left-0 z-[70] w-64 bg-[var(--paper-tint)] shadow-2xl' : 'hidden'} 
        lg:flex lg:relative lg:z-0 lg:shadow-none border-r hairline flex-col bg-black/[0.02]
      `}>
        <div className="p-4 border-b hairline flex items-center justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-medium truncate" title={club.name}>{club.name}</h2>
            <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest mt-1">
              {club.memberCount || 0} Members
            </div>
          </div>
          <div className="flex items-center">
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} className="p-2 opacity-40 hover:opacity-100 transition-opacity relative" aria-label="Settings">
                <Settings size={18}  aria-hidden="true" />
                {joinRequests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--crimson)] rounded-full" />}
              </button>
            )}
            <button onClick={() => setShowMobileSidebar(false)} className="lg:hidden p-2 opacity-40" aria-label="Close sidebar"><X size={18}/></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="px-2 mb-2 font-mono text-[0.65rem] opacity-40 uppercase tracking-widest flex justify-between items-center">
              <span>Channels</span>
            </div>
            <div className="space-y-0.5">
              {channels.map(chan => (
                <button 
                  key={chan.id}
                  onClick={() => { setActiveChannelId(chan.id); navigate(`/clubs/${id}/${chan.id}`); setShowMobileSidebar(false); }}
                  aria-label={`Go to channel ${chan.name}`}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-sm font-display ${activeChannelId === chan.id ? 'bg-black/10 font-medium' : 'hover:bg-black/5 opacity-70'}`}
                >
                  <Hash size={14} className="opacity-40"  aria-hidden="true" />
                  {chan.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t hairline space-y-2">
          {!isMember ? (
            <button onClick={handleJoin} disabled={busy} className="btn-primary w-full text-[0.65rem] py-2">
              <UserPlus size={12}  aria-hidden="true" /> Join Club
            </button>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="text-lg">{profile.avatar || '◆'}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono truncate">{profile.username}</div>
                <div className="text-[0.55rem] font-mono opacity-50 uppercase tracking-tighter">{myRole}</div>
              </div>
              <button onClick={() => navigate('/clubs')} title="Leave view" className="opacity-40 hover:opacity-100" aria-label="Leave view"><LogOut size={14} aria-hidden="true" /></button>
            </div>
          )}
        </div>
      </aside>

      {/* Main: Chat Area */}
      <main className="flex flex-col min-w-0 bg-[var(--paper)]">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b hairline shrink-0">
          <div className="flex items-center gap-2 font-display text-lg font-medium">
            <button onClick={() => setShowMobileSidebar(true)} className="lg:hidden p-2 -ml-2 opacity-50" aria-label="Open sidebar"><MoreVertical size={18} aria-hidden="true" /></button>
            <Hash size={18} className="opacity-40"  aria-hidden="true" />
            <span className="truncate">{channels.find(c => c.id === activeChannelId)?.name || 'general'}</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="opacity-40 hover:opacity-100" title="Pinned Messages" aria-label="Pinned Messages"><Pin size={16} aria-hidden="true" /></button>
            <button onClick={() => setShowMobileMembers(true)} className="opacity-40 hover:opacity-100 lg:hidden" title="Members List" aria-label="Members List"><Users size={16}  aria-hidden="true" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {!canViewChat ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-8">
              <Shield size={48} className="mb-4 stroke-[1px]"  aria-hidden="true" />
              <div className="font-display text-lg mb-1">This Club is Private</div>
              <p className="font-display text-sm">You must be a member to view the conversation.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-display">
              <MessageSquare size={48} className="mb-4 stroke-[1px]"  aria-hidden="true" />
              No messages here yet.
            </div>
          ) : (
            messages.map((msg, idx) => {
              const prevMsg = messages[idx-1];
              const isContinuation = prevMsg && prevMsg.userId === msg.userId && (msg.ts - prevMsg.ts < 300000);
              const replyMsg = msg.replyTo ? messageMap.get(msg.replyTo) : null;

              return (
                <MessageItem 
                  key={msg.id}
                  msg={msg}
                  isContinuation={isContinuation}
                  replyMsg={replyMsg}
                  isOwn={msg.userId === profile.id}
                  isAdmin={isAdmin}
                  onReply={() => setReplyTo(msg)}
                  onForward={() => { setChatInput(`Forwarded: ${msg.text}`); setReplyTo(null); }}
                  onEdit={() => { setEditingMsgId(msg.id); setEditInput(msg.text); }}
                  onDelete={() => handleDeleteMsg(msg.id)}
                  editing={editingMsgId === msg.id}
                  editInput={editInput}
                  setEditInput={setEditInput}
                  onSaveEdit={(text) => handleEditMsg(msg.id, text)}
                  onCancelEdit={() => setEditingMsgId(null)}
                />
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 pt-0 shrink-0">
          {isMember ? (
            <div className="relative border hairline rounded-lg bg-black/[0.02] focus-within:border-[var(--ink)] transition-colors">
              {replyTo && (
                <div className="px-3 py-1.5 border-b hairline flex items-center justify-between text-xs opacity-70 bg-black/5 rounded-t-lg">
                  <div className="flex items-center gap-2 truncate">
                    <Reply size={12}  aria-hidden="true" /> Replying to <strong>{replyTo.username}</strong>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="hover:opacity-100" aria-label="Cancel reply"><X size={12}/></button>
                </div>
              )}
              <form onSubmit={handleSendChat} className="flex items-end p-2 gap-2">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value.slice(0, 2000))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder={`Message #${channels.find(c => c.id === activeChannelId)?.name || 'general'}`}
                  className="flex-1 bg-transparent resize-none py-1 px-2 outline-none font-display text-base min-h-[40px] max-h-[200px]"
                  rows={1}
                  disabled={!activeChannelId}
                />
                <button type="submit" disabled={!activeChannelId || !chatInput.trim()} className="p-2 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity" aria-label="Send message">
                  <Send size={18}  aria-hidden="true" />
                </button>
              </form>
            </div>
          ) : !canViewChat ? (
            <div className="text-center p-4 border hairline rounded-lg font-mono text-xs opacity-40 uppercase tracking-widest">
              Join this club to view and participate
            </div>
          ) : (
            <div className="text-center p-4 border hairline rounded-lg font-mono text-xs opacity-40 uppercase tracking-widest">
              Join this club to participate in the conversation
            </div>
          )}
        </div>
      </main>

      {/* Sidebar: Members */}
      <aside className={`
        ${showMobileMembers ? 'fixed inset-y-0 right-0 z-[70] w-64 bg-[var(--paper-tint)] shadow-2xl overflow-y-auto' : 'hidden'} 
        lg:flex lg:relative lg:z-0 lg:shadow-none border-l hairline flex-col bg-black/[0.01]
      `}>
        <div className="h-14 px-4 flex items-center justify-between border-b hairline font-mono text-[0.65rem] uppercase tracking-widest opacity-50 shrink-0">
          <span>Members - {members.length}</span>
          <button onClick={() => setShowMobileMembers(false)} className="lg:hidden p-2 opacity-40" aria-label="Close members list"><X size={18}/></button>
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

function SettingsModal({ club, members, channels, requests, onClose, currentUser, myRole }) {
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  
  // General State
  const [name, setName] = useState(club.name);
  const [desc, setDesc] = useState(club.description || '');
  const [isPublic, setIsPublic] = useState(club.isPublic);

  // Channel State
  const [newChanName, setNewChanName] = useState('');

  const { confirm, dialog: confirmDialogEl2 } = useConfirm();

  const handleUpdateGeneral = async () => {
    setBusy(true);
    try {
      await updateClubMetadata(club.id, currentUser, { name, description: desc, isPublic });
      toast('Club updated', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };

  const handleCreateChan = async (e) => {
    e?.preventDefault();
    if (!newChanName.trim()) return;
    setBusy(true);
    try {
      await createChannel(club.id, currentUser, { name: newChanName, order: channels.length });
      setNewChanName('');
      toast('Channel created', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };

  const handleDeleteChan = async (cid) => {
    const ok = await confirm({ title: 'Delete channel?', body: 'All messages will be lost.', danger: true });
    if (!ok) return;
    try { await deleteChannel(club.id, cid, currentUser); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in" role="dialog" aria-modal="true" aria-labelledby="club-settings-title">
      {confirmDialogEl2}
      <div className="bg-[var(--paper-tint)] border hairline w-full max-w-4xl h-[80vh] shadow-2xl rounded-2xl flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r hairline bg-black/[0.02] p-4 space-y-1">
          <div id="club-settings-title" className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest px-3 mb-2">Club Settings</div>
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'channels', label: 'Channels', icon: Hash },
            { id: 'members', label: 'Members', icon: Users, count: members.length },
            { id: 'requests', label: 'Join Requests', icon: UserPlus, count: requests.length },
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm transition-colors ${tab === t.id ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-black/5 opacity-70'}`}
            >
              <t.icon size={16} />
              <span className="flex-1 text-left">{t.label}</span>
              {t.count > 0 && <span className={`text-[0.6rem] px-1.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-[var(--crimson)] text-white'}`}>{t.count}</span>}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t hairline">
            <button onClick={onClose} className="w-full flex items-center gap-3 px-3 py-2 rounded font-display text-sm text-[var(--crimson)] hover:bg-[var(--crimson)]/5" aria-label="Close Settings">
              <LogOut size={16}  aria-hidden="true" /> Close Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto bg-[var(--paper)]">
          {tab === 'general' && (
            <div className="max-w-md space-y-6">
              <h2 className="font-display text-2xl mb-6">General Settings</h2>
              <div>
                <label htmlFor={"club-name-" + club.id} className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Club Name</label>
                <input id={"club-name-" + club.id} className="input-field" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor={"club-desc-" + club.id} className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Description</label>
                <textarea id={"club-desc-" + club.id} className="input-field" value={desc} onChange={e => setDesc(e.target.value)} style={{ minHeight: 80 }} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id={`isPublic-${club.id}`} checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="accent-[var(--ink)]" />
                <label htmlFor={`isPublic-${club.id}`} className="font-display text-sm cursor-pointer">Public Club (Visible to everyone)</label>
              </div>
              <button onClick={handleUpdateGeneral} disabled={busy} className="btn-primary w-full">Save Changes</button>
            </div>
          )}

          {tab === 'channels' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Channels</h2>
                <form onSubmit={handleCreateChan} className="flex gap-2">
                  <input 
                    placeholder="New channel name..." 
                    value={newChanName} 
                    onChange={e => setNewChanName(e.target.value)}
                    className="bg-black/5 border hairline rounded px-3 py-1.5 text-sm outline-none focus:border-[var(--ink)]"
                    aria-label="New channel name"
                  />
                  <button type="submit" disabled={busy || !newChanName.trim()} className="btn-primary text-xs py-1.5 px-3" aria-label="Create channel"><Plus size={14} aria-hidden="true" /></button>
                </form>
              </div>
              <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                {channels.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                    <div className="flex items-center gap-3">
                      <Hash size={16} className="opacity-40"  aria-hidden="true" />
                      <span className="font-display font-medium">#{c.name}</span>
                    </div>
                    {c.name !== 'general' && (
                      <button onClick={() => handleDeleteChan(c.id)} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded transition-colors" aria-label={`Delete channel ${c.name}`}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Members ({members.length})</h2>
              <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                {[...members].sort((a,b) => a.username.localeCompare(b.username)).map(m => (
                  <div key={m.userId} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{m.avatar}</span>
                      <div>
                        <div className="font-display font-medium">{m.username}</div>
                        <div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest">{m.role}</div>
                      </div>
                    </div>
                    {myRole === ROLES.OWNER && m.userId !== currentUser.id && (
                      <div className="flex gap-2">
                        <select 
                          value={m.role} 
                          onChange={(e) => updateMemberRole(club.id, m.userId, currentUser, e.target.value)}
                          className="bg-black/5 border hairline rounded px-2 py-1 text-xs font-mono outline-none"
                        >
                          <option value={ROLES.ADMIN}>Admin</option>
                          <option value={ROLES.MODERATOR}>Moderator</option>
                          <option value={ROLES.MEMBER}>Member</option>
                        </select>
                        <button onClick={() => kickMember(club.id, m.userId, currentUser)} className="p-2 text-[var(--crimson)] hover:bg-[var(--crimson)]/5 rounded transition-colors" title="Kick" aria-label={`Kick ${m.username}`}>
                          <UserMinus size={16}  aria-hidden="true" />
                        </button>
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
              {requests.length === 0 ? (
                <div className="text-center py-20 opacity-30 italic font-display">No pending requests.</div>
              ) : (
                <div className="border hairline rounded-xl overflow-hidden divide-y divide-hairline">
                  {requests.map(r => (
                    <div key={r.userId} className="flex items-center justify-between p-4 bg-[var(--paper-tint)]">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{r.avatar}</span>
                        <div>
                          <div className="font-display font-medium">{r.username}</div>
                          <div className="font-mono text-[0.6rem] opacity-40 tracking-widest">{new Date(r.ts?.toMillis?.() || Date.now()).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptJoinRequest(club.id, r, currentUser)} className="p-2 bg-[var(--forest)]/10 text-[var(--forest)] hover:bg-[var(--forest)]/20 rounded transition-colors" aria-label={`Accept join request from ${r.username}`}>
                          <Check size={18}  aria-hidden="true" />
                        </button>
                        <button onClick={() => rejectJoinRequest(club.id, r.userId, currentUser)} className="p-2 bg-[var(--crimson)]/10 text-[var(--crimson)] hover:bg-[var(--crimson)]/20 rounded transition-colors" aria-label={`Reject join request from ${r.username}`}>
                          <X size={18} />
                        </button>
                      </div>
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

function MessageItem({ 
  msg, isContinuation, replyMsg, isOwn, isAdmin, 
  onReply, onEdit, onDelete, onForward,
  editing, editInput, setEditInput, onSaveEdit, onCancelEdit
}) {
  const formatText = (text) => {
    if (!text) return '';
    return text.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-[var(--ochre)] font-bold bg-[var(--ochre)]/10 px-0.5 rounded">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className={`group relative flex flex-col ${isContinuation ? 'mt-[-1.25rem]' : ''}`}>
      {replyMsg && (
        <div className="flex items-center gap-2 ml-4 mb-1 text-[0.7rem] opacity-50 font-display">
          <div className="w-4 h-2 border-l border-t rounded-tl hairline" />
          <span>{replyMsg.avatar}</span>
          <span className="font-medium">{replyMsg.username}</span>
          <span className="truncate italic">{replyMsg.text}</span>
        </div>
      )}
      
      <div className="flex items-start gap-4 hover:bg-black/[0.02] px-4 py-1 mx-[-1rem] transition-colors rounded">
        {!isContinuation ? (
          <span className="text-2xl mt-1 select-none shrink-0">{msg.avatar}</span>
        ) : (
          <div className="w-8 shrink-0 flex justify-center opacity-0 group-hover:opacity-40 font-mono text-[0.55rem] mt-2 select-none">
            {new Date(msg.ts).getHours()}:{new Date(msg.ts).getMinutes().toString().padStart(2, '0')}
          </div>
        )}
        
        <div className="min-w-0 flex-1">
          {!isContinuation && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-mono text-xs font-bold">{msg.username}</span>
              <span className="font-mono text-[0.55rem] opacity-30 uppercase">
                {new Date(msg.ts).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.status === 'edited' && <span className="text-[0.6rem] opacity-20 italic">(edited)</span>}
            </div>
          )}
          
          {editing ? (
            <div className="mt-1">
              <textarea 
                value={editInput}
                onChange={e => setEditInput(e.target.value)}
                className="w-full bg-black/5 border hairline rounded p-2 outline-none font-display text-base"
                autoFocus
              />
              <div className="flex gap-2 mt-1 text-[0.65rem] font-mono">
                <span>escape to <button onClick={onCancelEdit} className="text-[var(--crimson)] hover:underline">cancel</button></span>
                <span>•</span>
                <span>enter to <button onClick={() => onSaveEdit(editInput)} className="text-[var(--forest)] hover:underline">save</button></span>
              </div>
            </div>
          ) : (
            <div className="font-display text-base leading-snug break-words whitespace-pre-wrap opacity-90">
              {formatText(msg.text)}
            </div>
          )}
        </div>

        {/* Message Actions */}
        {!editing && (
          <div className="absolute top-[-10px] right-4 opacity-0 group-hover:opacity-100 transition-opacity flex bg-[var(--paper-tint)] border hairline rounded shadow-sm overflow-hidden z-10">
            <button onClick={onReply} className="p-1.5 hover:bg-black/5" title="Reply" aria-label="Reply"><Reply size={14} aria-hidden="true" /></button>
            <button onClick={onForward} className="p-1.5 hover:bg-black/5" title="Forward" aria-label="Forward"><ChevronRight size={14} aria-hidden="true" /></button>
            {isOwn && <button onClick={onEdit} className="p-1.5 hover:bg-black/5" title="Edit" aria-label="Edit"><Edit3 size={14}/></button>}
            {(isOwn || isAdmin) && <button onClick={onDelete} className="p-1.5 hover:bg-black/5 text-[var(--crimson)]" title="Delete" aria-label="Delete"><Trash2 size={14}/></button>}
            <button className="p-1.5 hover:bg-black/5" title="More" aria-label="More actions"><MoreVertical size={14} aria-hidden="true" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberGroup({ title, members }) {
  if (members.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[0.6rem] opacity-40 uppercase tracking-widest mb-2 flex items-center gap-2">
        {title} - {members.length}
      </div>
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
  if (role === ROLES.ADMIN) return <Shield size={12} className="text-[var(--crimson)] ml-auto"  aria-hidden="true" />;
  if (role === ROLES.MODERATOR) return <Shield size={12} className="text-[var(--forest)] ml-auto"  aria-hidden="true" />;
  return null;
}
