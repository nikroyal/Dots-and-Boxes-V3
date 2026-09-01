## 2024-05-28 - Missing Pre-Validation of Friend Requests
**Vulnerability:** A user could unilaterally add themselves to any other user's `friends` array without a pending friend request, bypassing consent.
**Learning:** The previous `firestore.rules` allowed a user to arbitrarily append their UID to another user's `friends` array. Since there was no server-side proof that the target user had initiated a friend request (as the target's request was just an uncontrolled map in the receiving user's document), authorization was fundamentally flawed.
**Prevention:** Implemented an `outgoingFriendRequests` array that the sender manages. The Firestore rules now verify that the target user explicitly authorized the addition by requiring `request.auth.uid` to be present in (and subsequently removed from) the target user's `outgoingFriendRequests` list before allowing modifications to their `friends` array.
## 2024-06-18 - Fix custom random float division in avatar selection
**Vulnerability:** A custom float division (`/ 4294967296 * length`) combined with `Math.floor` was used with `crypto.getRandomValues` to generate random array indices for avatars.
**Learning:** This approach recreates a pseudo `Math.random()` leading to floating point precision issues. While low impact for avatars, it demonstrates poor cryptographic hygiene and is prone to errors.
**Prevention:** Always use standard modulo arithmetic (`crypto.getRandomValues(array)[0] % length`) or unbiased random selection algorithms when choosing a random element from an array based on cryptographic values.
## 2024-05-24 - Firestore Array Overwrite Vulnerability
**Vulnerability:** Array fields in Firestore rules (`friends`, `friendRequests`, `chat`, `spectators`) were verified using only size increment and final element checks, allowing malicious users to overwrite existing elements while appending a new one.
**Learning:** Relying solely on `changedKeys().hasOnly(...)` and size increments is insufficient for array appends, as it doesn't prevent modifying prior indices. Additionally, Firebase API keys and configuration blocks for client web apps are public identifiers, not secret credentials, and do not need to be hidden in environment variables to prevent security risks.
**Prevention:** Always explicitly enforce the retention of existing array elements using the `.hasAll()` method (e.g., `request.resource.data.friends.hasAll(resource.data.get('friends', []))`).

## 2024-10-18 - Missing Array Retention Enforcement in Rules
**Vulnerability:** When a user's action modified array fields like `friends`, `spectators`, or `chat` in Firestore, the rules only checked the array size and the appended element, allowing malicious users to overwrite existing elements as long as the size matched the increment.
**Learning:** Using `changedKeys().hasOnly(...)` and size increments is insufficient to protect the integrity of existing array data in Firestore documents.
**Prevention:** Always use `.hasAll(resource.data.get('arrayName', []))` on the `request.resource.data.arrayName` to ensure existing elements are retained during array append operations.

## 2025-02-18 - Missing array retention checks in Firestore Rules
**Vulnerability:** Attackers could overwrite elements in `friends`, `spectators`, `chat`, and request arrays while bypassing `changedKeys().hasOnly()` and size checks.
**Learning:** Relying purely on array size changes (e.g. `size() + 1`) and `affectedKeys` does not prevent a malicious user from simultaneously modifying the existing elements within that array.
**Prevention:** Use `.hasAll()` to explicitly enforce that the updated array still contains all elements of the original array (or vice versa for deletions).

## 2024-07-09 - Insecure Array Manipulation in Firestore Rules
**Vulnerability:** Array modifications (like `friends`, `spectators`, `chat`) only checked `size()` differences, allowing attackers to overwrite or delete existing elements while adding their own.
**Learning:** Relying solely on `changedKeys().hasOnly(...)` and size increments is insufficient for array appends. It allows arbitrary replacement of existing array contents as long as the final size is exactly one element larger.
**Prevention:** Always use `.hasAll(resource.data.get('arrayField', []))` to enforce that all previously existing elements are retained when an array is modified, preventing unauthorized data deletion or manipulation.

## 2024-07-09 - [Array Retention Enforcement in Firestore]
**Vulnerability:** [Relying only on `size()` changes or `.hasAll()` for arrays allows arbitrary modification or duplication of existing array elements.]
**Learning:** [Array fields require explicitly enforcing retention using both `.hasAll()` and `.removeAll()` to avoid data tampering, element duplication, or overwriting existing entries.]
**Prevention:** [Always check for array modifications using both `.hasAll()` and `.removeAll()` to ensure exact element addition or removal without duplication.]
## 2024-07-10 - Secure Firestore Array Appends
**Vulnerability:** Array appends in Firestore rules for friends, spectators, and chat only checked size increment + last element, allowing manipulation/deletion of existing elements.
**Learning:** Using `size() == size() + 1` is not sufficient to prevent unauthorized manipulation of other array elements by malicious users.
**Prevention:** Always explicitly use `.hasAll()` to enforce retention of existing array elements when modeling array appends.

## 2024-06-25 - Missing Array Enforcement (hasAll) on size increments
**Vulnerability:** A user could maliciously overwrite array fields in Firestore (like `friends`, `spectators`, or `chat`) by passing a completely modified array that merely satisfies the size constraint (e.g., `newSize = oldSize + 1`) and the required element addition.
**Learning:** In Firestore rules, validating `size()` and checking for the presence/absence of a specific element is insufficient to prevent users from manipulating the rest of the array elements.
**Prevention:** Always enforce strict retention of existing array elements during updates by chaining `.hasAll()` methods (e.g., `request.resource.data.arrayField.hasAll(resource.data.arrayField)` when adding, or reversed when removing).
## 2024-05-30 - Missing array data retention validation
**Vulnerability:** Array properties like `friends`, `chat`, and `spectators` could have arbitrary elements replaced when items were added/removed if `.hasAll()` is not checked.
**Learning:** `changedKeys().hasOnly()` and size validations are insufficient to prevent array element overwrite and data loss/manipulation by malicious actors.
**Prevention:** Always enforce `.hasAll(resource.data.get('arrayField', []))` when allowing clients to add elements to an array, and ensure `resource.data.arrayField.hasAll(request.resource.data.arrayField)` when clients remove elements.
## 2024-06-25 - Missing Array Integrity Validation in Firestore Rules
**Vulnerability:** Array modifications (friends, friendRequests, match spectators, chat) only validated size changes and the added/removed element, allowing users to potentially overwrite other elements in the array.
**Learning:** In Firestore rules, checking `changedKeys().hasOnly(['arrayField'])`, `size()`, and the newly added/removed element is insufficient to prevent tampering with other existing elements.
**Prevention:** Always use `.hasAll()` to explicitly enforce the retention of existing array elements during updates (e.g., `request.resource.data.arrayField.hasAll(resource.data.arrayField)`).
## 2024-07-14 - Array Field Overwrite Vulnerability
**Vulnerability:** Array modifications in Firestore rules (like `friends`, `spectators`, `chat`) checked size differences (`size() == size() + 1`) but failed to enforce retention of existing elements via `.hasAll()`.
**Learning:** Checking only array size increments allows malicious users to overwrite other existing elements in the array (e.g., kicking out all other spectators and replacing the list with themselves) as long as the new size requirement is met.
**Prevention:** Always use `.hasAll()` when verifying array additions or removals to explicitly enforce that unmodified array elements are properly retained and not arbitrarily overwritten.
## 2025-02-21 - Fix missing protection for core fields in Direct Message rules
**Vulnerability:** In `firestore.rules`, the `match /conversations/{convId}` rule allowed any participant to update the conversation document without restricting which fields could be updated. This meant a legitimate participant could maliciously alter the `participants` array, the `requestedBy` field, or the `createdAt` timestamp.
**Learning:** Even when restricting document updates to authorized users (participants), the allowed updates must be strictly bounded. Allowing unrestrained updates on a document lets attackers bypass application logic (like replacing the entire participants list) or alter metadata used for security decisions.
**Prevention:** Always restrict update payloads using `changedKeys().hasAny()` or `changedKeys().hasOnly()` to ensure that immutable core structural fields (like owners, IDs, or participants lists) cannot be modified through regular update flows.
## 2024-05-18 - XSS Risk with sandbox="allow-scripts allow-same-origin"
**Vulnerability:** The iframe for Paper.io had an XSS vulnerability due to lack of a sandbox. My initial fix added `allow-scripts allow-same-origin`, but this allows a dedicated malicious script to remove the sandbox entirely or freely access the parent document.
**Learning:** When securing iframes, avoid combining `allow-scripts` and `allow-same-origin` in the `sandbox` attribute for same-origin or `srcDoc` iframes.
**Prevention:** Only use `sandbox="allow-scripts"` for iframes that need scripts but shouldn't access the parent document.
## 2024-10-24 - Client-Authoritative Stats (Architecture Flaw)
**Vulnerability:** Users can arbitrarily modify their own `elo`, `wins`, `losses`, and other stats directly via Firestore client writes.
**Learning:** The app's architecture uses client-side transactions to compute and update game results (`finalizeStats`). Securing these fields in Firestore rules (`protectedUserKeysChanged`) would break the app's core functionality since there is no backend game server to securely handle these writes.
**Prevention:** Game logic and state resolution must be moved to a trusted backend environment (e.g., Firebase Cloud Functions or a dedicated Node server) before enforcing strict field-level restrictions on player stats in Firestore rules.
## 2024-10-24 - Over-permissive match updates (Insecure Direct Object Reference)
**Vulnerability:** The Firestore rule for `matches` allows any player involved in the match (`isPlayer()`) to perform arbitrary updates to the match document without restriction on `changedKeys()`. A malicious player can manipulate the game state, scores, or mark themselves as the winner.
**Learning:** `allow update: if isAdmin() || isPlayer() ...` lacks field-level constraints for `isPlayer()`. A player should only be able to update specific fields related to gameplay (like `game`, `status`, `winner`, `chat`, etc) and not arbitrarily modify other players' data or game settings in ways that break the game rules. Wait, since game logic is evaluated client-side, the client has to be able to write the entire `game` object. However, players shouldn't be able to alter `players`, `createdAt`, `playerInfo`, etc.
**Prevention:** Add field-specific restrictions or a check like `!changedKeys().hasAny(['players', 'createdAt'])` within the `isPlayer()` rule or `update` block for matches.
## 2026-09-01 - Email Enumeration via Public Lookup Docs
**Vulnerability:** The `usernames/{username}` collection used for login lookup had `allow read: if true;`, allowing any unauthenticated user to list all documents and dump users' emails.
**Learning:** In Firestore, `allow read` encompasses both `get` (single document fetch) and `list` (querying multiple documents). If a document is only meant for point-lookups (like translating a username to an email for auth), `allow list` should be explicitly forbidden.
**Prevention:** Change `allow read: if true;` to `allow get: if true;` for lookup documents to prevent mass enumeration of sensitive data while preserving necessary application functionality.
