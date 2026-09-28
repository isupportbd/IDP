<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface ClientOption {
  id: number;
  name?: string;
  companyName?: string;
  bin?: string;
  binNumber?: string;
  mobile?: string;
  vatServiceType?: string;
  vatUserId?: string;
  vatPassword?: string;
}

const props = withDefaults(
  defineProps<{
    clients: ClientOption[];
    modelValue?: number | null;
    placeholder?: string;
    disabled?: boolean;
    showBinOnly?: boolean;
  }>(),
  {
    modelValue: null,
    placeholder: "Type to search Client or BIN...",
    disabled: false,
    showBinOnly: false
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", id: number | null): void;
  (e: "select", client: ClientOption | null): void;
}>();

const searchText = ref("");
const isDropdownOpen = ref(false);

// Match initial modelValue to search input text
watch(
  () => props.modelValue,
  (newId) => {
    if (!newId) {
      if (!searchText.value.trim()) searchText.value = "";
      return;
    }
    const match = props.clients.find((c) => c.id === newId);
    if (match) {
      searchText.value = match.name || match.companyName || "";
    }
  },
  { immediate: true }
);

// Only filters and returns items when typing has started and no client is selected
const filteredList = computed(() => {
  if (!searchText.value.trim() || props.modelValue) return [];
  const q = searchText.value.toLowerCase().trim();
  return props.clients.filter((c) => {
    const name = (c.name || c.companyName || "").toLowerCase();
    const bin = (c.bin || c.binNumber || "").toLowerCase();
    const mobile = (c.mobile || "").toLowerCase();
    return name.includes(q) || bin.includes(q) || mobile.includes(q);
  });
});

const onInput = () => {
  emit("update:modelValue", null);
  emit("select", null);
  isDropdownOpen.value = searchText.value.trim().length > 0;
};

const onFocus = () => {
  isDropdownOpen.value = searchText.value.trim().length > 0 && !props.modelValue;
};

const onBlur = () => {
  setTimeout(() => {
    isDropdownOpen.value = false;
  }, 200);
};

const selectItem = (c: ClientOption) => {
  searchText.value = c.name || c.companyName || "";
  isDropdownOpen.value = false;
  emit("update:modelValue", c.id);
  emit("select", c);
};

const clearSelection = () => {
  searchText.value = "";
  isDropdownOpen.value = false;
  emit("update:modelValue", null);
  emit("select", null);
};
</script>

<template>
  <div class="client-search-select position-relative">
    <div class="input-wrapper position-relative">
      <i class="bi bi-building position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
      <input
        v-model="searchText"
        type="text"
        class="form-control idp-input"
        :style="{
          paddingLeft: '38px !important',
          paddingRight: searchText ? '34px !important' : '14px !important',
          height: '38px'
        }"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button
        v-if="searchText && !disabled"
        type="button"
        class="btn-clear position-absolute top-50 end-0 translate-middle-y me-2 text-muted border-0 bg-transparent p-0"
        @mousedown.prevent="clearSelection"
      >
        <i class="bi bi-x-circle-fill text-secondary"></i>
      </button>
    </div>

    <!-- Dropdown (Shows only when typing) -->
    <div
      v-if="isDropdownOpen && filteredList.length > 0"
      class="search-dropdown-menu shadow-lg position-absolute top-100 start-0 w-100 mt-1 p-1"
      style="max-height: 240px; overflow-y: auto; z-index: 1060;"
    >
      <div
        v-for="c in filteredList"
        :key="c.id"
        class="search-item p-2 rounded cursor-pointer"
        @mousedown.prevent="selectItem(c)"
      >
        <div class="fw-semibold text-white small">{{ c.name || c.companyName }}</div>
        <div class="text-muted font-monospace d-flex gap-2" style="font-size: 0.75rem;">
          <span>BIN: {{ c.bin || c.binNumber || "N/A" }}</span>
          <span v-if="c.mobile">• Mobile: {{ c.mobile }}</span>
          <span v-if="c.vatServiceType" class="badge bg-secondary py-0" style="font-size: 0.65rem;">{{ c.vatServiceType }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.client-search-select .search-dropdown-menu {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.search-item:hover {
  background: rgba(59, 130, 246, 0.15);
}
.cursor-pointer {
  cursor: pointer;
}
</style>
