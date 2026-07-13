const audienceCards = [
  {
    title: "Business Team",
    href: "/business-team",
    body: "Create the source draft, manage workflow choices, and explicitly share the plan for review.",
  },
  {
    title: "Enablement",
    href: "/enablement",
    body: "Read the shared plan, ask questions, and capture support needs once review begins.",
  },
  {
    title: "General",
    href: "/general",
    body: "Access the shared general-read version of the business plan after review sharing.",
  },
  {
    title: "Approver",
    href: "/approver",
    body: "Review the shared business plan once the business team has moved it into review.",
  },
];

export default function Home() {
  return (
    <main className="entry-page min-h-screen bg-[#f7f5ef] text-[#161712]">
      <section className="entry-shell mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <div className="entry-brand-row">
          <div className="brand-mark" role="img" aria-label="Prologis" />
          <div>
            <p className="eyebrow">2027 Business Plan</p>
            <h1>Choose your workflow</h1>
          </div>
        </div>

        <div className="entry-grid" aria-label="Audience workflows">
          {audienceCards.map((card) => (
            <a key={card.title} className="entry-card" href={card.href}>
              <span>{card.title}</span>
              <p>{card.body}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
