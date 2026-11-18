# Database design — PROPOSED, NOT IMPLEMENTED

> No database exists yet. This is a starting proposal for the planned PostgreSQL + Prisma backend.
> It is derived from the TypeScript types the two frontends already use (`Customer/src/types/index.ts`,
> `Admin/src/types/index.ts`), so the mock data can be migrated with few changes. Review before building.

## Core entities

| Table | Purpose | Key fields (from current types) |
|---|---|---|
| `users` | Staff and admin accounts | id, name, email, password_hash, role (Owner, Admin, Manager, Staff), branch_id, active |
| `customers` | Customer accounts and KYC | id, first_name, last_name, dob, phone, email, address, city, aadhaar_no (encrypted), dl_number, dl_state, dl_expiry, care_of_name/relation/phone, customer_code, loyalty_tier, loyalty_points |
| `customer_documents` | Uploaded ID, licence, address proof, photo | id, customer_id, kind, status (Verified, Pending, Not uploaded, Rejected), file_url, uploaded_at |
| `branches` | Locations | id, name, address, city |
| `vehicles` | Fleet | id, registration_no, brand, model, type (Hatchback, SUV, MUV, Sedan, …), seats, transmission, fuel, color, status (Available, Reserved, On Rent, Maintenance, Sold), purchase_date, purchase_cost, odometer_km, fuel_level, gps_device_id, fastag_id, insurance (provider, policy_no, expiry), puc (certificate_no, expiry), branch_id |
| `vehicle_rates` | Prices per vehicle | vehicle_id, daily, weekly, monthly, deposit, driver_per_day, valid_from (today in `Customer/src/data/pricing.ts`) |
| `vehicle_loans` | Loan and EMI | vehicle_id, bank_name, account_no, emi_amount, tenure_months, paid_months |
| `vehicle_sales` | Sale management | vehicle_id, sold_date, sale_price, buyer_name, buyer_phone, notes |
| `bookings` | Quotes, reservations and rentals | id, customer_id, vehicle_id, pickup_location, pickup_at, return_at, days, term (Daily, Weekly, Monthly), purpose, classification, base_rate, subtotal, discount, tax, total, deposit, status (Quoted, Pending, Confirmed, Active, Completed, Cancelled), payment_status, reminder_at, driver_id, start/end odometer, settlement charges |
| `agreements` | Signed rental agreements | id, booking_id, signed_at, signer_name, signature (vector path or file), security_deposit, discount, status |
| `agreement_fines` | Fines on an agreement | id, agreement_id, label, amount |
| `inspections` | Pickup and return checks | id, booking_id, type (Pickup, Return), inspector_id, fuel_percent, odometer_km, notes, estimated_damage_cost |
| `damage_marks` | Damage per inspection | id, inspection_id, zone, kind, severity, estimated_cost |
| `inspection_photos` | Photos | id, inspection_id, angle, file_url |
| `maintenance_records` / `maintenance_reminders` | Service history and due items | vehicle_id, service_type, category, cost, vendor, date, status / type, due_date, due_km, status |
| `fuel_entries` | Fuel log | vehicle_id, date, litres, cost, odometer_km, station |
| `fastag_transactions` | Tolls | id, vehicle_id, plaza, amount, at, balance_after, booking_id, billed_to_customer |
| `drivers` / `driver_assignments` | Drivers and their bookings | licence details, salary, commission_percent / driver_id, booking_id, date, status |
| `attendance` / `payroll` | Staff punches and pay | user_id, date, punch_in, punch_out, mark / user_id, month, base, allowances, deductions, net |
| `payments` | Payments and refunds | id, booking_id, amount, method, gateway_ref, status, type (deposit, balance, refund), created_at — unique gateway_ref to stop duplicates |
| `finance_entries` | Income and expenses | id, date, category, direction (in, out), amount, vehicle_id, reference |
| `notifications` / `message_log` | In-app notifications and WhatsApp/SMS log | recipient, type, title, message, read_at / channel, status, sent_at |
| `campaigns`, `referral_codes`, `loyalty_tiers` | Marketing and loyalty | as in the current `Campaign`, `CustomerCodeCommission` and `LoyaltyRewardTier` types |
| `audit_log` | Who changed what | id, actor_id, entity, entity_id, field, old_value, new_value, at |

## Rules the database must enforce

- **No double bookings:** a vehicle cannot have two `Confirmed` or `Active` bookings with overlapping
  `[pickup_at, return_at)`. Use a PostgreSQL exclusion constraint (`btree_gist`) on `vehicle_id` and a `tstzrange`.
  The frontends only check this locally today.
- **Payments:** unique `gateway_ref`; refunds reference the original payment.
- **Sensitive data:** Aadhaar and licence numbers encrypted at rest and masked in API responses.
- **Money:** store amounts in paise as integers.
