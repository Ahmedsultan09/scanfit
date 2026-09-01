/** Remove EXIF/XMP APP1 segments from a freshly encoded JPEG. */
export async function stripJpegApp1(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    return blob;
  const parts: BlobPart[] = [];
  let cursor = 2,
    keptFrom = 0,
    removed = false;
  while (cursor + 3 < bytes.length && bytes[cursor] === 0xff) {
    const segmentStart = cursor;
    while (bytes[cursor] === 0xff) cursor++;
    const marker = bytes[cursor++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.length) break;
    const length = (bytes[cursor] << 8) | bytes[cursor + 1];
    if (length < 2 || cursor + length > bytes.length) break;
    const segmentEnd = cursor + length;
    if (marker === 0xe1) {
      parts.push(bytes.slice(keptFrom, segmentStart));
      keptFrom = segmentEnd;
      removed = true;
    }
    cursor = segmentEnd;
  }
  if (!removed) return blob;
  parts.push(bytes.slice(keptFrom));
  return new Blob(parts, { type: "image/jpeg" });
}
