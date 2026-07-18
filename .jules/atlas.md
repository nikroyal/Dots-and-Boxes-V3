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
## 2026-06-19 - Adding Dynamic Contextual Feedback
**Learning:** Adding lightweight conditional UI messaging mapped directly to the final user state (e.g., scores, moves) creates an immediate qualitative assessment that is highly satisfying.
**Action:** In small arcade games, always consider replacing generic "Game Over" or "You Win" states with performance-based qualitative tiers (like stars or descriptive ratings) to instantly improve the replay loop.

## 2024-06-20 - Adding Initial Peeks
**Learning:** For memory-based games, forcing players into a completely blind first turn feels random and relies entirely on luck, which can hurt first-minute engagement.
**Action:** Always consider adding a brief "peek" phase where the board or state is temporarily revealed before play starts to establish context and give players an immediate strategic hook.

## 2024-06-20 - Shareable Milestones
**Learning:** Players enjoy sharing good results, but manually typing out scores is high friction.
**Action:** When a player reaches a game-over or win state with a score or qualitative rating, add a simple "Share Result" button that writes a pre-formatted string to the clipboard to encourage social shareability and replayability.

## 2026-06-21 - Shareable Results to Improve Retension
**Learning:** Adding easy "Share Result" clipboard features to game over screens leverages word-of-mouth loops to improve game discoverability and virality. Ensuring clear visual feedback (like "Copied!") is essential for a complete and polished UX.
**Action:** When adding sharing features, prioritize copying a fun text string with relevant stats and emojis directly to the clipboard. Always add immediate visual UI feedback when the copy succeeds so users aren't left guessing.

## 2026-06-23 - Adding share results to outcomes
**Learning:** In Rock Paper Scissors, people like sharing their final streak, but resetting it instantly on loss destroys that moment. Deferring the state reset until the *next* game begins preserves the outcome for sharing while maintaining the correct gameplay loop.
**Action:** When adding sharing to streak-based games, always decouple the game over state from the internal streak reset.
## 2024-11-20 - Keyboard Shortcuts for Fast Core Loops
**Learning:** For small arcade games like Rock Paper Scissors or Whack-A-Mole, requiring pointer clicks limits the maximum speed and flow a power user can achieve. Adding keyboard shortcuts fundamentally transforms the replay loop from an interactive webpage to a highly responsive twitch game.
**Action:** When evaluating arcade or click-heavy games, always map core actions to the number row/numpad and include visual hints in the UI to surface these shortcuts.
## 2024-05-18 - Differential Feedback
   **Learning:** Players find it much more satisfying to see a direct comparison (+/- ms) against their best score rather than just their absolute time. Fast, comparative feedback loops create a stronger "play again" incentive.
   **Action:** Always consider showing the delta (difference) between the current performance and the best performance in fast-paced arcade games.

## 2024-05-18 - Dynamic Constraint Visualization
   **Learning:** In guessing games or games with logical boundaries, visually narrowing the constraints dynamically (like updating the valid `minBound` and `maxBound`) drastically reduces cognitive load for new players, improving the first-minute experience.
   **Action:** Look for opportunities to visualize logical constraints and update them dynamically during gameplay, rather than relying solely on text-based feedback like "Too high".

## 2024-05-18 - Explicit Target Context
   **Learning:** Games with star ratings based on move counts or time often lack context for new players. By explicitly stating the target required for the top rating upfront (e.g., "Target: ≤ 10 moves"), players instantly understand the goal and have a reason to replay.
   **Action:** Expose rating thresholds or "par" scores directly in the UI before or during the game, rather than only revealing them upon completion.
## 2026-06-27 - Auto-Advancing Flow State
**Learning:** In fast-paced input games (like Word Scramble), requiring a player to hit Enter or click a submit button after typing the correct answer creates unnecessary friction and breaks flow.
**Action:** Always consider checking the input state dynamically (`onChange`) and auto-advancing the game loop the instant the winning condition is met.

## 2026-06-27 - Progressive Scaling Difficulty
**Learning:** Small arcade games can feel monotonous if the difficulty is static. Dynamically scaling elements based on the score (e.g. shrinking a target using `transform: scale()`) is an extremely low-effort way to create a smooth, organic difficulty curve without complex mechanics.
**Action:** When evaluating simple click or timing games, identify the core interaction point and tie its size or speed directly to the player's current score.

## 2026-06-27 - Anti-Spam Penalties
**Learning:** In games where players must click specific targets (like Whack-a-Mole), the lack of a penalty for missing encourages a degenerate strategy where the player just spams clicks everywhere.
**Action:** Always implement a miss penalty (e.g., negative points) with clear visual feedback to enforce precision and increase the skill ceiling.
## 2026-06-28 - Fast Input Responsiveness
**Learning:** In fast-paced or reaction-based arcade games (like Click The Target), using standard `onClick` handlers introduces an inherent 100-300ms touch delay on mobile devices, which makes the game feel sluggish and unresponsive.
**Action:** Always use `onPointerDown` instead of `onClick` for interactive game elements to eliminate touch delay. Ensure you use `e.stopPropagation()` to prevent misclicks on background elements.
## 2024-05-18 - Keyboard Loop Friction
**Learning:** For games heavily reliant on keyboard inputs (like typing words or mashing number keys to hit moles), requiring players to reach for the mouse to start or restart the game breaks their flow state and introduces unnecessary friction.
**Action:** When evaluating games with heavy keyboard interaction, ensure the core loop can be started, skipped, and restarted using the keyboard (e.g., binding 'Enter' to Play Again/Start/Skip). Always remember to use the `useRef` pattern (e.g., `const callbackRef = useRef(callback)`) when binding global event listeners to avoid stale closures.

## 2024-05-19 - Immediate UI Error States
**Learning:** In typing or input-heavy games, allowing the user to blindly type incorrect characters without immediate visual feedback leads to wasted time and frustration.
**Action:** Always provide instant visual styling (like a red border or background) the moment the input diverges from the target.

## 2024-05-19 - Input Attributes for Numeric Games
**Learning:** Using `<input type="number">` adds unwanted browser UI elements (spinners) and allows non-numeric characters like "e" to be typed, causing friction in fast-paced arcade games.
**Action:** Replace `type="number"` with `<input type="text" inputMode="numeric">` and manually strip non-numeric characters in the `onChange` handler to ensure a clean, native-feeling mobile and desktop experience.

## 2024-11-21 - Visual Hints for Shortcuts
**Learning:** Players may not discover keyboard shortcuts unless they are explicitly indicated in the UI.
**Action:** Always append the corresponding shortcut key to the primary action button's text (e.g., "Start Game (Enter)").

## 2024-05-19 - Keyboard Shortcuts for Fast Core Loops & Closing Learning Loops
**Learning:** Explicitly surfacing keyboard shortcuts (like Enter) directly on primary buttons reduces friction and speeds up the replay loop. Revealing missed states (like the word in Word Scramble) immediately satisfies curiosity and closes the learning loop.
**Action:** Always ensure arcade games use explicit keyboard shortcuts to start/restart, and always reveal the final "answer" or missed objective upon failure to encourage another try.

## 2024-07-16 - Shareable Qualitative Ratings
**Learning:** Adding performance-based qualitative tiers (like "Aimbot" or "Hacker") and including them in the clipboard share text significantly boosts the fun factor and replayability of arcade games.
**Action:** When adding sharing to games, map numerical scores/times to qualitative rating strings and display them on the result screen and in the copy-paste string.

## 2024-11-20 - Global Keyboard Shortcuts and Stale Closures
**Learning:** Adding window-level 'keydown' event listeners in a React component for fast-replay shortcuts (like 'Enter' to restart) requires storing both the target callback function and relevant state checks (e.g., ) in . Failing to do so causes stale closures, where the event listener uses the initial render state and either fails to trigger or triggers the wrong action.
**Action:** When implementing global keyboard shortcuts in React for arcade games, always wrap the necessary state variables and callback functions in  and update them within a , then invoke the ref in the keydown handler.
## 2026-07-17 - Safe Fast Keyboard Shortcuts in React
**Learning:** Implementing window-level `keydown` event listeners in React for fast core loops requires updating a mutable `ref` containing the execution callback (e.g., `startGame`) triggered within a `useEffect` with no dependency array (or specific dependency) so the listener always invokes the absolute latest function closure, preventing stale state errors and buggy behavior during fast restarts.
**Action:** When adding global keyboard shortcuts to React games for quick restarting, use a `useRef` to store the target callback and update it during every render cycle or `useEffect`, rather than binding it directly into the listener.
