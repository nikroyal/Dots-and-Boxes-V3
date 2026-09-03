## 2024-02-23 - SVG Board Re-render Bottleneck on Ticker Updates
**Learning:** The `Match` components (`Match.jsx`, `MatchConnect4.jsx`, `MatchTicTacToe.jsx`, `MatchChess.jsx`) use a 1-second `setInterval` to update a `now` state variable that drives the visual turn timer. Because this state is at the root of the match component, it causes full re-renders every second, including the heavy, SVG-dense `Board` component.
**Action:** Always wrap complex, pure visualization components like `Board` and `ConcealedBoard` in `React.memo` and ensure callback props like `handleMove` are stabilized using `useCallback` when they are placed under a component with a frequently ticking state (like a clock or timer).
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

## 2026-06-18 - O(1) Component Lookups in CircuitMaker
**Learning:** Reconstructing a Map inside a React render loop to optimize lookups is an anti-pattern. Building a Map takes O(N) time and creates memory churn on every render cycle, degrading performance.
**Action:** Always wrap performance-oriented Map generation from arrays in `useMemo()` to ensure the O(N) cost is only incurred when the underlying array dependency changes.
## 2026-06-18 - Nested `Array.find` within Multiple Loops
**Learning:** React components containing multiple functions which loop over all players using `.find` per cell rendered results in a complexity of O(C * P) per property lookup. Using it twice across rendering the board means iterating O(2 * C * P) each render. This gets progressively worse as the board scale or number of players grow.
**Action:** Lift static maps up and leverage `useMemo` to convert properties into a O(1) indexed `Map` (`Map<PropertyId, Player>`). Then utilize `.get` on that memoized map for efficient resolution throughout child components.
## 2024-11-20 - O(1) Map lookups in render loops
**Learning:** Using `Array.find()` inside a `.map()` render loop creates an O(N²) time complexity bottleneck which blocks the main thread during renders, especially for large arrays like chat history. While replacing it with a Map lookup (`Map.get()`) makes it O(1), recreating the Map from the array on every render cycle introduces unnecessary O(N) computational overhead and memory allocation churn, which can degrade performance rather than improve it.
**Action:** Always memoize the Map creation (e.g., using `useMemo`) so the O(N) map generation cost is only paid when the underlying array changes, ensuring true O(1) lookup performance in the render loop.
## 2026-06-26 - O(1) Map Lookups In Render Loops
**Learning:** Re-computing a map structure like `new Map(array)` directly inside a React component render block will incur an O(N) cost and create new references every render. This completely defeats the performance benefits of transitioning from `Array.find()` to `Map.get()`.
**Action:** When migrating O(N) repeated array iterations inside a component down to O(1) indexing, always wrap the map instantiation in a `useMemo(() => new Map(...), [dependencies])` so the structure is built strictly only when its dependencies update.
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

## 2024-06-17 - O(1) Component Lookups in CircuitMaker
**Learning:** Reconstructing a Map inside a React render loop to optimize lookups is an anti-pattern. Building a Map takes O(N) time and creates memory churn on every render cycle, degrading performance.
**Action:** Always wrap performance-oriented Map generation from arrays in `useMemo()` to ensure the O(N) cost is only incurred when the underlying array dependency changes.
## 2026-06-18 - Nested `Array.find` within Multiple Loops
**Learning:** React components containing multiple functions which loop over all players using `.find` per cell rendered results in a complexity of O(C * P) per property lookup. Using it twice across rendering the board means iterating O(2 * C * P) each render. This gets progressively worse as the board scale or number of players grow.
**Action:** Lift static maps up and leverage `useMemo` to convert properties into a O(1) indexed `Map` (`Map<PropertyId, Player>`). Then utilize `.get` on that memoized map for efficient resolution throughout child components.
## 2024-11-20 - O(1) Map lookups in render loops
**Learning:** Using `Array.find()` inside a `.map()` render loop creates an O(N²) time complexity bottleneck which blocks the main thread during renders, especially for large arrays like chat history. While replacing it with a Map lookup (`Map.get()`) makes it O(1), recreating the Map from the array on every render cycle introduces unnecessary O(N) computational overhead and memory allocation churn, which can degrade performance rather than improve it.
**Action:** Always memoize the Map creation (e.g., using `useMemo`) so the O(N) map generation cost is only paid when the underlying array changes, ensuring true O(1) lookup performance in the render loop.
## 2024-06-25 - Replace Array.find for Static Configuration Lookups
**Learning:** Calling `Array.find()` repeatedly within render functions to look up metadata from static configuration arrays (like `ACHIEVEMENTS`) introduces O(N) overhead in hot paths without memoization benefits.
**Action:** Pre-compute a module-level `Map` for static configuration arrays (like `ACHIEVEMENTS`) and expose an O(1) getter function (like `getAchievementById`) to eliminate repetitive loop overhead in component renders.
## 2025-02-23 - Pre-computing Maps for static lookups
**Learning:** O(N) array scans (`Array.find()`) over static config data (like `EXPERIENCE_CATALOG`) during component renders can accumulate to unnecessary overhead.
**Action:** When data structures like catalogs are statically defined, pre-compute a `Map` keyed by their ID at the module level. This exposes an O(1) getter to the rest of the application and completely bypasses the need to iterate or use `useMemo` at the component layer.
## 2024-05-24 - Memoize expensive child components on timer ticks
**Learning:** In Match pages, a 1-second ticker state (`now`) drives the turn timer, causing the entire page to re-render every second. When expensive child components (like a Chessboard) are not memoized or receive inline objects/styles as props, they re-render on every clock tick, causing severe performance bottlenecks.
**Action:** Wrap expensive child components in `React.memo` and ensure all derived objects (like custom styles) are extracted as static constants or memoized via `useMemo` so they maintain referential equality across timer ticks.

## 2024-07-11 - Match timer triggering heavy re-renders
**Learning:** The `MatchChess.jsx` uses a 1-second interval (`now`) that updates a state triggering component re-renders to show the remaining timer. This caused the heavy `<Chessboard>` component to re-render every second because its `customSquareStyles` prop was defined as an inline un-memoized object, failing the shallow equality check.
**Action:** When a parent component uses a high-frequency ticker state (like `now`), always wrap heavy child components in `React.memo`, pass them static or memoized reference props, and extract inline style configurations to module-level constants or `useMemo`.
## 2024-05-18 - Memoize third party components rendered in ticker loops
**Learning:** In the Match pages (e.g. `MatchChess.jsx`), the top-level component maintains a 1-second ticker state (`now`) to drive the turn timer display. This causes the entire page to re-render every second. If heavy third-party components (like `<Chessboard>`) are rendered in this tree without `React.memo` and stable props (like style objects), they will also re-render every second, causing significant CPU overhead and jitter during matches.
**Action:** When working in these Match components, always ensure expensive child components are wrapped in `React.memo`, pass stable callbacks (via `useCallback`), and explicitly memoize any derived object/array props (via `useMemo`) or extract static props as module-level constants.
## 2024-05-19 - [Memoizing Chessboard for 1Hz Ticker]
**Learning:** The heavy Chessboard component re-rendered every second during matches due to inline object props and a 1Hz clock ticker state update in the parent. Module-level style constants and Memoization of both the component and object props prevent these massive CPU spikes.
**Action:** Always extract static style objects to module-level constants, wrap heavy child components in React.memo, and useMemo for derived object props in components containing high-frequency timers.
## 2024-05-20 - Prevent 1-second re-renders on expensive Match components
**Learning:** In the `Match` family of components (`Match.jsx`, `MatchConnect4.jsx`, `MatchTicTacToe.jsx`, `MatchChess.jsx`), a 1-second ticker state (`now`) drives the turn timer UI. Any expensive child component (like `Board` or `<Chessboard>`) rendered within these match pages that does not depend on `now` will unnecessarily re-render every single second, creating a severe performance bottleneck.
**Action:** Always wrap expensive child components (like `Board` or `<Chessboard>`) inside match pages in `React.memo()`. Crucially, ensure all object/array props passed to it are either hoisted statically outside the component or explicitly memoized using `useMemo()` to guarantee referential stability across the ticker's render cycles.

## 2024-05-19 - Fast Sets for Grid Iteration
**Learning:** In rapid-action games like Whack-A-Mole, doing nested N*M loops during grid render (like using `Array.some` inside a grid mapping loop) can be a source of re-render slowness. Using `useMemo` to convert array checks into O(1) Set lookups prevents unnecessary performance hits.
**Action:** Always pre-compute Hash Maps or Sets when mapping over grids that require checking inclusion inside an array state for every cell.
## 2024-09-03 - O(N^3) Bottleneck from Array lookups in nested .map loops
**Learning:** Calling `array.some()` inside nested row/column `.map()` loops during rendering creates a massive O(N^3) bottleneck. This specifically happened in grid-based games like Battleships with `hoveredCells.some(...)`.
**Action:** Precompute a `Set` of stringified coordinate keys (e.g., `${r},${c}`) using `useMemo` at the top level of the component. This converts the O(N) array lookup inside the loops into an O(1) Set lookup, significantly improving render performance.
