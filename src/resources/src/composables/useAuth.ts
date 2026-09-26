import { computed, type Ref, readonly, ref } from "vue";

type UnknownRecord = Record<string, unknown>;

export type RoleLike = {
  id?: string | number;
  name?: string;
  title?: string;
  slug?: string;
} & UnknownRecord;

export type AuthUser = UnknownRecord & {
  id?: string | number;
  name?: string;
  role?: RoleLike | null;
  roles?: RoleLike[] | null;
};

const userRef: Ref<AuthUser | null> = ref(null);

export function setUser(user: AuthUser | null) {
  userRef.value = user;
}

export function clearUser() {
  userRef.value = null;
}

export function useAuth() {
  return {
    user: readonly(userRef),
    isAuthenticated: computed(() => !!userRef.value),
    setUser,
    clearUser
  };
}

export function hasRole(...wanted: string[]): boolean {
  const subject = userRef.value as any;
  if (!subject) return false;

  const current = (subject.roles ?? (subject.role ? [subject.role] : []))
    .map((item: any) => (item.name || item.title || item.slug || (typeof item === 'string' ? item : "")).toLowerCase().trim())
    .filter(Boolean);

  if (!wanted.length) return current.length > 0;

  const expected = wanted.map((item) => item.toLowerCase().trim()).filter(Boolean);
  return current.some((item: string) => expected.includes(item));
}

export function isTenantAdmin(): boolean {
  const subject = userRef.value as any;
  if (!subject) return false;
  if (hasRole("superadmin")) return false;
  const roleName = (typeof subject.role === "object" ? subject.role?.name : subject.role) || "";
  return roleName === "admin" || !subject.adminId;
}

export function canAccessModule(moduleId: string): boolean {
  const subject = userRef.value as any;
  if (!subject) return false;

  // Superadmin has access to everything
  if (hasRole("superadmin")) return true;

  // Tenant Admin (firm owner) has full access to all modules
  if (isTenantAdmin()) return true;

  // Sub-user: check permissions array
  if (Array.isArray(subject.permissions)) {
    return subject.permissions.includes(moduleId);
  }

  return true;
}
