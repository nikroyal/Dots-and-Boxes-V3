## 2024-05-18 - ELO Progression Visualizations

**Learning:** Players want to see their forward progress towards the next ELO rank, not just what their current ELO is. By visualising the percentage to their next rank up with a progress bar and showing active win streaks, we give them explicit short-term milestones rather than nebulous point numbers to grind.

**Action:** Whenever implementing a tier or ranking system, explicitly expose the threshold and progress required for the *next* milestone rather than just displaying the current state statically.

## 2026-06-19 - Public Profile Social Proof

**Learning:** Static statistics (like total wins or high scores) on a user's profile show capability, but they don't tell a story. By exposing dynamic narratives—like ELO progression over time and recent activity feeds—on public profiles, we trigger competitive curiosity. Users can see *how* someone achieved their rank and what they are actively doing, which motivates them to engage more to build their own narrative.

**Action:** When designing public-facing user profiles, prioritize chronological activity and progression timelines alongside static lifetime metrics to create social proof and encourage reciprocal engagement.

## 2024-05-19 - Permanent Arcade Records

**Learning:** When players set personal bests in solo arcade games, storing them only locally or temporarily in feeds reduces their perceived value. Making personal bests persistent across sessions and visible on a player's public profile makes the achievement feel permanent and shareable, increasing motivation to retry for higher scores.

**Action:** Whenever implementing a solo game or high-score system, ensure the best results are persisted to the user's backend profile and publicly displayed on their dashboard/profile page so they can be shown off as "records" rather than ephemeral stats.

## 2024-05-20 - Post-Match Friction Reduction

**Learning:** When players finish an intense or enjoyable online multiplayer match, their emotional engagement is high, making it the perfect moment to build a social connection. However, hiding the "Add Friend" action behind a multi-step profile navigation flow introduces too much friction, preventing these connections from forming. By placing the "Add Friend" button directly alongside the "Rematch" button on the win screen, we capitalize on this high-engagement moment and significantly increase the organic growth of social graphs.

**Action:** Whenever a shared social experience concludes (like a multiplayer match, a collaborative build, or a club event), proactively surface relevant social connection actions (like "Add Friend" or "Join Club") directly in the resolution interface rather than relying on users to seek them out later.
## 2026-06-22 - Daily Goals System

**Learning:** Implementing time-gated progress systems (like daily goals) requires careful hydration of state on the client. Relying purely on transient transactional outcomes () to set state flags like `dailyGoalCompletedToday` can cause state to stall across real-world day boundaries if a user leaves a tab open or logs in without triggering a transaction.

**Action:** When deriving UI state for time-dependent features, always evaluate the status live in the component based on the current timestamp compared to the stored completion timestamp (), rather than relying on boolean flags flipped by past transactions.
## 2026-06-21 - Daily Goals System

**Learning:** Implementing time-gated progress systems (like daily goals) requires careful hydration of state on the client. Relying purely on transient transactional outcomes (`txResult`) to set state flags like `dailyGoalCompletedToday` can cause state to stall across real-world day boundaries if a user leaves a tab open or logs in without triggering a transaction.

**Action:** When deriving UI state for time-dependent features, always evaluate the status live in the component based on the current timestamp compared to the stored completion timestamp (`profile.dailyGoalDate === today`), rather than relying on boolean flags flipped by past transactions.
## 2024-06-24 - Daily Goal Streak Celebration

**Learning:** Celebrating streaks visibly at the point of action (Daily Goal card) and explicitly inviting users back ("Come back tomorrow to keep your streak going") turns a static metric into a returning habit.

**Action:** Surface existing retention metrics actively rather than passively burying them in profiles, and always provide a clear "next step" for the next day.

## 2024-05-24 - Unlockable Cosmetics

**Learning:** Tying cosmetic profile customizations (like avatars and titles) directly to engagement stats and achievements creates social proof, making players want to earn those cosmetics to show off on their public profile, driving retention.

**Action:** When offering user customization, structure the options so that some are immediately available but premium options are visibly locked behind specific gameplay milestones, using them as intrinsic motivation drivers.


## 2026-06-25 - Post-Match Momentum Visualization

**Learning:** When players finish an intense or enjoyable online multiplayer match, their emotional engagement is high, making it the perfect moment to build motivation to play again. Displaying a clear progress visualization (such as ELO rank progression and win streak celebrations) on the victory screen capitalizes on this high-engagement moment by giving them an immediate, tangible reason to start another match (e.g., reaching the next rank).

**Action:** Whenever a shared competitive or progress-oriented experience concludes, prioritize displaying dynamic progression elements (progress bars, delta numbers) rather than static states to encourage repeat play.

## 2024-06-30 - Post-Match Momentum Visualization II

**Learning:** Players' highest engagement peaks right when they win or lose a multiplayer match. While long-term rank progression (ELO) is motivating, surfacing short-term, immediately attainable goals (like the next Daily Goal or an Up Next Achievement) right on the Win Screen gives players an explicit, bite-sized reason to play "just one more." This reduces friction in deciding whether to click "Rematch" or "Home" by providing an immediate secondary objective.

**Action:** Whenever a player completes a core gameplay loop (like a match), inject dynamic, personalized short-term goals (daily goals, closest achievements) into the post-match resolution screen to convert the momentum of a finished session into motivation for the next one.
## 2024-07-05 - Landing Page Momentum

**Learning:** When users launch a multi-game hub, displaying only a list of games leaves them without an immediate direction. Surfacing bite-sized, dynamic goals (like Daily Goals, Up Next Achievements, and ELO progress) directly on the landing page creates "momentum before the click," significantly reducing the friction of choosing what to play by providing a tangible first objective.

**Action:** Whenever designing a landing page or app hub, prioritize dynamic, actionable progression metrics above the fold so the user's very first impression is "I have a specific reason to play right now."

## 2024-11-20 - Arcade Micro-Goals and Friction Reduction

**Learning:** Solo arcade games can lose retention if failure states feel abrupt and the restart loop requires manual mouse navigation. By explicitly revealing missed answers (closing the learning loop), outlining clear score micro-goals for the next tier, and implementing universal keyboard shortcuts (like 'Enter') to immediately restart, we significantly reduce friction and encourage a "just one more try" mentality.

**Action:** For arcade games, always close the learning loop on failure, provide a micro-goal for the next attempt, and implement zero-friction keyboard shortcuts for restarting the game.

## 2024-07-11 - Public Profile Up Next Achievement

**Learning:** When players look at their own or others' public profiles, seeing a massive list of static, mostly-locked achievements can be overwhelming rather than motivating. Surfacing a dynamically calculated "Up Next" achievement directly at the top of the profile focuses their attention on a single, immediately attainable goal, converting static profile views into actionable play sessions.

**Action:** Whenever displaying long lists of progression milestones (like achievements or ranks) on a profile, always highlight the single most attainable next milestone to give the user a clear, immediate reason to play another match.

## 2024-07-12 - Eliminating the "Done" State

**Learning:** Hiding progress components when short-term goals (like a Daily Goal) are completed reduces post-match engagement because it removes immediate explicit motivation.

**Action:** When short-term goals are completed, explicitly celebrate them (e.g., "Come back tomorrow!") to create a returning habit, and ensure they are always displayed alongside long-term goals (like ELO rank progress) to maintain momentum.

## 2024-07-25 - Front-Door Progression Hooks

**Learning:** When users land on the central hub (`AxiomHub`), they are met with static information (total available games, number of friends). This lacks immediate motivation to engage. By surfacing their personal progression (ELO rating, unlocked achievements, and specifically their closest locked achievement with a progress bar) directly on the landing page, we turn a static directory into an active engagement loop, giving them a specific reason ("I am 80% to my next award") to dive into an experience immediately.

**Action:** Replace static "system" metrics on landing pages with dynamic personal progression metrics, and always surface the most achievable micro-goal (like an "Up Next" achievement) at the front door.

## 2024-05-21 - Hub Progression Visualization

**Learning:** Users lack immediate motivation when arriving at the root Hub because their progression stats (Rank, Up Next Achievements) are hidden inside their Profile or game-specific dashboards. Moving progression elements directly to the root hub creates immediate friction-less reminders of their goals, converting passive "browsing" sessions into active "goal-oriented" sessions right from the front page.

**Action:** Always surface high-level progression metrics (like Rank and closest Achievements) on the highest-traffic root/hub pages, rather than burying them in secondary profile tabs, to provide immediate contextual motivation to return to the core loop.

## 2025-02-28 - Post-Match Momentum Goal Granularity

**Learning:** Highlighting goals that require only a binary, one-off action (like "play a game") inadvertently obscures goals that require sustained effort (like "play 100 games"). When a binary achievement completes, it hits 100% progress and dominates the immediate post-match screen, distracting the user from the actual incremental progress they are making.

**Action:** When surfacing "closest" or "up next" goals/achievements, explicitly filter out binary or immediate-completion goals to ensure the user's attention is focused on targets that require ongoing engagement and repeated sessions.
## 2024-07-28 - Hub Daily Goal Completion Visibility

**Learning:** When short-term goals (like a Daily Goal) are completed, removing them from high-traffic pages (like the Hub) eliminates immediate explicit motivation and creates a "Done" state that reduces post-match engagement.

**Action:** When short-term goals are completed, explicitly celebrate them with a completed state and a call-to-action (e.g., "Come back tomorrow!") on the Hub to create a returning habit, and ensure they remain visible rather than being hidden.

## 2024-05-30 - Long-Term Daily Goals

**Learning:** While Daily Goals provide short-term (daily) motivation, players lack a reason to consistently complete them over weeks or months. Once they complete the goal for the day, there's no visible "larger" progression tied specifically to that daily habit, causing the feature to feel disconnected from their long-term identity in the game.

**Action:** Tie short-term repetitive tasks (like Daily Goals) into long-term cumulative and streak-based achievements (e.g., 7-day streak, 30 total goals) and explicitly display best streaks on profiles. This bridges the gap between a daily task and a long-term progression system, making every daily completion feel like a step toward a much larger reward.
