"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "business" | "enablement" | "approver";
type SectionStatus = "Draft" | "Review" | "Approved";
type CommentStatus = "Open" | "Acknowledged" | "Resolved";
type Visibility = "Public" | "Draft" | "Private";
type ApprovalPosture = "Needs clarification" | "Ready" | "Approved";
type DrawerMode = "coach" | "questions" | null;

type MemoSection = {
  id: string;
  title: string;
  position: number;
  requirement: string;
  content: string;
  status: SectionStatus;
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

const roleDescriptions: Record<Role, string> = {
  business: "Draft, pressure-test, and resolve section questions.",
  enablement: "Review implications and ask focused questions.",
  approver: "Assess readiness, ask questions, and record posture.",
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

const strategyChecks = [
  "What is the real strategic choice?",
  "What are we choosing not to do?",
  "Why does Prologis have a right to win?",
  "What must be true for this plan to work?",
  "What decision does leadership need to make?",
];

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
  const [sections, setSections] = useState<MemoSection[]>([]);
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("Public");

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

  useEffect(() => {
    void loadWorkspace(role);
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

    setSections(payload.sections);
    setComments(payload.comments);
    setApprovals(payload.approvals);
    setActiveSectionId((current) => current || payload.sections[0]?.id || "");
    setLoading(false);
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
    ? `Act as a business plan thinking coach for the 2027 Prologis business plan. Do not write the answer for the team and do not make assumptions. Ask concise questions that help the team improve the "${activeSection.title}" section. Focus on strategic choice, what must be true, required support, risks, and approval implications.\n\nCurrent draft:\n${activeSection.content}`
    : "";

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#161b18]">
      <div className="app-shell mx-auto max-w-7xl px-5 py-5 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-[#d8d6cf] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5b665f]">
              2027 Business Plan
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Strategy Workspace</h1>
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
                    setDrawer(null);
                  }}
                >
                  {roleLabels[item]}
                </button>
              ))}
            </div>
            <button
              className="rounded-md border border-[#b9b6ae] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#efede7]"
              onClick={exportPdf}
            >
              Export PDF
            </button>
          </div>
        </header>

        <section className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <p className="max-w-2xl text-sm leading-6 text-[#556058]">
            {roleDescriptions[role]}
          </p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <SummaryPill label="Approved" value={`${approvedSections}/${sections.length || 8}`} />
            <SummaryPill label="Questions" value={`${totalOpenQuestions} open`} />
            <SummaryPill label="Memo" value={`${pageEstimate}/4 pages`} />
          </div>
        </section>

        {loading || !activeSection ? (
          <div className="rounded-lg border border-[#d8d6cf] bg-white p-8 text-sm">
            Loading workspace...
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
                        setDrawer(null);
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
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-[#b9b6ae] px-3 py-2 text-sm font-semibold hover:bg-[#f2f1ec]"
                    onClick={() => setDrawer("coach")}
                  >
                    Coach
                  </button>
                  <button
                    className="rounded-md border border-[#b9b6ae] px-3 py-2 text-sm font-semibold hover:bg-[#f2f1ec]"
                    onClick={() => setDrawer("questions")}
                  >
                    Questions {openQuestions > 0 ? `(${openQuestions})` : ""}
                  </button>
                </div>
              </div>

              <div className="grid min-h-[560px] gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
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

                {drawer ? (
                  <aside className="drawer border-t border-[#e5e2da] bg-[#fbfaf7] p-5 xl:border-l xl:border-t-0">
                    {drawer === "coach" ? (
                      <CoachDrawer
                        section={activeSection}
                        prompt={coachPrompt}
                        onClose={() => setDrawer(null)}
                      />
                    ) : (
                      <QuestionsDrawer
                        role={role}
                        comments={activeComments}
                        draftComment={draftComment}
                        visibility={visibility}
                        saving={saving}
                        onClose={() => setDrawer(null)}
                        onCommentChange={setDraftComment}
                        onVisibilityChange={setVisibility}
                        onCreate={createQuestion}
                        onUpdate={updateQuestion}
                      />
                    )}
                  </aside>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>

      <PrintMemo sections={sections} readinessLabel={readinessLabel} />
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

function CoachDrawer({
  section,
  prompt,
  onClose,
}: {
  section: MemoSection;
  prompt: string;
  onClose: () => void;
}) {
  return (
    <div>
      <DrawerHeader title="Coach" onClose={onClose} />
      <p className="text-sm leading-6 text-[#525c55]">
        Use these questions to sharpen the section. Do not let ChatGPT invent facts.
      </p>
      <div className="mt-4 space-y-2">
        {[...(sectionCoach[section.id] ?? []), ...strategyChecks].map((question) => (
          <div className="rounded-md border border-[#d8d6cf] bg-white p-3 text-sm" key={question}>
            {question}
          </div>
        ))}
      </div>
      <button
        className="mt-4 w-full rounded-md bg-[#1f5d3a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#17462c]"
        onClick={() => navigator.clipboard.writeText(prompt)}
      >
        Copy ChatGPT prompt
      </button>
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

function PrintMemo({
  sections,
  readinessLabel,
}: {
  sections: MemoSection[];
  readinessLabel: string;
}) {
  return (
    <section className="print-memo hidden">
      <header>
        <p>2027 Business Plan</p>
        <h1>Business Strategy Memo</h1>
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
