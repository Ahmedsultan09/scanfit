<script lang="ts">
  import { onDestroy } from "svelte";
  import { createScanSession } from "@scanfit/browser/core";

  const session = createScanSession();
  let pageCount = 0;
  let busy = false;
  let message = "Choose one or more photos.";
  let download: { url: string; name: string } | undefined;

  const unsubscribe = session.subscribe(() => {
    const snapshot = session.getSnapshot();
    pageCount = snapshot.pages.length;
    busy = snapshot.status !== "idle";
  });

  async function add(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    try {
      const pages = await session.addFiles(input.files ?? []);
      message = `${pages.length} page${pages.length === 1 ? "" : "s"} added.`;
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      input.value = "";
    }
  }

  async function prepare() {
    if (download) URL.revokeObjectURL(download.url);
    download = undefined;
    try {
      const result = await session.exportPdf({ maxBytes: 2_000_000 });
      if (result.status === "ready") {
        download = { url: URL.createObjectURL(result.file), name: result.file.name };
        message = `Ready: ${result.file.size.toLocaleString()} bytes.`;
      } else if (result.status === "cannot-fit") {
        message = `Cannot fit. Smallest candidate: ${result.candidateBytes.toLocaleString()} bytes.`;
      } else message = "Export cancelled.";
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  }

  onDestroy(() => {
    unsubscribe();
    session.dispose();
    if (download) URL.revokeObjectURL(download.url);
  });
</script>

<main>
  <p class="eyebrow">Svelte + headless core</p>
  <h1>Connect a ScanFit session to Svelte state</h1>
  <p>The session emits stable snapshots while the framework owns rendering.</p>

  <section>
    <label>Photos <input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={add} /></label>
    <p>{pageCount} pages in this memory-only session.</p>
    <button type="button" disabled={busy || pageCount === 0} onclick={prepare}>Prepare PDF</button>
  </section>

  <p role="status">{message}</p>
  {#if download}
    <a href={download.url} download={download.name}>Download confirmed PDF</a>
  {/if}
</main>
