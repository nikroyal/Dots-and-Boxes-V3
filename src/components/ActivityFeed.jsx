import { useEffect, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { getActivityForUsers, ACTIVITY_TYPES } from '../lib/activity';
import { ACHIEVEMENTS } from '../lib/achievements';
import { Trophy, X as Loss, Minus as Equal, UserPlus, Users, Zap } from 'lucide-react';

// Recent activity from the user and their friends. Lives on the Dashboard.
export default function ActivityFeed({ profile, singleUser = false, viewerId = null }) {
  const [items, setItems] = useState(null); // null=loading, []=empty
  // Dep on the joined sorted ID list, not just .length — otherwise swapping
  // one friend for another (same count) wouldn't trigger a refresh.
  const idKey = profile
    ? (singleUser ? [profile.id] : [profile.id, ...(Array.isArray(profile.friends) ? profile.friends : [])]).sort().join(',')
    : '';
  useEffect(() => {
    let alive = true;
    if (!idKey) return;
    const ids = idKey.split(',').filter(Boolean);
    getActivityForUsers(ids, 20).then(list => {
      if (alive) setItems(list);
    }).catch(err => {
      console.warn('activity fetch failed:', err);
      if (alive) setItems([]);
    });
    return () => { alive = false; };
  }, [idKey]);

  if (items === null) return (
    <div className="font-mono text-xs opacity-50 text-center py-6">LOADING…</div>
  );
  if (items.length === 0) return (
    <div className="font-display italic opacity-50 text-center py-6">
      Nothing yet — play a match or add a friend.
    </div>
  );

  return (
    <div className="space-y-1.5">
      {items.map(it => <ActivityRow key={it.id} item={it} isMe={viewerId ? it.userId === viewerId : it.userId === profile.id && !singleUser} />)}
    </div>
  );
}

// Optimization (Bolt): React.memo prevents all rows from re-rendering when
// the ActivityFeed parent updates (e.g., when the profile object changes),
// saving compute for rows whose activity item hasn't changed.
// Impact: Reduces row re-renders to near zero for existing feed items.
const ActivityRow = memo(function ActivityRow({ item, isMe }) {
  const when = item.ts?.toMillis ? timeAgo(item.ts.toMillis()) : '';
  const subject = isMe ? 'You' : item.username || '?';

  let icon, text, color;
  switch (item.type) {
    case ACTIVITY_TYPES.WIN: {
      icon = <Trophy size={14} />;
      color = 'var(--forest)';
      text = <>{subject} beat <strong>{item.data?.opponent || '?'}</strong> {item.data?.myScore}–{item.data?.oppScore} ({fmtElo(item.data?.eloDelta)} ELO)</>;
      break;
    }
    case ACTIVITY_TYPES.LOSS: {
      icon = <Loss size={14} />;
      color = 'var(--crimson)';
      text = <>{subject} lost to <strong>{item.data?.opponent || '?'}</strong> {item.data?.myScore}–{item.data?.oppScore} ({fmtElo(item.data?.eloDelta)} ELO)</>;
      break;
    }
    case ACTIVITY_TYPES.DRAW: {
      icon = <Equal size={14} />;
      color = 'var(--ochre)';
      text = <>{subject} drew with <strong>{item.data?.opponent || '?'}</strong> {item.data?.myScore}–{item.data?.oppScore}</>;
      break;
    }
    case ACTIVITY_TYPES.ACHIEVEMENT: {
      const a = ACHIEVEMENTS.find(x => x.id === item.data?.achievementId);
      icon = <Trophy size={14} />;
      color = 'var(--ochre)';
      text = <>{subject} unlocked <strong>{a?.name || 'an achievement'}</strong></>;
      break;
    }
    case ACTIVITY_TYPES.FRIEND_ADDED: {
      icon = <UserPlus size={14} />;
      color = 'var(--ink)';
      text = <>{subject} became friends with <strong>{item.data?.friendUsername || '?'}</strong></>;
      break;
    }
    case ACTIVITY_TYPES.CLUB_JOINED: {
      icon = <Users size={14} />;
      color = 'var(--ink)';
      text = <>{subject} joined club <strong>{item.data?.clubName || '?'}</strong></>;
      break;
    }
    case ACTIVITY_TYPES.CLUB_CREATED: {
      icon = <Users size={14} />;
      color = 'var(--ink)';
      text = <>{subject} founded club <strong>{item.data?.clubName || '?'}</strong></>;
      break;
    }
    case ACTIVITY_TYPES.ARCADE_BEST: {
      icon = <Zap size={14} />;
      color = 'var(--crimson)';
      text = <>{subject} set a new personal best in <strong>{item.data?.game || 'an arcade game'}</strong> ({item.data?.score})</>;
      break;
    }
    default:
      return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border hairline">
      <div className="flex items-center gap-3 min-w-0">
        <span style={{ color }}>{icon}</span>
        {!isMe && item.username ? (
          <Link to={`/profile/${item.username}`} className="font-display text-xl shrink-0 hover:opacity-70">
            {item.avatar || '◆'}
          </Link>
        ) : (
          <span className="font-display text-xl shrink-0">{item.avatar || '◆'}</span>
        )}
        <div className="font-display text-sm leading-snug truncate">{text}</div>
      </div>
      <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 shrink-0">{when}</div>
    </div>
  );
});

function fmtElo(d) {
  if (d == null) return '';
  return `${d >= 0 ? '+' : ''}${d}`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}
