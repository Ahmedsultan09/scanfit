import type { Plugin } from "vite";

/** Scanic 1.6.0 includes an optional ML loader. Our distribution exposes classical detection only.
 * Fail closed if upstream changes: never silently include an ONNX runtime or remote model loader. */
export function classicalOnly(): Plugin {
  return {
    name: "scanfit-classical-only",
    enforce: "pre",
    transform(code, id) {
      if (!/\/scanic\/dist\/scanic\.js$/.test(id)) return;
      const loader =
        /import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?["']\.\/scanic-mlDetector\.js["']\s*\)/g;
      const matches = code.match(loader);
      if (matches?.length !== 1)
        throw new Error(
          "Pinned Scanic ML loader changed; audit the adapter before building.",
        );
      return {
        code: code.replace(
          loader,
          'Promise.reject(new Error("ScanFit includes classical detection only"))',
        ),
        map: null,
      };
    },
  };
}
