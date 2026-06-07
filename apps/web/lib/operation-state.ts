import type { OperationState } from "@burgoos/types";

export const idleOperationState: OperationState = { status: "idle" };

export function pendingOperation(message: string): OperationState {
  return { status: "pending", message };
}

export function successfulOperation(
  message: string,
  result?: OperationState["result"],
): OperationState {
  return { status: "success", message, result };
}

export function failedOperation(error: unknown, fallback: string): OperationState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : fallback,
  };
}
