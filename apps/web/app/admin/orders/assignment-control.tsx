"use client";

import React, { useEffect, useState } from "react";
import type { OperationalAssignee, OperationalAssignment } from "@burgoos/types";
import {
  claimOperationalAssignment,
  getOperationalAssignees,
  transferOperationalAssignment,
} from "../../../lib/api";
import { readAuthSession } from "../../../lib/auth-client";

export function AssignmentControl({
  target,
  targetId,
  version,
  assignment,
  onChanged,
}: {
  target: "orders" | "tabs";
  targetId: string;
  version: number;
  assignment?: OperationalAssignment | null;
  onChanged: (result: { version: number; assignment: OperationalAssignment }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [assignees, setAssignees] = useState<OperationalAssignee[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentUserId = readAuthSession()?.user.id ?? "";
  const mine = assignment?.userId === currentUserId;

  useEffect(() => {
    if (!open || assignees.length > 0) return;
    void getOperationalAssignees()
      .then((result) => {
        setAssignees(result);
        setAssigneeUserId(result.find((candidate) => candidate.id !== assignment?.userId)?.id ?? "");
      })
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Falha ao listar atendentes."));
  }, [open, assignees.length, assignment?.userId]);

  async function claim() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await claimOperationalAssignment(target, targetId, { expectedVersion: version });
      onChanged(result);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao assumir responsabilidade.");
    } finally {
      setBusy(false);
    }
  }

  async function transfer() {
    if (!assigneeUserId || reason.trim().length < 3) {
      setFeedback("Selecione o novo responsavel e informe uma justificativa.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await transferOperationalAssignment(target, targetId, {
        expectedVersion: version,
        assigneeUserId,
        reason: reason.trim(),
      });
      onChanged(result);
      setOpen(false);
      setReason("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao transferir responsabilidade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className={`rounded-md border px-3 py-2 text-xs ${assignment ? "border-blue-200 bg-blue-50 text-blue-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        <p className="font-semibold">
          {assignment ? `Responsavel: ${assignment.userName}${mine ? " (voce)" : ""}` : "Sem responsavel"}
        </p>
        {assignment ? <p className="mt-0.5">Desde {new Date(assignment.assignedAt).toLocaleString("pt-BR")}</p> : null}
        <div className="mt-2 flex gap-2">
          {!assignment ? (
            <button className="rounded border border-current bg-white px-2 py-1 font-semibold" disabled={busy} onClick={claim} type="button">
              Assumir
            </button>
          ) : null}
          {assignment ? (
            <button className="rounded border border-current bg-white px-2 py-1 font-semibold" disabled={busy} onClick={() => setOpen((value) => !value)} type="button">
              Transferir
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-2 space-y-2 rounded-md border bg-white p-3 text-xs">
          <label className="block font-semibold">
            Novo responsavel
            <select className="mt-1 w-full rounded border px-2 py-2" onChange={(event) => setAssigneeUserId(event.target.value)} value={assigneeUserId}>
              <option value="">Selecione</option>
              {assignees.filter((candidate) => candidate.id !== assignment?.userId).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Motivo da transferencia
            <textarea className="mt-1 w-full rounded border px-2 py-2" onChange={(event) => setReason(event.target.value)} rows={2} value={reason} />
          </label>
          <button className="rounded bg-slate-900 px-3 py-2 font-semibold text-white" disabled={busy} onClick={transfer} type="button">
            Confirmar transferencia
          </button>
        </div>
      ) : null}
      {feedback ? <p aria-live="polite" className="mt-1 text-xs text-red-700">{feedback}</p> : null}
    </div>
  );
}
