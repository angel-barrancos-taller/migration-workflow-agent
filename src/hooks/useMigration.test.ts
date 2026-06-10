import {
  migrationReducer,
  parseSseLine,
  type MigrationState,
} from "./useMigration";

// ── Reducer tests ──────────────────────────────────────────────────────────

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

describe("migrationReducer", () => {
  it("sets jobId on job event", () => {
    const next = migrationReducer(initialState, {
      type: "job",
      jobId: "abc-123",
    });
    expect(next.jobId).toBe("abc-123");
    expect(next.status).toBe("running");
  });

  it("updates phase and phaseStatuses on phase event", () => {
    const next = migrationReducer(initialState, {
      type: "phase",
      phase: "analyzing",
      status: "started",
      retryCount: 0,
    });
    expect(next.phase).toBe("analyzing");
    expect(next.phaseStatuses["analyzing"]).toBe("started");
  });

  it("sets plan on plan event", () => {
    const plan = {
      strategy: "s",
      steps: [
        {
          id: "s1",
          description: "d",
          files: [],
          dependencies: [],
          complexity: "low" as const,
          status: "pending" as const,
        },
      ],
    };
    const next = migrationReducer(initialState, { type: "plan", plan });
    expect(next.plan).toEqual(plan);
  });

  it("updates stepStatuses on step event", () => {
    const next = migrationReducer(initialState, {
      type: "step",
      stepId: "s1",
      index: 0,
      status: "in_progress",
    });
    expect(next.stepStatuses["s1"]).toBe("in_progress");
  });

  it("sets result and status:done on result event", () => {
    const result = {
      success: true,
      jobId: "abc",
      migratedFiles: [],
      plan: { strategy: "s", steps: [] },
      verification: null,
      errors: [],
    };
    const next = migrationReducer(initialState, { type: "result", ...result });
    expect(next.status).toBe("done");
    expect(next.result).toEqual(result);
  });

  it("sets error and retryable on error event", () => {
    const next = migrationReducer(initialState, {
      type: "error",
      message: "LLM failed",
      retryable: true,
      failedPhase: "analyzing",
    });
    expect(next.status).toBe("failed");
    expect(next.error).toBe("LLM failed");
    expect(next.retryable).toBe(true);
  });

  it("resets to running on reset action", () => {
    const failedState: MigrationState = {
      ...initialState,
      status: "failed",
      error: "err",
      retryable: true,
    };
    const next = migrationReducer(failedState, { type: "__reset" });
    expect(next.status).toBe("running");
    expect(next.error).toBeNull();
    expect(next.retryable).toBe(false);
  });
});

// ── SSE line parser tests ──────────────────────────────────────────────────

describe("parseSseLine", () => {
  it("parses a complete SSE message block", () => {
    const block =
      'event: phase\ndata: {"type":"phase","phase":"analyzing","status":"started","retryCount":0}';
    const result = parseSseLine(block);
    expect(result).not.toBeNull();
    expect(result!.event).toBe("phase");
    expect((result!.data as { phase: string }).phase).toBe("analyzing");
  });

  it("returns null for empty block", () => {
    expect(parseSseLine("")).toBeNull();
  });

  it("handles message without explicit event type", () => {
    const block = 'data: {"type":"job","jobId":"xyz"}';
    const result = parseSseLine(block);
    expect(result).not.toBeNull();
    expect((result!.data as { jobId: string }).jobId).toBe("xyz");
  });

  it("returns null for malformed data JSON", () => {
    const block = "event: test\ndata: not-valid-json";
    expect(parseSseLine(block)).toBeNull();
  });
});
