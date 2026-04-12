"use client";

import React from "react";

/**
 * PageContainer — consistent horizontal padding + max-width.
 * Use for all top-level page content areas.
 */
export function PageContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full px-[var(--page-pad-x)] max-w-[var(--container-max,80rem)] mx-auto ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * ScrollableTabs — horizontal scrolling chip/tab rail for filters.
 * Hides the scrollbar while preserving functionality.
 */
export function ScrollableTabs({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto no-scrollbar -mx-[var(--page-pad-x)] px-[var(--page-pad-x)] pb-1 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * BottomSafeArea — adds padding that accounts for the phone's safe area
 * (notch / home indicator) plus optional extra space.
 */
export function BottomSafeArea({ className = "" }: { className?: string }) {
  return <div className={`pb-safe ${className}`} aria-hidden="true" />;
}

/**
 * MobileDialogSheet — renders as a bottom sheet on phone (<640px)
 * and as a centered modal on sm+.
 * Drop this around your modal content; backdrop is included.
 */
export function MobileDialogSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet / Dialog */}
      <div className="relative z-10 w-full sm:max-w-2xl sm:w-full sm:mx-4">
        {/* Bottom sheet drag handle (phone only) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-700" />
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto">
          {children}
        </div>
        {/* Extra padding for home-indicator on phone */}
        <div className="sm:hidden pb-safe bg-[#0a0a0a]" />
      </div>
    </div>
  );
}

/**
 * StackOrRow — stacks children vertically on phone, horizontal on sm+.
 */
export function StackOrRow({
  children,
  className = "",
  gap = "gap-3",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row ${gap} ${className}`}>
      {children}
    </div>
  );
}
