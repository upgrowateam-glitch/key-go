# API documentation — PROPOSED, NOT IMPLEMENTED

> No API exists yet. This is a proposed REST design for the planned NestJS server, based on what the two
> frontends' mock services already do. The final contract will be published with Swagger (OpenAPI) at
> `/api/docs` once the server is built.

Base URL: `/api/v1` · JSON · Auth: `Authorization: Bearer <JWT>`.

## Where the frontends will plug in

| App | Mock layer to replace |
|---|---|
| Customer | `Customer/src/services/` (`auth.ts`, `workspace.ts`, `mockClient.ts`) and `Customer/src/context/AppContext.tsx` actions |
| Admin | `Admin/src/services/` (one file per section, plus `mockClient.ts`) |

## Authentication

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/customer/register` | Public | Create a customer account |
| POST | `/auth/customer/login` | Public | Customer sign-in |
| POST | `/auth/staff/login` | Public | Staff/admin sign-in, returns role |
| POST | `/auth/refresh` · `/auth/logout` | Signed in | Token refresh / sign-out |

## Customer-facing

| Method | Path | Purpose |
|---|---|---|
| GET | `/vehicles?category=&fuel=&transmission=&from=&to=` | Fleet search with availability |
| GET | `/vehicles/:id` · `/vehicles/:id/availability` | Details, rates, booked periods |
| POST | `/quotes` | Price breakdown for vehicle, dates and term |
| POST | `/bookings` · GET `/me/bookings` · GET `/me/bookings/:id` | Book (rejects overlaps), list, details |
| POST | `/me/bookings/:id/cancel` | Cancel |
| POST | `/me/bookings/:id/payments` | Start a payment (gateway integration) |
| GET/POST | `/me/bookings/:id/agreement` · `/agreement/sign` | View and sign the agreement |
| GET | `/me/bookings/:id/location` | GPS position of an active rental |
| GET/PATCH | `/me` · POST `/me/documents` | Profile and document upload |
| GET | `/me/notifications` · POST `/me/notifications/read` | Notifications |

## Admin and staff (role-checked)

| Area | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard` |
| Fleet | `GET/POST /admin/vehicles`, `GET/PATCH /admin/vehicles/:id`, `/fuel`, `/documents`, `/sale`, `/rates` |
| Bookings | `GET/POST /admin/bookings`, `GET/PATCH /admin/bookings/:id`, `/confirm`, `/cancel`, `/complete`, `GET /admin/bookings/calendar` |
| Customers | `GET/POST /admin/customers`, `GET/PATCH /admin/customers/:id`, `/documents/:docId/verify`, `/activity` |
| Agreements | `GET /admin/agreements`, `GET /admin/agreements/:id/pdf`, `GET/PUT /admin/settings/terms` |
| Inspections | `POST /admin/bookings/:id/inspections`, `GET /admin/inspections`, `/damage-reports` |
| Maintenance | `GET/POST /admin/maintenance`, `GET /admin/reminders`, `POST /admin/reminders/:id/done` |
| Tracking | `GET /admin/tracking/active`, `/overdue`, `/utilization` |
| FASTag | `GET /admin/fastag`, `/transactions`, `POST /admin/fastag/:vehicleId/recharge`, `POST /admin/tolls/:id/bill` |
| People | `GET/POST /admin/staff`, `/drivers`, `/assignments`, `/attendance`, `/payroll` |
| Finance | `GET /admin/finance/summary`, `GET/POST /admin/finance/entries`, `/payments`, `/refunds`, `/emi` |
| Reports | `GET /admin/reports/:type?from=&to=&vehicleId=&customerId=&format=csv|pdf` |
| Notifications | `/admin/notifications`, `/templates`, `/automations`, `/delivery-log`, `/channels` |
| Marketing | `/admin/campaigns`, `/segments`, `/referral-codes`, `/commissions`, `/loyalty` |
| Settings | `/admin/settings/company`, `/branches`, `/users`, `/roles`, `/pricing`, `/policies`, `/payments` |

## Conventions

- Lists: `?page=&pageSize=&sort=&q=`; responses `{ data, page, pageSize, total }`.
- Errors: `{ statusCode, error, message }`; `409 Conflict` for booking overlaps and duplicate payments.
- Roles enforced on the server (the Admin portal's sidebar roles are only a UI hint today).
