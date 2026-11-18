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

3. **Create the tables, the fleet and the first Owner**

   ```powershell
   npm run prisma:migrate     # applies prisma/migrations
   npm run db:seed            # creates the 7 vehicles and their prices (never overwrites existing ones)
   npm run create-owner -- --email you@company.com --name "Your Name" --password "a-strong-password"
   ```

   There are no sample customers, staff or bookings. Customers register in the app; Owners and Admins add staff
   in the admin portal under Settings → Users & roles.

4. **Run**

   ```powershell
   npm run start:dev
   ```

   Open http://localhost:4000/health to confirm the API and database are up, and http://localhost:4000/docs for
   the API reference.

## Clearing the old sample data

Databases created with the first version of the seed hold sample customers, staff logins and bookings. Remove them
once with `npm run db:remove-sample` (on the VPS: `docker exec keygo-api npm run db:remove-sample`). It deletes only
those exact sample records, keeps the vehicles, and reminds you to create an Owner if none is left.

## What the API serves

| Prefix | Who | What |
|---|---|---|
| `/auth` | Anyone | Staff and customer sign-in, customer registration |
| `/public` | Anyone | Rentable fleet with prices, loyalty tiers |
| `/me` | Signed-in customer | Own profile, bookings (quote, confirm, pay, cancel, extend, keyless), agreement signing, notifications |
| `/admin` | Signed-in staff | Workspace load, vehicles, bookings, customers, records, settings, files; `/admin/users` for Owners and Admins |

Prices of customer bookings are always worked out on the server from the vehicle's price list. Double bookings
are blocked by the database. Aadhaar numbers are stored encrypted and only the last four digits are returned.

## Layout

```text
src/
  main.ts                 bootstrap: validation, error shape, CORS, Swagger
  app.module.ts
  config/env.validation.ts
  common/                 cross-cutting filters, guards and helpers
  prisma/                 PrismaService (one client for the app)
  health/                 GET /health
  auth/                   sign-in, tokens and the guard on every route
  admin/                  admin portal API, staff users, document files
  customer/               customer app API and public fleet
  domain/                 mapping, pricing, bookings and storage shared by both
prisma/
  schema.prisma           data model: staff, customers, vehicles, rates, bookings, admin records, settings, files
  migrations/             SQL migrations, including the no-double-booking exclusion constraint
  seed.ts                 creates the fleet on a new database
  fleet.ts                the 7 vehicles and their price lists
  create-owner.ts         creates or resets an Owner account
  remove-sample-data.ts   one-time removal of the first seed's sample records
```

## Conventions

- Money is stored in paise as integers; the API returns rupee amounts.
- Lists accept `?page=&pageSize=&sort=&q=` and return `{ data, page, pageSize, total }`.
- Errors are `{ statusCode, error, message }`; booking overlaps and duplicate payments return `409 Conflict`.
- Roles are enforced on the server; the admin portal's sidebar roles are only a UI hint.

Proposed data model and endpoints: [`../Documentation/database-design.md`](../Documentation/database-design.md) and
                                                                                                                                                               [`../Documentation/api-documentation.md`](../Documentation/api-documentation.md).
