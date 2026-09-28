<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    isPassword?: boolean;
  }>(),
  {
    isPassword: false
  }
);

const isVisible = ref(!props.isPassword);
const copied = ref(false);

const copyToClipboard = async () => {
  if (!props.value) return;
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch (err) {
    console.error("Failed to copy credential:", err);
  }
};
</script>

<template>
  <div class="credential-copy-pill d-inline-flex align-items-center gap-1.5 px-2 py-1 rounded bg-dark border border-secondary border-opacity-25 font-monospace">
    <span class="text-secondary small fw-medium" style="font-size: 0.72rem;">{{ label }}:</span>
    <span class="text-light small text-truncate" style="max-width: 140px; font-size: 0.8rem;">
      {{ isVisible ? value || '—' : '••••••••' }}
    </span>

    <button
      v-if="isPassword && value"
      type="button"
      class="btn btn-link btn-sm p-0 text-muted border-0 bg-transparent ms-1"
      style="font-size: 0.75rem;"
      :title="isVisible ? 'Hide' : 'Show'"
      @click="isVisible = !isVisible"
    >
      <i :class="['bi', isVisible ? 'bi-eye-slash' : 'bi-eye']"></i>
    </button>

    <button
      v-if="value"
      type="button"
      class="btn btn-link btn-sm p-0 text-muted border-0 bg-transparent ms-1"
      style="font-size: 0.75rem;"
      :title="copied ? 'Copied!' : 'Copy to clipboard'"
      @click="copyToClipboard"
    >
      <i :class="['bi', copied ? 'bi-check-lg text-success fw-bold' : 'bi-clipboard']"></i>
    </button>
  </div>
</template>

<style scoped>
.credential-copy-pill {
  background: rgba(15, 23, 42, 0.8);
  transition: border-color 0.2s;
}
.credential-copy-pill:hover {
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
