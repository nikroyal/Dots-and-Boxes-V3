## 2024-11-20 - crypto.getRandomValues Floating Point Precision Issue
**Learning:** Using division (`/ 4294967296`) to normalize `crypto.getRandomValues(new Uint32Array(1))[0]` leads to float precision issues and violates secure coding practices for bounded randomness.
**Action:** Always use modulo arithmetic (e.g. `% 1000 / 1000`) instead of float division to bound randomness.

## 2024-11-20 - Unsafe Array Length Checks
**Learning:** Destructuring or defaulting arrays using `(obj.array || []).length` is dangerous when the field might contain legacy data types like numbers instead of arrays.
**Action:** Use `Array.isArray(obj.array) ? obj.array : []` to guarantee safe array iteration and length checks.
