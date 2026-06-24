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
