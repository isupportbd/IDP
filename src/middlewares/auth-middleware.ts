import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { cookie, db, jwt } from "@/framework/facade.js";
import { refreshTokens, users } from "@/modules/auth/database/models/user.js";

export async function authMiddleware(c: Context, next: Next) {
  let accessToken = await cookie.getAuth(c);

  if (!accessToken) {
    const authHeader = c.req.header("Authorization") || c.req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7).trim();
    }
  }

  if (accessToken) {
    const accessPayload = await jwt.verifyToken(accessToken, "access");

    if (accessPayload && accessPayload.id) {
      // Fast path: verified cryptographically signed JWT payload contains user identity
      if (accessPayload.role !== undefined) {
        c.set("auth", {
          ...accessPayload,
          id: Number(accessPayload.id),
          email: accessPayload.email,
          adminId: accessPayload.adminId !== undefined ? (accessPayload.adminId ? Number(accessPayload.adminId) : null) : null,
          roleId: accessPayload.roleId ? Number(accessPayload.roleId) : null,
          role: accessPayload.role || null
        });
        return await next();
      }

      // Fallback for older tokens lacking role in payload
      const user = await db.query.users.findFirst({
        where: eq(users.id, accessPayload.id as number),
        with: { role: true }
      });

      if (!user) {
        cookie.deleteAuth(c);
        cookie.deleteRefresh(c);
        return c.json({ message: "Unauthorized" }, 401);
      }

      c.set("auth", {
        ...accessPayload,
        id: user.id,
        email: user.email,
        adminId: user.adminId ?? null,
        roleId: user.role?.id ?? null,
        role: user.role?.name ?? null
      });
      return await next();
    }
  }

  const refreshToken = await cookie.getRefresh(c);

  if (!refreshToken) {
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Unauthorized" }, 401);
  }

  const refreshPayload = await jwt.verifyToken(refreshToken, "refresh");

  if (!refreshPayload?.jti) {
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Invalid token" }, 401);
  }

  const storedToken = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.jti, refreshPayload.jti as string)
  });

  if (!storedToken || storedToken.revoked) {
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Invalid token" }, 401);
  }

  if (storedToken.expiresAt.getTime() < Date.now()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Invalid token" }, 401);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, refreshPayload.id as number),
    with: { role: true }
  });

  if (!user) {
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Unauthorized" }, 401);
  }

  const newAccessToken = await jwt.generateToken(
    {
      id: user.id,
      email: user.email,
      adminId: user.adminId ?? null,
      roleId: user.role?.id ?? null,
      role: user.role?.name ?? null
    },
    "access"
  );

  await cookie.setAuth(c, newAccessToken.token);
  c.set("auth", {
    id: user.id,
    email: user.email,
    adminId: user.adminId ?? null,
    roleId: user.role?.id ?? null,
    role: user.role?.name ?? null,
    type: "access"
  });
  return await next();
}
