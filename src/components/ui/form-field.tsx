"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./app-chrome";

type FieldTone = "default" | "error" | "success";

export function FormField({
  label,
  optional,
  optionalLabel,
  required,
  requiredLabel,
  helperText,
  errorText,
  successText,
  inputId,
  children,
}: {
  label: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  required?: boolean;
  requiredLabel?: string;
  helperText?: ReactNode;
  errorText?: ReactNode;
  successText?: ReactNode;
  inputId: string;
  children: ReactNode;
}) {
  const message = errorText ?? successText ?? helperText;
  const messageId = message ? `${inputId}-message` : undefined;

  return (
    <div className="space-y-2" data-field-message-id={messageId}>
      <label htmlFor={inputId} className="flex min-w-0 items-baseline justify-between gap-3 text-[13px] font-medium leading-5 text-neutral-200">
        <span>{label}</span>
        {optional && <span className="shrink-0 text-xs font-normal text-neutral-500">{optionalLabel}</span>}
        {required && <span className="shrink-0 text-xs font-normal text-neutral-500">{requiredLabel}</span>}
      </label>
      {children}
      {message && (
        <p
          id={messageId}
          className={cx(
            "min-h-5 text-xs leading-5",
            errorText ? "text-red-300" : successText ? "text-emerald-300" : "text-neutral-400"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: FieldTone;
  describedBy?: string;
};

export function TextInput({
  leading,
  trailing,
  tone = "default",
  className,
  disabled,
  describedBy,
  ...props
}: TextInputProps) {
  return (
    <div
      className={cx(
        "group/input flex min-h-[52px] w-full items-center rounded-[10px] bg-neutral-900/90 text-neutral-400 ring-1 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_1px_2px_rgba(0,0,0,0.18)] transition-[background-color,box-shadow,color] duration-200",
        disabled
          ? "cursor-not-allowed bg-neutral-950/55 text-neutral-600 opacity-60 ring-white/[0.07]"
          : tone === "error"
            ? "ring-red-400/55 focus-within:ring-2 focus-within:ring-red-300/80"
            : tone === "success"
              ? "ring-emerald-400/40 focus-within:ring-2 focus-within:ring-emerald-300/70"
              : "ring-white/[0.14] hover:bg-neutral-800/90 hover:ring-white/[0.22] focus-within:bg-neutral-800/95 focus-within:ring-2 focus-within:ring-white/70",
        className
      )}
    >
      {leading && <span className="flex shrink-0 items-center justify-center pl-4 text-neutral-500 group-focus-within/input:text-neutral-300">{leading}</span>}
      <input
        {...props}
        disabled={disabled}
        aria-invalid={tone === "error" || undefined}
        aria-describedby={describedBy}
        className="peer min-h-[52px] min-w-0 flex-1 appearance-none bg-transparent px-4 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgb(38_38_38)_inset]"
      />
      {trailing && <span className="flex min-h-[48px] shrink-0 items-center pr-1.5">{trailing}</span>}
    </div>
  );
}

export function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: Omit<TextInputProps, "type" | "trailing"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-neutral-400 outline-none transition-colors duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        >
          {visible ? hideLabel : showLabel}
        </button>
      }
    />
  );
}

export function useFieldId(prefix = "field") {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}
