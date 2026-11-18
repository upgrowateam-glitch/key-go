# KeyGo project overview

KeyGo is a car rental business platform made of two separate frontends and a planned backend.

| Part | Folder | Technology | Status |
|---|---|---|---|
| Customer mobile app | `Customer/` | Expo SDK 57, React Native 0.86, Expo Router, TypeScript | Connected to the server |
| Admin web portal | `Admin/` | Next.js 16 (webpack), React 19, react-native-web, TypeScript | Connected to the server |
| Backend API | `Server/` | NestJS, PostgreSQL 18, Prisma | Live: auth, fleet, bookings, records, settings, files |

```text
Customer (Expo app) ──┐
                      ├── Server (NestJS API) ─── PostgreSQL
Admin (Next.js app) ──┘
```

## Customer app

For customers only. It has no admin or staff screens.

- **Entry:** splash, onboarding, sign-in and registration.
- **Tabs:** Home, Explore, My Bookings, Notifications, Profile.
- **Booking:** vehicle details, booking flow with price breakdown, online payment, digital agreement and signature,
  booking details, GPS tracking of an active rental.
- **Home entrance:** two Google Flow videos play automatically once per app session (road, then showroom),
  using `expo-video`.
- **Prices:** each vehicle's price list is stored on the server and edited in the admin portal; the server works out
  the price of every booking.

## Admin portal

For owners, administrators, managers and staff. Sidebar sections:

Dashboard · Fleet Management · Bookings & Reservations · Customers · Rental Agreements · Vehicle Inspections ·
Maintenance · Rental Tracking · FASTag & Tolls · Drivers & Staff · Financial Management · Reports & Analytics ·
Notifications · Marketing & Loyalty · Settings

Sections are role-based (`Admin/src/config/navigation.ts`). Tabs are synced to the URL (`?tab=`).

## Current limitations

- Both apps read and write the KeyGo server and its PostgreSQL database. Staff and customers sign in with real
  accounts; roles and double-booking prevention are enforced by the server.
- Admin-managed lists other than vehicles, bookings and customers (agreements, inspections, finance, marketing,
  notifications, ...) are stored as JSON records and settings documents. Two staff editing the same settings page
  at the same moment: the last save wins.
- Still simulated and labelled in the UI: online payments, GPS, FASTag, ID and face verification, WhatsApp/SMS,
  e-signature delivery, PDFs and customer document uploads in the app. Vehicle documents are real uploads.
- The two apps keep separate copies of the UI kit, theme and types (`src/components/kit`, `src/theme`, `src/types`).
  This is deliberate for now; a shared package is a later decision.
