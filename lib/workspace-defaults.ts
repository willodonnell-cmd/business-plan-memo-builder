export type Role = "Business Team" | "Enablement" | "Approver";
export type Mode = "Section" | "Full Memo";
export type SectionStatus = "Draft" | "Review" | "Approved";
export type QuestionStatus = "Open" | "Answered" | "Resolved" | "Reopened" | "No Change Needed";
export type IssueType =
  | "Clarification"
  | "Functional Dependency"
  | "Support Need"
  | "Risk / Constraint"
  | "Required Input"
  | "Approval Concern";
export type EnablementFunction = "HR" | "Legal" | "IT" | "Finance & Accounting" | "Tax" | "Marketing" | "CLS" | "Other";
export type Visibility = "Public" | "Draft" | "Private";

export type MemoSection = {
  id: string;
  sectionKey: string;
  title: string;
  prompt: string;
  format: string;
  emphasize: string;
  avoid: string;
  content: string;
  status: SectionStatus;
};

export type Question = {
  id: string;
  sectionId: string;
  author: string;
  role: Role;
  visibility: Visibility;
  status: QuestionStatus;
  issueType: IssueType;
  functionName: EnablementFunction | "";
  body: string;
  response: string;
};

export type Approver = {
  id: string;
  name: string;
  title: string;
  posture: string;
};

export type WorkspacePlan = {
  id: string;
  title: string;
  teamName: string;
  approvalState: SectionStatus;
  approvalPosture: string;
  sections: MemoSection[];
  questions: Question[];
  approvers: Approver[];
};

export const PLAN_ID = "2027-business-plan";

export const sectionDefaults = [
  {
    key: "summary",
    title: "Executive Summary",
    prompt: "State the decision, the strategy, and the approval ask in plain executive language.",
    format: "One tight page opener with the recommendation, facts that matter, and implications.",
    emphasize: "Decision readiness, confidence level, and what changes if leadership approves the plan.",
    avoid: "Background history, long process explanation, and unsupported claims.",
    content:
      "Recommend approving the 2027 plan for the team once open dependencies and company support needs are resolved. The plan should make the strategic choices explicit, show where growth is expected, and identify the few decisions leadership must make now.",
    status: "Review" as SectionStatus,
  },
  {
    key: "priorities",
    title: "2027 Priorities",
    prompt: "Identify the few priorities that will drive the year, not every activity the team will pursue.",
    format: "Three to five priorities with outcomes, owners, and decision implications.",
    emphasize: "Tradeoffs, sequencing, measurable outcomes, and what will not be prioritized.",
    avoid: "Task lists, generic objectives, and priorities without accountable owners.",
    content:
      "1. Focus resources on the highest-conviction markets and customer segments.\n2. Standardize the operating rhythm for cross-functional planning.\n3. Use AI and automation to remove repeatable coordination work from the team.",
    status: "Review" as SectionStatus,
  },
  {
    key: "growth",
    title: "Growth Opportunities",
    prompt: "Show where the team believes growth can come from and what must be true to pursue it.",
    format: "Opportunity areas with expected impact, evidence, risks, and required decisions.",
    emphasize: "Materiality, timing, confidence, and the support required to capture growth.",
    avoid: "Unranked opportunity lists or opportunities disconnected from company strategy.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "support",
    title: "Support Needed from the Company",
    prompt: "Name the specific support, decisions, or resources needed from partner functions.",
    format: "Requests by function with why it matters, timing, and consequence of delay.",
    emphasize: "Decision owners, deadlines, and dependencies that block execution.",
    avoid: "Vague asks such as more alignment, better communication, or general help.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "ai",
    title: "AI and Productivity Strategy",
    prompt: "Explain how the team will use AI or productivity tooling to improve quality, speed, or scale.",
    format: "Use cases, operating changes, controls, and measurable productivity outcomes.",
    emphasize: "Practical adoption, governance, and workflow changes the team will actually own.",
    avoid: "Technology enthusiasm without a business workflow or control model.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "headcount",
    title: "Headcount Needs",
    prompt: "Describe the staffing ask and the work or risk it addresses.",
    format: "Role, timing, business case, alternatives considered, and impact if not approved.",
    emphasize: "Capacity constraints, leverage, critical capabilities, and approval decisions.",
    avoid: "Generic workload claims or headcount requests without prioritization.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "risks",
    title: "Key Risks and Dependencies",
    prompt: "Surface the issues that could change the plan or require leadership intervention.",
    format: "Risk, likelihood, impact, mitigation, and owner.",
    emphasize: "Material blockers, cross-functional dependencies, and watch items for approvers.",
    avoid: "Exhaustive risk registers or risks without mitigation paths.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "ask",
    title: "Bottom-Line Ask",
    prompt: "End with the exact approval request and decisions needed.",
    format: "A concise decision list with the requested posture from approvers.",
    emphasize: "What leadership is approving, by when, and what happens next.",
    avoid: "Reopening the whole memo or adding new facts not supported above.",
    content: "",
    status: "Draft" as SectionStatus,
  },
];

export const approverDefaults = [
  { name: "Dan Letter", title: "Approver", posture: "Needs Revision" },
  { name: "Tim Arndt", title: "Approver", posture: "Needs Revision" },
];
