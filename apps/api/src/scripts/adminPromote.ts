import { getDb } from '../db/index.js';

function parseArgs(): { email: string; demote: boolean } {
  const args = process.argv.slice(2);
  let email = '';
  let demote = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--email=')) email = a.slice('--email='.length);
    else if (a === '--email' && args[i + 1]) email = args[++i]!;
    else if (a === '--demote' || a === '--demote=true') demote = true;
  }
  if (!email) {
    console.error('Kullanım: npm run admin:promote -- --email=sen@fonoloji.com [--demote]');
    console.error('Ya da: npx tsx src/scripts/adminPromote.ts --email sen@fonoloji.com');
    process.exit(1);
  }
  return { email, demote };
}

function main(): void {
  const { email, demote } = parseArgs();
  const db = getDb();
  const role = demote ? 'user' : 'admin';
  const result = db
    .prepare(`UPDATE users SET role = ?, updated_at = ? WHERE email = ?`)
    .run(role, Date.now(), email.toLowerCase());
  if (result.changes === 0) {
    console.error(`Kullanıcı bulunamadı: ${email}`);
    process.exit(1);
  }
  console.log(`✓ ${email} → role=${role}`);
}

main();
