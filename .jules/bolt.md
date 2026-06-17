## 2024-06-17 - Optimize Array Iteration in Actions

**Learning:** Iterating through a large array multiple times for independent aggregations (like finding the maximum value and calculating a running total) is computationally expensive and scales poorly with array size.
**Action:** When computing multiple derived statistics or validations from a single collection of data (such as game moves), merge the operations into a single pass or loop to minimize loop overhead and redundant property access.
