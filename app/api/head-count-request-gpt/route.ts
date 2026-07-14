import { getActorFromRequest, toRouteErrorMessage } from "../../../lib/workspace-store";
import { getOpenAIRuntimeConfig } from "../../../lib/openai-runtime";
import { extractOpenAIText } from "../../../lib/openai-response";

type HeadCountGptRequest = {
  prompt?: string;
  action?: "prompt" | "review";
  requestContext?: {
    initiative?: string;
    strategicObjective?: string;
    milestone?: string;
    alternatives?: string;
    measurableOutcome?: string;
    notApprovedImpact?: string;
    lines?: Array<{
      jobTitle?: string;
      roleHire?: string;
      location?: string;
      responsibilities?: string;
      hireDate?: string;
      notesRationale?: string;
    }>;
  };
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

const compensationPatterns = [
  /\bbase salary\b/i,
  /\bsalary\b/i,
  /\bbonus\b/i,
  /\bemployee benefits\b/i,
  /\bbenefits cost\b/i,
  /\bbenefit cost\b/i,
  /\bfringe\b/i,
  /\bpayroll taxes?\b/i,
  /\bcompensation\b/i,
  /\bcomp\b/i,
  /\bmerit\b/i,
  /\bequity\b/i,
  /\bstock\b/i,
  /\brsu\b/i,
];

export async function POST(request: Request) {
  try {
    await getActorFromRequest(request);
    const input = (await request.json()) as HeadCountGptRequest;
    const review = input.action === "review";
    const userPrompt = clean(input.prompt);
    if (!review && !userPrompt) {
      return Response.json({ error: "Enter the headcount request wording you want help with." }, { status: 400 });
    }

    if (!review && mentionsCompensationDetail(userPrompt)) {
      return Response.json({
        result:
          "Compensation details should stay in the restricted Excel or HR/FP&A process. I can help draft the business need, role support, timing, risk, or approval rationale.",
      });
    }

    const openai = getOpenAIRuntimeConfig();
    if (!openai) {
      return Response.json({ error: "Head Count Request GPT is not configured. OPENAI_API_KEY is missing." }, { status: 503 });
    }

    const context = formatRequestContext(input.requestContext);
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
            content: [
              "You are Head Count Request GPT for the HR / G&A page.",
              "Help users write one specific headcount request with short, clear, straightforward drafting support.",
              "Do not interview the user. Do not lead with questions. Respond only to the question asked.",
              "If clarification is absolutely necessary, ask at most one brief question, but prefer to answer directly.",
              "Every prompt-creation answer must be 3 short sentences or fewer.",
              "Return concise, ready-to-use text for an intake form. Do not provide long analysis.",
              "Stay inside headcount request drafting: business justification, why the role is needed, what it supports, impact if not approved, concise wording, and executive-ready language.",
              "Do not ask for or use salary, bonus, benefits, payroll tax, compensation tables, or other compensation-sensitive details.",
              "Do not replace HR review or approval. Do not replace Workday or Planful. Do not become a general business strategy assistant.",
              "Do not invent facts, metrics, approvals, customers, financials, or internal details.",
              "For a full review, read every applicable question and its response before assessing it. Return only concise actionable bullets using: Field or role — specific missing or weak item; concrete change needed. Check business need, strategic objective, hiring timing, alternatives, measurable outcome, impact if declined, and each payroll/headcount role's title, purpose, timing, and rationale. Limit to 8 bullets and never restate the full request.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              "Current non-sensitive request context:",
              context,
              "",
              review ? "Task: Review this full headcount request against the applicable intake requirements." : "User request:",
              review ? "" : userPrompt,
            ].join("\n"),
          },
        ],
      }),
    });

    const payload = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      return Response.json({ error: payload.error?.message ?? "Head Count Request GPT request failed." }, { status: response.status });
    }

    const result = extractOpenAIText(payload) || "No response was returned.";
    return Response.json({ result: review ? result : trimToThreeSentences(result) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

function formatRequestContext(context: HeadCountGptRequest["requestContext"]) {
  if (!context) return "[No request context supplied.]";
  const lines = context.lines
    ?.map((line, index) =>
      [
        `Role ${index + 1}:`,
        clean(line.jobTitle) ? `Job title: ${clean(line.jobTitle)}` : "",
        clean(line.roleHire) ? `Role / hire: ${clean(line.roleHire)}` : "",
        clean(line.location) ? `Location: ${clean(line.location)}` : "",
        clean(line.responsibilities) ? `Responsibilities: ${clean(line.responsibilities)}` : "",
        clean(line.hireDate) ? `Timing: ${clean(line.hireDate)}` : "",
        clean(line.notesRationale) ? `Notes / rationale: ${clean(line.notesRationale)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n");

  return [
    clean(context.initiative) ? `Title: ${clean(context.initiative)}` : "",
    clean(context.strategicObjective) ? `Strategic objective: ${clean(context.strategicObjective)}` : "",
    clean(context.milestone) ? `Milestone: ${clean(context.milestone)}` : "",
    clean(context.alternatives) ? `Alternatives: ${clean(context.alternatives)}` : "",
    clean(context.measurableOutcome) ? `Measurable outcome: ${clean(context.measurableOutcome)}` : "",
    clean(context.notApprovedImpact) ? `Impact if not approved: ${clean(context.notApprovedImpact)}` : "",
    lines,
  ]
    .filter(Boolean)
    .join("\n") || "[No request context supplied.]";
}

function mentionsCompensationDetail(value: string) {
  return compensationPatterns.some((pattern) => pattern.test(value));
}

function trimToThreeSentences(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized];
  return sentences.slice(0, 3).join(" ").trim();
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
