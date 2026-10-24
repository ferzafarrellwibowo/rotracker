import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from "discord-interactions";
import { GET as getRobloxProfile } from "@/app/api/roblox/[username]/route";
import { GET as getRobloxTimeline } from "@/app/api/roblox/[username]/timeline/route";
import { GET as getRobloxPresence } from "@/app/api/roblox/[username]/presence/route";
import type { RobloxProfileData, BadgeTimelineData } from "@/app/types";

export const dynamic = "force-dynamic";

// Discord Components V2 type ids
const C = {
  ACTION_ROW: 1,
  BUTTON: 2,
  SECTION: 9,
  TEXT: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  SEPARATOR: 14,
  CONTAINER: 17,
} as const;
const FLAG_COMPONENTS_V2 = 1 << 15;
const FLAG_EPHEMERAL = 1 << 6;

// ─── In-Memory Cache for Detail Button Clicks ────────────────
const profileCache = new Map<string, { data: RobloxProfileData; timestamp: number }>();

function cacheProfile(data: RobloxProfileData) {
  const entry = { data, timestamp: Date.now() };
  profileCache.set(String(data.userId), entry);
  profileCache.set(data.username.toLowerCase(), entry);
  if (profileCache.size > 200) {
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) profileCache.delete(oldestKey);
  }
}

async function getOrFetchProfile(idOrName: string): Promise<RobloxProfileData | null> {
  const cached = profileCache.get(idOrName.toLowerCase());
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) return cached.data;
  try {
    const res = await getRobloxProfile(new Request("http://localhost"), {
      params: Promise.resolve({ username: idOrName }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RobloxProfileData;
    cacheProfile(data);
    return data;
  } catch {
    return null;
  }
}

function getScoreColor(score: number): number {
  if (score <= 15) return 0x7dd3a8;
  if (score <= 40) return 0xe8c872;
  if (score <= 70) return 0xe8a26a;
  return 0xef8a8a;
}

// ─── Badge Timeline Chart (scatter, per-year X axis, watermark) ──
function loadWatermarkSvg(targetWidth: number): Buffer | null {
  try {
    const svgPath = path.join(process.cwd(), "public", "roTracker-logo.svg");
    let svg = fs.readFileSync(svgPath, "utf-8");
    // librsvg cannot fetch remote fonts — drop @import and fall back to a local monospace
    svg = svg.replace(/@import[^;]+;/, "");
    svg = svg.replace(
      /font-family:[^;]+;/,
      "font-family:'JetBrains Mono','Consolas','DejaVu Sans Mono',monospace;"
    );
    // Wrap content in a 50% opacity group
    svg = svg.replace(/(<svg[^>]*>)/, `$1<g opacity="0.5">`).replace(/<\/svg>\s*$/, "</g></svg>");
    const height = Math.round(targetWidth / 3); // logo viewBox is 540x180
    svg = svg
      .replace(/width="\d+"/, `width="${targetWidth}"`)
      .replace(/height="\d+"/, `height="${height}"`);
    return Buffer.from(svg);
  } catch (err) {
    console.error("Watermark load error:", err);
    return null;
  }
}

async function generateBadgeChartPng(
  timeline: BadgeTimelineData[],
  username: string,
  totalBadges: number
): Promise<Buffer | null> {
  const points = timeline
    .filter((p) => typeof p.timestamp === "number" && !isNaN(p.timestamp))
    .sort((a, b) => a.timestamp! - b.timestamp!)
    .map((p) => ({ x: p.timestamp!, y: p.count }));
  if (points.length === 0) return null;

  // Keep payload reasonable for very large collections
  const maxPoints = 2500;
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const data = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  const width = 900;
  const height = 450;
  const chart = {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Badges",
          data,
          showLine: false,
          pointRadius: 2.2,
          pointHoverRadius: 2.2,
          pointBorderWidth: 0,
          pointBackgroundColor: "rgba(138, 196, 255, 0.55)",
        },
      ],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: `Badge Progression — ${username} (${totalBadges.toLocaleString("en-US")} badges)`,
        fontColor: "#EDF2FA",
        fontFamily: "monospace",
        fontSize: 15,
        padding: 14,
      },
      layout: { padding: { left: 8, right: 16, top: 4, bottom: 8 } },
      scales: {
        xAxes: [
          {
            type: "time",
            time: { unit: "year", displayFormats: { year: "YYYY" } },
            scaleLabel: { display: true, labelString: "Year", fontColor: "#94A1B3", fontFamily: "monospace", fontSize: 12 },
            gridLines: { color: "rgba(39, 49, 62, 0.8)", zeroLineColor: "#27313E" },
            ticks: { fontColor: "#94A1B3", fontFamily: "monospace", fontSize: 11 },
          },
        ],
        yAxes: [
          {
            scaleLabel: { display: true, labelString: "Total Badges", fontColor: "#94A1B3", fontFamily: "monospace", fontSize: 12 },
            gridLines: { color: "rgba(39, 49, 62, 0.8)", zeroLineColor: "#27313E" },
            ticks: { beginAtZero: true, fontColor: "#94A1B3", fontFamily: "monospace", fontSize: 11 },
          },
        ],
      },
    },
  };

  try {
    const res = await fetch("https://quickchart.io/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "2",
        backgroundColor: "#090C10",
        width,
        height,
        devicePixelRatio: 2,
        format: "png",
        chart,
      }),
    });
    if (!res.ok) {
      console.error("QuickChart error:", res.status, await res.text());
      return null;
    }
    const chartPng = Buffer.from(await res.arrayBuffer());

    const meta = await sharp(chartPng).metadata();
    const imgW = meta.width ?? width * 2;
    const watermark = loadWatermarkSvg(Math.round(imgW * 0.45));
    if (!watermark) return chartPng;

    const watermarkPng = await sharp(watermark).png().toBuffer();
    return await sharp(chartPng)
      .composite([{ input: watermarkPng, gravity: "center" }])
      .png()
      .toBuffer();
  } catch (err) {
    console.error("Chart generation error:", err);
    return null;
  }
}

// ─── Components V2 Builders ─────────────────────────────────
const text = (content: string) => ({ type: C.TEXT, content });
const divider = () => ({ type: C.SEPARATOR, divider: true, spacing: 1 });
const detailButton = (customId: string) => ({
  type: C.BUTTON,
  style: 2,
  label: "Detail",
  custom_id: customId,
});
const section = (content: string, customId: string) => ({
  type: C.SECTION,
  components: [text(content)],
  accessory: detailButton(customId),
});

function formatStatus(presence: RobloxProfileData["presence"]): string {
  if (!presence?.isOnline) return "⚫ Offline";
  const loc =
    presence.lastLocation && presence.lastLocation !== "Offline" && presence.lastLocation !== "Website"
      ? ` — ${presence.lastLocation}`
      : "";
  if (presence.userPresenceType === 2) return `🟢 In Game${loc}`;
  if (presence.userPresenceType === 3) return `🟠 In Studio${loc}`;
  return `🟢 Online${loc}`;
}

function buildLookupComponents(
  data: RobloxProfileData,
  profileUrl: string,
  hasChart: boolean
) {
  const id = data.userId;
  const joinDate =
    data.joinDate && data.joinDate !== "Unknown"
      ? new Date(data.joinDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown";

  let botAlt = "✅ No bot/alt indicators flagged";
  if (data.botAnalysis?.isLikelyBot) botAlt = "⚠️ Likely bot account";
  else if (data.botAnalysis?.isLikelyAlt) botAlt = "⚠️ Possible alt account";
  const altCount = data.botAnalysis?.similarUsernames?.length ?? 0;
  if (altCount > 0) botAlt += ` · **${altCount}** similar usernames`;

  const terminated =
    data.bannedFriends && data.bannedFriends.bannedCount > 0
      ? `\n-# ⚠️ ${data.bannedFriends.bannedCount} terminated friends (${data.bannedFriends.bannedPercentage.toFixed(1)}%)`
      : "";

  const header = {
    type: C.SECTION,
    components: [
      text(
        `## [${data.displayName} (@${data.username})](${profileUrl})\n` +
          `-# Background check · updated <t:${Math.floor(Date.now() / 1000)}:R>\n` +
          `${formatStatus(data.presence)}`
      ),
    ],
    accessory: data.avatarUrl
      ? { type: C.THUMBNAIL, media: { url: data.avatarUrl } }
      : detailButton(`detail_profile_${id}`),
  };

  const inner: Record<string, unknown>[] = [
    header,
    divider(),
    section(
      `### 👤 Profile Information\nJoined **${joinDate}** (${data.joinDateAgo})\n-# User ID \`${id}\``,
      `detail_profile_${id}`
    ),
    divider(),
    section(
      `### 🔗 Connections\n**${data.connections.friends}** friends · **${data.connections.followers}** followers · **${data.connections.following}** following${terminated}`,
      `detail_conn_${id}`
    ),
    divider(),
    section(
      `### 🛡️ AI Suspicion & Detection\nScore **${data.aiAnalysis.score}%** · ${data.aiAnalysis.verdict.split(" — ")[0]}\n-# ${botAlt}`,
      `detail_alts_${id}`
    ),
    divider(),
    section(
      `### 👥 Groups\n**${data.groups.total}** groups · base rank in **${data.groups.baseRankCount}** (${data.groups.baseRankPercentage}%)`,
      `detail_groups_${id}`
    ),
    divider(),
    section(
      data.inventory.isPrivate
        ? `### 💰 Inventory\n🔒 Inventory is private`
        : `### 💰 Inventory\n**${data.inventory.totalAssets.toLocaleString("en-US")}** collectibles · Est. **R$ ${data.inventory.estimatedValue.toLocaleString("en-US")}**`,
      `detail_inv_${id}`
    ),
    divider(),
    section(
      data.gamepasses && data.gamepasses.createdCount > 0
        ? `### 🎫 Gamepasses\n**${data.gamepasses.createdCount}** self-created · Est. **R$ ${data.gamepasses.createdValue.toLocaleString("en-US")}**`
        : `### 🎫 Gamepasses\nNo self-created gamepasses found`,
      `detail_gp_${id}`
    ),
    divider(),
    section(
      `### 🏅 Badges\n**${data.badges.official}** official · **${(data.badges.player ?? data.badges.total).toLocaleString("en-US")}** player badges`,
      `detail_badges_${id}`
    ),
  ];

  if (hasChart) {
    inner.push(divider(), {
      type: C.MEDIA_GALLERY,
      items: [{ media: { url: "attachment://badges.png" } }],
    });
  }

  inner.push(text("-# roTracker · Roblox profile background checker"));

  return [
    {
      type: C.CONTAINER,
      accent_color: getScoreColor(data.aiAnalysis.score),
      components: inner,
    },
    {
      type: C.ACTION_ROW,
      components: [
        { type: C.BUTTON, style: 5, label: "Open in roTracker Web", url: profileUrl },
      ],
    },
  ];
}

// ─── Async /lookup Processing ───────────────────────────────
async function processLookup(applicationId: string, token: string, username: string) {
  const patchUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "https://rotracker.app";

  try {
    const profileRes = await getRobloxProfile(new Request("http://localhost"), {
      params: Promise.resolve({ username }),
    });
    if (!profileRes.ok) {
      const errData = (await profileRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errData?.error || `HTTP ${profileRes.status}`);
    }
    const data = (await profileRes.json()) as RobloxProfileData;

    // Fresh presence (same source as the web dashboard)
    try {
      const presRes = await getRobloxPresence(new Request("http://localhost"), {
        params: Promise.resolve({ username: String(data.userId) }),
      });
      if (presRes.ok) {
        const pres = await presRes.json();
        if (pres && typeof pres.isOnline === "boolean") {
          data.presence = { ...data.presence, ...pres };
        }
      }
    } catch {
      /* keep presence from profile */
    }
    cacheProfile(data);

    // Badge timeline chart
    let chartPng: Buffer | null = null;
    try {
      const timelineRes = await Promise.race([
        getRobloxTimeline(new Request("http://localhost"), {
          params: Promise.resolve({ username: data.username }),
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
      if (timelineRes && timelineRes.ok) {
        const t = (await timelineRes.json()) as { timeline: BadgeTimelineData[]; total: number };
        if (t?.timeline?.length > 0) {
          chartPng = await generateBadgeChartPng(t.timeline, data.username, t.total ?? t.timeline.length);
        }
      }
    } catch (e) {
      console.warn("Timeline error:", e);
    }

    const profileUrl = `${baseUrl}/lookup/${encodeURIComponent(data.username)}`;
    const payload: Record<string, unknown> = {
      flags: FLAG_COMPONENTS_V2,
      components: buildLookupComponents(data, profileUrl, !!chartPng),
    };

    let patchRes: Response;
    if (chartPng) {
      payload.attachments = [{ id: 0, filename: "badges.png" }];
      const form = new FormData();
      form.append("payload_json", JSON.stringify(payload));
      form.append("files[0]", new Blob([new Uint8Array(chartPng)], { type: "image/png" }), "badges.png");
      patchRes = await fetch(patchUrl, { method: "PATCH", body: form });
    } else {
      patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!patchRes.ok) {
      console.error(`Discord PATCH rejected (${patchRes.status}):`, await patchRes.text());
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flags: FLAG_COMPONENTS_V2,
        components: [
          {
            type: C.CONTAINER,
            accent_color: 0xef8a8a,
            components: [
              text(`### Lookup failed\nCould not analyze **${username}**\n-# ${errorMsg}`),
            ],
          },
        ],
      }),
    }).catch(console.error);
  }
}

// ─── Ephemeral Detail Responses ─────────────────────────────
function detailCard(title: string, body: string, color = 0x8ac4ff) {
  return {
    flags: FLAG_EPHEMERAL | FLAG_COMPONENTS_V2,
    components: [
      {
        type: C.CONTAINER,
        accent_color: color,
        components: [text(`### ${title}`), divider(), text(body.slice(0, 3900))],
      },
    ],
  };
}

async function handleDetailButton(customId: string): Promise<Record<string, unknown>> {
  const [, action, targetId] = customId.split("_");
  const p = await getOrFetchProfile(targetId);
  if (!p) {
    return detailCard("Data expired", "Profile data has expired. Please run `/lookup` again.", 0xef8a8a);
  }

  switch (action) {
    case "profile": {
      const names = p.nameHistory?.length
        ? p.nameHistory.map((n) => `• ${n}`).join("\n")
        : "No previous usernames.";
      return detailCard(
        `👤 Profile Information — @${p.username}`,
        `**Display name:** ${p.displayName}\n**User ID:** \`${p.userId}\`\n**Joined:** ${p.joinDate.split("T")[0]} (${p.joinDateAgo})\n\n**Name history**\n${names}`
      );
    }
    case "conn": {
      const banned =
        p.bannedFriends && p.bannedFriends.bannedCount > 0
          ? `⚠️ **${p.bannedFriends.bannedCount}** of **${p.bannedFriends.totalFriends}** friends (${p.bannedFriends.bannedPercentage.toFixed(1)}%) are terminated accounts.`
          : "No terminated friends detected.";
      return detailCard(
        `🔗 Connections — @${p.username}`,
        `**Friends:** ${p.connections.friends}\n**Followers:** ${p.connections.followers}\n**Following:** ${p.connections.following}\n\n${banned}`
      );
    }
    case "groups": {
      const list = p.groups.details?.length
        ? p.groups.details
            .slice(0, 25)
            .map((g) => `• **${g.name}** — \`${g.rankName}\``)
            .join("\n")
        : "No group details available.";
      const more = (p.groups.details?.length ?? 0) > 25 ? `\n-# …and ${p.groups.details!.length - 25} more` : "";
      return detailCard(
        `👥 Groups — @${p.username} (${p.groups.total})`,
        `Base rank in **${p.groups.baseRankCount}** groups (${p.groups.baseRankPercentage}%)\n\n${list}${more}`
      );
    }
    case "alts": {
      const sigs = p.botAnalysis?.signatures?.length
        ? p.botAnalysis.signatures.map((s) => `• ${s}`).join("\n")
        : "No anomaly signatures detected.";
      const alts = p.botAnalysis?.similarUsernames?.length
        ? p.botAnalysis.similarUsernames.map((u) => `• ${u}`).join("\n")
        : "No similar usernames detected.";
      const factors = p.aiAnalysis.factors.length
        ? p.aiAnalysis.factors.map((f) => `• ${f}`).join("\n")
        : "No risk factors.";
      return detailCard(
        `🛡️ AI Suspicion & Detection — @${p.username}`,
        `**Score:** ${p.aiAnalysis.score}% — ${p.aiAnalysis.verdict}\n\n**Factors**\n${factors}\n\n**Signatures**\n${sigs}\n\n**Possible similar usernames**\n${alts}`,
        getScoreColor(p.aiAnalysis.score)
      );
    }
    case "inv":
      return detailCard(
        `💰 Inventory — @${p.username}`,
        p.inventory.isPrivate
          ? "🔒 Inventory is private."
          : `**Collectibles:** ${p.inventory.totalAssets.toLocaleString("en-US")}\n**Estimated value:** R$ ${p.inventory.estimatedValue.toLocaleString("en-US")}`
      );
    case "gp":
      return detailCard(
        `🎫 Gamepasses — @${p.username}`,
        p.gamepasses
          ? `**Self-created:** ${p.gamepasses.createdCount.toLocaleString("en-US")}\n**Estimated value:** R$ ${p.gamepasses.createdValue.toLocaleString("en-US")}`
          : "No gamepass data."
      );
    case "badges":
      return detailCard(
        `🏅 Badges — @${p.username}`,
        `**Official:** ${p.badges.official}\n**Player:** ${(p.badges.player ?? 0).toLocaleString("en-US")}\n**Total:** ${p.badges.total.toLocaleString("en-US")}`
      );
  }
  return detailCard("Not found", "Unknown detail.", 0xef8a8a);
}

// ─── Main POST Handler ──────────────────────────────────────
export async function POST(req: Request) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return new Response("Discord configuration missing.", { status: 500 });
  if (!signature || !timestamp) return new Response("Missing signature headers.", { status: 401 });

  const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValid) return new Response("Invalid request signature.", { status: 401 });

  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId: string | undefined = interaction.data?.custom_id;
    if (customId?.startsWith("detail_")) {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: await handleDetailButton(customId),
      });
    }
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "lookup") {
    const usernameOption = interaction.data.options?.find(
      (opt: { name: string; value: unknown }) => opt.name === "username"
    )?.value;

    if (!usernameOption || typeof usernameOption !== "string") {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "⚠️ Please provide a valid Roblox username or ID.", flags: FLAG_EPHEMERAL },
      });
    }

    processLookup(interaction.application_id, interaction.token, usernameOption.trim());
    return Response.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
  }

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown command.", flags: FLAG_EPHEMERAL },
  });
}
