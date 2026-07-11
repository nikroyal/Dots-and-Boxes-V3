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
## 2024-07-12 - Rapid Input Arcade Games Validation
**Learning:** For continuous, rapid-fire input-based games where answers can be typed sequentially without pressing Enter, validating the input directly inside the `onChange` handler and clearing the state immediately on a correct answer provides an excellent user experience.
**Action:** Use auto-submit/auto-clear patterns in `onChange` handlers for fast-paced text input games, and validate input aggressively (e.g. `!/^-?\d*$/.test(val)`) to prevent entering incorrect characters that could break parsing logic.
