import test from "node:test";
import assert from "node:assert/strict";

import { openDatabase, seedDatabase } from "../src/database.js";
import { createBooking } from "../src/bookings.js";

test("simultaneous requests cannot overbook an appointment", async (t) => {
  const db = openDatabase();
  seedDatabase(db);

  t.after(() => db.close());

  const slotId = "documents-1";

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) =>
      createBooking(db, {
        slotId,
        name: `Test Resident ${index}`,
        email: `resident-${index}@example.test`
      })
    )
  );

  const successful = results.filter(
    (result) => result.status === "fulfilled"
  );

  const rejected = results.filter(
    (result) => result.status === "rejected"
  );

  assert.equal(
    successful.length,
    1,
    "Only one booking should succeed for one available place."
  );

  assert.equal(
    rejected.length,
    9,
    "All other requests should be rejected."
  );

  for (const result of rejected) {
    assert.equal(
      result.reason.status,
      409,
      "Rejected bookings should report a conflict."
    );
  }

  const bookings = db.prepare(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE slot_id = ?
  `).get(slotId);

  const slot = db.prepare(`
    SELECT remaining
    FROM slots
    WHERE id = ?
  `).get(slotId);

  assert.equal(
    bookings.count,
    1,
    "The database should contain exactly one booking."
  );

  assert.equal(
    slot.remaining,
    0,
    "Remaining capacity should be zero, not negative."
  );
});