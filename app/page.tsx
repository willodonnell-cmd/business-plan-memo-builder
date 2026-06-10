"use client";

import { useMemo, useState } from "react";

type Status = "draft" | "review" | "approved";

type MemoSection = {
  id: string;
  title: string;
  format: string;
  limit: string;
  purpose: string;
  questions: string[];
  guardrails: string[];
  starter: string;
};

const sections: MemoSection[] = [
  {
    id: "summary",
    title: "Executive Summary",
    format: "1 paragraph plus 3-5 bullets",
    limit: "4-6 sentences maximum",
    purpose: "Clarify what the business is trying to become in 2027 and why it matters to Prologis.",
    questions: [
      "What is the business trying to become in 2027?",
      "Why does that direction matter to Prologis?",
      "What is the core business thesis?",
      "Which 3-5 takeaways should leadership remember after reading the memo?",
    ],
    guardrails: [
      "Do not restate last year's plan.",
      "Avoid market background unless it changes the approval decision.",
      "Write for an executive reader who already knows the business.",
    ],
    starter:
      "In 2027, this business is trying to become...\n\nKey takeaways:\n- \n- \n- ",
  },
  {
    id: "priorities",
    title: "2027 Priorities",
    format: "Maximum 3 priorities",
    limit: "2-3 bullets per priority",
    purpose: "Force prioritization around the few actions that determine success.",
    questions: [
      "What is the priority?",
      "Why is it a priority in 2027 specifically?",
      "What decision or action does it require?",
      "What outcome should Prologis expect if execution is strong?",
    ],
    guardrails: [
      "Do not list every initiative underway.",
      "Each priority should require leadership attention, funding, support, or approval.",
      "Name the decision or action, not just the theme.",
    ],
    starter:
      "Priority 1: \n- Why now: \n- Decision or action required: \n- Expected outcome: \n\nPriority 2: \n- Why now: \n- Decision or action required: \n- Expected outcome: ",
  },
  {
    id: "growth",
    title: "Growth Opportunities",
    format: "3-5 opportunities maximum",
    limit: "Short paragraph or 3-5 bullets each",
    purpose: "Identify opportunities that could meaningfully change the business over the next several years.",
    questions: [
      "What is the opportunity?",
      "How large could it become?",
      "What customer need does it address?",
      "Why does Prologis have a right to win or a right to play?",
      "What needs to happen for the opportunity to scale?",
    ],
    guardrails: [
      "Only include opportunities with meaningful potential impact.",
      "Separate proven opportunities from hypotheses.",
      "Call out what must be validated before scaling.",
    ],
    starter:
      "Opportunity: \n- Potential scale: \n- Customer need: \n- Prologis right to win/play: \n- Requirements to scale: ",
  },
  {
    id: "support",
    title: "Support Needed",
    format: "3-5 specific asks or dependencies",
    limit: "Bullet format",
    purpose: "Make clear what Prologis must approve, decide, fund, or coordinate.",
    questions: [
      "What approvals are needed?",
      "What organizational support is required?",
      "Which cross-functional dependencies matter most?",
      "What decisions would accelerate progress?",
      "What could slow execution if not addressed?",
    ],
    guardrails: [
      "Every bullet should be a concrete ask or dependency.",
      "Avoid passive statements like 'support alignment'.",
      "Name the owner or function when it is known.",
    ],
    starter:
      "- Approval needed: \n- Cross-functional dependency: \n- Decision that would accelerate progress: \n- Execution blocker to address: ",
  },
  {
    id: "ai",
    title: "AI and Productivity Strategy",
    format: "1-2 short paragraphs",
    limit: "Measurable efficiency gains where possible",
    purpose: "Explain how AI changes the operating model, execution pace, analysis, and hiring strategy.",
    questions: [
      "How will AI be incorporated into the team operating model?",
      "What activities will be automated, accelerated, or augmented?",
      "What measurable efficiency gains are expected?",
      "How will AI improve decision-making, customer engagement, analysis, or execution?",
      "How does AI affect future hiring strategy?",
    ],
    guardrails: [
      "Do not claim savings without a measurement basis.",
      "Distinguish pilots from committed operating changes.",
      "Tie AI use to work quality, cycle time, capacity, or risk reduction.",
    ],
    starter:
      "The team will use AI to...\n\nExpected productivity impact includes...",
  },
  {
    id: "headcount",
    title: "Headcount Needs",
    format: "Bullet format by role or capability",
    limit: "Only necessary requests",
    purpose: "Justify the roles or capabilities required to execute the plan.",
    questions: [
      "What role or capability is needed?",
      "What business problem does it solve?",
      "Why is it needed now?",
      "How does it support revenue growth, execution speed, or risk reduction?",
      "What is the expected return on the investment?",
    ],
    guardrails: [
      "Do not include nice-to-have hiring.",
      "Every request needs a business rationale.",
      "Tie the request to revenue, speed, risk, or required support.",
    ],
    starter:
      "- Role or capability: \n  Purpose: \n  ROI rationale: \n\n- Role or capability: \n  Purpose: \n  ROI rationale: ",
  },
  {
    id: "risks",
    title: "Key Risks and Dependencies",
    format: "3-5 bullets",
    limit: "Only risks material to approval",
    purpose: "Surface assumptions, dependencies, and stop/slow/change-course triggers.",
    questions: [
      "What are the biggest risks?",
      "What assumptions must prove true?",
      "Which dependencies exist inside or outside Prologis?",
      "What would cause the team to slow down, change course, or stop?",
    ],
    guardrails: [
      "Do not list generic risks.",
      "Focus on risks that affect approval, funding, timing, or execution confidence.",
      "Name mitigation or decision trigger when possible.",
    ],
    starter:
      "- Risk or assumption: \n  Why it matters: \n  Trigger or mitigation: \n\n- Risk or assumption: \n  Why it matters: \n  Trigger or mitigation: ",
  },
  {
    id: "ask",
    title: "Bottom-Line Ask",
    format: "1 short paragraph",
    limit: "Maximum 4 sentences",
    purpose: "End with the approvals requested, key drivers of success, and one takeaway.",
    questions: [
      "What exactly should leadership approve?",
      "What are the key drivers of success in 2027?",
      "What is the most important takeaway from the plan?",
    ],
    guardrails: [
      "Do not introduce new arguments in the closing.",
      "Be explicit about the approval request.",
      "Keep it short enough to be read aloud in a meeting.",
    ],
    starter:
      "We are asking leadership to approve... Success in 2027 depends on... The most important takeaway is...",
  },
];

const omittedItems = [
  "Detailed financial tables",
  "Long market analyses",
  "Historical business reviews",
  "Extensive operational detail",
  "Large lists of initiatives",
  "Content that belongs in the financial addendum",
];

const approvalSteps = ["Team draft", "Function review", "Executive Committee"];

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function Home() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(sections.map((section) => [section.id, section.starter])),
  );
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(sections.map((section) => [section.id, "draft"])),
  );
  const [teamName, setTeamName] = useState("Strategy team");
  const [decisionOwner, setDecisionOwner] = useState("Executive Committee");

  const activeSection =
    sections.find((section) => section.id === activeId) ?? sections[0];
  const activeDraft = drafts[activeSection.id] ?? "";
  const approvedCount = sections.filter(
    (section) => statuses[section.id] === "approved",
  ).length;
  const reviewCount = sections.filter(
    (section) => statuses[section.id] === "review",
  ).length;
  const totalWords = useMemo(
    () => Object.values(drafts).reduce((sum, draft) => sum + countWords(draft), 0),
    [drafts],
  );
  const pageEstimate = Math.max(1, Math.ceil(totalWords / 550));
  const prompt = `Act as a business plan thinking coach for ${teamName}. Do not write the answer for the team and do not make assumptions. Ask concise questions that help the team answer the "${activeSection.title}" section of a 2027 Prologis business plan memo. The section purpose is: ${activeSection.purpose}. The required format is: ${activeSection.format}. The current draft is below. Identify missing facts, decisions, support requests, assumptions, and approval implications.\n\nCurrent draft:\n${activeDraft}`;

  function updateStatus(sectionId: string, status: Status) {
    setStatuses((current) => ({ ...current, [sectionId]: status }));
  }

  function updateDraft(value: string) {
    setDrafts((current) => ({ ...current, [activeSection.id]: value }));
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#17211b]">
      <section className="border-b border-[#d8d0c4] bg-[#fbfaf7]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase text-[#4f6f55]">
                2027 Business Plan Input Request
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
                Approval-ready business plan memo builder
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#526057]">
                Create a four-page-or-less strategy memo for cross-functional
                review and Executive Committee approval. The workspace keeps the
                plan focused on decisions, outcomes, support needed, AI-enabled
                productivity, headcount, risks, and the bottom-line ask.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Memo estimate" value={`${pageEstimate}/4 pages`} />
              <Metric label="Approved sections" value={`${approvedCount}/8`} />
              <Metric label="In review" value={`${reviewCount}`} />
            </div>
          </div>

          <div className="rounded-lg border border-[#d8d0c4] bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Team
                <input
                  className="mt-2 w-full rounded-md border border-[#c8c0b5] bg-[#fbfaf7] px-3 py-2 text-sm outline-none focus:border-[#35633f]"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                Decision owner
                <input
                  className="mt-2 w-full rounded-md border border-[#c8c0b5] bg-[#fbfaf7] px-3 py-2 text-sm outline-none focus:border-[#35633f]"
                  value={decisionOwner}
                  onChange={(event) => setDecisionOwner(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 rounded-md bg-[#e8efe6] p-4 text-sm leading-6 text-[#24362a]">
              <strong>Writing rule:</strong> if a sentence does not help{" "}
              {decisionOwner} understand, approve, fund, or support the plan,
              remove it.
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:px-8">
        <aside className="space-y-3">
          <div className="rounded-lg border border-[#d8d0c4] bg-white p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase text-[#68736b]">
              Memo sections
            </p>
            <nav className="space-y-1">
              {sections.map((section, index) => (
                <button
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                    section.id === activeId
                      ? "bg-[#dfeadb] font-semibold text-[#183722]"
                      : "hover:bg-[#f4f1eb]"
                  }`}
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                >
                  <span>
                    {index + 1}. {section.title}
                  </span>
                  <StatusDot status={statuses[section.id]} />
                </button>
              ))}
            </nav>
          </div>

          <div className="rounded-lg border border-[#d8d0c4] bg-white p-4">
            <p className="text-sm font-semibold">Approval path</p>
            <div className="mt-3 space-y-2">
              {approvalSteps.map((step, index) => (
                <div className="flex items-center gap-2 text-sm" key={step}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#245b38] text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-[#d8d0c4] bg-white shadow-sm">
          <div className="border-b border-[#e2dacf] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#4f6f55]">
                  {activeSection.format}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {activeSection.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c665f]">
                  {activeSection.purpose}
                </p>
              </div>
              <select
                className="rounded-md border border-[#c8c0b5] bg-[#fbfaf7] px-3 py-2 text-sm font-semibold outline-none focus:border-[#35633f]"
                value={statuses[activeSection.id]}
                onChange={(event) =>
                  updateStatus(activeSection.id, event.target.value as Status)
                }
              >
                <option value="draft">Draft</option>
                <option value="review">Ready for review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <label className="block">
              <span className="text-sm font-semibold">Section draft</span>
              <textarea
                className="mt-2 min-h-[430px] w-full resize-y rounded-lg border border-[#c8c0b5] bg-[#fbfaf7] p-4 font-mono text-sm leading-6 outline-none focus:border-[#35633f]"
                value={activeDraft}
                onChange={(event) => updateDraft(event.target.value)}
              />
            </label>

            <div className="space-y-4">
              <Panel title="Section constraints">
                <p className="text-sm leading-6">{activeSection.limit}</p>
                <p className="mt-2 text-sm leading-6">{activeSection.format}</p>
              </Panel>

              <Panel title="Decision-quality check">
                <ul className="space-y-2 text-sm leading-6">
                  {activeSection.guardrails.map((guardrail) => (
                    <li className="flex gap-2" key={guardrail}>
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#245b38]" />
                      <span>{guardrail}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Section stats">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Words" value={`${countWords(activeDraft)}`} compact />
                  <Metric label="Status" value={statuses[activeSection.id]} compact />
                </div>
              </Panel>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[#b8c8b3] bg-[#eef5ec] p-4">
            <p className="text-sm font-semibold text-[#183722]">
              ChatGPT thinking coach
            </p>
            <p className="mt-2 text-sm leading-6 text-[#425045]">
              Use these prompts to pressure-test the section. The assistant
              should ask for missing facts, decisions, and assumptions instead
              of writing the answer from thin air.
            </p>
            <div className="mt-4 space-y-2">
              {activeSection.questions.map((question) => (
                <div
                  className="rounded-md border border-[#c7d7c2] bg-white px-3 py-2 text-sm leading-5"
                  key={question}
                >
                  {question}
                </div>
              ))}
            </div>
            <button
              className="mt-4 w-full rounded-md bg-[#245b38] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1b472c]"
              onClick={() => navigator.clipboard.writeText(prompt)}
            >
              Copy ChatGPT coaching prompt
            </button>
          </div>

          <div className="rounded-lg border border-[#d8d0c4] bg-white p-4">
            <p className="text-sm font-semibold">Financial addendum</p>
            <p className="mt-2 text-sm leading-6 text-[#5c665f]">
              Keep detailed projections out of the written memo. Attach the
              financial addendum for the 1-year projection, 3-year forecast, key
              leading indicators, and performance metrics.
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              <CheckItem label="Detailed 1-year projection" />
              <CheckItem label="3-year forecast" />
              <CheckItem label="Leading indicators" />
              <CheckItem label="Performance metrics" />
            </div>
          </div>

          <div className="rounded-lg border border-[#d8d0c4] bg-white p-4">
            <p className="text-sm font-semibold">Do not include</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {omittedItems.map((item) => (
                <span
                  className="rounded-full border border-[#dccfc1] bg-[#fbfaf7] px-3 py-1 text-xs font-medium text-[#5f5041]"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-md border border-[#d8d0c4] bg-white ${compact ? "p-3" : "p-4"}`}>
      <p className="text-xs font-semibold uppercase text-[#68736b]">{label}</p>
      <p className="mt-1 text-lg font-semibold capitalize">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#d8d0c4] bg-white p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 text-[#4d5a52]">{children}</div>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const className =
    status === "approved"
      ? "bg-[#245b38]"
      : status === "review"
        ? "bg-[#c9892f]"
        : "bg-[#a7aaa5]";
  return <span className={`h-2.5 w-2.5 rounded-full ${className}`} />;
}

function CheckItem({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[#e2dacf] px-3 py-2">
      <input className="h-4 w-4 accent-[#245b38]" type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
