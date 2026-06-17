## 2024-05-24 - Array over Map for Dense IDs
**Learning:** For dense integer IDs, allocating an array dynamically sized by the maximum ID is extremely fast in Javascript and effectively works as O(1) indexing, whereas maps have more overhead.
**Action:** When repeatedly looking up counts by integer ID where max ID is relatively small, use an array constructed up to maxId + 1. Ensure sizing to the maximum ID instead of array length to prevent out of bounds when entities are added dynamically (monotonically increasing IDs).
## 2026-06-15 - Circuit Evaluation O(N) Array Filter Bottleneck
**Learning:** `CircuitMaker.jsx`'s `evaluateCircuit` simulation loop ran 8 inner passes, each calling an `orderedInputs` helper that performed an $O(W)$ array `filter` on all wires *per component*. This $O(C \times W)$ complexity per tick caused massive frame drops and freezing for even moderately complex user circuits.
**Action:** When running tight simulation loops over relational state (like components and wires), always pre-compute relationships into $O(1)$ lookup maps (e.g. `Map<ToId, Array<FromId>>`) outside the inner loop to convert $O(C \times W)$ complexity to $O(C + W)$.
## 2026-06-17 - Prevent list item re-renders with React.memo
**Learning:** In frequently updating list components like Lobby (using `onSnapshot`) or ActivityFeed (updating on profile changes), rendering components without `React.memo` causes unnecessary re-renders of the entire list whenever a single item changes.
**Action:** Wrap individual list item components (like `ActivityRow` and `MatchCard`) in `React.memo()` to perform a shallow comparison of props and prevent re-rendering when parent state changes don't affect them.
## 2024-06-17 - Optimize Component Lookups in CircuitMaker
**Learning:** O(N) array lookups (`Array.find`) inside another loop mapping over arrays (like wires) create an O(N*M) bottleneck during React renders, which is extremely expensive for SVG drawing in things like circuit makers or graphs.
**Action:** Extract the inner lookup loop by creating a pre-computed `Map` keyed by ID, bringing the inner complexity to O(1) and overall complexity to O(M).
## 2024-06-17 - Optimize Array Iteration in Actions

**Learning:** Iterating through a large array multiple times for independent aggregations (like finding the maximum value and calculating a running total) is computationally expensive and scales poorly with array size.
**Action:** When computing multiple derived statistics or validations from a single collection of data (such as game moves), merge the operations into a single pass or loop to minimize loop overhead and redundant property access.
