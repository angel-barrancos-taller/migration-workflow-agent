import { buildMachineGraph } from "./graph";

describe("buildMachineGraph", () => {
  it("returns nodes for all 6 machine states", () => {
    const { nodes } = buildMachineGraph();
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain("analyzing");
    expect(ids).toContain("planning");
    expect(ids).toContain("executing");
    expect(ids).toContain("verifying");
    expect(ids).toContain("done");
    expect(ids).toContain("failed");
  });

  it("lays out happy-path nodes on the same y=0 row", () => {
    const { nodes } = buildMachineGraph();
    const mainStates = [
      "analyzing",
      "planning",
      "executing",
      "verifying",
      "done",
    ];
    for (const id of mainStates) {
      const node = nodes.find((n) => n.id === id)!;
      expect(node).toBeDefined();
      expect(node.position.y).toBe(0);
    }
  });

  it("places failed node below the main row", () => {
    const { nodes } = buildMachineGraph();
    const failed = nodes.find((n) => n.id === "failed")!;
    expect(failed.position.y).toBeGreaterThan(0);
  });

  it("includes happy-path edges in left-to-right order", () => {
    const { edges } = buildMachineGraph();
    const happyPath: [string, string][] = [
      ["analyzing", "planning"],
      ["planning", "executing"],
      ["executing", "verifying"],
      ["verifying", "done"],
    ];
    for (const [source, target] of happyPath) {
      expect(
        edges.some((e) => e.source === source && e.target === target),
      ).toBe(true);
    }
  });

  it("includes edges from failed back to each phase (RETRY)", () => {
    const { edges } = buildMachineGraph();
    const retryTargets = ["analyzing", "planning", "executing", "verifying"];
    for (const target of retryTargets) {
      expect(
        edges.some((e) => e.source === "failed" && e.target === target),
      ).toBe(true);
    }
  });

  it("includes error edges from each phase to failed", () => {
    const { edges } = buildMachineGraph();
    const phases = ["analyzing", "planning", "executing", "verifying"];
    for (const source of phases) {
      expect(
        edges.some((e) => e.source === source && e.target === "failed"),
      ).toBe(true);
    }
  });

  it("deduplicates self-transition edges in executing", () => {
    const { edges } = buildMachineGraph();
    const selfEdges = edges.filter(
      (e) => e.source === "executing" && e.target === "executing",
    );
    expect(selfEdges.length).toBeLessThanOrEqual(1);
  });
});
