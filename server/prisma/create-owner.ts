/**
 * Creates the first Owner account for the admin portal, or resets an existing account to an active Owner
 * with a new password.
 *
 *   npm run create-owner -- --email owner@company.com --name "Full Name" --password "a-strong-password"
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  const password = arg('password');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !password) {
    throw new Error('Usage: npm run create-owner -- --email <email> --name "<full name>" --password <password>');
  }
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.');

  const passwordHash = await hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { name, passwordHash, role: 'OWNER', active: true } });
    console.log(`Updated ${email}: now an active Owner with the new password.`);
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: 'OWNER' } });
    console.log(`Created Owner account ${email}. Sign in to the admin portal with it.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
