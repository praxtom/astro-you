export function createChartShareFile(dataUrl: string, filename: string): File {
  const [metadata, encoded = ""] = dataUrl.split(",", 2);
  const mimeType = metadata.match(/^data:([^;]+)/)?.[1] || "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mimeType });
}
