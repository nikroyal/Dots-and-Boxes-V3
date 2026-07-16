## 2024-05-28 - Missing Pre-Validation of Friend Requests
**Vulnerability:** A user could unilaterally add themselves to any other user's `friends` array without a pending friend request, bypassing consent.
**Learning:** The previous `firestore.rules` allowed a user to arbitrarily append their UID to another user's `friends` array. Since there was no server-side proof that the target user had initiated a friend request (as the target's request was just an uncontrolled map in the receiving user's document), authorization was fundamentally flawed.
**Prevention:** Implemented an `outgoingFriendRequests` array that the sender manages. The Firestore rules now verify that the target user explicitly authorized the addition by requiring `request.auth.uid` to be present in (and subsequently removed from) the target user's `outgoingFriendRequests` list before allowing modifications to their `friends` array.
## 2024-06-18 - Fix custom random float division in avatar selection
**Vulnerability:** A custom float division (`/ 4294967296 * length`) combined with `Math.floor` was used with `crypto.getRandomValues` to generate random array indices for avatars.
**Learning:** This approach recreates a pseudo `Math.random()` leading to floating point precision issues. While low impact for avatars, it demonstrates poor cryptographic hygiene and is prone to errors.
**Prevention:** Always use standard modulo arithmetic (`crypto.getRandomValues(array)[0] % length`) or unbiased random selection algorithms when choosing a random element from an array based on cryptographic values.
## 2024-06-25 - Missing Array Integrity Validation in Firestore Rules
**Vulnerability:** Array modifications (friends, friendRequests, match spectators, chat) only validated size changes and the added/removed element, allowing users to potentially overwrite other elements in the array.
**Learning:** In Firestore rules, checking `changedKeys().hasOnly(['arrayField'])`, `size()`, and the newly added/removed element is insufficient to prevent tampering with other existing elements.
**Prevention:** Always use `.hasAll()` to explicitly enforce the retention of existing array elements during updates (e.g., `request.resource.data.arrayField.hasAll(resource.data.arrayField)`).
## 2024-07-14 - Array Field Overwrite Vulnerability
**Vulnerability:** Array modifications in Firestore rules (like `friends`, `spectators`, `chat`) checked size differences (`size() == size() + 1`) but failed to enforce retention of existing elements via `.hasAll()`.
**Learning:** Checking only array size increments allows malicious users to overwrite other existing elements in the array (e.g., kicking out all other spectators and replacing the list with themselves) as long as the new size requirement is met.
**Prevention:** Always use `.hasAll()` when verifying array additions or removals to explicitly enforce that unmodified array elements are properly retained and not arbitrarily overwritten.
