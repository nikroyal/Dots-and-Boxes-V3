## 2024-05-19 - Added ARIA Progress Bar properties
**Learning:** React component `<div role="progressbar">` elements require `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to be accessible.
**Action:** When creating custom progress bars or loaders mapped to a specific max value or range, apply ARIA attributes dynamically to match state values.
