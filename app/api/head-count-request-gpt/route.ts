import { buildHeadcountPrompt, isHeadcountField, type HeadcountPromptAction } from "../../../lib/headcount-prompts";
import { extractOpenAIText } from "../../../lib/openai-response";
import { getOpenAIRuntimeConfig } from "../../../lib/openai-runtime";
import { getActorFromRequest } from "../../../lib/workspace-store";
import type { InvestmentRequest } from "../../../lib/workspace-defaults";

type Input = {
  field?: string;
  action?: HeadcountPromptAction;
  title?: string;
  requestContext?: Partial<InvestmentRequest>;
};

const validActions = new Set<HeadcountPromptAction>(["draft", "improve", "concise", "missing"]);

export async function POST(request: Request) {
  try {
    await getActorFromRequest(request);
    const input = (await request.json()) as Input;
    if (!isHeadcountField(input.field) || !input.action || !validActions.has(input.action)) {
      return Response.json({ error: "A valid headcount field and action are required.", code: "INVALID_PROMPT_REQUEST" }, { status: 400 });
    }
    const title = clean(input.title);
    if (!title) {
      return Response.json({ error: "A role title is required to draft this response.", code: "TITLE_REQUIRED" }, { status: 422 });
    }
    const openai = getOpenAIRuntimeConfig();
    if (!openai) {
      console.error("[headcount-gpt] configuration missing", { field: input.field, action: input.action, hasTitle: Boolean(title) });
      return Response.json({ error: "Nathalie is not configured right now.", code: "MODEL_NOT_CONFIGURED" }, { status: 503 });
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${openai.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: openai.model, input: buildHeadcountPrompt({ field: input.field, action: input.action, request: input.requestContext ?? {}, title }) }),
    });
    const payload = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string; code?: string } };
    if (!response.ok) {
      console.error("[headcount-gpt] model request failed", { field: input.field, action: input.action, hasTitle: true, status: response.status, code: payload.error?.code });
      return Response.json({ error: "Nathalie could not complete this request.", code: payload.error?.code ?? "MODEL_REQUEST_FAILED" }, { status: response.status });
    }
    const result = extractOpenAIText(payload).trim();
    if (!result) {
      console.error("[headcount-gpt] empty model response", { field: input.field, action: input.action, hasTitle: true });
      return Response.json({ error: "Nathalie could not complete this request.", code: "EMPTY_MODEL_RESPONSE" }, { status: 502 });
    }
    console.info("[headcount-gpt] completed", { field: input.field, action: input.action, hasTitle: true, status: response.status });
    return Response.json({ result: input.action === "missing" ? result : trimToThreeSentences(result) });
  } catch (error) {
    console.error("[headcount-gpt] unexpected failure", error);
    return Response.json({ error: "Nathalie could not complete this request.", code: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}

function trimToThreeSentences(value: string) {
  const sentences = value.trim().replace(/\s+/g, " ").match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value];
  return sentences.slice(0, 3).join(" ").trim();
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
