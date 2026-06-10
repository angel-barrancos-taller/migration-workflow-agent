// Only file that imports @openrouter/sdk — keep it isolated for testability
import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";
import type { LlmClient, CompleteJsonOptions } from "./client";
import { completeJson, type Message, type ResponseFormat } from "./json";

export function createOpenRouterClient(): LlmClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const or = new OpenRouter({ apiKey });

  const sendFn = async (
    messages: Message[],
    options?: { responseFormat?: ResponseFormat },
  ): Promise<string> => {
    // Map our internal ResponseFormat to SDK's ChatFormatJsonSchemaConfig
    const responseFormat = options?.responseFormat
      ? {
          type: "json_schema" as const,
          jsonSchema: options.responseFormat.jsonSchema,
        }
      : undefined;

    const result = await or.chat.send({
      chatRequest: {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        // model omitted — OpenRouter uses account default
        ...(responseFormat ? { responseFormat } : {}),
      },
    });

    if (!("choices" in result) || !result.choices?.[0]?.message?.content) {
      throw new Error("Unexpected response shape from OpenRouter");
    }

    const content = result.choices[0].message.content;
    if (typeof content !== "string") {
      throw new Error("OpenRouter returned non-string content");
    }

    return content;
  };

  return {
    async completeJson<T>(opts: CompleteJsonOptions<T>): Promise<T> {
      return completeJson<T>({ ...opts, sendFn, useResponseFormat: true });
    },
  };
}
