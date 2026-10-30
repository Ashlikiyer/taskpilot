"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  H2,
  LEAD,
  SECTION,
  TexturePanel,
} from "@/components/landing/landing-ui";
import { PriorityPill } from "@/components/task-ui";
import type { TaskPriority } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Email box in the hero: carries the address over to the sign-up form. */
export function HeroSignup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  return (
    <form
      className="flex w-full max-w-[440px] flex-wrap justify-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const query = email.trim()
          ? `?email=${encodeURIComponent(email.trim())}`
          : "";
        router.push(`/register${query}`);
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email…"
        aria-label="Your email"
        autoComplete="email"
        className="h-12 min-w-[220px] flex-1 rounded-[11px] border border-[#e0e3e0] px-4 text-[15px] outline-none placeholder:text-[#8a8e93] focus:border-ai focus:ring-3 focus:ring-[#e6e0fc]"
      />
      <button
        type="submit"
        className="h-12 w-full rounded-[11px] bg-primary px-[22px] text-[15px] sm:w-auto font-medium text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.15)] hover:bg-primary/90"
      >
        Start free
      </button>
    </form>
  );
}

const CAPTURE = [
  {
    title: "Quick-add from a sentence",
    body: "Type it the way you would say it. TaskPilot works out the assignee, due date, priority and labels, and flags anything it can’t resolve.",
    demo: {
      label: "QUICK-ADD",
      input: "Ask Mark to send the Acme invoice by Friday, high priority",
      title: "Send Acme invoice",
      chips: ["Mark Reyes", "Fri, Oct 30", "High", "billing"],
      note: "Draft · not saved yet",
    },
  },
  {
    title: "Emails become proposals",
    body: "Connect a Gmail label or a web form. Signatures and quoted replies are removed, then a proposed task waits in your intake inbox.",
    demo: {
      label: "INTAKE · billing@acmecorp.com",
      input:
        "Please reissue the October invoice using PO #4471-B. Our AP closes on the 5th.",
      title: "Reissue October invoice with PO #4471-B",
      chips: ["Finance Ops", "Wed, Nov 4", "High"],
      note: "Confidence 0.91 · accept, edit or reject",
    },
  },
  {
    title: "Import old spreadsheets",
    body: "Upload a CSV or Excel file. The AI maps your columns, tidies values like “WIP” and “P1”, and shows a dry-run before anything is imported.",
    demo: {
      label: "SMART IMPORT · old_tracker.xlsx",
      input: "Stage → status · Urgency → priority · Deadline → due_date",
      title: "248 rows ready to import",
      chips: ["WIP → in_progress", "P1 → urgent", "DD/MM/YYYY"],
      note: "2 values need your review",
    },
  },
];

/** "Capture work the way you already talk about it": an accordion driving the mock. */
export function CaptureSection() {
  const [open, setOpen] = useState(0);
  const id = useId();
  const demo = CAPTURE[open].demo;
  return (
    <section
      id="ai-features"
      aria-labelledby={`${id}-heading`}
      className={cn(
        SECTION,
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 pt-24 md:pt-30",
      )}
    >
      <div className="flex flex-col gap-7">
        <div className="grid gap-3">
          <h2 id={`${id}-heading`} className={H2}>
            Capture work the way you already talk about it
          </h2>
          <p className={cn(LEAD, "max-w-[480px]")}>
            Three ways in, one board. Every suggestion stays a draft until
            someone approves it.
          </p>
        </div>
        <div className="flex flex-col">
          {CAPTURE.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.title}
                className="relative border-b border-[#e8ebe8] py-[18px]"
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${id}-panel-${i}`}
                    onClick={() => setOpen(i)}
                    className={cn(
                      "w-full text-left text-lg tracking-[-0.01em]",
                      isOpen
                        ? "font-semibold text-foreground"
                        : "text-[#55585d] hover:text-foreground",
                    )}
                  >
                    {item.title}
                  </button>
                </h3>
                <div id={`${id}-panel-${i}`} hidden={!isOpen}>
                  <p className="mt-2.5 max-w-[460px] text-[14.5px] leading-relaxed text-[#55585d]">
                    {item.body}
                  </p>
                  <span
                    aria-hidden
                    className="absolute -bottom-px left-0 h-0.5 w-[55%] bg-primary"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TexturePanel className="h-[440px]">
        <div className="absolute top-7 -right-6 -bottom-6 left-7 flex flex-col gap-3.5 rounded-[14px] bg-white p-[18px] shadow-[0_20px_50px_rgba(0,0,0,.18)]">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.05em] text-[#4a32b0]">
            <span className="text-ai">✦</span>
            {demo.label}
          </span>
          <p className="max-w-[440px] rounded-[10px] border-[1.5px] border-ai px-3.5 py-3 text-sm leading-normal shadow-[0_0_0_3px_#ece7fd]">
            {demo.input}
          </p>
          <div className="flex max-w-[440px] flex-col gap-3 rounded-xl border border-[#e3dcfb] bg-ai-wash p-4">
            <span className="text-base font-semibold">{demo.title}</span>
            <span className="flex flex-wrap gap-1.5">
              {demo.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#e8e8e4] bg-white px-2.5 py-[3px] text-xs whitespace-nowrap"
                >
                  {chip}
                </span>
              ))}
            </span>
            <span className="text-xs text-ai-muted">{demo.note}</span>
          </div>
          <span className="flex max-w-[440px] justify-end gap-2 text-[13px]">
            <span className="px-3 py-2 text-[#55585d]">Discard</span>
            <span className="rounded-lg bg-primary px-3.5 py-2 font-medium text-white">
              Confirm &amp; create
            </span>
          </span>
        </div>
      </TexturePanel>
    </section>
  );
}

const BOARD_POINTS = [
  {
    title: "Everyone sees the same board",
    body: "Drag cards between To do, In progress, In review and Done, by mouse, touch or keyboard.",
  },
  {
    title: "Break big tasks into steps",
    body: "Ask the AI for 3–8 subtasks, keep the ones you want, and see progress on each card.",
  },
  {
    title: "Catch the threads that drag on",
    body: "A one-click summary of long comment threads: decisions, open questions and next steps.",
  },
];

const BOARD_ROWS: {
  title: string;
  priority: TaskPriority;
  due: string;
  late?: boolean;
}[] = [
  {
    title: "Fix Lighthouse mobile score",
    priority: "urgent",
    due: "Oct 27",
    late: true,
  },
  { title: "Approve navigation component", priority: "medium", due: "Today" },
  { title: "Draft Q4 email sequence", priority: "high", due: "Today" },
  { title: "Prepare launch checklist", priority: "high", due: "Nov 2" },
];

/** "Boards that keep work moving": mock on the left, highlighted points on the right. */
export function BoardsSection() {
  const [point, setPoint] = useState(0);
  return (
    <section
      id="product"
      aria-labelledby="boards-heading"
      className={cn(
        SECTION,
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 pt-24 md:pt-30",
      )}
    >
      <TexturePanel className="order-last h-[440px] md:order-none">
        <div className="absolute top-7 -right-[30px] -bottom-[30px] left-7 flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,.18)]">
          <span className="text-[13px] font-semibold">Overview</span>
          <div className="grid max-w-[420px] grid-cols-2 gap-2.5">
            <div className="grid gap-0.5 rounded-[10px] border border-[#eceeec] px-3 py-2.5">
              <span className="text-[11px] text-[#77797e]">Due today</span>
              <span className="text-[22px] font-semibold">3</span>
              <span className="text-[10.5px] text-primary">
                2 fewer than yesterday
              </span>
            </div>
            <div className="grid gap-0.5 rounded-[10px] border border-[#eceeec] px-3 py-2.5">
              <span className="text-[11px] text-[#77797e]">In progress</span>
              <span className="text-[22px] font-semibold">15</span>
              <span className="text-[10.5px] text-[#77797e]">
                across 4 projects
              </span>
            </div>
          </div>
          <span className="mt-1 text-xs font-semibold">My Tasks</span>
          {BOARD_ROWS.map((row) => (
            <span
              key={row.title}
              className="flex max-w-[440px] items-center gap-2.5 border-b border-[#f1f2f1] py-2 text-xs"
            >
              <span className="size-3 rounded-full border-[1.5px] border-[#c9ccc9]" />
              <span className="flex-1">{row.title}</span>
              <PriorityPill priority={row.priority} className="text-[10px]" />
              <span
                className={cn(
                  "w-16 text-right",
                  row.late ? "text-overdue" : "text-[#77797e]",
                )}
              >
                {row.due}
              </span>
            </span>
          ))}
        </div>
        <div className="absolute bottom-5 left-5 flex w-[230px] flex-col gap-2 rounded-xl border border-[#e8ebe8] bg-white p-3 shadow-[0_14px_34px_rgba(0,0,0,.16)]">
          <span className="pl-2 text-[12.5px] font-semibold shadow-[inset_2px_0_0_var(--ai)]">
            Intake: 1 new proposal
          </span>
          <span className="text-[11.5px] text-[#6b6e73]">
            Reissue October invoice · confidence 0.91
          </span>
          <span className="flex h-8 items-center justify-center rounded-lg bg-primary text-xs font-medium text-white">
            Review proposal
          </span>
        </div>
      </TexturePanel>

      <div className="flex flex-col gap-6">
        <div className="grid gap-3">
          <h2 id="boards-heading" className={H2}>
            Boards that keep work moving
          </h2>
          <p className={LEAD}>
            Kanban, list and My Tasks views, without clutter or a long setup.
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {BOARD_POINTS.map((item, i) => (
            <li key={item.title}>
              <button
                type="button"
                aria-pressed={point === i}
                onClick={() => setPoint(i)}
                onMouseEnter={() => setPoint(i)}
                className={cn(
                  "grid w-full gap-1.5 rounded-[4px_12px_12px_4px] px-[18px] py-4 text-left",
                  point === i &&
                    "bg-[#f1f9f3] shadow-[inset_3px_0_0_var(--primary)]",
                )}
              >
                <span className="text-base font-semibold">{item.title}</span>
                <span className="text-sm leading-normal text-[#6b6e73]">
                  {item.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Free",
    description: "For trying TaskPilot with a small team.",
    price: ["$0", "$0"],
    per: ["forever", "forever"],
    cta: "Get started free",
    heading: "Includes",
    features: [
      "Up to 5 members",
      "Unlimited projects and tasks",
      "Board, list and My Tasks views",
      "Quick-add with a daily AI limit",
      "Daily digest",
    ],
    popular: false,
  },
  {
    name: "Team",
    description: "For teams that run their work in TaskPilot.",
    price: ["$10", "$8"],
    per: ["/ user / month", "/ user / mo, billed yearly"],
    cta: "Try it free",
    heading: "Everything in Free, plus",
    features: [
      "Up to 25 members",
      "Intake inbox (email and forms)",
      "Smart CSV and Excel import",
      "AI breakdown and thread summaries",
      "Dashboard and workload",
    ],
    popular: true,
  },
  {
    name: "Business",
    description: "For larger teams and client work.",
    price: ["$20", "$16"],
    per: ["/ user / month", "/ user / mo, billed yearly"],
    cta: "Try it free",
    heading: "Everything in Team, plus",
    features: [
      "Unlimited members",
      "Higher AI limits",
      "Viewer access for clients",
      "Activity history on every task",
      "Priority support",
    ],
    popular: false,
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const period = yearly ? 1 : 0;
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className={cn(SECTION, "flex flex-col items-center gap-8 pt-24 md:pt-30")}
    >
      <div className="flex flex-col items-center gap-3.5 text-center">
        <h2
          id="pricing-heading"
          className="text-[clamp(32px,3.8vw,44px)] leading-[1.08] font-semibold tracking-[-0.03em]"
        >
          Start for free. Upgrade later.
        </h2>
        <p className={LEAD}>Simple plans. No per-feature add-ons.</p>
        <div
          role="group"
          aria-label="Billing period"
          className="flex gap-0.5 rounded-[10px] bg-[#f1f2f1] p-[3px]"
        >
          {["Monthly", "Annually"].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={period === i}
              onClick={() => setYearly(i === 1)}
              className={cn(
                "rounded-lg px-4 py-[7px] text-[13px] font-medium",
                period === i ? "bg-primary text-white" : "text-[#55585d]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-[#55585d]">
          Pay annually and get <b className="text-primary">2 months free</b>
        </p>
      </div>
      <ul className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-stretch gap-4">
        {PLANS.map((plan) => (
          <li
            key={plan.name}
            className={cn(
              "flex flex-col gap-[18px] rounded-[18px] border p-6",
              plan.popular
                ? "border-[#cfe6d6] bg-[linear-gradient(#fff_55%,#f1f9f3)]"
                : "border-[#e8ebe8] bg-white",
            )}
          >
            <div className="grid gap-1.5">
              <h3 className="flex items-center gap-2 text-[17px] font-semibold">
                {plan.name}
                {plan.popular && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                    Most popular
                  </span>
                )}
              </h3>
              <p className="text-sm text-[#6b6e73]">{plan.description}</p>
            </div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-[40px] font-semibold tracking-[-0.03em]">
                {plan.price[period]}
              </span>
              <span className="text-[13px] text-[#77797e]">
                {plan.per[period]}
              </span>
            </p>
            <a
              href="/register"
              className="flex h-11 items-center justify-center rounded-[10px] bg-primary text-sm font-medium text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.15)] hover:bg-primary/90"
            >
              {plan.cta}
            </a>
            <span className="h-px bg-[#eceeec]" />
            <span className="text-[13.5px] font-semibold">{plan.heading}</span>
            <ul className="grid gap-2.5">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-[#3d4044]"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-white"
                  >
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="max-w-[560px] text-center text-[13px] text-[#77797e]">
        TaskPilot is a portfolio project, so there&apos;s no billing yet: every
        feature above is free to try today.
      </p>
    </section>
  );
}

const FAQS = [
  {
    q: "What is TaskPilot?",
    a: "A task manager for small teams. AI turns sentences, emails and spreadsheets into draft tasks, and a person always confirms them before they’re saved.",
  },
  {
    q: "Does the AI ever create tasks on its own?",
    a: "No. Every AI output is a draft or proposal until someone on your team accepts it.",
  },
  {
    q: "Can I import from my old tool?",
    a: "Yes. Upload a CSV or Excel export. The AI suggests the column mapping and value cleanup, and you see a dry-run preview before anything is imported.",
  },
  {
    q: "Is there a limit on AI usage?",
    a: "Each person gets 50 AI requests a day, shown in the sidebar. The rest of TaskPilot works normally if you reach it.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Every screen works down to 375px wide, and the board scrolls sideways on small screens.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  const id = useId();
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className={cn(
        SECTION,
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-10 py-24 md:py-30",
      )}
    >
      <h2
        id="faq-heading"
        className="text-[clamp(32px,3.8vw,44px)] leading-[1.08] font-semibold tracking-[-0.03em]"
      >
        Frequently asked questions
      </h2>
      <div className="flex flex-col gap-2">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={item.q}
              className={cn(
                "rounded-xl border px-[18px] py-4",
                isOpen
                  ? "border-[#e8ebe8] bg-white shadow-[0_6px_20px_rgba(0,0,0,.05)]"
                  : "border-transparent bg-[#f6f7f6]",
              )}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-answer-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className={cn(
                    "flex w-full items-center gap-3 text-left text-[15px]",
                    isOpen && "font-semibold",
                  )}
                >
                  <span className="flex-1">{item.q}</span>
                  <span aria-hidden className="text-sm text-[#55585d]">
                    {isOpen ? "↑" : "→"}
                  </span>
                </button>
              </h3>
              <p
                id={`${id}-answer-${i}`}
                hidden={!isOpen}
                className="mt-2 max-w-[560px] text-sm leading-relaxed text-[#6b6e73]"
              >
                {item.a}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
