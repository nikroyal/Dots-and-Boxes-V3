import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { listPublicClubs, listMyClubs, createClub, JOIN_MODES } from '../lib/clubs';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { toast } from '../components/Notifications';
import { sfx } from '../lib/sound';
import { Users, Plus, Compass, Layout, Search, ChevronRight, Lock, Globe2 } from 'lucide-react';

export default function Clubs() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('mine');
  const [myClubs, setMyClubs] = useState(null);
  const [publicClubs, setPublicClubs] = useState(null);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState(JOIN_MODES.OPEN);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile?.id]);

  async function refresh() {
    try {
      const [mine, pub] = await Promise.all([
        listMyClubs(profile.id),
        listPublicClubs()
      ]);
      setMyClubs(mine);
      setPublicClubs(pub);
    } catch (err) {
      console.warn('refreshClubs:', err);
      setMyClubs([]);
      setPublicClubs([]);
    }
  }

  if (!profile) return null;

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createClub(profile, { name, description, joinMode, isPublic: true });
      recordActivity(profile, ACTIVITY_TYPES.CLUB_CREATED, { clubId: id, clubName: name.trim() });
      toast(`Club "${name.trim()}" created`, 'success');
      sfx.click();
      setShowCreate(false);
      setName('');
      setDescription('');
      setJoinMode(JOIN_MODES.OPEN);
      navigate(`/clubs/${id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
    setCreating(false);
  };

  const currentList = tab === 'mine' ? myClubs : publicClubs;
  const filtered = currentList?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fade-in space-y-8 pb-20">
      <section className="relative overflow-hidden border hairline p-8 bg-black/[0.02] rounded-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-3 flex items-center gap-2">
            <Users size={12} /> Community Hub
          </div>
          <h1 className="font-display text-5xl font-medium tracking-tight mb-4">Clubs</h1>
          <p className="font-display text-lg opacity-70 leading-relaxed mb-6">
            Create a community, apply to selective clubs, organize matches, and climb together.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={14} /> Create Club
            </button>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clubs..."
                className="w-full bg-[var(--paper-tint)] border hairline rounded-lg py-2.5 pl-10 pr-4 font-display text-base outline-none focus:border-[var(--ink)] transition-colors"
              />
            </div>
          </div>
        </div>
        <Users size={200} className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none" />
      </section>

      <div className="flex gap-8 border-b hairline px-2">
        {[
          { id: 'mine', label: 'My Clubs', icon: Layout, count: myClubs?.length },
          { id: 'public', label: 'Discover', icon: Compass, count: publicClubs?.length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); sfx.click(); }}
            className={`flex items-center gap-2 py-4 font-mono text-[0.7rem] tracking-widest uppercase transition-all relative ${tab === t.id ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
          >
            <t.icon size={14} />
            {t.label} {t.count !== undefined && `(${t.count})`}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ink)] fade-in" />}
          </button>
        ))}
      </div>

      {!filtered ? (
        <div className="font-mono text-xs opacity-50 text-center py-20">LOADING...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border hairline rounded-xl border-dashed bg-black/[0.01]">
          <div className="font-display text-xl opacity-30 mb-2">No clubs found</div>
          <p className="font-display text-sm opacity-20">Try a different search or create your own.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(c => <ClubCard key={c.id} club={c} isMember={c.memberIds?.includes(profile.id)} />)}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in">
          <div className="bg-[var(--paper-tint)] border hairline w-full max-w-lg shadow-2xl p-8 rounded-2xl relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 p-2 opacity-40 hover:opacity-100 transition-opacity" aria-label="Close create club dialog">
              x
            </button>
            <h2 className="font-display text-3xl mb-2">Start a new Club</h2>
            <p className="font-display text-sm opacity-60 mb-8">Choose how players get into your community.</p>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Club Name</label>
                <input
                  className="input-field"
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 40))}
                  placeholder="e.g. The Strategic Society"
                  autoFocus
                />
                <div className="font-mono text-[0.6rem] opacity-40 mt-1 text-right">{name.length}/40</div>
              </div>
              <div>
                <label className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Description</label>
                <textarea
                  className="input-field font-display text-base"
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 200))}
                  placeholder="What is this club about?"
                  style={{ minHeight: 80, resize: 'vertical' }}
                />
                <div className="font-mono text-[0.6rem] opacity-40 mt-1 text-right">{description.length}/200</div>
              </div>
              <div>
                <div className="font-mono block mb-3 text-[0.65rem] tracking-widest uppercase opacity-55">Join Access</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setJoinMode(JOIN_MODES.OPEN)} className={`border hairline p-4 text-left rounded-lg ${joinMode === JOIN_MODES.OPEN ? 'bg-black/5 border-[var(--ink)]' : 'opacity-70'}`}>
                    <Globe2 size={16} className="mb-2" />
                    <div className="font-display text-base">Open</div>
                    <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest mt-1">Anyone can join</div>
                  </button>
                  <button type="button" onClick={() => setJoinMode(JOIN_MODES.APPROVAL)} className={`border hairline p-4 text-left rounded-lg ${joinMode === JOIN_MODES.APPROVAL ? 'bg-black/5 border-[var(--ink)]' : 'opacity-70'}`}>
                    <Lock size={16} className="mb-2" />
                    <div className="font-display text-base">Approval</div>
                    <div className="font-mono text-[0.6rem] opacity-50 uppercase tracking-widest mt-1">Visible, apply to join</div>
                  </button>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={creating || name.length < 3} className="btn-primary flex-1">
                  {creating ? 'Creating...' : 'Create Club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClubCard({ club, isMember }) {
  const approval = club.joinMode === JOIN_MODES.APPROVAL;
  return (
    <Link to={`/clubs/${club.id}`} className="group relative border hairline bg-[var(--paper-tint)] p-6 hover:border-[var(--ink)] transition-all rounded-xl hover:shadow-lg">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-medium group-hover:underline underline-offset-4 decoration-1">{club.name}</h3>
          <div className="flex items-center gap-3 mt-1 font-mono text-[0.6rem] tracking-widest uppercase opacity-40">
            <span className="flex items-center gap-1"><Users size={10} /> {club.memberCount || 1}</span>
            <span>|</span>
            <span className="flex items-center gap-1">{approval ? <Lock size={10} /> : <Globe2 size={10} />} {approval ? 'Apply to Join' : 'Open'}</span>
          </div>
        </div>
        <div className="w-10 h-10 flex items-center justify-center bg-black/[0.03] rounded-full group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)] transition-colors shrink-0">
          <ChevronRight size={20} />
        </div>
      </div>

      <p className="font-display text-sm opacity-60 line-clamp-2 leading-relaxed h-10 mb-4">
        {club.description || 'No description provided.'}
      </p>

      {isMember && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--forest)]/10 text-[var(--forest)] font-mono text-[0.55rem] uppercase tracking-widest font-bold">
          Member
        </div>
      )}
    </Link>
  );
}
