<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { AssignableUser } from "@/composables/useClientsApi";

const props = withDefaults(
  defineProps<{
    managers: AssignableUser[];
    selected: number[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: "Assign managers...",
    disabled: false
  }
);

const emit = defineEmits<{
  (e: "update:selected", value: number[]): void;
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const dropdownRef = ref<HTMLElement | null>(null);

const filteredManagers = computed(() => {
  if (!searchQuery.value.trim()) return props.managers;
  const q = searchQuery.value.toLowerCase().trim();
  return props.managers.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
  );
});

const selectedUsers = computed(() => {
  return props.managers.filter((m) => props.selected.includes(m.id));
});

const isSelected = (id: number) => props.selected.includes(id);

const toggleUser = (id: number) => {
  if (props.disabled) return;
  const current = [...props.selected];
  const idx = current.indexOf(id);
  if (idx > -1) {
    current.splice(idx, 1);
  } else {
    current.push(id);
  }
  emit("update:selected", current);
};

const selectAll = () => {
  if (props.disabled) return;
  emit(
    "update:selected",
    props.managers.map((m) => m.id)
  );
};

const clearAll = () => {
  if (props.disabled) return;
  emit("update:selected", []);
};

// Summary label text for single-line trigger
const labelText = computed(() => {
  if (selectedUsers.value.length === 0) {
    return props.placeholder;
  }
  if (selectedUsers.value.length === 1) {
    return selectedUsers.value[0].name;
  }
  return `${selectedUsers.value.length} managers assigned`;
});

// Outside click listener
const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div ref="dropdownRef" class="managers-multiselect position-relative">
    <!-- Trigger Button (Strictly Fixed 1 Line Height - Never Expands Table Rows) -->
    <button
      type="button"
      class="trigger-btn w-100 d-flex align-items-center justify-content-between text-start"
      :class="{
        'trigger-open': isOpen,
        'has-selection': selectedUsers.length > 0
      }"
      :disabled="disabled"
      @click="isOpen = !isOpen"
    >
      <div class="d-flex align-items-center gap-2 overflow-hidden text-truncate me-2">
        <i
          class="bi flex-shrink-0"
          :class="
            selectedUsers.length === 0
              ? 'bi-person-plus text-muted'
              : selectedUsers.length === 1
              ? 'bi-person-fill text-primary'
              : 'bi-people-fill text-info'
          "
        ></i>
        <span
          class="text-truncate small"
          :class="selectedUsers.length === 0 ? 'text-muted' : 'text-light fw-medium'"
        >
          {{ labelText }}
        </span>
      </div>

      <i
        class="bi text-muted small flex-shrink-0 transition-transform"
        :class="isOpen ? 'bi-chevron-up' : 'bi-chevron-down'"
      ></i>
    </button>

    <!-- Dropdown Menu Popover (Scrollable List with Search - Fits up to 500+ managers) -->
    <div
      v-if="isOpen"
      class="dropdown-popover shadow-lg position-absolute start-0 mt-1 z-3"
    >
      <!-- Search Input Header -->
      <div class="p-2 border-bottom border-secondary border-opacity-50">
        <div class="search-wrap position-relative">
          <i class="bi bi-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm idp-search-box"
            placeholder="Search managers..."
            autoFocus
          />
        </div>
      </div>

      <!-- Quick Actions Header -->
      <div class="d-flex align-items-center justify-content-between px-3 py-1 bg-dark bg-opacity-75 border-bottom border-secondary border-opacity-25 text-muted small" style="font-size: 0.72rem;">
        <span>{{ selectedUsers.length }} of {{ managers.length }} selected</span>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-link btn-xs text-primary p-0 text-decoration-none" @click="selectAll">
            Select All
          </button>
          <span class="text-secondary">•</span>
          <button type="button" class="btn btn-link btn-xs text-secondary p-0 text-decoration-none" @click="clearAll">
            Clear
          </button>
        </div>
      </div>

      <!-- Users List (Scrollable) -->
      <div class="users-list py-1 overflow-auto" style="max-height: 220px;">
        <div
          v-if="filteredManagers.length === 0"
          class="text-center py-3 text-muted small"
        >
          No managers found.
        </div>

        <div
          v-for="mgr in filteredManagers"
          :key="mgr.id"
          class="user-item d-flex align-items-center justify-content-between px-3 py-2 cursor-pointer"
          :class="{ 'user-item-selected': isSelected(mgr.id) }"
          @click="toggleUser(mgr.id)"
        >
          <div class="d-flex align-items-center gap-2 overflow-hidden w-100">
            <div
              class="check-box d-flex align-items-center justify-content-center flex-shrink-0"
              :class="{ 'check-box-checked': isSelected(mgr.id) }"
            >
              <i v-if="isSelected(mgr.id)" class="bi bi-check text-white fw-bold"></i>
            </div>
            <div class="overflow-hidden flex-grow-1">
              <div class="fw-semibold text-white small text-truncate">{{ mgr.name }}</div>
              <div class="text-muted font-monospace text-truncate" style="font-size: 0.72rem;">{{ mgr.email }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.managers-multiselect {
  width: 100%;
  min-width: 200px;
  max-width: 280px;
}

.trigger-btn {
  background: #15181c;
  border: 1px solid #3a4149;
  border-radius: 6px;
  padding: 0 10px;
  height: 34px;
  min-height: 34px;
  max-height: 34px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.trigger-btn:hover {
  border-color: #495057;
  background: #1a1e24;
}

.trigger-open {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.15);
  background: #181c22 !important;
}

.trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dropdown-popover {
  background: #1e2227;
  border: 1px solid #3a4149;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
  min-width: 260px;
}

.search-wrap {
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 0.78rem;
  pointer-events: none;
}

.idp-search-box {
  background: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  padding-left: 30px !important;
  border-radius: 4px;
  font-size: 0.8rem;
  height: 30px;
}

.idp-search-box:focus {
  border-color: #0d6efd !important;
  box-shadow: none !important;
}

.user-item {
  transition: background 0.12s ease;
}

.user-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.user-item-selected {
  background: rgba(255, 255, 255, 0.03);
}

.user-item-selected:hover {
  background: rgba(255, 255, 255, 0.08);
}

.check-box {
  width: 18px;
  height: 18px;
  border: 1px solid #495057;
  border-radius: 4px;
  background: #15181c;
  transition: all 0.15s ease;
  font-size: 0.85rem;
}

.check-box-checked {
  background: #0d6efd !important;
  border-color: #0d6efd !important;
}

.cursor-pointer {
  cursor: pointer;
}

.btn-xs {
  font-size: 0.72rem;
  line-height: 1;
}

.transition-transform {
  transition: transform 0.15s ease;
}
</style>
