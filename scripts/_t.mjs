import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try { const r = await sql`select ${"published"}::event_status as s`; console.log("ok enum param", r); } catch (e) { console.log("FAIL enum param", e.code, e.message); }
try { const r = await sql`select 'published'::event_status as s`; console.log("ok enum literal", r); } catch (e) { console.log("FAIL enum literal", e.code, e.message); }
await sql.end();
