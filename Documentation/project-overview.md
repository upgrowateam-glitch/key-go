# KeyGo project overview

KeyGo is a car rental business platform made of two separate frontends and a planned backend.

| Part | Folder | Technology | Status |
|---|---|---|---|
| Customer mobile app | `Customer/` | Expo SDK 57, React Native 0.86, Expo Router, TypeScript | Frontend complete, mock data |
| Admin web portal | `Admin/` | Next.js 16 (webpack), React 19, react-native-web, TypeScript | Frontend complete, mock data |
| Backend API | `Server/` | NestJS, PostgreSQL, Prisma (planned) | Not started |

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
- **Prices:** every price comes from one file, `Customer/src/data/pricing.ts`, marked as temporary mock pricing.

## Admin portal

For owners, administrators, managers and staff. Sidebar sections:

Dashboard · Fleet Management · Bookings & Reservations · Customers · Rental Agreements · Vehicle Inspections ·
Maintenance · Rental Tracking · FASTag & Tolls · Drivers & Staff · Financial Management · Reports & Analytics ·
Notifications · Marketing & Loyalty · Settings

Sections are role-based (`Admin/src/config/navigation.ts`). Tabs are synced to the URL (`?tab=`).

## Current limitations (frontend phase)

- All data is mock data and most edits reset on reload. There is no shared state between the two apps.
- Sign-in, roles, double-booking prevention, payments, GPS, FASTag, ID and face verification, WhatsApp/SMS,
  e-signatures and PDFs are simulated and labelled as such in the UI.
- The two apps keep separate copies of the UI kit, theme, types and mock data (`src/components/kit`, `src/theme`,
  `src/types`, `src/data`). This is deliberate for now; a shared package is a later decision.
- The Admin portal still uses the original six-vehicle mock fleet; the Customer app uses the updated seven-vehicle fleet.
