/**
 * Prepares a new database: creates KeyGo's 7 vehicles with their price lists.
 * Safe to run any time: vehicles that already exist are left exactly as they are.
 * There are no sample customers, staff or bookings. Create the first Owner account with `npm run create-owner`.
 */
import { PrismaClient } from '@prisma/client';
import { FLEET, rateRow, vehicleRow } from './fleet';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const v of FLEET) {
    if (await prisma.vehicle.findUnique({ where: { id: v.id } })) continue;
    await prisma.vehicle.create({ data: vehicleRow(v) });
    await prisma.vehicleRate.create({ data: rateRow(v) });
    created++;
  }
  console.log(`Fleet ready: ${created} vehicle(s) created, ${FLEET.length - created} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
