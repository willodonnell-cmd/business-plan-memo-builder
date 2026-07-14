export type Role = "Business Team" | "Enablement" | "Approver" | "General Reader";
export type Mode = "Section" | "Full Memo";
export type SectionStatus = "Draft" | "Review" | "Approval" | "Approved";
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
export type InvestmentRequestStatus = "Draft" | "Submitted";
export type InvestmentRequestType = "Payroll / Headcount" | "Non-Payroll";

export type InvestmentWorkbookProfile = {
  planId: string;
  workbookName: string;
  templatePath: string;
  businessUnit: string;
  payrollInputRange: string;
  nonPayrollInputRange: string;
  groups: string[];
  expenseTypes: string[];
};

export type InvestmentRequestLine = {
  id: string;
  lineType: InvestmentRequestType;
  jobTitle: string;
  group: string;
  roleHire: string;
  location: string;
  responsibilities: string;
  hireDate: string;
  expenseDescription: string;
  expenseType: string;
  vendor: string;
  annualizedSpend: number | null;
  notesRationale: string;
};

export type InvestmentRequest = {
  id: string;
  planId: string;
  requestType: InvestmentRequestType;
  status: InvestmentRequestStatus;
  ownerName: string;
  ownerEmail: string;
  initiative: string;
  strategicObjective: string;
  milestone: string;
  alternatives: string;
  measurableOutcome: string;
  notApprovedImpact: string;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  lines: InvestmentRequestLine[];
};

export type InvestmentRequestExport = {
  requestId: string;
  workbookName: string;
  targetSheet: string;
  payrollRange: string;
  nonPayrollRange: string;
  payrollTsv: string;
  nonPayrollTsv: string;
};

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
  versions?: MemoSectionVersion[];
};

export type MemoSectionVersion = {
  id: string;
  sectionId: string;
  content: string;
  createdAt: number;
  createdByEmail: string;
  createdByName: string;
  actionType: "edit" | "restore";
  sourceVersionId: string | null;
  note: string;
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

export type ActivityEvent = {
  id: string;
  actorEmail: string;
  actorRole: Role;
  objectType: string;
  objectId: string;
  action: string;
  oldValue: string;
  newValue: string;
  createdAt: number;
};

export type CollaborativeGroup = {
  id: string;
  groupType: "Enablement" | "Advisor";
  name: string;
  description: string;
};

export type WorkspaceUser = {
  email: string;
  displayName: string;
  role: Role;
};

export type WorkspacePlan = {
  id: string;
  title: string;
  teamName: string;
  approvalState: SectionStatus;
  approvalPosture: string;
  user: WorkspaceUser;
  sections: MemoSection[];
  questions: Question[];
  approvers: Approver[];
  groups: CollaborativeGroup[];
  activity: ActivityEvent[];
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
    status: "Draft" as SectionStatus,
  },
  {
    key: "priorities",
    title: "2027 Priorities",
    prompt: "Identify the most important priorities for 2027.",
    format: "Maximum of 3 priorities",
    emphasize: "For each priority: Priority name; 2-3 bullets answering the questions above",
    avoid: "Task lists, generic objectives, and priorities without accountable owners.",
    content: "",
    status: "Draft" as SectionStatus,
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

export const investmentExpenseTypes = [
  "Professional Fees",
  "Occupancy",
  "Office Expenses",
  "IT Costs",
  "Marketing and Presentation",
  "Travel and Entertainment",
  "Employee events",
  "Insurance Non Property",
  "Licenses",
  "Recruiting and Relocation",
  "Seminars and Training",
  "Shareholder Relations",
  "Trustees and Director Fees",
  "Dues and Subscriptions",
  "Property Management Fee",
  "Maintenance",
  "Bank Service Charges",
  "Other",
  "Charitable Contributions",
  "Disputed Charges",
  "Allocated IT & Office Contra",
  "Essentials Bonus",
  "Contract Labor",
] as const;

export const investmentWorkbookProfiles: Record<string, InvestmentWorkbookProfile> = {
  [PLAN_ID]: {
    planId: PLAN_ID,
    workbookName: "G&A 2027 Plan - Essentials - Final.xlsx",
    templatePath: "/templates/G&A%202027%20Plan%20-%20Essentials%20Operations%20-%20Final.xlsx",
    businessUnit: "Essentials",
    payrollInputRange: "Investment Case Asks - Monthly!A5:H20 and BB5:BB20",
    nonPayrollInputRange: "Investment Case Asks - Monthly!A28:D42 and AR28:AR42",
    groups: [],
    expenseTypes: [...investmentExpenseTypes],
  },
  "2027-prologis-energy-solutions-business-plan": {
    planId: "2027-prologis-energy-solutions-business-plan",
    workbookName: "G&A 2027 Plan - Energy Solutions - Final.xlsx",
    templatePath: "/templates/G&A%202027%20Plan%20-%20Energy%20Solutions%20-%20Final.xlsx",
    businessUnit: "Energy Solutions",
    payrollInputRange: "Investment Case Asks - Monthly!A5:I20 and BC5:BC20",
    nonPayrollInputRange: "Investment Case Asks - Monthly!A28:E42 and AS28:AS42",
    groups: ["Energy", "Mobility", "Energy Finance", "ES Leadership"],
    expenseTypes: [...investmentExpenseTypes],
  },
  "2027-data-center-business-plan": {
    planId: "2027-data-center-business-plan",
    workbookName: "G&A 2027 Plan - Data Centers - Final.xlsx",
    templatePath: "/templates/G&A%202027%20Plan%20-%20Data%20Centers%20-%20Final.xlsx",
    businessUnit: "Data Centers",
    payrollInputRange: "Investment Case Asks - Monthly!A5:H20 and BB5:BB20",
    nonPayrollInputRange: "Investment Case Asks - Monthly!A28:D42 and AR28:AR42",
    groups: [],
    expenseTypes: [...investmentExpenseTypes],
  },
  "2027-strategic-capital-business-plan": {
    planId: "2027-strategic-capital-business-plan",
    workbookName: "G&A 2027 Plan - Strategic Capital - Final.xlsx",
    templatePath: "/templates/G&A%202027%20Plan%20-%20Strategic%20Capital%20-%20Final.xlsx",
    businessUnit: "Strategic Capital",
    payrollInputRange: "Investment Case Asks - Monthly!A5:I20 and BC5:BC20",
    nonPayrollInputRange: "Investment Case Asks - Monthly!A28:E42 and AS28:AS42",
    groups: ["Fund Management", "Global Strategy and Analytics", "Client Relations", "Strategic Capital Leadership"],
    expenseTypes: [...investmentExpenseTypes],
  },
};

export const investmentCaseQuestions = [
  {
    key: "strategicObjective",
    question: "What strategic objective or growth opportunity does this investment enable?",
    guidance:
      "Identify the business objective, strategic initiative, or growth opportunity this investment supports, and how it aligns with the 2027-2029 business plan.",
  },
  {
    key: "milestone",
    question: "What business milestone should trigger this investment?",
    guidance:
      "Describe why the investment is needed now, or identify the business milestone that would warrant the investment in the future.",
  },
  {
    key: "alternatives",
    question: "What alternatives were considered?",
    guidance:
      "Include process improvements, AI/automation, technology solutions, third-party providers, or redeployment of existing resources.",
  },
  {
    key: "measurableOutcome",
    question: "What measurable business outcome will this investment deliver?",
    guidance:
      "Tie the request to measurable growth or scale, such as revenue, AUM, MW deployed, customers served, sites, projects, savings, or risk reduction.",
  },
  {
    key: "notApprovedImpact",
    question: "What is the impact if this investment is not approved?",
    guidance:
      "Describe implications for growth, strategic initiatives, customer commitments, operations, financial results, or risk management.",
  },
] as const;

export const emptyInvestmentRequestLine: InvestmentRequestLine = {
  id: "",
  lineType: "Payroll / Headcount",
  jobTitle: "",
  group: "",
  roleHire: "",
  location: "",
  responsibilities: "",
  hireDate: "",
  expenseDescription: "",
  expenseType: "",
  vendor: "",
  annualizedSpend: null,
  notesRationale: "",
};
