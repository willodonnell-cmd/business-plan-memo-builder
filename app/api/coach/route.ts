type CoachRequest = {
  action?: string;
  sectionTitle?: string;
  sectionPrompt?: string;
  sectionFormat?: string;
  sectionEmphasize?: string;
  sectionAvoid?: string;
  sectionContent?: string;
  context?: string;
};

type OpenAIResponse = {
  output_text?: string;
  error?: { message?: string };
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    if (!apiKey) {
      return Response.json({ error: "GPT Coach is not configured. OPENAI_API_KEY is missing." }, { status: 503 });
    }

    const input = (await request.json()) as CoachRequest;
    const action = clean(input.action);
    const sectionTitle = clean(input.sectionTitle);
    const sectionPrompt = clean(input.sectionPrompt);
    const sectionContent = clean(input.sectionContent) || "[No memo draft has been entered yet.]";
    const context = clean(input.context) || "[No additional context supplied.]";

    if (!action || !sectionTitle) {
      return Response.json({ error: "Missing coach action or section title." }, { status: 400 });
    }

    const coachPrompt = [
      `Action: ${action}`,
      `Section: ${sectionTitle}`,
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
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are a concise business-plan coach for Prologis. Return practical coaching only. Do not invent facts, metrics, customers, financials, approvals, or internal Prologis details. If facts are missing, name the gap and ask for the specific data needed. Keep the response succinct and executive-oriented.",
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

    return Response.json({ result: payload.output_text ?? "No coach response was returned." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "GPT Coach request failed." }, { status: 500 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
