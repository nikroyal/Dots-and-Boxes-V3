## 2024-06-17 - Pure State Updaters
**Learning:** Avoid placing side effects (like localStorage modifications) inside React state setter callbacks. This violates function purity and can cause issues in React Strict Mode or testing.
**Action:** Handle side effects inside useEffect or explicit event handlers, and keep state setter callbacks pure.
## 2024-10-30 - Overlay Action Buttons
**Learning:** Forcing users to rely on separate sidebar or header buttons to start/resume a game when an overlay is present creates friction and confusion.
**Action:** Always include primary action buttons (Start, Resume, Play Again) directly within the `Overlay` component where the user's attention is focused to improve first-minute comprehension and replay speed.
## 2026-06-19 - Adding Dynamic Contextual Feedback
**Learning:** Adding lightweight conditional UI messaging mapped directly to the final user state (e.g., scores, moves) creates an immediate qualitative assessment that is highly satisfying.
**Action:** In small arcade games, always consider replacing generic "Game Over" or "You Win" states with performance-based qualitative tiers (like stars or descriptive ratings) to instantly improve the replay loop.
## 2026-06-18 - Avoid Shallow Copying Reducer State
**Learning:** Relying on shallow copies (e.g. `{ ...state }`) within game state reducers, especially nested objects and arrays, leads to mutation issues that crash React Strict Mode apps.
**Action:** Always use deep copying methods like `structuredClone(state)` at the start of a reducer function that performs multiple mutations.
=======
## 2026-06-19 - Adding Dynamic Contextual Feedback
**Learning:** Adding lightweight conditional UI messaging mapped directly to the final user state (e.g., scores, moves) creates an immediate qualitative assessment that is highly satisfying.
**Action:** In small arcade games, always consider replacing generic "Game Over" or "You Win" states with performance-based qualitative tiers (like stars or descriptive ratings) to instantly improve the replay loop.

## 2024-06-20 - Adding Initial Peeks
**Learning:** For memory-based games, forcing players into a completely blind first turn feels random and relies entirely on luck, which can hurt first-minute engagement.
**Action:** Always consider adding a brief "peek" phase where the board or state is temporarily revealed before play starts to establish context and give players an immediate strategic hook.

## 2024-06-20 - Shareable Milestones
**Learning:** Players enjoy sharing good results, but manually typing out scores is high friction.
**Action:** When a player reaches a game-over or win state with a score or qualitative rating, add a simple "Share Result" button that writes a pre-formatted string to the clipboard to encourage social shareability and replayability.
