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
    <div className="border border-[#333] rounded-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#111] text-[#e5e5e5] cursor-pointer select-none rounded-none border-none outline-none"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-base">
            {icon}
          </span>
          <span className="text-sm font-medium tracking-wide uppercase">
            {title}
          </span>
        </span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#888]">
          {isOpen ? "Collapse ←" : "Expand →"}
        </span>
      </button>
      {isOpen && (
        <div className="bg-[#0a0a0a] px-4 py-4 border-t border-[#333]">
          {children}
        </div>
      )}
    </div>
  );
}
