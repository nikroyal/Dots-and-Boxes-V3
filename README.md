# Dots & Boxes — online multiplayer

A real-time online Dots & Boxes game. React + Vite + Firebase (Auth + Firestore), deployed to Netlify.

## Features

- **Real-time multiplayer matches** with live board sync
- **ELO rating system** with leaderboard, clamped to [100, 3500] so a bad streak can't push you to nonsense
- **Pre-game 3-2-1 countdown** synchronized between players (server-timestamp-based, immune to clock skew)
- **Per-turn 60-second timer** with claim-victory-on-timeout; timer resets after each box claim so long chains don't self-forfeit
- **Disconnect detection** via heartbeat
- **Pause / resume** matches with consent
- **Spectator mode** with chat (spectator messages are visually distinguished in the chat panel)
- **Replay** any past match move-by-move (memory-efficient — derives state lazily, doesn't precompute every frame)
- **23 achievements** to unlock
- **Friends, friend requests, blocking** — blocking ends any active matches between you (the blocker forfeits — they're the one ending things)
- **Direct messages** between any two players
- **Clubs** — create / join / chat in groups
- **Activity feed** showing your and friends' wins, losses, achievements
- **Quick Match** — auto-finds an opponent within ±200 ELO; won't re-pester people you recently invited
- **Rematch button** on the win screen; the recipient sees a clear "wants a rematch" badge
- **Confetti** on victory (scales down on low-end devices; respects reduced-motion preference)
- **Themes** — Light / Dark / Sepia, persisted; auto-tracks OS-level reduced-motion changes
- **Reduced motion** toggle
- **Password reset** via email
- **Account deletion** (delete your username, profile, and login)
- **Keyboard play** — tab into the board, use arrow keys to navigate, Enter/Space to draw
- **Color-blind friendly** — players are distinguished by line dash pattern as well as color
- **Themed confirm dialogs** with full keyboard focus trap (no jarring browser confirms)

---

## Setup from scratch

### 1. Push this folder to GitHub

Create a new repo on GitHub. Either:
- Click "Add file → Upload files" — IMPORTANT: drag the **folder itself**, not its contents. GitHub's web upload preserves folder structure only when you drop folders.
- Or clone the empty repo locally, copy these files in, `git add . && git commit -m "Initial" && git push`

Note: GitHub's repo page lists `.gitignore` (a dotfile) separately from the file count at the top of the directory listing, so it may show one fewer file than you'd expect from a `find` or `ls -a`. The zip itself contains 43 files plus a handful of folder entries.

### 2. Set up Firebase

1. Go to https://console.firebase.google.com → **Add project**
2. Once created: in the project overview, click the `</>` icon to **add a Web app**. Name it whatever, skip Hosting setup.
3. Create a `.env` file in the root directory by copying `.env.example`.
4. Copy the `firebaseConfig` values Firebase shows you, then paste them into your `.env` file, replacing the `YOUR_API_KEY` etc. placeholders. **If you forget this step the app will refuse to load and display a red error screen — that's intentional, so you don't accidentally use someone else's backend.**
5. In the Firebase console sidebar:
   - **Authentication → Get started → Sign-in method → Email/Password → Enable** (Email/Password only, not the link option)
   - **Authentication → Templates → Password reset** — customize the email if you'd like; the default works fine.
   - **Firestore Database → Create database → Start in production mode → pick a region close to your users**
6. Once Firestore is created, go to its **Rules** tab. Delete what's there and paste the contents of `firestore.rules` from this folder. Click **Publish**.

### 3. Deploy to Netlify

1. Go to https://app.netlify.com → **Add new site → Import an existing project**
2. Connect your GitHub, pick the repo you just pushed
3. Build settings should auto-fill (Vite). If not: build command `npm run build`, publish directory `dist`. The included `netlify.toml` handles this automatically, including no-cache headers on `index.html` so users get the latest JS bundle after each deploy.
4. Click **Deploy**. First build takes ~2 minutes.

### 4. First login

Sign up with a username (3-20 chars, lowercase letters/numbers/underscore), an email (used only for password reset; never displayed publicly), and a password (6+ chars).

If you forget your password, click "Forgot password?" on the sign-in screen. The reset email is sent by Firebase to the address you registered with.

---

## Working without local dev

You don't need Node installed locally. Edit files directly on GitHub.com (pencil icon → commit) and Netlify auto-deploys on each commit.

If you do want local dev:
```
npm install
npm run dev
```

---

## File structure

```
.
├── CHANGELOG.md                 # Full audit history (4 rounds, ~80 fixes)
├── firestore.rules              # Paste into Firebase Console rules tab
├── index.html                   # App shell + font loading
├── package.json                 # Dependencies
├── vite.config.js               # Vite build config
├── postcss.config.js            # PostCSS for Tailwind
├── tailwind.config.js           # Tailwind tokens
├── netlify.toml                 # Netlify build + SPA fallback
└── src/
    ├── main.jsx                 # Entry point — applies theme before render
    ├── App.jsx                  # Routes
    ├── index.css                # Theme variables, animations, Tailwind layers
    ├── lib/
    │   ├── firebase.js          # Firebase config — REPLACE WITH YOUR OWN
    │   ├── AuthContext.jsx      # Auth + signup/login (with atomic rollback on partial signup)
    │   ├── gameLogic.js         # Pure board logic, no React/Firebase
    │   ├── actions.js           # All Firestore mutations + transactions
    │   ├── achievements.js      # Achievement catalog (23 entries)
    │   ├── theme.js             # Light/Dark/Sepia + reduced-motion
    │   ├── dms.js               # Direct messages
    │   ├── clubs.js             # Clubs
    │   ├── activity.js          # Activity feed
    │   ├── presence.js          # Heartbeat / disconnect detection
    │   └── sound.js             # Sound effects (resumes AudioContext on first gesture)
    ├── components/
    │   ├── Header.jsx
    │   ├── Notifications.jsx    # Invite cards + toast
    │   ├── ConfirmDialog.jsx    # Themed confirm dialog with focus trap
    │   ├── Confetti.jsx
    │   ├── EloChart.jsx
    │   └── ActivityFeed.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Lobby.jsx
        ├── Match.jsx            # Live match — countdown, board, timer, chat
        ├── Replay.jsx
        ├── Profile.jsx
        ├── Friends.jsx
        ├── Leaderboard.jsx
        ├── Achievements.jsx
        ├── History.jsx
        ├── Messages.jsx         # DMs (list + thread)
        ├── Clubs.jsx            # Browse / create
        └── ClubDetail.jsx       # Single club + chat
```

---

## Firestore composite indexes

Firestore needs composite indexes for queries that combine multiple filters. The first time someone triggers an unindexed query, the browser console shows a one-click "create this index" URL. Click it, wait ~1 minute, the query starts working for everyone.

Likely indexes you'll be prompted to create:
- `conversations`: `participants` (array-contains) + `lastMessageAt` (desc)
- `activities`: `userId` (in) + `ts` (desc)
- `matches`: `status` (in) + `createdAt` (desc) — for /lobby
- `matches`: `players` (array-contains) + `status` (in) — used by the block-user flow when it resigns any active matches between the two of you
- `clubs`: `isPublic` (==) + `createdAt` (desc) — only if browse-clubs throws
- `clubs`: `members` (array-contains) — single-field, usually auto-indexed

The block-user flow swallows index errors silently (a missing index is reported as "block succeeded, cleanup skipped"), so you may not notice the prompt unless you check the browser console after blocking someone you have an active match with.

---

## Known limitations / honest caveats

- **Per-turn timer is cheatable.** A determined attacker could disable JavaScript on their turn and never auto-forfeit. The opponent's "Claim Victory" button (which appears 5 seconds after the timer expires) is the safety net. Cheat-proofing would require Firebase Cloud Functions, which is on the paid Blaze plan.
- **Disconnect detection is approximate.** Heartbeats fire every 20s; if you don't see one for 60s, the opponent shows as "idle." Reconnection within 60s is invisible.
- **Clubs have no moderation.** Owner can delete; members can leave; non-members can join. No kick, no transfer-ownership, no role hierarchy. Capped at 100 chat messages stored on the doc (older roll off).
- **Activity feed is best-effort.** If your browser crashes mid-write, that activity is lost (the match itself is unaffected).
- **Activity reads are open.** Any signed-in user can read any user's activity entries. We filter to friends client-side. Not a privacy feature; it's a discoverability tradeoff.
- **No server-side validation of moves.** A malicious client could in theory send invalid moves; the rules trust the client. Same model the original had — fine for casual play with friends.
- **Profile history capped at 500 most-recent matches.** Older matches roll off the user doc to keep it under Firestore's 1 MiB per-doc cap. The matches themselves still exist; they're just no longer enumerated on /history. Fixing this properly needs a separate `match_summaries` collection.
- **Account deletion is partial.** Your profile, username, and login are removed permanently. Matches you appeared in are preserved (so your opponents' histories stay intact), and your name may still appear in their archived match records. Fully fan-out deletes would require Cloud Functions.
- **Lobby pulls full match docs.** A deployment with hundreds of concurrent matches will see initial-subscribe bandwidth of a few hundred KB on Lobby. Fine for tens of matches; expensive at hundreds. A `match_summaries` projection would solve this.
- **Spectator info can go stale.** If you join as a spectator and later change your avatar or display name, your spectator entry in that match keeps the old values. Refreshing isn't allowed — the rules forbid same-size spectator-array writes from non-players (otherwise a non-player could rewrite the whole array).
- **No Firestore rules unit tests.** The rules are hand-audited but not covered by `@firebase/rules-unit-testing`. If you fork and modify rules, run them through the Firebase Emulator before deploying.
- **No error monitoring.** Errors surface as console warnings, never reach the developer. If you care about uptime, add Sentry or similar.

---

## Code health

See `CHANGELOG.md` for the full audit trail. The project has been through four review rounds catching ~80 bugs ranging from cosmetic to data-corrupting (transaction races, Firestore rule gaps, presence leaks, ELO clamping, hooks-order violations). A few patterns worth understanding before modifying the code:

- **`finalizeStats` is transactional and idempotent.** The user doc's `finalizedMatches` array is checked inside the transaction. If two clients try to finalize the same match at the same moment, exactly one transaction commits; the other reads the now-present id and short-circuits. Don't refactor this into a non-transactional path.
- **`acceptFriendRequest` and `declineFriendRequest` are transactional.** A naive read-modify-write would drop concurrent friend requests because the in-memory React profile snapshot is always slightly stale.
- **Effects key on `profile?.id`, not the whole `profile` object.** The Firestore user-doc subscription gives `profile` a new reference on every snapshot (including 20s heartbeats). Anything that subscribes to Firestore or does work on `profile` should key on `profile?.id` and read the latest `profile` via a `useRef` companion if it needs more than the id. Match.jsx, Dashboard.jsx, and Notifications.jsx all use this pattern — follow it if you add new pages.
- **Components with conditional early returns hoist every hook above them.** React's rules-of-hooks require a stable hook order; the early `if (!match) return …; if (!profile) return null;` makes it easy to accidentally call a hook *after* the early return, which crashes the component under StrictMode. Match.jsx, Profile.jsx, Friends.jsx, and ClubDetail.jsx all hoist `useConfirm` and any conditional state above the returns; do the same if you add new pages with similar guards.

---

## Things deliberately left out

These would each be a project of their own. Ask separately if you want any of them and I'll scope what's actually doable on the free tier:

- AI opponents / move analysis / puzzles (need a chess-like engine)
- Triangle/hex grids (gameLogic rewrite)
- 3- and 4-player games (ELO and stats are 1v1)
- Tournaments / seasons / divisions (need scheduled Cloud Functions)
- Translations (can't produce native-quality Hindi/Mandarin/etc.)
- Custom avatar uploads (need Firebase Storage)
- Move undo, idle timeouts (need server time)
- Best-of-N matches (needs match-series collection)
- Anti-smurf, placement matches (need server-side history validation)
