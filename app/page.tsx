import Image from "next/image";
import SearchBar from "./components/SearchBar";

export default function Home() {
  return (
    <div className="bg-grid flex flex-col flex-1 items-center justify-center bg-background">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-4 py-16 sm:px-6">
        {/* Title */}
        <div className="flex flex-col items-center gap-1 text-center sm:gap-2">
          <h1 className="flex items-center justify-center">
            <Image
              src="/roTracker-logo.svg"
              alt="roTracker"
              width={540}
              height={180}
              priority
              className="h-16 w-auto sm:h-20"
            />
            <span className="sr-only">roTracker</span>
          </h1>
          <p className="label-micro text-fg-secondary">
            Roblox Profile Background Checker
          </p>
        </div>

        {/* Divider */}
        <div className="h-px w-48 bg-border" />

        {/* Search */}
        <SearchBar />

        {/* Instructions */}
        <div className="max-w-sm text-center text-[13px] leading-relaxed text-fg-muted">
          Enter a Roblox username to scan account age, connections, group
          membership, inventory, and generate an AI suspicion rating.
        </div>

        {/* Footer */}
        <div className="label-micro mt-12 text-fg-muted/70">
          SYSTEM v0.1.0
        </div>
      </main>
    </div>
  );
}
