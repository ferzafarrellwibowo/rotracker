import SearchBar from "./components/SearchBar";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-[#000000]">
      <main className="flex flex-col items-center gap-8 px-4">
        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-[family-name:var(--font-jetbrains-mono)] text-3xl tracking-tight text-[#e5e5e5]">
            roTracker
          </h1>
          <p className="text-sm text-[#666] uppercase tracking-widest">
            Roblox Profile Background Checker
          </p>
        </div>

        {/* Divider */}
        <div className="w-48 h-px bg-[#333]" />

        {/* Search */}
        <SearchBar />

        {/* Instructions */}
        <div className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#444] text-center max-w-sm leading-relaxed">
          Enter a Roblox username to scan account age, connections, group
          membership, inventory, and generate an AI suspicion rating.
        </div>

        {/* Footer */}
        <div className="mt-12 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#333]">
          SYSTEM v0.1.0
        </div>
      </main>
    </div>
  );
}
