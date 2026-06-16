## 2026-06-15 - ARIA Labels on Icon-only Buttons
**Learning:** React elements with empty child text like `<button><Icon /></button>` are inaccessible to screen readers without an `aria-label` attribute.
**Action:** Always ensure any icon-only interactive elements in this app include descriptive `aria-label`s.
