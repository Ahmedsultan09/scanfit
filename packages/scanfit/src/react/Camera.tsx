import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import type { ScannerMessages } from "./messages";

export interface CameraProps
  extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  onCapture: (file: Blob) => void;
  onClose: () => void;
  messages: ScannerMessages;
  primaryActionClassName?: string;
}

export function Camera({
  onCapture,
  onClose,
  messages: m,
  primaryActionClassName = "",
  className = "",
  "aria-label": ariaLabel,
  ...sectionProps
}: CameraProps) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [capturing, setCapturing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    const hide = () => {
      if (document.hidden) {
        stop();
        closeRef.current();
      }
    };
    document.addEventListener("visibilitychange", hide);
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera unavailable.");
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
        });
        if (!alive) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        video.current!.srcObject = media;
        await video.current!.play();
        if (alive) setReady(true);
      } catch {
        if (alive) {
          stop();
          setError(true);
        }
      }
    })();
    return () => {
      alive = false;
      mounted.current = false;
      document.removeEventListener("visibilitychange", hide);
      stop();
    };
  }, []);
  async function capture() {
    if (!video.current || !ready || capturing) return;
    setCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    try {
      canvas.getContext("2d")!.drawImage(video.current, 0, 0);
      const file = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error())),
          "image/jpeg",
          0.95,
        ),
      );
      stop();
      if (mounted.current) onCapture(file);
    } catch {
      if (mounted.current) {
        setError(true);
        setCapturing(false);
      }
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  return (
    <section
      {...sectionProps}
      className={`sf-primitive sf-camera ${className}`.trim()}
      aria-label={ariaLabel ?? m.cameraTitle}
    >
      <div className="sf-section-heading">
        <h3>{m.cameraTitle}</h3>
        <button type="button" onClick={onClose}>
          {m.cancel}
        </button>
      </div>
      {error ? (
        <p role="alert">{m.cameraError}</p>
      ) : (
        <>
          <video ref={video} playsInline muted autoPlay />
          <p>{ready ? m.cameraHelp : m.cameraStarting}</p>
          <button
            type="button"
            className={`sf-primary ${primaryActionClassName}`.trim()}
            disabled={!ready || capturing}
            onClick={() => void capture()}
          >
            {m.shutter}
          </button>
        </>
      )}
    </section>
  );
}
