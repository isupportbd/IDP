<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    value: string | number;
    icon?: string;
    variant?: "primary" | "success" | "warning" | "danger" | "info" | "purple";
    subtext?: string;
    loading?: boolean;
  }>(),
  {
    icon: "bi-graph-up",
    variant: "primary",
    subtext: "",
    loading: false
  }
);
</script>

<template>
  <div class="stat-card p-3 rounded-3 h-100 position-relative overflow-hidden">
    <div class="d-flex align-items-center justify-content-between mb-2">
      <span class="text-secondary small fw-medium text-uppercase tracking-wider" style="font-size: 0.75rem;">{{ title }}</span>
      <div
        class="stat-icon-badge rounded-circle d-flex align-items-center justify-content-center"
        :class="`variant-${variant}`"
      >
        <i :class="['bi', icon]"></i>
      </div>
    </div>

    <div class="stat-value">
      <div v-if="loading" class="spinner-border spinner-border-sm text-secondary" role="status"></div>
      <div v-else class="fs-4 fw-bold text-white font-monospace">{{ value }}</div>
    </div>

    <div v-if="subtext" class="stat-subtext text-muted mt-1 small" style="font-size: 0.72rem;">
      {{ subtext }}
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.16);
}
.stat-icon-badge {
  width: 34px;
  height: 34px;
  font-size: 1rem;
}
.variant-primary {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
.variant-success {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.variant-warning {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
}
.variant-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.variant-info {
  background: rgba(6, 182, 212, 0.15);
  color: #22d3ee;
}
.variant-purple {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}
.tracking-wider {
  letter-spacing: 0.05em;
}
</style>
