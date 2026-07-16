import assert from "node:assert/strict";
import test from "node:test";
import { buildHeadcountNeedsSummary, validateHeadcountRequest } from "../lib/headcount-needs-summary";
import type { InvestmentRequest } from "../lib/workspace-defaults";

function request(overrides: Partial<InvestmentRequest> = {}): InvestmentRequest {
  return {
    id: "request-1",
    planId: "2027-business-plan",
    requestType: "Payroll / Headcount",
    status: "Draft",
    ownerName: "Requester",
    ownerEmail: "requester@example.com",
    initiative: "Sales Manager",
    strategicObjective: "Expand customer coverage in France",
    milestone: "Pipeline capacity requires dedicated coverage",
    alternatives: "Redeploy the current team",
    measurableOutcome: "Increase qualified customer opportunities",
    notApprovedImpact: "customer coverage remains constrained",
    quantity: 3,
    createdAt: 1,
    updatedAt: 1,
    submittedAt: null,
    archivedAt: null,
    lines: [{ id: "line-1", lineType: "Payroll / Headcount", jobTitle: "Sales Manager", group: "", roleHire: "New hire", location: "France", responsibilities: "Lead customer coverage", hireDate: "2027-01-01", expenseDescription: "", expenseType: "", vendor: "", annualizedSpend: null, notesRationale: "Expand capacity" }],
    ...overrides,
  };
}

test("headcount completion identifies every missing non-confidential field", () => {
  const completion = validateHeadcountRequest(request({ initiative: "", quantity: 0, lines: [{ ...request().lines[0], responsibilities: "", hireDate: "" }] }));
  assert.equal(completion.complete, false);
  assert.deepEqual(completion.missing, ["Title", "Requested positions", "Key responsibilities", "Hire date"]);
});

test("summary consolidates matching roles and avoids requester names", () => {
  const summary = buildHeadcountNeedsSummary([request(), request({ id: "request-2", quantity: 2 })]);
  assert.match(summary.summary, /5 positions/);
  assert.match(summary.summary, /Sales Manager in France \(5 positions\)/);
  assert.doesNotMatch(summary.summary, /Requester/);
  assert.equal(summary.summary.split("\n\n").length, 3);
});
