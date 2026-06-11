"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "business" | "enablement" | "approver";
type SectionStatus = "Draft" | "Review" | "Approved";
type CommentStatus = "Open" | "Acknowledged" | "Resolved";
type Visibility = "Public" | "Draft" | "Private";
type ApprovalPosture = "Needs clarification" | "Ready" | "Approved";
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
};

type Approval = {
  id: string;
  sectionId: string | null;
  approver: string;
  posture: ApprovalPosture;
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

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const activeComments = useMemo(
    () => comments.filter((comment) => comment.sectionId === activeSection?.id),
    [comments, activeSection?.id],
  );
  const openQuestions = activeComments.filter((comment) => comment.status === "Open").length;
  const totalOpenQuestions = comments.filter((comment) => comment.status === "Open").length;
  const approvedSections = sections.filter((section) => section.status === "Approved").length;
  const totalWords = sections.reduce((sum, section) => sum + countWords(section.content), 0);
  const pageEstimate = Math.max(1, Math.ceil(totalWords / 550));
  const currentApproval = approvals.find(
    (approval) =>
      approval.sectionId === activeSection?.id &&
      approval.approver === roleAuthor("approver"),
  );
  const readinessLabel =
    sections.length > 0 &&
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
    }
  }, [role]);

  async function loadWorkspace(nextRole = role) {
    setLoading(true);
    const params = new URLSearchParams({
      role: nextRole,
      author: roleAuthor(nextRole),
    });
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
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-section",
        sectionId: section.id,
        content: section.content,
        status: section.status,
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
        author: roleAuthor(role),
        body: draftComment,
        visibility,
      }),
    });
    setDraftComment("");
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

  async function saveApproval(posture: ApprovalPosture) {
    if (!activeSection) return;
    setSaving(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-approval",
        sectionId: activeSection.id,
        approver: roleAuthor("approver"),
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

  const coachPrompt = activeSection
    ? `Act as a business plan thinking coach for the 2027 Prologis business plan. Do not write the section. Do not invent facts. Ask concise questions that help the team improve the "${activeSection.title}" section for an Executive Committee approval memo.\n\nCurrent draft:\n${activeSection.content}`
    : "";

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#161b18]">
      <div className="app-shell mx-auto max-w-7xl px-5 py-5 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-[#d8d6cf] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{planTitle}</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-grid grid-cols-3 rounded-lg border border-[#d0cec7] bg-white p-1 text-sm">
              {(["business", "enablement", "approver"] as Role[]).map((item) => (
                <button
                  className={`rounded-md px-3 py-2 font-medium ${
                    role === item ? "bg-[#1f5d3a] text-white" : "text-[#3f4842] hover:bg-[#eef1ec]"
                  }`}
                  key={item}
                  onClick={() => {
                    setRole(item);
                    setSidePanel("guidance");
                  }}
                >
                  {roleLabels[item]}
                </button>
              ))}
            </div>
            <button
              className="rounded-md border border-[#b9b6ae] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#efede7]"
              onClick={() => setHowToOpen(true)}
            >
              How to
            </button>
            <button
              className="rounded-md border border-[#b9b6ae] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#efede7]"
              onClick={exportPdf}
            >
              Export PDF
            </button>
          </div>
        </header>

        {!loading && !hasTeamName ? (
          <TeamNameEntry
            saving={saving}
            value={teamNameEntry}
            onChange={setTeamNameEntry}
            onSave={() => savePlanName(teamNameEntry)}
          />
        ) : null}

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
            <div className="grid grid-cols-3 gap-2 text-sm">
              <SummaryPill label="Approved" value={`${approvedSections}/${sections.length || 8}`} />
              <SummaryPill label="Questions" value={`${totalOpenQuestions} open`} />
              <SummaryPill label="Memo" value={`${pageEstimate}/4 pages`} />
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-[#d8d6cf] bg-white p-8 text-sm">
            Loading workspace...
          </div>
        ) : !hasTeamName ? null : !activeSection ? (
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
                />
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-[#d8d6cf] bg-white p-2">
              <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[#68716b]">
                Memo outline
              </div>
              <nav className="space-y-1">
                {sections.map((section) => {
                  const sectionComments = comments.filter((comment) => comment.sectionId === section.id);
                  const sectionOpen = sectionComments.filter((comment) => comment.status === "Open").length;
                  return (
                    <button
                      className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                        section.id === activeSection.id
                          ? "bg-[#e6eee5]"
                          : "hover:bg-[#f2f1ec]"
                      }`}
                      key={section.id}
                      onClick={() => {
                        setActiveSectionId(section.id);
                        setSidePanel("guidance");
                        setGuidanceOpen(true);
                      }}
                    >
                      <span className="block font-medium">{section.title}</span>
                      <span className="mt-1 block text-xs text-[#67706a]">
                        {section.status}
                        {sectionOpen > 0 ? ` · ${sectionOpen} open` : ""}
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

                  {role === "approver" ? (
                    <div className="mt-5 rounded-lg border border-[#d8d6cf] bg-[#fbfaf7] p-4">
                      <p className="text-sm font-semibold">Approval posture</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["Needs clarification", "Ready", "Approved"] as ApprovalPosture[]).map((posture) => (
                          <button
                            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                              currentApproval?.posture === posture
                                ? "border-[#1f5d3a] bg-[#1f5d3a] text-white"
                                : "border-[#c9c6be] bg-white hover:bg-[#f2f1ec]"
                            }`}
                            key={posture}
                            onClick={() => saveApproval(posture)}
                          >
                            {posture}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                    />
                  )}
                </aside>
              </div>
            </section>
          </div>
        )}
      </div>

      {coachOpen && activeSection ? (
        <CoachModal
          section={activeSection}
          prompt={coachPrompt}
          onClose={() => setCoachOpen(false)}
        />
      ) : null}

      {howToOpen ? <HowToModal onClose={() => setHowToOpen(false)} /> : null}

      <PrintMemo title={planTitle} sections={sections} readinessLabel={readinessLabel} />
    </main>
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
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-semibold">
          Status
          <select
            className="ml-0 mt-2 rounded-md border border-[#c9c6be] bg-white px-3 py-2 text-sm sm:ml-3 sm:mt-0"
            value={section.status}
            onChange={(event) => onChange({ status: event.target.value as SectionStatus })}
          >
            <option>Draft</option>
            <option>Review</option>
            <option>Approved</option>
          </select>
        </label>
        <button
          className="rounded-md bg-[#1f5d3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17462c]"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving..." : "Save"}
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
  prompt,
  onClose,
}: {
  section: MemoSection;
  prompt: string;
  onClose: () => void;
}) {
  const [coachQuestion, setCoachQuestion] = useState("");
  const starterQuestions = coachStarters[section.id] ?? strategyChecks.slice(0, 3);
  const finalPrompt = `${prompt}\n\nQuestions to pressure-test:\n${coachQuestion.trim() || "- Ask me the most important questions this section must answer."}`;
  const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(finalPrompt)}`;

  function addQuestion(question: string) {
    setCoachQuestion(question);
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#d8d6cf] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
              GPT Coach
            </p>
            <h2 className="mt-1 text-xl font-semibold">{section.title}</h2>
          </div>
          <button
            className="rounded-md border border-[#c9c6be] px-3 py-1.5 text-sm font-semibold hover:bg-[#f2f1ec]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#525c55]">
          Use GPT to pressure-test the section. Keep it focused on questions, gaps, and decisions.
        </p>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#68716b]">
            Start with one question
          </p>
          <div className="mt-2 grid gap-2">
            {starterQuestions.map((question) => (
              <button
                className="rounded-md border border-[#c9c6be] bg-[#fbfaf7] px-3 py-2 text-left text-sm leading-5 hover:bg-[#f2f1ec]"
                key={question}
                onClick={() => addQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block text-sm font-semibold">
          Ask your own
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#c9c6be] bg-[#fffefa] p-3 text-sm leading-6 outline-none focus:border-[#1f5d3a]"
            value={coachQuestion}
            onChange={(event) => setCoachQuestion(event.target.value)}
            placeholder="Example: What would make this section clearer for an Executive Committee approval decision?"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-[#b9b6ae] px-3 py-2 text-sm font-semibold hover:bg-[#f2f1ec]"
            onClick={() => navigator.clipboard.writeText(finalPrompt)}
          >
            Copy for ChatGPT
          </button>
          <a
            className="rounded-md bg-[#1f5d3a] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#17462c]"
            href={chatGptUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open ChatGPT
          </a>
        </div>
      </div>
    </div>
  );
}

function QuestionsDrawer({
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
}: {
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
}) {
  return (
    <div>
      <DrawerHeader title="Questions" onClose={onClose} />
      <label className="text-sm font-semibold">
        Add question or comment
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#c9c6be] bg-white p-3 text-sm outline-none focus:border-[#1f5d3a]"
          value={draftComment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Ask a focused section-level question."
        />
      </label>
      <div className="mt-3 flex gap-2">
        <select
          className="flex-1 rounded-md border border-[#c9c6be] bg-white px-3 py-2 text-sm"
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value as Visibility)}
        >
          <option>Public</option>
          <option>Draft</option>
          <option>Private</option>
        </select>
        <button
          className="rounded-md bg-[#1f5d3a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#17462c]"
          disabled={saving || !draftComment.trim()}
          onClick={onCreate}
        >
          Save
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-[#6b746e]">No visible questions for this section.</p>
        ) : (
          comments.map((comment) => (
            <div className="rounded-lg border border-[#d8d6cf] bg-white p-3" key={comment.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-[#68716b]">
                  {roleLabels[comment.role]} · {comment.visibility}
                </p>
                <select
                  className="rounded-md border border-[#c9c6be] bg-white px-2 py-1 text-xs"
                  value={comment.status}
                  onChange={(event) =>
                    onUpdate(comment, { status: event.target.value as CommentStatus })
                  }
                >
                  <option>Open</option>
                  <option>Acknowledged</option>
                  <option>Resolved</option>
                </select>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
              {role === "business" ? (
                <label className="mt-3 block text-xs font-semibold uppercase text-[#68716b]">
                  Business response
                  <textarea
                    className="mt-2 min-h-20 w-full resize-y rounded-md border border-[#c9c6be] bg-[#fffefa] p-2 text-sm normal-case outline-none focus:border-[#1f5d3a]"
                    defaultValue={comment.response}
                    onBlur={(event) => onUpdate(comment, { response: event.target.value })}
                  />
                </label>
              ) : comment.response ? (
                <p className="mt-3 rounded-md bg-[#eef1ec] p-3 text-sm leading-6">
                  {comment.response}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
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
