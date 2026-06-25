"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { businessPlanWorkstreams } from "../lib/workspace-defaults";
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
const enablementFunctions: EnablementFunction[] = ["HR", "Legal", "IT", "Finance & Accounting", "Tax", "Marketing", "CLS", "Other"];
const approverPostures = ["Questions", "Approved"];
const emptySections: MemoSection[] = [];
const emptyQuestions: Question[] = [];
const emptyApprovers: Approver[] = [];
const currentUserEmail = "wodonnell@prologis.com";
const defaultPlanId = businessPlanWorkstreams[0].id;

function isOpenQuestionStatus(status: QuestionStatus) {
  return status === "Open" || status === "Reopened";
}

function allowedQuestionStatusesForRole(role: Role) {
  if (role === "Business Team") {
    return ["Open", "Answered", "Resolved", "No Change Needed"] as QuestionStatus[];
  }
  return ["Open", "Reopened", "Resolved"] as QuestionStatus[];
}

function questionStatusOptions(role: Role, currentStatus: QuestionStatus) {
  const options = allowedQuestionStatusesForRole(role);
  return options.includes(currentStatus) ? options : [currentStatus, ...options];
}

export default function Home() {
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [activePlanId, setActivePlanId] = useState(defaultPlanId);
  const [role, setRole] = useState<Role>("Business Team");
  const [mode, setMode] = useState<Mode>("Section");
  const [activeId, setActiveId] = useState("");
  const [showGuidance, setShowGuidance] = useState(true);
  const [showCoach, setShowCoach] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [issueType, setIssueType] = useState<IssueType>("Clarification");
  const [enablementFunction, setEnablementFunction] = useState<EnablementFunction>("Legal");
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Loading workspace...");
  const [showSavedToast, setShowSavedToast] = useState(false);

  const sections = plan?.sections ?? emptySections;
  const questions = plan?.questions ?? emptyQuestions;
  const approvers = plan?.approvers ?? emptyApprovers;
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0] ?? null;
  const planTitle = plan?.title ?? "2027 Essentials Business Plan";
  const openQuestions = questions.filter((question) => isOpenQuestionStatus(question.status)).length;
  const approvedCount = approvers.filter((approver) => approver.posture === "Approved").length;
  const sectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) + 1 : 1;
  const inReviewCount = sections.filter((section) => section.status !== "Draft").length;
  const openDependencies = questions.filter(
    (question) =>
      isOpenQuestionStatus(question.status) &&
      ["Functional Dependency", "Support Need", "Required Input"].includes(question.issueType),
  ).length;
  const currentApprover = approvers[0] ?? null;
  const currentApproverMode = currentApprover?.posture === "Approved" ? "Approved" : "Questions";
  const selectedBusinessPlan = businessPlanWorkstreams.some((workstream) => workstream.id === activePlanId)
    ? activePlanId
    : defaultPlanId;

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
    setActivePlanId(nextPlan.id);
    setActiveId((current) =>
      nextPlan.sections.some((section) => section.id === current) ? current : nextPlan.sections[0]?.id || "",
    );
    setResponseDrafts(Object.fromEntries(nextPlan.questions.map((question) => [question.id, question.response])));
    setSaveState("saved");
    setMessage(nextMessage);
    if (nextMessage !== "Loaded") {
      setShowSavedToast(true);
    }
  }

  async function savePlan(patch: Partial<Pick<WorkspacePlan, "teamName" | "approvalState" | "approvalPosture">>) {
    const nextPlan = await requestPlan("/api/plan", {
      method: "PATCH",
      body: JSON.stringify({ ...patch, planId: activePlanId }),
    });
    applyPlan(nextPlan, "Saved");
  }

  async function saveSection(section: MemoSection, patch: Partial<Pick<MemoSection, "content" | "status">>) {
    const nextPlan = await requestPlan(`/api/sections/${encodeURIComponent(section.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, planId: activePlanId }),
    });
    applyPlan(nextPlan, "Saved");
  }

  async function addQuestion() {
    const body = questionDraft.trim();
    if (!activeSection || !body || isAddingQuestion) return;
    setIsAddingQuestion(true);
    try {
      const nextPlan = await requestPlan("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          planId: activePlanId,
          sectionId: activeSection.id,
          author: role === "Business Team" ? "Business Team" : role,
          role,
          visibility,
          issueType: role === "Approver" ? "Approval Concern" : role === "Enablement" ? "Support Need" : issueType,
          functionName: role === "Enablement" ? enablementFunction : "",
          body,
        }),
      });
      setQuestionDraft("");
      setQuestionsOpen(true);
      applyPlan(nextPlan, "Question added");
    } finally {
      setIsAddingQuestion(false);
    }
  }

  async function saveQuestion(question: Question, patch: Partial<Pick<Question, "status" | "response">>) {
    const nextPlan = await requestPlan(`/api/questions/${encodeURIComponent(question.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, role, planId: activePlanId }),
    });
    applyPlan(nextPlan, "Question saved");
  }

  async function removeQuestion(question: Question) {
    const nextPlan = await requestPlan(
      `/api/questions/${encodeURIComponent(question.id)}?role=${encodeURIComponent(role)}&planId=${encodeURIComponent(activePlanId)}`,
      { method: "DELETE" },
    );
    applyPlan(nextPlan, "Question deleted");
  }

  async function changePlanSelection(nextPlanId: string) {
    setActivePlanId(nextPlanId);
    setActiveId("");
    const nextPlan = await requestPlan(`/api/plan?planId=${encodeURIComponent(nextPlanId)}`);
    applyPlan(nextPlan, "Loaded");
  }

  async function changeApproverMode(value: string) {
    if (!currentApprover) return;
    const posture = value === "Approved" ? "Approved" : "Questions";
    const nextPlan = await requestPlan(`/api/approvers/${encodeURIComponent(currentApprover.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ planId: activePlanId, posture }),
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
    setIssueType(nextRole === "Approver" ? "Approval Concern" : nextRole === "Enablement" ? "Support Need" : "Clarification");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPlan() {
      setSaveState("saving");
      setMessage("Loading...");
      try {
        const nextPlan = await requestPlan(`/api/plan?planId=${encodeURIComponent(defaultPlanId)}`);
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

  useEffect(() => {
    if (!showSavedToast) return;
    const timeout = window.setTimeout(() => setShowSavedToast(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [showSavedToast]);

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
            <div className="brand-mark" role="img" aria-label="Prologis" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="site-title truncate font-bold tracking-0">{planTitle}</h1>
              </div>
              <div className="plan-meta-row">
                <label className="plan-selector">
                  <span>Business plan view</span>
                  <select value={selectedBusinessPlan} onChange={(event) => void changePlanSelection(event.target.value)}>
                    {businessPlanWorkstreams.map((workstream) => (
                      <option key={workstream.id} value={workstream.id}>{workstream.label}</option>
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
                      isAddingQuestion={isAddingQuestion}
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
              title={planTitle}
              role={role}
              openDependencies={openDependencies}
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
                      isAddingQuestion={isAddingQuestion}
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
                      isAddingQuestion={isAddingQuestion}
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
                    isAddingQuestion={isAddingQuestion}
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

      {showCoach ? (
        <Modal title="GPT Coach" onClose={() => setShowCoach(false)}>
          <CoachActions section={activeSection} />
        </Modal>
      ) : null}

      {showSavedToast ? (
        <div className="saved-toast" role="status" aria-live="polite">
          Saved
        </div>
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
          const count = questions.filter((question) => question.sectionId === section.id && isOpenQuestionStatus(question.status)).length;
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
          <h2>Questions ({props.questions.filter((question) => isOpenQuestionStatus(question.status)).length} open)</h2>
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
  isAddingQuestion: boolean;
  addQuestion: () => Promise<void>;
  saveQuestion: (question: Question, patch: Partial<Pick<Question, "status" | "response">>) => Promise<void>;
  removeQuestion: (question: Question) => Promise<void>;
  canDelete: (question: Question) => boolean;
};

function QuestionComposer({
  role,
  visibility,
  enablementFunction,
  questionDraft,
  isAddingQuestion,
  setVisibility,
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
      {role === "Enablement" ? (
        <div className="mt-3">
          <select value={enablementFunction} onChange={(event) => setEnablementFunction(event.target.value as EnablementFunction)}>
            {enablementFunctions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="question-submit-row">
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
          <option value="Public">Public — everyone sees this</option>
          <option value="Private">Team only — enablement + business</option>
          <option value="Draft">Draft — only you</option>
        </select>
        <button
          className="send-button"
          title={`Ask as ${role}`}
          disabled={isAddingQuestion || !questionDraft.trim()}
          onClick={() => void addQuestion()}
        >
          {isAddingQuestion ? "Submitting" : "Submit"}
        </button>
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
          {canDelete(question) ? (
            <button
              className="delete-question"
              aria-label="Delete question"
              title="Delete question"
              onClick={() => void removeQuestion(question)}
            >
              ×
            </button>
          ) : null}
          <div className="question-card-head">
            <span className="status-tag status-open">{question.status}</span>
            <span className="status-tag status-type">{question.issueType}</span>
            <span className="status-tag status-public">{question.visibility === "Private" ? "Team only" : question.visibility}</span>
            <span className="question-author">· {question.functionName ? `${question.functionName} · ` : ""}{question.role}</span>
            <select
              aria-label="Question status"
              value={question.status}
              onChange={(event) => void saveQuestion(question, { status: event.target.value as QuestionStatus })}
            >
              {questionStatusOptions(role, question.status).map((status) => (
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
              <button
                className="toolbar-button"
                onClick={() =>
                  void saveQuestion(question, {
                    response: responseDrafts[question.id] ?? "",
                    status: "Answered",
                  })
                }
              >
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
        </article>
      ))}
    </div>
  );
}

function FullMemo({
  sections,
  title,
  role,
  openDependencies,
}: {
  sections: MemoSection[];
  title: string;
  role: Role;
  openDependencies: number;
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
        return (
          <section key={section.id} className="full-memo-section">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Section {index + 1}</p>
                <h3>{section.title}</h3>
              </div>
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
      "Then provide 3-5 bullets that summarize the most important takeaways from the plan.",
    ];
  }
  if (section.title === "2027 Priorities") {
    return [
      "What is the priority?",
      "Why is it a priority in 2027?",
      "What decision or action does it require?",
      "What is the expected outcome if we execute well?",
      "Only include priorities that are critical to the success of the business. This section should force prioritization, not document every initiative underway.",
    ];
  }
  if (section.title === "Growth Opportunities") {
    return [
      "What is the opportunity?",
      "How large could the opportunity become?",
      "What customer need does it address?",
      "Why does Prologis have a right to win or a right to play?",
      "What would need to happen for the opportunity to scale?",
      "Focus on opportunities that could meaningfully impact the business over the next several years.",
    ];
  }
  if (section.title === "Support Needed from the Company") {
    return [
      "What approvals are needed?",
      "What organizational support is required?",
      "What cross-functional dependencies matter most?",
      "What decisions or actions would accelerate progress?",
      "What could slow execution if not addressed?",
      "Be specific and direct.",
    ];
  }
  if (section.title === "AI and Productivity Strategy") {
    return [
      "How will AI be incorporated into the team's operating model?",
      "What activities will be automated, accelerated, or augmented?",
      "What measurable efficiency gains are expected?",
      "How will AI improve decision-making, customer engagement, analysis, or execution?",
      "How does AI influence the team's future hiring strategy?",
    ];
  }
  if (section.title === "Headcount Needs") {
    return [
      "What role or capability is needed?",
      "What business problem does it solve?",
      "Why is it needed now?",
      "How does it support revenue growth, execution speed, or risk reduction?",
      "What is the expected return on the investment?",
      "Every request should have a clear business rationale.",
    ];
  }
  if (section.title === "Key Risks and Dependencies") {
    return [
      "What are the biggest risks?",
      "What assumptions must prove true?",
      "What dependencies exist inside or outside Prologis?",
      "What would cause us to slow down, change course, or stop?",
      "Only include risks that matter to the approval decision.",
    ];
  }
  if (section.title === "Bottom-Line Ask") {
    return [
      "What are we asking leadership to approve?",
      "What are the key drivers of success in 2027?",
      "What is the most important takeaway from the plan?",
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
