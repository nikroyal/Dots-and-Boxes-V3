## 2026-06-15 - Circuit Evaluation O(N) Array Filter Bottleneck
**Learning:** `CircuitMaker.jsx`'s `evaluateCircuit` simulation loop ran 8 inner passes, each calling an `orderedInputs` helper that performed an $O(W)$ array `filter` on all wires *per component*. This $O(C \times W)$ complexity per tick caused massive frame drops and freezing for even moderately complex user circuits.
**Action:** When running tight simulation loops over relational state (like components and wires), always pre-compute relationships into $O(1)$ lookup maps (e.g. `Map<ToId, Array<FromId>>`) outside the inner loop to convert $O(C \times W)$ complexity to $O(C + W)$.
## 2026-06-17 - Prevent list item re-renders with React.memo
**Learning:** In frequently updating list components like Lobby (using `onSnapshot`) or ActivityFeed (updating on profile changes), rendering components without `React.memo` causes unnecessary re-renders of the entire list whenever a single item changes.
**Action:** Wrap individual list item components (like `ActivityRow` and `MatchCard`) in `React.memo()` to perform a shallow comparison of props and prevent re-rendering when parent state changes don't affect them.
## 2024-06-17 - Optimize Match Settlement Batching
**Learning:** Hardcoding an arbitrary `limit(20)` query restrictor to avoid Firestore batch limits leads to silent data-loss / missing entity settlements when the dataset grows over the limit (like a user having >20 active games).
**Action:** Remove arbitrary DB-level limits. Instead, fetch the full data necessary, run filtering cleanly, and structure the operations into an array of chunks capped by the database's strict limit (`BATCH_SIZE = 500`). Use `Promise.all` to concurrently commit those chunks.
