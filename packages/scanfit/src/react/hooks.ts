import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  createScanSession,
  type ScanSession,
  type ScanSnapshot,
  type SessionOptions,
} from "../core";
const EMPTY: ScanSnapshot = {
  pages: [],
  status: "idle",
  progress: 0,
  result: null,
  error: null,
};
const DEFAULT_OPTIONS: SessionOptions = {};
export function useScanSession(
  options: SessionOptions = DEFAULT_OPTIONS,
  external?: ScanSession,
) {
  const [owned, setOwned] = useState<ScanSession | null>(null);
  useEffect(() => {
    if (external) {
      // Do not retain a disposed owned session when the host temporarily supplies its own.
      setOwned(null);
      return;
    }
    const created = createScanSession(options);
    setOwned(created);
    return () => created.dispose();
  }, [
    external,
    options.detector,
    options.detectorModule,
    options.detectorOptions?.minConfidence,
    options.detectorOptions?.maxComponents,
    options.detectorOptions?.maxCandidates,
    options.workerUrl,
    options.limits?.maxPages,
    options.limits?.maxFileBytes,
    options.limits?.maxPixels,
    options.limits?.maxSessionBytes,
  ]);
  const session = external ?? owned;
  const subscribe = useCallback(
    (listener: () => void) =>
      session ? session.subscribe(listener) : () => {},
    [session],
  );
  const get = useCallback(() => session?.getSnapshot() ?? EMPTY, [session]);
  const snapshot = useSyncExternalStore(subscribe, get, () => EMPTY);
  return { session, ...snapshot };
}
export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
