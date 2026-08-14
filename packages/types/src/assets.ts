export type ImageAssetPurpose =
  | "PRODUCT_IMAGE"
  | "BRANDING_LOGO"
  | "BRANDING_HEADER"
  | "BRANDING_BODY"
  | "BRANDING_FOOTER";

export type ImageAssetContentType = "image/png" | "image/jpeg" | "image/webp";

export interface ImageUploadIntentRequest {
  purpose: ImageAssetPurpose;
  fileName: string;
  contentType: ImageAssetContentType;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface ImageUploadIntent {
  assetKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}
