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
    <section className="card overflow-hidden">
      <div className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="flex min-w-0 items-center gap-3">
          <span className="w-4 shrink-0 text-center text-sm text-fg-muted grayscale" aria-hidden="true">
            {icon}
          </span>
          <span className="truncate text-sm font-medium text-fg">
            {title}
          </span>
        </h2>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </section>
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
      className={`flex gap-4 border-b border-border/60 py-2.5 last:border-b-0 ${
        isBlock ? "flex-col items-start gap-2" : "items-baseline justify-between"
      }`}
    >
      <span className="shrink-0 text-[13px] text-fg-secondary">
        {label}
      </span>
      <span
        className={`min-w-0 text-[13px] text-fg ${
          mono ? "tabular-nums" : ""
        } ${isBlock ? "w-full" : "truncate text-right"}`}
      >
        {value}
      </span>
    </div>
  );
}

function SuspicionBar({ score }: { score: number }) {
  const color =
    score <= 15
      ? "var(--success)"
      : score <= 40
        ? "var(--warning)"
        : score <= 70
          ? "var(--caution)"
          : "var(--danger)";

  return (
    <div
      className="h-2 w-full overflow-hidden bg-surface-elevated"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label="Suspicion rating"
    >
      <div
        className="h-full transition-[width] duration-200"
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
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex min-w-0 flex-col items-center border border-border bg-background px-2 py-3 sm:px-3 ${onClick ? 'cursor-pointer transition-colors duration-150 hover:border-border-strong hover:bg-surface-elevated' : ''}`}
    >
      <span className="text-lg font-medium tabular-nums tracking-tight text-fg">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="label-micro mt-1 truncate">
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch timeline");
      }
      const result = await res.json();
      if (result.canViewInventory === false) {
        setTimelineError("Inventory is private, badges cannot be viewed.");
        return;
      }
      if (!result.timeline || result.timeline.length === 0) {
        setTimelineError("No badge data found.");
        return;
      }
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
  
  const timelineMax = timelineData && timelineData.length > 0
    ? timelineData[timelineData.length - 1].count
    : (data.badges?.total ?? 0);
  const { ticks: yAxisTicks, max: yAxisMax } = calculateYAxisTicks(timelineMax);
  
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
      ? "text-success"
      : data.aiAnalysis.score <= 40
        ? "text-warning"
        : data.aiAnalysis.score <= 70
          ? "text-caution"
          : "text-danger";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <div className="flex justify-start">
        <button 
          onClick={() => router.push('/')}
          className="btn btn-secondary btn-sm"
          title="Back to Search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Search
        </button>
      </div>
      {/* Header */}
      <div className="card mb-2 flex flex-col justify-between gap-6 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          {data.avatarUrl && (
            <img
              src={data.avatarUrl}
              alt={`${data.username} avatar`}
              className="h-20 w-20 shrink-0 border border-border bg-background object-contain sm:h-24 sm:w-24"
            />
          )}
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate text-xl font-semibold tracking-tight text-fg">
                {data.displayName}
              </span>
              <span className="truncate text-sm text-fg-muted">
                @{data.username}
              </span>
              <span 
                className={`h-2 w-2 shrink-0 ${
                  localPresence?.userPresenceType === 2 
                    ? 'bg-success' 
                    : localPresence?.userPresenceType === 3
                      ? 'bg-caution'
                      : localPresence?.isOnline
                        ? 'bg-accent'
                        : 'bg-fg-muted/50'
                }`} 
                title={localPresence?.lastLocation || (localPresence?.isOnline ? "Online" : "Offline")}
              ></span>
            </div>
            <div className="mt-1 text-xs tabular-nums text-fg-muted">
              ID:{data.userId} · Scanned{" "}
              {scannedAt ? `${scannedAt} UTC` : "..."}
            </div>
            {localPresence?.userPresenceType === 2 && localPresence.lastLocation && (
              <div className="mt-2 max-w-[200px] truncate text-xs text-success sm:max-w-[350px]">
                {localPresence.lastLocation.startsWith('Playing') ? '' : 'Playing: '}{localPresence.lastLocation}
              </div>
            )}
            {localPresence?.userPresenceType === 3 && localPresence.lastLocation && (
              <div className="mt-2 max-w-[200px] truncate text-xs text-caution sm:max-w-[350px]">
                {localPresence.lastLocation.startsWith('Making') ? '' : 'Making: '}{localPresence.lastLocation}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary btn-icon"
            title="Refresh Status"
            aria-label="Refresh Status"
          >
            <svg 
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {localPresence?.joinable && localPresence.placeId && localPresence.gameId ? (
            <a 
              href={`roblox://experiences/start?placeId=${localPresence.placeId}&gameInstanceId=${localPresence.gameId}`}
              className="btn btn-primary"
            >
              Join Game
            </a>
          ) : localPresence?.joinsOff ? (
            <div className="btn btn-static text-fg-secondary" title="User is in a game but joins are restricted">
              Joins Off
            </div>
          ) : (
            <div className="btn btn-static" title="User is not currently playing a game">
              Not In Game
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          {/* AI Analysis */}
      <Section title="AI Analysis" icon="⚠">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-fg-secondary">
              Suspicion Rating
            </span>
            <span
              className={`text-3xl font-semibold tabular-nums tracking-tight ${scoreColor}`}
            >
              {data.aiAnalysis.score}%
            </span>
          </div>
          <SuspicionBar score={data.aiAnalysis.score} />
          <div className="mt-1 text-[13px] leading-relaxed text-fg">
            {data.aiAnalysis.verdict}
          </div>
          {data.aiAnalysis.factors.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-4">
              <span className="label-micro">
                Factors
              </span>
              {data.aiAnalysis.factors.map((factor) => (
                <div
                  key={factor}
                  className="border-l-2 border-border pl-3 text-[13px] leading-relaxed text-fg-secondary"
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
              <div className="flex max-h-48 w-full flex-col items-start overflow-y-auto pr-2">
                {data.nameHistory.map((name, i) => (
                  <div key={i} className="w-full py-1 text-left text-fg">
                    <span className="mr-2 text-fg-muted">•</span>{name}
                  </div>
                ))}
              </div>
            }
            mono
            isBlock
          />
        </div>
      </Section>

      {/* Bot & Alt Analysis */}
      {data.botAnalysis && (
        <Section title="Bot & Alt Detection" icon="🤖">
          <div className="flex flex-col gap-3">
            {data.botAnalysis.isLikelyBot && (
              <div className="flex items-center gap-2 border border-danger-line bg-danger-subtle px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-danger">⚠ Likely Bot Account</span>
              </div>
            )}
            {data.botAnalysis.isLikelyAlt && !data.botAnalysis.isLikelyBot && (
              <div className="flex items-center gap-2 border border-warning-line bg-warning-subtle px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-warning">⚠ Possible Alt Account</span>
              </div>
            )}
            {!data.botAnalysis.isLikelyBot && !data.botAnalysis.isLikelyAlt && data.botAnalysis.signatures.length === 0 && (
              <div className="flex items-center gap-2 border border-success-line bg-success-subtle px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-success">✓ No Bot/Alt Indicators Flagged</span>
              </div>
            )}
            {data.botAnalysis.signatures.map((sig, i) => (
              <div
                key={i}
                className="border-l-2 border-border pl-3 text-[13px] leading-relaxed text-fg-secondary"
              >
                {sig}
              </div>
            ))}
            <DataRow
              label="Possible Similar Usernames"
              value={
                data.botAnalysis.similarUsernames && data.botAnalysis.similarUsernames.length > 0 ? (
                  <div className="flex max-h-48 w-full flex-col items-start overflow-y-auto pr-2">
                    {data.botAnalysis.similarUsernames.map((name, i) => (
                      <a 
                        key={i} 
                        href={`/lookup/${name}`}
                        className="w-full py-1 text-left text-fg transition-colors duration-150 hover:text-accent-hover"
                      >
                        <span className="mr-2 text-fg-muted">•</span>{name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-[13px] text-fg-muted">None detected</span>
                )
              }
              mono
              isBlock={Boolean(data.botAnalysis.similarUsernames && data.botAnalysis.similarUsernames.length > 0)}
            />
          </div>
        </Section>
      )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
          {/* Connections */}
      <Section title="Connections" icon="⇄">
        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="Friends" value={data.connections.friends} onClick={() => fetchConnections("friends")} />
          <StatBlock label="Followers" value={data.connections.followers} onClick={() => fetchConnections("followers")} />
          <StatBlock label="Following" value={data.connections.following} onClick={() => fetchConnections("following")} />
        </div>
        {data.bannedFriends && data.bannedFriends.bannedCount > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border border-danger-line bg-danger-subtle px-3 py-2">
            <span className="text-[13px] text-fg-secondary">Terminated Friends</span>
            <span className="text-[13px] tabular-nums text-danger">
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
              className="btn btn-secondary h-7 px-2.5 text-xs"
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
            <div className="py-2 text-[13px] text-fg-muted">
              Inventory is Private
            </div>
          ) : data.inventory.totalAssets === 0 ? (
            <div className="py-2 text-[13px] text-fg-muted">
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
              <div className="py-2 text-[13px] text-fg-muted">
                Inventory is Private
              </div>
            ) : data.gamepasses.createdCount === 0 ? (
              <div className="py-2 text-[13px] text-fg-muted">
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
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-5">
      {/* Badges */}
      <Section title="Roblox Badges" icon="✪">
        <div className="flex flex-col gap-0">
          {data.inventory.isPrivate ? (
            <div className="py-2 text-[13px] text-fg-muted">
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
            <div className="mt-4 border border-border bg-background p-4">
              <h3 className="label-micro mb-4">Badge Acquisition Timeline</h3>
              
              {!timelineData && !isTimelineLoading && (
                <div className="flex h-32 flex-col items-center justify-center border border-dashed border-border px-4">
                  <p className="mb-3 text-center text-[13px] text-fg-secondary">
                    Generating the timeline graph may take some time to complete.
                  </p>
                  <button 
                    onClick={fetchTimeline}
                    className="btn btn-primary btn-sm"
                  >
                    Load Timeline
                  </button>
                  {timelineError && (
                    <p className="mt-2 text-center text-xs text-danger" role="alert">{timelineError}</p>
                  )}
                </div>
              )}

              {isTimelineLoading && (
                <div className="flex h-32 flex-col items-center justify-center border border-dashed border-border" role="status">
                  <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"></div>
                  <p className="text-[13px] text-fg-secondary">
                    Fetching badges &amp; dates... Please wait...
                  </p>
                </div>
              )}

              {timelineData && timelineData.length > 0 && (
                <div className="mt-2 h-[320px] w-full sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#27313E" vertical={false} />
                      <XAxis 
                        dataKey="timestamp" 
                        type="number"
                        domain={xAxisDomain}
                        stroke="#6E8099" 
                        tick={{ fill: '#6E8099', fontSize: 11, angle: -45, textAnchor: 'end', dy: 8 }}
                        tickFormatter={(tick) => new Date(tick).getFullYear().toString()}
                        ticks={xAxisTicks}
                        tickLine={false}
                        axisLine={false}
                        height={45}
                      />
                      <YAxis 
                        stroke="#6E8099" 
                        tick={{ fill: '#6E8099', fontSize: 11 }}
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
                            return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="rgba(239, 138, 138, 0.6)" stroke="none" />;
                          }
                          return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="rgba(138, 196, 255, 0.55)" stroke="none" />;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden bg-surface-elevated" role="dialog" aria-modal="true" aria-labelledby="groups-modal-title">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 id="groups-modal-title" className="text-sm font-medium text-fg">Group Details</h3>
              <button onClick={() => setIsGroupsModalOpen(false)} className="btn btn-icon btn-sm text-fg-muted hover:bg-surface hover:text-fg" aria-label="Close">✕</button>
            </div>
            <div className="border-b border-border p-3">
              <input 
                type="text" 
                placeholder="Search groups..." 
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                aria-label="Search groups"
                className="input h-9 px-3 text-[13px]"
              />
            </div>
            <div className="flex flex-col overflow-y-auto p-2">
              {filteredGroups && filteredGroups.length > 0 ? filteredGroups.map(g => (
                <div key={g.id} className="flex flex-col gap-1 px-3 py-2.5 transition-colors duration-150 hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <a 
                    href={`https://www.roblox.com/groups/${g.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[13px] text-fg transition-colors duration-150 hover:text-accent-hover" 
                    title={g.name}
                  >
                    {g.name}
                  </a>
                  <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted sm:text-right">Rank: {g.rankName} ({g.rank})</span>
                </div>
              )) : (
                <div className="py-6 text-center text-[13px] text-fg-muted">No groups found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connections Modal */}
      {activeConnectionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden bg-surface-elevated" role="dialog" aria-modal="true" aria-labelledby="connections-modal-title">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 id="connections-modal-title" className="text-sm font-medium capitalize text-fg">
                {activeConnectionType}
              </h3>
              <button 
                onClick={() => setActiveConnectionType(null)}
                className="btn btn-icon btn-sm text-fg-muted hover:bg-surface hover:text-fg"
                title="Close"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-2 overflow-y-auto p-3">
              {isConnectionsLoading ? (
                <div className="flex items-center justify-center py-8" role="status">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"></div>
                </div>
              ) : connectionsError ? (
                <div className="py-6 text-center text-[13px] text-danger" role="alert">{connectionsError}</div>
              ) : connectionsData && connectionsData.length > 0 ? (
                connectionsData.map((conn, idx) => (
                  <div key={`conn-${conn.id}-${idx}`} className="flex items-center justify-between gap-3 border border-border bg-surface p-2 transition-colors duration-150 hover:border-border-strong">
                    <div className="flex min-w-0 items-center gap-3">
                      {conn.avatarUrl ? (
                        <img src={conn.avatarUrl} alt={conn.name} className="h-8 w-8 shrink-0 border border-border bg-background" />
                      ) : (
                        <div className="h-8 w-8 shrink-0 border border-border bg-background"></div>
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-medium text-fg">{conn.displayName}</span>
                        <span className="truncate text-xs text-fg-muted">@{conn.name}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push(`/lookup/${conn.name}`)}
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      Scan
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-[13px] text-fg-muted">No {activeConnectionType} found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
