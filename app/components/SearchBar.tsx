"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return;
    setIsLoading(true);
    router.push(`/lookup/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="flex flex-col w-full max-w-lg gap-3">
      <form onSubmit={handleSubmit} className="flex w-full gap-0">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter Roblox username or ID..."
        spellCheck={false}
        autoComplete="off"
        className="flex-1 px-4 py-3 bg-[#111] border border-[#333] border-r-0 rounded-none text-[#e5e5e5] font-[family-name:var(--font-jetbrains-mono)] text-sm placeholder-[#555] outline-none focus:border-[#555]"
      />
      <button
        type="submit"
        disabled={isLoading || query.trim().length < 3}
        className="px-6 py-3 min-w-[120px] bg-[#222] border border-[#333] rounded-none text-[#e5e5e5] font-[family-name:var(--font-jetbrains-mono)] text-sm uppercase tracking-wider flex justify-center items-center cursor-pointer hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#888] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          "Scan"
        )}
      </button>
      </form>
      {isLoading && (
        <div className="text-[#888] font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-center animate-pulse">
          Analyzing user profile... this may take up to a minute.
        </div>
      )}
    </div>
  );
}
