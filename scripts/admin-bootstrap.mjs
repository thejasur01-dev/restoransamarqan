/**
 * Makes sure the site owner's admin account exists. Runs on every Vercel build after migrations.
 * Only a scrypt hash is stored here, never the password. An existing account is left untouched,
 * so a password changed in /admin/profile survives later deploys.
 * To reset a forgotten password use `npm run admin:create` against that database instead.
 */
import postgres from "postgres";

const OWNER = {
  email: "jasuribrakhimov@gmail.com",
  name: "Jasur Ibrakhimov",
  passwordHash: "scrypt$32768$8$1$WD8KAlrLZ3wghFxbL2cUqg==$nJZYRxlzY5cqKLztbNAdGRk+OE5Jrd1dZwEuz+OdFn8=",
};

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("admin-bootstrap: DATABASE_URL is not set, skipped");
  process.exit(0);
}

const sql = postgres(url, { max: 1 });
const rows = await sql`
  insert into admins (email, name, password_hash, role)
  values (${OWNER.email}, ${OWNER.name}, ${OWNER.passwordHash}, 'owner')
  on conflict (email) do nothing
  returning id`;
await sql.end();
console.log(rows.length ? `admin-bootstrap: created ${OWNER.email}` : `admin-bootstrap: ${OWNER.email} already exists`);
