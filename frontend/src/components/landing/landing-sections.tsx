/**
 * The public landing page (from the "TaskPilot Landing v2" design). Static
 * sections live here; the interactive ones (tabs, pricing toggle, FAQ, sign-up)
 * are in landing-interactive.tsx.
 */
import Image from "next/image";
import Link from "next/link";

import { HeroSignup } from "@/components/landing/landing-interactive";
import {
  DEMO_LOGIN,
  GITHUB_URL,
  H2,
  LEAD,
  Logo,
  SECTION,
  TexturePanel,
} from "@/components/landing/landing-ui";
import { PriorityPill } from "@/components/task-ui";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const links = [
    ["Product", "#product"],
    ["AI features", "#ai-features"],
    ["Teams", "#teams"],
    ["Pricing", "#pricing"],
    ["FAQ", "#faq"],
  ];
  return (
    <header className={cn(SECTION, "flex items-center gap-8 py-[18px]")}>
      <Link href="/" aria-label="TaskPilot home">
        <Logo />
      </Link>
      <nav
        aria-label="Sections"
        className="hidden gap-[26px] text-sm text-[#4a4d52] md:flex"
      >
        {links.map(([label, href]) => (
          <a key={href} href={href} className="hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-[10px] border border-[#e3e6e3] px-3.5 py-2 text-sm whitespace-nowrap hover:bg-muted"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-[10px] bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,.15)] hover:bg-primary/90"
        >
          Start free
        </Link>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading">
      <div
        className={cn(
          SECTION,
          "flex flex-col items-center gap-[22px] pt-12 text-center md:pt-16",
        )}
      >
        <span className="flex items-center gap-2 rounded-full border border-[#d7ebdd] bg-[#f3faf5] py-1 pr-3 pl-1.5 text-[12.5px] font-medium text-success-ink">
          <span
            aria-hidden
            className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] text-white"
          >
            ✦
          </span>
          AI drafts the tasks. Your team confirms them.
        </span>
        <h1
          id="hero-heading"
          className="max-w-[880px] text-[clamp(40px,5.6vw,68px)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance"
        >
          Turn plain sentences into tasks your whole team can track
        </h1>
        <p className="max-w-[600px] text-[17px] leading-relaxed text-pretty text-[#55585d]">
          Quick-add from a sentence, turn emails into proposals, and import old
          spreadsheets. TaskPilot keeps small teams organised without the setup.
        </p>
        <HeroSignup />
        <p className="text-[13px] text-[#77797e]">
          Free to try.{" "}
          <Link href={DEMO_LOGIN} className="text-primary underline">
            Explore the live demo
          </Link>{" "}
          with no sign-up.
        </p>
      </div>

      <div
        className={cn(SECTION, "flex flex-wrap items-stretch gap-3.5 pt-12")}
      >
        {/* Team photo with a stat card */}
        <div className="relative min-h-80 flex-[1_1_260px] overflow-hidden rounded-[18px]">
          <Image
            src="/landing/team.jpg"
            alt="A small team working together at laptops"
            fill
            sizes="(min-width: 1024px) 300px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-3.5 bottom-3.5 grid gap-1 rounded-[14px] bg-white/95 p-3.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <span
                aria-hidden
                className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] text-white"
              >
                ✓
              </span>
              Completed this week
            </span>
            <span className="text-[26px] font-semibold tracking-[-0.02em]">
              17{" "}
              <span className="text-sm font-normal text-[#55585d]">tasks</span>
            </span>
            <span className="text-xs font-medium text-primary">
              +4 vs last week
            </span>
          </div>
          <a
            href="https://unsplash.com/@anniespratt"
            className="absolute top-2 right-3 text-[10px] text-white/80 hover:text-white"
          >
            Photo: Annie Spratt / Unsplash
          </a>
        </div>

        {/* Draft card + digest card */}
        <div aria-hidden className="flex flex-[1_1_260px] flex-col gap-3.5">
          <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-[#e8ebe8] bg-white p-4">
            <span className="flex items-center gap-2">
              <PriorityPill priority="high" />
              <span className="ml-auto rounded-full bg-ai-soft px-[7px] py-0.5 text-[10.5px] font-medium whitespace-nowrap text-ai">
                ✦ AI draft
              </span>
            </span>
            <span className="text-base font-semibold">Send Acme invoice</span>
            <span className="text-[12.5px] leading-normal text-[#6b6e73]">
              Created from “Ask Mark to send the Acme invoice by Friday, high
              priority”.
            </span>
            <span className="mt-auto flex items-center gap-2.5 border-t border-dashed border-[#eceeec] pt-2.5 text-xs text-[#77797e]">
              <span className="flex size-[22px] items-center justify-center rounded-full bg-[#fbe9e3] text-[9px] font-semibold text-[#a84a2a]">
                MR
              </span>
              <span className="ml-auto">Due Fri, Oct 30</span>
            </span>
          </div>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#e8ebe8] bg-white p-4">
            <span className="pl-2.5 text-[13px] font-semibold shadow-[inset_2px_0_0_var(--primary)]">
              Daily digest · 8:00 AM
            </span>
            <span className="text-[12.5px] text-[#55585d]">
              2 overdue · 3 due today · 1 at risk
            </span>
            <span className="flex h-[38px] items-center justify-center rounded-[9px] bg-primary text-[13px] font-medium text-white">
              Open my tasks
            </span>
          </div>
        </div>

        {/* App window on the green panel */}
        <TexturePanel className="h-[340px] min-w-0 flex-[2_1_480px]">
          <div className="absolute top-6 -right-10 -bottom-10 left-6 flex overflow-hidden rounded-[14px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.18)]">
            <div className="flex w-[150px] shrink-0 flex-col gap-1 border-r border-[#eceeec] px-2.5 py-3 text-[11.5px] text-[#55585d]">
              <span className="flex items-center gap-[7px] pb-2">
                <span className="flex size-[22px] items-center justify-center rounded-md bg-primary text-[10px] text-white">
                  ✦
                </span>
                <span className="font-semibold whitespace-nowrap text-foreground">
                  Acme Studio
                </span>
              </span>
              {[
                "Board",
                "My Tasks",
                "Daily digest",
                "Intake inbox",
                "Dashboard",
              ].map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    "rounded-md px-[7px] py-[5px]",
                    i === 0 && "bg-success-soft font-semibold text-success-ink",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 bg-[#fafbfa] p-3">
              <span className="text-[13px] font-semibold">
                Website Relaunch
              </span>
              <div className="grid grid-cols-[repeat(2,minmax(150px,1fr))] gap-2.5">
                {MINI_COLUMNS.map((column) => (
                  <div key={column.name} className="flex flex-col gap-2">
                    <span
                      className="rounded-lg border border-[#eceeec] bg-white px-2 py-1.5 text-[11.5px] font-semibold"
                      style={{ boxShadow: `inset 0 2px 0 ${column.dot}` }}
                    >
                      {column.name}
                    </span>
                    {column.cards.map((card) => (
                      <div
                        key={card.title}
                        className="flex flex-col gap-[5px] rounded-[9px] border border-[#eceeec] bg-white p-[9px]"
                      >
                        <PriorityPill
                          priority={card.priority}
                          className="px-1.5 text-[9.5px]"
                        />
                        <span className="text-[11.5px] font-semibold">
                          {card.title}
                        </span>
                        <span className="text-[10.5px] text-[#8a8e93]">
                          {card.note}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TexturePanel>
      </div>
    </section>
  );
}

const MINI_COLUMNS = [
  {
    name: "To do",
    dot: "#a1a1a6",
    cards: [
      { title: "Review pricing copy", priority: "medium", note: "Tomorrow" },
      { title: "Set up 301 redirects", priority: "high", note: "Nov 3" },
    ],
  },
  {
    name: "In progress",
    dot: "#3b6fe0",
    cards: [
      { title: "Fix Lighthouse score", priority: "urgent", note: "Overdue" },
      { title: "Launch checklist", priority: "high", note: "2/5 subtasks" },
    ],
  },
] as const;

const ORBIT = [
  ["KA", "#e6e1fb", "#4a32b0", "14%", "12%"],
  ["MR", "#fbe9e3", "#a84a2a", "46%", "6%"],
  ["JS", "#e2ecfb", "#2a55b8", "76%", "14%"],
  ["PC", "#e3f3ea", "#22744a", "12%", "70%"],
  ["AL", "#fcefd9", "#8a5a10", "46%", "76%"],
  ["RB", "#f0e4f7", "#7a3a9a", "78%", "68%"],
];

const WORKLOAD = [
  ["Ana Lim", "40%"],
  ["Paolo Cruz", "62%"],
  ["Jen Santos", "90%"],
  ["Mark Reyes", "70%"],
  ["Kurt Alvarez", "50%"],
];

function TeamCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-[#f6f7f6] p-[18px]">
      <div
        aria-hidden
        className="relative h-[220px] overflow-hidden rounded-[14px] bg-white"
      >
        {children}
      </div>
      <div className="grid gap-1.5 px-1 pb-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm leading-normal text-[#6b6e73]">{body}</p>
      </div>
    </div>
  );
}

export function TeamSection() {
  return (
    <section
      id="teams"
      aria-labelledby="teams-heading"
      className={cn(
        SECTION,
        "flex flex-col items-center gap-10 pt-24 md:pt-30",
      )}
    >
      <div className="grid max-w-[620px] gap-3 text-center">
        <h2 id="teams-heading" className={H2}>
          Keep the whole team on the same page
        </h2>
        <p className={LEAD}>
          Mentions, notifications and a morning digest in each person&apos;s own
          timezone.
        </p>
      </div>
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        <TeamCard
          title="Roles that make sense"
          body="Owner, Admin, Member and Viewer. Invite people with a link that expires after 7 days."
        >
          <div className="flex h-full items-center justify-center">
            <span className="absolute size-[150px] rounded-full bg-success-soft" />
            <span className="absolute size-24 rounded-full bg-[#d4ecdc]" />
            <span className="relative flex size-12 items-center justify-center rounded-full bg-primary text-lg text-white">
              ✦
            </span>
            {ORBIT.map(([initials, bg, fg, x, y]) => (
              <span
                key={initials}
                className="absolute flex size-[34px] items-center justify-center rounded-full border-[3px] border-white text-[11px] font-semibold shadow-[0_2px_6px_rgba(0,0,0,.08)]"
                style={{ left: x, top: y, backgroundColor: bg, color: fg }}
              >
                {initials}
              </span>
            ))}
          </div>
        </TeamCard>
        <TeamCard
          title="See the workload"
          body="The dashboard shows open tasks by status and by person, so no one quietly gets overloaded."
        >
          <div className="flex h-full flex-col justify-between px-7 py-4">
            {WORKLOAD.map(([name, width], i) => {
              const focus = i === 2;
              return (
                <div
                  key={name}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-1",
                    focus
                      ? "scale-[1.06] bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,.1)]"
                      : "opacity-55",
                  )}
                >
                  <span className="w-[70px] text-[11px] text-[#55585d]">
                    {name}
                  </span>
                  <span className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-[#edf0ed]">
                    <span
                      className={cn(
                        "block h-full",
                        focus ? "bg-primary" : "bg-[#a8d8b6]",
                      )}
                      style={{ width }}
                    />
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      focus && "font-semibold",
                    )}
                  >
                    {width}
                  </span>
                </div>
              );
            })}
          </div>
        </TeamCard>
        <TeamCard
          title="On time, in every timezone"
          body="Due dates and digests follow each member's timezone, whether they're in Manila or Berlin."
        >
          <div className="flex items-center gap-2.5 border-b border-[#eceeec] px-3.5 py-2.5 text-[11px] text-[#77797e]">
            <span className="font-mono">PHT +8</span>
            <span className="font-semibold text-foreground">Thu, 29 Oct</span>
            <span className="ml-auto">Fri</span>
          </div>
          <span className="absolute inset-x-0 top-[76px] h-0.5 bg-primary" />
          <span className="absolute top-[70px] left-[46%] size-2.5 rounded-full border-2 border-primary bg-white" />
          <div className="absolute top-[104px] right-3.5 left-[30%] grid gap-[5px] rounded-[10px] border border-[#e8ebe8] bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,.08)]">
            <span className="pl-2 text-xs font-semibold shadow-[inset_2px_0_0_#3b6fe0]">
              Daily digest ready
            </span>
            <span className="text-[11px] text-[#77797e]">
              8:00 AM · 2 overdue, 3 due today
            </span>
            <span className="flex gap-[5px]">
              {["In-app", "Bell"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-[#eceeec] px-[7px] text-[10px]"
                >
                  {chip}
                </span>
              ))}
            </span>
          </div>
        </TeamCard>
      </div>
    </section>
  );
}

const FEATURES = [
  [
    "✦",
    "#6847e0",
    "AI that asks first",
    "Every suggestion is a draft with a clear warning when something is missing or unclear.",
  ],
  [
    "▦",
    "#23864a",
    "Kanban that stays fast",
    "Drag-and-drop between four statuses, with filters for assignee, priority, label and due date.",
  ],
  [
    "✉",
    "#3b6fe0",
    "Inbox for outside requests",
    "Client emails and form submissions become proposals your team can review.",
  ],
  [
    "⇪",
    "#d97a1f",
    "Move off spreadsheets",
    "Smart CSV and Excel import with AI column mapping and a dry-run preview.",
  ],
  [
    "◷",
    "#c98a12",
    "A digest every morning",
    "Overdue, due today and at-risk tasks, ready at 8 AM in your own timezone.",
  ],
  [
    "▯",
    "#c0478a",
    "Works on any screen",
    "Responsive down to 375px, so you can triage the board from your phone.",
  ],
];

export function FeatureGrid() {
  return (
    <section
      aria-labelledby="features-heading"
      className={cn(
        SECTION,
        "flex flex-col items-center gap-10 pt-24 md:pt-30",
      )}
    >
      <div className="grid max-w-[620px] gap-3 text-center">
        <h2 id="features-heading" className={H2}>
          Built for small teams that move fast
        </h2>
        <p className={LEAD}>
          Works for agencies, studios and in-house teams, on desktop or a phone.
        </p>
      </div>
      <ul className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
        {FEATURES.map(([icon, color, title, body]) => (
          <li
            key={title}
            className="flex flex-col gap-3.5 rounded-2xl border border-[#e8ebe8] bg-white p-5"
          >
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-[10px] border border-[#e8ebe8]"
            >
              <span
                className="flex size-[22px] items-center justify-center rounded-md text-[11px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {icon}
              </span>
            </span>
            <span className="grid gap-1.5">
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-sm leading-normal text-[#6b6e73]">{body}</p>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The design's fading pixel strip: a seeded pattern, so it's the same every render. */
function pixelOpacities(): number[] {
  let seed = 7;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 200 }, (_, i) => {
    const row = Math.floor(i / 40);
    return random() < 0.25 + row * 0.14 ? 0.3 + random() * 0.7 : 0;
  });
}

export function CallToAction() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="relative overflow-hidden bg-[linear-gradient(#f9fdf9,#eef9ef)]"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 grid h-[130px] grid-cols-[repeat(40,1fr)] auto-rows-[26px] gap-0.5 opacity-90"
      >
        {pixelOpacities().map((opacity, i) => (
          <span key={i} className="bg-[#cdeec9]" style={{ opacity }} />
        ))}
      </div>
      <div className="relative flex flex-col items-center gap-4 px-6 pt-24 pb-[170px] text-center">
        <div aria-hidden className="flex gap-[18px] text-[13px] text-[#3d4044]">
          {["✦", "▦", "✉"].map((icon) => (
            <span
              key={icon}
              className="flex size-7 items-center justify-center rounded-lg border border-[#e3e6e3] bg-white"
            >
              {icon}
            </span>
          ))}
        </div>
        <h2
          id="cta-heading"
          className="text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em]"
        >
          Get started with TaskPilot
        </h2>
        <p className={cn(LEAD, "max-w-[440px]")}>
          Go from a sentence to a shared board in under a minute.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/register"
            className="rounded-[10px] bg-primary px-[18px] py-[11px] text-sm font-medium text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.15)] hover:bg-primary/90"
          >
            Start free
          </Link>
          <Link
            href={DEMO_LOGIN}
            className="rounded-[10px] border border-[#e3e6e3] bg-white px-[18px] py-[11px] text-sm font-medium hover:bg-muted"
          >
            Try the demo account
          </Link>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS: { heading: string; links: [string, string][] }[] = [
  {
    heading: "Product",
    links: [
      ["Board", "#product"],
      ["Quick-add", "#ai-features"],
      ["Intake inbox", "#ai-features"],
      ["Smart import", "#ai-features"],
    ],
  },
  {
    heading: "Try it",
    links: [
      ["Live demo", DEMO_LOGIN],
      ["Create an account", "/register"],
      ["Sign in", "/login"],
    ],
  },
  {
    heading: "Project",
    links: [
      ["Source on GitHub", GITHUB_URL],
      ["Pricing", "#pricing"],
      ["FAQ", "#faq"],
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#202221] text-[#c9ccca]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-11 px-6 pt-12 pb-7">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="grid max-w-[420px] gap-1.5">
            <p className="text-base font-semibold text-white">
              Want to see how it&apos;s built?
            </p>
            <p className="text-[13.5px] leading-normal">
              The code, the tests and an honest log of how AI was used to build
              it are all on GitHub.
            </p>
          </div>
          <a
            href={GITHUB_URL}
            className="flex h-[42px] items-center rounded-[9px] bg-primary px-4 text-[13.5px] font-medium whitespace-nowrap text-white hover:bg-primary/90"
          >
            View the code on GitHub
          </a>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-8">
          <div className="grid content-start gap-4">
            <Logo className="[&>span:last-child]:text-[17px] [&>span:last-child]:text-white" />
            <p className="text-[13px] leading-normal">
              AI task management for small teams.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="grid content-start gap-3 text-[13px]"
            >
              <span className="font-medium text-white">{column.heading}</span>
              {column.links.map(([label, href]) => (
                <a key={label} href={href} className="hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-[#333534] pt-5 text-[12.5px] text-[#8a8d8b]">
          <span>© 2026 TaskPilot. A portfolio project.</span>
          <span>Built with Next.js, FastAPI and Postgres.</span>
        </div>
      </div>
    </footer>
  );
}
