<script setup lang="ts">
import { ref, computed } from "vue";

const model = defineModel<string>({ default: "" });

const emit = defineEmits<{
  (e: "change", val: string): void;
}>();

const monthInputRef = ref<HTMLInputElement | null>(null);

const displayMonthName = computed(() => {
  if (!model.value) return "All Months";
  const parts = model.value.split("-").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return model.value;
  const d = new Date(parts[0], parts[1] - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
});

const triggerMonthPicker = () => {
  if (monthInputRef.value) {
    if (typeof monthInputRef.value.showPicker === "function") {
      monthInputRef.value.showPicker();
    } else {
      monthInputRef.value.focus();
      monthInputRef.value.click();
    }
  }
};

const prevMonth = () => {
  if (!model.value) {
    const now = new Date();
    model.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const parts = model.value.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 2, 1);
  const nextVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  model.value = nextVal;
  emit("change", nextVal);
};

const nextMonth = () => {
  if (!model.value) {
    const now = new Date();
    model.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const parts = model.value.split("-").map(Number);
  const d = new Date(parts[0], parts[1], 1);
  const nextVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  model.value = nextVal;
  emit("change", nextVal);
};

const onInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  model.value = target.value;
  emit("change", target.value);
};
</script>

<template>
  <div class="month-selector-bar">
    <button
      type="button"
      class="month-nav-btn left-nav-btn"
      title="Previous Month"
      @click="prevMonth"
    >
      <i class="bi bi-chevron-left"></i>
    </button>
    <div
      class="month-text-center"
      title="Click to select month"
      @click="triggerMonthPicker"
    >
      <span class="month-label">{{ displayMonthName }}</span>
      <input
        ref="monthInputRef"
        :value="model"
        type="month"
        class="hidden-month-input"
        tabindex="-1"
        aria-hidden="true"
        @input="onInputChange"
      />
    </div>
    <button
      type="button"
      class="month-nav-btn right-nav-btn"
      title="Next Month"
      @click="nextMonth"
    >
      <i class="bi bi-chevron-right"></i>
    </button>
  </div>
</template>

<style scoped>
.month-selector-bar {
  background: #181b1f;
  border: 1px solid #3b424b;
  border-radius: 6px;
  height: 38px;
  display: flex;
  align-items: center;
  overflow: hidden;
  user-select: none;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.month-selector-bar:hover,
.month-selector-bar:focus-within {
  border-color: #3b8eed;
}

.month-nav-btn {
  background: transparent;
  border: none;
  color: #adb5bd;
  height: 100%;
  width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.month-nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.left-nav-btn {
  border-right: 1px solid #3b424b;
}

.right-nav-btn {
  border-left: 1px solid #3b424b;
}

.month-text-center {
  height: 100%;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 10px;
  position: relative;
  transition: background 0.15s;
}

.month-text-center:hover {
  background: rgba(255, 255, 255, 0.04);
}

.month-label {
  color: #f8f9fa;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.3px;
  pointer-events: none;
}

.hidden-month-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
}

.hidden-month-input::-webkit-calendar-picker-indicator {
  display: none !important;
  opacity: 0 !important;
  -webkit-appearance: none;
}
</style>
