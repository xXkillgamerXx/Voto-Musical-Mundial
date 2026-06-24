<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../../firebase";

const emit = defineEmits(["close"]);

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const rememberPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const closeModal = () => {
  emit("close");
};

const handleEscape = (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleEscape);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscape);
});

const friendlyAuthError = (error) => {
  const messages = {
    "auth/invalid-email": "Escribe un correo válido.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/popup-closed-by-user":
      "Cerraste la ventana de Google antes de terminar.",
  };

  return (
    messages[error.code] || "No se pudo completar la acción. Intenta de nuevo."
  );
};

const handleEmailAccess = async () => {
  errorMessage.value = "";
  successMessage.value = "";
  isLoading.value = true;

  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    emit("close");
  } catch (error) {
    errorMessage.value = friendlyAuthError(error);
  } finally {
    isLoading.value = false;
  }
};

const handleGoogleAccess = async () => {
  errorMessage.value = "";
  successMessage.value = "";
  isLoading.value = true;

  try {
    await signInWithPopup(auth, googleProvider);
    emit("close");
  } catch (error) {
    errorMessage.value = friendlyAuthError(error);
  } finally {
    isLoading.value = false;
  }
};

const handlePasswordReset = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  if (!email.value) {
    errorMessage.value = "Escribe tu correo para enviarte el enlace.";
    return;
  }

  isLoading.value = true;

  try {
    await sendPasswordResetEmail(auth, email.value);
    successMessage.value =
      "Te enviamos un enlace para recuperar tu contraseña.";
  } catch (error) {
    errorMessage.value = friendlyAuthError(error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
      @click.self="closeModal"
    >
      <div
        class="auth-modal relative w-full max-w-lg overflow-hidden rounded-4xl border border-violet-300/25 bg-[#080a18] p-1 text-white shadow-2xl shadow-fuchsia-950/40"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(236,72,153,0.34),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.2),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,8,32,0.98))]"
        ></div>
        <div
          class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/20 blur-3xl"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-20 left-8 size-52 rounded-full bg-cyan-400/10 blur-3xl"
        ></div>

        <button
          type="button"
          class="absolute right-5 top-5 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/8 text-lg font-black text-slate-300 transition hover:bg-white/15 hover:text-white"
          aria-label="Cerrar modal"
          @click="closeModal"
        >
          ×
        </button>

        <div class="relative z-10 p-5 sm:p-7">
          <p
            class="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300"
          >
            Cuenta fan
          </p>
          <h2 class="text-3xl font-black leading-tight sm:text-4xl">
            Iniciar sesión
          </h2>
          <p class="mb-5 mt-1 text-sm leading-6 text-slate-300">
            Entra a tu cuenta para votar, reclamar recompensas y seguir tu
            racha.
          </p>

          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-5 text-sm font-black text-white transition hover:border-white/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isLoading"
            @click="handleGoogleAccess"
          >
            <span class="grid size-5 place-items-center">
              <img
                src="/google-g-logo.svg"
                alt=""
                class="size-5"
                aria-hidden="true"
              />
            </span>
            Continuar con Google
          </button>

          <div
            class="mt-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500"
          >
            <span class="h-px flex-1 bg-white/10"></span>
            o
            <span class="h-px flex-1 bg-white/10"></span>
          </div>
          <form class="mt-5 space-y-4" @submit.prevent="handleEmailAccess">
            <p
              class="text-xs font-black uppercase tracking-[0.24em] text-slate-400"
            >
              Datos básicos
            </p>

            <label class="block">
              <span
                class="text-xs font-bold uppercase tracking-widest text-slate-400"
                >Correo</span
              >
              <input
                v-model="email"
                type="email"
                required
                class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                placeholder="tu@email.com"
              />
            </label>

            <label class="block">
              <span
                class="text-xs font-bold uppercase tracking-widest text-slate-400"
                >Contraseña</span
              >
              <div class="relative mt-2">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  class="min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 pr-24 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-4 my-auto grid size-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                  :aria-label="
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  "
                  @click="showPassword = !showPassword"
                >
                  <i
                    :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
            </label>

            <div
              class="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <label
                class="flex cursor-pointer items-center gap-2 text-slate-300"
              >
                <input
                  v-model="rememberPassword"
                  type="checkbox"
                  class="size-4 rounded border border-white/10 bg-white/5 text-fuchsia-500 accent-fuchsia-500 outline-none transition focus:ring-0 focus:ring-offset-0"
                />
                <span>Recordar contraseña</span>
              </label>

              <button
                type="button"
                class="text-left text-sm font-black text-fuchsia-300 transition hover:text-white sm:text-right"
                :disabled="isLoading"
                @click="handlePasswordReset"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <p
              v-if="errorMessage"
              class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
            >
              {{ errorMessage }}
            </p>

            <p
              v-if="successMessage"
              class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
            >
              {{ successMessage }}
            </p>

            <button
              type="submit"
              class="min-h-13 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] hover:shadow-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isLoading"
            >
              {{ isLoading ? "Procesando..." : "Iniciar sesión" }}
            </button>

            <p class="mt-4 text-center text-sm text-slate-300">
              ¿No tienes cuenta?
              <a
                href="/registro"
                class="font-black text-fuchsia-300 transition hover:text-white"
              >
                Crear cuenta
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-modal {
  animation: auth-modal-enter 0.28s ease-out both;
}

@keyframes auth-modal-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
