"use client";

import { forwardRef } from "react";

interface MatchExampleSectionProps {
  title: string;
  agentA: string;
  agentAQuote: string;
  negotiating: string;
  agentB: string;
  agentBQuote: string;
  matchResultQuote: string;
}

export const MatchExampleSection = forwardRef<HTMLElement, MatchExampleSectionProps>(
  ({
    title,
    agentA,
    agentAQuote,
    negotiating,
    agentB,
    agentBQuote,
    matchResultQuote,
  }, ref) => {
    return (
      <section ref={ref} className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-10 text-center text-[13px] font-semibold uppercase text-neutral-400">
          {title}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-0 animate-detail-in">
          <div className="min-h-[140px] flex-1 rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-6">
            <p className="text-xs uppercase text-neutral-500">{agentA}</p>
            <p className="font-mono text-sm text-neutral-400 mt-3 leading-relaxed break-words">
              {agentAQuote}
            </p>
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-center sm:w-40 opacity-70">
            <div className="sm:hidden flex flex-col items-center gap-2 py-3">
              <div className="w-px h-5 border-l border-dashed border-[#2a2a2a]" />
              <span className="font-mono text-xs text-neutral-500">
                {negotiating}
                <span className="inline-flex">
                  <span className="animate-dot-blink">.</span>
                  <span className="animate-dot-blink" style={{ animationDelay: "0.2s" }}>.</span>
                  <span className="animate-dot-blink" style={{ animationDelay: "0.4s" }}>.</span>
                </span>
              </span>
              <div className="w-px h-5 border-l border-dashed border-[#2a2a2a]" />
            </div>
            <div className="hidden sm:flex items-center w-full">
              <div className="flex-1 border-t border-dashed border-[#2a2a2a]" />
              <span className="whitespace-nowrap px-3 font-mono text-xs text-neutral-500">
                {negotiating}
                <span className="inline-flex">
                  <span className="animate-dot-blink">.</span>
                  <span className="animate-dot-blink" style={{ animationDelay: "0.2s" }}>.</span>
                  <span className="animate-dot-blink" style={{ animationDelay: "0.4s" }}>.</span>
                </span>
              </span>
              <div className="flex-1 border-t border-dashed border-[#2a2a2a]" />
            </div>
          </div>

          <div className="min-h-[140px] flex-1 rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-6">
            <p className="text-xs uppercase text-neutral-500">{agentB}</p>
            <p className="font-mono text-sm text-neutral-400 mt-3 leading-relaxed break-words">
              {agentBQuote}
            </p>
          </div>
        </div>

        <div className="animate-detail-in animate-detail-in-d2 mt-6 min-h-[80px] rounded-xl border border-white/[0.10] bg-[#111] p-5 font-mono text-sm leading-6 text-neutral-300 transition-transform duration-300 hover:-translate-y-1 sm:mt-8 sm:p-6">
          {matchResultQuote}
        </div>
      </section>
    );
  }
);

MatchExampleSection.displayName = "MatchExampleSection";
