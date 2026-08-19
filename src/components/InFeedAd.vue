<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";

const ADSENSE_SCRIPT_ID = "google-adsense-script";
const ADSENSE_CLIENT = "ca-pub-1078939545517246";
const ADSENSE_SLOT = "2327533014";

const slotEl = ref(null);
const adFilled = ref(false);
const hasPushedAd = ref(false);
let observer = null;
let fillTimer = 0;

const isLocalHost = () =>
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const isAdminPath = () =>
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");
const isLocal = typeof window !== "undefined" && isLocalHost();
const shouldRenderAd = ref(typeof window !== "undefined" && !isAdminPath());
const useLiveAdSense = shouldRenderAd.value && !isLocal;

const loadAdSenseScript = () =>
  new Promise((resolve, reject) => {
    const existingScript = document.getElementById(ADSENSE_SCRIPT_ID);
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

const readFillStatus = () => {
  const status = slotEl.value?.getAttribute("data-ad-status");
  if (status === "filled") {
    adFilled.value = true;
    return true;
  }
  if (status === "unfilled") {
    adFilled.value = false;
    return true;
  }
  return false;
};

onMounted(() => {
  if (!shouldRenderAd.value || typeof window === "undefined") {
    return;
  }

  if (isLocal) {
    adFilled.value = true;
    return;
  }

  window.setTimeout(async () => {
    try {
      await loadAdSenseScript();
      await nextTick();
      if (hasPushedAd.value || !slotEl.value) return;
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      hasPushedAd.value = true;

      observer = new MutationObserver(() => {
        if (readFillStatus() && observer) {
          observer.disconnect();
        }
      });
      observer.observe(slotEl.value, {
        attributes: true,
        attributeFilter: ["data-ad-status"],
      });
      readFillStatus();
      fillTimer = window.setTimeout(() => {
        if (!adFilled.value) {
          observer?.disconnect();
        }
      }, 4000);
    } catch {
      adFilled.value = false;
    }
  }, 250);
});

onUnmounted(() => {
  observer?.disconnect();
  if (fillTimer) window.clearTimeout(fillTimer);
});
</script>

<template>
  <aside
    v-if="shouldRenderAd && (isLocal || useLiveAdSense)"
    class="in-feed-ad w-full max-w-5xl"
    :class="
      isLocal || adFilled
        ? 'relative mx-auto'
        : 'pointer-events-none fixed top-0 left-[-9999px]'
    "
    aria-label="Advertisement"
  >
    <div
      v-if="isLocal"
      class="grid min-h-36 place-items-center rounded-3xl border border-dashed border-fuchsia-300/40 bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.12))] px-4 py-8 text-center"
    >
      <p class="text-sm font-black uppercase tracking-[0.22em] text-fuchsia-100">
        {{ $t("common.advertisementLocal") }}
      </p>
      <p class="mt-2 max-w-xs text-xs leading-5 text-slate-400">
        320 × 100
      </p>
    </div>

    <template v-else>
      <p
        v-if="adFilled"
        class="mb-2 text-center text-[10px] font-black uppercase tracking-[0.28em] text-slate-500"
      >
        {{ $t("common.advertisement") }}
      </p>
      <div class="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-2">
        <ins
          ref="slotEl"
          class="adsbygoogle in-feed-ad-slot"
          style="display:block"
          :data-ad-client="ADSENSE_CLIENT"
          :data-ad-slot="ADSENSE_SLOT"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.in-feed-ad-slot {
  display: block;
  min-height: 7.5rem;
  width: 100%;
  overflow: hidden;
  border-radius: 1.25rem;
}

:deep(.in-feed-ad-slot iframe) {
  max-width: 100%;
  border-radius: 1.25rem;
}
</style>
