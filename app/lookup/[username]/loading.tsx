import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      {/* Top bar placeholder */}
      <nav className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center">
          <Image
            src="/roTracker-logo.svg"
            alt="roTracker"
            width={270}
            height={90}
            priority
            className="h-7 w-auto"
          />
        </div>
      </nav>

      {/* Loading Content */}
      <main className="bg-grid flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="card flex w-full max-w-md flex-col items-center p-8" role="status" aria-live="polite">
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent"></div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-fg">
            Scanning Target...
          </h2>
          <p className="mb-6 text-center text-[13px] leading-relaxed text-fg-secondary">
            Connecting to Roblox servers and compiling data.
            This process requires deep inspection and might take some time depending on the target&apos;s history.
          </p>
          <div className="relative h-1 w-full overflow-hidden bg-surface-elevated">
            <div className="absolute left-0 top-0 h-full w-1/3 bg-accent/70 animate-[slide_1.5s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}} />
    </div>
  );
}
