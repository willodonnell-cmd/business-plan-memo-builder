import { env } from "cloudflare:workers";

type OpenAIRuntimeConfig = {
  apiKey: string;
  model: string;
};

type RuntimeEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export function getOpenAIRuntimeConfig(): OpenAIRuntimeConfig | null {
  const runtimeEnv = env as unknown as RuntimeEnv;
  const processEnv = (typeof process !== "undefined" ? process.env : {}) as RuntimeEnv;
  const apiKey = runtimeEnv.OPENAI_API_KEY || processEnv.OPENAI_API_KEY;
  const model = runtimeEnv.OPENAI_MODEL || processEnv.OPENAI_MODEL || "gpt-5.4-mini";

  if (!apiKey) {
    return null;
  }

  return { apiKey, model };
}
