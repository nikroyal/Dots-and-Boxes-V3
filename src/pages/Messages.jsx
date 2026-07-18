import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  watchMyConversations, watchMessages, sendMessage,
  markConversationRead, openConversation, acceptMessageRequest,
  declineMessageRequest,
} from '../lib/dms';
import { lookupUserByUsername } from '../lib/actions';
import { toast } from '../components/Notifications';
import { sfx } from '../lib/sound';
import { Send, ArrowLeft, MessageSquare, Check, X } from 'lucide-react';

export default function Messages() {
  const { profile } = useAuth();
  const { convId: paramConvId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [newChatInput, setNewChatInput] = useState('');

  useEffect(() => {
    if (!profile) return;
    setConversations(null);
    const unsub = watchMyConversations(profile.id, setConversations);
    return () => unsub();
  }, [profile?.id]);

  if (!profile) return null;

  const startNewChat = async (e) => {
    e?.preventDefault();
    const username = newChatInput.trim();
    if (!username) return;
    try {
      const target = await lookupUserByUsername(username);
      if (!target) { toast('User not found', 'error'); return; }
      if (target.id === profile.id) { toast("You can't message yourself", 'error'); return; }
      const convId = await openConversation(profile, target);
      setNewChatInput('');
      toast(`Request sent to ${target.username}`, 'success');
      sfx.click();
      navigate(`/messages/${convId}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const list = conversations || [];

  return (
    <div className="fade-in">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 border hairline" style={{ minHeight: 500, maxHeight: 700 }}>
        {/* Sidebar - conversation list */}
        <aside className={`border-r hairline flex flex-col ${paramConvId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b hairline">
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Direct Messages</div>
            <form onSubmit={startNewChat} className="flex gap-2 items-center">
              <label htmlFor="messages-new-chat" className="sr-only">Send message request by username</label>
              <input
                id="messages-new-chat"
                value={newChatInput}
                onChange={e => setNewChatInput(e.target.value)}
                placeholder="Invite username"
                autoComplete="off"
                className="input-field text-sm"
              />
              <button type="submit" className="opacity-60 hover:opacity-100 px-2 focus-ring" disabled={!newChatInput.trim()} aria-label="Send message request">
                <Send size={14} aria-hidden="true" />
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {conversations === null ? (
              <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic px-3">
                Loading conversations…
              </div>
            ) : list.length === 0 && (
              <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic px-3">
                No conversations yet
              </div>
            )}
            {list.map(c => {
              const otherId = c.participants.find(p => p !== profile.id);
              const other = c.participantInfo?.[otherId] || { username: '?', avatar: '◆' };
              const unread = c.unreadFor?.[profile.id] || 0;
              const isActive = c.id === paramConvId;
              const preview = conversationPreview(c, profile.id);
              return (
                <Link
                  key={c.id}
                  to={`/messages/${c.id}`}
                  onClick={sfx.click}
                  className="flex items-center gap-3 p-3 border-b hairline transition-colors hover:bg-black/5"
                  style={{ background: isActive ? 'var(--bg-soft)' : 'transparent' }}>
                  <span className="font-display text-2xl shrink-0">{other.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-base truncate">{other.username}</span>
                      {unread > 0 && (
                        <span className="font-mono text-[0.6rem] px-1.5 py-0.5 tabular-nums shrink-0"
                              style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[0.65rem] opacity-60 truncate">
                      {preview}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Active conversation pane */}
        <section className={`flex-col ${paramConvId ? 'flex' : 'hidden md:flex'}`}>
          {paramConvId ? (
            <ConversationView
              convId={paramConvId}
              profile={profile}
              conversations={conversations}
              onBack={() => navigate('/messages')}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center py-20 opacity-50 font-display italic">
              <div className="text-center">
                <MessageSquare size={32} style={{ margin: '0 auto', opacity: 0.4 }} />
                <div className="mt-3 font-mono text-[0.65rem] tracking-widest uppercase">Select a conversation</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationView({ convId, profile, conversations, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const conversationsLoaded = Array.isArray(conversations);
  // The conversation list is already live-watched in the parent — pluck the
  // one we want instead of doing a one-shot getDoc here. Bonus: any update
  // to participantInfo (avatar/username changes) shows up live.
  const conv = conversationsLoaded ? conversations.find(c => c.id === convId) || null : null;

  // Watch messages only after we know this user can actually see the conversation.
  useEffect(() => {
    if (!conversationsLoaded || !conv) {
      setMessages([]);
      return;
    }
    const unsub = watchMessages(convId, setMessages);
    return () => unsub();
  }, [convId, conversationsLoaded, conv?.id]);

  // Mark read when this view is open and the unread count is actually >0.
  // Without this guard the effect would do a Firestore read on every single
  // incoming/outgoing message, even when there's nothing to clear.
  const unreadHere = conv?.unreadFor?.[profile?.id] || 0;
  useEffect(() => {
    if (!profile) return;
    if (!conv) return;
    if (unreadHere === 0) return;
    markConversationRead(convId, profile).catch(() => {});
  }, [convId, unreadHere, profile?.id, conv?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleAccept = async () => {
    setBusy(true);
    try {
      await acceptMessageRequest(convId, profile);
      toast('Request accepted', 'success');
      sfx.click();
    } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineMessageRequest(convId, profile);
      toast('Request declined');
      sfx.click();
    } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    try {
      await sendMessage(convId, profile, input);
      setInput('');
    } catch (err) { toast(err.message, 'error'); }
  };

  if (!conversationsLoaded) {
    return <ConversationFallback onBack={onBack} text="Loading conversation…" />;
  }
  if (!conv) {
    return <ConversationFallback onBack={onBack} text="Conversation not found" />;
  }

  const otherId = conv.participants?.find(p => p !== profile.id);
  const other = conv.participantInfo?.[otherId] || { username: '?', avatar: '◆' };
  const isPending = conv.status === 'pending';
  const isDeclined = conv.status === 'declined';
  const isRequester = conv.requestedBy === profile.id;
  const canMessage = !isPending && !isDeclined;

  return (
    <>
      <div className="px-4 py-3 border-b hairline flex items-center gap-3">
        <button onClick={onBack} className="md:hidden opacity-60 hover:opacity-100" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <Link to={`/profile/${other.username}`} className="flex items-center gap-3 hover:opacity-70 min-w-0">
          <span className="font-display text-2xl shrink-0">{other.avatar}</span>
          <div className="min-w-0">
            <div className="font-display text-base truncate">{other.username}</div>
            {isPending && (
              <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50">
                {isRequester ? 'Request sent' : 'Message request'}
              </div>
            )}
            {isDeclined && (
              <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50">Request declined</div>
            )}
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin" style={{ minHeight: 300 }}>
        {isPending && (
          <div className="mx-auto max-w-sm border hairline p-4 text-center">
            <div className="font-display text-lg mb-2">
              {isRequester ? `Waiting for ${other.username}` : `${other.username} wants to message you`}
            </div>
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-4">
              {isRequester ? 'They need to accept before chat opens' : 'Accept to open this chat'}
            </div>
            {!isRequester && (
              <div className="flex justify-center gap-2">
                <button onClick={handleAccept} disabled={busy} className="btn-primary">
                  <Check size={12} /> Accept
                </button>
                <button onClick={handleDecline} disabled={busy} className="btn-ghost">
                  <X size={12} /> Decline
                </button>
              </div>
            )}
          </div>
        )}
        {isDeclined && (
          <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic">
            This request was declined
          </div>
        )}
        {canMessage && messages.length === 0 && (
          <div className="font-mono text-[0.65rem] opacity-40 text-center py-12 italic">
            No messages yet — say hi
          </div>
        )}
        {messages.map(m => {
          const mine = m.fromId === profile.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div className="px-3 py-2 inline-block"
                     style={{
                       background: mine ? 'var(--ink)' : 'var(--bg-soft)',
                       color: mine ? 'var(--paper)' : 'var(--ink)',
                     }}>
                  <div className="font-display text-base leading-snug break-words">{m.text}</div>
                </div>
                <div className={`font-mono text-[0.55rem] tracking-widest opacity-40 mt-1 ${mine ? 'text-right' : 'text-left'}`}>
                  {m.ts?.toMillis ? timeShort(m.ts.toMillis()) : ''}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSend} className="border-t hairline p-3 flex gap-2 items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value.slice(0, 1000))}
          placeholder={canMessage ? 'Message…' : 'Chat opens after acceptance'}
          aria-label="Direct message"
          maxLength={1000}
          className="flex-1 bg-transparent font-display text-base outline-none px-2"
          disabled={!canMessage}
          autoFocus
        />
        {input.length > 800 && (
          <span className="font-mono text-[0.55rem] opacity-50 tabular-nums">{input.length}/1000</span>
        )}
        <button type="submit" disabled={!canMessage || !input.trim()} className="btn-primary px-3" aria-label="Send message">
          <Send size={14} aria-hidden="true" />
        </button>
      </form>
    </>
  );
}

function ConversationFallback({ onBack, text }) {
  return (
    <>
      <div className="px-4 py-3 border-b hairline flex items-center gap-3">
        <button onClick={onBack} className="md:hidden opacity-60 hover:opacity-100" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50">Messages</div>
      </div>
      <div className="flex-1 flex items-center justify-center py-20 opacity-50 font-display italic">
        {text}
      </div>
    </>
  );
}

function conversationPreview(conv, myId) {
  if (conv.status === 'pending') {
    return conv.requestedBy === myId ? 'Request sent' : 'Message request';
  }
  if (conv.status === 'declined') return 'Request declined';
  return conv.lastMessage?.text || '(no messages)';
}

function timeShort(ts) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
