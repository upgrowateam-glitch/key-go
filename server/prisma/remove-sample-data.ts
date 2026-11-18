/**
 * One-time clean-up of the sample data loaded by the first version of the seed:
 * deletes the sample bookings, customers, staff accounts and branches, keeps the 7 vehicles and their
 * prices, marks the vehicles Available and fills in their details for the apps.
 *
 * Only the exact sample records are touched, so real data is never deleted. Safe to run more than once.
 * Run `npm run create-owner` afterwards, because the sample staff logins are removed.
 */
import { PrismaClient } from '@prisma/client';
import { FLEET, rateRow, vehicleRow } from './fleet';

const prisma = new PrismaClient();

const SAMPLE_BOOKINGS = ['KG-8492', 'KG-7104', 'KG-6299', 'KG-5530', 'KG-4102'];
const SAMPLE_CUSTOMERS = ['cust-1', 'cust-2'];
const SAMPLE_STAFF = ['usr-owner', 'usr-admin', 'usr-manager', 'usr-staff'];
const SAMPLE_BRANCHES = ['br-blr', 'br-mum', 'br-del'];

async function main() {
  const bookings = await prisma.booking.deleteMany({ where: { id: { in: SAMPLE_BOOKINGS } } });
  const customers = await prisma.customer.deleteMany({ where: { id: { in: SAMPLE_CUSTOMERS }, bookings: { none: {} } } });
  const staff = await prisma.user.deleteMany({ where: { id: { in: SAMPLE_STAFF } } });
  await prisma.vehicle.updateMany({ where: { branchId: { in: SAMPLE_BRANCHES } }, data: { branchId: null } });
  await prisma.user.updateMany({ where: { branchId: { in: SAMPLE_BRANCHES } }, data: { branchId: null } });
  const branches = await prisma.branch.deleteMany({ where: { id: { in: SAMPLE_BRANCHES } } });

  let refreshed = 0;
  for (const v of FLEET) {
    const existing = await prisma.vehicle.findUnique({ where: { id: v.id } });
    if (!existing) {
      await prisma.vehicle.create({ data: vehicleRow(v) });
      await prisma.vehicleRate.create({ data: rateRow(v) });
    } else {
      const details = existing.details && typeof existing.details === 'object' && Object.keys(existing.details).length ? undefined : (v.details as object);
      const held = await prisma.booking.count({ where: { vehicleId: v.id, status: { in: ['CONFIRMED', 'ACTIVE'] } } });
      await prisma.vehicle.update({ where: { id: v.id }, data: { details, status: held ? undefined : 'AVAILABLE' } });
    }
    refreshed++;
  }

  console.log(
    `Removed ${bookings.count} sample booking(s), ${customers.count} sample customer(s), ${staff.count} sample staff account(s) and ${branches.count} sample branch(es). ` +
      `Kept ${refreshed} vehicles.`,
  );
  if (!(await prisma.user.count({ where: { role: 'OWNER', active: true } }))) {
    console.log('No Owner account exists now. Create one with: npm run create-owner -- --email <email> --name "<name>" --password <password>');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
