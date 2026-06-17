## 2024-05-24 - Array over Map for Dense IDs
**Learning:** For dense integer IDs, allocating an array dynamically sized by the maximum ID is extremely fast in Javascript and effectively works as O(1) indexing, whereas maps have more overhead.
**Action:** When repeatedly looking up counts by integer ID where max ID is relatively small, use an array constructed up to maxId + 1. Ensure sizing to the maximum ID instead of array length to prevent out of bounds when entities are added dynamically (monotonically increasing IDs).
