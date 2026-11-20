/**
 * Checks that this server can open every piece of encrypted identity data: Aadhaar numbers and every encrypted
 * document file. Run it after restoring a backup, after moving to a new server, or after changing keys:
 *
 *   docker exec keygo-api npm run keys:verify
 *
 * It only reads; it changes nothing. Exit code 0 = everything opens, 1 = something cannot be opened.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { currentKeyId, decrypt, decryptFile, hasDedicatedKey, keyIdOf } from '../src/common/crypto';

async function main() {
  const prisma = new PrismaClient();
  const root = resolve(process.env.FILE_STORAGE_DIR || './storage');
  let problems = 0;
  console.log(`Current key: ${currentKeyId()}${hasDedicatedKey() ? '' : '  (WARNING: DATA_ENCRYPTION_KEY is not set; using the sign-in secret)'}`);

  const check = await prisma.appSetting.findUnique({ where: { key: 'security.keyCheck' } });
  const sample = (check?.value as { sample?: string } | null)?.sample;
  if (!sample) console.log('Key check: not recorded yet (the server records it on its first start).');
  else if (decrypt(sample) === 'keygo-key-check') console.log(`Key check: OK (data expects key ${keyIdOf(sample)})`);
  else {
    problems++;
    console.log(`Key check: FAILED. The data was encrypted with key ${keyIdOf(sample)}; this server does not have it.`);
  }

  const customers = await prisma.customer.findMany({ where: { aadhaarNoEnc: { not: null } }, select: { id: true, aadhaarNoEnc: true } });
  const badAadhaar = customers.filter((c) => decrypt(c.aadhaarNoEnc!) === null);
  problems += badAadhaar.length;
  console.log(`Aadhaar numbers: ${customers.length - badAadhaar.length} of ${customers.length} open${badAadhaar.length ? `; cannot open: ${badAadhaar.map((c) => c.id).join(', ')}` : ''}`);

  const files = await prisma.storedFile.findMany({ where: { encrypted: true } });
  const keys = new Map<string, number>();
  let ok = 0;
  for (const f of files) {
    keys.set(f.keyId ?? '?', (keys.get(f.keyId ?? '?') ?? 0) + 1);
    const full = join(root, f.path);
    if (!existsSync(full)) {
      problems++;
      console.log(`  MISSING  ${f.path} (restore the uploaded files from the backup)`);
      continue;
    }
    try {
      decryptFile(readFileSync(full), f.wrappedKey ?? '');
      ok++;
    } catch (e) {
      problems++;
      console.log(`  CANNOT OPEN  ${f.path}: ${(e as Error).message}`);
    }
  }
  console.log(`Encrypted documents: ${ok} of ${files.length} open. By key: ${[...keys].map(([k, n]) => `${k} × ${n}`).join(', ') || 'none'}`);
  console.log(problems ? `\n${problems} problem(s). Put the right DATA_ENCRYPTION_KEY in the server settings (old keys in DATA_ENCRYPTION_OLD_KEYS) and run this again.` : '\nEverything opens.');
  await prisma.$disconnect();
  process.exit(problems ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
