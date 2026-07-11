## 2024-05-28 - Missing Pre-Validation of Friend Requests
**Vulnerability:** A user could unilaterally add themselves to any other user's `friends` array without a pending friend request, bypassing consent.
**Learning:** The previous `firestore.rules` allowed a user to arbitrarily append their UID to another user's `friends` array. Since there was no server-side proof that the target user had initiated a friend request (as the target's request was just an uncontrolled map in the receiving user's document), authorization was fundamentally flawed.
**Prevention:** Implemented an `outgoingFriendRequests` array that the sender manages. The Firestore rules now verify that the target user explicitly authorized the addition by requiring `request.auth.uid` to be present in (and subsequently removed from) the target user's `outgoingFriendRequests` list before allowing modifications to their `friends` array.
## 2024-06-18 - Fix custom random float division in avatar selection
**Vulnerability:** A custom float division (`/ 4294967296 * length`) combined with `Math.floor` was used with `crypto.getRandomValues` to generate random array indices for avatars.
**Learning:** This approach recreates a pseudo `Math.random()` leading to floating point precision issues. While low impact for avatars, it demonstrates poor cryptographic hygiene and is prone to errors.
**Prevention:** Always use standard modulo arithmetic (`crypto.getRandomValues(array)[0] % length`) or unbiased random selection algorithms when choosing a random element from an array based on cryptographic values.
## 2024-06-25 - Missing Array Enforcement (hasAll) on size increments
**Vulnerability:** A user could maliciously overwrite array fields in Firestore (like `friends`, `spectators`, or `chat`) by passing a completely modified array that merely satisfies the size constraint (e.g., `newSize = oldSize + 1`) and the required element addition.
**Learning:** In Firestore rules, validating `size()` and checking for the presence/absence of a specific element is insufficient to prevent users from manipulating the rest of the array elements.
**Prevention:** Always enforce strict retention of existing array elements during updates by chaining `.hasAll()` methods (e.g., `request.resource.data.arrayField.hasAll(resource.data.arrayField)` when adding, or reversed when removing).
