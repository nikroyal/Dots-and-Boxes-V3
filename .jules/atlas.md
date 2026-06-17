## 2024-06-17 - Pure State Updaters
**Learning:** Avoid placing side effects (like localStorage modifications) inside React state setter callbacks. This violates function purity and can cause issues in React Strict Mode or testing.
**Action:** Handle side effects inside useEffect or explicit event handlers, and keep state setter callbacks pure.
