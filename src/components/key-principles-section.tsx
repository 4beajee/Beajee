"use client";

import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useState } from "react";

export interface Principle {
  title: string;
  desc: string;
}

export interface KeyPrinciplesSectionProps {
  title: string;
  principles: Principle[];
}

export const KeyPrinciplesSection = forwardRef<HTMLElement, KeyPrinciplesSectionProps>(
  ({ title, principles }, ref) => {
    const [activePrinciple, setActivePrinciple] = useState<number | null>(null);

    return (
      <motion.section
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <p className="mb-10 text-center text-[13px] font-semibold uppercase text-neutral-400">
          {title}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {principles.map((principle, index) => (
            <motion.button
              key={principle.title}
              type="button"
              layout
              onClick={() => setActivePrinciple((current) => (current === index ? null : index))}
              aria-expanded={activePrinciple === index}
              className={`h-full rounded-xl border p-5 text-left transition-[border-color,transform,background-color,box-shadow] duration-300 hover:-translate-y-1 sm:p-6 ${activePrinciple === index ? "active-step-sheen border-white/20 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.06)]" : "border-white/[0.08] bg-[#0a0a0a] hover:border-white/[0.14]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className={`text-base font-semibold leading-snug sm:text-lg ${activePrinciple === index ? "active-step-text-sheen" : "text-white"}`}>
                  {principle.title}
                </h3>
                <span
                  className={`mt-0.5 text-xs transition-transform duration-300 ${activePrinciple === index ? "rotate-45 text-white/80" : "text-neutral-500"}`}
                  aria-hidden="true"
                >
                  +
                </span>
              </div>

              <AnimatePresence initial={false}>
                {activePrinciple === index && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 14 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <p className="text-sm text-neutral-400 leading-relaxed">{principle.desc}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.section>
    );
  }
);

KeyPrinciplesSection.displayName = "KeyPrinciplesSection";
