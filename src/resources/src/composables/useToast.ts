import { ref } from "vue";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "danger" | "warning" | "info";
  icon?: string;
}

const toasts = ref<ToastItem[]>([]);

export function useToast() {
  const show = (message: string, type: "success" | "danger" | "warning" | "info" = "success", duration = 1000) => {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, message, type });

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  };

  const success = (message: string, duration = 1000) => show(message, "success", duration);
  const error = (message: string, duration = 1000) => show(message, "danger", duration);
  const warning = (message: string, duration = 1000) => show(message, "warning", duration);
  const info = (message: string, duration = 1000) => show(message, "info", duration);

  const remove = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    remove
  };
}
