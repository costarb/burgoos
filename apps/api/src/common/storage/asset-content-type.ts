/** Content type from the stored key extension (images, fiscal XML and DANFE). */
export function contentTypeForKey(key: string): string {
  if (/\.png$/i.test(key)) return "image/png";
  if (/\.webp$/i.test(key)) return "image/webp";
  if (/\.jpe?g$/i.test(key)) return "image/jpeg";
  if (/\.xml$/i.test(key)) return "application/xml";
  if (/\.pdf$/i.test(key)) return "application/pdf";
  return "application/octet-stream";
}
