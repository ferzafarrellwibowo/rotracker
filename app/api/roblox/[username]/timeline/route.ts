import { NextResponse } from "next/server";
import { BadgeTimelineData } from "@/app/types";

/**
 * Badge timeline API route.
 * Supports:
 * 1. Roblox Open Cloud Inventory API (using ROBLOX_OPEN_CLOUD_API_KEY / ROBLOX_API_KEY)
 * 2. Fallback to legacy Web API (using ROBLOX_COOKIE)
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchTimelineOpenCloud(userId: number, apiKey: string) {
  let pageToken: string | null = null;
  const timestamps: number[] = [];
  const OPEN_CLOUD_BASE = "https://apis.roblox.com/cloud/v2";

  // Check inventory visibility first
  const checkRes = await fetch(
    `${OPEN_CLOUD_BASE}/users/${userId}/inventory-items?filter=badges=true&maxPageSize=1`,
    {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    },
  );

  if (checkRes.status === 403) {
    return { canViewInventory: false, timeline: [], total: 0 };
  }

  do {
    const pageUrl: string =
      `${OPEN_CLOUD_BASE}/users/${userId}/inventory-items?filter=badges=true&maxPageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

    let res = await fetch(pageUrl, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    let retryAfter = 3000;
    while (res.status === 429) {
      await sleep(retryAfter);
      res = await fetch(pageUrl, {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });
      retryAfter += 3000;
    }

    if (!res.ok) {
      break;
    }

    const data = await res.json();
    for (const item of data.inventoryItems || []) {
      if (item.addTime) {
        const ts = new Date(item.addTime).getTime();
        if (!Number.isNaN(ts)) {
          timestamps.push(ts);
        }
      }
    }

    pageToken = data.nextPageToken || null;
  } while (pageToken);

  timestamps.sort((a, b) => a - b);

  const dailyCounts: Record<string, number> = {};
  for (const ts of timestamps) {
    const day = new Date(ts).toISOString().slice(0, 10);
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }

  const timeline: BadgeTimelineData[] = timestamps.map((ts, idx) => {
    const d = new Date(ts);
    return {
      date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      timestamp: ts,
      count: idx + 1,
      isFarming: dailyCounts[d.toISOString().slice(0, 10)] >= 50,
    };
  });

  return {
    canViewInventory: true,
    timeline,
    total: timestamps.length,
    missingDates: 0,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    // 1. Username -> userId
    const userRes = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (!userRes.ok) throw new Error("Failed to fetch user");
    const userData = await userRes.json();
    const userId: number | undefined = userData.data?.[0]?.id;
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Prioritize Open Cloud API Key
    const openCloudKey =
      process.env.ROBLOX_OPEN_CLOUD_API_KEY || process.env.ROBLOX_API_KEY;

    if (openCloudKey) {
      const result = await fetchTimelineOpenCloud(userId, openCloudKey);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "API Key Open Cloud belum dikonfigurasi di .env.local" },
      { status: 401 },
    );
  } catch (error) {
    console.error("Timeline error:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
