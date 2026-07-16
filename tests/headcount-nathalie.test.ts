import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildHeadcountPrompt, headcountFieldDefinitions } from "../lib/headcount-prompts";
import { headcountExecutiveSummary } from "../lib/headcount-summary";
import type { InvestmentRequest } from "../lib/workspace-defaults";

const fields = Object.entries(headcountFieldDefinitions);
const workspaceSource = readFileSync(new URL("../app/workspace-client.tsx", import.meta.url), "utf8");
const nathalieRouteSource = readFileSync(new URL("../app/api/head-count-request-gpt/route.ts", import.meta.url), "utf8");
const coachRouteSource = readFileSync(new URL("../app/api/coach/route.ts", import.meta.url), "utf8");

const request: InvestmentRequest = {
  id: "request-1",
  planId: "2027-business-plan",
  requestType: "Payroll / Headcount",
  status: "Draft",
  ownerName: "Requester name must not appear in the summary",
  ownerEmail: "owner@example.com",
  initiative: "Sales Manager",
  strategicObjective: "Expand a defined customer segment",
  milestone: "Sustained qualified pipeline exceeds current capacity",
  alternatives: "The current team cannot absorb the work",
  measurableOutcome: "Increase supported customer opportunities",
  notApprovedImpact: "customer coverage remains constrained",
  quantity: 1,
  createdAt: 0,
  updatedAt: 0,
  submittedAt: null,
  archivedAt: null,
  lines: [],
};

test("Nathalie defines exactly the five Payroll / Headcount intake fields", () => {
  assert.deepEqual(fields.map(([key]) => key), ["strategicObjective", "milestone", "alternatives", "measurableOutcome", "notApprovedImpact"]);
  assert.deepEqual(fields.map(([, definition]) => definition.question), [
    "What strategic objective or growth opportunity does this investment enable?",
    "What business milestone should trigger this investment?",
    "What alternatives were considered?",
    "What measurable business outcome will this investment deliver?",
    "What is the impact if this investment is not approved?",
  ]);
});

test("each field-level action retains field guidance and excludes a full-review action", () => {
  for (const [field, definition] of fields) {
    for (const action of ["draft", "improve", "concise", "missing"] as const) {
      const prompt = buildHeadcountPrompt({ field: field as keyof typeof headcountFieldDefinitions, action, request, title: request.initiative });
      assert.match(prompt, new RegExp(escapeRegExp(definition.question)));
      assert.match(prompt, new RegExp(escapeRegExp(definition.guidance)));
      assert.match(prompt, /Work only on the selected intake field/);
      assert.doesNotMatch(prompt, /Review this full headcount request/i);
    }
  }
});

test("the Payroll / Headcount surface and Nathalie route expose no submission-review contract", () => {
  assert.doesNotMatch(workspaceSource, /Review full request|Review Entire Submission|Full Report Review|Submission Review/);
  assert.doesNotMatch(nathalieRouteSource, /action\?:\s*"prompt"\s*\|\s*"review"|Review this full headcount request/);
  assert.match(workspaceSource, /Draft this answer/);
  assert.match(workspaceSource, /Improve this answer/);
  assert.match(workspaceSource, /Make this more concise/);
  assert.match(workspaceSource, /Identify what is missing/);
});

test("Coach P remains the separate full-document reviewer", () => {
  assert.match(coachRouteSource, /Review the full memo/);
  assert.match(workspaceSource, /Review full memo/);
});

test("the short Payroll / Headcount executive summary excludes the requester", () => {
  const summary = headcountExecutiveSummary(request);
  assert.doesNotMatch(summary, /Requester name/);
  assert.equal(summary.split(/(?<=[.!?])\s+/).length, 3);
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
