import { z } from "zod";

export interface CompleteJsonOptions<T> {
  schemaName: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
}

export interface LlmClient {
  completeJson<T>(options: CompleteJsonOptions<T>): Promise<T>;
}
