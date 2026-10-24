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
    <div className="flex w-full max-w-lg flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:flex-row">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter Roblox username or ID..."
        spellCheck={false}
        autoComplete="off"
        aria-label="Roblox username or ID"
        className="input flex-1"
      />
      <button
        type="submit"
        disabled={isLoading || query.trim().length < 3}
        className="btn btn-primary h-11 min-w-[120px] px-6"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background"></div>
          </div>
        ) : (
          "Scan"
        )}
      </button>
      </form>
      {isLoading && (
        <div className="animate-pulse text-center text-xs text-fg-secondary" role="status">
          Analyzing user profile... this may take up to a minute.
        </div>
      )}
    </div>
  );
}
