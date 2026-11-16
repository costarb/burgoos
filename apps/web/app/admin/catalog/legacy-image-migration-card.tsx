"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  getLegacyImageMigration,
  requestLegacyImageMigration,
  type LegacyImageMigrationStatus,
} from "../../../lib/api";

const POLL_MS = 5_000;

/**
 * Spec 030 (US4): moves the base64 images still in the database (products and branding) to the
 * bucket. Shown only while there is something to migrate or a migration is running.
 */
export function LegacyImageMigrationCard({ token, onFinished }: { token: string; onFinished?: () => void }) {
  const [state, setState] = useState<LegacyImageMigrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await getLegacyImageMigration(token));
    } catch {
      setState(null);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = state?.status === "QUEUED" || state?.status === "RUNNING";
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const [wasActive, setWasActive] = useState(false);
  useEffect(() => {
    if (active) setWasActive(true);
    else if (wasActive) {
      setWasActive(false);
      onFinished?.();
    }
  }, [active, wasActive, onFinished]);

  if (!state || (!active && state.pending === 0 && !wasActive)) return null;

  async function start() {
    setError(null);
    setStarting(true);
    try {
      await requestLegacyImageMigration(token);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel iniciar a migracao.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      data-testid="legacy-image-migration"
    >
      <div>
        <p className="font-semibold">Imagens antigas gravadas no banco</p>
        <p className="mt-1">
          {active
            ? "Migrando as imagens para o armazenamento de arquivos..."
            : state.status === "COMPLETED" && state.failed > 0
              ? `${state.migrated} imagens migradas. ${state.failed} nao puderam ser migradas: envie essas fotos de novo.`
              : `${state.pending} imagens ainda estao no banco. Migre para deixar o sistema mais leve.`}
        </p>
        {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      </div>
      {!active ? (
        <button
          className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-60"
          disabled={starting}
          onClick={() => void start()}
          type="button"
        >
          Migrar imagens antigas
        </button>
      ) : null}
    </section>
  );
}
