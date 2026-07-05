export default function Loading() {
  return (
    <div className="flex flex-col flex-1 bg-[#000000] min-h-screen">
      {/* Top bar placeholder */}
      <nav className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
        <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#e5e5e5]">
          roTracker
        </div>
      </nav>

      {/* Loading Content */}
      <main className="flex-1 py-12 px-4 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center max-w-md w-full border border-[#333] bg-[#0a0a0a] p-8 shadow-2xl">
          <div className="w-10 h-10 border-2 border-[#333] border-t-[#fff] rounded-full animate-spin mb-6"></div>
          <h2 className="text-[#e5e5e5] text-sm uppercase tracking-widest font-medium mb-3">
            Scanning Target...
          </h2>
          <p className="text-[#888] text-xs font-[family-name:var(--font-jetbrains-mono)] text-center mb-6">
            Connecting to Roblox servers and compiling data.
            This process requires deep inspection and might take some time depending on the target's history.
          </p>
          <div className="w-full bg-[#111] h-1 border border-[#333] overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-1/3 bg-[#444] animate-[slide_1.5s_ease-in-out_infinite]"></div>
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
