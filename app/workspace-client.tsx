"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  businessPlanWorkstreams,
  emptyInvestmentRequestLine,
  investmentCaseQuestions,
  investmentWorkbookProfiles,
} from "../lib/workspace-defaults";
import { headcountFieldDefinitions, type HeadcountField, type HeadcountPromptAction } from "../lib/headcount-prompts";
import type {
  Approver,
  EnablementFunction,
  InvestmentRequest,
  InvestmentRequestExport,
  InvestmentRequestLine,
  InvestmentRequestType,
  InvestmentWorkbookProfile,
  HeadcountSummaryState,
  MemoSectionVersion,
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

type ApiInvestmentResponse = {
  request?: InvestmentRequest;
  requests?: InvestmentRequest[];
  export?: InvestmentRequestExport;
  deletedId?: string;
  error?: string;
};

type HeadcountReadinessResponse = {
  ready?: boolean;
  completion?: Array<{ requestId: string; title: string; complete: boolean; missing: string[] }>;
  error?: string;
};

type WorkspaceModule = "Memo" | "Investment Requests";
type BusinessWorkflow = "draft" | "headcount" | "questions" | "readiness";

const audienceRoutes: Array<{ role: Role; label: string; href: string }> = [
  { role: "Business Team", label: "Business Team", href: "/business-team" },
  { role: "Enablement", label: "Enablement", href: "/enablement" },
  { role: "General Reader", label: "General", href: "/general" },
  { role: "Approver", label: "Approver", href: "/approver" },
];
const businessWorkflows: Array<{ id: BusinessWorkflow; title: string; body: string }> = [
  { id: "draft", title: "Draft memo", body: "Write and manage the business-team source draft." },
  { id: "headcount", title: "Headcount requests", body: "Open the existing headcount request workflow." },
  { id: "questions", title: "Questions and responses", body: "Open the shared question thread for this plan." },
  { id: "readiness", title: "Review readiness", body: "Preview the full memo before sharing it for review." },
];
const enablementFunctions: EnablementFunction[] = ["HR", "Legal", "IT", "Finance & Accounting", "Tax", "Marketing", "CLS", "Other"];
const approverPostures = ["Questions", "Approved"];
const emptySections: MemoSection[] = [];
const emptyQuestions: Question[] = [];
const emptyApprovers: Approver[] = [];
const defaultPlanId = businessPlanWorkstreams[0].id;
const privateDraftStoragePrefix = "prologis-headcount-private-draft-v1";

type PrivateHeadcountDraft = { baseUpdatedAt: number; savedAt: number; request: InvestmentRequest };

function privateDraftKey(requestId: string) {
  return `${privateDraftStoragePrefix}:${requestId}`;
}

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

export function WorkspacePage({ audienceRole }: { audienceRole: Role }) {
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [activePlanId, setActivePlanId] = useState<string>(defaultPlanId);
  const [mode, setMode] = useState<Mode>("Section");
  const [workspaceModule, setWorkspaceModule] = useState<WorkspaceModule>("Memo");
  const [activeId, setActiveId] = useState("");
  const [investmentRequests, setInvestmentRequests] = useState<InvestmentRequest[]>([]);
  const [activeInvestmentId, setActiveInvestmentId] = useState("");
  const [investmentSearch, setInvestmentSearch] = useState("");
  const [investmentExport, setInvestmentExport] = useState<InvestmentRequestExport | null>(null);
  const [investmentError, setInvestmentError] = useState("");
  const [showGuidance, setShowGuidance] = useState(true);
  const [showCoach, setShowCoach] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [issueType, setIssueType] = useState<IssueType>("Clarification");
  const [enablementFunction, setEnablementFunction] = useState<EnablementFunction>("Legal");
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading workspace...");
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState("");

  const sections = plan?.sections ?? emptySections;
  const questions = plan?.questions ?? emptyQuestions;
  const approvers = plan?.approvers ?? emptyApprovers;
  const currentUser = plan?.user ?? null;
  const role = currentUser?.role === "Business Team" ? "Business Team" : audienceRole;
  const isBusinessAudience = role === "Business Team";
  // Temporary open-access posture: every authenticated workspace user can read
  // every memo section while IT implements the backend security model.
  const canViewDocument = true;
  const canEditMemo = isBusinessAudience && currentUser?.role === "Business Team";
  const canParticipate = canViewDocument && role !== "General Reader";
  const canSetApproval = canViewDocument && (role === "Business Team" || role === "Approver");
  const visibleSections = sections;
  const activeSection = visibleSections.find((section) => section.id === activeId) ?? visibleSections[0] ?? null;
  const planTitle = plan?.title ?? "2027 Essentials Business Plan";
  const openQuestions = questions.filter((question) => isOpenQuestionStatus(question.status)).length;
  const approvedCount = approvers.filter((approver) => approver.posture === "Approved").length;
  const sectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) + 1 : 1;
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
  const activeInvestmentRequest =
    investmentRequests.find((request) => request.id === activeInvestmentId) ?? investmentRequests[0] ?? null;
  const workbookProfile = investmentWorkbookProfiles[selectedBusinessPlan] ?? null;

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
    const visibleSectionIds = new Set(visibleSections.map((section) => section.id));
    return questions.filter((question) => {
      if (!visibleSectionIds.has(question.sectionId)) return false;
      if (role === "Business Team") return question.visibility !== "Draft" || question.role === role;
      if (question.visibility === "Public") return true;
      return question.role === role;
    });
  }, [questions, role, visibleSections]);

  async function requestPlan(path: string, init?: RequestInit) {
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
      setMessage(payload.error ?? "Request failed.");
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload.plan;
  }

  const requestInvestments = useCallback(async (path: string, init?: RequestInit) => {
    setMessage(init ? "Saving Headcount request..." : "Loading Headcount requests...");
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json()) as ApiInvestmentResponse;
    if (!response.ok) {
      setInvestmentError(payload.error ?? "Investment request failed.");
      setMessage(payload.error ?? "Investment request failed.");
      throw new Error(payload.error ?? "Investment request failed.");
    }
    if (payload.requests) {
      setInvestmentRequests(payload.requests);
      setActiveInvestmentId((current) =>
        payload.requests?.some((request) => request.id === current) ? current : payload.requests?.[0]?.id ?? "",
      );
    }
    if (payload.request) {
      setInvestmentRequests((current) => [payload.request as InvestmentRequest, ...current.filter((request) => request.id !== payload.request?.id)]);
      setActiveInvestmentId(payload.request.id);
    }
    if (payload.deletedId) {
      setInvestmentRequests((current) => current.filter((request) => request.id !== payload.deletedId));
      setActiveInvestmentId((current) => (current === payload.deletedId ? "" : current));
    }
    if (payload.export) {
      setInvestmentExport(payload.export);
    }
    setInvestmentError("");
    setMessage("Saved");
    return payload;
  }, []);

  function applyPlan(nextPlan: WorkspacePlan, nextMessage: string) {
    setPlan(nextPlan);
    setActivePlanId(nextPlan.id);
    setActiveId((current) =>
      nextPlan.sections.some((section) => section.id === current) ? current : nextPlan.sections[0]?.id || "",
    );
    setResponseDrafts(Object.fromEntries(nextPlan.questions.map((question) => [question.id, question.response])));
    setMessage(nextMessage);
    if (nextMessage !== "Loaded") {
      setShowSavedToast(true);
    }
  }

  async function addQuestion() {
    const body = questionDraft.trim();
    if (!activeSection || !body || isAddingQuestion || !canParticipate) return;
    setIsAddingQuestion(true);
    try {
      const nextPlan = await requestPlan("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          planId: activePlanId,
          sectionId: activeSection.id,
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
      body: JSON.stringify({ ...patch, planId: activePlanId }),
    });
    applyPlan(nextPlan, "Question saved");
  }

  async function removeQuestion(question: Question) {
    const nextPlan = await requestPlan(
      `/api/questions/${encodeURIComponent(question.id)}?planId=${encodeURIComponent(activePlanId)}`,
      { method: "DELETE" },
    );
    applyPlan(nextPlan, "Question deleted");
  }

  async function changePlanSelection(nextPlanId: string) {
    setActivePlanId(nextPlanId);
    setActiveId("");
    setActiveInvestmentId("");
    setInvestmentExport(null);
    const nextPlan = await requestPlan(`/api/plan?planId=${encodeURIComponent(nextPlanId)}`);
    applyPlan(nextPlan, "Loaded");
    const query = new URLSearchParams({ planId: nextPlanId });
    if (investmentSearch.trim()) query.set("q", investmentSearch.trim());
    await requestInvestments(`/api/investment-requests?${query.toString()}`);
  }

  async function updateDocumentStatus(nextStatus: SectionStatus) {
    if (!plan || !canEditMemo) return;
    const posture =
      nextStatus === "Review"
        ? "Shared for review"
        : nextStatus === "Approval"
          ? "Ready for approval"
          : "Drafting";
    await Promise.all(
      plan.sections.map((section) =>
        requestPlan(`/api/sections/${encodeURIComponent(section.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            planId: activePlanId,
            content: section.content,
            status: nextStatus,
          }),
        }),
      ),
    );
    const nextPlan = await requestPlan("/api/plan", {
      method: "PATCH",
      body: JSON.stringify({
        planId: activePlanId,
        approvalState: nextStatus,
        approvalPosture: posture,
      }),
    });
    applyPlan(nextPlan, "Status updated");
  }

  async function saveSection(section: MemoSection) {
    if (!canEditMemo) return;
    const nextPlan = await requestPlan(`/api/sections/${encodeURIComponent(section.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        planId: activePlanId,
        content: section.content,
        status: section.status,
      }),
    });
    applyPlan(nextPlan, "Section saved");
  }

  async function restoreVersion(section: MemoSection, version: MemoSectionVersion) {
    if (!canEditMemo || restoringVersionId) return;
    setRestoringVersionId(version.id);
    try {
      const nextPlan = await requestPlan(
        `/api/sections/${encodeURIComponent(section.id)}/versions/${encodeURIComponent(version.id)}/restore`,
        {
          method: "POST",
          body: JSON.stringify({
            planId: activePlanId,
            note: `Restored from version ${version.id}`,
          }),
        },
      );
      applyPlan(nextPlan, "Version restored");
    } finally {
      setRestoringVersionId("");
    }
  }

  async function createInvestmentRequest(requestType: InvestmentRequestType) {
    try {
      const payload = await requestInvestments("/api/investment-requests", {
        method: "POST",
        body: JSON.stringify({ planId: activePlanId, requestType }),
      });
      setInvestmentExport(null);
      if (payload.request) setActiveInvestmentId(payload.request.id);
    } catch {
      return;
    }
  }

  async function saveInvestmentRequest(request: InvestmentRequest, submit = false) {
    try {
      const payload = await requestInvestments(`/api/investment-requests/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...request, planId: activePlanId, submit, expectedUpdatedAt: request.updatedAt }),
      });
      setInvestmentExport(null);
      if (payload.request) setActiveInvestmentId(payload.request.id);
      setShowSavedToast(true);
      return true;
    } catch {
      return false;
    }
  }

  async function loadInvestmentExport(request: InvestmentRequest) {
    try {
      const query = new URLSearchParams({ planId: activePlanId });
      await requestInvestments(`/api/investment-requests/${encodeURIComponent(request.id)}/export?${query.toString()}`);
      return true;
    } catch {
      return false;
    }
  }

  async function downloadInvestmentWorkbook(request: InvestmentRequest) {
    setMessage("Preparing Excel export…");
    setInvestmentError("");
    try {
      const query = new URLSearchParams({ planId: activePlanId, format: "xlsx" });
      const response = await fetch(`/api/investment-requests/${encodeURIComponent(request.id)}/export?${query.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Workbook export failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "investment-request-export.xlsx";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("Workbook generated");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel export could not be completed. No data was changed.";
      setMessage(message);
      setInvestmentError(message);
      return false;
    }
  }

  async function deleteInvestmentRequest(request: InvestmentRequest) {
    try {
      const query = new URLSearchParams({ planId: activePlanId });
      await requestInvestments(`/api/investment-requests/${encodeURIComponent(request.id)}?${query.toString()}`, {
        method: "DELETE",
      });
      setInvestmentExport(null);
      setActiveInvestmentId((current) => current || (investmentRequests.find((item) => item.id !== request.id)?.id ?? ""));
      setShowSavedToast(true);
    } catch {
      return;
    }
  }

  async function changeApproverMode(value: string) {
    if (!currentApprover) return;
    if (!canSetApproval) return;
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
    if (!currentUser || currentUser.role === "General Reader") return false;
    return currentUser.role === "Business Team" || question.role === currentUser.role;
  }

  function switchRole(nextRole: Role) {
    if (nextRole === "Business Team") {
      setMode("Section");
      setIssueType("Clarification");
      return;
    }
    setMode("Full Memo");
    setQuestionsOpen(nextRole === "Enablement" || nextRole === "Approver");
    setIssueType(nextRole === "Approver" ? "Approval Concern" : nextRole === "Enablement" ? "Support Need" : "Clarification");
  }

  function selectBusinessWorkflow(workflow: BusinessWorkflow) {
    if (workflow === "draft") {
      setWorkspaceModule("Memo");
      setMode("Section");
      setQuestionsOpen(false);
      return;
    }
    if (workflow === "headcount") {
      setWorkspaceModule("Investment Requests");
      return;
    }
    if (workflow === "questions") {
      setWorkspaceModule("Memo");
      setMode("Section");
      setQuestionsOpen(true);
      return;
    }
    if (workflow === "readiness") {
      setWorkspaceModule("Memo");
      setMode("Full Memo");
      setQuestionsOpen(false);
      return;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPlan() {
      setMessage("Loading...");
      try {
        const nextPlan = await requestPlan(`/api/plan?planId=${encodeURIComponent(defaultPlanId)}`);
        if (!cancelled) {
          applyPlan(nextPlan, "Loaded");
          void requestInvestments(`/api/investment-requests?planId=${encodeURIComponent(defaultPlanId)}`);
        }
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
  }, [requestInvestments]);

  useEffect(() => {
    if (!plan) return;
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams({ planId: activePlanId });
      if (investmentSearch.trim()) query.set("q", investmentSearch.trim());
      void requestInvestments(`/api/investment-requests?${query.toString()}`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activePlanId, investmentSearch, plan, requestInvestments]);

  useEffect(() => {
    if (!plan) return;
    const interval = window.setInterval(() => {
      void requestPlan(`/api/plan?planId=${encodeURIComponent(activePlanId)}`)
        .then((nextPlan) => applyPlan(nextPlan, "Loaded"))
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [activePlanId, plan]);

  useEffect(() => {
    if (!showSavedToast) return;
    const timeout = window.setTimeout(() => setShowSavedToast(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [showSavedToast]);

  if (!plan) {
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
                <button className="help-icon-button" type="button" aria-label="Help" title="Help" onClick={() => setShowHelp(true)}>
                  ?
                </button>
              </div>
            </div>
          </div>

          <div className="header-actions flex flex-wrap items-center justify-end gap-3">
            <nav className="role-switcher" aria-label="Audience routes">
              {audienceRoutes.map((item) => (
                <a
                  key={item.role}
                  className={`role-pill ${role === item.role ? "role-pill-active" : ""}`}
                  data-role={item.role}
                  href={item.href}
                  onClick={() => switchRole(item.role)}
                >
                  <span className="role-dot" />
                  {item.label}
                </a>
              ))}
            </nav>
            <button className="toolbar-button" onClick={() => window.print()}>⇩ Export PDF</button>
          </div>
        </div>
      </header>

      <section className="workspace-shell mx-auto max-w-[1500px] px-4 py-6 print:hidden sm:px-6">
        {isBusinessAudience ? (
          <div className="business-workflow-grid" aria-label="Business Team workflow choices">
            {businessWorkflows.map((workflow) => (
              <button
                key={workflow.id}
                className="business-workflow-card"
                type="button"
                onClick={() => selectBusinessWorkflow(workflow.id)}
              >
                <span>{workflow.title}</span>
                <p>{workflow.body}</p>
              </button>
            ))}
            <label className="business-status-card">
              <span>Status</span>
              <select
                value={plan.approvalState}
                disabled={!canEditMemo}
                onChange={(event) => void updateDocumentStatus(event.target.value as SectionStatus)}
              >
                <option value="Draft">Save draft</option>
                <option value="Review">Save for review</option>
                <option value="Approval">Save for approval</option>
              </select>
            </label>
          </div>
        ) : null}

        {!canViewDocument ? (
          <AudienceReviewGate role={role} title={planTitle} />
        ) : (
          <>
        <div className="workflow-strip mb-6">
          <div className="workflow-controls">
            <div className="workflow-metrics">
              {workspaceModule === "Investment Requests" ? (
                <>
                  <Metric label="Requests" value={`${investmentRequests.length} total`} />
                  <Metric label="Submitted" value={`${investmentRequests.filter((request) => request.status === "Submitted").length} submitted`} />
                </>
              ) : (
                <div className="memo-status-button memo-questions-button" aria-label={`Questions: ${openQuestions} open`}>
                  <span>Questions:</span>
                  <strong>{openQuestions} open</strong>
                </div>
              )}
            </div>

            {workspaceModule === "Memo" ? (
              <div className="memo-mode-tools">
                <div className="segmented" aria-label="Memo mode">
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
              </div>
            ) : null}
          </div>
        </div>

        {workspaceModule === "Investment Requests" ? (
          <InvestmentRequestsWorkspace
            key={activeInvestmentRequest?.id ?? "investment-requests-empty"}
            profile={workbookProfile}
            requests={investmentRequests}
            activeRequest={activeInvestmentRequest}
            exportPreview={investmentExport}
            search={investmentSearch}
            error={investmentError}
            canEdit={canEditMemo}
            onSearch={setInvestmentSearch}
            onSelect={(id) => {
              setActiveInvestmentId(id);
              setInvestmentExport(null);
            }}
            onCreate={createInvestmentRequest}
            onSave={(request) => saveInvestmentRequest(request)}
            onSubmit={(request) => saveInvestmentRequest(request, true)}
            onExport={loadInvestmentExport}
            onDownload={downloadInvestmentWorkbook}
            onDelete={deleteInvestmentRequest}
          />
        ) : mode === "Section" ? (
          <div className="section-layout">
            <MemoOutline
              sections={visibleSections}
              questions={questions}
              activeId={activeSection?.id ?? ""}
              onSelect={(id) => setActiveId(id)}
            />
            {activeSection ? (
              <section className="section-shell">
                <button
                  className="coach-avatar-button"
                  type="button"
                  aria-label="Open Coach P"
                  title="Open Coach P"
                  onClick={() => setShowCoach(true)}
                />
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
                      <div className="section-status-stack">
                        <span className="drafted-count">
                          {sections.filter((section) => section.content.trim()).length}/{sections.length} drafted
                        </span>
                      </div>
                      {canEditMemo ? (
                        <button className="section-save-button" type="button" onClick={() => void saveSection(activeSection)}>
                          Save section
                        </button>
                      ) : null}
                    </div>
                    {activeSection.title === "Headcount Needs" ? (
                      <HeadcountNeedsControls
                        planId={activePlanId}
                        section={activeSection}
                        state={plan.headcountSummary}
                        canEdit={canEditMemo}
                        requestRevision={investmentRequests.map((request) => `${request.id}:${request.updatedAt}:${request.quantity}`).join("|")}
                        onPlan={(nextPlan) => applyPlan(nextPlan, "Headcount Needs summary replaced")}
                        onOpenRequest={(id) => {
                          setWorkspaceModule("Investment Requests");
                          setActiveInvestmentId(id);
                        }}
                      />
                    ) : null}
                    {canEditMemo ? (
                      <textarea
                        className="memo-editor"
                        value={activeSection.content}
                        onChange={(event) => updateSectionContent(activeSection.id, event.target.value)}
                        placeholder="Draft the section here."
                      />
                    ) : (
                      <div className="memo-read">{activeSection.content || "No draft content yet."}</div>
                    )}
                    {canEditMemo ? (
                      <VersionHistoryPanel
                        key={activeSection.id}
                        section={activeSection}
                        restoringVersionId={restoringVersionId}
                        onRestore={(version) => void restoreVersion(activeSection, version)}
                      />
                    ) : null}
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
                    <button className="questions-button" onClick={() => setQuestionsOpen(!questionsOpen)}>
                      Questions ({visibleQuestions.length})
                    </button>
                    {questionsOpen ? (
                      <QuestionPanel
                        role={role}
                        currentUserEmail={currentUser?.email ?? ""}
                        canParticipate={canParticipate}
                        canEditMemo={canEditMemo}
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
            ) : (
              <section className="section-shell empty-workflow-state">
                <p className="eyebrow">{role} view</p>
                <h2>No sections are available yet.</h2>
                <p>
                  Draft sections are visible only to the Business Team. Sections appear here after the Business Team saves them for {role === "Enablement" ? "review" : "approval"}.
                </p>
              </section>
            )}
          </div>
        ) : (
          <div className={`full-memo-layout full-memo-layout-${role.toLowerCase().replace(/\s+/g, "-")}`}>
            <FullMemo
              sections={visibleSections}
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
                      currentUserEmail={currentUser?.email ?? ""}
                      canParticipate={canParticipate}
                      canEditMemo={canEditMemo}
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
                      currentUserEmail={currentUser?.email ?? ""}
                      canParticipate={canParticipate}
                      canEditMemo={canEditMemo}
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
                    currentUserEmail={currentUser?.email ?? ""}
                    canParticipate={canParticipate}
                    canEditMemo={canEditMemo}
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
          </>
        )}

      </section>

      {canViewDocument ? (
        <div className="hidden print:block">
          <MemoPrint sections={sections} title={planTitle} plan={plan} approvers={approvers} />
        </div>
      ) : null}

      {showCoach && activeSection ? (
        <CoachPanel title="Coach P" onClose={() => setShowCoach(false)}>
          <CoachActions section={activeSection} sections={sections} />
        </CoachPanel>
      ) : null}

      {showHelp ? (
        <Modal title="How to complete the plan" onClose={() => setShowHelp(false)}>
          <HowToPanel />
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

function AudienceReviewGate({ role, title }: { role: Role; title: string }) {
  return (
    <section className="audience-review-gate">
      <p className="eyebrow">{role === "General Reader" ? "General access" : role}</p>
      <h2>{title} has not been shared for review yet.</h2>
      <p>
        The Business Team is still working in draft. This page will show the shared document after the Business Team explicitly shares it for review.
      </p>
    </section>
  );
}

function MemoOutline({
  sections,
  questions,
  activeId,
  onSelect,
}: {
  sections: MemoSection[];
  questions: Question[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="outline-card">
      <p className="eyebrow">Memo outline</p>
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
              {count ? <small><b>{count} open</b></small> : null}
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

function HeadcountNeedsControls({
  planId,
  section,
  state,
  canEdit,
  requestRevision,
  onPlan,
  onOpenRequest,
}: {
  planId: string;
  section: MemoSection;
  state: HeadcountSummaryState | undefined;
  canEdit: boolean;
  requestRevision: string;
  onPlan: (plan: WorkspacePlan) => void;
  onOpenRequest: (id: string) => void;
}) {
  const [readiness, setReadiness] = useState<HeadcountReadinessResponse>({});
  const [preview, setPreview] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadReadiness() {
      const response = await fetch(`/api/headcount-summary?planId=${encodeURIComponent(planId)}`);
      const payload = await response.json() as HeadcountReadinessResponse;
      if (!cancelled) {
        setReadiness(payload);
        setError(response.ok ? "" : payload.error ?? "Could not load Headcount summary readiness.");
      }
    }
    void loadReadiness().catch(() => !cancelled && setError("Could not load Headcount summary readiness."));
    return () => { cancelled = true; };
  }, [planId, requestRevision]);

  const incomplete = (readiness.completion ?? []).filter((item) => !item.complete);
  const hasRequests = (readiness.completion?.length ?? 0) > 0;
  const canGenerate = canEdit && Boolean(readiness.ready) && !isWorking;
  const actionLabel = state?.snapshot && state.isOutdated ? "Regenerate Summary" : "Generate Headcount Summary";

  async function generate() {
    if (!canGenerate) return;
    setIsWorking(true);
    setError("");
    try {
      const response = await fetch("/api/headcount-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, action: "preview" }),
      });
      const payload = await response.json() as { preview?: { summary?: string }; error?: string };
      if (!response.ok || !payload.preview?.summary) throw new Error(payload.error ?? "Headcount summary generation failed.");
      setPreview(payload.preview.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Headcount summary generation failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function replace() {
    setIsWorking(true);
    setError("");
    try {
      const response = await fetch("/api/headcount-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, action: "replace", summary: preview }),
      });
      const payload = await response.json() as ApiPlanResponse;
      if (!response.ok || !payload.plan) throw new Error(payload.error ?? "Headcount Needs draft could not be replaced.");
      onPlan(payload.plan);
      setPreview("");
      setConfirmReplace(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Headcount Needs draft could not be replaced.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-[#d9d5ca] bg-[#fbfaf6] p-4" aria-label="Headcount summary generation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Headcount summary</p>
          <p className="mt-1 text-sm text-[#5c584f]">
            {state?.snapshot ? (state.isOutdated ? `Headcount summary may be outdated: ${state.changedRequests.length} request${state.changedRequests.length === 1 ? "" : "s"} changed.` : "Current with active completed headcount requests.") : "Generate an executive-ready draft from active completed headcount requests."}
          </p>
        </div>
        {canEdit ? <button className="primary-button" disabled={!canGenerate} onClick={() => void generate()}>{isWorking ? "Generating…" : actionLabel}</button> : null}
      </div>
      {!canEdit ? <p className="mt-3 text-sm text-[#756f64]">Only Business Team editors can generate or replace this draft.</p> : null}
      {canEdit && !hasRequests ? <p className="mt-3 text-sm text-[#756f64]">Create an active headcount request to generate a summary.</p> : null}
      {canEdit && incomplete.length ? (
        <div className="mt-3 rounded-lg bg-[#fff3e7] p-3 text-sm text-[#5f3c1c]">
          <strong>Complete every active request before generating.</strong>
          <ul className="mt-2 list-disc pl-5">
            {incomplete.map((item) => <li key={item.requestId}>{item.title}: {item.missing.join(", ")}</li>)}
          </ul>
        </div>
      ) : null}
      {state?.snapshot ? (
        <div className="mt-3">
          <button className="toolbar-button" type="button" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}>Summary details</button>
          {showDetails ? (
            <div className="mt-3 rounded-lg border border-[#e4e0d6] p-3 text-sm">
              <p><strong>{state.isOutdated ? "Outdated" : "Current"}</strong> · Generated {formatTimestamp(state.snapshot.generatedAt)} by {state.snapshot.generatedByName}</p>
              <p className="mt-1">{state.snapshot.requestCount} request records · {state.snapshot.totalPositions} requested positions</p>
              <ul className="mt-2 list-disc pl-5">{state.snapshot.requests.map((request) => <li key={request.id}><button className="text-left underline" type="button" onClick={() => onOpenRequest(request.id)}>{request.title} · {request.quantity}</button></li>)}</ul>
              {state.changedRequests.length ? <ul className="mt-2 list-disc pl-5 text-[#8a3e22]">{state.changedRequests.map((change) => <li key={`${change.title}-${change.detail}`}>{change.title}: {change.detail}</li>)}</ul> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#9e2a2b]" role="alert">{error}</p> : null}
      {preview ? (
        <div className="mt-4 rounded-lg border border-[#d9d5ca] bg-white p-4">
          <p className="eyebrow">Preview</p>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{preview}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="primary-button" disabled={isWorking} onClick={() => setConfirmReplace(true)}>Replace Headcount Needs draft</button>
            <button className="toolbar-button" type="button" onClick={() => void navigator.clipboard.writeText(preview)}>Copy</button>
            <button className="toolbar-button" disabled={!canGenerate} onClick={() => void generate()}>Regenerate</button>
            <button className="toolbar-button" type="button" onClick={() => setPreview("")}>Cancel</button>
          </div>
        </div>
      ) : null}
      {confirmReplace ? (
        <div className="mt-4 rounded-lg border border-[#b56e48] bg-[#fff7f1] p-4">
          <strong>Replace the current Headcount Needs draft?</strong>
          <p className="mt-1 text-sm">{section.versions?.[0] ? `The current formal version was saved ${formatTimestamp(section.versions[0].createdAt)} and will remain available in version history.` : "The current draft will be preserved in version history when it contains saved content."}</p>
          <div className="mt-3 flex gap-2"><button className="primary-button" disabled={isWorking} onClick={() => void replace()}>Confirm replacement</button><button className="toolbar-button" onClick={() => setConfirmReplace(false)}>Cancel</button></div>
        </div>
      ) : null}
    </section>
  );
}

function VersionHistoryPanel({
  section,
  restoringVersionId,
  onRestore,
}: {
  section: MemoSection;
  restoringVersionId: string;
  onRestore: (version: MemoSectionVersion) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState("");
  const versions = section.versions ?? [];
  const previewVersion = versions.find((version) => version.id === previewVersionId) ?? null;
  return (
    <div className="version-history">
      <button className="version-history-toggle" type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        <span>
          <strong>Version history</strong>
          <small>{versions.length ? `${versions.length} saved ${versions.length === 1 ? "version" : "versions"}` : "No saved versions yet"}</small>
        </span>
        <b>{isOpen ? "Collapse" : "Expand"}</b>
      </button>
      {isOpen ? (
        <div className="version-history-panel">
          {versions.length ? (
            <>
              <ol className="version-list">
                {versions.map((version) => (
                  <li key={version.id} className="version-item">
                    <div className="version-item-main">
                      <div className="version-meta">
                        <strong>{version.actionType === "restore" ? "Restored" : version.actionType === "headcount_summary" ? "Generated Headcount summary" : "Edited"} by {version.createdByName}</strong>
                        <span>{formatTimestamp(version.createdAt)}</span>
                      </div>
                      <p>{previewContent(version.content)}</p>
                      {version.sourceVersionId ? <small>Source version: {shortVersionId(version.sourceVersionId)}</small> : null}
                    </div>
                    <div className="version-actions">
                      <button type="button" onClick={() => setPreviewVersionId(previewVersionId === version.id ? "" : version.id)}>
                        {previewVersionId === version.id ? "Hide" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRestore(version)}
                        disabled={restoringVersionId === version.id || version.content === section.content}
                      >
                        {restoringVersionId === version.id ? "Restoring..." : "Restore"}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {previewVersion ? (
                <div className="version-preview">
                  <div className="version-preview-header">
                    <strong>Preview</strong>
                    <span>{formatTimestamp(previewVersion.createdAt)}</span>
                  </div>
                  <p>{previewVersion.content || "Empty content."}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="version-empty">Save this section to start retaining field-level versions.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function InvestmentRequestsWorkspace({
  profile,
  requests,
  activeRequest,
  exportPreview,
  search,
  error,
  canEdit,
  onSearch,
  onSelect,
  onCreate,
  onSave,
  onSubmit,
  onExport,
  onDownload,
  onDelete,
}: {
  profile: InvestmentWorkbookProfile | null;
  requests: InvestmentRequest[];
  activeRequest: InvestmentRequest | null;
  exportPreview: InvestmentRequestExport | null;
  search: string;
  error: string;
  canEdit: boolean;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: (requestType: InvestmentRequestType) => Promise<void>;
  onSave: (request: InvestmentRequest) => Promise<boolean>;
  onSubmit: (request: InvestmentRequest) => Promise<boolean>;
  onExport: (request: InvestmentRequest) => Promise<boolean>;
  onDownload: (request: InvestmentRequest) => Promise<boolean>;
  onDelete: (request: InvestmentRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<InvestmentRequest | null>(activeRequest);
  const [draftRequestId, setDraftRequestId] = useState(activeRequest?.id ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [showHeadCountGpt, setShowHeadCountGpt] = useState(false);
  const [selectedHeadcountField] = useState<HeadcountField>("strategicObjective");
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | "archive" | "restore" | "preview" | "download" | "delete" | null>(null);

  if ((activeRequest?.id ?? "") !== draftRequestId) {
    setDraftRequestId(activeRequest?.id ?? "");
    setDraft(activeRequest);
    setIsDirty(false);
  }

  useEffect(() => {
    if (!draft || draft.requestType !== "Payroll / Headcount" || !isDirty) return;
    window.localStorage.setItem(privateDraftKey(draft.id), JSON.stringify({ baseUpdatedAt: draft.updatedAt, savedAt: Date.now(), request: draft } satisfies PrivateHeadcountDraft));
  }, [draft, isDirty]);

  if (!profile) {
    return (
      <section className="investment-empty">
        <p className="eyebrow">Headcount</p>
        <h2>No G&A workbook template is configured for this business plan.</h2>
        <p>Phase 1 only supports the uploaded Data Centers, Energy Solutions, Essentials, and Strategic Capital workbooks.</p>
      </section>
    );
  }

  const submitted = requests.filter((request) => request.status === "Submitted").length;

  function updateDraft(patch: Partial<InvestmentRequest>) {
    setIsDirty(true);
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (current.requestType === "Payroll / Headcount" && typeof patch.initiative === "string") {
        next.lines = current.lines.map((line) => ({ ...line, jobTitle: patch.initiative as string }));
      }
      return next;
    });
  }

  function updateLine(id: string, patch: Partial<InvestmentRequestLine>) {
    setIsDirty(true);
    setDraft((current) =>
      current
        ? {
            ...current,
            lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
          }
        : current,
    );
  }

  function addLine() {
    setIsDirty(true);
    setDraft((current) =>
      current
        ? {
            ...current,
            lines: [
              ...current.lines,
              {
                ...emptyInvestmentRequestLine,
                id: crypto.randomUUID(),
                lineType: current.requestType,
                jobTitle: current.requestType === "Payroll / Headcount" ? current.initiative : "",
              },
            ],
          }
        : current,
    );
  }

  function removeLine(id: string) {
    setIsDirty(true);
    setDraft((current) =>
      current
        ? {
            ...current,
            lines: current.lines.length > 1 ? current.lines.filter((line) => line.id !== id) : current.lines,
          }
        : current,
    );
  }

  async function saveCurrentDraft(submit = false) {
    if (!draft) return;
    const action = submit ? "submit" : "save";
    setPendingAction(action);
    try {
      const saved = await (submit ? onSubmit(draft) : onSave(draft));
      if (saved && draft.requestType === "Payroll / Headcount") {
        window.localStorage.removeItem(privateDraftKey(draft.id));
        setIsDirty(false);
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function previewExport() {
    if (!draft) return;
    setPendingAction("preview");
    try {
      await onExport(draft);
    } finally {
      setPendingAction(null);
    }
  }

  async function downloadWorkbook() {
    if (!draft) return;
    setPendingAction("download");
    try {
      await onDownload(draft);
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteRequest(request: InvestmentRequest) {
    setPendingAction("delete");
    try {
      await onDelete(request);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="investment-layout">
      <aside className="investment-sidebar">
        <div>
          <p className="eyebrow">Headcount</p>
          <h2>{profile.businessUnit}</h2>
          <p>{submitted}/{requests.length || 0} submitted</p>
        </div>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search owner, title, milestone, amount, or keyword"
          aria-label="Search Headcount requests"
        />
        <div className="investment-create-row">
          <button className="primary-button" disabled={!canEdit || pendingAction !== null} onClick={() => void onCreate("Payroll / Headcount")}>
            Create New Headcount
          </button>
          <button className="toolbar-button" disabled={!canEdit || pendingAction !== null} onClick={() => void onCreate("Non-Payroll")}>
            Create New Non-Payroll
          </button>
        </div>
        <div className="investment-request-list">
          {requests.length === 0 ? <p className="empty-note">No Headcount requests yet.</p> : null}
          {requests.map((request) => (
            <div
              key={request.id}
              className={`investment-list-item ${activeRequest?.id === request.id ? "investment-list-item-active" : ""}`}
              onClick={() => onSelect(request.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(request.id);
                }
              }}
            >
              <button
                className="investment-delete-button"
                type="button"
                title="Delete request"
                aria-label={`Delete ${request.initiative || "untitled investment request"}`}
                disabled={!canEdit || pendingAction !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm("Delete this investment request? This removes it from the system.")) {
                    void deleteRequest(request);
                  }
                }}
              >
                ×
              </button>
              <span>{request.initiative || "Untitled request"}</span>
              <small>{request.requestType} · {request.archivedAt ? "Archived" : request.status}</small>
            </div>
          ))}
        </div>
      </aside>

      <section className="investment-main">
        <button
          className="headcount-help-avatar-button investment-panel-help"
          type="button"
          aria-label="Open Nathaalie"
          title="Open Nathaalie"
          onClick={() => setShowHeadCountGpt(true)}
        />
        {error ? <div className="investment-error">{error}</div> : null}
        {showHeadCountGpt ? (
          <CoachPanel title="Nathaalie" onClose={() => setShowHeadCountGpt(false)}>
            <HeadCountRequestGpt request={draft} field={selectedHeadcountField} onUpdateDraft={updateDraft} />
          </CoachPanel>
        ) : null}
        {!draft ? (
          <div className="investment-empty">
            <p className="eyebrow">Guided intake</p>
            <h2>Create an investment request</h2>
            <p>Use the workbook-derived form to create a structured request tied to this business plan.</p>
          </div>
        ) : (
          <>
            {draft.archivedAt ? <div className="mb-4 rounded-lg bg-[#fff3e7] p-3 text-sm text-[#5f3c1c]">This headcount request is archived and excluded from summary generation until restored.</div> : null}
            <div className="investment-header">
              <div>
                <p className="eyebrow">{draft.requestType}</p>
                <h2>{draft.initiative || "Untitled investment request"}</h2>
              </div>
              <div className="investment-actions">
                <span className={`small-status small-status-active ${draft.status === "Submitted" ? "section-status-approved" : "section-status-draft"}`}>
                  {draft.status}
                </span>
                <div className="investment-action-area">
                  <div className="investment-button-grid">
                    <button className="toolbar-button" disabled={!canEdit || Boolean(draft.archivedAt) || pendingAction !== null} onClick={() => void saveCurrentDraft()}>
                      Save Draft
                    </button>
                    <button className="toolbar-button toolbar-button-green" disabled={!canEdit || Boolean(draft.archivedAt) || pendingAction !== null} onClick={() => void saveCurrentDraft(true)}>
                      Submit
                    </button>
                    <button className="toolbar-button" disabled={pendingAction !== null} onClick={() => void previewExport()}>
                      Preview All
                    </button>
                    <button className="toolbar-button toolbar-button-green" disabled={pendingAction !== null} onClick={() => void downloadWorkbook()}>
                      Download All
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="investment-form-grid">
              <label>
                <span>Owner</span>
                <input value={draft.ownerName} onChange={(event) => updateDraft({ ownerName: event.target.value })} disabled={!canEdit || Boolean(draft.archivedAt)} />
              </label>
              <label>
                <span>Owner email</span>
                <input value={draft.ownerEmail} onChange={(event) => updateDraft({ ownerEmail: event.target.value })} disabled={!canEdit || Boolean(draft.archivedAt)} />
              </label>
              <label className="investment-wide">
                <span>Title</span>
                <input value={draft.initiative} onChange={(event) => updateDraft({ initiative: event.target.value })} disabled={!canEdit || Boolean(draft.archivedAt)} />
              </label>
            </div>

            <div className="investment-question-grid">
              {investmentCaseQuestions.map((question) => (
                <label key={question.key}>
                  <span>{question.question}</span>
                  <small>{question.guidance}</small>
                  <textarea
                    value={String(draft[question.key] ?? "")}
                    onChange={(event) => updateDraft({ [question.key]: event.target.value } as Partial<InvestmentRequest>)}
                    disabled={!canEdit || Boolean(draft.archivedAt)}
                  />
                </label>
              ))}
            </div>

            <div className="investment-lines-head">
              <div>
                <p className="eyebrow">Workbook input rows</p>
                <h3>{draft.requestType}</h3>
              </div>
              <button className="toolbar-button" disabled={!canEdit || Boolean(draft.archivedAt)} onClick={addLine}>Add row</button>
            </div>

            <div className="investment-lines">
              {draft.lines.map((line, index) => (
                <InvestmentLineEditor
                  key={line.id}
                  index={index}
                  line={line}
                  requestType={draft.requestType}
                  groups={profile.groups}
                  expenseTypes={profile.expenseTypes}
                  canEdit={canEdit && !draft.archivedAt}
                  inheritedTitle={draft.initiative}
                  onChange={(patch) => updateLine(line.id, patch)}
                  onRemove={() => removeLine(line.id)}
                />
              ))}
            </div>

            {draft.requestType !== "Payroll / Headcount" ? <InvestmentSummary request={draft} /> : null}
            {draft.requestType === "Payroll / Headcount" ? <p className="investment-sensitive-note">This export includes the available role and business-rationale information. Compensation and payroll assumptions must be entered directly into the Excel workbook.</p> : null}
            {exportPreview ? <InvestmentExportPreview preview={exportPreview} /> : null}
          </>
        )}
      </section>
    </div>
  );
}

function HeadCountRequestGpt({ request, field, onUpdateDraft }: { request: InvestmentRequest | null; field: HeadcountField; onUpdateDraft: (patch: Partial<InvestmentRequest>) => void }) {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<HeadcountPromptAction | null>(null);
  const [retryAction, setRetryAction] = useState<HeadcountPromptAction | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const definition = headcountFieldDefinitions[field];

  async function runHeadCountGpt(action: HeadcountPromptAction, suppliedTitle?: string) {
    if (!request || isWorking) return;
    const title = (suppliedTitle ?? request.initiative).trim();
    if (!title) {
      setPendingAction(action);
      setError("");
      return;
    }
    setIsWorking(true);
    setRetryAction(action);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/head-count-request-gpt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          field,
          title,
          requestContext: request,
        }),
      });
      const payload = (await response.json()) as { result?: string; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Nathaalie could not complete this request.");
      }
      setResult(payload.result);
    } catch {
      setError("Nathaalie could not complete this request. Your existing response has not been changed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="headcount-gpt">
      <p className="headcount-selected-question">{definition.question}</p>
      {request?.initiative ? <p className="text-sm">Using title: {request.initiative}</p> : null}
      {pendingAction ? (
        <div className="coach-output" role="status">
          <p>What is the title of the proposed role? I need the title to draft this response.</p>
          <input value={titleInput} placeholder="Role title" onChange={(event) => setTitleInput(event.target.value)} />
          <button className="primary-button" disabled={!titleInput.trim() || isWorking} onClick={() => {
            const title = titleInput.trim();
            onUpdateDraft({ initiative: title });
            setPendingAction(null);
            void runHeadCountGpt(pendingAction, title);
          }}>Continue drafting</button>
        </div>
      ) : null}
      <div className="headcount-gpt-actions">
        <button className="primary-button" disabled={!request || isWorking} onClick={() => void runHeadCountGpt("draft")}>Draft this answer</button>
        <button className="toolbar-button" disabled={!request || isWorking} onClick={() => void runHeadCountGpt("improve")}>Improve this answer</button>
        <button className="toolbar-button" disabled={!request || isWorking} onClick={() => void runHeadCountGpt("concise")}>Make this more concise</button>
        <button className="toolbar-button" disabled={!request || isWorking} onClick={() => void runHeadCountGpt("missing")}>Identify what is missing</button>
      </div>
      {isWorking ? <p role="status" aria-live="polite">Drafting a concise response…</p> : null}
      {error ? (
        <div className="coach-output coach-output-error" role="alert">
          <p>{error}</p>
          <button className="toolbar-button" onClick={() => retryAction && void runHeadCountGpt(retryAction)}>Retry</button>
        </div>
      ) : null}
      {result ? (
        <div className="coach-output" role="status" aria-live="polite">
          <p className="eyebrow">Response for: {definition.question}</p>
          <textarea className="coach-box" rows={6} value={result} onChange={(event) => setResult(event.target.value)} />
          <div className="headcount-gpt-actions">
            <button className="toolbar-button" onClick={() => void navigator.clipboard.writeText(result)}>Copy</button>
            <button className="primary-button" onClick={() => {
              if (String(request?.[field] ?? "").trim() && !confirmReplace) { setConfirmReplace(true); return; }
              onUpdateDraft({ [field]: result } as Partial<InvestmentRequest>);
              setConfirmReplace(false);
            }}>{confirmReplace ? "Confirm replace" : "Insert into field"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvestmentLineEditor({
  index,
  line,
  requestType,
  groups,
  expenseTypes,
  canEdit,
  inheritedTitle,
  onChange,
  onRemove,
}: {
  index: number;
  line: InvestmentRequestLine;
  requestType: InvestmentRequestType;
  groups: string[];
  expenseTypes: string[];
  canEdit: boolean;
  inheritedTitle: string;
  onChange: (patch: Partial<InvestmentRequestLine>) => void;
  onRemove: () => void;
}) {
  const hasGroups = groups.length > 0;
  return (
    <article className="investment-line-card">
      <div className="investment-line-title">
        <strong>Row {index + 1}</strong>
        <button className="icon-button" disabled={!canEdit} title="Remove row" onClick={onRemove}>×</button>
      </div>
      {requestType === "Payroll / Headcount" ? (
        <div className="investment-form-grid">
          <p className="investment-sensitive-note investment-wide">
            Compensation details stay in the restricted Excel and HR/FP&A process. Capture only the business context here.
          </p>
          <Field label="Job Title" value={inheritedTitle} disabled />
          {hasGroups ? (
            <SelectField label="Group" value={line.group} options={groups} disabled={!canEdit} onChange={(value) => onChange({ group: value })} />
          ) : null}
          <Field label="Role / Hire" value={line.roleHire} disabled={!canEdit} onChange={(value) => onChange({ roleHire: value })} />
          <Field label="Location (City/Country)" value={line.location} disabled={!canEdit} onChange={(value) => onChange({ location: value })} />
          <Field label="Hire Date" type="date" value={line.hireDate} disabled={!canEdit} onChange={(value) => onChange({ hireDate: value })} />
          <label className="investment-wide">
            <span>Key Job Responsibilities</span>
            <textarea value={line.responsibilities} disabled={!canEdit} onChange={(event) => onChange({ responsibilities: event.target.value })} />
          </label>
          <label className="investment-wide">
            <span>Notes / Rationale</span>
            <textarea value={line.notesRationale} disabled={!canEdit} onChange={(event) => onChange({ notesRationale: event.target.value })} />
          </label>
        </div>
      ) : (
        <div className="investment-form-grid">
          <Field label="Expense Description" value={line.expenseDescription} disabled={!canEdit} onChange={(value) => onChange({ expenseDescription: value })} />
          {hasGroups ? (
            <SelectField label="Group" value={line.group} options={groups} disabled={!canEdit} onChange={(value) => onChange({ group: value })} />
          ) : null}
          <SelectField label="Type of Expense" value={line.expenseType} options={expenseTypes} disabled={!canEdit} onChange={(value) => onChange({ expenseType: value })} />
          <Field label="Vendor" value={line.vendor} disabled={!canEdit} onChange={(value) => onChange({ vendor: value })} />
          <NumberField label="Annualized Spend" value={line.annualizedSpend} disabled={!canEdit} onChange={(value) => onChange({ annualizedSpend: value })} />
          <label className="investment-wide">
            <span>Notes / Rationale</span>
            <textarea value={line.notesRationale} disabled={!canEdit} onChange={(event) => onChange({ notesRationale: event.target.value })} />
          </label>
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  type = "text",
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  disabled,
  step = "1",
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  step?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function InvestmentSummary({ request }: { request: InvestmentRequest }) {
  const total = request.lines.reduce((sum, line) => sum + (line.annualizedSpend ?? 0), 0);
  return (
    <section className="investment-summary">
      <p className="eyebrow">Executive summary</p>
      <p>{request.ownerName || "The business owner"} is requesting {request.requestType.toLowerCase()} investment for {request.initiative || "an unnamed title"}. The request supports {request.strategicObjective || "a strategic objective not yet specified"} and is tied to {request.milestone || "a milestone not yet specified"}.</p>
      <p>Expected outcome: {request.measurableOutcome || "not specified"}. If not approved: {request.notApprovedImpact || "not specified"}.</p>
      <div className="investment-summary-metrics">
        <Metric label="Rows" value={`${request.lines.length}`} />
        <Metric label="Input amount" value={formatCurrency(total)} />
        <Metric label="Status" value={request.status} />
      </div>
    </section>
  );
}

function InvestmentExportPreview({ preview }: { preview: InvestmentRequestExport }) {
  return (
    <section className="investment-export">
      <p className="eyebrow">Paste-ready Excel export</p>
      <h3>{preview.workbookName}</h3>
      <p>Target sheet: {preview.targetSheet}</p>
      <label>
        <span>Payroll / Headcount input range: {preview.payrollRange}</span>
        <textarea readOnly value={preview.payrollTsv} />
      </label>
      <label>
        <span>Non-Payroll input range: {preview.nonPayrollRange}</span>
        <textarea readOnly value={preview.nonPayrollTsv} />
      </label>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
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
  currentUserEmail: string;
  canParticipate: boolean;
  canEditMemo: boolean;
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
  currentUserEmail,
  canParticipate,
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
      <p className="mt-2 text-xs text-[#756f64]">Signed in as {currentUserEmail || "unknown user"}</p>
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
          disabled={isAddingQuestion || !questionDraft.trim() || !canParticipate}
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
  canParticipate,
  canEditMemo,
  questions,
  responseDrafts,
  setResponseDrafts,
  saveQuestion,
  removeQuestion,
  canDelete,
}: QuestionPanelProps) {
  const [openResponseEditors, setOpenResponseEditors] = useState<Record<string, boolean>>({});

  async function saveBusinessResponse(question: Question) {
    const draft = (responseDrafts[question.id] ?? "").trim();
    if (!draft) return;
    const nextResponse = question.response.trim() ? `${question.response.trim()}\n\n${draft}` : draft;
    await saveQuestion(question, {
      response: nextResponse,
      status: "Answered",
    });
    setResponseDrafts((current) => ({ ...current, [question.id]: "" }));
    setOpenResponseEditors((current) => ({ ...current, [question.id]: false }));
  }

  function openBusinessResponse(question: Question) {
    setResponseDrafts((current) => ({ ...current, [question.id]: "" }));
    setOpenResponseEditors((current) => ({ ...current, [question.id]: true }));
  }

  return (
    <div className="question-list">
      {questions.length === 0 ? <p className="empty-note">No questions for this view.</p> : null}
      {questions.map((question) => {
        const editorIsOpen = openResponseEditors[question.id] ?? !question.response;
        return (
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
                disabled={!canParticipate}
                onChange={(event) => void saveQuestion(question, { status: event.target.value as QuestionStatus })}
              >
                {questionStatusOptions(role, question.status).map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <p className="question-body">{question.body}</p>
            {canEditMemo ? (
              <>
                {question.response ? (
                  <div className="response-read">
                    <p className="eyebrow">Business response</p>
                    <p>{question.response}</p>
                  </div>
                ) : null}
                {editorIsOpen ? (
                  <div className="response-editor">
                    <p className="eyebrow">{question.response ? "Reply" : "Business response"}</p>
                    <textarea
                      value={responseDrafts[question.id] ?? ""}
                      onChange={(event) =>
                        setResponseDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      placeholder={question.response ? "Add a reply..." : "Respond to the question..."}
                    />
                    <button
                      className="toolbar-button"
                      disabled={!(responseDrafts[question.id] ?? "").trim()}
                      onClick={() => void saveBusinessResponse(question)}
                    >
                      Save response
                    </button>
                  </div>
                ) : (
                  <button className="reply-button" type="button" onClick={() => openBusinessResponse(question)}>
                    Reply
                  </button>
                )}
              </>
            ) : question.response ? (
              <div className="response-read">
                <p className="eyebrow">Business response</p>
                <p>{question.response}</p>
              </div>
            ) : (
              <p className="response-empty">No response yet.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function HowToPanel() {
  return (
    <section className="how-to-card" aria-label="How to complete the business plan">
      <p className="eyebrow">How to complete the plan</p>
      <ol>
        <li>Select the correct business plan view before drafting.</li>
        <li>Use the section guidance to answer with facts, owners, timing, metrics, risks, dependencies, and the decision needed.</li>
        <li>Save Draft while the Business Team is still working. Drafts are not visible to Enablement or Approvers.</li>
        <li>Save for Review when Enablement should read the section and ask questions.</li>
        <li>Resolve questions in the Questions panel, then update the memo text directly.</li>
        <li>Save for Approval when Tim, Dan, and designated approvers should review the section.</li>
      </ol>
      <p>One business owner should own the final answer for each section. Avoid vague alignment asks, unsupported claims, and group-written language that does not name the decision or support needed.</p>
    </section>
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
      {sections.length ? sections.map((section, index) => {
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
      }) : (
        <section className="full-memo-section">
          <div className="memo-box">No memo sections are available for this role yet.</div>
        </section>
      )}
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

function CoachPanel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <aside className="coach-panel print:hidden" aria-label={title}>
      <div className="coach-panel-header">
        <div>
          <h2>{title}</h2>
          <p>Keep this panel open while editing.</p>
        </div>
        <button className="icon-button" title="Close" aria-label={`Close ${title}`} onClick={onClose}>×</button>
      </div>
      <div className="coach-panel-content">{children}</div>
    </aside>
  );
}

function CoachActions({ section, sections }: { section: MemoSection; sections: MemoSection[] }) {
  const [coachResult, setCoachResult] = useState("");
  const [coachError, setCoachError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);
  const actions = [
    "Create a prompt for this section",
    "Tighten this section",
    "Make this more executive-ready",
    "Find vague or unsupported claims",
    "Identify missing decisions, owners, dependencies, or support needs",
    "Suggest likely Enablement questions",
    "Suggest likely Approver concerns",
    "Reduce length while preserving important information",
    ...sectionCoachActions(section.title),
  ];

  async function runCoachAction(action: string) {
    setIsCoaching(true);
    setActiveAction(action);
    setCoachError("");
    setCoachResult("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          sectionTitle: section.title,
          sectionPrompt: section.prompt,
          sectionFormat: section.format,
          sectionEmphasize: section.emphasize,
          sectionAvoid: section.avoid,
          sectionContent: section.content,
          sections: action === "Review the full memo" ? sections.map((item) => ({
            title: item.title,
            prompt: item.prompt,
            format: item.format,
            emphasize: item.emphasize,
            avoid: item.avoid,
            content: item.content,
          })) : undefined,
        }),
      });
      const payload = (await response.json()) as { result?: string; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Coach P request failed.");
      }
      setCoachResult(payload.result);
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : "Coach P request failed.");
    } finally {
      setIsCoaching(false);
    }
  }

  return (
    <div>
      <p className="text-sm leading-6 text-[#45413a]">
        Create prompts or work on the current section. Full review reads every section guideline and draft, then reports only concise changes needed.
      </p>
      <div className="coach-action-grid">
        <button className="primary-button" disabled={isCoaching} onClick={() => void runCoachAction("Review the full memo")}>
          {isCoaching && activeAction === "Review the full memo" ? "Reviewing..." : "Review full memo"}
        </button>
        {actions.map((action) => (
          <button key={action} className="toolbar-button" disabled={isCoaching} onClick={() => void runCoachAction(action)}>
            {isCoaching && activeAction === action ? "Working..." : action}
          </button>
        ))}
      </div>
      {coachError ? (
        <div className="coach-output coach-output-error mt-4" role="alert">
          <p className="eyebrow">Coach P error</p>
          <p>{coachError}</p>
        </div>
      ) : null}
      {coachResult ? (
        <div className="coach-output mt-4" role="status" aria-live="polite">
          <p className="eyebrow">Coach P response</p>
          <p>{formatCoachText(coachResult)}</p>
        </div>
      ) : null}
    </div>
  );
}

function formatCoachText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function sectionSubtitle(section: MemoSection) {
  if (section.title === "Executive Summary") return "One short paragraph and 3-5 takeaways.";
  if (section.title === "Headcount Needs") {
    return "Generate a concise summary from complete headcount requests, then refine the saved draft as needed.";
  }
  return section.prompt;
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function previewContent(value: string) {
  const preview = value.trim().replace(/\s+/g, " ");
  if (!preview) return "Empty content.";
  return preview.length > 180 ? `${preview.slice(0, 177)}...` : preview;
}

function shortVersionId(value: string) {
  return value.slice(0, 8);
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
