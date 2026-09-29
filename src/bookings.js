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

  const slot = db.prepare(`
    SELECT id, remaining
    FROM slots
    WHERE id = ?
  `).get(slotId);

  if (!slot) {
    throw new HttpError(404, "Appointment not found.");
  }

  if (slot.remaining <= 0) {
    throw new HttpError(409, "This appointment is fully booked.");
  }

  const eligible = await checkEligibility();

  if (!eligible) {
    throw new HttpError(403, "This booking cannot be accepted.");
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

  db.prepare(`
    UPDATE slots
    SET remaining = remaining - 1
    WHERE id = ?
  `).run(slotId);

  return booking;
}