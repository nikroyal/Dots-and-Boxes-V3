## 2024-05-24 - Array over Map for Dense IDs
**Learning:** For dense integer IDs, allocating an array dynamically sized by the maximum ID is extremely fast in Javascript and effectively works as O(1) indexing, whereas maps have more overhead.
**Action:** When repeatedly looking up counts by integer ID where max ID is relatively small, use an array constructed up to maxId + 1. Ensure sizing to the maximum ID instead of array length to prevent out of bounds when entities are added dynamically (monotonically increasing IDs).
## 2026-06-15 - Circuit Evaluation O(N) Array Filter Bottleneck
**Learning:** `CircuitMaker.jsx`'s `evaluateCircuit` simulation loop ran 8 inner passes, each calling an `orderedInputs` helper that performed an $O(W)$ array `filter` on all wires *per component*. This $O(C \times W)$ complexity per tick caused massive frame drops and freezing for even moderately complex user circuits.
**Action:** When running tight simulation loops over relational state (like components and wires), always pre-compute relationships into $O(1)$ lookup maps (e.g. `Map<ToId, Array<FromId>>`) outside the inner loop to convert $O(C \times W)$ complexity to $O(C + W)$.
## 2026-06-17 - Prevent list item re-renders with React.memo
**Learning:** In frequently updating list components like Lobby (using `onSnapshot`) or ActivityFeed (updating on profile changes), rendering components without `React.memo` causes unnecessary re-renders of the entire list whenever a single item changes.
**Action:** Wrap individual list item components (like `ActivityRow` and `MatchCard`) in `React.memo()` to perform a shallow comparison of props and prevent re-rendering when parent state changes don't affect them.
## 2024-06-17 - Optimize Match Settlement Batching
**Learning:** Hardcoding an arbitrary `limit(20)` query restrictor to avoid Firestore batch limits leads to silent data-loss / missing entity settlements when the dataset grows over the limit (like a user having >20 active games).
**Action:** Remove arbitrary DB-level limits. Instead, fetch the full data necessary, run filtering cleanly, and structure the operations into an array of chunks capped by the database's strict limit (`BATCH_SIZE = 500`). Use `Promise.all` to concurrently commit those chunks.
## 2024-06-17 - Optimize Component Lookups in CircuitMaker
**Learning:** O(N) array lookups (`Array.find`) inside another loop mapping over arrays (like wires) create an O(N*M) bottleneck during React renders, which is extremely expensive for SVG drawing in things like circuit makers or graphs.
**Action:** Extract the inner lookup loop by creating a pre-computed `Map` keyed by ID, bringing the inner complexity to O(1) and overall complexity to O(M).
## 2024-06-17 - Optimize Array Iteration in Actions

**Learning:** Iterating through a large array multiple times for independent aggregations (like finding the maximum value and calculating a running total) is computationally expensive and scales poorly with array size.
**Action:** When computing multiple derived statistics or validations from a single collection of data (such as game moves), merge the operations into a single pass or loop to minimize loop overhead and redundant property access.

## $(date +%Y-%m-%d) - O(1) Component Lookups in CircuitMaker
**Learning:** Reconstructing a Map inside a React render loop to optimize lookups is an anti-pattern. Building a Map takes O(N) time and creates memory churn on every render cycle, degrading performance.
**Action:** Always wrap performance-oriented Map generation from arrays in `useMemo()` to ensure the O(N) cost is only incurred when the underlying array dependency changes.
## 2026-06-18 - Nested `Array.find` within Multiple Loops
**Learning:** React components containing multiple functions which loop over all players using `.find` per cell rendered results in a complexity of O(C * P) per property lookup. Using it twice across rendering the board means iterating O(2 * C * P) each render. This gets progressively worse as the board scale or number of players grow.
**Action:** Lift static maps up and leverage `useMemo` to convert properties into a O(1) indexed `Map` (`Map<PropertyId, Player>`). Then utilize `.get` on that memoized map for efficient resolution throughout child components.
## 2024-11-20 - O(1) Map lookups in render loops
**Learning:** Using `Array.find()` inside a `.map()` render loop creates an O(N²) time complexity bottleneck which blocks the main thread during renders, especially for large arrays like chat history. While replacing it with a Map lookup (`Map.get()`) makes it O(1), recreating the Map from the array on every render cycle introduces unnecessary O(N) computational overhead and memory allocation churn, which can degrade performance rather than improve it.
**Action:** Always memoize the Map creation (e.g., using `useMemo`) so the O(N) map generation cost is only paid when the underlying array changes, ensuring true O(1) lookup performance in the render loop.
## 2025-02-23 - Optimize Array Search in Render Paths
**Learning:** Found multiple files using `ACHIEVEMENTS.find(x => x.id === id)` inside render paths and list loops. While small arrays don't break applications immediately, performing an O(N) linear search per item in a list creates unnecessary overhead and main thread blocking.
**Action:** Replace `Array.find` lookups with a precomputed Map (`new Map()`) for O(1) performance in cases where the collection size is fixed or changes rarely.
