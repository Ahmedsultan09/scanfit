<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { createScanSession } from "@scanfit/browser/core";

const session = createScanSession();
const pageCount = ref(0);
const busy = ref(false);
const message = ref("Choose one or more photos.");
const download = ref<{ url: string; name: string }>();

const unsubscribe = session.subscribe(() => {
  const snapshot = session.getSnapshot();
  pageCount.value = snapshot.pages.length;
  busy.value = snapshot.status !== "idle";
});

async function add(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  try {
    const pages = await session.addFiles(input.files ?? []);
    message.value = `${pages.length} page${pages.length === 1 ? "" : "s"} added.`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    input.value = "";
  }
}

async function prepare() {
  download.value && URL.revokeObjectURL(download.value.url);
  download.value = undefined;
  try {
    const result = await session.exportPdf({ maxBytes: 2_000_000 });
    if (result.status === "ready") {
      download.value = {
        url: URL.createObjectURL(result.file),
        name: result.file.name,
      };
      message.value = `Ready: ${result.file.size.toLocaleString()} bytes.`;
    } else if (result.status === "cannot-fit") {
      message.value = `Cannot fit. Smallest candidate: ${result.candidateBytes.toLocaleString()} bytes.`;
    } else message.value = "Export cancelled.";
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  }
}

onUnmounted(() => {
  unsubscribe();
  session.dispose();
  download.value && URL.revokeObjectURL(download.value.url);
});
</script>

<template>
  <main>
    <p class="eyebrow">Vue + headless core</p>
    <h1>Connect a ScanFit session to Vue state</h1>
    <p>The framework owns this small interface; ScanFit owns validation, processing and export.</p>

    <section>
      <label>Photos <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="add" /></label>
      <p>{{ pageCount }} pages in this memory-only session.</p>
      <button type="button" :disabled="busy || pageCount === 0" @click="prepare">Prepare PDF</button>
    </section>

    <p role="status">{{ message }}</p>
    <a v-if="download" :href="download.url" :download="download.name">Download confirmed PDF</a>
  </main>
</template>
