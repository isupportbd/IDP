<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    status: string | boolean | null | undefined;
    size?: "sm" | "md" | "lg";
    customLabel?: string;
  }>(),
  {
    size: "sm",
    customLabel: ""
  }
);

const badgeConfig = computed(() => {
  const val = String(props.status ?? "").toLowerCase().trim();

  if (val === "true" || val === "active" || val === "paid" || val === "submitted" || val === "completed") {
    return {
      type: "success",
      icon: "bi-check-circle-fill",
      label: props.customLabel || (val === "true" ? "Active" : val.toUpperCase())
    };
  }

  if (val === "false" || val === "inactive" || val === "cancelled" || val === "rejected" || val === "suspended") {
    return {
      type: "danger",
      icon: "bi-x-circle-fill",
      label: props.customLabel || (val === "false" ? "Inactive" : val.toUpperCase())
    };
  }

  if (val === "pending" || val === "unpaid" || val === "draft" || val === "unsubmitted") {
    return {
      type: "warning",
      icon: "bi-hourglass-split",
      label: props.customLabel || (val === "unsubmitted" ? "PENDING" : val.toUpperCase())
    };
  }

  if (val === "partial" || val === "late_submitted" || val === "overdue") {
    return {
      type: "info",
      icon: "bi-exclamation-circle-fill",
      label: props.customLabel || val.replace("_", " ").toUpperCase()
    };
  }

  return {
    type: "secondary",
    icon: "bi-circle",
    label: props.customLabel || (val ? val.toUpperCase() : "N/A")
  };
});
</script>

<template>
  <span
    class="idp-status-badge d-inline-flex align-items-center gap-1 font-monospace"
    :class="[`badge-status-${badgeConfig.type}`, size === 'sm' ? 'badge-sm' : size === 'lg' ? 'badge-lg' : 'badge-md']"
  >
    <i :class="['bi', badgeConfig.icon]" class="status-icon"></i>
    <span class="status-text">{{ badgeConfig.label }}</span>
  </span>
</template>

<style scoped>
.idp-status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  line-height: 1.2;
}

.badge-sm {
  font-size: 0.75rem;
  padding: 0.22rem 0.65rem;
}

.badge-md {
  font-size: 0.82rem;
  padding: 0.32rem 0.8rem;
}

.badge-lg {
  font-size: 0.9rem;
  padding: 0.42rem 1rem;
}

.status-icon {
  font-size: 0.85em;
}

.badge-status-warning {
  background-color: rgba(255, 193, 7, 0.14) !important;
  color: #ffc107 !important;
  border: 1px solid rgba(255, 193, 7, 0.35) !important;
}

.badge-status-success {
  background-color: rgba(25, 135, 84, 0.14) !important;
  color: #20c997 !important;
  border: 1px solid rgba(25, 135, 84, 0.35) !important;
}

.badge-status-danger {
  background-color: rgba(220, 53, 69, 0.14) !important;
  color: #f87171 !important;
  border: 1px solid rgba(220, 53, 69, 0.35) !important;
}

.badge-status-info {
  background-color: rgba(13, 202, 240, 0.14) !important;
  color: #0dcaf0 !important;
  border: 1px solid rgba(13, 202, 240, 0.35) !important;
}

.badge-status-secondary {
  background-color: rgba(108, 117, 125, 0.14) !important;
  color: #adb5bd !important;
  border: 1px solid rgba(108, 117, 125, 0.35) !important;
}
</style>
