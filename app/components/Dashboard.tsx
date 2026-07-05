"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { RobloxProfileData } from "@/app/types";
import { LineChart, Line, XAxis, ResponsiveContainer, CartesianGrid, YAxis } from 'recharts';

// ─── Sub-components ───────────────────────────────────────

function Section({
  title,
  icon,
  children,
  headerRight,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="border border-[#333] rounded-none">
      <div className="w-full flex justify-between items-center px-4 py-3 bg-[#111] text-[#e5e5e5] rounded-none border-none">
        <span className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-base">
            {icon}
          </span>
          <span className="text-sm font-medium tracking-wide uppercase">
            {title}
          </span>
        </span>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="bg-[#0a0a0a] px-4 py-4 border-t border-[#333]">
        {children}
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono = false,
  isBlock = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  isBlock?: boolean;
}) {
  return (
    <div
      className={`flex py-1.5 border-b border-[#1a1a1a] last:border-b-0 ${
        isBlock ? "flex-col gap-2 items-start" : "justify-between items-baseline"
      }`}
    >
      <span className="text-xs text-[#888] uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-sm text-[#e5e5e5] ${
          mono ? "font-[family-name:var(--font-jetbrains-mono)]" : ""
        } ${isBlock ? "w-full" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function SuspicionBar({ score }: { score: number }) {
  const color =
    score <= 15
      ? "#4ade80"
      : score <= 40
        ? "#facc15"
        : score <= 70
          ? "#f97316"
          : "#ef4444";

  return (
    <div className="w-full h-4 bg-[#1a1a1a] rounded-none border border-[#333]">
      <div
        className="h-full rounded-none"
        style={{
          width: `${score}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function StatBlock({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center border border-[#222] rounded-none px-4 py-3 bg-[#0f0f0f] ${onClick ? 'cursor-pointer hover:bg-[#1a1a1a] transition-colors' : ''}`}
    >
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xl text-[#e5e5e5]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] text-[#666] uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────

interface DashboardProps {
  data: RobloxProfileData;
}

export default function Dashboard({ data }: DashboardProps) {
  const [scannedAt, setScannedAt] = useState<string>("");
  const [timelineData, setTimelineData] = useState<any[] | null>(data.badges?.timeline || null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [localPresence, setLocalPresence] = useState(data.presence);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/roblox/${data.username}/presence`);
      if (res.ok) {
        const result = await res.json();
        setLocalPresence(result);
      }
    } catch (e) {
      console.error("Failed to refresh presence", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const [activeConnectionType, setActiveConnectionType] = useState<"friends" | "followers" | "following" | null>(null);
  const [connectionsData, setConnectionsData] = useState<any[]>([]);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  const fetchConnections = async (type: "friends" | "followers" | "following") => {
    setActiveConnectionType(type);
    setIsConnectionsLoading(true);
    setConnectionsError(null);
    try {
      const res = await fetch(`/api/roblox/${data.username}/connections?type=${type}`);
      if (res.ok) {
        const result = await res.json();
        setConnectionsData(result.data || []);
      } else {
        const err = await res.json();
        setConnectionsError(err.error || "Failed to load connections.");
      }
    } catch (e) {
      setConnectionsError("Failed to fetch data.");
      console.error(e);
    } finally {
      setIsConnectionsLoading(false);
    }
  };

  const fetchTimeline = async () => {
    setIsTimelineLoading(true);
    setTimelineError(null);
    try {
      const res = await fetch(`/api/roblox/${data.username}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      const result = await res.json();
      setTimelineData(result.timeline);
    } catch (err: any) {
      setTimelineError(err.message || "Failed to load timeline");
    } finally {
      setIsTimelineLoading(false);
    }
  };

  useEffect(() => {
    setScannedAt(new Date().toISOString().replace("T", " ").slice(0, 19));
  }, []);

  const filteredGroups = data.groups.details?.filter(g => 
    g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  const calculateYAxisTicks = (total: number) => {
    if (!total || total <= 0) return { ticks: [0, 1, 2, 3, 4, 5, 6, 7], max: 7 };
    
    // We want EXACTLY 8 ticks (including 0), so we divide the total by 7.
    // By using Math.ceil, the top tick will be barely above the total,
    // leaving NO excess empty space at the top of the chart.
    const step = Math.ceil(total / 7);
    
    const ticks = [];
    for (let i = 0; i < 8; i++) {
      ticks.push(step * i);
    }
    
    return { ticks, max: step * 7 };
  };
  
  const { ticks: yAxisTicks, max: yAxisMax } = calculateYAxisTicks(data.badges?.total ?? 0);
  
  const joinTimestamp = data.joinDate ? new Date(data.joinDate).getTime() : Date.now() - 365 * 24 * 60 * 60 * 1000;
  const currentTimestamp = Date.now();
  const xAxisDomain = [joinTimestamp, currentTimestamp];
  
  const xAxisTicks = [];
  const startYear = new Date(joinTimestamp).getFullYear();
  const currentYear = new Date().getFullYear();
  
  for (let y = startYear; y <= currentYear; y++) {
    xAxisTicks.push(new Date(`${y}-01-01T00:00:00Z`).getTime());
  }
  const scoreColor =
    data.aiAnalysis.score <= 15
      ? "text-[#4ade80]"
      : data.aiAnalysis.score <= 40
        ? "text-[#facc15]"
        : data.aiAnalysis.score <= 70
          ? "text-[#f97316]"
          : "text-[#ef4444]";

  return (
    <div className="w-full max-w-[95%] 2xl:max-w-[1600px] mx-auto flex flex-col gap-4">
      <div className="flex justify-start">
        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] text-[#888] hover:text-[#fff] transition-colors rounded-none flex items-center justify-center font-[family-name:var(--font-jetbrains-mono)] text-xs uppercase tracking-wider gap-2"
          title="Back to Search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Search
        </button>
      </div>
      {/* Header */}
      <div className="border border-[#333] rounded-none bg-[#111] px-6 py-5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {data.avatarUrl && (
            <img
              src={data.avatarUrl}
              alt={`${data.username} avatar`}
              className="w-24 h-24 object-contain"
            />
          )}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-lg text-[#e5e5e5]">
                {data.displayName}
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#666]">
                @{data.username}
              </span>
              <span 
                className={`w-2 h-2 rounded-full ml-1 ${
                  localPresence?.userPresenceType === 2 
                    ? 'bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.5)]' 
                    : localPresence?.userPresenceType === 3
                      ? 'bg-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                      : localPresence?.isOnline
                        ? 'bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                        : 'bg-[#555555]'
                }`} 
                title={localPresence?.lastLocation || (localPresence?.isOnline ? "Online" : "Offline")}
              ></span>
            </div>
            <div className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#555] mt-1">
              ID:{data.userId} · Scanned{" "}
              {scannedAt ? `${scannedAt} UTC` : "..."}
            </div>
            {localPresence?.userPresenceType === 2 && localPresence.lastLocation && (
              <div className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#4ade80] mt-1.5 truncate max-w-[200px] sm:max-w-[350px]">
                {localPresence.lastLocation.startsWith('Playing') ? '' : 'Playing: '}{localPresence.lastLocation}
              </div>
            )}
            {localPresence?.userPresenceType === 3 && localPresence.lastLocation && (
              <div className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#f97316] mt-1.5 truncate max-w-[200px] sm:max-w-[350px]">
                {localPresence.lastLocation.startsWith('Making') ? '' : 'Making: '}{localPresence.lastLocation}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 sm:pr-2">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] text-[#888] hover:text-[#fff] transition-colors rounded-none flex items-center justify-center disabled:opacity-50"
            title="Refresh Status"
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {localPresence?.joinable && localPresence.placeId && localPresence.gameId ? (
            <a 
              href={`roblox://experiences/start?placeId=${localPresence.placeId}&gameInstanceId=${localPresence.gameId}`}
              className="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-[family-name:var(--font-jetbrains-mono)] text-xs uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              Join Game
            </a>
          ) : localPresence?.joinsOff ? (
            <div className="px-4 py-2 bg-[#1a1a1a] border border-[#333] text-[#888] font-[family-name:var(--font-jetbrains-mono)] text-xs uppercase tracking-wider flex items-center gap-2 cursor-not-allowed" title="User is in a game but joins are restricted">
              Joins Off
            </div>
          ) : (
            <div className="px-4 py-2 bg-[#111] border border-[#222] text-[#444] font-[family-name:var(--font-jetbrains-mono)] text-xs uppercase tracking-wider flex items-center gap-2 cursor-not-allowed" title="User is not currently playing a game">
              Not In Game
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* AI Analysis */}
      <Section title="AI Analysis" icon="⚠">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#888] uppercase tracking-wide">
              Suspicion Rating
            </span>
            <span
              className={`font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold ${scoreColor}`}
            >
              {data.aiAnalysis.score}%
            </span>
          </div>
          <SuspicionBar score={data.aiAnalysis.score} />
          <div className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#aaa] mt-1">
            {data.aiAnalysis.verdict}
          </div>
          {data.aiAnalysis.factors.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] text-[#666] uppercase tracking-widest">
                Factors
              </span>
              {data.aiAnalysis.factors.map((factor) => (
                <div
                  key={factor}
                  className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#999] pl-2 border-l-2 border-[#333]"
                >
                  {factor}
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Profile Information */}
      <Section title="Profile Information" icon="◉">
        <div className="flex flex-col gap-0">
          <DataRow label="Username" value={data.username} mono />
          <DataRow label="Display Name" value={data.displayName} />
          <DataRow label="User ID" value={data.userId} mono />
          <DataRow
            label="Join Date"
            value={
              data.joinDate === "Unknown"
                ? "Unknown"
                : new Date(data.joinDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
            }
            mono
          />
          <DataRow label="Account Age" value={data.joinDateAgo} mono />
          <DataRow
            label="Name History"
            value={
              <div className="max-h-48 overflow-y-auto pr-2 flex flex-col items-start w-full mt-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                {data.nameHistory.map((name, i) => (
                  <div key={i} className="text-left w-full pb-1 text-[#e5e5e5]">
                    <span className="text-[#555] mr-2">•</span>{name}
                  </div>
                ))}
              </div>
            }
            mono
            isBlock
          />
        </div>
      </Section>
        </div>

        <div className="xl:col-span-3 flex flex-col gap-4">
          {/* Connections */}
      <Section title="Connections" icon="⇄">
        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="Friends" value={data.connections.friends} onClick={() => fetchConnections("friends")} />
          <StatBlock label="Followers" value={data.connections.followers} onClick={() => fetchConnections("followers")} />
          <StatBlock label="Following" value={data.connections.following} onClick={() => fetchConnections("following")} />
        </div>
        {data.bannedFriends && data.bannedFriends.bannedCount > 0 && (
          <div className="mt-3 flex items-center justify-between border border-[#331111] bg-[#1a0a0a] px-3 py-2">
            <span className="text-xs text-[#888] uppercase tracking-wide">Terminated Friends</span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#ef4444]">
              {data.bannedFriends.bannedCount} / {data.bannedFriends.totalFriends} ({data.bannedFriends.bannedPercentage.toFixed(1)}%)
            </span>
          </div>
        )}
      </Section>

      {/* Groups */}
      <Section 
        title="Groups" 
        icon="▣"
        headerRight={
          data.groups.details && data.groups.details.length > 0 && (
            <button 
              onClick={() => setIsGroupsModalOpen(true)}
              className="text-[10px] px-2 py-1 bg-[#333] hover:bg-[#444] text-[#ccc] uppercase tracking-wider transition-colors"
            >
              Details
            </button>
          )
        }
      >
        <div className="flex flex-col gap-0">
          <DataRow label="Total Groups" value={data.groups.total} mono />
          <DataRow
            label="Base Rank Count"
            value={data.groups.baseRankCount}
            mono
          />
          <DataRow
            label="Base Rank %"
            value={`${data.groups.baseRankPercentage}%`}
            mono
          />
        </div>
      </Section>

      {/* Inventory */}
      <Section title="Inventory" icon="◈">
        <div className="flex flex-col gap-0">
          {data.inventory.isPrivate ? (
            <div className="py-2 text-sm text-[#888] italic">
              Inventory is Private
            </div>
          ) : data.inventory.totalAssets === 0 ? (
            <div className="py-2 text-sm text-[#888] italic">
              No collectibles found.
            </div>
          ) : (
            <>
              <DataRow
                label="Total Collectibles"
                value={data.inventory.totalAssets.toLocaleString()}
                mono
              />
              <DataRow
                label="Est. Value (R$)"
                value={data.inventory.estimatedValue.toLocaleString()}
                mono
              />
            </>
          )}
        </div>
      </Section>

      {/* Gamepasses */}
      {data.gamepasses && (
        <Section title="Gamepasses (Self-Created)" icon="★">
          <div className="flex flex-col gap-0">
            {data.inventory.isPrivate ? (
              <div className="py-2 text-sm text-[#888] italic">
                Inventory is Private
              </div>
            ) : data.gamepasses.createdCount === 0 ? (
              <div className="py-2 text-sm text-[#888] italic">
                No personal gamepasses found.
              </div>
            ) : (
              <>
                <DataRow
                  label="Created Gamepasses"
                  value={data.gamepasses.createdCount.toLocaleString()}
                  mono
                />
                <DataRow
                  label="Est. Value (R$)"
                  value={data.gamepasses.createdValue.toLocaleString()}
                  mono
                />
              </>
            )}
          </div>
        </Section>
      )}

      {/* Bot & Alt Analysis */}
      {data.botAnalysis && data.botAnalysis.signatures.length > 0 && (
        <Section title="Bot & Alt Detection" icon="🤖">
          <div className="flex flex-col gap-2">
            {data.botAnalysis.isLikelyBot && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1a0a0a] border border-[#331111]">
                <span className="text-[#ef4444] text-xs font-bold uppercase">⚠ Likely Bot Account</span>
              </div>
            )}
            {data.botAnalysis.isLikelyAlt && !data.botAnalysis.isLikelyBot && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a0a] border border-[#333111]">
                <span className="text-[#facc15] text-xs font-bold uppercase">⚠ Possible Alt Account</span>
              </div>
            )}
            {data.botAnalysis.signatures.map((sig, i) => (
              <div
                key={i}
                className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#999] pl-2 border-l-2 border-[#333]"
              >
                {sig}
              </div>
            ))}
            {data.botAnalysis.similarUsernames.length > 0 && (
              <DataRow
                label="Suspected Alt Accounts"
                value={
                  <div className="max-h-48 overflow-y-auto pr-2 flex flex-col items-start w-full mt-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                    {data.botAnalysis.similarUsernames.map((name, i) => (
                      <a 
                        key={i} 
                        href={`/lookup/${name}`}
                        className="text-left w-full pb-1 text-[#e5e5e5] hover:text-white hover:underline transition-all"
                      >
                        <span className="text-[#555] mr-2">•</span>{name}
                      </a>
                    ))}
                  </div>
                }
                mono
                isBlock
              />
            )}
          </div>
        </Section>
      )}
        </div>

        <div className="xl:col-span-5 flex flex-col gap-4">
      {/* Badges */}
      <Section title="Roblox Badges" icon="✪">
        <div className="flex flex-col gap-0">
          {data.inventory.isPrivate ? (
            <div className="py-2 text-sm text-[#888] italic">
              Inventory is Private
            </div>
          ) : (
            <>
              <DataRow
                label="Total Badges"
                value={data.badges?.total?.toLocaleString() ?? 0}
                mono
              />
              <DataRow
                label="Official Badges"
                value={data.badges?.official?.toLocaleString() ?? data.badges?.total?.toLocaleString() ?? 0}
                mono
              />
              {data.badges?.player !== undefined && (
                <DataRow
                  label="Player Badges"
                  value={data.badges?.player?.toLocaleString()}
                  mono
                />
              )}
              {(data.badges?.total && data.badges.total > 0) ? (
            <div className="mt-4 border-t border-[#333] pt-4 px-4 pb-4 bg-[#1a1a1a]">
              <h4 className="text-xs uppercase tracking-wider text-[#888] mb-4">Badge Acquisition Timeline</h4>
              
              {!timelineData && !isTimelineLoading && (
                <div className="flex flex-col items-center justify-center h-32 border border-dashed border-[#333] rounded-sm bg-[#111]">
                  <p className="text-xs text-[#888] mb-3 text-center px-4">
                    Generating the timeline graph may take some time to complete.
                  </p>
                  <button 
                    onClick={fetchTimeline}
                    className="px-4 py-2 bg-[#333] hover:bg-[#444] text-[#fff] text-xs font-[family-name:var(--font-jetbrains-mono)] transition-colors"
                  >
                    Load Timeline
                  </button>
                  {timelineError && (
                    <p className="text-xs text-red-500 mt-2">{timelineError}</p>
                  )}
                </div>
              )}

              {isTimelineLoading && (
                <div className="flex flex-col items-center justify-center h-32 border border-dashed border-[#333] rounded-sm bg-[#111]">
                  <div className="w-6 h-6 border-2 border-[#555] border-t-[#fff] rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-[#888] font-[family-name:var(--font-jetbrains-mono)]">
                    Fetching badges & dates... Please wait...
                  </p>
                </div>
              )}

              {timelineData && timelineData.length > 0 && (
                <div className="h-[400px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis 
                        dataKey="timestamp" 
                        type="number"
                        domain={xAxisDomain}
                        stroke="#888" 
                        tick={{ fill: '#888', fontSize: 10, angle: -45, textAnchor: 'end', dy: 8 }}
                        tickFormatter={(tick) => new Date(tick).getFullYear().toString()}
                        ticks={xAxisTicks}
                        tickLine={false}
                        axisLine={false}
                        height={45}
                      />
                      <YAxis 
                        stroke="#888" 
                        tick={{ fill: '#888', fontSize: 10 }}
                        domain={[0, yAxisMax]}
                        ticks={yAxisTicks}
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(tick) => tick.toLocaleString()}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="none" 
                        strokeWidth={0}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (payload.isFarming) {
                            return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="rgba(239, 68, 68, 0.5)" stroke="none" />;
                          }
                          return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="rgba(255, 255, 255, 0.5)" stroke="none" />;
                        }}
                        activeDot={false}
                        isAnimationActive={false}
                        name="Total Badges" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  </Section>
</div>
</div>
      {isGroupsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-[#333] w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-4 py-3 border-b border-[#333] flex justify-between items-center bg-[#0a0a0a]">
              <h3 className="uppercase tracking-wide text-sm font-medium text-[#e5e5e5]">Group Details</h3>
              <button onClick={() => setIsGroupsModalOpen(false)} className="text-[#888] hover:text-[#fff] text-lg leading-none transition-colors">✕</button>
            </div>
            <div className="p-3 border-b border-[#333] bg-[#0a0a0a]">
              <input 
                type="text" 
                placeholder="Search groups..." 
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-xs px-3 py-2 outline-none focus:border-[#555] transition-colors"
              />
            </div>
            <div className="p-4 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-[#333]">
              {filteredGroups && filteredGroups.length > 0 ? filteredGroups.map(g => (
                <div key={g.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-[#222] pb-2 last:border-b-0 last:pb-0 gap-1 sm:gap-4">
                  <a 
                    href={`https://www.roblox.com/groups/${g.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e5e5e5] hover:text-white hover:underline truncate font-[family-name:var(--font-jetbrains-mono)] text-xs" 
                    title={g.name}
                  >
                    {g.name}
                  </a>
                  <span className="text-[#666] text-[10px] sm:text-right whitespace-nowrap">Rank: {g.rankName} ({g.rank})</span>
                </div>
              )) : (
                <div className="text-center text-[#666] text-xs py-4">No groups found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connections Modal */}
      {activeConnectionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-[#333] w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#e5e5e5] uppercase tracking-wider capitalize">
                {activeConnectionType}
              </h3>
              <button 
                onClick={() => setActiveConnectionType(null)}
                className="text-[#666] hover:text-white transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-[#333]">
              {isConnectionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#333] border-t-[#fff] rounded-full animate-spin"></div>
                </div>
              ) : connectionsError ? (
                <div className="text-center text-[#ef4444] text-xs py-4">{connectionsError}</div>
              ) : connectionsData && connectionsData.length > 0 ? (
                connectionsData.map((conn, idx) => (
                  <div key={`conn-${conn.id}-${idx}`} className="flex items-center justify-between border border-[#222] p-2 bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors">
                    <div className="flex items-center gap-3">
                      {conn.avatarUrl ? (
                        <img src={conn.avatarUrl} alt={conn.name} className="w-8 h-8 rounded-full border border-[#333]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#222] border border-[#333]"></div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#e5e5e5]">{conn.displayName}</span>
                        <span className="text-[10px] text-[#666]">@{conn.name}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push(`/lookup/${conn.name}`)}
                      className="px-3 py-1 bg-[#222] hover:bg-[#333] text-[10px] text-[#e5e5e5] uppercase tracking-wider transition-colors"
                    >
                      Scan
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#666] text-xs py-4">No {activeConnectionType} found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
