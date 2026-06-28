## 2024-11-20 - crypto.getRandomValues Floating Point Precision Issue
**Learning:** Using division (`/ 4294967296`) to normalize `crypto.getRandomValues(new Uint32Array(1))[0]` leads to float precision issues and violates secure coding practices for bounded randomness.
**Action:** Always use modulo arithmetic (e.g. `% 1000 / 1000`) instead of float division to bound randomness.

## 2024-11-20 - Unsafe Array Length Checks
**Learning:** Destructuring or defaulting arrays using `(obj.array || []).length` is dangerous when the field might contain legacy data types like numbers instead of arrays.
**Action:** Use `Array.isArray(obj.array) ? obj.array : []` to guarantee safe array iteration and length checks.
## 2024-11-20 - Operator Precedence with Ternary Array Checks
**Learning:** When using ternary inline checks like `Array.isArray(arr) ? arr.length : 0` to index into an array (e.g., to find the last item `arr[... - 1]`), failing to wrap the ternary in parentheses causes operator precedence bugs (`0 - 1` evaluates first).
**Action:** Always wrap ternary expressions in parentheses when performing arithmetic on their result: `(Array.isArray(arr) ? arr.length : 0) - 1`.
## 2024-05-18 - Safe Length Validation
**Learning:** Checking length directly via `(arr || []).length` is unsafe for old schema entries that might contain legacy primitive values instead of arrays, throwing unhandled type errors on render.
**Action:** Use inline ternary checks `Array.isArray(arr) ? arr.length : 0` everywhere length properties are evaluated, particularly in mapping loops and numeric operations.
## 2024-05-18 - Hooks Execution Order & Early Returns
**Learning:** Returning early before all hooks are initialized will cause React Strict Mode evaluation mismatch, crashing components depending on hook order rules.
**Action:** Always verify all `useEffect` and `useState` initializers exist before any conditional early returns like `if (!match) return;`.
## 2024-05-18 - Side effects inside state updaters
**Learning:** Adding side-effects such as tracking logic or record keeping within React state dispatch loops (`setX(prev => {...})`) is dangerous as React may re-evaluate the updater function multiple times under strict mode.
**Action:** Extract the side effect trigger to a `useEffect` using derived properties or conditional checking to run once the desired state has successfully synced.
## 2024-05-18 - Bot AI soft locks due to lack of fallbacks
**Learning:** If specific AI modes like parity or difficulty modes evaluate to zero valid candidates, implicit returns that don't explicitly fall back to standard random selections cause soft-lock states.
**Action:** Always provide `return candidates[Math.floor(Math.random() * candidates.length)]` or an equivalent default guarantee at the bottom or else chain of an AI routine.
## 2024-05-18 - Missing preventDefault on pointer inputs
**Learning:** Native scrolling behaviors intercept user input across some touch events.
**Action:** Use `e.preventDefault()` inside specific custom UI handles like `onPointerDown` to safely stop scroll behavior overriding intended app input.
## 2024-11-20 - Unsafe array default evaluations (`|| []`)
**Learning:** Defaulting arrays inline using `obj.array || []` is dangerous because if the data contains a truthy non-array type (like a number or string from a legacy schema), operations like `.map()`, `.filter()`, or `.length` will fail and potentially crash the application.
**Action:** Use `Array.isArray(obj.array) ? obj.array : []` to guarantee type safety before array iteration or length checks.

## 2024-11-20 - Rules of Hooks violation
**Learning:** Returning early before all hooks are initialized will cause React Strict Mode evaluation mismatch, crashing components depending on hook order rules.
**Action:** Always verify all `useEffect`, `useMemo`, and `useState` initializers exist before any conditional early returns like `if (!gameState) return null;`.
