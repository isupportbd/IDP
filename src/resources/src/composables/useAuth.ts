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

export function hasAccountsAccess(): boolean {
  const subject = userRef.value as any;
  if (!subject) return false;
  // Superadmin is platform owner, not a tenant firm
  if (hasRole("superadmin")) return false;
  if (subject.plan) {
    return subject.plan.hasAccounts === true;
  }
  return false;
}

export function canAccessModule(moduleId: string): boolean {
  const subject = userRef.value as any;
  if (!subject) return false;

  // Superadmin is platform owner and does not operate tenant firm business modules
  if (hasRole("superadmin")) return false;

  // Billing module strictly requires tenant plan accounts capability
  if (moduleId === "billing" || moduleId === "accounts") {
    return hasAccountsAccess();
  }

  // Tenant Admin (firm owner) has full access to modules available in their plan
  if (isTenantAdmin()) return true;

  // Sub-user: check permissions array
  if (Array.isArray(subject.permissions)) {
    return subject.permissions.includes(moduleId);
  }

  return true;
}
