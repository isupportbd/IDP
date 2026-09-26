<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import axios from "axios";
import { useToast } from "@/composables/useToast";

const authStore = useAuthStore();
const toast = useToast();

const name = ref((authStore.user as any)?.name || "");
const email = ref((authStore.user as any)?.email || "");

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const isUpdatingProfile = ref(false);
const isChangingPassword = ref(false);

const userRole = computed(() => {
  const r = (authStore.user as any)?.role;
  return typeof r === "object" ? r?.name || r?.slug : r || "Member";
});

const handleUpdateProfile = async () => {
  isUpdatingProfile.value = true;
  try {
    await axios.put("/api/profile", { name: name.value });
    toast.success("Profile updated successfully!");
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to update profile.");
  } finally {
    isUpdatingProfile.value = false;
  }
};

const handleChangePassword = async () => {
  if (!currentPassword.value || !newPassword.value) {
    toast.warning("Please provide both current and new password.");
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.warning("New passwords do not match.");
    return;
  }
  if (newPassword.value.length < 6) {
    toast.warning("Password must be at least 6 characters.");
    return;
  }

  isChangingPassword.value = true;
  try {
    await axios.post("/api/profile/change-password", {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    });
    toast.success("Password changed successfully!");
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Error changing password.");
  } finally {
    isChangingPassword.value = false;
  }
};
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-1">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Profile Settings</span>
    </div>
    <h4 class="text-white fw-bold mb-4">Account & Profile Settings</h4>

    <div class="row g-4">
      <!-- Profile Information -->
      <div class="col-lg-6">
        <div class="idp-card p-4 h-100">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-person-badge text-primary"></i> Personal Details
          </h5>

          <div class="mb-3">
            <label class="form-label">Full Name</label>
            <input v-model="name" type="text" class="form-control idp-input" />
          </div>

          <div class="mb-3">
            <label class="form-label">Email Address</label>
            <input v-model="email" type="email" class="form-control idp-input" disabled />
            <div class="text-muted small mt-1">Email is linked to your primary account authentication.</div>
          </div>

          <div class="mb-4">
            <label class="form-label">Assigned Role</label>
            <div>
              <span 
                class="badge text-uppercase px-3 py-2 fs-6 font-monospace border"
                :class="userRole === 'superadmin' ? 'bg-danger text-white border-danger' : userRole === 'admin' ? 'bg-primary text-white border-primary' : 'bg-secondary text-light border-secondary'"
              >
                {{ userRole }}
              </span>
            </div>
          </div>

          <button
            class="btn btn-idp-primary"
            :disabled="isUpdatingProfile"
            @click="handleUpdateProfile"
          >
            {{ isUpdatingProfile ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>

      <!-- Change Password -->
      <div class="col-lg-6">
        <div class="idp-card p-4 h-100">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-shield-lock text-warning"></i> Security & Password
          </h5>

          <div class="mb-3">
            <label class="form-label">Current Password</label>
            <input v-model="currentPassword" type="password" class="form-control idp-input" placeholder="••••••••" />
          </div>

          <div class="mb-3">
            <label class="form-label">New Password</label>
            <input v-model="newPassword" type="password" class="form-control idp-input" placeholder="Min 6 characters" />
          </div>

          <div class="mb-4">
            <label class="form-label">Confirm New Password</label>
            <input v-model="confirmPassword" type="password" class="form-control idp-input" placeholder="••••••••" />
          </div>

          <button
            class="btn btn-idp-secondary"
            :disabled="isChangingPassword"
            @click="handleChangePassword"
          >
            {{ isChangingPassword ? 'Updating Password...' : 'Update Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
