## 2026-06-15 - ARIA Labels on Icon-only Buttons
**Learning:** React elements with empty child text like '<button><Icon /></button>' are inaccessible to screen readers without an 'aria-label' attribute.
**Action:** Always ensure any icon-only interactive elements in this app include descriptive 'aria-label's.

## 2026-06-25 - ARIA Roles in React Modals
**Learning:** Custom modal components built with absolute positioning and overlay backgrounds (like those in District Exchange) lack intrinsic accessibility properties. Screen readers cannot properly identify them as dialogs or announce their titles unless explicitly defined with 'role="dialog"', 'aria-modal="true"', and 'aria-labelledby'.
**Action:** Always add proper ARIA dialog semantics and associate inputs with explicit 'id'/'htmlFor' attributes when building custom dialogs and complex forms in React.

## 2024-05-19 - Added ARIA Progress Bar properties
**Learning:** React component '<div role="progressbar">' elements require 'aria-valuenow', 'aria-valuemin', and 'aria-valuemax' to be accessible.
**Action:** When creating custom progress bars or loaders mapped to a specific max value or range, apply ARIA attributes dynamically to match state values.
## 2024-05-18 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Icon-only buttons (like `X`, `RefreshCcw`, arrows) frequently lack `aria-label` attributes across different components (e.g., `LocalChess.jsx`, `Snake.jsx`, `LocalDistrictExchange.jsx`).
**Action:** Always verify that interactive elements containing only visual icons have descriptive `aria-label`s.

## 2024-05-18 - Missing id and htmlFor on Form Elements
**Learning:** Form labels and inputs (e.g., in `Clubs.jsx`) often lack proper programmatic association (`id` and `htmlFor`), even when visual layout implies a connection.
**Action:** Ensure all `<label>` tags explicitly target their respective `<input>` or `<textarea>` elements using the `htmlFor` attribute matched to the input's `id`.
## 2024-05-18 - Missing id and htmlFor on Form Elements
**Learning:** Form labels and inputs (e.g., in `Clubs.jsx` for the "Public Club" checkbox) often lack proper programmatic association (`id` and `htmlFor`), even when visual layout implies a connection.
**Action:** Ensure all `<label>` tags explicitly target their respective `<input>` or `<textarea>` elements using the `htmlFor` attribute matched to the input's `id`.
\n## 2026-06-26 - Missing explicit labels in inline player setup forms
**Learning:** Compact inline forms with arrays of repeated fields (like the Player setup iteration in `LocalDistrictExchange.jsx`) often neglect accessibility associations. Elements like `<input type="color">`, text fields, or difficulty `<select>`s often lack visible `<label>` elements to save space, but they still require `aria-label` attributes to describe what the field is for screen readers. Checkboxes require explicit `id` and `htmlFor` mapping to their parent label container to ensure the entire label area correctly toggles the input programmatically.
**Action:** When iterating over dynamic lists of form inputs (especially color pickers, difficulty dropdowns, and checkboxes) where standard visible labels aren't possible, use `aria-label` to describe the input's purpose and ensure `id` and `htmlFor` are uniquely generated (e.g. using the index `i`) for elements that rely on label wrapping.
