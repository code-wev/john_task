# Solution

## Root cause

The `createBooking` function in `src/bookings.js` suffered from a
**time-of-check to time-of-use (TOCTOU) race condition**.

The original flow was:

1. **SELECT** the slot's `remaining` count.
2. **Check** whether `remaining > 0`.
3. **`await` an asynchronous eligibility call** (25 ms simulated delay).
4. **INSERT** the booking row.
5. **UPDATE** `remaining = remaining - 1`.

Steps 1–2 and 4–5 were not executed inside a transaction, and the
asynchronous gap at step 3 gave every concurrent request enough time to
read the same `remaining` value before any of them decremented it.
With ten simultaneous requests and one available place, all ten passed
the check and all ten were confirmed.

Additionally, the INSERT and UPDATE were separate, non-transactional
statements, so a failure between them would leave the database in an
inconsistent state (a booking row without a matching capacity
decrement, or vice versa).

## Fix

1. **Move the `await checkEligibility()` call before the transaction**
   so the database write-lock is held for the shortest possible time.

2. **Open a `BEGIN IMMEDIATE` transaction**, which acquires SQLite's
   reserved (write) lock immediately. Any concurrent writer is blocked
   until this transaction completes. This guarantees correctness even
   when multiple application instances share the same database file.

3. **Atomically decrement capacity with a conditional UPDATE:**

   ```sql
   UPDATE slots
   SET remaining = remaining - 1
   WHERE id = ? AND remaining > 0
   ```

   If `remaining` has already reached zero (because another request
   committed first), the `WHERE` clause prevents the update and
   `changes()` returns `0`. No extra SELECT is needed.

4. **If `changes === 0`**, roll back and return HTTP **409 Conflict**
   with the message *"This appointment is fully booked."*

5. **If `changes === 1`**, insert the booking row and **COMMIT**.
   Both the booking and the capacity change are committed atomically,
   so the database can never be left in an inconsistent state.

6. **A catch block** ensures that any unexpected error triggers a
   `ROLLBACK`, preserving consistency.

## Why this works across multiple instances

`BEGIN IMMEDIATE` serialises writers at the SQLite level through its
file-locking mechanism. Even if two separate Node.js processes attempt
to book the last place at the same instant, only one will hold the
reserved lock; the other will wait (up to `busy_timeout = 5000 ms`,
already configured in `database.js`) and then see `remaining = 0`.

## Files changed

- `src/bookings.js` — rewrote `createBooking` to use an immediate
  transaction with a conditional UPDATE.
