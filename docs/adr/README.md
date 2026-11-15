# Architecture decision records

Short records of the decisions that shape KinKeep: the context, the choice, and what it costs.
New decisions get the next number; a reversed decision is marked _Superseded_, not deleted.

| #                                          | Decision                                                  | Status   |
| ------------------------------------------ | --------------------------------------------------------- | -------- |
| [0001](0001-server-only-firestore.md)      | Firestore is reached only from the server                 | Accepted |
| [0002](0002-claim-then-send-reminders.md)  | The reminder engine claims a stage before it sends        | Accepted |
| [0003](0003-passcodes-with-pepper.md)      | Passcodes: HMAC pepper, scrypt, lockout in a transaction  | Accepted |
| [0004](0004-ai-drafts-with-fallback.md)    | AI drafts the visit brief; a non-AI brief is the fallback | Accepted |
| [0005](0005-pure-domain-and-store-seam.md) | Pure domain logic and one storage seam                    | Accepted |
