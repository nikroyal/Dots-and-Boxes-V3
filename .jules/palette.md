## 2026-06-15 - ARIA Labels on Icon-only Buttons
**Learning:** React elements with empty child text like `<button><Icon /></button>` are inaccessible to screen readers without an `aria-label` attribute.
**Action:** Always ensure any icon-only interactive elements in this app include descriptive `aria-label`s.
## 2026-06-18 - Accessible Progress Bars
**Learning:** Visual progress bars implemented via background divs without semantic elements are completely invisible to screen readers. They need explicit ARIA roles and value attributes.
**Action:** When creating custom progress indicators (like ELO or achievement bars), always add `role="progressbar"` along with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to provide accurate context to assistive technologies.
