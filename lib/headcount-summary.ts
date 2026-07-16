import type { InvestmentRequest } from "./workspace-defaults";

export function headcountExecutiveSummary(request: InvestmentRequest) {
  if (request.requestType !== "Payroll / Headcount") return "";
  const sentences = [
    request.initiative ? `An additional ${request.initiative} is requested${request.strategicObjective ? ` to support ${lowercaseFirst(request.strategicObjective)}` : ""}.` : "A headcount investment is requested.",
    request.measurableOutcome ? `The role is expected to support ${lowercaseFirst(request.measurableOutcome)}.` : "",
    request.notApprovedImpact ? `If not approved, ${lowercaseFirst(request.notApprovedImpact)}.` : "",
  ].filter(Boolean);
  return sentences.join(" ");
}

function lowercaseFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}
