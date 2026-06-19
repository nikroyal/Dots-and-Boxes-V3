## 2026-06-15 - ARIA Labels on Icon-only Buttons
**Learning:** React elements with empty child text like `<button><Icon /></button>` are inaccessible to screen readers without an `aria-label` attribute.
**Action:** Always ensure any icon-only interactive elements in this app include descriptive `aria-label`s.
## 2026-06-25 - ARIA Roles in React Modals
**Learning:** Custom modal components built with absolute positioning and overlay backgrounds (like those in District Exchange) lack intrinsic accessibility properties. Screen readers cannot properly identify them as dialogs or announce their titles unless explicitly defined with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
**Action:** Always add proper ARIA dialog semantics and associate inputs with explicit `id`/`htmlFor` attributes when building custom dialogs and complex forms in React.
