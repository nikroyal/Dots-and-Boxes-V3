## 2024-11-20 - crypto.getRandomValues Floating Point Precision Issue
**Learning:** Using division (`/ 4294967296`) to normalize `crypto.getRandomValues(new Uint32Array(1))[0]` leads to float precision issues and violates secure coding practices for bounded randomness.
**Action:** Always use modulo arithmetic (e.g. `% 1000 / 1000`) instead of float division to bound randomness.

## 2024-11-20 - Unsafe Array Length Checks
**Learning:** Destructuring or defaulting arrays using `(obj.array || []).length` is dangerous when the field might contain legacy data types like numbers instead of arrays.
**Action:** Use `Array.isArray(obj.array) ? obj.array : []` to guarantee safe array iteration and length checks.
## 2024-11-20 - Operator Precedence with Ternary Array Checks
**Learning:** When using ternary inline checks like `Array.isArray(arr) ? arr.length : 0` to index into an array (e.g., to find the last item `arr[... - 1]`), failing to wrap the ternary in parentheses causes operator precedence bugs (`0 - 1` evaluates first).
**Action:** Always wrap ternary expressions in parentheses when performing arithmetic on their result: `(Array.isArray(arr) ? arr.length : 0) - 1`.
## 2026-06-26 - Using .find() Inside Rendering Loop
**Learning:** Using `Array.find()` inside nested maps or rendering loops without memoizing a `Map` lookup introduces an O(N) performance overhead.
**Action:** Replaced O(N) `Array.find` operations with O(1) `Map` lookups and memoized the `Map` when necessary.
