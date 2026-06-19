## 2024-11-20 - Reaction Timer
**Learning:** React state changes should be scheduled properly for precision games, using `performance.now()` offers significantly better accuracy than `Date.now()` for measuring raw milliseconds. Also, React's `useRef` for timeouts prevents side effects when components unmount.
**Action:** Use `performance.now()` to record high-resolution timestamps, and always clear timers in `useEffect` cleanup.## 2024-05-15 - React Interval Timer Side-Effects
**Learning:** Side-effects (like ending a game and saving scores) should not be triggered directly inside a `setInterval`'s functional state updater (e.g., `setTimeLeft(prev => { if (prev <= 1) endGame(); ... })`). This is a React anti-pattern because updaters must be pure, and Strict Mode will call them twice, causing double executions of side effects like sound playback.
**Action:** Always keep interval updaters pure (e.g., `setTimeLeft(prev => Math.max(0, prev - 1))`) and handle the resulting side-effects in a separate `useEffect` that listens for the state reaching its terminal condition (e.g., `useEffect(() => { if (timeLeft === 0) endGame() }, [timeLeft])`).
## 2024-06-19 - Strict dependency boundary
**Learning:** Do not install dependencies like `@playwright/test` for temporary Playwright verification scripts, as this modifies `package.json` and violates negative constraints. Use Node.js built-in `require("assert")` or raw playwright assertions instead.
**Action:** Write standalone verification scripts without requiring external assertion libraries, or do not commit dependency changes.
