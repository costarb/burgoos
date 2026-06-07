"use client";

import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createContext, useContext } from "react";
import { LoaderCircle } from "lucide-react";

export const OperationPendingContext = createContext(false);

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pendingLabel?: string;
}

export function SubmitButton({
  children,
  className = "",
  disabled,
  pendingLabel = "Processando...",
  ...props
}: SubmitButtonProps) {
  const operationPending = useContext(OperationPendingContext);
  const isPending = operationPending;

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled || isPending}
      type="submit"
      {...props}
    >
      {isPending ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : null}
      {isPending ? pendingLabel : children}
    </button>
  );
}
