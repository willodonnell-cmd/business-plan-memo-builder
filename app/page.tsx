"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type {
  Approver,
  EnablementFunction,
  IssueType,
  MemoSection,
  Mode,
  Question,
  QuestionStatus,
  Role,
  SectionStatus,
  Visibility,
  WorkspacePlan,
} from "../lib/workspace-defaults";

type ApiPlanResponse = {
  plan?: WorkspacePlan;
  error?: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const roles: Role[] = ["Business Team", "Enablement", "Approver"];
const sectionReadinessStatuses: SectionStatus[] = ["Draft", "Review"];
const questionStatuses: QuestionStatus[] = ["Open", "Answered", "Resolved", "Reopened", "No Change Needed"];
const issueTypes: IssueType[] = [
  "Clarification",
  "Functional Dependency",
  "Support Need",
  "Risk / Constraint",
  "Required Input",
  "Approval Concern",
];
const enablementFunctions: EnablementFunction[] = ["Legal", "HR", "Marketing", "IT", "Customer Account Management", "Other"];
const approverPostures = ["Questions", "Approved"];
const BUSINESS_PLAN_OPTIONS = [
  "Essentials",
  "Prologis Energy Solutions",
  "Data Center",
  "Strategic Capital",
  "Ventures",
] as const;
const emptySections: MemoSection[] = [];
const emptyQuestions: Question[] = [];
const emptyApprovers: Approver[] = [];
const currentUserEmail = "wodonnell@prologis.com";

export default function Home() {
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [role, setRole] = useState<Role>("Business Team");
  const [mode, setMode] = useState<Mode>("Section");
  const [activeId, setActiveId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [showGuidance, setShowGuidance] = useState(true);
  const [showCoach, setShowCoach] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [issueType, setIssueType] = useState<IssueType>("Clarification");
  const [enablementFunction, setEnablementFunction] = useState<EnablementFunction>("Legal");
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Loading workspace...");

  const sections = plan?.sections ?? emptySections;
  const questions = plan?.questions ?? emptyQuestions;
  const approvers = plan?.approvers ?? emptyApprovers;
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0] ?? null;
  const planTitle = plan?.title ?? "2027 Essentials Business Plan";
  const openQuestions = questions.filter((question) => question.status !== "Resolved").length;
  const approvedCount = approvers.filter((approver) => approver.posture === "Approved").length;
  const sectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) + 1 : 1;
  const inReviewCount = sections.filter((section) => section.status !== "Draft").length;
  const openDependencies = questions.filter(
    (question) =>
      question.status !== "Resolved" &&
      ["Functional Dependency", "Support Need", "Required Input"].includes(question.issueType),
  ).length;
  const currentApprover = approvers[0] ?? null;
  const currentApproverMode = currentApprover?.posture === "Approved" ? "Approved" : "Questions";
  const selectedBusinessPlan = BUSINESS_PLAN_OPTIONS.includes(teamName as (typeof BUSINESS_PLAN_OPTIONS)[number])
    ? teamName
    : "Essentials";

  const visibleQuestions = useMemo(() => {
    if (!activeSection) return [];
    return questions.filter((question) => {
      if (question.sectionId !== activeSection.id) return false;
      if (role === "Business Team") return question.visibility !== "Draft" || question.role === role;
      if (question.visibility === "Public") return true;
      return question.role === role;
    });
  }, [activeSection, questions, role]);

  const allVisibleQuestions = useMemo(() => {
    return questions.filter((question) => {
      if (role === "Business Team") return question.visibility !== "Draft" || question.role === role;
      if (question.visibility === "Public") return true;
      return question.role === role;
    });
  }, [questions, role]);

  async function requestPlan(path: string, init?: RequestInit) {
    setSaveState("saving");
    setMessage(init?.method === "DELETE" ? "Deleting..." : "Saving...");
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json()) as ApiPlanResponse;
    if (!response.ok || !payload.plan) {
      setSaveState("error");
      setMessage(payload.error ?? "Request failed.");
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload.plan;
  }

  function applyPlan(nextPlan: WorkspacePlan, nextMessage: string) {
    setPlan(nextPlan);
    setTeamName(nextPlan.teamName);
    setActiveId((current) => current || nextPlan.sections[0]?.id || "");
    setResponseDrafts(Object.fromEntries(nextPlan.questions.map((question) => [question.id, question.response])));
    setSaveState("saved");
    setMessage(nextMessage);
  }

  async function savePlan(patch: Partial<Pick<WorkspacePlan, "teamName" | "approvalState" | "approvalPosture">>) {
    const nextPlan = await requestPlan("/api/plan", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    applyPlan(nextPlan, "Saved");
  }

  async function saveSection(section: MemoSection, patch: Partial<Pick<MemoSection, "content" | "status">>) {
    const nextPlan = await requestPlan(`/api/sections/${encodeURIComponent(section.id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    applyPlan(nextPlan, "Saved");
  }

  async function addQuestion() {
    if (!activeSection || !questionDraft.trim()) return;
    const nextPlan = await requestPlan("/api/questions", {
      method: "POST",
      body: JSON.stringify({
        sectionId: activeSection.id,
        author: role === "Business Team" ? "Business Team" : role,
        role,
        visibility,
        issueType: role === "Approver" ? "Approval Concern" : issueType,
        functionName: role === "Enablement" ? enablementFunction : "",
        body: questionDraft.trim(),
      }),
    });
    setQuestionDraft("");
    setQuestionsOpen(true);
    applyPlan(nextPlan, "Question added");
  }

  async function saveQuestion(question: Question, patch: Partial<Pick<Question, "status" | "response">>) {
    const nextPlan = await requestPlan(`/api/questions/${encodeURIComponent(question.id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    applyPlan(nextPlan, "Question saved");
  }

  async function removeQuestion(question: Question) {
    const nextPlan = await requestPlan(
      `/api/questions/${encodeURIComponent(question.id)}?role=${encodeURIComponent(role)}`,
      { method: "DELETE" },
    );
    applyPlan(nextPlan, "Question deleted");
  }

  async function changePlanSelection(nextTeamName: string) {
    setTeamName(nextTeamName);
    await savePlan({ teamName: nextTeamName });
  }

  async function changeApproverMode(value: string) {
    if (!currentApprover) return;
    const posture = value === "Approved" ? "Approved" : "Questions";
    const nextPlan = await requestPlan(`/api/approvers/${encodeURIComponent(currentApprover.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ posture }),
    });
    applyPlan(nextPlan, posture === "Approved" ? "Approval saved" : "Question mode saved");
  }

  function updateSectionContent(id: string, content: string) {
    setPlan((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) =>
              section.id === id ? { ...section, content } : section,
            ),
          }
        : current,
    );
  }

  function canDelete(question: Question) {
    return role === "Business Team" || question.role === role;
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    if (nextRole === "Business Team") {
      setMode("Section");
      setIssueType("Clarification");
      return;
    }
    setMode("Full Memo");
    setQuestionsOpen(nextRole === "Enablement" || nextRole === "Approver");
    setIssueType(nextRole === "Approver" ? "Approval Concern" : "Functional Dependency");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPlan() {
      setSaveState("saving");
      setMessage("Loading...");
      try {
        const nextPlan = await requestPlan("/api/plan");
        if (!cancelled) applyPlan(nextPlan, "Loaded");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load workspace.");
        }
      }
    }

    void loadInitialPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!plan || !activeSection) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 text-[#161712]">
        <div className="card max-w-md p-6">
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold">Loading business plan</h1>
          <p className="mt-3 text-sm leading-6 text-[#69665c]">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#161712]">
      <header className="mx-auto max-w-[1500px] px-4 pt-6 print:hidden sm:px-6">
        <div className="desktop-header flex flex-wrap items-start justify-between gap-5 border-b border-[#d9d5ca] pb-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="brand-mark" aria-hidden="true">▤</div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="site-title truncate font-bold tracking-0">{planTitle}</h1>
              </div>
              <div className="plan-meta-row">
                <label className="plan-selector">
                  <span>Business plan view</span>
                  <select value={selectedBusinessPlan} onChange={(event) => void changePlanSelection(event.target.value)}>
                    {BUSINESS_PLAN_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <p className="site-subtitle text-[#756f64]">Strategic business plan memo workspace</p>
              </div>
            </div>
          </div>

          <div className="header-actions flex flex-wrap items-center justify-end gap-3">
            <div className="role-switcher" aria-label="Role">
              {roles.map((item) => (
                <button
                  key={item}
                  className={`role-pill ${role === item ? "role-pill-active" : ""}`}
                  data-role={item}
                  onClick={() => switchRole(item)}
                >
                  <span className="role-dot" />
                  {item}
                </button>
              ))}
            </div>
            <button className="toolbar-button" onClick={() => setShowHowTo(true)}>ⓘ How to</button>
            <button className="toolbar-button" onClick={() => window.print()}>⇩ Export PDF</button>
          </div>
        </div>
      </header>

      <section className="workspace-shell mx-auto max-w-[1500px] px-4 py-6 print:hidden sm:px-6">
        <div className="workflow-strip mb-6">
          <div className="role-context">
            <p className="eyebrow">{roleFocus(role).label}</p>
            <p>{roleFocus(role).body}</p>
          </div>

          <div className="segmented">
            {(["Section", "Full Memo"] as Mode[]).map((item) => (
              <button
                key={item}
                className={`segmented-button ${mode === item ? "segmented-button-active" : ""}`}
                onClick={() => setMode(item)}
              >
                {item === "Full Memo" ? "Full memo" : "Section"}
              </button>
            ))}
          </div>

          <div className="workflow-metrics">
            <Metric label="Memo approval" value={`${approvedCount}/${approvers.length || 0} approved`} />
            <Metric label="Questions" value={`${openQuestions} open`} />
            {saveState !== "idle" ? <span className={`save-state save-state-${saveState}`}>{message}</span> : null}
          </div>
        </div>

        {mode === "Section" ? (
          <div className="section-layout">
            <MemoOutline
              sections={sections}
              questions={questions}
              activeId={activeSection.id}
              inReviewCount={inReviewCount}
              onSelect={(id) => setActiveId(id)}
            />
            <section className="section-shell">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Section {sectionIndex}</p>
                  <h2 className="mt-2 text-3xl font-bold">{activeSection.title}</h2>
                  <p className="mt-2 text-base text-[#69665c]">{sectionSubtitle(activeSection)}</p>
                </div>
              </div>

              <div className="section-editor-layout">
                <div className="editor-pane">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {sectionReadinessStatuses.map((status) => (
                        <button
                          key={status}
                          className={`small-status ${activeSection.status === status ? "small-status-active" : ""}`}
                          onClick={() => void saveSection(activeSection, { status })}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <div className="section-actions">
                      <button className="draft-content-button" type="button">
                        {sections.filter((section) => section.content.trim()).length}/{sections.length} drafted
                      </button>
                      {role === "Business Team" ? (
                        <>
                          <button className="toolbar-button" onClick={() => void saveSection(activeSection, { status: "Review" })}>
                            Mark Ready for Enablement
                          </button>
                          <button
                            className="toolbar-button"
                            onClick={() => void savePlan({ approvalState: "Review", approvalPosture: "Ready for Executive Approval" })}
                          >
                            Mark Memo Ready for Approval
                          </button>
                          <button className="primary-button" onClick={() => void saveSection(activeSection, { content: activeSection.content })}>
                            Save Draft
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {role === "Business Team" ? (
                    <textarea
                      className="memo-editor"
                      value={activeSection.content}
                      onChange={(event) => updateSectionContent(activeSection.id, event.target.value)}
                      placeholder="Draft the section here."
                    />
                  ) : (
                    <div className="memo-read">{activeSection.content || "No draft content yet."}</div>
                  )}
                </div>

                <aside className="right-rail">
                  <button className="guidance-toggle" onClick={() => setShowGuidance(!showGuidance)}>
                    <span>
                      <strong>Guidance</strong>
                      <small>Expectations for this section</small>
                    </span>
                    <b>{showGuidance ? "Hide" : "Show"}</b>
                  </button>
                  {showGuidance ? <Guidance section={activeSection} /> : null}
                  <button className="coach-button" onClick={() => setShowCoach(true)}>GPT Coach</button>
                  <button className="questions-button" onClick={() => setQuestionsOpen(!questionsOpen)}>
                    Questions ({visibleQuestions.length})
                  </button>
                  {questionsOpen ? (
                    <QuestionPanel
                      role={role}
                      questions={visibleQuestions}
                      visibility={visibility}
                      issueType={issueType}
                      enablementFunction={enablementFunction}
                      questionDraft={questionDraft}
                      responseDrafts={responseDrafts}
                      setVisibility={setVisibility}
                      setIssueType={setIssueType}
                      setEnablementFunction={setEnablementFunction}
                      setQuestionDraft={setQuestionDraft}
                      setResponseDrafts={setResponseDrafts}
                      addQuestion={addQuestion}
                      saveQuestion={saveQuestion}
                      removeQuestion={removeQuestion}
                      canDelete={canDelete}
                    />
                  ) : null}
                </aside>
              </div>
            </section>
          </div>
        ) : (
          <div className={`full-memo-layout full-memo-layout-${role.toLowerCase().replace(/\s+/g, "-")}`}>
            <FullMemo
              sections={sections}
              questions={questions}
              title={planTitle}
              role={role}
              openDependencies={openDependencies}
              onQuestions={(id) => {
                setActiveId(id);
                setQuestionsOpen(true);
              }}
            />
            <aside className="full-memo-sidebar">
              {role === "Approver" ? (
                <>
                  <ApproverModeControl
                    value={currentApproverMode}
                    approvedCount={approvedCount}
                    totalApprovers={approvers.length}
                    onChange={changeApproverMode}
                  />
                  {questionsOpen ? (
                    <QuestionDrawer
                      role={role}
                      questions={allVisibleQuestions}
                      visibility={visibility}
                      issueType={issueType}
                      enablementFunction={enablementFunction}
                      questionDraft={questionDraft}
                      responseDrafts={responseDrafts}
                      setVisibility={setVisibility}
                      setIssueType={setIssueType}
                      setEnablementFunction={setEnablementFunction}
                      setQuestionDraft={setQuestionDraft}
                      setResponseDrafts={setResponseDrafts}
                      addQuestion={addQuestion}
                      saveQuestion={saveQuestion}
                      removeQuestion={removeQuestion}
                      canDelete={canDelete}
                      onClose={() => setQuestionsOpen(false)}
                    />
                  ) : null}
                </>
              ) : role === "Enablement" ? (
                <>
                  {questionsOpen ? (
                    <QuestionDrawer
                      role={role}
                      questions={allVisibleQuestions}
                      visibility={visibility}
                      issueType={issueType}
                      enablementFunction={enablementFunction}
                      questionDraft={questionDraft}
                      responseDrafts={responseDrafts}
                      setVisibility={setVisibility}
                      setIssueType={setIssueType}
                      setEnablementFunction={setEnablementFunction}
                      setQuestionDraft={setQuestionDraft}
                      setResponseDrafts={setResponseDrafts}
                      addQuestion={addQuestion}
                      saveQuestion={saveQuestion}
                      removeQuestion={removeQuestion}
                      canDelete={canDelete}
                      onClose={() => setQuestionsOpen(false)}
                    />
                  ) : (
                    <button className="questions-button" onClick={() => setQuestionsOpen(true)}>
                      Questions
                    </button>
                  )}
                </>
              ) : (
                <>
                  <QuestionDrawer
                    role={role}
                    questions={allVisibleQuestions}
                    visibility={visibility}
                    issueType={issueType}
                    enablementFunction={enablementFunction}
                    questionDraft={questionDraft}
                    responseDrafts={responseDrafts}
                    setVisibility={setVisibility}
                    setIssueType={setIssueType}
                    setEnablementFunction={setEnablementFunction}
                    setQuestionDraft={setQuestionDraft}
                    setResponseDrafts={setResponseDrafts}
                    addQuestion={addQuestion}
                    saveQuestion={saveQuestion}
                    removeQuestion={removeQuestion}
                    canDelete={canDelete}
                    onClose={() => setQuestionsOpen(false)}
                  />
                </>
              )}
            </aside>
          </div>
        )}

      </section>

      <div className="hidden print:block">
        <MemoPrint sections={sections} title={planTitle} plan={plan} approvers={approvers} />
      </div>

      {showHowTo ? (
        <Modal title="How to" onClose={() => setShowHowTo(false)}>
          <ol className="space-y-3 text-sm leading-6 text-[#45413a]">
            <li>1. Business Team drafts each memo section and saves explicit changes.</li>
            <li>2. Enablement reads the full plan and flags clarification questions, functional dependencies, support needs, constraints, or required inputs.</li>
            <li>3. Business Team resolves issues and marks the full memo ready for executive approval.</li>
            <li>4. Approvers review the formatted memo, set individual posture, and export the memo-only PDF.</li>
          </ol>
        </Modal>
      ) : null}

      {showCoach ? (
        <Modal title="GPT Coach" onClose={() => setShowCoach(false)}>
          <CoachActions section={activeSection} />
        </Modal>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function roleFocus(role: Role) {
  if (role === "Business Team") {
    return {
      label: "Draft Plan",
      body: "Build the memo section by section, respond to open questions, then move the plan to enablement read and executive approval.",
    };
  }
  if (role === "Enablement") {
    return {
      label: "Enablement Read / Questions",
      body: "Read the full plan as a partner function. Ask clarifying questions and flag dependencies, support needs, constraints, or required inputs. This is not an approval state.",
    };
  }
  return {
    label: "Executive Approval",
    body: "Review the formatted memo, inspect unresolved concerns only as needed, and set individual approver posture separately from the plan lifecycle.",
  };
}

function MemoOutline({
  sections,
  questions,
  activeId,
  inReviewCount,
  onSelect,
}: {
  sections: MemoSection[];
  questions: Question[];
  activeId: string;
  inReviewCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="outline-card">
      <p className="eyebrow">Memo outline</p>
      <div className="outline-progress">
        <span style={{ width: `${sections.length ? (inReviewCount / sections.length) * 100 : 0}%` }} />
        <small>{inReviewCount}/{sections.length} in review</small>
      </div>
      <nav className="mt-5 space-y-1">
        {sections.map((section) => {
          const count = questions.filter((question) => question.sectionId === section.id && question.status !== "Resolved").length;
          return (
            <button
              key={section.id}
              className={`outline-item ${activeId === section.id ? "outline-item-active" : ""}`}
              onClick={() => onSelect(section.id)}
            >
              <span>{section.title}</span>
              <small>
                <b>{section.status}</b>
                {count ? <b>{count} open</b> : null}
              </small>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Guidance({ section }: { section: MemoSection }) {
  return (
    <div className="guidance-card">
      <p>{section.prompt}</p>
      <p className="eyebrow mt-5">Answer</p>
      <ul>
        {guidanceBullets(section).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="eyebrow mt-5">Format</p>
      <ul>
        <li>{section.format}</li>
        <li>{section.emphasize}</li>
      </ul>
    </div>
  );
}

function QuestionPanel(props: QuestionPanelProps) {
  return (
    <div className="question-panel">
      <QuestionComposer {...props} />
      <QuestionList {...props} />
    </div>
  );
}

function QuestionDrawer(props: QuestionPanelProps & { onClose: () => void }) {
  return (
    <aside className="question-drawer">
      <div className="question-drawer-head">
        <div>
          <p className="eyebrow">Review thread</p>
          <h2>Questions ({props.questions.filter((question) => question.status !== "Resolved").length} open)</h2>
        </div>
        <button className="toolbar-button" onClick={props.onClose}>Close</button>
      </div>
      <QuestionComposer {...props} />
      <QuestionList {...props} />
    </aside>
  );
}

function ApproverModeControl({
  value,
  approvedCount,
  totalApprovers,
  onChange,
}: {
  value: string;
  approvedCount: number;
  totalApprovers: number;
  onChange: (value: string) => Promise<void>;
}) {
  return (
    <section className="approver-mode-card">
      <label>
        <span>Approver mode</span>
        <select value={value} onChange={(event) => void onChange(event.target.value)}>
          {approverPostures.map((posture) => (
            <option key={posture}>{posture}</option>
          ))}
        </select>
      </label>
      <small>{approvedCount}/{totalApprovers || 0} approved</small>
    </section>
  );
}

type QuestionPanelProps = {
  role: Role;
  questions: Question[];
  visibility: Visibility;
  issueType: IssueType;
  enablementFunction: EnablementFunction;
  questionDraft: string;
  responseDrafts: Record<string, string>;
  setVisibility: (visibility: Visibility) => void;
  setIssueType: (issueType: IssueType) => void;
  setEnablementFunction: (value: EnablementFunction) => void;
  setQuestionDraft: (draft: string) => void;
  setResponseDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  addQuestion: () => Promise<void>;
  saveQuestion: (question: Question, patch: Partial<Pick<Question, "status" | "response">>) => Promise<void>;
  removeQuestion: (question: Question) => Promise<void>;
  canDelete: (question: Question) => boolean;
};

function QuestionComposer({
  role,
  visibility,
  issueType,
  enablementFunction,
  questionDraft,
  setVisibility,
  setIssueType,
  setEnablementFunction,
  setQuestionDraft,
  addQuestion,
}: QuestionPanelProps) {
  return (
    <div className="question-composer">
      <p className="eyebrow">Ask a question</p>
      <p className="mt-2 text-xs text-[#756f64]">Signed in as {currentUserEmail}</p>
      <textarea
        value={questionDraft}
        onChange={(event) => setQuestionDraft(event.target.value)}
        placeholder={role === "Enablement" ? "Flag a dependency, support need, required input, or clarification..." : "Ask a focused, section-level question..."}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select value={role === "Approver" ? "Approval Concern" : issueType} onChange={(event) => setIssueType(event.target.value as IssueType)}>
          {issueTypes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        {role === "Enablement" ? (
          <select value={enablementFunction} onChange={(event) => setEnablementFunction(event.target.value as EnablementFunction)}>
            {enablementFunctions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="question-submit-row">
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
          <option value="Public">Public — everyone sees this</option>
          <option value="Private">Team only — enablement + business</option>
          <option value="Draft">Draft — only you</option>
        </select>
        <button className="send-button" title={`Ask as ${role}`} onClick={() => void addQuestion()}>Submit</button>
      </div>
    </div>
  );
}

function QuestionList({
  role,
  questions,
  responseDrafts,
  setResponseDrafts,
  saveQuestion,
  removeQuestion,
  canDelete,
}: QuestionPanelProps) {
  return (
    <div className="question-list">
      {questions.length === 0 ? <p className="empty-note">No questions for this view.</p> : null}
      {questions.map((question) => (
        <article key={question.id} className="question-card">
          <div className="question-card-head">
            <span className="status-tag status-open">{question.status}</span>
            <span className="status-tag status-type">{question.issueType}</span>
            <span className="status-tag status-public">{question.visibility === "Private" ? "Team only" : question.visibility}</span>
            <span className="question-author">· {question.functionName ? `${question.functionName} · ` : ""}{question.role}</span>
            <select
              value={question.status}
              onChange={(event) => void saveQuestion(question, { status: event.target.value as QuestionStatus })}
            >
              {questionStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
          <p className="question-body">{question.body}</p>
          {role === "Business Team" ? (
            <div className="response-editor">
              <p className="eyebrow">Business response</p>
              <textarea
                value={responseDrafts[question.id] ?? ""}
                onChange={(event) =>
                  setResponseDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                }
                placeholder="Respond to the question..."
              />
              <button className="toolbar-button" onClick={() => void saveQuestion(question, { response: responseDrafts[question.id] ?? "" })}>
                Save response
              </button>
            </div>
          ) : question.response ? (
            <div className="response-read">
              <p className="eyebrow">Business response</p>
              <p>{question.response}</p>
            </div>
          ) : (
            <p className="response-empty">No response yet.</p>
          )}
          {canDelete(question) ? (
            <button className="delete-question" onClick={() => void removeQuestion(question)}>Delete</button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function FullMemo({
  sections,
  questions,
  title,
  role,
  openDependencies,
  onQuestions,
}: {
  sections: MemoSection[];
  questions: Question[];
  title: string;
  role: Role;
  openDependencies: number;
  onQuestions: (id: string) => void;
}) {
  const askSection = sections.find((section) => section.title === "Bottom-Line Ask");
  return (
    <article className="full-memo-card">
      <div className="full-memo-head">
        <p className="eyebrow">Full memo</p>
        <h2>{role === "Business Team" ? "Read the complete plan" : title}</h2>
        {role === "Enablement" ? (
          <div className="approver-summary enablement-summary">
            <div>
              <p className="eyebrow">Enablement review</p>
              <p>Read the full memo as a partner function and capture implications for your own functional plan.</p>
            </div>
            <div>
              <p className="eyebrow">Open enablement items</p>
              <p>{openDependencies} dependencies, support needs, or required inputs open</p>
              <p>This is an understanding and alignment review, not executive approval.</p>
            </div>
          </div>
        ) : null}
        {role === "Approver" && askSection?.content ? <p className="memo-ask-line">{askSection.content}</p> : null}
      </div>
      {sections.map((section, index) => {
        const count = questions.filter((question) => question.sectionId === section.id && question.status !== "Resolved").length;
        return (
          <section key={section.id} className="full-memo-section">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Section {index + 1}</p>
                <h3>{section.title}</h3>
              </div>
              <button className="toolbar-button" onClick={() => onQuestions(section.id)}>
                Questions{count ? ` (${count})` : ""}
              </button>
            </div>
            <div className="memo-box">{section.content || "Draft content pending."}</div>
          </section>
        );
      })}
      <span className="sr-only">{title}</span>
    </article>
  );
}

function MemoPrint({
  sections,
  title,
  plan,
  approvers,
}: {
  sections: MemoSection[];
  title: string;
  plan: WorkspacePlan;
  approvers: Approver[];
}) {
  return (
    <article className="memo-output">
      <h1>{title}</h1>
      <div className="memo-print-meta">
        <p>Team: {plan.teamName || "Not specified"}</p>
        <p>Date: {new Date().toLocaleDateString()}</p>
        <p>Status: {plan.approvalState}</p>
        <p>Approvers: {approvers.map((approver) => `${approver.name} (${approver.posture})`).join(", ") || "None listed"}</p>
      </div>
      {sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          <p>{section.content || "Draft content pending."}</p>
        </section>
      ))}
    </article>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 print:hidden">
      <div className="modal-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button className="icon-button" title="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CoachActions({ section }: { section: MemoSection }) {
  const actions = [
    "Tighten this section",
    "Make this more executive-ready",
    "Find vague or unsupported claims",
    "Identify missing decisions, owners, dependencies, or support needs",
    "Suggest likely Enablement questions",
    "Suggest likely Approver concerns",
    "Reduce length while preserving important information",
    ...sectionCoachActions(section.title),
  ];

  return (
    <div>
      <p className="text-sm leading-6 text-[#45413a]">
        Coach actions are scoped to the current memo section. They should identify gaps or suggest placeholders when facts are missing; they must not invent business, customer, market, financial, or internal Prologis facts.
      </p>
      <div className="coach-action-grid">
        {actions.map((action) => (
          <button key={action} className="toolbar-button">{action}</button>
        ))}
      </div>
      <textarea
        className="coach-box mt-4"
        placeholder={`Optional context for ${section.title}. Do not add facts unless they are supplied here.`}
      />
    </div>
  );
}

function sectionSubtitle(section: MemoSection) {
  if (section.title === "Executive Summary") return "One short paragraph and 3-5 takeaways.";
  return section.prompt;
}

function guidanceBullets(section: MemoSection) {
  if (section.title === "Executive Summary") {
    return [
      "What is this business trying to become in 2027?",
      "Why does it matter to Prologis?",
      "What is the core business thesis?",
      "What are the 3-5 most important takeaways from the plan?",
    ];
  }
  return [section.prompt, section.emphasize, section.avoid];
}

function sectionCoachActions(title: string) {
  if (title === "Executive Summary") {
    return [
      "Strengthen the strategic narrative",
      "Clarify the main business objective",
      "Identify missing executive-level context",
    ];
  }
  if (title === "2027 Priorities") {
    return [
      "Check whether priorities are specific and ranked",
      "Flag priorities that sound like tactics",
      "Identify missing tradeoffs",
    ];
  }
  if (title === "Growth Opportunities") {
    return ["Pressure-test specificity", "Identify missing proof points", "Clarify why this opportunity matters"];
  }
  if (title === "Support Needed from the Company") {
    return [
      "Separate requests by funding, headcount, systems, leadership, cross-functional, or customer support",
      "Clarify what is being asked from Prologis",
    ];
  }
  if (title === "AI and Productivity Strategy") {
    return [
      "Identify where AI claims need measurable impact",
      "Clarify productivity benefit",
      "Flag vague automation language",
    ];
  }
  if (title === "Headcount Needs") {
    return ["Clarify role, timing, justification, and business impact", "Flag unsupported headcount requests"];
  }
  if (title === "Key Risks and Dependencies") {
    return ["Separate risks from dependencies", "Identify mitigation gaps"];
  }
  if (title === "Bottom-Line Ask") {
    return ["Rewrite as a crisp executive decision request", "Check whether the memo supports the ask"];
  }
  return [];
}
