"use client";

import React, { useEffect, useState } from "react";
import { getApiVersion } from "../../lib/api";
import { WEB_VERSION, formatVersionTime, type ApiVersion } from "../../lib/app-version";

/**
 * Running versions of the web and the API, so a deploy can be confirmed from the admin. The commit is
 * the one of the GitHub merge; different commits mean one of the services is still deploying.
 */
export function VersionInfo({ collapsed = false }: { collapsed?: boolean }) {
  const [api, setApi] = useState<ApiVersion | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void getApiVersion().then((version) => {
      if (active) setApi(version);
    });
    return () => {
      active = false;
    };
  }, []);

  const webLine = `Web ${WEB_VERSION.commit}${WEB_VERSION.builtAt ? ` · ${formatVersionTime(WEB_VERSION.builtAt)}` : ""}`;
  const apiLine =
    api === undefined
      ? "API ..."
      : api === null
        ? "API indisponivel"
        : `API ${api.commit} · ${formatVersionTime(api.startedAt)}`;
  const mismatch = Boolean(api && api.commit !== WEB_VERSION.commit && api.commit !== "dev" && WEB_VERSION.commit !== "dev");
  const title = [webLine, apiLine, mismatch ? "Versoes diferentes: um deploy pode estar em andamento" : ""]
    .filter(Boolean)
    .join("\n");

  if (collapsed) {
    return (
      <p
        className={`px-3 pb-1 text-center text-[10px] ${mismatch ? "text-amber-400" : "text-slate-500"}`}
        data-testid="version-info"
        title={title}
      >
        {WEB_VERSION.commit}
      </p>
    );
  }

  return (
    <div className="px-4 pb-1 text-[11px] leading-4 text-slate-500" data-testid="version-info" title={title}>
      <p>{webLine}</p>
      <p>{apiLine}</p>
      {mismatch ? <p className="text-amber-400">Versoes diferentes: deploy em andamento?</p> : null}
    </div>
  );
}
