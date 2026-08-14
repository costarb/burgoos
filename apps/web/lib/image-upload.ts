import type { ImageAssetContentType, ImageAssetPurpose } from "@burgoos/types";
import { confirmImageUpload, createImageUploadIntent } from "./api";

export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadImageAsset(
  token: string,
  file: File,
  purpose: ImageAssetPurpose,
): Promise<string> {
  validateImageFile(file);
  const dimensions = await readImageDimensions(file);
  if (dimensions.width > 4096 || dimensions.height > 4096) {
    throw new Error("A imagem deve ter no maximo 4096 x 4096 pixels.");
  }
  const intent = await createImageUploadIntent(token, {
    purpose,
    fileName: file.name,
    contentType: file.type as ImageAssetContentType,
    sizeBytes: file.size,
    ...dimensions,
  });
  const headers: Record<string, string> = { ...intent.headers };
  if (isLocalApiUpload(intent.uploadUrl)) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(intent.uploadUrl, { method: "PUT", headers, body: file });
  if (!response.ok) throw new Error("Nao foi possivel enviar a imagem.");
  await confirmImageUpload(token, intent.assetKey);
  return intent.assetKey;
}

export function validateImageFile(file: Pick<File, "size" | "type">): void {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem PNG, JPEG ou WebP.");
  }
  if (file.size < 1 || file.size > IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("A imagem deve ter no maximo 2 MiB.");
  }
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function isLocalApiUpload(uploadUrl: string): boolean {
  const url = new URL(uploadUrl, window.location.origin);
  return url.origin === window.location.origin || url.pathname.includes("/api/admin/assets/local-uploads/");
}
