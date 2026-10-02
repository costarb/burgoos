import type { OperationState } from "@rrfive/types";

export type McpActionState<T> = OperationState & { data?: T };
