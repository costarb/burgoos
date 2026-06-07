"use client";

import React from "react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState } from "react";
import type { OperationState } from "@burgoos/types";
import { idleOperationState } from "../../lib/operation-state";
import { OperationFeedback } from "./operation-feedback";
import { OperationPendingContext } from "./submit-button";

interface OperationFormProps extends Omit<ComponentProps<"form">, "action"> {
  action: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  children: ReactNode;
  feedbackClassName?: string;
}

export function OperationForm({
  action,
  children,
  feedbackClassName = "",
  ...props
}: OperationFormProps) {
  const [state, setState] = useState(idleOperationState);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setState({ status: "pending", message: "Processando solicitacao." });
    try {
      setState(await action(state, new FormData(event.currentTarget)));
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <OperationPendingContext.Provider value={pending}>
        <form onSubmit={submit} {...props}>
          {children}
        </form>
      </OperationPendingContext.Provider>
      <OperationFeedback className={feedbackClassName} state={state} />
    </>
  );
}
