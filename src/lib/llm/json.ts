import { z } from "zod";

const MAX_REPAIR_ATTEMPTS = 2;

export class LlmJsonError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "LlmJsonError";
  }
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResponseFormat {
  type: "json_schema";
  jsonSchema: {
    name: string;
    schema: Record<string, unknown>;
    strict: boolean;
  };
}

export type SendFn = (
  messages: Message[],
  options?: { responseFormat?: ResponseFormat },
) => Promise<string>;

export interface CompleteJsonOptions<T> {
  schemaName: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  sendFn: SendFn;
  useResponseFormat?: boolean;
}

export function extractJson(raw: string): unknown {
  // Strip ```json or ``` fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Try direct parse first
  const directAttempt = stripped.startsWith("{") ? stripped : null;
  if (directAttempt) {
    return JSON.parse(directAttempt);
  }

  // Find first { ... last } in the string
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new SyntaxError("No JSON object found in response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function completeJson<T>(
  options: CompleteJsonOptions<T>,
): Promise<T> {
  const {
    schemaName,
    schema,
    system,
    user,
    sendFn,
    useResponseFormat = false,
  } = options;

  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  const responseFormat: ResponseFormat | undefined = useResponseFormat
    ? {
        type: "json_schema",
        jsonSchema: {
          name: schemaName,
          schema: jsonSchema,
          strict: true,
        },
      }
    : undefined;

  const baseMessages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let messages = [...baseMessages];
  let lastRaw = "";

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const raw = await sendFn(
      messages,
      responseFormat ? { responseFormat } : undefined,
    );
    lastRaw = raw;

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch {
      if (attempt >= MAX_REPAIR_ATTEMPTS) {
        throw new LlmJsonError(
          `Failed to extract JSON after ${attempt + 1} attempts`,
          raw,
        );
      }
      messages = [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content: `Your response could not be parsed as JSON. Return ONLY a valid JSON object matching the schema. Error: invalid JSON syntax.`,
        },
      ];
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    if (attempt >= MAX_REPAIR_ATTEMPTS) {
      throw new LlmJsonError(
        `Schema validation failed after ${attempt + 1} attempts: ${JSON.stringify(result.error.issues)}`,
        raw,
      );
    }

    const issues = result.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    messages = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Your response failed validation. Fix the following issues and return ONLY corrected JSON:\n${issues}`,
      },
    ];
  }

  throw new LlmJsonError("Exhausted repair attempts", lastRaw);
}
