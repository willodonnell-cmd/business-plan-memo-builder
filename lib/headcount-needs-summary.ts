import type { InvestmentRequest } from "./workspace-defaults";

export type HeadcountCompletion = {
  requestId: string;
  title: string;
  complete: boolean;
  missing: string[];
};

export function validateHeadcountRequest(request: InvestmentRequest): HeadcountCompletion {
  const missing: string[] = [];
  if (!request.initiative.trim()) missing.push("Title");
  if (!request.strategicObjective.trim()) missing.push("Strategic objective");
  if (!request.milestone.trim()) missing.push("Business milestone");
  if (!request.alternatives.trim()) missing.push("Alternatives considered");
  if (!request.measurableOutcome.trim()) missing.push("Measurable business outcome");
  if (!request.notApprovedImpact.trim()) missing.push("Impact if not approved");
  if (!Number.isInteger(request.quantity) || request.quantity < 1) missing.push("Requested positions");

  for (const line of request.lines) {
    if (!line.jobTitle.trim()) missing.push("Job title");
    if (!line.roleHire.trim()) missing.push("Role / hire type");
    if (!line.location.trim()) missing.push("Location");
    if (!line.responsibilities.trim()) missing.push("Key responsibilities");
    if (!line.hireDate.trim()) missing.push("Hire date");
    if (!line.notesRationale.trim()) missing.push("Notes / rationale");
  }
  return { requestId: request.id, title: request.initiative.trim() || "Untitled request", complete: missing.length === 0, missing: [...new Set(missing)] };
}

export function headcountRequestFingerprint(request: InvestmentRequest) {
  return JSON.stringify({
    title: request.initiative,
    quantity: request.quantity,
    strategicObjective: request.strategicObjective,
    milestone: request.milestone,
    alternatives: request.alternatives,
    measurableOutcome: request.measurableOutcome,
    notApprovedImpact: request.notApprovedImpact,
    lines: request.lines.map(({ jobTitle, roleHire, location, responsibilities, hireDate, notesRationale }) => ({ jobTitle, roleHire, location, responsibilities, hireDate, notesRationale })),
  });
}

export function buildHeadcountNeedsSummary(requests: InvestmentRequest[]) {
  const totalPositions = requests.reduce((total, request) => total + request.quantity, 0);
  const groups = new Map<string, { title: string; location: string; quantity: number }>();
  for (const request of requests) {
    const line = request.lines[0];
    const title = request.initiative.trim();
    const location = line?.location.trim() ?? "";
    const key = `${title.toLowerCase()}|${location.toLowerCase()}`;
    const existing = groups.get(key) ?? { title, location, quantity: 0 };
    existing.quantity += request.quantity;
    groups.set(key, existing);
  }
  const roles = [...groups.values()].map((group) => `${group.title}${group.location ? ` in ${group.location}` : ""} (${group.quantity} ${group.quantity === 1 ? "position" : "positions"})`);
  const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const rationale = unique(requests.map((request) => request.strategicObjective));
  const outcomes = unique(requests.map((request) => request.measurableOutcome));
  const risks = unique(requests.map((request) => request.notApprovedImpact));
  const paragraphs = [
    `The plan requests ${totalPositions} ${totalPositions === 1 ? "position" : "positions"}, including ${joinExecutiveList(roles)}.`,
    `${joinExecutiveList(rationale)}. Expected outcomes include ${joinExecutiveList(outcomes)}.`,
    risks.length ? `Without approval, ${joinExecutiveList(risks)}.` : "",
  ].filter(Boolean);
  return { summary: paragraphs.join("\n\n"), totalPositions, requestCount: requests.length };
}

function joinExecutiveList(values: string[]) {
  const limited = values.slice(0, 4);
  if (limited.length === 1) return limited[0];
  if (limited.length === 2) return `${limited[0]} and ${limited[1]}`;
  return `${limited.slice(0, -1).join(", ")}, and ${limited.at(-1)}`;
}
