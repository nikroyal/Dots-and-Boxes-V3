## 2024-11-28 - Hardcoded Firebase Config
**Vulnerability:** Hardcoded Firebase configuration values in source code (src/lib/firebase.js).
**Learning:** Found secrets directly in the source file, skipping the env variable fallback completely, putting production at risk.
**Prevention:** Use import.meta.env properties as the primary truth and only use placeholder strings for the error boundary checks.
