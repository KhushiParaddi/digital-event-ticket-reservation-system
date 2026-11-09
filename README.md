# Event reservation app

## Start locally

Requirements: Node.js 22+, Docker Desktop with Compose.

1. Copy `.env.example` to `.env`. Change `AUTH_SECRET` and the demo passwords for non-local deployments.
2. Run `docker compose up --build` in this folder.
3. Open `http://localhost:3000`.

MySQL and MongoDB start with sample records on first run. Seed bcrypt password hashes and MongoDB event vectors with `npm install` then `npm run db:seed`. For a local non-Docker Next.js server, copy `.env.example` to `.env`, run `docker compose up -d mysql mongodb`, `npm install`, `npm run db:seed`, and `npm run dev`.

The default local demo accounts are `aarav@example.com` / `AdminDemo2026!` (organizer) and `diya@example.com` / `CustomerDemo2026!` (customer). Change them in `.env` before exposing the app beyond localhost. Database scripts under `01_schema.sql` and `02_sample_data.sql` are imported only when Docker initializes a new MySQL volume. `docker compose down -v` removes local DB data.

`npm run test:smoke` runs an end-to-end API and database workflow while the web app and both databases are running. It checks role restrictions, booking transactions and triggers, MongoDB content CRUD and vector recommendations, and SQL functions/recursive CTEs. The script creates and removes temporary records.

## Database and API code map

- MySQL stores users, role, event categories and events, ticket inventory, bookings, and payments. SQL routines, a revenue function, a recursive category CTE, constraints, and inventory triggers implement the database operations.
- MongoDB stores flexible event descriptions, tags, and 64-dimensional local token vectors. `/api/recommendations?q=...` ranks published content by cosine similarity. This is a local deterministic feature vector, not an external machine-learning model.
- Next.js App Router provides the page and authenticated APIs. Registration only creates customers. The demo organizer is provisioned by the seed script; organizer routes re-check the user's SQL role for each request.
- `04_queries.sql` contains nested, correlated, aggregate, join, CTE, recursive, and CRUD query examples.
