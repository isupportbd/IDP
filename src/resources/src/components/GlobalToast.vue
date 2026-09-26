<template>
  <div
    class="position-fixed top-0 end-0 p-3"
    style="z-index: 109999; pointer-events: none;"
  >
    <transition-group name="toast-slide">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast show align-items-center border-0 shadow-lg mb-2 text-white"
        :class="{
          'bg-success': toast.type === 'success',
          'bg-danger': toast.type === 'danger',
          'bg-warning text-dark': toast.type === 'warning',
          'bg-info text-dark': toast.type === 'info'
        }"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style="pointer-events: auto; min-width: 280px; max-width: 420px; border-radius: 8px; backdrop-filter: blur(8px);"
      >
        <div class="d-flex align-items-center p-2.5 px-3">
          <div class="me-2 fs-5 d-flex align-items-center">
            <i v-if="toast.type === 'success'" class="bi bi-check-circle-fill"></i>
            <i v-else-if="toast.type === 'danger'" class="bi bi-exclamation-triangle-fill"></i>
            <i v-else-if="toast.type === 'warning'" class="bi bi-exclamation-circle-fill"></i>
            <i v-else class="bi bi-info-circle-fill"></i>
          </div>
          <div class="toast-body p-0 fw-medium small flex-grow-1">
            {{ toast.message }}
          </div>
          <button
            type="button"
            class="btn-close ms-2"
            :class="toast.type === 'warning' || toast.type === 'info' ? 'btn-close-dark' : 'btn-close-white'"
            aria-label="Close"
            @click="remove(toast.id)"
          ></button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { toasts, remove } = useToast();
</script>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
</style>
