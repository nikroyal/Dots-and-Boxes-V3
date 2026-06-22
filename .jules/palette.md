## 2026-06-15 - ARIA Labels on Icon-only Buttons
**Learning:** React elements with empty child text like '<button><Icon /></button>' are inaccessible to screen readers without an 'aria-label' attribute.
**Action:** Always ensure any icon-only interactive elements in this app include descriptive 'aria-label's.

## 2026-06-25 - ARIA Roles in React Modals
**Learning:** Custom modal components built with absolute positioning and overlay backgrounds (like those in District Exchange) lack intrinsic accessibility properties. Screen readers cannot properly identify them as dialogs or announce their titles unless explicitly defined with 'role="dialog"', 'aria-modal="true"', and 'aria-labelledby'.
**Action:** Always add proper ARIA dialog semantics and associate inputs with explicit 'id'/'htmlFor' attributes when building custom dialogs and complex forms in React.

## 2024-05-19 - Added ARIA Progress Bar properties
**Learning:** React component '<div role="progressbar">' elements require 'aria-valuenow', 'aria-valuemin', and 'aria-valuemax' to be accessible.
**Action:** When creating custom progress bars or loaders mapped to a specific max value or range, apply ARIA attributes dynamically to match state values.

## 2024-05-19 - ARIA Labels on Directional Symbols
**Learning:** Buttons containing only directional symbols (like ↑, ←, ↓, →) are announced by screen readers by their literal symbol names (e.g., "Upwards arrow"), which doesn't convey the action context well.
**Action:** Always include descriptive `aria-label`s (like "Move Up") on mobile control buttons that use symbolic text so screen readers announce them as clear actions.
