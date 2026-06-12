"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "business" | "enablement" | "approver";
type SectionStatus = "Draft" | "Review" | "Approved";
type CommentStatus = "Open" | "Resolved";
type Visibility = "Public" | "Draft" | "Team only";
type PlanStatus = "Draft" | "Ready for review";
type ApprovalPosture = "Ready for review" | "Open question" | "Approved";

const APPROVAL_POSTURES: ApprovalPosture[] = ["Ready for review", "Open question", "Approved"];
type SidePanelMode = "guidance" | "questions";
type ViewMode = "section" | "memo";

type MemoSection = {
  id: string;
  title: string;
  position: number;
  requirement: string;
  content: string;
  status: SectionStatus;
};

type SectionGuidance = {
  intent: string;
  answer: string[];
  format: string[];
};

type SectionComment = {
  id: string;
  sectionId: string;
  author: string;
  role: Role;
  body: string;
  visibility: Visibility;
  status: CommentStatus;
  response: string;
  createdAt: string;
  canDelete?: boolean;
};

type Approval = {
  id: string;
  sectionId: string | null;
  approver: string;
  posture: ApprovalPosture;
};

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

type Viewer = {
  email: string;
  label: string;
};

const roleLabels: Record<Role, string> = {
  business: "Business Team",
  enablement: "Enablement",
  approver: "Approver",
};

const sectionCoach: Record<string, string[]> = {
  "executive-summary": [
    "What is this business trying to become in 2027?",
    "Why does that matter to Prologis?",
    "What is the core business thesis?",
    "Which 3-5 takeaways should leadership remember?",
  ],
  priorities: [
    "What are the few priorities that determine success?",
    "What are we choosing not to do?",
    "What decision or support does each priority require?",
    "What outcome should Prologis expect if execution is strong?",
  ],
  growth: [
    "How large could each opportunity become?",
    "What customer need does it address?",
    "Why does Prologis have a right to win or a right to play?",
    "What must be proven in 2027 before scaling?",
  ],
  support: [
    "What approvals are needed?",
    "Which cross-functional dependencies matter most?",
    "What decision would accelerate progress?",
    "What would slow execution if not addressed?",
  ],
  "ai-productivity": [
    "Where will AI change the operating model?",
    "What work will be automated, accelerated, or augmented?",
    "What measurable efficiency gain is expected?",
    "How does AI affect future hiring strategy?",
  ],
  headcount: [
    "What role or capability is truly necessary?",
    "What business problem does it solve now?",
    "How does it support revenue, speed, or risk reduction?",
    "What is the expected return on investment?",
  ],
  risks: [
    "What is the real crux or obstacle?",
    "What assumptions must prove true?",
    "What would cause the team to slow down, change course, or stop?",
    "Which risks matter to the approval decision?",
  ],
  "bottom-line-ask": [
    "What exactly should leadership approve?",
    "What are the key drivers of success in 2027?",
    "What is the most important takeaway?",
    "Can the ask be read aloud in four sentences or less?",
  ],
};

const sectionGuidance: Record<string, SectionGuidance> = {
  "executive-summary": {
    intent: "Summarize what the business is trying to become in 2027, why it matters to Prologis, and the core business thesis.",
    answer: [
      "What is this business trying to become in 2027?",
      "Why does it matter to Prologis?",
      "What is the core business thesis?",
      "What are the 3-5 most important takeaways from the plan?",
    ],
    format: ["1 paragraph, 4-6 sentences maximum", "3-5 bullets"],
  },
  priorities: {
    intent: "Force prioritization by naming only the priorities that are critical to business success in 2027.",
    answer: [
      "What is the priority?",
      "Why is it a priority in 2027?",
      "What decision or action does it require?",
      "What is the expected outcome if we execute well?",
    ],
    format: ["Maximum of 3 priorities", "For each priority: priority name and 2-3 bullets"],
  },
  growth: {
    intent: "Describe the growth opportunities that could meaningfully impact the business over the next several years.",
    answer: [
      "What is the opportunity?",
      "How large could the opportunity become?",
      "What customer need does it address?",
      "Why does Prologis have a right to win or a right to play?",
      "What would need to happen for the opportunity to scale?",
    ],
    format: ["3-5 opportunities maximum", "Short paragraph or 3-5 bullets for each opportunity"],
  },
  support: {
    intent: "Make the support required from Prologis specific enough for leaders and cross-functional partners to act on.",
    answer: [
      "What approvals are needed?",
      "What organizational support is required?",
      "What cross-functional dependencies matter most?",
      "What decisions or actions would accelerate progress?",
      "What could slow execution if not addressed?",
    ],
    format: ["3-5 bullets", "Each bullet should represent a specific ask or dependency"],
  },
  "ai-productivity": {
    intent: "Explain how AI will increase productivity, improve execution, and help the business scale.",
    answer: [
      "How will AI be incorporated into the team's operating model?",
      "What activities will be automated, accelerated, or augmented?",
      "What measurable efficiency gains are expected?",
      "How will AI improve decision-making, customer engagement, analysis, or execution?",
      "How does AI influence the team's future hiring strategy?",
    ],
    format: ["1-2 short paragraphs"],
  },
  headcount: {
    intent: "Include only the headcount or capability requests necessary to execute the plan.",
    answer: [
      "What role or capability is needed?",
      "What business problem does it solve?",
      "Why is it needed now?",
      "How does it support revenue growth, execution speed, or risk reduction?",
      "What is the expected return on the investment?",
    ],
    format: ["Bullet format", "For each request: role or capability, purpose, and ROI rationale"],
  },
  risks: {
    intent: "Identify risks and assumptions that could materially affect approval or execution of the plan.",
    answer: [
      "What are the biggest risks?",
      "What assumptions must prove true?",
      "What dependencies exist inside or outside Prologis?",
      "What would cause us to slow down, change course, or stop?",
    ],
    format: ["3-5 bullets", "Only include risks that matter to the approval decision"],
  },
  "bottom-line-ask": {
    intent: "End with the leadership decision, the key drivers of success, and the most important takeaway.",
    answer: [
      "What are we asking leadership to approve?",
      "What are the key drivers of success in 2027?",
      "What is the most important takeaway from the plan?",
    ],
    format: ["1 short paragraph", "Maximum of 4 sentences"],
  },
};

const strategyChecks = [
  "What is the real strategic choice?",
  "What are we choosing not to do?",
  "Why does Prologis have a right to win?",
  "What must be true for this plan to work?",
  "What decision does leadership need to make?",
];

const coachStarters: Record<string, string[]> = {
  "executive-summary": [
    "What is the one business thesis leadership needs to understand?",
    "What would make this summary approval-ready?",
    "Which takeaways are strongest, and which are noise?",
  ],
  priorities: [
    "Are these truly the top three priorities?",
    "What decision does each priority require?",
    "What should we stop doing to make room for these priorities?",
  ],
  growth: [
    "Which opportunities are most material over the next several years?",
    "What must be true for this opportunity to scale?",
    "Why does Prologis have a right to win?",
  ],
  support: [
    "Which asks require a leadership decision?",
    "What dependency could slow execution?",
    "How can we make each ask more specific?",
  ],
  "ai-productivity": [
    "Where can AI create measurable productivity gains?",
    "Which activities should be automated, accelerated, or augmented?",
    "How should AI change future hiring needs?",
  ],
  headcount: [
    "Which roles are essential to execute the plan?",
    "What ROI case is missing or weak?",
    "Why is this capability needed now?",
  ],
  risks: [
    "Which risks matter to the approval decision?",
    "What assumptions must prove true?",
    "What would cause us to slow down or change course?",
  ],
  "bottom-line-ask": [
    "Is the approval ask specific enough?",
    "What is the most important takeaway for leadership?",
    "What would make this closing more decisive?",
  ],
};

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function roleAuthor(role: Role) {
  if (role === "business") return "Business Team";
  if (role === "enablement") return "Enablement Reviewer";
  return "Approval Group";
}

const REQUIRED_APPROVERS = [
  "Dan Letter",
  "Tim Arndt",
  "Damon Austin",
  "Carter Andrus",
  "Will O'Donnell",
];

export default function Home() {
  const [role, setRole] = useState<Role>("business");
  const [teamName, setTeamName] = useState("");
  const [teamNameEntry, setTeamNameEntry] = useState("");
  const [sections, setSections] = useState<MemoSection[]>([]);
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [sidePanel, setSidePanel] = useState<SidePanelMode>("guidance");
  const [viewMode, setViewMode] = useState<ViewMode>("section");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [howToOpen, setHowToOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(true);
  const [coachOpen, setCoachOpen] = useState(false);
  const [viewer, setViewer] = useState<Viewer>({ email: "", label: "" });
  const [editingName, setEditingName] = useState(false);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("Draft");
  const [approvalPanelOpen, setApprovalPanelOpen] = useState(false);

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const activeComments = useMemo(
    () => comments.filter((comment) => comment.sectionId === activeSection?.id),
    [comments, activeSection?.id],
  );
  const openQuestions = activeComments.filter((comment) => comment.status === "Open").length;
  const totalOpenQuestions = comments.filter((comment) => comment.status === "Open").length;

  function planApprovalPosture(approver: string): ApprovalPosture | null {
    return approvals.find((a) => a.sectionId === null && a.approver === approver)?.posture ?? null;
  }

  const planApprovedCount = REQUIRED_APPROVERS.filter(
    (approver) => planApprovalPosture(approver) === "Approved",
  ).length;

  const planFullyApproved = planApprovedCount === REQUIRED_APPROVERS.length;
  const planSubmittedForReview = planStatus === "Ready for review";
  const approverCanView = planSubmittedForReview;
  const reviewedSections = sections.filter((section) => section.status === "Review").length;
  const readinessLabel = planFullyApproved
    ? "Approved"
    : sections.length > 0 &&
        sections.every((section) => section.content.trim()) &&
        totalOpenQuestions === 0
      ? "Ready for approval"
      : `${totalOpenQuestions} open question${totalOpenQuestions === 1 ? "" : "s"}`;
  const cleanTeamName = teamName.trim();
  const hasTeamName = cleanTeamName.length > 0 && cleanTeamName !== "Team";
  const planTitle = hasTeamName
    ? `2027 ${cleanTeamName} Business Plan`
    : "2027 Business Plan";

  useEffect(() => {
    void loadWorkspace(role);
  }, [role]);

  useEffect(() => {
    if (role !== "business") {
      setCoachOpen(false);
      setSidePanel("questions");
    } else {
      setSidePanel("guidance");
    }
  }, [role]);

  async function loadWorkspace(nextRole = role) {
    setLoading(true);
    const params = new URLSearchParams({ role: nextRole });
    const response = await fetch(`/api/plan?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load plan");
    }

    const loadedTeamName = payload.plan?.teamName || "";
    setTeamName(loadedTeamName);
    setTeamNameEntry((current) => current || (loadedTeamName === "Team" ? "" : loadedTeamName));
    setSections(payload.sections);
    setComments(payload.comments);
    setApprovals(payload.approvals);
    setPlanStatus(payload.plan?.planStatus === "Ready for review" ? "Ready for review" : "Draft");
    setViewer(payload.viewer ?? { email: "", label: roleAuthor(nextRole) });
    setActiveSectionId((current) => current || payload.sections[0]?.id || "");
    setLoading(false);
  }

  async function savePlanName(nextTeamName = teamNameEntry) {
    const cleanName = nextTeamName.trim();
    if (!cleanName) return;

    setSaving(true);
    setTeamName(cleanName);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-plan",
        teamName: cleanName,
      }),
    });
    setSaving(false);
  }

  async function saveSection(section: MemoSection) {
    setSaving(true);
    const nextStatus = section.status === "Draft" ? "Review" : section.status;
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-section",
        sectionId: section.id,
        content: section.content,
        status: nextStatus,
      }),
    });
    setSaving(false);
    await loadWorkspace(role);
  }

  async function createQuestion() {
    if (!activeSection || !draftComment.trim()) return;
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-comment",
        sectionId: activeSection.id,
        role,
        body: draftComment,
        visibility,
      }),
    });
    setDraftComment("");
    setSaving(false);
    await loadWorkspace(role);
  }

  async function deleteQuestion(commentId: string) {
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete-comment",
        role,
        commentId,
      }),
    });
    setSaving(false);
    await loadWorkspace(role);
  }

  async function updateQuestion(comment: SectionComment, updates: Partial<SectionComment>) {
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-comment",
        commentId: comment.id,
        status: updates.status ?? comment.status,
        response: updates.response ?? comment.response,
      }),
    });
    setSaving(false);
    await loadWorkspace(role);
  }

  async function submitPlan() {
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit-plan",
        role,
      }),
    });
    setSaving(false);
    await loadWorkspace(role);
  }

  async function saveApproval(posture: ApprovalPosture, approverName?: string) {
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-approval",
        approver: approverName ?? viewer.label ?? roleAuthor("approver"),
        posture,
      }),
    });
    setSaving(false);
    await loadWorkspace(role);
  }

  function updateActiveSection(updates: Partial<MemoSection>) {
    if (!activeSection) return;
    setSections((current) =>
      current.map((section) =>
        section.id === activeSection.id ? { ...section, ...updates } : section,
      ),
    );
  }

  function exportPdf() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#161b18]">
      <div className="app-shell mx-auto max-w-7xl px-5 py-5 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-[#d8d6cf] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1f5d3a]">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              {!loading && (!hasTeamName || editingName) ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1 text-xl font-semibold tracking-tight text-[#1a1e1b]">
                    <span className="shrink-0 text-[#7a8278]">2027</span>
                    <input
                      autoFocus
                      className="w-36 rounded-md border border-[#c9c6be] bg-white px-2 py-0.5 text-xl font-semibold tracking-tight outline-none focus:border-[#1f5d3a] focus:ring-2 focus:ring-[#1f5d3a]/10"
                      onChange={(event) => setTeamNameEntry(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void savePlanName(teamNameEntry);
                          setEditingName(false);
                        }
                        if (event.key === "Escape") setEditingName(false);
                      }}
                      placeholder="Business name"
                      value={teamNameEntry}
                    />
                    <span className="shrink-0 text-[#7a8278]">Business Plan</span>
                  </div>
                  <button
                    className="rounded-md bg-[#1f5d3a] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#17462c] disabled:opacity-50"
                    disabled={saving || !teamNameEntry.trim()}
                    onClick={() => {
                      void savePlanName(teamNameEntry);
                      setEditingName(false);
                    }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {editingName && (
                    <button
                      className="text-xs text-[#8a9490] hover:text-[#3f4842]"
                      onClick={() => setEditingName(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">{planTitle}</h1>
                  <button
                    aria-label="Edit plan name"
                    className="rounded-md p-1 text-[#9aa49e] transition-colors hover:bg-[#eceae3] hover:text-[#3f4842]"
                    onClick={() => setEditingName(true)}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-xs text-[#7a8278]">Business Strategy Memo Builder</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg border border-[#d0cec7] bg-[#f7f6f2] p-1 text-sm shadow-sm">
              {(["business", "enablement", "approver"] as Role[]).map((item) => (
                <button
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                    role === item
                      ? "bg-white text-[#1a1e1b] shadow-sm ring-1 ring-[#d0cec7]"
                      : "text-[#5a6360] hover:text-[#1a1e1b]"
                  }`}
                  key={item}
                  onClick={() => {
                    setRole(item);
                  }}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item === "business"
                        ? "bg-[#2563eb]"
                        : item === "enablement"
                          ? "bg-[#d97706]"
                          : "bg-[#16a34a]"
                    } ${role === item ? "opacity-100" : "opacity-40"}`}
                  />
                  {roleLabels[item]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0cec7] bg-white px-3 py-1.5 text-sm font-medium text-[#3f4842] shadow-sm transition-colors hover:bg-[#f2f0ea] hover:text-[#1a1e1b]"
                onClick={() => setHowToOpen(true)}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                </svg>
                How to
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0cec7] bg-white px-3 py-1.5 text-sm font-medium text-[#3f4842] shadow-sm transition-colors hover:bg-[#f2f0ea] hover:text-[#1a1e1b]"
                onClick={exportPdf}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15V3m0 12-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </header>

        {hasTeamName ? (
          <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-grid w-full grid-cols-2 rounded-lg border border-[#d0cec7] bg-white p-1 text-sm sm:w-auto">
              <button
                className={`rounded-md px-3 py-2 font-medium ${
                  viewMode === "section"
                    ? "bg-[#1f5d3a] text-white"
                    : "text-[#3f4842] hover:bg-[#eef1ec]"
                }`}
                onClick={() => {
                  setViewMode("section");
                  setSidePanel("guidance");
                }}
              >
                Section
              </button>
              <button
                className={`rounded-md px-3 py-2 font-medium ${
                  viewMode === "memo"
                    ? "bg-[#1f5d3a] text-white"
                    : "text-[#3f4842] hover:bg-[#eef1ec]"
                }`}
                onClick={() => {
                  setViewMode("memo");
                  setSidePanel("guidance");
                }}
              >
                Full memo
              </button>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <SummaryPill
                  label="Plan approved"
                  value={`${planApprovedCount}/${REQUIRED_APPROVERS.length}`}
                />
                <SummaryPill label="Questions" value={`${totalOpenQuestions} open`} />
              </div>
              {role === "business" ? (
                planSubmittedForReview ? (
                  <span className="inline-flex items-center justify-center rounded-lg border border-[#cfe0d1] bg-[#eef6ef] px-3 py-2 text-xs font-semibold text-[#1f5d3a]">
                    Submitted for review
                  </span>
                ) : (
                  <button
                    className="rounded-lg bg-[#1f5d3a] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#17462c] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void submitPlan()}
                  >
                    {saving ? "Submitting…" : "Submit plan for review"}
                  </button>
                )
              ) : null}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-[#d8d6cf] bg-white p-8 text-sm">
            Loading workspace...
          </div>
        ) : !hasTeamName ? null : role === "approver" && !approverCanView ? (
          <div className="rounded-lg border border-[#d8d6cf] bg-white p-10 text-center">
            <p className="text-sm font-semibold text-[#1a1e1b]">Plan not yet available</p>
            <p className="mt-2 text-sm leading-6 text-[#5d665f]">
              The business team has not submitted this plan for review. You will be able to
              review and approve once it is submitted.
            </p>
          </div>
        ) : !activeSection ? (
          <div className="rounded-lg border border-[#d8d6cf] bg-white p-8 text-sm">
            Loading sections...
          </div>
        ) : viewMode === "memo" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <FullMemoReader
              sections={sections}
              comments={comments}
              onOpenQuestions={(sectionId) => {
                setActiveSectionId(sectionId);
                setSidePanel("questions");
              }}
            />
            {sidePanel === "questions" ? (
              <aside className="drawer rounded-lg border border-[#d8d6cf] bg-[#fbfaf7] p-5">
                <QuestionsDrawer
                  viewer={viewer}
                  role={role}
                  comments={activeComments}
                  draftComment={draftComment}
                  visibility={visibility}
                  saving={saving}
                  onClose={() => setSidePanel("guidance")}
                  onCommentChange={setDraftComment}
                  onVisibilityChange={setVisibility}
                  onCreate={createQuestion}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                />
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-[#d8d6cf] bg-white">
              <div className="border-b border-[#eceae3] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                  Memo outline
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceae3]">
                    <div
                      className="h-full rounded-full bg-[#1f5d3a] transition-all"
                      style={{ width: `${Math.round((reviewedSections / (sections.length || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums text-[#68716b]">
                    {reviewedSections}/{sections.length || 8} in review
                  </span>
                </div>
              </div>
              <nav className="p-2 space-y-0.5">
                {sections.map((section) => {
                  const sectionComments = comments.filter((comment) => comment.sectionId === section.id);
                  const sectionOpen = sectionComments.filter((comment) => comment.status === "Open").length;
                  const isActive = section.id === activeSection.id;
                  return (
                    <button
                      className={`group relative w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-[#eef4ed] text-[#1a2e1f]"
                          : "text-[#3f4842] hover:bg-[#f5f4f0]"
                      }`}
                      key={section.id}
                      onClick={() => {
                        setActiveSectionId(section.id);
                        setSidePanel(role === "business" ? "guidance" : "questions");
                        setGuidanceOpen(true);
                      }}
                    >
                      {isActive && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-[#1f5d3a]" />
                      )}
                      <span className="block font-medium leading-5">{section.title}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <SectionStatusBadge status={section.status} />
                        {sectionOpen > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">
                            {sectionOpen} open
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="rounded-lg border border-[#d8d6cf] bg-white">
              <div className="flex flex-col gap-4 border-b border-[#e5e2da] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5b665f]">
                    Section {activeSection.position}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">{activeSection.title}</h2>
                  <p className="mt-2 text-sm text-[#5d665f]">{activeSection.requirement}</p>
                </div>
              </div>

              <div className="grid min-h-[560px] gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="p-5">
                  {role === "business" ? (
                    <BusinessEditor
                      section={activeSection}
                      saving={saving}
                      onChange={updateActiveSection}
                      onSave={() => saveSection(activeSection)}
                    />
                  ) : (
                    <MemoReader section={activeSection} />
                  )}

                </div>

                <aside className="border-t border-[#e5e2da] bg-[#fbfaf7] p-5 lg:border-l lg:border-t-0">
                  {sidePanel === "guidance" ? (
                    <SectionGuidancePanel
                      guidance={sectionGuidance[activeSection.id]}
                      open={guidanceOpen}
                      role={role}
                      openQuestions={openQuestions}
                      onToggle={() => setGuidanceOpen((current) => !current)}
                      onOpenCoach={() => setCoachOpen(true)}
                      onOpenQuestions={() => setSidePanel("questions")}
                    />
                  ) : (
                    <QuestionsDrawer
                      viewer={viewer}
                      role={role}
                      comments={activeComments}
                      draftComment={draftComment}
                      visibility={visibility}
                      saving={saving}
                      onClose={() => setSidePanel("guidance")}
                      onCommentChange={setDraftComment}
                      onVisibilityChange={setVisibility}
                      onCreate={createQuestion}
                      onUpdate={updateQuestion}
                      onDelete={deleteQuestion}
                    />
                  )}
                </aside>
              </div>
            </section>
          </div>
        )}

        {hasTeamName && role === "approver" && approverCanView ? (
          <PlanApprovalPanel
            approvals={approvals}
            approvedCount={planApprovedCount}
            open={approvalPanelOpen}
            saving={saving}
            viewer={viewer}
            onSaveApproval={saveApproval}
            onToggle={() => setApprovalPanelOpen((current) => !current)}
          />
        ) : null}
      </div>

      {coachOpen && activeSection ? (
        <CoachModal
          section={activeSection}
          onClose={() => setCoachOpen(false)}
        />
      ) : null}

      {howToOpen ? <HowToModal onClose={() => setHowToOpen(false)} /> : null}

      <PrintMemo title={planTitle} sections={sections} readinessLabel={readinessLabel} />
    </main>
  );
}

function approvalPostureStyle(posture: ApprovalPosture | null, active = false) {
  if (posture === "Approved") {
    return active
      ? "border-[#1f5d3a] bg-[#1f5d3a] text-white"
      : "bg-[#dcfce7] text-[#166534]";
  }
  if (posture === "Open question") {
    return active
      ? "border-[#b91c1c] bg-[#b91c1c] text-white"
      : "bg-[#fee2e2] text-[#991b1b]";
  }
  if (posture === "Ready for review") {
    return active
      ? "border-[#1d4ed8] bg-[#1d4ed8] text-white"
      : "bg-[#dbeafe] text-[#1e40af]";
  }
  return active
    ? "border-[#d0cec7] bg-white text-[#3f4842]"
    : "bg-[#f1f0ec] text-[#68716b]";
}

function PlanApprovalPanel({
  approvals,
  approvedCount,
  open,
  saving,
  viewer,
  onSaveApproval,
  onToggle,
}: {
  approvals: Approval[];
  approvedCount: number;
  open: boolean;
  saving: boolean;
  viewer: Viewer;
  onSaveApproval: (posture: ApprovalPosture, approverName?: string) => void;
  onToggle: () => void;
}) {
  function postureFor(approver: string): ApprovalPosture | null {
    return approvals.find((a) => a.sectionId === null && a.approver === approver)?.posture ?? null;
  }

  const viewerIsNamed = REQUIRED_APPROVERS.includes(viewer.label);

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-[#d8d6cf] bg-white">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#fafaf7]"
        onClick={onToggle}
        type="button"
      >
        <span>
          <span className="block text-sm font-semibold text-[#1a1e1b]">Plan approval</span>
          <span className="mt-0.5 block text-xs text-[#8a9490]">
            {approvedCount}/{REQUIRED_APPROVERS.length} approved · all five must approve the full plan
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-[#1f5d3a]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="divide-y divide-[#eceae3] border-t border-[#eceae3]">
          {REQUIRED_APPROVERS.map((approver) => {
            const posture = postureFor(approver);
            const isViewer = !viewerIsNamed || viewer.label === approver;

            return (
              <div className="flex items-center justify-between gap-3 px-5 py-3" key={approver}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eceae3] text-xs font-semibold text-[#3f4842]">
                    {approver
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="text-sm font-medium text-[#1a1e1b]">
                    {approver}
                    {viewer.label === approver && (
                      <span className="ml-1.5 text-xs text-[#8a9490]">(you)</span>
                    )}
                  </span>
                </div>
                {isViewer ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {APPROVAL_POSTURES.map((p) => (
                      <button
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          posture === p
                            ? approvalPostureStyle(p, true)
                            : "border-[#d0cec7] bg-white text-[#3f4842] hover:bg-[#f2f1ec]"
                        }`}
                        disabled={saving}
                        key={p}
                        onClick={() => onSaveApproval(p, approver)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalPostureStyle(posture)}`}
                  >
                    {posture ?? "Pending"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SectionStatusBadge({ status }: { status: SectionStatus }) {
  const styles: Record<SectionStatus, string> = {
    Draft: "bg-[#f1f0ec] text-[#68716b]",
    Review: "bg-[#fff7ed] text-[#9a3412]",
    Approved: "bg-[#dcfce7] text-[#166534]",
  };
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d8d6cf] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#68716b]">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function TeamNameEntry({
  saving,
  value,
  onChange,
  onSave,
}: {
  saving: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="mx-auto mt-20 max-w-xl rounded-lg border border-[#d8d6cf] bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
        New business plan
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Name the team</h2>
      <p className="mt-2 text-sm leading-6 text-[#56615a]">
        This will become the plan title.
      </p>
      <label className="mt-5 block text-sm font-semibold">
        Team name
        <input
          autoFocus
          className="mt-2 w-full rounded-md border border-[#c9c6be] bg-[#fffefa] px-3 py-2 text-base outline-none focus:border-[#1f5d3a]"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
          }}
          placeholder="Data Centers"
          value={value}
        />
      </label>
      <button
        className="mt-4 rounded-md bg-[#1f5d3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17462c] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={saving || !value.trim()}
        onClick={onSave}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </section>
  );
}

function SectionGuidancePanel({
  guidance,
  open,
  role,
  openQuestions,
  onToggle,
  onOpenCoach,
  onOpenQuestions,
}: {
  guidance?: SectionGuidance;
  open: boolean;
  role: Role;
  openQuestions: number;
  onToggle: () => void;
  onOpenCoach: () => void;
  onOpenQuestions: () => void;
}) {
  if (!guidance) return null;

  return (
    <section>
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#d8d6cf] bg-white px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm font-semibold">Guidance</span>
          <span className="mt-0.5 block text-xs text-[#68716b]">
            Expectations for this section
          </span>
        </span>
        <span className="text-sm font-semibold text-[#1f5d3a]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      <div className="mt-3 grid gap-2">
        {role === "business" ? (
          <button
            className="rounded-md bg-[#1f5d3a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#17462c]"
            onClick={onOpenCoach}
          >
            GPT Coach
          </button>
        ) : null}
        <button
          className="rounded-md border border-[#b9b6ae] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#f2f1ec]"
          onClick={onOpenQuestions}
        >
          Questions {openQuestions > 0 ? `(${openQuestions})` : ""}
        </button>
      </div>
      {open ? (
        <div className="mt-3 rounded-lg border border-[#d8d6cf] bg-white px-4 py-4">
          <p className="text-sm leading-6 text-[#3f4842]">{guidance.intent}</p>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                Answer
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#242a26]">
                {guidance.answer.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f5d3a]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                Format
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#242a26]">
                {guidance.format.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#949084]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FullMemoReader({
  sections,
  comments,
  onOpenQuestions,
}: {
  sections: MemoSection[];
  comments: SectionComment[];
  onOpenQuestions: (sectionId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d8d6cf] bg-white">
      <div className="border-b border-[#e5e2da] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5b665f]">
          Full memo
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Read the complete plan</h2>
      </div>
      <div className="divide-y divide-[#ebe8e1]">
        {sections.map((section) => {
          const openCount = comments.filter(
            (comment) =>
              comment.sectionId === section.id && comment.status === "Open",
          ).length;

          return (
            <article className="p-5" key={section.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                    Section {section.position}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{section.title}</h3>
                </div>
                <button
                  className="rounded-md border border-[#b9b6ae] px-3 py-2 text-sm font-semibold hover:bg-[#f2f1ec]"
                  onClick={() => onOpenQuestions(section.id)}
                >
                  Questions {openCount > 0 ? `(${openCount})` : ""}
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-lg border border-[#e2ded6] bg-[#fffefa] p-4 text-sm leading-7 text-[#242a26]">
                {section.content.trim() || "Section draft pending."}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BusinessEditor({
  section,
  saving,
  onChange,
  onSave,
}: {
  section: MemoSection;
  saving: boolean;
  onChange: (updates: Partial<MemoSection>) => void;
  onSave: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SectionStatusBadge status={section.status} />
          {section.status === "Draft" && (
            <span className="text-xs text-[#8a9490]">Saving will move this to Review</span>
          )}
        </div>
        <button
          className="rounded-lg bg-[#1f5d3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#17462c] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <textarea
        className="min-h-[420px] w-full resize-y rounded-lg border border-[#c9c6be] bg-[#fffefa] p-4 text-sm leading-6 outline-none focus:border-[#1f5d3a]"
        value={section.content}
        onChange={(event) => onChange({ content: event.target.value })}
        placeholder="Draft the section here."
      />
    </div>
  );
}

function MemoReader({ section }: { section: MemoSection }) {
  return (
    <article className="min-h-[420px] rounded-lg border border-[#e2ded6] bg-[#fffefa] p-5">
      {section.content.trim() ? (
        <div className="whitespace-pre-wrap text-sm leading-7 text-[#242a26]">{section.content}</div>
      ) : (
        <p className="text-sm text-[#747b75]">No content has been drafted for this section yet.</p>
      )}
    </article>
  );
}

function CoachModal({
  section,
  onClose,
}: {
  section: MemoSection;
  onClose: () => void;
}) {
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachContext, setCoachContext] = useState("");
  const [contextFileName, setContextFileName] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const starterQuestions = coachStarters[section.id] ?? strategyChecks.slice(0, 3);

  function addQuestion(question: string) {
    setCoachQuestion(question);
  }

  async function askCoach() {
    const question = coachQuestion.trim();
    if (!question || coachLoading) return;

    setCoachLoading(true);
    setCoachError("");
    setMessages((current) => [...current, { role: "user", content: question }]);
    setCoachQuestion("");

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionTitle: section.title,
          draft: section.content,
          question,
          context: coachContext,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "GPT Coach failed to respond.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.text || "No response returned." },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GPT Coach failed to respond.";
      setCoachError(message);
    } finally {
      setCoachLoading(false);
    }
  }

  function loadContextFile(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCoachContext(String(reader.result ?? "").slice(0, 12000));
      setContextFileName(file.name);
    };
    reader.readAsText(file);
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-0 pt-6 backdrop-blur-sm sm:items-center sm:pb-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-[#d8d6cf] bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-[#e5e2da] bg-gradient-to-r from-[#1a3d28] to-[#1f5d3a] px-6 py-4 sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
                  GPT Coach
                </p>
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              </div>
            </div>
            <button
              className="mt-0.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Pressure-test this section. Focus on questions, gaps, and the decisions leadership will need to make.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
              Suggested questions
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {starterQuestions.map((question) => (
                <button
                  className="rounded-xl border border-[#e0ddd6] bg-[#fafaf7] px-3 py-2.5 text-left text-sm leading-5 text-[#3a4440] transition-colors hover:border-[#1f5d3a]/30 hover:bg-[#eef4ed]"
                  key={question}
                  onClick={() => addQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-[#d8d6cf] bg-[#f8f7f4]">
            <div className="flex items-center gap-2 border-b border-[#e5e2da] px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-[#1f5d3a]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                Conversation
              </p>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-4 text-center text-sm text-[#8a9490]">
                  Choose a suggested question or ask your own below.
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    key={`${message.role}-${index}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        message.role === "assistant"
                          ? "bg-[#1f5d3a] text-white"
                          : "bg-[#e5e2da] text-[#3f4842]"
                      }`}
                    >
                      {message.role === "assistant" ? "G" : "Y"}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        message.role === "assistant"
                          ? "rounded-tl-sm bg-white shadow-sm ring-1 ring-[#e5e2da]"
                          : "rounded-tr-sm bg-[#1f5d3a] text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              {coachLoading ? (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f5d3a] text-xs font-bold text-white">
                    G
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-[#e5e2da]">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#68716b] [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#68716b] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#68716b] [animation-delay:300ms]" />
                  </div>
                </div>
              ) : null}
            </div>
            {coachError ? (
              <div className="border-t border-[#e5e2da] px-4 py-3">
                <p className="rounded-lg border border-[#ead0c4] bg-[#fff5ef] p-3 text-sm leading-6 text-[#8a3d24]">
                  {coachError}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-[#d8d6cf] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1a1e1b]">Reference context</p>
                {contextFileName ? (
                  <p className="mt-0.5 text-xs text-[#68716b]">{contextFileName}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-[#8a9490]">Paste excerpts or attach a file to give GPT context.</p>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#c9c6be] px-3 py-1.5 text-sm font-medium text-[#3f4842] transition-colors hover:bg-[#f2f1ec]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" />
                  <path d="M15.172 6.343a4 4 0 0 1 0 5.657l-5.657 5.657a4 4 0 0 1-5.657-5.657l1.414-1.414" strokeLinecap="round" />
                </svg>
                Attach file
                <input
                  accept=".txt,.md,.csv,.rtf"
                  className="sr-only"
                  type="file"
                  onChange={(event) => loadContextFile(event.target.files?.[0])}
                />
              </label>
            </div>
            <textarea
              className="mt-3 min-h-24 w-full resize-y rounded-lg border border-[#e0ddd6] bg-[#fafaf7] p-3 text-sm leading-6 outline-none focus:border-[#1f5d3a] focus:ring-2 focus:ring-[#1f5d3a]/10"
              value={coachContext}
              onChange={(event) => {
                setCoachContext(event.target.value.slice(0, 12000));
                setContextFileName("");
              }}
              placeholder="Paste relevant excerpts from a prior business plan or presentation."
            />
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold text-[#1a1e1b]">
              Ask your own question
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#d8d6cf] bg-[#fafaf7] p-3 text-sm leading-6 outline-none focus:border-[#1f5d3a] focus:ring-2 focus:ring-[#1f5d3a]/10"
              value={coachQuestion}
              onChange={(event) => setCoachQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void askCoach();
                }
              }}
              placeholder="Example: What would make this section clearer for an Executive Committee approval decision?"
            />
            <p className="mt-1.5 text-xs text-[#8a9490]">⌘ Enter to send</p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className="rounded-lg border border-[#d0cec7] px-4 py-2 text-sm font-medium text-[#3f4842] transition-colors hover:bg-[#f2f1ec]"
              onClick={() => setCoachQuestion("")}
            >
              Clear
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f5d3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#17462c] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={coachLoading || !coachQuestion.trim()}
              onClick={() => void askCoach()}
            >
              {coachLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Asking...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Ask GPT
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function visibilityMeta(v: Visibility): { label: string; style: string } {
  if (v === "Draft") return { label: "Draft", style: "bg-[#fef3c7] text-[#92400e]" };
  if (v === "Team only") return { label: "Team only", style: "bg-[#ede9fe] text-[#5b21b6]" };
  return { label: "Public", style: "bg-[#dcfce7] text-[#166534]" };
}

function normalizeCommentStatus(status: string): CommentStatus {
  return status === "Resolved" ? "Resolved" : "Open";
}

function statusMeta(s: CommentStatus): { label: string; style: string } {
  if (s === "Resolved") return { label: "Resolved", style: "bg-[#dcfce7] text-[#166534]" };
  return { label: "Open", style: "bg-[#fee2e2] text-[#991b1b]" };
}

function QuestionsDrawer({
  viewer,
  role,
  comments,
  draftComment,
  visibility,
  saving,
  onClose,
  onCommentChange,
  onVisibilityChange,
  onCreate,
  onUpdate,
  onDelete,
}: {
  viewer: Viewer;
  role: Role;
  comments: SectionComment[];
  draftComment: string;
  visibility: Visibility;
  saving: boolean;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onCreate: () => void;
  onUpdate: (comment: SectionComment, updates: Partial<SectionComment>) => void;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const openCount = comments.filter((c) => c.status === "Open").length;

  return (
    <div className="flex h-full flex-col">
      <DrawerHeader
        title={`Questions${openCount > 0 ? ` (${openCount} open)` : ""}`}
        onClose={onClose}
      />

      {/* Compose area */}
      <div className="mb-5 rounded-xl border border-[#d8d6cf] bg-[#fafaf7] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#68716b]">
          Ask a question
        </p>
        <p className="mb-3 text-[11px] text-[#8a9490]">
          Signed in as <span className="font-medium text-[#3f4842]">{viewer.label || roleLabels[role]}</span>
        </p>
        <textarea
          className="min-h-24 w-full resize-y rounded-lg border border-[#d0cec7] bg-white p-3 text-sm leading-6 outline-none focus:border-[#1f5d3a] focus:ring-2 focus:ring-[#1f5d3a]/10"
          value={draftComment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Ask a focused, section-level question…"
        />
        <div className="mt-2 flex items-center gap-1.5">
          <select
            className="min-w-0 flex-1 rounded-md border border-[#d0cec7] bg-white px-2 py-1.5 text-xs text-[#3f4842] outline-none focus:border-[#1f5d3a]"
            value={visibility}
            onChange={(event) => onVisibilityChange(event.target.value as Visibility)}
          >
            <option value="Public">Public — everyone sees this</option>
            <option value="Team only">Team only — enablement + business</option>
            <option value="Draft">Draft — only you</option>
          </select>
          <button
            aria-label="Submit question"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1f5d3a] text-white transition-colors hover:bg-[#17462c] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={saving || !draftComment.trim()}
            onClick={onCreate}
            title="Submit"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Question cards */}
      {comments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f0efea]">
            <svg className="h-5 w-5 text-[#8a9490]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#3f4842]">No questions yet</p>
          <p className="mt-1 text-xs text-[#8a9490]">Ask a question above to start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const vm = visibilityMeta(comment.visibility as Visibility);
            const sm = statusMeta(normalizeCommentStatus(comment.status));
            return (
              <div
                className="overflow-hidden rounded-xl border border-[#d8d6cf] bg-white"
                key={comment.id}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 border-b border-[#eceae3] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.style}`}>
                      {sm.label}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${vm.style}`}>
                      {vm.label}
                    </span>
                    <span className="text-xs text-[#8a9490]">·</span>
                    <span className="text-xs font-medium text-[#3f4842]">{comment.author}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="rounded-md border border-[#d0cec7] bg-white px-2 py-1 text-xs text-[#3f4842] outline-none"
                      value={normalizeCommentStatus(comment.status)}
                      onChange={(event) =>
                        onUpdate(comment, { status: event.target.value as CommentStatus })
                      }
                    >
                      <option>Open</option>
                      <option>Resolved</option>
                    </select>
                    {comment.canDelete ? (
                      <button
                        aria-label="Delete question"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[#d0cec7] text-[#8a9490] transition-colors hover:border-[#e57373] hover:bg-[#fff5f5] hover:text-[#c62828] disabled:opacity-40"
                        disabled={saving}
                        onClick={() => void onDelete(comment.id)}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Question body */}
                <div className="px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#1a1e1b]">{comment.body}</p>
                </div>

                {/* Business response */}
                <div className="border-t border-[#eceae3] bg-[#fafaf7] px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#68716b]">
                    Business response
                  </p>
                  {role === "business" ? (
                    <textarea
                      className="min-h-16 w-full resize-y rounded-lg border border-[#d0cec7] bg-white p-2.5 text-sm leading-6 outline-none focus:border-[#1f5d3a] focus:ring-2 focus:ring-[#1f5d3a]/10"
                      defaultValue={comment.response}
                      onBlur={(event) => onUpdate(comment, { response: event.target.value })}
                      placeholder="Respond to this question…"
                    />
                  ) : comment.response ? (
                    <p className="rounded-lg bg-[#eef4ed] p-3 text-sm leading-6 text-[#1a2e1f]">
                      {comment.response}
                    </p>
                  ) : (
                    <p className="text-xs italic text-[#8a9490]">No response yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-semibold">{title}</h3>
      <button
        className="rounded-md border border-[#c9c6be] px-2 py-1 text-sm hover:bg-white"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function HowToModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="w-full max-w-xl rounded-lg border border-[#d8d6cf] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
              How to use
            </p>
            <h2 className="mt-1 text-xl font-semibold">Build the plan section by section</h2>
          </div>
          <button
            className="rounded-md border border-[#c9c6be] px-3 py-1.5 text-sm font-semibold hover:bg-[#f2f1ec]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 text-sm leading-6 text-[#3f4842]">
          <p>
            <strong>Business Team:</strong> draft one section at a time, use the
            guidance panel for expectations, and open GPT Coach when you want
            help brainstorming questions.
          </p>
          <p>
            <strong>Full memo:</strong> switch from Section to Full memo when you
            want to read the complete plan in one pass.
          </p>
          <p>
            <strong>Enablement:</strong> review the memo and use Questions to add
            section-level comments for Legal, HR, Marketing, Finance, or other groups.
          </p>
          <p>
            <strong>Approver:</strong> review the same memo, ask questions, and set
            approval posture when a section is ready. Approvers use Questions,
            not GPT Coach.
          </p>
          <p>
            <strong>Export PDF:</strong> creates a clean memo-only print view without
            comments, controls, or internal workflow details.
          </p>
        </div>
      </div>
    </div>
  );
}

function PrintMemo({
  title,
  sections,
  readinessLabel,
}: {
  title: string;
  sections: MemoSection[];
  readinessLabel: string;
}) {
  return (
    <section className="print-memo hidden">
      <header>
        <p>Business Strategy Memo</p>
        <h1>{title}</h1>
        <span>{readinessLabel}</span>
      </header>
      {sections.map((section) => (
        <article key={section.id}>
          <h2>{section.title}</h2>
          <div>{section.content.trim() || "[Section draft pending]"}</div>
        </article>
      ))}
    </section>
  );
}
