<script setup>
import { computed, onMounted, ref } from "vue";
import { translate } from "../i18n";
import {
  checkResetToken,
  goToLoginAfterInvalidResetLink,
  goToLoginAfterPasswordReset,
  resetPassword,
} from "../services/api/authApi";

const token = computed(() => new URLSearchParams(window.location.search).get("token") || "");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const isLoading = ref(false);
const isCheckingLink = ref(true);
const errorMessage = ref("");
const successMessage = ref("");

const sendToLogin = () => {
  goToLoginAfterInvalidResetLink();
};

onMounted(async () => {
  if (token.value.length !== 64) {
    sendToLogin();
    return;
  }

  try {
    const result = await checkResetToken(token.value);
    if (!result?.valid) {
      sendToLogin();
      return;
    }
    isCheckingLink.value = false;
  } catch {
    sendToLogin();
  }
});

const handleReset = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  if (token.value.length !== 64) {
    sendToLogin();
    return;
  }

  if (password.value.length < 8) {
    errorMessage.value = translate("auth.passwordPlaceholder");
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = translate("auth.resetPasswordMismatch");
    return;
  }

  isLoading.value = true;
  try {
    await resetPassword({
      token: token.value,
      password: password.value,
    });
    goToLoginAfterPasswordReset();
  } catch (error) {
    if (error?.status === 400) {
      sendToLogin();
      return;
    }
    errorMessage.value = error?.message || translate("auth.errors.genericAction");
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <section class="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10 sm:px-6">
    <div class="w-full overflow-hidden rounded-4xl border border-violet-300/25 bg-[#080a18] p-1 text-white shadow-2xl shadow-fuchsia-950/40">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t("auth.goToLogin") }}
        </a>
        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">
          {{ $t("auth.fanAccount") }}
        </p>
        <h1 class="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          {{ $t("auth.resetNewTitle") }}
        </h1>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          {{ isCheckingLink ? $t("auth.processing") : $t("auth.resetNewSubtitle") }}
        </p>

        <form v-if="!isCheckingLink" class="mt-6 space-y-4" @submit.prevent="handleReset">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
              {{ $t("auth.newPassword") }}
            </span>
            <div class="relative mt-2">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="8"
                class="min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 pr-24 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
                :placeholder="$t('auth.passwordPlaceholder')"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-4 my-auto grid size-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                @click="showPassword = !showPassword"
              >
                <i
                  :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
              {{ $t("auth.confirmPassword") }}
            </span>
            <div class="relative mt-2">
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="8"
                class="min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 pr-24 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8 focus:ring-0"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-4 my-auto grid size-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                @click="showPassword = !showPassword"
              >
                <i
                  :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </label>

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
            :disabled="isLoading || token.length !== 64"
          >
            {{ isLoading ? $t("auth.processing") : $t("auth.resetSave") }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
