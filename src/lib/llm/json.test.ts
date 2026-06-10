import { z } from "zod";
import { extractJson, completeJson, LlmJsonError } from "./json";

const schema = z.object({ name: z.string(), value: z.number() });
type Result = z.infer<typeof schema>;

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(extractJson('{"name":"x","value":1}')).toEqual({
      name: "x",
      value: 1,
    });
  });

  it("strips ```json code fences", () => {
    expect(extractJson('```json\n{"name":"x","value":1}\n```')).toEqual({
      name: "x",
      value: 1,
    });
  });

  it("strips ``` code fences without language tag", () => {
    expect(extractJson('```\n{"name":"x","value":1}\n```')).toEqual({
      name: "x",
      value: 1,
    });
  });

  it("extracts JSON embedded in surrounding prose", () => {
    expect(
      extractJson('Here is the result: {"name":"x","value":1} as requested.'),
    ).toEqual({ name: "x", value: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json at all")).toThrow();
  });
});

describe("completeJson", () => {
  it("returns parsed result on first valid response", async () => {
    const sendFn = jest.fn().mockResolvedValue('{"name":"test","value":42}');
    const result = await completeJson<Result>({
      schemaName: "Result",
      schema,
      system: "sys",
      user: "usr",
      sendFn,
    });
    expect(result).toEqual({ name: "test", value: 42 });
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("calls sendFn with system and user messages", async () => {
    const sendFn = jest.fn().mockResolvedValue('{"name":"t","value":1}');
    await completeJson({
      schemaName: "R",
      schema,
      system: "SYSTEM",
      user: "USER",
      sendFn,
    });
    const messages = sendFn.mock.calls[0][0];
    expect(messages.some((m: { role: string }) => m.role === "system")).toBe(
      true,
    );
    expect(messages.some((m: { role: string }) => m.role === "user")).toBe(
      true,
    );
  });

  it("retries with repair prompt on Zod validation failure", async () => {
    const sendFn = jest
      .fn()
      .mockResolvedValueOnce('{"name":"t","value":"not-a-number"}') // fails Zod
      .mockResolvedValueOnce('{"name":"t","value":99}'); // succeeds
    const result = await completeJson<Result>({
      schemaName: "Result",
      schema,
      system: "sys",
      user: "usr",
      sendFn,
    });
    expect(result).toEqual({ name: "t", value: 99 });
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("includes Zod error details in repair message", async () => {
    const sendFn = jest
      .fn()
      .mockResolvedValueOnce('{"name":"t","value":"bad"}')
      .mockResolvedValueOnce('{"name":"t","value":1}');
    await completeJson({
      schemaName: "R",
      schema,
      system: "sys",
      user: "usr",
      sendFn,
    });
    // second call should have assistant + repair user messages appended
    const secondCallMessages = sendFn.mock.calls[1][0];
    const roles = secondCallMessages.map((m: { role: string }) => m.role);
    expect(roles).toContain("assistant");
    expect(
      roles.filter((r: string) => r === "user").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("throws LlmJsonError after max repair attempts exhausted", async () => {
    const sendFn = jest.fn().mockResolvedValue('{"name":"t","value":"bad"}');
    await expect(
      completeJson({
        schemaName: "R",
        schema,
        system: "sys",
        user: "usr",
        sendFn,
      }),
    ).rejects.toThrow(LlmJsonError);
    // initial + 2 repair attempts = 3 total
    expect(sendFn).toHaveBeenCalledTimes(3);
  });

  it("throws LlmJsonError after JSON parse failure exhaustion", async () => {
    const sendFn = jest.fn().mockResolvedValue("not json");
    await expect(
      completeJson({
        schemaName: "R",
        schema,
        system: "sys",
        user: "usr",
        sendFn,
      }),
    ).rejects.toThrow(LlmJsonError);
  });

  it("passes responseFormat option to sendFn", async () => {
    const sendFn = jest.fn().mockResolvedValue('{"name":"t","value":1}');
    await completeJson({
      schemaName: "Result",
      schema,
      system: "sys",
      user: "usr",
      sendFn,
      useResponseFormat: true,
    });
    expect(sendFn).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        responseFormat: expect.objectContaining({ type: "json_schema" }),
      }),
    );
  });
});
