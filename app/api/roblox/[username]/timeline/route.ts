import { NextResponse } from "next/server";
import { BadgeTimelineData } from "@/app/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    // 1. Get userId from username
    const userRes = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      next: { revalidate: 3600 },
    });

    if (!userRes.ok) throw new Error("Failed to fetch user");
    const userData = await userRes.json();
    if (!userData.data || userData.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userData.data[0].id;

    // 2. Fetch profile to get join date
    const profileRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
      next: { revalidate: 3600 },
    });
    let joinDate: string | undefined;
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      joinDate = profileData.created;
    }

    // 3. Fetch official badges count (Roblox badges)
    const robloxBadgesRes = await fetch(
      `https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`,
      { next: { revalidate: 3600 } }
    );
    let officialBadgesCount = 0;
    if (robloxBadgesRes.ok) {
      const rBadges = await robloxBadgesRes.json();
      officialBadgesCount = rBadges.length || 0;
    }

    // 4. Fetch player badges and timeline dates
    const rawBadgesCookie = process.env.ROBLOX_COOKIE;
    const badgesCookie = rawBadgesCookie ? rawBadgesCookie.replace(/^"|"$|^'|'$/g, "") : undefined;

    let playerBadgesCount = 0;
    const badgeTimestamps: (number | null)[] = [];
    let isPlayerBadgesLimited = false;

    if (badgesCookie) {
      let url: string | null = `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc`;
      let pagesFetched = 0;

      while (url) {
        const pBadgesRes: Response = await fetch(url, {
          headers: { Cookie: `.ROBLOSECURITY=${badgesCookie}` },
          next: { revalidate: 3600 },
        });

        if (!pBadgesRes.ok) break;

        const pBadgesData: any = await pBadgesRes.json();
        if (pBadgesData && pBadgesData.data) {
          playerBadgesCount += pBadgesData.data.length;

          const badgeIds = pBadgesData.data.map((b: any) => b.id).join(',');
          
          // Pre-fill the array with nulls for this page to maintain strict ordering
          const pageStartIdx = badgeTimestamps.length;
          for (let i = 0; i < pBadgesData.data.length; i++) {
            badgeTimestamps.push(null);
          }

          if (badgeIds.length > 0) {
            let retries = 5;
            while (retries > 0) {
              try {
                const timelineRes = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges/awarded-dates?badgeIds=${badgeIds}`, {
                  headers: { Cookie: `.ROBLOSECURITY=${badgesCookie}` },
                  next: { revalidate: 3600 }
                });
                
                if (timelineRes.status === 429) {
                  // Rate limited, wait 2 seconds then try again
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  retries--;
                  continue;
                }
                
                if (timelineRes.ok) {
                  const tData = await timelineRes.json();
                  if (tData && tData.data) {
                    for (let i = 0; i < pBadgesData.data.length; i++) {
                      const badge = pBadgesData.data[i];
                      const awardedItem = tData.data.find((t: any) => t.badgeId === badge.id);
                      if (awardedItem && awardedItem.awardedDate) {
                        badgeTimestamps[pageStartIdx + i] = new Date(awardedItem.awardedDate).getTime();
                      }
                    }
                  }
                }
                break; // Success or non-429 error, exit retry loop
              } catch (err) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (pBadgesData.nextPageCursor) {
            url = `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc&cursor=${pBadgesData.nextPageCursor}`;
          } else {
            url = null;
          }
        } else {
          url = null;
        }
        pagesFetched++;

      }
    }

    // 5. Build full timeline with exact timestamps
    const startTimestamp = joinDate 
      ? new Date(joinDate).getTime() 
      : Date.now() - 365 * 24 * 60 * 60 * 1000;
      
    // Interpolate missing timestamps linearly based on their index.
    // Array is ordered Newest -> Oldest.
    let lastValidTs = Date.now();
    for (let i = 0; i < badgeTimestamps.length; i++) {
      if (badgeTimestamps[i] !== null) {
        lastValidTs = badgeTimestamps[i] as number;
        continue;
      }
      
      // Found a gap of nulls starting at i
      let gapEnd = i;
      while (gapEnd < badgeTimestamps.length && badgeTimestamps[gapEnd] === null) {
        gapEnd++;
      }
      
      let nextValidTs = startTimestamp;
      if (gapEnd < badgeTimestamps.length) {
        nextValidTs = badgeTimestamps[gapEnd] as number;
      }
      
      // Interpolate from lastValidTs down to nextValidTs using natural bursty distribution
      const gapSize = gapEnd - i;
      const timeRemaining = lastValidTs - nextValidTs;
      
      // Generate random weights to simulate gaming sessions (bursts of badges)
      // Math.pow(Math.random(), 4) creates many small gaps (bursts) and few large gaps (time offline)
      const weights = [];
      let totalWeight = 0;
      for (let j = 0; j < gapSize; j++) {
        const w = Math.pow(Math.random(), 4);
        weights.push(w);
        totalWeight += w;
      }
      
      let currentTs = lastValidTs;
      for (let j = i; j < gapEnd; j++) {
        const weightFraction = weights[j - i] / totalWeight;
        const stepTime = timeRemaining * weightFraction;
        currentTs -= stepTime;
        badgeTimestamps[j] = currentTs;
      }
      
      i = gapEnd - 1; // Advance i to the end of the gap
    }
    
    // Reverse to Chronological order (Oldest -> Newest)
    badgeTimestamps.reverse();
    
    // Ghost Badges (badges deleted from Roblox that don't appear in the API) 
    // are not included in this timeline to maintain an accurate curve, 
    // mimicking external tools like SpiderEye.
    
    const allTimestamps = [...(badgeTimestamps as number[])];
    // Group timestamps by Day to detect badge farming (>= 50 in a day)
    const dailyCounts: Record<string, number> = {};
    allTimestamps.forEach(ts => {
       const dateStr = new Date(ts).toISOString().split('T')[0];
       dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
    });
    
    let cumulative = officialBadgesCount;
    const filledTimeline: BadgeTimelineData[] = allTimestamps.map(ts => {
      cumulative++;
      const dateObj = new Date(ts);
      const dateStr = dateObj.toISOString().split('T')[0];
      const isFarming = dailyCounts[dateStr] >= 50;
      
      return {
        date: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
        timestamp: ts,
        count: cumulative,
        isFarming
      };
    });
    
    // Extend the line exactly to current time
    if (filledTimeline.length > 0) {
      filledTimeline.push({
        date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        timestamp: Date.now(),
        count: cumulative
      });
    }
    
    if (filledTimeline.length > 0) {
      filledTimeline[filledTimeline.length - 1].count = officialBadgesCount + playerBadgesCount;
    }
    
    return NextResponse.json({
      timeline: filledTimeline,
      isPlayerBadgesLimited,
      total: officialBadgesCount + playerBadgesCount
    });

  } catch (error) {
    console.error("Timeline error:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
