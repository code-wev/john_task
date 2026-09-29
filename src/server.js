import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { openDatabase, seedDatabase } from "./database.js";
import { createBooking, HttpError } from "./bookings.js";

const pageUrl = new URL("../public/index.html", import.meta.url);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 16_384) {
      throw new HttpError(413, "Request body is too large.");
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function createApp(db) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const method = request.method;

      if (method === "GET" && url.pathname === "/") {
        const page = await readFile(pageUrl);

        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });

        response.end(page);
        return;
      }

      if (method === "GET" && url.pathname === "/api/services") {
        const services = db.prepare(`
          SELECT id, name
          FROM services
          ORDER BY name
        `).all();

        sendJson(response, 200, services);
        return;
      }

      if (method === "GET" && url.pathname === "/api/slots") {
        const serviceId = url.searchParams.get("serviceId");

        const slots = db.prepare(`
          SELECT
            id,
            service_id AS serviceId,
            starts_at AS startsAt,
            capacity,
            remaining
          FROM slots
          WHERE service_id = ?
          ORDER BY starts_at
        `).all(serviceId ?? "");

        sendJson(response, 200, slots);
        return;
      }

      if (method === "POST" && url.pathname === "/api/bookings") {
        const input = await readJson(request);
        const booking = await createBooking(db, input);

        sendJson(response, 201, booking);
        return;
      }

      // Local assessment only: this route has no authentication.
      if (
        method === "GET" &&
        url.pathname === "/api/staff/bookings"
      ) {
        const bookings = db.prepare(`
          SELECT
            b.id,
            b.resident_name AS residentName,
            b.resident_email AS residentEmail,
            b.created_at AS createdAt,
            s.starts_at AS startsAt,
            v.name AS serviceName
          FROM bookings b
          JOIN slots s ON s.id = b.slot_id
          JOIN services v ON v.id = s.service_id
          ORDER BY b.created_at DESC
          LIMIT 100
        `).all();

        sendJson(response, 200, bookings);
        return;
      }

      throw new HttpError(404, "Route not found.");
    } catch (error) {
      if (!(error instanceof HttpError)) {
        console.error(error);
      }

      sendJson(response, error.status ?? 500, {
        error: error instanceof HttpError
          ? error.message
          : "An unexpected error occurred."
      });
    }
  });
}

const isEntrypoint = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
  const db = openDatabase(
    process.env.DATABASE_PATH ?? "appointments.sqlite"
  );

  seedDatabase(db);

  const server = createApp(db);
  const port = Number(process.env.PORT ?? 3000);

  server.listen(port, "127.0.0.1", () => {
    console.log(`Local assessment server started on port ${port}.`);
    console.log("Use fictional data. Do not expose publicly.");
  });
}