import { createScanSession } from "@scanfit/browser/core";
import "./styles.css";

const session = createScanSession();
const form = document.querySelector<HTMLFormElement>("#scanner")!;
const photos = document.querySelector<HTMLInputElement>("#photos")!;
const limit = document.querySelector<HTMLInputElement>("#limit")!;
const prepare = document.querySelector<HTMLButtonElement>("#prepare")!;
const status = document.querySelector<HTMLElement>("#status")!;
const download = document.querySelector<HTMLAnchorElement>("#download")!;
let downloadUrl = "";

const unsubscribe = session.subscribe(() => {
  const snapshot = session.getSnapshot();
  prepare.disabled = snapshot.pages.length === 0 || snapshot.status !== "idle";
  if (snapshot.status === "importing") status.textContent = "Preparing editable pages…";
  if (snapshot.status === "exporting") status.textContent = "Fitting the PDF to the byte limit…";
});

photos.addEventListener("change", async () => {
  try {
    const added = await session.addFiles(photos.files ?? []);
    status.textContent = `${added.length} page${added.length === 1 ? "" : "s"} ready.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    photos.value = "";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  download.hidden = true;
  try {
    const result = await session.exportPdf({ maxBytes: Number(limit.value) });
    if (result.status === "ready") {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(result.file);
      download.href = downloadUrl;
      download.download = result.file.name;
      download.hidden = false;
      status.textContent = `Ready: ${result.file.size.toLocaleString()} bytes.`;
    } else if (result.status === "cannot-fit") {
      status.textContent = `Cannot fit without crossing the configured quality floors. Smallest candidate: ${result.candidateBytes.toLocaleString()} bytes.`;
    } else status.textContent = "Export cancelled.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

window.addEventListener("beforeunload", () => {
  unsubscribe();
  session.dispose();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});
