import type { RobloxProfileData, APIErrorResponse } from "@/app/types";
import Dashboard from "@/app/components/Dashboard";
import { headers } from "next/headers";
import Link from "next/link";

async function fetchProfile(
  username: string
): Promise<{ data: RobloxProfileData | null; error: string | null }> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") ?? "http";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(
      `${baseUrl}/api/roblox/${encodeURIComponent(username)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as APIErrorResponse | null;
      return { data: null, error: body?.error ?? `HTTP ${res.status}` };
    }

    const data = (await res.json()) as RobloxProfileData;
    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to connect to API." };
  }
}

export default async function LookupPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { data, error } = await fetchProfile(username);

  return (
    <div className="flex flex-col flex-1 bg-[#000000] min-h-screen">
      {/* Top bar */}
      <nav className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
        <Link
          href="/"
          className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#e5e5e5] no-underline hover:text-[#fff]"
        >
          roTracker
        </Link>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#555]">
          /{username}
        </span>
      </nav>

      {/* Content */}
      <main className="flex-1 py-6 px-4">
        {error ? (
          <div className="max-w-2xl mx-auto border border-[#333] rounded-none bg-[#111] px-4 py-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#ef4444]">
                ERROR
              </span>
            </div>
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#999]">
              {error}
            </p>
            <Link
              href="/"
              className="inline-block mt-4 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#888] border border-[#333] px-3 py-1.5 rounded-none no-underline hover:bg-[#1a1a1a]"
            >
              ← Back
            </Link>
          </div>
        ) : data ? (
          <Dashboard data={data} />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-[#222]">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#333]">
          SYSTEM v0.1.0
        </span>
      </footer>
    </div>
  );
}
