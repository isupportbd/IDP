import { and, asc, eq, gt, ne, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { HttpStatusCodes, password } from "@/framework/facade.js";
import { db } from "@/framework/database/connection.js";
import { refreshTokens, users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { plans } from "@/modules/superadmin/database/models/plans.js";

// Helper: Resolve tenant admin ID
async function resolveTenantAdmin(c: any) {
  const auth = c.get("auth") || c.get("user");
  if (!auth?.id) return null;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, Number(auth.id)),
    with: { role: true }
  });

  if (!currentUser) return null;

  const isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
  const isTenantAdmin = currentUser.role?.name?.toLowerCase() === "admin" || !currentUser.adminId;
  const tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;

  return {
    currentUser,
    isSuperAdmin,
    isTenantAdmin,
    tenantAdminId
  };
}

// 1. List Sub-Users
export const listUsers: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { currentUser, isSuperAdmin, tenantAdminId } = tenantInfo;

    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        roleId: users.roleId,
        status: users.status,
        permissions: users.permissions,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        adminId: users.adminId
      })
      .from(users)
      .where(
        isSuperAdmin
          ? undefined
          : or(eq(users.id, tenantAdminId), eq(users.adminId, tenantAdminId))
      )
      .orderBy(asc(users.id));

    // Fetch active session tokens
    const activeTokens = await db.query.refreshTokens.findMany({
      where: and(
        eq(refreshTokens.revoked, false),
        gt(refreshTokens.expiresAt, new Date())
      )
    });
    const loggedInUserIds = new Set(activeTokens.map((t: any) => Number(t.userId)));
    const currentUserId = Number(currentUser.id);
    loggedInUserIds.add(currentUserId);
    const now = Date.now();

    // Get all roles map
    const allRoles = await db.select().from(roles);
    const roleMap = new Map(allRoles.map((r) => [r.id, r.name]));

    const data = userList.map((u) => {
      const roleName = roleMap.get(u.roleId || 0) || "user";
      const normalizedRole = roleName === "superadmin" || roleName === "admin" ? "admin" : "user";
      const isSelf = u.id === currentUserId;
      const hasActiveSession = isSelf || loggedInUserIds.has(u.id);
      const isStatusActive = u.status === "active";
      const lastActiveTime = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
      const diffMinutes = lastActiveTime > 0 ? (now - lastActiveTime) / (1000 * 60) : 999999;

      let lastActive = "Offline";
      if (hasActiveSession && isStatusActive && (isSelf || diffMinutes <= 5)) {
        lastActive = "Just now";
      } else if (hasActiveSession && isStatusActive && (isSelf || diffMinutes <= 30)) {
        lastActive = `${Math.floor(diffMinutes)}m ago`;
      } else if (lastActiveTime > 0 && diffMinutes < 1440) {
        lastActive = `${Math.floor(diffMinutes / 60)}h ago`;
      } else if (lastActiveTime > 0) {
        lastActive = `${Math.floor(diffMinutes / 1440)}d ago`;
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile || "",
        role: normalizedRole,
        status: u.status || "active",
        permissions: Array.isArray(u.permissions) ? u.permissions : [],
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "—",
        lastActive,
        lastPage: "—"
      };
    });

    return c.json({ success: true, message: "Users fetched", data }, HttpStatusCodes.OK);
  } catch (err: any) {
    console.error("Failed to list users:", err);
    return c.json({ success: false, message: err.message || "Failed to list users", data: [] }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// 2. Create Sub-User
export const createUser: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { currentUser, isSuperAdmin, tenantAdminId } = tenantInfo;
    const body = await c.req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim();
    const rawPassword = String(body.password || "");
    const requestedRole = body.role === "admin" ? "admin" : "user";
    const status = body.status === "inactive" ? "inactive" : "active";
    const permissionsList = Array.isArray(body.permissions) ? body.permissions : ["activity_filter", "submissions", "sales_rates", "reports"];

    if (!name) return c.json({ message: "Full name is required." }, HttpStatusCodes.BAD_REQUEST);
    if (!email || !email.includes("@")) return c.json({ message: "Valid email is required." }, HttpStatusCodes.BAD_REQUEST);
    if (!mobile) return c.json({ message: "Mobile number is required." }, HttpStatusCodes.BAD_REQUEST);
    if (!rawPassword || rawPassword.length < 6) return c.json({ message: "Password must be at least 6 characters." }, HttpStatusCodes.BAD_REQUEST);

    // Check duplicate email
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return c.json({ message: "A user with this email address already exists." }, HttpStatusCodes.CONFLICT);
    }

    // Check plan max users limit for tenant
    if (!isSuperAdmin) {
      const tenantAdmin = await db.query.users.findFirst({
        where: eq(users.id, tenantAdminId)
      });
      if (tenantAdmin?.planId) {
        const [plan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
        if (plan) {
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(
              and(
                eq(users.adminId, tenantAdminId),
                ne(users.id, tenantAdminId),
                eq(users.status, "active")
              )
            );
          const currentUsersCount = countResult[0]?.count || 0;
          if (currentUsersCount >= plan.maxUsers) {
            return c.json(
              {
                message: `Active sub-user limit reached (${currentUsersCount}/${plan.maxUsers}) for your subscription plan (${plan.name}). Please inactivate a former staff member from the User & Staff list or upgrade your plan to add more staff.`
              },
              HttpStatusCodes.FORBIDDEN
            );
          }
        }
      }
    }

    // Get target roleId
    const allRoles = await db.select().from(roles);
    const targetRole = allRoles.find((r) => r.name === requestedRole) || allRoles.find((r) => r.name === "user");
    const targetRoleId = targetRole ? targetRole.id : 3;

    const hashedPassword = await password.hashPassword(rawPassword);

    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        mobile,
        password: hashedPassword,
        roleId: targetRoleId,
        status,
        adminId: tenantAdminId,
        permissions: permissionsList,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Sub-user registered successfully",
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          mobile: created.mobile,
          role: requestedRole,
          status: created.status,
          permissions: created.permissions,
          createdAt: created.createdAt ? new Date(created.createdAt).toISOString().slice(0, 10) : "—",
          lastActive: "Never",
          lastPage: "—"
        }
      },
      HttpStatusCodes.CREATED
    );
  } catch (err: any) {
    console.error("Failed to create user:", err);
    return c.json({ message: err.message || "Failed to create user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// 3. Update Sub-User
export const updateUser: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { isSuperAdmin, tenantAdminId } = tenantInfo;
    const userId = Number(c.req.param("id"));
    if (!userId || isNaN(userId)) {
      return c.json({ message: "Invalid user ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Find user and ensure tenant authorization
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (!isSuperAdmin && targetUser.adminId !== tenantAdminId && targetUser.id !== tenantAdminId) {
      return c.json({ message: "Forbidden: You do not have access to manage this user" }, HttpStatusCodes.FORBIDDEN);
    }

    const body = await c.req.json();
    const updateData: any = { updatedAt: new Date() };

    if (body.name) updateData.name = String(body.name).trim();
    if (body.mobile !== undefined) updateData.mobile = String(body.mobile).trim();
    if (body.status) updateData.status = body.status;
    if (body.permissions !== undefined) updateData.permissions = body.permissions;
    if (body.password && String(body.password).trim().length >= 6) {
      updateData.password = await password.hashPassword(String(body.password).trim());
    }

    if (body.email) {
      const email = String(body.email).trim().toLowerCase();
      if (email !== targetUser.email) {
        const [existing] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, userId))).limit(1);
        if (existing) {
          return c.json({ message: "Email is already taken by another user." }, HttpStatusCodes.CONFLICT);
        }
        updateData.email = email;
      }
    }

    if (body.role) {
      const allRoles = await db.select().from(roles);
      const targetRole = allRoles.find((r) => r.name === body.role);
      if (targetRole) {
        updateData.roleId = targetRole.id;
      }
    }

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();

    return c.json({ success: true, message: "User updated successfully", data: updated }, HttpStatusCodes.OK);
  } catch (err: any) {
    console.error("Failed to update user:", err);
    return c.json({ message: err.message || "Failed to update user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// 4. Reset User Password
export const resetUserPassword: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { isSuperAdmin, tenantAdminId } = tenantInfo;
    const userId = Number(c.req.param("id"));
    const body = await c.req.json();

    if (!body.newPassword || body.newPassword.length < 6) {
      return c.json({ message: "Password must be at least 6 characters long." }, HttpStatusCodes.BAD_REQUEST);
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (!isSuperAdmin && targetUser.adminId !== tenantAdminId && targetUser.id !== tenantAdminId) {
      return c.json({ message: "Forbidden" }, HttpStatusCodes.FORBIDDEN);
    }

    const hashedPassword = await password.hashPassword(body.newPassword);
    await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));

    return c.json({ success: true, message: "Password updated successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to reset password" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// 5. Toggle / Update User Status
export const updateUserStatus: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { isSuperAdmin, tenantAdminId } = tenantInfo;
    const userId = Number(c.req.param("id"));
    const body = await c.req.json().catch(() => ({}));

    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (!isSuperAdmin && targetUser.adminId !== tenantAdminId && targetUser.id !== tenantAdminId) {
      return c.json({ message: "Forbidden" }, HttpStatusCodes.FORBIDDEN);
    }

    const newStatus = body.status ? body.status : (targetUser.status === "active" ? "inactive" : "active");

    // If activating a previously inactive user, verify plan active user limit
    if (newStatus === "active" && targetUser.status !== "active" && !isSuperAdmin) {
      const tenantAdmin = await db.query.users.findFirst({
        where: eq(users.id, tenantAdminId)
      });
      if (tenantAdmin?.planId) {
        const [plan] = await db.select().from(plans).where(eq(plans.id, tenantAdmin.planId));
        if (plan) {
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(
              and(
                eq(users.adminId, tenantAdminId),
                ne(users.id, tenantAdminId),
                eq(users.status, "active")
              )
            );
          const currentActiveCount = countResult[0]?.count || 0;
          if (currentActiveCount >= plan.maxUsers) {
            return c.json(
              {
                message: `Cannot activate sub-user. Active sub-user limit reached (${currentActiveCount}/${plan.maxUsers}) for your subscription plan (${plan.name}). Please inactivate another staff account first or upgrade your plan.`
              },
              HttpStatusCodes.FORBIDDEN
            );
          }
        }
      }
    }

    await db.update(users).set({ status: newStatus, updatedAt: new Date() }).where(eq(users.id, userId));

    return c.json({ success: true, message: `User status changed to ${newStatus}`, status: newStatus }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to update status" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// 6. Delete Sub-User
export const deleteUser: Handler = async (c: any) => {
  try {
    const tenantInfo = await resolveTenantAdmin(c);
    if (!tenantInfo) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { isSuperAdmin, tenantAdminId } = tenantInfo;
    const userId = Number(c.req.param("id"));

    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (targetUser.id === tenantAdminId) {
      return c.json({ message: "Cannot delete the primary organization admin account." }, HttpStatusCodes.FORBIDDEN);
    }

    if (!isSuperAdmin && targetUser.adminId !== tenantAdminId) {
      return c.json({ message: "Forbidden" }, HttpStatusCodes.FORBIDDEN);
    }

    await db.delete(users).where(eq(users.id, userId));

    return c.json({ success: true, message: "User deleted successfully" }, HttpStatusCodes.OK);
  } catch (err: any) {
    return c.json({ message: err.message || "Failed to delete user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
