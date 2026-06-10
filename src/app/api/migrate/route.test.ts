import { POST } from "./route";
import { clearJobs } from "@/lib/agent/jobs";

jest.mock("@/lib/llm/openrouter", () => ({
  createOpenRouterClient: jest.fn(() => ({})),
}));

// Fixtures defined inside the factory — jest.mock is hoisted above variable declarations
jest.mock("@/lib/agent/phases", () => ({
  runAnalysis: jest
    .fn()
    .mockResolvedValue({
      summary: "test",
      components: [],
      patterns: [],
      risks: [],
    }),
  runPlanning: jest.fn().mockResolvedValue({
    strategy: "s",
    steps: [
      {
        id: "step-1",
        description: "d",
        files: ["App.tsx"],
        dependencies: [],
        complexity: "low",
        status: "pending",
      },
    ],
  }),
  runStep: jest.fn().mockResolvedValue({ stepId: "step-1", files: [] }),
  runVerification: jest
    .fn()
    .mockResolvedValue({ passed: true, issues: [], summary: "ok" }),
}));

async function readStream(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const lines: string[] = [];
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (part.trim()) lines.push(part);
    }
  }
  return lines;
}

function parseEvents(lines: string[]): Array<{ event: string; data: unknown }> {
  return lines.map((line) => {
    const eventMatch = line.match(/^event: (.+)$/m);
    const dataMatch = line.match(/^data: (.+)$/m);
    return {
      event: eventMatch?.[1] ?? "message",
      data: dataMatch ? JSON.parse(dataMatch[1]) : null,
    };
  });
}

describe("POST /api/migrate", () => {
  beforeEach(() => clearJobs());

  it("returns 400 for invalid request body", async () => {
    const req = new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [], source: "react", target: "vue" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported framework pair", async () => {
    const req = new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ name: "x.ts", content: "x" }],
        source: "react",
        target: "express",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns SSE stream with correct Content-Type", async () => {
    const req = new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ name: "App.tsx", content: "fn()" }],
        source: "react",
        target: "vue",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("streams a job event with jobId as first event", async () => {
    const req = new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ name: "App.tsx", content: "fn()" }],
        source: "react",
        target: "vue",
      }),
    });
    const res = await POST(req);
    const lines = await readStream(res);
    const events = parseEvents(lines);
    const jobEvent = events.find((e) => e.event === "job");
    expect(jobEvent).toBeDefined();
    expect((jobEvent!.data as { jobId: string }).jobId).toBeTruthy();
  });

  it("streams a result event as the last event", async () => {
    const req = new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ name: "App.tsx", content: "fn()" }],
        source: "react",
        target: "vue",
      }),
    });
    const res = await POST(req);
    const lines = await readStream(res);
    const events = parseEvents(lines);
    const resultEvent = events.find((e) => e.event === "result");
    expect(resultEvent).toBeDefined();
    expect((resultEvent!.data as { success: boolean }).success).toBe(true);
  });
});
