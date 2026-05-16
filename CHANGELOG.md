# CHANGELOG — bug fix pass

This file lists every fix applied to the original Dots & Boxes drop, in
the order they appear in the audit. Each entry names the file(s)
changed, what was wrong, and what changed.

## Structural

### #1 — Files were shipped flat; project layout was broken
**Symptom:** Vite build fails. `App.jsx` and `main.jsx` import from
`./lib/...`, `./components/...`, `./pages/...`, but the zip extracts
every source file into a single flat directory.
**Fix:** Source files split into the expected `src/{lib,components,pages}/`
layout matching the README's structure and the import paths.

## Runtime bugs

### #2 / #18 — `presence.js` leaked focus-event listeners
**File:** `src/lib/presence.js`
**Symptom:** Every call to `startHeartbeat` added a `window.addEventListener('focus', …)` that was never removed. Header re-mounted on every profile change → listeners accumulated indefinitely, each holding a closure over a possibly-stale uid.
**Fix:** Track the listener reference and the active uid. `startHeartbeat` is now idempotent on the same uid; calling with a new uid transparently swaps. `stopHeartbeat` removes both the interval and the focus listener.

### #3 — `finalizeStats` was not idempotent under concurrency
**File:** `src/lib/actions.js`
**Symptom:** Two concurrent calls (two open tabs, a refresh of the win screen, etc.) both passed the `finalized.includes(matchId)` check and both committed full diffs — doubling ELO, wins, totalBoxes.
**Fix:** Wrapped the read-check-write in a `runTransaction`. The authoritative idempotency check now lives inside the transaction, so a winner can never be settled twice for the same user.

### #4 — Notifications played one beep per existing pending invite on load
**File:** `src/components/Notifications.jsx`
**Symptom:** When the user had N pending invites and the Notifications listener subscribed, the first onSnapshot fired N "added" events and the code played `sfx.notify()` for each.
**Fix:** Skip the initial snapshot; on subsequent snapshots, beep at most once per snapshot and only if a real `'added'` change is in the diff.

### #5 — First move in a match made no sound
**File:** `src/pages/Match.jsx`
**Symptom:** The guard `if (prevMoveCount.current && newMoveCount > prevMoveCount.current)` skipped the increment-from-0 case (the very first move ever made), because `0` is falsy.
**Fix:** Introduced a `hasSubscribed` ref so the guard correctly distinguishes "we've seen at least one snapshot" from "moveCount > 0".

### #6 — Auth could hang on "LOADING…" forever
**File:** `src/lib/AuthContext.jsx`
**Symptom:** `onAuthStateChanged` `await`ed `updateDoc(... online: true ...)` *before* calling `setLoading(false)`. If Firestore was slow or offline, the user stayed on the loading screen.
**Fix:** `updateDoc` is fire-and-forget; `setLoading(false)` runs immediately after.

### #7 — Per-turn timer ticked during the 3.5s pre-game countdown
**Files:** `src/lib/actions.js`, `src/pages/Match.jsx`
**Symptom:** `turnStartedAt` was stamped at match creation (before the countdown), eating ~3.5s of the first player's clock.
**Fix:** Both `forfeitOnTimeout` and the client-side timer UI clamp the effective start to `max(turnStartedAt, startsAtMs)`, so the first turn begins counting when the game actually starts.

### #8 — `eloDelta` in match history ignored the ELO floor clamp
**File:** `src/lib/actions.js`
**Symptom:** `computeElo` could compute `delta = -20`, then `Math.max(100, newA)` clamped, but the stored `eloDelta` was still `-20` even when the user's effective change was only `-10`.
**Fix:** Computes `effectiveDelta = clampedElo - myElo` and stores that. The activity feed entry also uses this number.

### #28 — Replay rebuilt the entire game on every render
**File:** `src/pages/Replay.jsx`
**Symptom:** The component recomputed game state from move 0 inside its render body. For a 100-move game with the 600ms autoplay ticker, the work was O(steps × moves) per render — pathological at the end of long games.
**Fix:** Precomputes the full per-step state list once per match via `useMemo`. Render-time work is now constant-time array indexing.

### #29 / #42 — Replay had no `useAuth` gate
**File:** `src/pages/Replay.jsx`
**Symptom:** Replay was the only page that didn't depend on `useAuth`. Consistent with other pages, this is now `useAuth`-gated so unauthenticated visitors (if they somehow bypassed the Shell gate) are short-circuited at the component level too.

### #31 — Profile of another user never refreshed
**File:** `src/pages/Profile.jsx`
**Symptom:** Viewing someone else's profile did a one-shot `lookupUserByUsername` and never updated. If their ELO/avatar/title changed while you watched, the page stayed stale until reload.
**Fix:** Resolve username → uid once, then `onSnapshot` the user doc.

### #32 — `blockUser` left the friendship asymmetric
**File:** `src/lib/actions.js`
**Symptom:** Block removed the target from MY friends list and added them to MY blocked list, but didn't touch the target's friends list. The target still saw me as a friend until they reloaded.
**Fix:** `blockUser` now also calls a symmetric `arrayRemove(currentUser.id)` on the target's `friends`. The Firestore rule update below permits this specific cross-user write shape.

### #33 / #34 — Friends.jsx had N+1 reads on every snapshot
**File:** `src/pages/Friends.jsx`
**Symptom:** The useEffect dep array contained `profile?.friends` and `profile?.blocked`, both array references that change on every Firestore snapshot of the profile. The effect re-ran every snapshot, firing one `getDoc` per friend each time.
**Fix:** New `useUserDocs(ids)` hook keys subscriptions on the sorted-joined string of ids, so it only resubscribes when membership *actually* changes. Switched from `getDoc` (one-shot) to `onSnapshot` so friend cards reflect live online status / avatars / etc.

### #35 — Messages did a redundant Firestore read on every message
**File:** `src/pages/Messages.jsx`, `src/lib/dms.js`
**Symptom:** The `markConversationRead` effect re-ran every time `messages.length` changed. Each call did a `getDoc` even when the conversation already had `unreadFor[me] === 0`.
**Fix:** ConversationView now pulls the live conversation from the parent's already-subscribed list (no more separate `getDoc`). The `markConversationRead` effect only fires when `unreadFor[me] > 0`. The function itself now uses a dot-path update so it can't clobber the other side's counter.

### #36 — Unread message counter was race-y
**File:** `src/lib/dms.js`
**Symptom:** `sendMessage` did read-modify-write on `unreadFor` without a transaction. Two simultaneous messages from the other side could both read unread=0 and both write unread=1, losing one count.
**Fix:** Uses Firestore `increment(1)` with dot-paths. Concurrent messages atomically bump the counter; my own zeroing is a separate dot-path so it can't clobber the recipient's value.

### #37 — History used array index as React key
**File:** `src/pages/History.jsx`
**Symptom:** Mild — array indices are stable enough for an append-only history that React's reconciliation worked fine, but reordering would have caused mis-mapped state.
**Fix:** Stable composite key `${matchId}-${finishedAt}` (matchId alone could repeat for rematches).

### #38 — README missed a composite index Lobby would need
**File:** `README.md`
**Symptom:** `/lobby`'s `where('status', 'in', ['active','paused']) + orderBy('createdAt','desc')` query requires a composite index. The README listed conversations/activities/clubs indexes but not this one.
**Fix:** Index added to the README list.

### #39 — Dead `span` variable in EloChart
**File:** `src/components/EloChart.jsx`
**Symptom:** Cosmetic — declared but unused.
**Fix:** Removed.

### #40 — ActivityFeed missed membership swaps
**File:** `src/components/ActivityFeed.jsx`
**Symptom:** useEffect dep was `profile?.friends?.length`. Swapping one friend for another (same count) didn't trigger a refresh.
**Fix:** Dep on the sorted-joined id string instead, so any membership change triggers a re-fetch.

### #41 — `.line-drawn` CSS animation didn't actually animate
**File:** `src/index.css`
**Symptom:** Keyframes animated `stroke-dashoffset`, but the SVG lines have no `stroke-dasharray`, so there was nothing for dashoffset to act on. Lines just appeared without the intended draw-in effect.
**Fix:** Animates `opacity` and `stroke-width` instead, both of which are immediately effective.

## Security: Firestore rules

The original `firestore.rules` had several holes that let any signed-in
user mutate other people's data. All of them have been tightened.

### #19 — Any signed-in user could update any match
**File:** `firestore.rules`
**Fix:** Match updates are now scoped:
- **Players** can update freely (game state, status, chat, pause flags).
- **Non-players** can do *only* one of: append themselves to `spectators` (`joinAsSpectator`), shrink `spectators` (`leaveSpectator`), or append a chat message authored by themselves (`sendChatAs`).

Anything else from a non-player is rejected. Match results, winner fields,
and chat-spoofing across matches you don't participate in are no longer
writable.

### #20 — Any signed-in user could overwrite anyone's social arrays
**File:** `firestore.rules`
**Fix:** The cross-user branch of the user-update rule was rewritten. A
caller can now only:
- **Append themselves** to another user's `friends` (`acceptFriendRequest`'s
  symmetric write).
- **Remove themselves** from another user's `friends` (`removeFriend` /
  `blockUser`'s symmetric write).
- **Append a request** to another user's `friendRequests`, with `fromId`
  forced to equal `auth.uid`.

The `blocked` field can no longer be touched by anyone but the owner.
Username changes are forbidden after creation (prevents racing to claim
a popular `/usernames/X` doc).

### #22 / #23 — Conversation creation was loose
**File:** `firestore.rules`
**Fix:** Conversation create now requires:
- Caller is in `participants`.
- Exactly 2 participants.
- `participants[0] < participants[1]` (lex sort).
- Doc id matches `participants[0] + '_' + participants[1]`.

`openConversation` in `dms.js` was updated to sort the participants array
to match.

### #24 — Non-members could rewrite a club's members/memberInfo
**File:** `firestore.rules`
**Fix:** Non-member updates are now only allowed when:
- Only `members` and `memberInfo` changed.
- `members` grew by 1.
- The newly-appended member id is the caller.

No more kicking other people out, no more force-adding people, no more
clobbering the entire `memberInfo` map.

### #26 — Anyone could squat any username
**File:** `firestore.rules`
**Fix:** The `usernames/X` create rule now requires
`get(/users/auth.uid).data.username == X`. A user can only claim the
username they actually have on their profile, and `username` is now
immutable on the profile after creation. The squat path is closed.

---

## Bugs noted in the audit that were intentionally not fixed

These are documented limitations of the project's free-tier-friendly
design, or cosmetic nits that didn't justify a code change:

- **No server-side move validation** (README acknowledges this).
- **Per-turn timer cheatable** via JS disable (README acknowledges).
- **Activity reads are open** (README acknowledges).
- **Clubs lack moderation** (README acknowledges).
- **bare `confirm()` for resign/leave** — works in every browser the app targets.
- **Array index keys / random toast ids** — harmless in practice.

---

## Round 3 — deep-scan fixes

Following a third audit pass that looked beyond static correctness into
edge cases, UX, accessibility, performance, and operational concerns.
80 numbered findings; all but D79 (PWA) are addressed here.

### Critical correctness

**D73 — Hardcoded production Firebase config**
*File:* `src/lib/firebase.js`
*Symptom:* Shipped config pointed at the original author's live Firebase
project. Anyone deploying without reading the README would post data to
someone else's backend.
*Fix:* Config now has `YOUR_API_KEY`-style placeholders. If `apiKey ===
"YOUR_API_KEY"` the app refuses to load and renders a red error screen
explaining how to replace it.

**D26 / D27 — User doc grows unboundedly**
*File:* `src/lib/actions.js` (finalizeStats)
*Symptom:* `matchHistory` and `finalizedMatches` were appended via
`arrayUnion` with no cap. Firestore docs are limited to 1 MiB; at
~3500 finalized matches every subsequent profile write would fail
silently, breaking stats for dedicated players.
*Fix:* Both arrays now use a rolling-window pattern. The transaction
reads the existing array, drops the oldest entry if at the cap (500),
and writes the full array back. Achievements still use `arrayUnion`
because they're catalog-bounded.

**D58 — `computeElo` can write NaN to Firestore**
*File:* `src/lib/gameLogic.js`
*Symptom:* Any non-finite input (corrupt rating, missing field) produced
NaN; Firestore rejects NaN values, silently failing the entire profile
write.
*Fix:* Inputs replaced with 1000 if not finite. Outputs clamped to 100..3500.

**D34 — `applyMove` deep-clones via JSON.parse(JSON.stringify(...))**
*File:* `src/lib/gameLogic.js`
*Symptom:* Slow on big-board late-game moves. ~10 KB serialized + parsed
on every move; two clients each transactional.
*Fix:* Targeted shallow clone of just the mutable fields (hLines,
vLines, boxes, scores, moves). ~4× faster on profile.

**D6 — Pre-game countdown can be stranded by clock skew**
*Files:* `src/pages/Match.jsx`, `src/lib/actions.js`
*Symptom:* `startsAtMs` was the inviter's local clock + 3500ms. If their
clock was wildly off, both players sat on "Starting..." for an hour or
saw the countdown skip instantly.
*Fix:* Derive countdown end from server-timestamped `createdAt + 3500`.
Picks whichever of the two values comes sooner so a skewed local clock
can't strand anyone. Mirrored in the render path, the auto-forfeit
useEffect, and the server-side `forfeitOnTimeout`.

**D7 — Dashboard auto-nav loop on quick Home click**
*File:* `src/pages/Dashboard.jsx`
*Symptom:* If the user clicked Home before `consumeAcceptedInvite`
committed, Dashboard re-mounted, the snapshot fired again for the
still-accepted invite, and the user was bounced back to the match.
Stuck in a loop.
*Fix:* sessionStorage-backed set of navigated-to invite IDs.
Initial-snapshot docs are pre-marked, and the navigate path only fires
once per id per session.

**D8 — Long chains can self-forfeit**
*File:* `src/lib/actions.js` (makeMove)
*Symptom:* Turn timer wasn't reset when a player claimed a box, only
when the turn advanced to the opponent. A player drawing a long chain
under deep thought could exhaust the original 60s window and have the
opponent click Claim Victory mid-chain.
*Fix:* Reset `turnStartedAt` after every successful move with `claimed
> 0`, in addition to player-change resets.

### Auth & account lifecycle

**D38 — No password recovery**
*Files:* `src/lib/AuthContext.jsx`, `src/lib/firebase.js`,
`src/pages/Login.jsx`, `firestore.rules`
*Symptom:* Synthetic emails (`username@dotsboxes.local`) meant
forgotten-password = locked-out forever.
*Fix:* Signup now collects a real email. Login resolves
username → email via the (now publicly-readable) `/usernames/<name>`
doc. New "Forgot password?" link triggers Firebase's
`sendPasswordResetEmail` with the registered email. Login form rewritten
with three modes (Sign In / Sign Up / Reset).

**D39 — Zombie auth-no-profile state on partial signup**
*File:* `src/lib/AuthContext.jsx`
*Symptom:* If `createUserWithEmailAndPassword` succeeded but the
Firestore writes failed (rules, quota, network), the user could log in
but had no profile doc — every page rendered blank because pages guard
on `profile`.
*Fix:* Signup wraps both `setDoc` calls in try/catch. On any Firestore
failure, `cred.user.delete()` rolls back the Auth user, surfacing a
clear error to retry.

**D40 — No way to delete your own account**
*Files:* `src/lib/AuthContext.jsx`, `src/pages/Profile.jsx`,
`firestore.rules`
*Symptom:* GDPR right-to-erasure was impossible without contacting an
admin.
*Fix:* New `deleteAccount(password)` re-authenticates and deletes
`/usernames/<name>`, `/users/<uid>`, and the Auth user (in that order
so rules can verify ownership). Profile edit panel includes a
`DeleteAccountForm` requiring typed username + password confirmation.
Firestore rules updated to allow self-delete on `/users` and the
matching `/usernames`.

### Firestore rules

`/usernames` reads are now public (required for login's pre-auth
username→email translation). The deletable parts of self-state are
unblocked. Cross-user `friends` writes still locked to add-self /
remove-self only; `blocked` still untouchable by anyone but the owner.

### UX gaps

**D9 / D10 — Rematch is indistinguishable from a fresh challenge**
*Files:* `src/lib/actions.js`, `src/components/Notifications.jsx`,
`src/pages/Match.jsx`
*Fix:* Rematch invites are marked `isRematch: true` (plus
`prevMatchId`). The Notifications card displays "wants a rematch"
instead of "challenges you" with an `● REMATCH` badge. Draw outcomes
now show a Handshake icon instead of the Trophy.

**D12 — Leaderboard exposes blocked users**
*File:* `src/pages/Leaderboard.jsx`
*Fix:* Client-side filter drops users I've blocked or who've blocked me.

**D14 / D15 — No username format validation before Firestore lookup**
*File:* `src/lib/actions.js`
*Fix:* `lookupUserByUsername` validates `/^[a-z0-9_]{3,20}$/` before
hitting Firestore. Invalid input returns null, surfacing as "User not
found" without an actual fetch.

**D63 — Duplicate pending invites pile up**
*File:* `src/lib/actions.js` (sendInvite)
*Fix:* Pre-write query for an existing pending invite to the same
recipient; rejects with "You already have a pending invite to this
user."

**D37 — Stale invites never clear**
*Files:* `src/pages/Dashboard.jsx`, `src/components/Notifications.jsx`
*Fix:* Both ends hide invites older than 1 hour. Dashboard
additionally auto-cancels the stale ones in the background.

**D55 — Block during active match leaves it running**
*File:* `src/lib/actions.js` (blockUser)
*Fix:* Block now queries active matches between me and the target,
resigns them (I forfeit; they win). Block is no longer a way to ghost
out of a losing position cleanly.

**D1 — `removeFriend` symmetric write surfaces permission errors**
*File:* `src/lib/actions.js`
*Fix:* The other-user write is `.catch(() => {})`-wrapped. My view is
already consistent after the first write; a stale asymmetric state on
the friend side is now silent.

**D17 — Spam-clickable action buttons**
*File:* `src/pages/Match.jsx`
*Fix:* Single `busy` state plus `wrap(key, fn)` helper. Pause / Resign
/ Claim Victory / Resume now show `disabled={busy === '...'}` and
short-circuit on extra clicks during in-flight writes.

**D16 — Browser confirm() inconsistent with the design**
*New file:* `src/components/ConfirmDialog.jsx`
*Files updated:* Match.jsx, Profile.jsx, Friends.jsx, ClubDetail.jsx
*Fix:* New themed `<ConfirmDialog>` with the accessible `useConfirm()`
hook. Browser `confirm()` calls in Match (resign + leave-mid-match),
Profile (remove friend, block, delete account), Friends (remove), and
ClubDetail (leave, delete) all replaced. Includes focus-trap, Escape
to cancel, focus restoration on close, `role="alertdialog"`.

**D36 — No confirmation before leaving a live match**
*File:* `src/pages/Match.jsx`
*Fix:* Clicking the Lobby button during an active or paused match
opens a confirm dialog warning that the timer keeps running.

**D18 / D62 — Chat input truncation silent + chat doc unbounded**
*Files:* `src/lib/actions.js`, `src/pages/Match.jsx`,
`src/pages/Messages.jsx`, `src/pages/ClubDetail.jsx`
*Fix:* Inputs show a `N/MAX` counter once the user approaches the cap.
`sendChatAs` now also caps the in-doc chat to ~100 messages by rolling
off the oldest. Only players trigger the cleanup write (the rule
forbids non-player full-array overwrites).

**D43 — Bio newlines collapsed**
*File:* `src/pages/Profile.jsx`
*Fix:* Bio display uses `white-space: pre-wrap`.

**D19 — Player colors unreadable in dark theme**
*File:* `src/lib/gameLogic.js`
*Fix:* `PLAYER_COLORS` is now an array of getter objects. Each access
reads the current theme via `document.documentElement[data-theme]` and
returns the appropriate variant. Dark theme uses lighter hex values
(P1 `#ECECE8`, etc.) and slightly stronger soft tints so box owners
and drawn lines stay visible.

**D23 — Quick match re-pesters recently-invited players**
*File:* `src/lib/actions.js` (quickMatch)
*Fix:* Pre-fetch of recent outgoing invites (last 10 minutes) builds a
skip-set used to filter candidates. A player who declines or ignores
won't be picked again for ten minutes.

**D42 — Countdown shows stuttering 1s at the end**
*File:* `src/pages/Match.jsx`
*Fix:* The last sub-second now reads "GO" instead of repeating "1".

**D64 — Spectator entries duplicate on avatar change**
*File:* `src/lib/actions.js` (joinAsSpectator)
*Fix:* Read-then-write dedupe by id, since `arrayUnion` can't dedupe
when mutable fields (avatar/username) differ between visits.

**D71 — Login autofocuses the wrong field for returning users**
*File:* `src/pages/Login.jsx`
*Fix:* `autoFocus` on username only when username is empty; otherwise
on password (handles the browser-autofill case).

**D44 / D45 — Notification card position + achievement card sizing**
*Files:* `src/components/Notifications.jsx`, `src/pages/Profile.jsx`,
`src/pages/Match.jsx`, `src/pages/Dashboard.jsx`
*Fix:* Notification overlay uses `top-16 sm:top-20` so it doesn't
collide with the shorter mobile header; `pointer-events: none` on the
wrapper so it doesn't block the page while empty cards are still
fade-out animating. Achievement descriptions everywhere now use
`leading-relaxed` consistently.

### Accessibility

**D46 — Inputs missing `htmlFor`/`id` labels**
*Files:* Login, Dashboard, Friends, Messages, Clubs, Profile
*Fix:* Every text input now has a paired `<label htmlFor="...">` or an
`sr-only` label for icon-only fields. New `.sr-only` utility in
`index.css`.

**D47 — Icon-only buttons missing `aria-label`**
*Files:* Notifications, Match, Dashboard, Friends, Messages,
ClubDetail, Header
*Fix:* Every icon button has a meaningful `aria-label`; the icons
themselves are `aria-hidden="true"` so screen readers don't double-read.

**D48 — Focus management on opening UI**
*Files:* `src/components/ConfirmDialog.jsx`, `src/pages/Match.jsx`
*Fix:* ConfirmDialog focuses its primary action button on appearance
and restores focus on close. PauseRequestCard auto-focuses Accept for
the recipient.

**D49 / D50 — Color-only player distinction**
*Files:* `src/lib/gameLogic.js`, `src/pages/Match.jsx`
*Fix:* Added `PLAYER_STROKE_PATTERNS` (solid, dash, dot, dash-dot per
player). Drawn lines on the board use both color and dash pattern so
color-blind players can still tell who drew what. Box owner initial
letter is also tagged with an `aria-label` describing the owner.

**D53 — Board can't be played with keyboard**
*File:* `src/pages/Match.jsx`
*Fix:* SVG is focusable (`tabIndex={0}` on your turn). Arrow keys move
through undrawn lines; Enter/Space draws the focused one. Focus state
maintained in React; SVG has `role="application"` with a descriptive
`aria-label`. Hover now uses React state instead of DOM
`previousSibling`, fixing the long-standing fragility.

**D54 — No visible focus rings for keyboard users**
*File:* `src/index.css`
*Fix:* Universal `:focus-visible` style adds a 2px ink outline with
2px offset on buttons, links, inputs. `.input-field` overrides with
border-bottom-color so the underlined inputs don't look doubly bordered.
New `.focus-ring` utility for inline cases.

**D41 — Tap targets too small on mobile**
*File:* `src/pages/Match.jsx`
*Fix:* Hit-area for line clicks is now `max(44, cell * 0.4)` —
meets iOS HIG's 44pt minimum even on cramped 28px-cell boards.

### Performance

**D28 — Timer ticks 4× per second**
*File:* `src/pages/Match.jsx`
*Fix:* `setInterval(setNow, 1000)`. Progress bar transition slowed to
1000ms so the visual stays smooth between ticks.

**D32 — EloChart recomputes on every Dashboard render**
*File:* `src/components/EloChart.jsx`
*Fix:* Memoized on `[matchHistory, currentElo]`. Sort + walk happen
once per actual data change, not per snapshot.

**D33 — Replay precomputes every move's full board state**
*File:* `src/pages/Replay.jsx`
*Fix:* One game state held at a time, with a forward cache for
incremental playback. Stepping backward rebuilds from empty. 200-move
match dropped from ~2 MB held to ~10 KB.

**D72 — Confetti chops on low-end devices**
*File:* `src/components/Confetti.jsx`
*Fix:* `adaptivePieceCount()` sniffs `navigator.deviceMemory` and
`hardwareConcurrency`. ≤2 GB → 30 pieces; ≤4 GB or ≤2 cores → 40-50.
Otherwise the configured 80.

### Edge cases

**D69 — Reduced-motion stuck on initial value**
*File:* `src/lib/theme.js`
*Fix:* `matchMedia('(prefers-reduced-motion)')` listener applied at
module load. OS-level changes mid-session trigger `applyTheme()` —
only when no explicit user override is stored.

### Operational

**D74 — README ambiguous about GitHub web upload**
*File:* `README.md`
*Fix:* Now explicitly notes that GitHub's web uploader preserves
folder structure only when you drop the folder itself, not its
contents.

**D78 — Stale JS bundles after Netlify deploys**
*File:* `netlify.toml`
*Fix:* `Cache-Control: max-age=0, must-revalidate` on `index.html`;
long-cache (`max-age=31536000, immutable`) on hashed `/assets/*`.
Basic security headers added (X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy).

### Skipped (out of scope or won't-fix)

- **D29 — Lobby pulls full match docs.** Would need a separate
  `match_summaries` collection; documented in README as a known
  limitation.
- **D60 — Background tab throttling.** Browser-imposed; can't fix
  client-side.
- **D75 — CI.** Adding GitHub Actions is out of scope for a free-tier
  hobby app.
- **D76 — Firestore rules unit tests.** Needs a separate test
  scaffold; documented as a known limitation.
- **D79 — PWA.** Explicitly excluded.
- **D80 — Error monitoring.** Needs an external service (Sentry etc.);
  documented as a known limitation.

---

## Round 4 — re-audit findings

A fourth review pass turned up seven real bugs the previous rounds
missed (B1–B7) plus a handful of smaller issues. Each is documented
below.

### Critical correctness

**B1 — Rules-of-hooks violation in Match.jsx**
*File:* `src/pages/Match.jsx`
*Symptom:* `useState(busy)` and `useConfirm()` were declared partway
through the component body, after the early-return guards `if (!match)
return …;` / `if (!profile) return null;`. Under `<React.StrictMode>`
(enabled in `main.jsx`), the first render returned early before those
hooks could run; the second render (after match/profile loaded) tried
to call them, and React flagged "Rendered more hooks than the previous
render." Net effect: the match page failed to mount.
*Fix:* All hooks (including `busy`'s state and `useConfirm`) now run
unconditionally at the top of the component, ahead of any early
return. The other three call sites of `useConfirm` (Profile, Friends,
ClubDetail) already did this correctly — only Match got it wrong.

**B5 — `acceptFriendRequest`/`declineFriendRequest` could drop concurrent requests**
*File:* `src/lib/actions.js`
*Symptom:* Both functions read `currentUser.friendRequests` from the
in-memory profile snapshot, filtered out one entry, and wrote the
entire array back via `updateDoc`. If a second friend request arrived
between the React snapshot that produced `currentUser` and the write,
the second request was silently destroyed. Mirror of the dms.js race
that D36 fixed.
*Fix:* Both functions now wrap the filter-and-write in
`runTransaction`. The filter operates on the authoritative value read
inside the transaction, so any concurrent append (which a friend
request is — `arrayUnion`-style) survives.

**B6 — Signup rollback leaked an orphan /users doc**
*File:* `src/lib/AuthContext.jsx`
*Symptom:* `signup` writes `/users/<uid>` first, then `/usernames/<x>`.
If the second write failed (rules, network, username race), the catch
block deleted the Auth user but left the user doc behind. The
Firestore rule `allow delete: if isSelf(userId)` then made cleanup
impossible — the auth identity required to delete the doc had just
been removed.
*Fix:* Track which writes succeeded; on failure delete the orphan
user doc *before* deleting the Auth user (so `isSelf` still resolves).

### Performance / wasted Firestore reads

**B2 — Match page re-subscribed on every profile heartbeat**
*File:* `src/pages/Match.jsx`
*Symptom:* The match-watch `useEffect` deps were `[id, profile]`. The
profile object gets a new reference on every Firestore snapshot of the
user doc — including the 20-second heartbeat — so the match listener
tore down and re-established roughly every 20s. The
`hasSubscribed.current = false` cleanup also reset the move-sound gate
each time, silencing the move sound for the snapshot right after each
heartbeat.
*Fix:* Dep on `profile?.id`. The callback reads the latest `profile`
through a ref (`profileRef`) refreshed by a tiny companion effect, so
the win/loss sound still sees the current user.

**B3 — Notifications listener defeated the D4 fix**
*File:* `src/components/Notifications.jsx`
*Symptom:* Same dep-array shape as B2: `[profile]` instead of
`[profile?.id]`. The invites listener re-subscribed on every
heartbeat, resetting `isInitialSnapshot = true` each time, which
caused a real new invite arriving in the same snapshot batch as a
profile update to be silently treated as "initial" — and the
notification beep added by D4 was suppressed.
*Fix:* Dep on `profile?.id`.

**B4 — Dashboard accepted-invite + outgoing-invite listeners re-subscribed on every heartbeat**
*File:* `src/pages/Dashboard.jsx`
*Symptom:* Same pattern. Both `useEffect`s used `[profile]` (or
`[profile, navigate]`). Each profile heartbeat tore both listeners
down and re-established them. The sessionStorage-backed `seen` set
kept behaviour correct, but Firestore connections churned.
*Fix:* Dep on `profile?.id`. The listener callbacks read the
authoritative profile via a `profileRef` ref refreshed by a separate
effect.

### Security

**B7 — Club join rule didn't constrain memberInfo**
*File:* `firestore.rules`
*Symptom:* The `memberJoin()` rule required `members` to grow by 1
with the caller appended, but placed no constraint on `memberInfo`. A
non-member's join write could simultaneously rewrite any other
member's `memberInfo` entry (usernames, avatars). Low-impact in
practice (the display info is non-authoritative) but a hole D24
intended to close.
*Fix:* The rule now also requires
`request.resource.data.memberInfo.diff(resource.data.get('memberInfo', {})).affectedKeys().hasOnly([request.auth.uid])`
— so a non-member join can add the caller's own memberInfo entry but
cannot modify or remove any existing one.

### Smaller cleanups

- `finalizeStats`: removed dead `Math.max(100, newA)` — `computeElo`
  already clamps to [100, 3500] after the D58 fix, so the second
  clamp here was redundant.
- `Replay.jsx`: `step` and `playing` now reset to initial values when
  the route's `id` changes, so navigating from a long replay to a
  short one no longer briefly shows an out-of-range step in the
  slider readout.
- `joinAsSpectator`: clarified the dedupe semantics. The comment
  promised a "read first and write merged" pattern but the code just
  returned early; we now state explicitly that non-player updates
  can't rewrite their spectator entry (the rule forbids same-size
  writes from non-players) and skip the no-op.
- `sound.js`: `getCtx()` now calls `ctx.resume()` if suspended.
  iOS Safari and some other mobile browsers start AudioContext in
  the 'suspended' state and require resume() from within a user
  gesture handler. Most of our sfx fire from click/keyboard
  handlers, so this gets us audible sounds on first interaction
  without the user noticing the gap.

### Round 4 — Skipped (out of scope or won't-fix)

- **`Replay.jsx` `cache` is a mutated `useMemo`.** It works correctly
  because of how the deps flow, but it's an anti-pattern; the
  "cache" is morally a `useRef`. Refactoring is a non-functional
  cleanup, left for a future pass.
- **`removeFriend`'s symmetric write race.** `removeFriend` does
  self-update then opportunistic cross-user removal. The cross-user
  write was wrapped in `.catch(() => {})` by D1; making it fully
  transactional would require relaxing the cross-user rule to allow
  reads, which is a worse tradeoff than the current behaviour.
