"use client";

import type { ImageAssetPurpose } from "@burgoos/types";
import React, { useState } from "react";
import { uploadImageAsset } from "../../lib/image-upload";

export function DirectImageAssetField({
  currentValue,
  label,
  name,
  purpose,
  token,
}: {
  currentValue: string;
  label: string;
  name: string;
  purpose: ImageAssetPurpose;
  token: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
      <label className="grid gap-1 text-sm font-medium">
        {label}
        <textarea
          className="min-h-16 rounded-md border border-slate-300 bg-white px-3 py-2"
          name={name}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://... ou chave da imagem"
          value={value}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Upload direto
        <input
          accept="image/png,image/jpeg,image/webp"
          className="rounded-md border border-slate-300 bg-white px-3 py-2"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setError(null);
            setUploading(true);
            void uploadImageAsset(token, file, purpose)
              .then(setValue)
              .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha no upload."))
              .finally(() => setUploading(false));
          }}
          type="file"
        />
      </label>
      {uploading ? <p className="text-xs text-slate-500">Enviando imagem...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {value ? <img alt="" className="h-20 w-full rounded-md border border-slate-200 bg-white object-contain" src={value} /> : null}
    </div>
  );
}
