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

export type BusinessPlanWorkstream = {
  id: string;
  label: string;
  teamName: string;
  title: string;
};

export const businessPlanWorkstreams = [
  {
    id: PLAN_ID,
    label: "Essentials",
    teamName: "Essentials",
    title: "2027 Essentials Business Plan",
  },
  {
    id: "2027-prologis-energy-solutions-business-plan",
    label: "Prologis Energy Solutions",
    teamName: "Prologis Energy Solutions",
    title: "2027 Prologis Energy Solutions Business Plan",
  },
  {
    id: "2027-data-center-business-plan",
    label: "Data Center",
    teamName: "Data Center",
    title: "2027 Data Center Business Plan",
  },
  {
    id: "2027-strategic-capital-business-plan",
    label: "Strategic Capital",
    teamName: "Strategic Capital",
    title: "2027 Strategic Capital Business Plan",
  },
  {
    id: "2027-ventures-business-plan",
    label: "Ventures",
    teamName: "Ventures",
    title: "2027 Ventures Business Plan",
  },
] as const satisfies readonly BusinessPlanWorkstream[];

export const DEFAULT_PLAN_ID = PLAN_ID;

export const sectionDefaults = [
  {
    key: "summary",
    title: "Executive Summary",
    prompt: "Write one short paragraph that answers:",
    format: "1 paragraph, 4-6 sentences maximum",
    emphasize: "3-5 bullets",
    avoid: "Background history, long process explanation, and unsupported claims.",
    content: "",
    status: "Review" as SectionStatus,
  },
  {
    key: "priorities",
    title: "2027 Priorities",
    prompt: "Identify the most important priorities for 2027.",
    format: "Maximum of 3 priorities",
    emphasize: "For each priority: Priority name; 2-3 bullets answering the questions above",
    avoid: "Task lists, generic objectives, and priorities without accountable owners.",
    content: "",
    status: "Review" as SectionStatus,
  },
  {
    key: "growth",
    title: "Growth Opportunities",
    prompt: "Identify the most important growth opportunities being considered for 2027.",
    format: "3-5 opportunities maximum",
    emphasize: "Each opportunity should be summarized in a short paragraph or 3-5 bullets",
    avoid: "Unranked opportunity lists or opportunities disconnected from company strategy.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "support",
    title: "Support Needed from the Company",
    prompt: "Identify the support required from Prologis to successfully execute the plan.",
    format: "3-5 bullets",
    emphasize: "Each bullet should represent a specific ask or dependency",
    avoid: "Vague asks such as more alignment, better communication, or general help.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "ai",
    title: "AI and Productivity Strategy",
    prompt: "Describe how the team plans to leverage AI to increase productivity, improve execution, and scale the business.",
    format: "1-2 short paragraphs",
    emphasize: "How AI will be incorporated into the team's operating model, measurable efficiency gains, and how AI influences the team's future hiring strategy.",
    avoid: "Technology enthusiasm without a business workflow or control model.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "headcount",
    title: "Headcount Needs",
    prompt: "Identify only the headcount requests that are necessary to execute the plan.",
    format: "Bullet format",
    emphasize: "For each request: Role or capability; Purpose; ROI rationale",
    avoid: "Generic workload claims or headcount requests without prioritization.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "risks",
    title: "Key Risks and Dependencies",
    prompt: "Identify the risks and assumptions that could materially impact the success of the plan.",
    format: "3-5 bullets",
    emphasize: "Only include risks that matter to the approval decision.",
    avoid: "Exhaustive risk registers or risks without mitigation paths.",
    content: "",
    status: "Draft" as SectionStatus,
  },
  {
    key: "ask",
    title: "Bottom-Line Ask",
    prompt: "End with a short closing that answers:",
    format: "1 short paragraph",
    emphasize: "What leadership is approving, by when, and what happens next.",
    avoid: "Reopening the whole memo or adding new facts not supported above.",
    content: "",
    status: "Draft" as SectionStatus,
  },
];

export const approverDefaults = [
  { name: "Dan Letter", title: "Approver", posture: "Questions" },
  { name: "Tim Arndt", title: "Approver", posture: "Questions" },
];
