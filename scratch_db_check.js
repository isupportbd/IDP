import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const rows = await sql`SELECT id, admin_id, sms_api_key, sms_sender_id, sms_provider, sms_endpoint_url FROM company_settings`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
