"use client";

import { useState, type ReactNode } from "react";

interface AccordionProps {
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-4 px-4 py-3 text-fg transition-colors duration-150 hover:bg-surface-elevated focus-visible:outline-offset-[-2px]"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-3">
          <span className="text-base text-fg-muted" aria-hidden="true">
            {icon}
          </span>
          <span className="text-sm font-medium tracking-tight">
            {title}
          </span>
        </span>
        <span className="text-xs text-fg-muted">
          {isOpen ? "Collapse ←" : "Expand →"}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
