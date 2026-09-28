import "@/plugins/axios";
import { createHead } from "@vueuse/head";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { DialogPlugin } from "@/plugins/dialog";
import { GumPlugin } from "@/plugins/gum";
import { PulsePlugin } from "@/plugins/pulse";
import App from "./App.vue";
import router from "./router";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@/assets/scss/custom.scss";
import "@/assets/scss/idp-dark.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const app = createApp(App);
const pinia = createPinia();
const head = createHead({ titleTemplate: (title) => (title ? `${title} - IDP` : "IDP") });

app.use(pinia);
app.use(router);
app.use(head);
app.use(DialogPlugin);
app.use(GumPlugin);
// Globally prevent accidental mouse wheel scrolling / incrementing / decrementing on number inputs
const blockNumberWheel = (event: Event) => {
  const e = event as WheelEvent;
  const target = e.target as HTMLElement | null;
  const active = document.activeElement as HTMLElement | null;

  if (
    (target && target.tagName === "INPUT" && (target as HTMLInputElement).type === "number") ||
    (active && active.tagName === "INPUT" && (active as HTMLInputElement).type === "number")
  ) {
    e.preventDefault();
  }
};

// Global non-passive wheel listener on window/document handles number inputs directly
document.addEventListener("wheel", blockNumberWheel, { passive: false, capture: true });


app.use(PulsePlugin);
app.mount("#app");
