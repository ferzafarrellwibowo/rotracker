import type { RobloxProfileData, APIErrorResponse } from "@/app/types";
import Dashboard from "@/app/components/Dashboard";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";

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
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      {/* Top bar */}
      <nav className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center no-underline transition-opacity duration-150 hover:opacity-80"
        >
          <Image
            src="/roTracker-logo.svg"
            alt="roTracker"
            width={270}
            height={90}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <span className="min-w-0 truncate text-xs text-fg-muted">
          /{username}
        </span>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {error ? (
          <div className="card mx-auto max-w-2xl px-6 py-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="border border-danger-line bg-danger-subtle px-2 py-0.5 text-xs font-medium tracking-wide text-danger">
                ERROR
              </span>
            </div>
            <p className="text-sm text-fg-secondary">
              {error}
            </p>
            <Link
              href="/"
              className="btn btn-secondary btn-sm mt-6"
            >
              ← Back
            </Link>
          </div>
        ) : data ? (
          <Dashboard data={data} />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-4 sm:px-6">
        <span className="label-micro text-fg-muted/70">
          SYSTEM v0.1.0
        </span>
      </footer>
    </div>
  );
}
