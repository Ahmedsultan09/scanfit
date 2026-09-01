// Test-only worker entry: native pixel loops stay in the worker, codecs use the bridge.
import "../../packages/scanfit/src/core/processor.worker";
Object.defineProperty(self, "OffscreenCanvas", { value: undefined });
Object.defineProperty(self, "createImageBitmap", { value: undefined });
export {};
