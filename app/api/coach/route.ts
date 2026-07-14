import { getOpenAIRuntimeConfig } from "../../../lib/openai-runtime";
import { extractOpenAIText } from "../../../lib/openai-response";

type CoachRequest = {
  action?: string;
  sectionTitle?: string;
  sectionPrompt?: string;
  sectionFormat?: string;
  sectionEmphasize?: string;
  sectionAvoid?: string;
  sectionContent?: string;
  context?: string;
  sections?: Array<{
    title?: string;
    prompt?: string;
    format?: string;
    emphasize?: string;
    avoid?: string;
    content?: string;
  }>;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  try {
    const openai = getOpenAIRuntimeConfig();
    if (!openai) {
      return Response.json({ error: "GPT Coach is not configured. OPENAI_API_KEY is missing." }, { status: 503 });
    }

    const input = (await request.json()) as CoachRequest;
    const action = clean(input.action);
    const sectionTitle = clean(input.sectionTitle);
    const sectionPrompt = clean(input.sectionPrompt);
    const sectionContent = clean(input.sectionContent) || "[No memo draft has been entered yet.]";
    const context = clean(input.context) || "[No additional context supplied.]";

    const fullReview = action === "Review the full memo";
    if (!action || (!sectionTitle && !fullReview)) {
      return Response.json({ error: "Missing coach action or document context." }, { status: 400 });
    }

    const fullDocument = (input.sections ?? [])
      .map((section, index) => [
        `Section ${index + 1}: ${clean(section.title) || "Untitled"}`,
        `Question / requirement: ${clean(section.prompt) || "Not supplied"}`,
        clean(section.format) ? `Format: ${clean(section.format)}` : "",
        clean(section.emphasize) ? `Must cover: ${clean(section.emphasize)}` : "",
        clean(section.avoid) ? `Avoid: ${clean(section.avoid)}` : "",
        `Entered response: ${clean(section.content) || "[Missing]"}`,
      ].filter(Boolean).join("\n"))
      .join("\n\n");

    const coachPrompt = [
      `Action: ${action}`,
      `Section: ${sectionTitle || "Full memo"}`,
      "",
      "Section guidance:",
      sectionPrompt,
      input.sectionFormat ? `Format: ${input.sectionFormat}` : "",
      input.sectionEmphasize ? `Emphasize: ${input.sectionEmphasize}` : "",
      input.sectionAvoid ? `Avoid: ${input.sectionAvoid}` : "",
      "",
      "Current draft:",
      sectionContent,
      "",
      "Additional context:",
      context,
      ...(fullReview ? ["", "Full document review input (read every guideline before evaluating the responses):", fullDocument || "[No sections supplied]"] : []),
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${openai.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: openai.model,
        input: [
          {
            role: "system",
            content:
              "You are a concise business-plan coach for Prologis. Return practical coaching only. Do not invent facts, metrics, customers, financials, approvals, or internal Prologis details. If facts are missing, name the gap and ask for the specific data needed. Keep the response succinct and executive-oriented. For full-document review, read the guideline for every section first, then return only the sections that need changes as short bullets in this exact pattern: Section title — specific missing or weak item; concrete change needed. Do not restate the document. Limit to 8 bullets.",
          },
          {
            role: "user",
            content: coachPrompt,
          },
        ],
      }),
    });

    const payload = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      return Response.json({ error: payload.error?.message ?? "GPT Coach request failed." }, { status: response.status });
    }

    return Response.json({ result: extractOpenAIText(payload) || "No coach response was returned." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "GPT Coach request failed." }, { status: 500 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
