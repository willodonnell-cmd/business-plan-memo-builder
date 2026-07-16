import type { InvestmentRequest } from "./workspace-defaults";

export const headcountFieldDefinitions = {
  strategicObjective: {
    question: "What strategic objective or growth opportunity does this investment enable?",
    guidance: "Explain the business objective or growth opportunity, why the role supports it, its connection to the 2027–2029 business plan, and the relevant territory, customer, product, capacity, or execution rationale.",
  },
  milestone: {
    question: "What business milestone should trigger this investment?",
    guidance: "Explain why the investment is needed now, the current or expected capacity gap, the sustained demand, pipeline, customer, operational, or workload signal, the specific trigger, and why the timing is necessary rather than merely aligned with the plan.",
  },
  alternatives: {
    question: "What alternatives were considered?",
    guidance: "Explain which alternatives were considered, including absorption by the current team, redeployment, process improvements, AI, automation, technology, contractors, third parties, territory changes, or temporary support, and why they are insufficient. Do not accept Not applicable without a clear supportable explanation.",
  },
  measurableOutcome: {
    question: "What measurable business outcome will this investment deliver?",
    guidance: "Explain the measurable result, applicable metric, expected amount, range, volume, timing, or business impact when provided, and how the role contributes. Do not invent a metric or value.",
  },
  notApprovedImpact: {
    question: "What is the impact if this investment is not approved?",
    guidance: "Explain the specific consequence for growth, customers, execution, operations, financial performance, capacity, or risk, the material downside, and the likely effect on the 2027–2029 plan where relevant. Avoid exaggerated, alarmist, or generic risk language.",
  },
} as const;

export type HeadcountField = keyof typeof headcountFieldDefinitions;
export type HeadcountPromptAction = "draft" | "improve" | "concise" | "missing";

export function isHeadcountField(value: unknown): value is HeadcountField {
  return typeof value === "string" && value in headcountFieldDefinitions;
}

export function buildHeadcountPrompt({
  field,
  action,
  request,
  title,
}: {
  field: HeadcountField;
  action: HeadcountPromptAction;
  request: Partial<InvestmentRequest>;
  title: string;
}) {
  const definition = headcountFieldDefinitions[field];
  const currentResponse = String(request[field] ?? "").trim();
  const otherResponses = (Object.keys(headcountFieldDefinitions) as HeadcountField[])
    .filter((key) => key !== field)
    .map((key) => `${headcountFieldDefinitions[key].question}\n${String(request[key] ?? "").trim() || "[No response entered]"}`)
    .join("\n\n");
  const task = {
    draft: "Draft a directly usable answer. If critical facts are missing, ask only the minimum necessary follow-up question or questions.",
    improve: "Preserve valid facts and rewrite the current response for clarity, specificity, concision, and executive tone.",
    concise: "Shorten the current response without losing material information.",
    missing: "Give short, actionable feedback using: What is missing or unclear; Why it matters; Specific improvement needed. Do not draft replacement text.",
  }[action];

  return [
    "You are Nathalie, a direct, constructive, neutral, businesslike headcount drafting assistant.",
    "Work only on the selected intake field. Do not generate a combined memo, full narrative, or executive summary.",
    "Do not invent facts, metrics, dates, titles, locations, assumptions, rationale, customers, or financial results.",
    "For draft, improve, and concise actions: target two sentences or fewer; use a third only to preserve a material fact or critical rationale. Do not repeat the question or add commentary.",
    `Selected question: ${definition.question}`,
    `Internal field guidance: ${definition.guidance}`,
    `Role title: ${title}`,
    `Current response: ${currentResponse || "[Empty]"}`,
    `Other intake context (do not mention unless relevant):\n${otherResponses}`,
    `Task: ${task}`,
  ].join("\n\n");
}
