import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateInput(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new HttpError(400, "A booking object is required.");
  }

  const { slotId, name, email } = input;

  if (
    typeof slotId !== "string" ||
    !slotId ||
    slotId.length > 100
  ) {
    throw new HttpError(400, "A valid appointment is required.");
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 120
  ) {
    throw new HttpError(400, "Enter a name up to 120 characters.");
  }

  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new HttpError(400, "Enter a valid email address.");
  }

  return {
    slotId,
    name: name.trim(),
    email: email.trim().toLowerCase()
  };
}

// Represents an existing asynchronous eligibility integration.
// The real integration is outside the assessment's scope.
async function checkEligibility() {
  await delay(25);
  return true;
}

export async function createBooking(db, input) {
  const { slotId, name, email } = validateInput(input);

  // Check that the slot exists before any async work.
  const slot = db.prepare(`
    SELECT id, remaining
    FROM slots
    WHERE id = ?
  `).get(slotId);

  if (!slot) {
    throw new HttpError(404, "Appointment not found.");
  }

  // Early exit when already full (avoids unnecessary eligibility call).
  if (slot.remaining <= 0) {
    throw new HttpError(409, "This appointment is fully booked.");
  }

  // Async eligibility check runs before the transaction so the
  // database write-lock is held for the shortest possible time.
  const eligible = await checkEligibility();

  if (!eligible) {
    throw new HttpError(403, "This booking cannot be accepted.");
  }

  // BEGIN IMMEDIATE acquires a reserved lock right away, so concurrent
  // writers are serialised by SQLite even across separate processes.
  db.exec("BEGIN IMMEDIATE");

  try {
    // Atomically decrement remaining only when capacity is available.
    // If another request already claimed the last place, changes() is 0.
    const updateResult = db.prepare(`
      UPDATE slots
      SET remaining = remaining - 1
      WHERE id = ? AND remaining > 0
    `).run(slotId);

    if (updateResult.changes === 0) {
      db.exec("ROLLBACK");
      throw new HttpError(409, "This appointment is fully booked.");
    }

    const booking = {
      id: randomUUID(),
      slotId,
      createdAt: new Date().toISOString()
    };

    db.prepare(`
      INSERT INTO bookings (
        id,
        slot_id,
        resident_name,
        resident_email,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      booking.id,
      slotId,
      name,
      email,
      booking.createdAt
    );

    db.exec("COMMIT");

    return booking;
  } catch (error) {
    // Rollback only if the transaction is still active (i.e. error was
    // not the 409 we threw above, which already rolled back).
    try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
    throw error;
  }
}