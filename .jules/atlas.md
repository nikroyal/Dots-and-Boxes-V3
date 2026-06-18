## 2024-06-17 - Pure State Updaters
**Learning:** Avoid placing side effects (like localStorage modifications) inside React state setter callbacks. This violates function purity and can cause issues in React Strict Mode or testing.
**Action:** Handle side effects inside useEffect or explicit event handlers, and keep state setter callbacks pure.
## 2024-10-30 - Overlay Action Buttons
**Learning:** Forcing users to rely on separate sidebar or header buttons to start/resume a game when an overlay is present creates friction and confusion.
**Action:** Always include primary action buttons (Start, Resume, Play Again) directly within the `Overlay` component where the user's attention is focused to improve first-minute comprehension and replay speed.
