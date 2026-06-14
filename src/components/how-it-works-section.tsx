"use client";

import { forwardRef, type MouseEvent } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";

interface Step {
  num: string;
  title: string;
  desc: string;
}

interface HowItWorksSectionProps {
  title: string;
  steps: Step[];
}

function SpotlightCard({ step }: { step: Step }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="group relative h-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-5 sm:p-6"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.06),
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <div className="text-3xl font-semibold text-[#242424] transition-colors duration-300 group-hover:text-[#4a4a4a]">{step.num}</div>
        <h3 className="text-base font-medium text-white mt-3 sm:mt-4">{step.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-neutral-400 sm:mt-3">{step.desc}</p>
      </div>
    </div>
  );
}

export const HowItWorksSection = forwardRef<HTMLElement, HowItWorksSectionProps>(
  ({ title, steps }, ref) => {
    return (
      <section ref={ref} className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-10 text-center text-[13px] font-semibold uppercase text-neutral-400">
          {title}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
              className="h-full"
            >
              <SpotlightCard step={step} />
            </motion.div>
          ))}
        </div>
      </section>
    );
  }
);

HowItWorksSection.displayName = "HowItWorksSection";
