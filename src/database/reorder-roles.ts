import { initDatabase } from "../framework/database/connection.js";
import { db } from "../framework/facade.js";
import { sql } from "drizzle-orm";
import { roles, users } from "./schema.js";

async function main() {
  await initDatabase();
  console.log("Restructuring roles hierarchy...");

  // 1. Temporarily unset foreign keys
  await db.execute(sql`UPDATE users SET role_id = NULL;`);

  // 2. Clear old roles
  await db.execute(sql`DELETE FROM roles;`);

  // 3. Insert hierarchical roles: 1 = superadmin, 2 = admin, 3 = user
  await db.execute(sql`
    INSERT INTO roles (id, name, created_at, updated_at) VALUES 
    (1, 'superadmin', NOW(), NOW()),
    (2, 'admin', NOW(), NOW()),
    (3, 'user', NOW(), NOW());
  `);

  // 4. Update sequence
  await db.execute(sql`SELECT setval('roles_id_seq', 3);`);

  // 5. Reassign user roles
  // Super Admins
  await db.execute(sql`
    UPDATE users 
    SET role_id = 1 
    WHERE email = 'isupportbd.info@gmail.com' OR name ILIKE '%super%';
  `);

  // Firm Admins / Tenants
  await db.execute(sql`
    UPDATE users 
    SET role_id = 2 
    WHERE role_id IS NULL;
  `);

  console.log("Current Roles:");
  console.log(await db.select().from(roles));

  console.log("Current Users:");
  console.log(await db.select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, status: users.status }).from(users));

  console.log("Done!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
