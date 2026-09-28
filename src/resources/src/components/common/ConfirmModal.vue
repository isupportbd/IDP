<script setup lang="ts">
withDefaults(
  defineProps<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    loading?: boolean;
    icon?: string;
  }>(),
  {
    confirmText: "Confirm",
    cancelText: "Cancel",
    isDanger: true,
    loading: false,
    icon: "bi-exclamation-triangle-fill"
  }
);

defineEmits<{
  (e: "confirm"): void;
  (e: "close"): void;
}>();
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
    <div class="modal-dialog-custom p-4 rounded-4 shadow-2xl position-relative">
      <div class="d-flex align-items-start gap-3">
        <div
          class="icon-wrapper rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          :class="isDanger ? 'bg-danger bg-opacity-10 text-danger' : 'bg-primary bg-opacity-10 text-primary'"
        >
          <i :class="['bi', icon, 'fs-4']"></i>
        </div>

        <div class="flex-grow-1">
          <h6 class="modal-title fw-bold text-white mb-1">{{ title }}</h6>
          <p class="modal-desc text-secondary small mb-4">{{ description }}</p>

          <div class="d-flex justify-content-end gap-2">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary px-3"
              :disabled="loading"
              @click="$emit('close')"
            >
              {{ cancelText }}
            </button>

            <button
              type="button"
              class="btn btn-sm px-3 d-inline-flex align-items-center gap-1.5"
              :class="isDanger ? 'btn-danger' : 'btn-primary'"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              <span v-if="loading" class="spinner-border spinner-border-sm" role="status"></span>
              <span>{{ confirmText }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 1100;
  animation: fadeIn 0.15s ease-out;
}
.modal-dialog-custom {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  width: 100%;
  max-width: 440px;
  animation: scaleUp 0.15s ease-out;
}
.icon-wrapper {
  width: 44px;
  height: 44px;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
