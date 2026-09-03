import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type DialogHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import type { DocumentScannerProps } from "../react/DocumentScanner";

export interface ScannerTriggerRenderContext {
  open: boolean;
  loading: boolean;
  error: string;
  launch(): void;
  close(): void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export interface ScannerTriggerProps
  extends Omit<DocumentScannerProps, "onClose"> {
  children?: ReactNode;
  loadingLabel?: string;
  triggerProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;
  dialogProps?: Omit<DialogHTMLAttributes<HTMLDialogElement>, "children" | "open">;
  renderTrigger?: (
    context: ScannerTriggerRenderContext,
    defaultTrigger: ReactNode,
  ) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/** Import this entry to keep the workflow and worker out of the initial JS graph. */
export function ScannerTrigger({
  children = "Scan documents",
  loadingLabel = "Loading scanner…",
  triggerProps,
  dialogProps,
  renderTrigger,
  onOpenChange,
  ...props
}: ScannerTriggerProps) {
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
    onOpenChange?.(false);
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
        onOpenChange?.(true);
      }
    } catch (e) {
      if (mounted.current) {
        const message =
          e instanceof Error ? e.message : "Could not load the scanner.";
        setError(message);
        props.onError?.(e instanceof Error ? e : new Error(message));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  const {
    className: triggerClassName,
    disabled: triggerDisabled,
    onClick: triggerOnClick,
    type: triggerType,
    ...buttonProps
  } = triggerProps ?? {};
  const defaultTrigger = (
    <button
      {...buttonProps}
      type={triggerType ?? "button"}
      className={triggerClassName}
      ref={trigger}
      disabled={loading || triggerDisabled}
      onClick={(event) => {
        triggerOnClick?.(event);
        if (!event.defaultPrevented) void launch();
      }}
    >
      {loading ? loadingLabel : children}
    </button>
  );
  const triggerNode =
    renderTrigger?.(
      {
        open,
        loading,
        error,
        launch: () => void launch(),
        close,
        triggerRef: trigger,
      },
      defaultTrigger,
    ) ?? defaultTrigger;
  const {
    className: suppliedDialogClassName,
    onCancel: suppliedOnCancel,
    ...nativeDialogProps
  } = dialogProps ?? {};
  return (
    <>
      {triggerNode}
      {error ? <p role="alert">{error}</p> : null}
      {open && Component ? (
        <dialog
          {...nativeDialogProps}
          ref={dialog}
          className={`sf-dialog ${suppliedDialogClassName ?? ""}`.trim()}
          onCancel={(event) => {
            suppliedOnCancel?.(event);
            if (event.defaultPrevented) return;
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
