import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { DocumentScannerProps } from "../react/DocumentScanner";

/** Import this entry to keep the workflow and worker out of the initial JS graph. */
export function ScannerTrigger({
  children = "Scan documents",
  loadingLabel = "Loading scanner…",
  ...props
}: Omit<DocumentScannerProps, "onClose"> & {
  children?: ReactNode;
  loadingLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [Component, setComponent] =
    useState<ComponentType<DocumentScannerProps> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open && Component) dialog.current?.showModal();
  }, [open, Component]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  async function launch() {
    setLoading(true);
    setError("");
    try {
      const module = await import("../react");
      if (mounted.current) {
        setComponent(() => module.DocumentScanner);
        setOpen(true);
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not load the scanner.",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  return (
    <>
      <button
        type="button"
        ref={trigger}
        disabled={loading}
        onClick={() => void launch()}
      >
        {loading ? loadingLabel : children}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {open && Component ? (
        <dialog
          ref={dialog}
          className="sf-dialog"
          onCancel={(event) => {
            event.preventDefault();
            dialog.current
              ?.querySelector<HTMLButtonElement>(".sf-icon-button")
              ?.click();
          }}
        >
          <Component {...props} onClose={close} />
        </dialog>
      ) : null}
    </>
  );
}
