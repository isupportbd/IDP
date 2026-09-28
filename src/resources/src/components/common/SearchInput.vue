<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    maxWidth?: string;
    minWidth?: string;
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    debounce?: number;
    autoFocus?: boolean;
  }>(),
  {
    placeholder: "Search...",
    maxWidth: "320px",
    minWidth: "200px",
    size: "sm",
    disabled: false,
    debounce: 0,
    autoFocus: false
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "clear"): void;
  (e: "search", value: string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const internalValue = ref(props.modelValue || "");
let debounceTimer: any = null;

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== internalValue.value) {
      internalValue.value = newVal || "";
    }
  }
);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = target.value;
  internalValue.value = val;

  if (props.debounce && props.debounce > 0) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emit("update:modelValue", val);
      emit("search", val);
    }, props.debounce);
  } else {
    emit("update:modelValue", val);
    emit("search", val);
  }
};

const handleClear = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  internalValue.value = "";
  emit("update:modelValue", "");
  emit("clear");
  emit("search", "");
  inputRef.value?.focus();
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    handleClear();
  } else if (e.key === "Enter") {
    if (debounceTimer) clearTimeout(debounceTimer);
    emit("update:modelValue", internalValue.value);
    emit("search", internalValue.value);
  }
};

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div
    class="idp-search-container position-relative"
    :style="{
      maxWidth: maxWidth,
      minWidth: minWidth,
      width: '100%'
    }"
  >
    <i class="bi bi-search idp-search-icon" aria-hidden="true"></i>
    <input
      ref="inputRef"
      :value="internalValue"
      type="text"
      class="form-control idp-search-input"
      :class="[`search-${size}`]"
      :placeholder="placeholder"
      :disabled="disabled"
      :autofocus="autoFocus"
      autocomplete="off"
      spellcheck="false"
      @input="handleInput"
      @keydown="handleKeyDown"
    />
    <button
      v-if="internalValue"
      type="button"
      class="idp-clear-btn"
      :class="[`clear-${size}`]"
      title="Clear search (Esc)"
      tabindex="-1"
      @click="handleClear"
    >
      <i class="bi bi-x"></i>
    </button>
  </div>
</template>

<style scoped>
.idp-search-container {
  display: flex;
  align-items: center;
  position: relative;
}

.idp-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
  font-size: 0.82rem;
  z-index: 2;
}

.idp-search-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  width: 100%;
  transition: all 0.15s ease-in-out;
  padding-left: 34px !important;
  padding-right: 32px !important;
}

.search-sm {
  font-size: 0.84rem;
  height: 34px;
}

.search-md {
  font-size: 0.9rem;
  height: 38px;
}

.search-lg {
  font-size: 0.96rem;
  height: 44px;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.18rem rgba(13, 110, 253, 0.22) !important;
  background-color: #181c22 !important;
  outline: none;
}

.idp-search-input::placeholder {
  color: #6c757d !important;
  opacity: 0.85;
}

.idp-search-input:disabled {
  background-color: #1a1e24 !important;
  opacity: 0.6;
  cursor: not-allowed;
}

.idp-clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #8a939e;
  cursor: pointer;
  padding: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.15s ease;
  font-size: 0.95rem;
}

.idp-clear-btn:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.12);
}

.clear-sm {
  font-size: 0.95rem;
}

.clear-md {
  font-size: 1.05rem;
  width: 24px;
  height: 24px;
}

.clear-lg {
  font-size: 1.15rem;
  width: 28px;
  height: 28px;
}
</style>
