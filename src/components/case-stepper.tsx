"use client";

import { useState } from "react";

export type StepperStep = {
  id: "evidence" | "findings" | "facts" | "report";
  label: string;
  detail: string;
  complete: boolean;
};

export function CaseStepper({ steps }: { steps: StepperStep[] }) {
  const [active, setActive] = useState<StepperStep["id"]>(
    steps.find((step) => !step.complete)?.id ?? steps[steps.length - 1].id,
  );

  return (
    <nav
      aria-label="Case workflow"
      className="sticky top-0 z-30 -mx-6 mt-6 border-y border-line bg-paper/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-paper/85"
    >
      <ol className="grid grid-cols-4 gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const current = active === step.id;
          return (
            <li key={step.id} className="min-w-0">
              <a
                href={`#${step.id}`}
                aria-current={current ? "step" : undefined}
                onClick={() => setActive(step.id)}
                className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition sm:gap-2 sm:px-3 ${
                  current ? "bg-brand-soft ring-1 ring-brand/20" : "hover:bg-[#fbfaf5]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[10.5px] font-semibold ${
                    step.complete
                      ? "border-brand bg-brand text-white"
                      : current
                        ? "border-brand bg-card text-brand"
                        : "border-line bg-card text-muted"
                  }`}
                >
                  {step.complete ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[10px] font-semibold sm:text-[11.5px] ${current ? "text-brand-dark" : "text-body"}`}>
                    {step.label}
                  </span>
                  <span className="block truncate text-[9px] text-muted sm:text-[10px]">{step.detail}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
