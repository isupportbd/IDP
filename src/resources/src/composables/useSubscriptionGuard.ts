import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";

export function useSubscriptionGuard() {
  const authStore = useAuthStore();
  const toast = useToast();

  const isSuperAdmin = computed(() => {
    const user = authStore.user as any;
    const r = user?.role;
    return r === "superadmin" || (typeof r === "object" && (r?.name === "superadmin" || r?.slug === "superadmin"));
  });

  const isSubscriptionActive = computed(() => {
    if (isSuperAdmin.value) return true;
    const user = authStore.user as any;
    if (!user) return false;
    return !!user.isSubscriptionActive && (!user.shortage || user.shortage <= 0);
  });

  const shortageAmount = computed(() => {
    const user = authStore.user as any;
    return user?.shortage || 0;
  });

  const checkOrPromptRecharge = (actionName = "perform this action"): boolean => {
    if (isSuperAdmin.value) return true;
    if (!isSubscriptionActive.value) {
      toast.warning(
        `Subscription is inactive (Shortage: ৳${shortageAmount.value}). Please recharge your wallet to activate your plan.`
      );
      window.dispatchEvent(new CustomEvent("open-wallet-recharge"));
      return false;
    }
    return true;
  };

  return {
    isSubscriptionActive,
    shortageAmount,
    checkOrPromptRecharge
  };
}
