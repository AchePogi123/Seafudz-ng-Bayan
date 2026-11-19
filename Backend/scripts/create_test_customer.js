/**
 * Creates (or resets) a dummy online-customer account for local testing.
 *
 * The password is stored as a scrypt hash in `customers.password_hash`, which is the fallback
 * `POST /api/auth/login` checks after Supabase — so the account works on a local machine with no
 * Supabase project configured. Login accepts the username, the email, or the full name.
 *
 *   npm run seed:test-customer
 *   npm run seed:test-customer -- --username=shopper2 --password='Another1!' --name='Shopper Two'
 *
 * Re-running with the same email resets that account's password instead of failing, so this is
 * safe to repeat.
 *
 * REFUSES TO RUN AGAINST PRODUCTION: it seeds a known, shared password. Set
 * ALLOW_TEST_CUSTOMER_SEED=1 only if you genuinely need it on a non-local database.
 */
import dotenv from 'dotenv';
dotenv.config();

import { getDbPool } from '../src/config/db.js';
import { hashPassword } from '../src/cryptography/passwordHash.js';

/** Reads `--key=value` / `--key value` off the command line. */
function arg(name, fallback) {
  const prefixed = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(`--${name}=`.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
}

const account = {
  username: arg('username', 'testcustomer'),
  password: arg('password', 'Test1234!'),
  fullname: arg('name', 'Test Customer'),
  email: arg('email', 'testcustomer@seafudz.ph').trim().toLowerCase(),
  phone: arg('phone', '09171234567'),
  // Must end with a Barangay / City pair from DELIVERABLE_BARANGAYS_8KM, otherwise checkout
  // cannot pre-fill the delivery-area dropdown from the saved address. See
  // `Frontend/src/utils/deliveryCoverage.ts` (composeCoveredAddress / splitCoveredAddress).
  address: arg(
    'address',
    'Blk 5 Lot 12, Phase 3, Barangay 176 (Bagong Silang - Phases 1 to 10), Caloocan City (North)'
  ),
};

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.ALLOW_TEST_CUSTOMER_SEED !== '1') {
    console.error('[ABORT] Refusing to seed a known test password while NODE_ENV=production.');
    console.error('        Set ALLOW_TEST_CUSTOMER_SEED=1 if that is really what you want.');
    process.exit(1);
  }

  if (account.password.length < 8) {
    console.error('[ABORT] Password must be at least 8 characters.');
    process.exit(1);
  }

  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    const passwordHash = await hashPassword(account.password);

    // A username is not unique in the schema, but two accounts answering to the same username
    // would make logins ambiguous (the login query takes the first match), so check first.
    const clash = await client.query(
      `SELECT email FROM customers WHERE LOWER(username) = LOWER($1) AND LOWER(email) <> $2 LIMIT 1`,
      [account.username, account.email]
    );
    if (clash.rows.length > 0) {
      console.error(`[ABORT] Username "${account.username}" is already used by ${clash.rows[0].email}.`);
      console.error('        Pick another with --username=... so logins stay unambiguous.');
      process.exit(1);
    }

    const { rows } = await client.query(
      `INSERT INTO customers (fullname, username, email, phone, delivery_address, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         fullname = EXCLUDED.fullname,
         username = EXCLUDED.username,
         phone = EXCLUDED.phone,
         delivery_address = EXCLUDED.delivery_address,
         password_hash = EXCLUDED.password_hash,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING id, created_at, updated_at`,
      [account.fullname, account.username, account.email, account.phone, account.address, passwordHash]
    );

    const row = rows[0];
    const wasCreated = new Date(row.created_at).getTime() === new Date(row.updated_at).getTime();

    console.log('====================================================');
    console.log(` Test customer ${wasCreated ? 'created' : 'updated (password reset)'}`);
    console.log('====================================================');
    console.log(`  Username : ${account.username}`);
    console.log(`  Password : ${account.password}`);
    console.log(`  Email    : ${account.email}`);
    console.log(`  Name     : ${account.fullname}`);
    console.log(`  Phone    : ${account.phone}`);
    console.log(`  Address  : ${account.address}`);
    console.log(`  id       : ${row.id}`);
    console.log('');
    console.log('  Log in at /login with the username OR the email.');

    // The one-ongoing-order rule means a leftover order from an earlier test session would block
    // this account from checking out, so say so rather than letting it look broken.
    const open = await client.query(
      `SELECT id, status FROM orders
        WHERE customer_id = $1
          AND COALESCE(order_type, 'ONLINE') = 'ONLINE'
          AND UPPER(status) NOT IN ('COMPLETED', 'CANCELLED', 'CANCEL_REQUESTED')
        ORDER BY created_at ASC`,
      [row.id]
    );
    if (open.rows.length > 0) {
      console.log('');
      console.log('  NOTE: this account already has an ongoing order, so it cannot place a new one');
      console.log('        until that order is delivered/picked up or cancelled:');
      open.rows.forEach((o) => console.log(`          ${o.id} — ${o.status}`));
    }
    console.log('');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[ERROR] Could not create the test customer:', err.message);
  process.exit(1);
});
