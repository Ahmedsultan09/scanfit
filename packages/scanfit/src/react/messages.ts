export const defaultMessages = {
  title: "Scan your documents",
  subtitle: "A few photos. One upload-ready PDF.",
  addPhotos: "Add photos",
  camera: "Use camera",
  close: "Close scanner",
  cancel: "Cancel",
  emptyTitle: "Your paperwork, simplified.",
  emptyDescription:
    "Take a photo or add images to create a PDF that fits your upload limit.",
  choosePhotos: "Choose photos",
  formats: "JPEG, PNG, or WebP",
  privacy: "Processed on your device. Nothing is uploaded.",
  page: "Page",
  pages: "Pages",
  edit: "Adjust corners",
  preview: "Preview page",
  rotate: "Rotate clockwise",
  retake: "Replace photo",
  remove: "Remove page",
  moveUp: "Move page earlier",
  moveDown: "Move page later",
  natural: "Natural color",
  grayscale: "Grayscale",
  contrast: "More contrast",
  filter: "Appearance",
  corner: "Corner",
  topLeft: "Top left",
  topRight: "Top right",
  bottomRight: "Bottom right",
  bottomLeft: "Bottom left",
  nudgeUp: "Nudge up",
  nudgeDown: "Nudge down",
  nudgeLeft: "Nudge left",
  nudgeRight: "Nudge right",
  resetCrop: "Use full image",
  cropHelp:
    "Changes apply immediately. Drag a corner, use arrow keys, or select a corner and tap the arrows. Shift + arrow moves farther.",
  prepare: "Prepare PDF",
  preparing: "Preparing your PDF…",
  importing: "Preparing your photos…",
  pageSize: "Paper size",
  a4: "A4",
  letter: "US Letter",
  image: "Match image",
  limit: "Upload limit",
  actualSize: "PDF size",
  imageBytes: "Image contribution",
  quality: "JPEG quality",
  dimensions: "Dimensions",
  qualityFloor: "Minimum JPEG quality",
  resolutionFloor: "Minimum long edge (native size if smaller)",
  invalidLimit: "maxBytes must be a positive integer number of bytes.",
  reviewTitle: "Ready for your final look.",
  reviewDescription:
    "These previews use the exact compressed images embedded in your PDF. Zoom in and check small text, signatures, and stamps.",
  cannotFitTitle: "This document needs more room.",
  cannotFitDescription:
    "We could not fit these pages within the limit and quality settings. Crop away excess background, retake a page, or remove pages you do not need.",
  confirm: "Use this PDF",
  back: "Back to editing",
  zoom: "Preview zoom",
  qualityNote:
    "Quality settings are not a readability guarantee. Please inspect the final result.",
  noRecovery:
    "This session is held in memory. Refreshing or closing loses unfinished scans.",
  discard:
    "Discard these unfinished scans? They are not saved and cannot be restored.",
  removeConfirm: "Remove this page?",
  cameraTitle: "Capture a page",
  shutter: "Take photo",
  cameraStarting: "Starting camera…",
  cameraHelp:
    "Place the page on a contrasting background. Keep all four corners visible.",
  cameraError:
    "The camera is unavailable or permission was denied. You can still choose photos.",
  correctedPreview: "Corrected document preview",
  sourcePreview: "Source document with editable corners",
  manualCrop: "Check the four corners before continuing.",
  detectorUnavailable:
    "Automatic detection was unavailable. Adjust the corners manually.",
  blurry: "This photo may be blurry. Inspect the text or retake it.",
  dark: "This photo may be too dark. Try better lighting.",
  lowResolution:
    "This photo has limited resolution. Inspect small text carefully.",
};
export type ScannerMessages = typeof defaultMessages;
export const formatBytes = (bytes: number) =>
  bytes < 1000
    ? `${bytes} B`
    : bytes < 1_000_000
      ? `${(bytes / 1000).toFixed(1)} kB`
      : `${(bytes / 1_000_000).toFixed(2)} MB`;
