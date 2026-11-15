# 0003. Passcodes: HMAC pepper, scrypt, lockout in a transaction

**Status:** Accepted

## Context

The brief asks for passcode-based access. A six-digit code has only a million values, so the
storage and the guessing limits carry the security.

## Decision

- Store `scrypt(HMAC-SHA256(pepper, passcode), salt)` with a per-member salt. The pepper lives in
  Secret Manager, so a database leak alone is not enough to brute-force the codes.
- Compare in constant time.
- Count a try inside a transaction before checking it; five wrong tries lock that member for
  15 minutes. Parallel guesses cannot outrun the lock.
- Sessions are signed HttpOnly, SameSite=Lax cookies (Secure on HTTPS) lasting 12 hours.

## Consequences

- Stated honestly in the README: a six-digit code is a convenience suited to the brief, not
  strong authentication.
- Someone who knows a circle code can lock a member out for 15 minutes; one-tap email links
  keep working during a lockout.
