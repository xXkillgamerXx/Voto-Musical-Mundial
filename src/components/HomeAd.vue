<script setup>
import { onMounted, ref } from "vue";

const hasPushedAd = ref(false);
const ADSENSE_SCRIPT_ID = "google-adsense-script";
const ADSENSE_CLIENT = "ca-pub-1078939545517246";
const isLocalHost = () =>
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const shouldRenderAd = ref(
  typeof window !== "undefined" &&
    !isLocalHost() &&
    !window.location.pathname.startsWith("/admin"),
);

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

onMounted(() => {
  if (
    hasPushedAd.value ||
    typeof window === "undefined" ||
    !shouldRenderAd.value
  ) {
    return;
  }

  window.setTimeout(async () => {
    try {
      await loadAdSenseScript();
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      hasPushedAd.value = true;
    } catch {
      // AdSense can be unavailable on localhost or before the script finishes loading.
    }
  }, 250);
});
</script>

<template>
  <section v-if="shouldRenderAd" class="mx-auto max-w-352 px-4 py-4 sm:px-6">
    <div class="home-ad-card relative mx-auto max-w-5xl overflow-hidden rounded-4xl border border-violet-300/15 bg-[#090b19]/85 p-2 shadow-2xl shadow-fuchsia-950/20">
      <div class="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-fuchsia-500/10 blur-3xl"></div>
      <div class="pointer-events-none absolute -right-16 bottom-0 size-56 rounded-full bg-cyan-400/10 blur-3xl"></div>

      <div class="home-ad-mask relative mx-auto overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <ins
          class="adsbygoogle home-ad-slot"
          style="display:block"
          data-ad-client="ca-pub-1078939545517246"
          data-ad-slot="2327533014"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-ad-mask {
  min-height: 11rem;
  max-width: 970px;
}

.home-ad-slot {
  min-height: 11rem;
  overflow: hidden;
  border-radius: 1.5rem;
}

:deep(.home-ad-slot iframe) {
  max-width: 100%;
  border-radius: 1.5rem;
}
</style>
