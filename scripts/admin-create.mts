/**
 * Creates the first (or another) admin, or resets an existing admin's password.
 *   npm run admin:create -- email@example.com "Ism Familiya" [owner|manager|checker]
 * Prints a generated password once; it is stored only as a hash.
 */
import postgres from "postgres";
import { generatePassword, hashPassword } from "../src/lib/admin/password";

const [email, name, role = "owner"] = process.argv.slice(2);
if (!email || !email.includes("@") || !name || !["owner", "manager", "checker"].includes(role)) {
  console.error('Foydalanish: npm run admin:create -- email@example.com "Ism Familiya" [owner|manager|checker]');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const password = generatePassword();
const hash = await hashPassword(password);
const normalized = email.trim().toLowerCase();

const [row] = await sql`
  insert into admins (email, name, password_hash, role)
  values (${normalized}, ${name}, ${hash}, ${role})
  on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name, role = excluded.role, active = true
  returning id`;
await sql`delete from admin_sessions where admin_id = ${row.id}`;
await sql.end();

console.log(`Admin tayyor: ${normalized} (${role})`);
console.log(`Parol: ${password}`);
console.log("Parolni xavfsiz joyga saqlang va kirgandan keyin o'zgartiring: /admin/profile");
