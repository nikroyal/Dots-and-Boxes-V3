## 2024-11-20 - Reaction Timer
**Learning:** React state changes should be scheduled properly for precision games, using `performance.now()` offers significantly better accuracy than `Date.now()` for measuring raw milliseconds. Also, React's `useRef` for timeouts prevents side effects when components unmount.
**Action:** Use `performance.now()` to record high-resolution timestamps, and always clear timers in `useEffect` cleanup.## 2024-05-15 - React Interval Timer Side-Effects
**Learning:** Side-effects (like ending a game and saving scores) should not be triggered directly inside a `setInterval`'s functional state updater (e.g., `setTimeLeft(prev => { if (prev <= 1) endGame(); ... })`). This is a React anti-pattern because updaters must be pure, and Strict Mode will call them twice, causing double executions of side effects like sound playback.
**Action:** Always keep interval updaters pure (e.g., `setTimeLeft(prev => Math.max(0, prev - 1))`) and handle the resulting side-effects in a separate `useEffect` that listens for the state reaching its terminal condition (e.g., `useEffect(() => { if (timeLeft === 0) endGame() }, [timeLeft])`).
## 2024-06-19 - Strict dependency boundary
**Learning:** Do not install dependencies like `@playwright/test` for temporary Playwright verification scripts, as this modifies `package.json` and violates negative constraints. Use Node.js built-in `require("assert")` or raw playwright assertions instead.
**Action:** Write standalone verification scripts without requiring external assertion libraries, or do not commit dependency changes.

## 2026-06-23 - Vite Post-Install Requirements
**Learning:** When `vite` is not found during dev server startup, it is often because post-install scripts for native dependencies (like `esbuild`) were blocked by pnpm's strict security model.
**Action:** Always check the output of `pnpm install`. If warnings about ignored build scripts appear, run `pnpm approve-builds` and then `pnpm install` again to ensure native dependencies are compiled.

## 2026-06-23 - Restoring Tracked Build Directories
**Learning:** In repositories where build output directories like `dist/` are tracked in source control, deleting them with `rm -rf` and leaving them un-staged can break deployment pipelines or require messy revert steps in PRs.
**Action:** Use `git restore dist/` to revert unintended changes to tracked build artifacts instead of manually deleting them.
## 2026-06-24 - Word Scramble
**Learning:** For fast-paced typing games, always clear the input immediately after a wrong guess to keep the flow smooth, or keep it, but clearing it provides better feedback. Using `form` submission with `preventDefault()` is better than just a raw `input` `onChange` or `onKeyDown` since it handles submit gracefully on mobile devices too.
**Action:** Use standard form patterns for input-based games where feasible to ensure cross-device consistency and good accessibility.
## 2024-06-25 - WPM calculation
**Learning:** When calculating Words Per Minute (WPM) dynamically, consider whether the final score should include correctly typed characters from partially completed words/sentences, or only fully completed ones. The live WPM and final WPM should match logic to avoid jarring score drops at the end of the timer.
**Action:** Always ensure the final score calculation perfectly mirrors the live score calculation logic in time-based arcade games.
## 2024-06-28 - Fix final WPM calculation in Typing Speed game
**Learning:** Stale closures in timer callbacks (setTimeout/setInterval) lead to using initial or outdated state values. This is common when game timers end and need to calculate final scores using live typing state.
**Action:** To prevent stale closure issues when accessing React state inside timer callbacks, store the required state values (userInput and currentQuote) in mutable refs (useRef) and synchronize them using useEffect whenever the state changes. Then use the .current property of the refs inside the callback.
## 2024-11-20 - Numeric Input in Games
**Learning:** Using `<input type="number">` adds browser spin buttons that distract from fast gameplay and make exact matching harder, and `min`/`max` are ignored if we change it.
**Action:** Use `<input type="text" inputMode="numeric">` for rapid numeric input and handle bounds checks manually.

## 2024-07-06 - Rapid Numeric Input
**Learning:** Using <input type="text" inputMode="numeric"> instead of type="number" prevents unwanted spin buttons and simplifies matching validation for fast games.
**Action:** Use text input with numeric inputMode for arcade-style math games.

## 2024-11-21 - Autofocus on State Change
**Learning:** For fast-paced games where an input field transitions from `disabled` to enabled based on a state change (e.g., clicking "Start Test"), React's `autoFocus` prop will not trigger because the element is already mounted.
**Action:** When enabling inputs that require immediate focus, manually call `inputRef.current.focus()` inside the state-transition handler (often wrapped in a short `setTimeout` to ensure React has completed the render cycle).

## 2024-07-08 - String manipulation tools vs sed
**Learning:** When injecting or replacing code in files containing complex characters (like JSX tags, slashes, or file paths), avoid using inline `sed` commands as they often fail with syntax errors and delimiter conflicts (e.g., `unknown command: >`).
**Action:** Instead, use a temporary Node.js script (`.cjs`) utilizing `fs.readFileSync` and string manipulation (`.replace` or `.split().join()`) to safely apply the patch.

## 2026-06-25 - Speed Math Keyboard Event Stale Closure Fix
**Learning:** Attaching global event listeners (like window.addEventListener('keydown')) using a React callback that has external state/function dependencies causes the listener to be constantly detached and re-attached unless you wrap the handler in `useCallback` and ensure dependencies are stable, or just store a ref.
**Action:** Use `useCallback` for global event handlers to keep event bindings stable and prevent excessive DOM manipulations.

## 2024-07-12 - Rapid Input Arcade Games Validation
**Learning:** For continuous, rapid-fire input-based games where answers can be typed sequentially without pressing Enter, validating the input directly inside the `onChange` handler and clearing the state immediately on a correct answer provides an excellent user experience.
**Action:** Use auto-submit/auto-clear patterns in `onChange` handlers for fast-paced text input games, and validate input aggressively (e.g. `!/^-?\d*$/.test(val)`) to prevent entering incorrect characters that could break parsing logic.

## 2026-07-15 - Double Route Registration for Arcade Games
**Learning:** When adding new Arcade games that should be accessible without authentication, ensure the route is injected into both the unauthenticated (`if (!user)`) and authenticated (`if (!profile)`) routing blocks in `src/App.jsx` to prevent redirection to the login page.
**Action:** Always verify if a game should be playable without logging in, and if so, register its route in both sections of the `App.jsx` component.

## 2026-07-15 - Avoiding Stale Closures in Global Event Listeners
**Learning:** In React components, when attaching global event listeners (like `keydown`) that depend on state variables, using a `useRef` to store the latest callback function prevents stale closures while avoiding constant re-attachment of the event listener.
**Action:** Use the `useRef` pattern for event listeners that need access to the latest state but should only be attached once on mount.

## 2024-07-25 - Quick Math validation logic
**Learning:** For continuous numeric input games, using `<input type="text" inputMode="numeric">` combined with explicit bounds checking and digit regex matching (`/^[0-9]+$/`) in the `onChange` handler provides a smoother experience than `type="number"`, as it avoids spin buttons and simplifies validation.
**Action:** Use `type="text"` with `inputMode="numeric"` for rapid number input games and manually enforce length and character restrictions in the event handler.

## 2024-11-20 - Global Keydown Listeners Stale Closures
**Learning:** When attaching a global `window.addEventListener('keydown', callback)` inside a `useEffect` with an empty dependency array to prevent multiple registrations, the `callback` often accesses stale React state (like `gameState` or `score`) because it closes over the initial render variables.
**Action:** To reliably access the latest state in global event listeners without constantly removing/re-adding the listener (which can lose events), store the latest function reference in a `useRef` (e.g., `const callbackRef = useRef(callback)`) that updates on every dependency change, and then simply invoke `callbackRef.current(e)` inside the stable event listener.
## 2024-11-20 - Fast Timer Rendering
**Learning:** Rendering a timer down to milliseconds using `setInterval` that triggers a React state update ~60 times a second can cause performance overhead by constantly re-rendering the entire component.
**Action:** For highly precise sub-second timers, prefer using `requestAnimationFrame` attached directly to a DOM ref to avoid frequent, expensive React render cycles.
## 2024-05-01 - [CPS Test Pointer Events]
**Learning:** When building rapid-click games, using `onPointerDown` instead of `onClick` avoids mobile touch delay and prevents double-firing on hybrid devices if `e.preventDefault()` is used.
**Action:** Use `onPointerDown={(e) => { e.preventDefault(); handleAction(); }}` for primary interactions in future arcade games requiring high input frequency.

## 2024-08-25 - Node.js patch scripts and ES modules
**Learning:** When writing temporary Node.js patch scripts that use `require()` in a repository with `"type": "module"` defined in its `package.json`, it throws a runtime error.
**Action:** Use the `.cjs` file extension (e.g., `patch.cjs`) instead of `.js` to ensure it runs correctly as a CommonJS script.
## 2024-05-19 - Number Memory Shrink-0
**Learning:** In flex containers that may overflow and scroll (like the game over screen in Number Memory), using `shrink-0` on critical UI elements (like headers, stats, and buttons) ensures they are not squished if the viewport height is very small. Additionally, using `overflow-y-auto` with appropriate padding provides a robust layout for long content on mobile devices.
**Action:** Always consider flex shrinking behavior for vertically stacked result screens on smaller screens and apply `shrink-0` along with scrollable containers where appropriate.
