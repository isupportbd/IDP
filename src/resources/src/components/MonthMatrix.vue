<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    availableMonths?: string[];
    purchaseMonths?: string[];
    submissionMonths?: string[];
    submissionsMap?: Record<string, string>;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    availableMonths: () => [],
    purchaseMonths: () => [],
    submissionMonths: () => [],
    submissionsMap: () => ({}),
    placeholder: "Select Month...",
    disabled: false
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", val: string): void;
  (e: "change", val: string): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

// Active viewing year inside the popover matrix
const activeYear = ref<number>(new Date().getFullYear());

// Effective purchase months list (fallback to availableMonths if purchaseMonths not provided)
const effectivePurchaseMonths = computed(() => {
  if (props.purchaseMonths && props.purchaseMonths.length > 0) {
    return props.purchaseMonths;
  }
  return props.availableMonths || [];
});

// Extract all relevant years dynamically (years with data + current year ± 2)
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>();

  // Always include a reasonable default window around current year
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    yearsSet.add(y);
  }

  // Include years from modelValue
  if (props.modelValue) {
    const yr = parseInt(props.modelValue.split("-")[0]);
    if (!isNaN(yr)) yearsSet.add(yr);
  }

  // Include years from purchase months
  effectivePurchaseMonths.value.forEach((m) => {
    const yr = parseInt(m.split("-")[0]);
    if (!isNaN(yr)) yearsSet.add(yr);
  });

  // Include years from submission months
  (props.submissionMonths || []).forEach((m) => {
    const yr = parseInt(m.split("-")[0]);
    if (!isNaN(yr)) yearsSet.add(yr);
  });

  return Array.from(yearsSet).sort((a, b) => b - a);
});

// Sync active year with modelValue
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      const yr = parseInt(newVal.split("-")[0]);
      if (!isNaN(yr)) activeYear.value = yr;
    }
  },
  { immediate: true }
);

// Helper methods for Month Matrix Status
const getMonthKey = (year: number, monthNum: number) => {
  return `${year}-${String(monthNum).padStart(2, "0")}`;
};

// Check if month has submission ID
const hasSubmission = (year: number, monthNum: number) => {
  const key = getMonthKey(year, monthNum);
  return (
    (props.submissionMonths && props.submissionMonths.includes(key)) ||
    Boolean(props.submissionsMap && props.submissionsMap[key])
  );
};

// Check if month has purchase records
const hasPurchases = (year: number, monthNum: number) => {
  const key = getMonthKey(year, monthNum);
  return effectivePurchaseMonths.value.includes(key);
};

// Check if month is selected
const isSelected = (year: number, monthNum: number) => {
  const key = getMonthKey(year, monthNum);
  return props.modelValue === key;
};


// Month Names
const MONTH_NAMES = [
  { num: 1, short: "Jan", full: "January" },
  { num: 2, short: "Feb", full: "February" },
  { num: 3, short: "Mar", full: "March" },
  { num: 4, short: "Apr", full: "April" },
  { num: 5, short: "May", full: "May" },
  { num: 6, short: "Jun", full: "June" },
  { num: 7, short: "Jul", full: "July" },
  { num: 8, short: "Aug", full: "August" },
  { num: 9, short: "Sep", full: "September" },
  { num: 10, short: "Oct", full: "October" },
  { num: 11, short: "Nov", full: "November" },
  { num: 12, short: "Dec", full: "December" }
];

// Display label on the input bar
const displayLabel = computed(() => {
  if (!props.modelValue) return props.placeholder;
  const [y, m] = props.modelValue.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  if (isNaN(d.getTime())) return props.modelValue;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
});

const isPlaceholder = computed(() => !props.modelValue);

// Select Month
const selectMonth = (year: number, monthNum: number) => {
  const key = getMonthKey(year, monthNum);
  emit("update:modelValue", key);
  emit("change", key);
  isOpen.value = false;
};

// Year Navigation
const prevYear = () => {
  activeYear.value -= 1;
};

const nextYear = () => {
  activeYear.value += 1;
};

// Sequential Navigation (< and > buttons on the main bar)
const prevMonth = () => {
  if (props.disabled) return;
  let year: number;
  let month: number;

  if (props.modelValue) {
    const [y, m] = props.modelValue.split("-").map(Number);
    year = y;
    month = m - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const key = `${year}-${String(month).padStart(2, "0")}`;
  emit("update:modelValue", key);
  emit("change", key);
};

const nextMonth = () => {
  if (props.disabled) return;
  let year: number;
  let month: number;

  if (props.modelValue) {
    const [y, m] = props.modelValue.split("-").map(Number);
    year = y;
    month = m + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const key = `${year}-${String(month).padStart(2, "0")}`;
  emit("update:modelValue", key);
  emit("change", key);
};

// Outside click handling
const handleOutsideClick = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>

<template>
  <div ref="containerRef" class="month-matrix-container position-relative">
    <!-- Bar with Direct Stepper -->
    <div class="month-matrix-bar d-flex align-items-center" :class="{ disabled: props.disabled }">
      <!-- Left Prev Month Button -->
      <button
        type="button"
        class="btn-matrix-step left-step"
        :disabled="props.disabled"
        title="Previous month"
        @click.stop="prevMonth"
      >
        <i class="bi bi-chevron-left"></i>
      </button>

      <!-- Center Trigger Area (Click to open matrix popover) -->
      <div
        class="matrix-trigger-area flex-grow-1 text-center user-select-none"
        :class="{ active: isOpen }"
        @click="!props.disabled && (isOpen = !isOpen)"
      >
        <span class="matrix-label" :class="{ 'is-placeholder': isPlaceholder }">
          {{ displayLabel }}
        </span>
      </div>

      <!-- Right Next Month Button -->
      <button
        type="button"
        class="btn-matrix-step right-step"
        :disabled="props.disabled"
        title="Next month"
        @click.stop="nextMonth"
      >
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>

    <!-- Dynamic Smart Year-Tabbed Month Matrix Popover -->
    <div v-if="isOpen" class="month-matrix-popover idp-card shadow-lg p-3">
      <!-- Year Selector with Stepper and Chips -->
      <div class="year-controls mb-3 pb-2 border-bottom border-secondary border-opacity-25">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <button
            type="button"
            class="btn btn-sm btn-dark text-muted py-0 px-2"
            title="Previous Year"
            @click.stop="prevYear"
          >
            <i class="bi bi-chevron-left"></i>
          </button>

          <span class="fw-bold text-white fs-6">
            {{ activeYear }}
          </span>

          <button
            type="button"
            class="btn btn-sm btn-dark text-muted py-0 px-2"
            title="Next Year"
            @click.stop="nextYear"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>

        <!-- Quick Year Chips -->
        <div class="year-chips d-flex gap-1 overflow-auto pb-1">
          <button
            v-for="yr in availableYears"
            :key="yr"
            type="button"
            class="btn-year-tab px-2 py-0 rounded-pill small fw-semibold text-nowrap"
            :class="activeYear === yr ? 'active' : 'inactive'"
            @click.stop="activeYear = yr"
          >
            {{ yr }}
          </button>
        </div>
      </div>

      <!-- 12-Month Matrix Grid (4 columns x 3 rows) -->
      <div class="matrix-grid">
        <button
          v-for="m in MONTH_NAMES"
          :key="m.num"
          type="button"
          class="matrix-month-btn position-relative d-flex flex-column align-items-center justify-content-center p-2 rounded"
          :class="{
            'selected-month': isSelected(activeYear, m.num),
            'has-sub': hasSubmission(activeYear, m.num) && !isSelected(activeYear, m.num),
            'has-purchase': !hasSubmission(activeYear, m.num) && hasPurchases(activeYear, m.num) && !isSelected(activeYear, m.num),
            'no-purchase': !hasSubmission(activeYear, m.num) && !hasPurchases(activeYear, m.num) && !isSelected(activeYear, m.num)
          }"
          :title="
            hasSubmission(activeYear, m.num)
              ? 'Submitted - Submission ID available'
              : hasPurchases(activeYear, m.num)
              ? 'Purchases Available'
              : 'No Purchases'
          "
          @click.stop="selectMonth(activeYear, m.num)"
        >
          <span class="month-short fw-bold">{{ m.short }}</span>

          <!-- Dynamic Dot Indicators based on requirements -->
          <!-- 1. Blue Dot: Submission ID Present -->
          <span
            v-if="hasSubmission(activeYear, m.num)"
            class="dot-indicator dot-blue position-absolute"
            title="Submitted (Blue Dot)"
          ></span>

          <!-- 2. Green Dot: Has Purchases (No submission) -->
          <span
            v-else-if="hasPurchases(activeYear, m.num)"
            class="dot-indicator dot-green position-absolute"
            title="Has Purchases (Green Dot)"
          ></span>

          <!-- 3. Red Dot: No Purchases (No submission) -->
          <span
            v-else
            class="dot-indicator dot-red position-absolute"
            title="No Purchases (Red Dot)"
          ></span>
        </button>
      </div>

      <!-- Footer Color Legend -->
      <div class="matrix-legend pt-2 mt-2 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2 flex-wrap" style="font-size: 0.7rem;">
          <span class="d-flex align-items-center gap-1 text-info">
            <span class="dot-legend-circle dot-blue"></span> Submitted
          </span>
          <span class="d-flex align-items-center gap-1 text-success">
            <span class="dot-legend-circle dot-green"></span> Purchases
          </span>
          <span class="d-flex align-items-center gap-1 text-danger">
            <span class="dot-legend-circle dot-red"></span> No Purchases
          </span>
        </div>
        <button
          type="button"
          class="btn btn-link btn-sm text-decoration-none text-muted p-0"
          style="font-size: 0.72rem;"
          @click.stop="isOpen = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-matrix-container {
  width: 100%;
}

.month-matrix-bar {
  background-color: #1a1d21;
  border: 1px solid #49515a;
  border-radius: 6px;
  height: 38px;
  display: flex;
  align-items: center;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.month-matrix-bar:hover:not(.disabled) {
  border-color: #6c757d;
}

.month-matrix-bar:focus-within:not(.disabled) {
  border-color: #3b8eed;
  box-shadow: 0 0 0 2px rgba(59, 142, 237, 0.25);
}

.month-matrix-bar.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-matrix-step {
  background: transparent;
  border: none;
  color: #adb5bd;
  width: 32px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  padding: 0;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.left-step {
  border-right: 1px solid #3b424b;
}

.right-step {
  border-left: 1px solid #3b424b;
}

.btn-matrix-step:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.btn-matrix-step:disabled {
  color: #49515a;
  cursor: not-allowed;
}

.matrix-trigger-area {
  cursor: pointer;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  color: #f8f9fa;
  font-size: 0.9rem;
  transition: background 0.15s ease;
}

.matrix-trigger-area:hover {
  background: rgba(255, 255, 255, 0.04);
}

.matrix-label {
  font-weight: 500;
  white-space: nowrap;
}

.matrix-label.is-placeholder {
  color: #6c757d;
  font-weight: 400;
}

/* Popover */
.month-matrix-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 290px;
  z-index: 1060;
  background: #1a1d21 !important;
  border: 1px solid #49515a !important;
  border-radius: 8px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
}

/* Year Tabs */
.btn-year-tab {
  border: none;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-year-tab.active {
  background: #0d6efd;
  color: #ffffff;
}

.btn-year-tab.inactive {
  background: #2b3035;
  color: #adb5bd;
}

.btn-year-tab.inactive:hover {
  background: #343a40;
  color: #f8f9fa;
}

/* Matrix Grid */
.matrix-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.matrix-month-btn {
  background: #212529;
  border: 1px solid #343a40;
  color: #ced4da;
  font-size: 0.8rem;
  height: 42px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.matrix-month-btn:hover {
  background: #2c3238;
  border-color: #49515a;
  color: #ffffff;
}

.matrix-month-btn.selected-month {
  background: #0d6efd !important;
  border-color: #0d6efd !important;
  color: #ffffff !important;
}

.matrix-month-btn.has-sub {
  background: rgba(13, 110, 253, 0.12);
  border-color: rgba(13, 110, 253, 0.35);
  color: #6ea8fe;
}

.matrix-month-btn.has-purchase {
  background: rgba(25, 135, 84, 0.12);
  border-color: rgba(25, 135, 84, 0.35);
  color: #75b798;
}

.matrix-month-btn.no-purchase {
  background: rgba(220, 53, 69, 0.06);
  border-color: rgba(220, 53, 69, 0.2);
  color: #adb5bd;
}

/* Dynamic Dot Indicators */
.dot-indicator {
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-blue {
  background: #0d6efd;
  box-shadow: 0 0 4px rgba(13, 110, 253, 0.8);
}

.dot-green {
  background: #198754;
  box-shadow: 0 0 4px rgba(25, 135, 84, 0.8);
}

.dot-red {
  background: #dc3545;
  box-shadow: 0 0 4px rgba(220, 53, 69, 0.8);
}

.selected-month .dot-indicator {
  background: #ffffff !important;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
}

.dot-legend-circle {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
