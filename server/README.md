# KeyGo Server

NestJS API for the KeyGo customer app and admin portal, backed by PostgreSQL through Prisma.

## Stack

- NestJS 11 (Node.js, TypeScript), REST with Swagger at `/docs`
- PostgreSQL 18, installed locally and managed with pgAdmin (no Docker)
- Prisma ORM with SQL migrations in `prisma/migrations`

```text
Customer (Expo app) ──┐
                      ├── Server (NestJS API) ─── PostgreSQL
Admin (Next.js app) ──┘
```

## First-time setup

1. **Create the database role and database** in pgAdmin (Query Tool on the `postgres` database), or with psql:

   ```sql
   CREATE ROLE keygo WITH LOGIN PASSWORD 'keygo';
   CREATE DATABASE keygo OWNER keygo;
   ```

   The migration also enables the `btree_gist` extension, which needs a superuser the first time. Run this once
   as `postgres` on the `keygo` database:

   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

2. **Configure the server**

   ```powershell
   cd server
   copy .env.example .env     # then edit DATABASE_URL if you chose a different password
   npm install
   ```

3. **Create the tables and load sample data**

   ```powershell
   npm run prisma:migrate     # applies prisma/migrations
   npm run db:seed            # loads the same fleet, customers and staff the apps use as mock data
   ```

4. **Run**

   ```powershell
   npm run start:dev
   ```

   Open http://localhost:4000/health to confirm the API and database are up, and http://localhost:4000/docs for
   the API reference.

## Sample accounts (from the seed)

| Who | Email | Password |
|---|---|---|
| Owner | owner@keygo.in | keygo123 |
| Admin | admin@keygo.in | keygo123 |
| Manager | manager@keygo.in | keygo123 |
| Staff | staff@keygo.in | keygo123 |
| Customer | ananya.s@example.com | keygo123 |

## Layout

```text
src/
  main.ts                 bootstrap: validation, error shape, CORS, Swagger
  app.module.ts
  config/env.validation.ts
  common/                 cross-cutting filters, guards and helpers
  prisma/                 PrismaService (one client for the app)
  health/                 GET /health
prisma/
  schema.prisma           data model (phase 1: users, customers, branches, vehicles, rates, bookings)
  migrations/             SQL migrations, including the no-double-booking exclusion constraint
  seed.ts                 sample data matching the apps' mock data
```

## Conventions

- Money is stored in paise as integers; the API returns rupee amounts.
- Lists accept `?page=&pageSize=&sort=&q=` and return `{ data, page, pageSize, total }`.
- Errors are `{ statusCode, error, message }`; booking overlaps and duplicate payments return `409 Conflict`.
- Roles are enforced on the server; the admin portal's sidebar roles are only a UI hint.

Proposed data model and endpoints: [`../Documentation/database-design.md`](../Documentation/database-design.md) and
[`../Documentation/api-documentation.md`](../Documentation/api-documentation.md).
