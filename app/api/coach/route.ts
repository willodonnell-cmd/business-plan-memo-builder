import { env } from "cloudflare:workers";

type CoachPayload = {
  sectionTitle?: unknown;
  draft?: unknown;
  question?: unknown;
};

function getOutputText(payload: any) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const parts = payload.output
    ?.flatMap((item: any) => item.content ?? [])
    ?.map((content: any) => content.text)
    ?.filter((text: unknown): text is string => typeof text === "string");

  return parts?.join("\n").trim() || "";
}

export async function POST(request: Request) {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GPT Coach is not configured. Add OPENAI_API_KEY to the Sites runtime environment." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as CoachPayload;
  const sectionTitle = String(payload.sectionTitle ?? "").trim();
  const draft = String(payload.draft ?? "").trim();
  const question = String(payload.question ?? "").trim();

  if (!sectionTitle || !question) {
    return Response.json(
      { error: "Section title and question are required." },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.5",
      instructions:
        "You are GPT Coach for a Prologis 2027 business plan memo. Do not write the memo for the user. Do not invent facts. Ask useful follow-up questions, identify gaps, and suggest ways to sharpen the team's thinking. Keep the response concise and executive-oriented.",
      input: `Section: ${sectionTitle}\n\nCurrent draft:\n${draft || "(No draft yet.)"}\n\nUser question:\n${question}`,
      max_output_tokens: 450,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return Response.json(
      { error: data.error?.message || "GPT Coach failed to respond." },
      { status: response.status },
    );
  }

  const text = getOutputText(data);

  return Response.json({
    text: text || "I could not generate a useful coaching response. Try asking a more specific question.",
  });
}
