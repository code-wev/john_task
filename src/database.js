import { DatabaseSync } from "node:sqlite";

export function openDatabase(filename = ":memory:") {
  const db = new DatabaseSync(filename);

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES services(id),
      starts_at TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      remaining INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES slots(id),
      resident_name TEXT NOT NULL,
      resident_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS bookings_slot_idx
      ON bookings(slot_id);
  `);

  return db;
}

export function seedDatabase(db) {
  const existing = db.prepare(`
    SELECT COUNT(*) AS count FROM services
  `).get();

  if (existing.count > 0) return;

  const services = [
    ["documents", "Document collection"],
    ["permits", "Permit consultation"],
    ["general", "General inquiry"]
  ];

  const insertService = db.prepare(`
    INSERT INTO services (id, name)
    VALUES (?, ?)
  `);

  const insertSlot = db.prepare(`
    INSERT INTO slots (
      id, service_id, starts_at, capacity, remaining
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");

  try {
    for (const [id, name] of services) {
      insertService.run(id, name);

      for (let index = 1; index <= 3; index += 1) {
        const startsAt = new Date();
        startsAt.setUTCDate(startsAt.getUTCDate() + index);
        startsAt.setUTCHours(9, 0, 0, 0);

        const capacity = index === 1 ? 1 : 3;

        insertSlot.run(
          `${id}-${index}`,
          id,
          startsAt.toISOString(),
          capacity,
          capacity
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}