import {
  getFrameworkPair,
  FRAMEWORK_PAIRS,
  isSupportedPair,
} from "./frameworks";

describe("FRAMEWORK_PAIRS", () => {
  it("defines all 4 supported pairs", () => {
    expect(FRAMEWORK_PAIRS).toHaveLength(4);
  });

  it("each pair has required fields", () => {
    for (const pair of FRAMEWORK_PAIRS) {
      expect(pair.source).toBeTruthy();
      expect(pair.target).toBeTruthy();
      expect(pair.guidance).toBeTruthy();
      expect(Array.isArray(pair.sourceExtensions)).toBe(true);
      expect(Array.isArray(pair.targetExtensions)).toBe(true);
      expect(Array.isArray(pair.verificationChecklist)).toBe(true);
      expect(pair.verificationChecklist.length).toBeGreaterThan(0);
    }
  });
});

describe("getFrameworkPair", () => {
  it("returns the correct pair for react -> vue", () => {
    const pair = getFrameworkPair("react", "vue");
    expect(pair).toBeDefined();
    expect(pair!.source).toBe("react");
    expect(pair!.target).toBe("vue");
  });

  it("returns the correct pair for express -> fastify", () => {
    const pair = getFrameworkPair("express", "fastify");
    expect(pair).toBeDefined();
    expect(pair!.source).toBe("express");
    expect(pair!.target).toBe("fastify");
  });

  it("returns undefined for unsupported pairs", () => {
    expect(getFrameworkPair("react", "fastify")).toBeUndefined();
  });

  it("guidance is non-empty for all pairs", () => {
    const pairs = [
      ["react", "vue"],
      ["vue", "react"],
      ["express", "fastify"],
      ["jquery", "react"],
    ] as const;
    for (const [src, tgt] of pairs) {
      const pair = getFrameworkPair(src, tgt);
      expect(pair!.guidance.length).toBeGreaterThan(50);
    }
  });
});

describe("isSupportedPair", () => {
  it("returns true for supported pairs", () => {
    expect(isSupportedPair("react", "vue")).toBe(true);
    expect(isSupportedPair("jquery", "react")).toBe(true);
  });

  it("returns false for unsupported pairs", () => {
    expect(isSupportedPair("react", "express")).toBe(false);
    expect(isSupportedPair("react", "react")).toBe(false);
  });
});
