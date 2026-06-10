"use client";

import { useReducer, useCallback, useRef } from "react";
import type {
  MigrationRequest,
  MigrationPlan,
  MigrationResponse,
} from "@/lib/schemas/migration";

export interface MigrationState {
  status: "idle" | "running" | "done" | "failed";
  jobId: string | null;
  phase: string | null;
  phaseStatuses: Record<string, string>;
  plan: MigrationPlan | null;
  stepStatuses: Record<string, string>;
  result: MigrationResponse | null;
  error: string | null;
  retryable: boolean;
}

type SseAction =
  | { type: "job"; jobId: string }
  | { type: "phase"; phase: string; status: string; retryCount: number }
  | { type: "plan"; plan: MigrationPlan }
  | { type: "step"; stepId: string; index: number; status: string }
  | {
      type: "result";
      success: boolean;
      jobId: string;
      migratedFiles: MigrationResponse["migratedFiles"];
      plan: MigrationPlan;
      verification: MigrationResponse["verification"];
      errors: string[];
    }
  | {
      type: "error";
      message: string;
      retryable: boolean;
      failedPhase: string | null;
    }
  | { type: "__reset" };

const initialState: MigrationState = {
  status: "idle",
  jobId: null,
  phase: null,
  phaseStatuses: {},
  plan: null,
  stepStatuses: {},
  result: null,
  error: null,
  retryable: false,
};

export function migrationReducer(
  state: MigrationState,
  action: SseAction,
): MigrationState {
  switch (action.type) {
    case "job":
      return { ...state, status: "running", jobId: action.jobId };

    case "phase":
      return {
        ...state,
        phase: action.phase,
        phaseStatuses: {
          ...state.phaseStatuses,
          [action.phase]: action.status,
        },
      };

    case "plan":
      return { ...state, plan: action.plan };

    case "step":
      return {
        ...state,
        stepStatuses: { ...state.stepStatuses, [action.stepId]: action.status },
      };

    case "result":
      return {
        ...state,
        status: "done",
        result: {
          success: action.success,
          jobId: action.jobId,
          migratedFiles: action.migratedFiles,
          plan: action.plan,
          verification: action.verification,
          errors: action.errors,
        },
      };

    case "error":
      return {
        ...state,
        status: "failed",
        error: action.message,
        retryable: action.retryable,
      };

    case "__reset":
      return { ...state, status: "running", error: null, retryable: false };

    default:
      return state;
  }
}

export interface ParsedSseLine {
  event: string;
  data: unknown;
}

export function parseSseLine(block: string): ParsedSseLine | null {
  if (!block.trim()) return null;

  const lines = block.split("\n");
  let event = "message";
  let rawData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      rawData = line.slice(6).trim();
    }
  }

  if (!rawData) return null;

  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return null;
  }
}

export async function consumeStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  dispatch: (action: SseAction) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseLine(block);
      if (parsed) {
        dispatch({
          type: parsed.event,
          ...(parsed.data as Record<string, unknown>),
        } as SseAction);
      }
    }
  }
}

export function useMigration() {
  const [state, dispatch] = useReducer(migrationReducer, initialState);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );

  const migrate = useCallback(async (request: MigrationRequest) => {
    readerRef.current?.cancel();
    dispatch({ type: "__reset" });

    const res = await fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "Unknown error");
      dispatch({
        type: "error",
        message: text,
        retryable: false,
        failedPhase: null,
      });
      return;
    }

    const reader = res.body.getReader();
    readerRef.current = reader;
    await consumeStream(reader, dispatch);
  }, []);

  const retry = useCallback(async (jobId: string) => {
    readerRef.current?.cancel();
    dispatch({ type: "__reset" });

    const res = await fetch(`/api/migrate/${jobId}/retry`, { method: "POST" });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "Unknown error");
      dispatch({
        type: "error",
        message: text,
        retryable: false,
        failedPhase: null,
      });
      return;
    }

    const reader = res.body.getReader();
    readerRef.current = reader;
    await consumeStream(reader, dispatch);
  }, []);

  return { state, migrate, retry };
}
