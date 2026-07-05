import type { RobloxProfileData, BadgeTimelineData, AvatarItem, AvatarValue, BannedFriendsData, BotAnalysis } from "../../../types";

// ─── Helpers ───────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  let diff = Math.floor((now - then) / 1000);

  if (diff < 0) return "just now";

  const years = Math.floor(diff / 31536000);
  diff -= years * 31536000;
  const months = Math.floor(diff / 2592000);
  diff -= months * 2592000;
  const days = Math.floor(diff / 86400);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0 && years === 0) parts.push(`${days}d`);

  return parts.length > 0 ? parts.join(" ") + " ago" : "today";
}

async function safeFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Roblox API Types (partial) ───────────────────────────

interface RobloxUserLookup {
  data: { requestedUsername: string; id: number; name: string }[];
}

interface RobloxUserDetails {
  id: number;
  name: string;
  displayName: string;
  created: string;
  description: string;
  isBanned: boolean;
}

interface RobloxUsernameHistory {
  data: { name: string }[];
}

interface RobloxCountResponse {
  count: number;
}

interface RobloxGroupRole {
  group: { id: number; name: string };
  role: { id: number; name: string; rank: number };
}

interface RobloxGroupsResponse {
  data: RobloxGroupRole[];
}

interface RobloxCollectible {
  recentAveragePrice?: number;
}

interface RobloxCollectiblesResponse {
  data: RobloxCollectible[];
}

interface RobloxBadge {
  id: number;
}

interface RobloxAvatarAsset {
  id: number;
  name: string;
  assetType: { id: number; name: string };
}

interface RobloxAvatarResponse {
  assets: RobloxAvatarAsset[];
  defaultShirtApplied: boolean;
  defaultPantsApplied: boolean;
  playerAvatarType: string;
}

interface RobloxEconomyAssetDetails {
  AssetId: number;
  Name: string;
  PriceInRobux: number | null;
  IsLimited: boolean;
  IsLimitedUnique: boolean;
  CollectiblesItemDetails?: {
    CollectibleLowestResalePrice: number | null;
  };
}

interface RobloxFriend {
  id: number;
  name: string;
  displayName: string;
}

interface RobloxFriendsListResponse {
  data: RobloxFriend[];
}

// ─── Username Similarity Helpers ──────────────────────────

function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function cleanUsername(name: string): string {
  let cleaned = name.toLowerCase();
  // Strip trailing numbers/underscores
  cleaned = cleaned.replace(/[\d_]+$/g, "");
  // Strip trailing alt keywords
  cleaned = cleaned.replace(/(alt|bot|clone|smurf)$/i, "");
  // Strip again in case format was e.g. "lxt_ammo1alt" -> "lxt_ammo1" -> "lxt_ammo"
  cleaned = cleaned.replace(/[\d_]+$/g, "");
  return cleaned;
}

function isSimilarUsername(baseName: string, friendName: string): boolean {
  if (!baseName || !friendName) return false;
  
  const b = baseName.toLowerCase();
  const f = friendName.toLowerCase();
  
  if (b === f) return false; 
  
  const cleanB = cleanUsername(b);
  const cleanF = cleanUsername(f);
  
  // Strategy 1: Shared root name with random suffix/numbers (e.g. foidgeedhc195 vs foidgeedhc107)
  if (cleanB.length >= 4 && cleanB === cleanF) {
    return true;
  }
  
  // Strategy 2: One contains the other with significant length
  if (cleanB.length >= 5 && cleanF.length >= 5) {
    if (cleanF.includes(cleanB) || cleanB.includes(cleanF)) {
      return true;
    }
  }

  // Strategy 3: Typo or small modification (Levenshtein distance <= 2) (e.g. jobertangaro vs joberttangaro)
  if (b.length >= 6 && f.length >= 6) {
    const dist = getLevenshteinDistance(b, f);
    if (dist <= 2 && Math.abs(b.length - f.length) <= 2) {
      return true;
    }
  }

  return false;
}

// ─── Mock AI Scoring Algorithm ────────────────────────────

function computeSuspicionScore(
  joinDate: string | null,
  friendsCount: number,
  followersCount: number,
  groupsTotal: number,
  baseRankPercentage: number,
  usernameChanges: number,
  totalAssets: number,
  groupsList: RobloxGroupRole[],
  bannedFriendsPercentage: number,
  isDefaultAvatar: boolean,
  botSignatures: string[],
  isLikelyBot: boolean,
  isLikelyAlt: boolean,
): { score: number; verdict: string; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Factor 1: Account age
  let ageDays = -1;
  if (joinDate) {
    ageDays = Math.floor(
      (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (ageDays < 30) {
      score += 30;
      factors.push("ACCOUNT_AGE: Created less than 30 days ago");
    } else if (ageDays < 180) {
      score += 15;
      factors.push("ACCOUNT_AGE: Created less than 6 months ago");
    } else if (ageDays > 365 * 3) {
      score -= 5;
    }
  }

  // Factor 2: Friend count anomaly
  if (friendsCount === 0) {
    score += 15;
    factors.push("ZERO_FRIENDS: No friends on account");
  } else if (friendsCount < 5) {
    score += 8;
    factors.push("LOW_FRIENDS: Less than 5 friends");
  }

  // Factor 3: Groups base rank ratio
  if (groupsTotal > 0 && baseRankPercentage > 80) {
    score += 10;
    factors.push(
      `HIGH_BASE_RANK: ${baseRankPercentage.toFixed(0)}% of groups at base rank`,
    );
  }

  // Factor 3.5: Suspicious Groups (Exploits, Scams, Condos)
  const suspiciousKeywords = [
    "condo", "scented", "con", "bypassed", "bypass", "rule34",
    "exploit", "executor", "script hub", "hack", "injector",
    "synapse x", "krnl", "fluxus", "arceus", "arceus x", "delta executor", "evon", "jjsploit", "sirhurt", "script-ware", "hoho hub",
    "free robux", "robux generator", "free generator", "roblox scam"
  ];
  let suspiciousGroups = 0;
  const flaggedGroupNames: string[] = [];

  groupsList.forEach((g) => {
    const groupNameLower = g.group.name.toLowerCase();
    for (const keyword of suspiciousKeywords) {
      if (groupNameLower.includes(keyword)) {
        suspiciousGroups++;
        flaggedGroupNames.push(g.group.name);
        break;
      }
    }
  });

  if (suspiciousGroups > 0) {
    score += Math.min(suspiciousGroups * 25, 100);
    factors.push(
      `SUSPICIOUS_GROUPS: Found in ${suspiciousGroups} flagged group(s) - [${flaggedGroupNames.slice(0, 3).join(", ")}${suspiciousGroups > 3 ? "..." : ""}]`,
    );
  }

  // Factor 4: Username changes
  if (usernameChanges > 3) {
    score += 12;
    factors.push(
      `MANY_NAME_CHANGES: ${usernameChanges} previous usernames`,
    );
  } else if (usernameChanges > 0) {
    score += 3;
    factors.push(`NAME_CHANGES: ${usernameChanges} previous username(s)`);
  }

  // Factor 5: Asset/age ratio anomaly
  if (ageDays < 90 && totalAssets > 50) {
    score += 20;
    factors.push("ASSET_ANOMALY: High asset count for young account");
  }

  // Factor 6: Follower/friend ratio
  if (friendsCount > 0 && followersCount / friendsCount > 50) {
    score += 10;
    factors.push(
      "FOLLOWER_RATIO: Unusually high follower-to-friend ratio",
    );
  }

  // Factor 7: Banned Friends
  if (bannedFriendsPercentage > 20) {
    score += 20;
    factors.push(
      `BANNED_FRIENDS: ${bannedFriendsPercentage.toFixed(0)}% of friends are terminated`,
    );
  } else if (bannedFriendsPercentage > 10) {
    score += 10;
    factors.push(
      `BANNED_FRIENDS: ${bannedFriendsPercentage.toFixed(0)}% of friends are terminated`,
    );
  }

  // Factor 8: Default Avatar
  if (isDefaultAvatar) {
    score += 5;
    factors.push("DEFAULT_AVATAR: Using default/stock avatar");
  }

  // Factor 9: Bot Signature
  if (isLikelyBot) {
    score += 30;
    factors.push(
      `BOT_SIGNATURE: ${botSignatures.join(", ")}`,
    );
  }

  // Factor 10: Alt Account Signature
  if (isLikelyAlt && !isLikelyBot) {
    score += 15;
    factors.push(
      `ALT_SIGNATURE: ${botSignatures.join(", ")}`,
    );
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let verdict: string;
  if (score <= 15) verdict = "LOW — Account appears legitimate";
  else if (score <= 40) verdict = "MODERATE — Some indicators present";
  else if (score <= 70) verdict = "ELEVATED — Multiple risk factors detected";
  else verdict = "HIGH — Significant anomalies detected";

  return { score, verdict, factors };
}

// ─── Route Handler ────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  if (!username || username.length < 1 || username.length > 30) {
    return Response.json({ error: "Invalid input length." }, { status: 400 });
  }

  let userId: number | null = null;
  let resolvedUsername = username.startsWith("@") ? username.slice(1) : username;

  // Step 1: Check if input is a numeric ID
  const isNumeric = /^\d+$/.test(resolvedUsername);

  if (isNumeric) {
    const userById = await safeFetch<RobloxUserDetails>(
      `https://users.roblox.com/v1/users/${resolvedUsername}`,
    );
    if (userById && !userById.isBanned) {
      userId = userById.id;
      resolvedUsername = userById.name;
    }
  }

  // Step 2: If not found or not numeric, resolve as username
  if (!userId) {
    const userLookup = await safeFetch<RobloxUserLookup>(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [resolvedUsername],
          excludeBannedUsers: false,
        }),
      },
    );

    if (userLookup?.data?.[0]) {
      userId = userLookup.data[0].id;
      resolvedUsername = userLookup.data[0].name;
    }
  }

  if (!userId) {
    return Response.json(
      { error: `User "${resolvedUsername}" not found.` },
      { status: 404 },
    );
  }
  const rawCookie = process.env.ROBLOX_COOKIE;
  const robloxCookie = rawCookie
    ? rawCookie.replace(/^"|"$|^'|'$/g, "")
    : undefined;
  const authHeaders: HeadersInit = robloxCookie
    ? {
        "Content-Type": "application/json",
        Cookie: `.ROBLOSECURITY=${robloxCookie}`,
      }
    : { "Content-Type": "application/json" };

  // Step 2: Parallel fetch all data
  const [
    userDetailsResult,
    usernameHistoryResult,
    friendsCountResult,
    followersCountResult,
    followingCountResult,
    groupsResult,
    presenceResult,
    avatarItemsResult,
    friendsListResult,
  ] = await Promise.allSettled([
    safeFetch<RobloxUserDetails>(`https://users.roblox.com/v1/users/${userId}`),
    safeFetch<RobloxUsernameHistory>(
      `https://users.roblox.com/v1/users/${userId}/username-history?limit=50&sortOrder=Asc`,
    ),
    safeFetch<RobloxCountResponse>(
      `https://friends.roblox.com/v1/users/${userId}/friends/count`,
    ),
    safeFetch<RobloxCountResponse>(
      `https://friends.roblox.com/v1/users/${userId}/followers/count`,
    ),
    safeFetch<RobloxCountResponse>(
      `https://friends.roblox.com/v1/users/${userId}/followings/count`,
    ),
    safeFetch<RobloxGroupsResponse>(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`,
    ),
    safeFetch<any>(`https://presence.roblox.com/v1/presence/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ userIds: [userId] }),
    }),
    safeFetch<RobloxAvatarResponse>(
      `https://avatar.roblox.com/v1/users/${userId}/avatar`,
    ),
    safeFetch<RobloxFriendsListResponse>(
      `https://friends.roblox.com/v1/users/${userId}/friends`,
    ),
  ]);

  // Inventory & Badges (sequential or separate parallel after userId is known)
  // Note: Inventory might be private, which will cause safeFetch to return null or throw. We handle it via a separate safe fetch or fetch call.
  let inventoryData: RobloxCollectiblesResponse | null = null;
  let inventoryIsPrivate = false;
  try {
    const invHeaders: HeadersInit = robloxCookie
      ? { Cookie: `.ROBLOSECURITY=${robloxCookie}` }
      : {};

    const invRes = await fetch(
      `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`,
      {
        headers: invHeaders,
        cache: "no-store",
      },
    );
    if (invRes.status === 403) {
      inventoryIsPrivate = true;
    } else if (invRes.ok) {
      inventoryData = await invRes.json();
    }
  } catch (err) {
    // ignore
  }

  const badgesData = await safeFetch<{ data?: RobloxBadge[] } | RobloxBadge[]>(
    `https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`,
  );

  const avatarRes = await safeFetch<{ data: { imageUrl: string }[] }>(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`,
  );
  const avatarUrl = avatarRes?.data?.[0]?.imageUrl ?? "";

  // Extract values with fallbacks
  const userDetails =
    userDetailsResult.status === "fulfilled" ? userDetailsResult.value : null;
  const usernameHistory =
    usernameHistoryResult.status === "fulfilled"
      ? usernameHistoryResult.value
      : null;
  const friendsData =
    friendsCountResult.status === "fulfilled" ? friendsCountResult.value : null;
  const followersData =
    followersCountResult.status === "fulfilled"
      ? followersCountResult.value
      : null;
  const followingData =
    followingCountResult.status === "fulfilled"
      ? followingCountResult.value
      : null;
  const groupsData =
    groupsResult.status === "fulfilled" ? groupsResult.value : null;
  const presenceDataRaw =
    presenceResult.status === "fulfilled" ? presenceResult.value : null;

  const joinDate = userDetails?.created || null;
  const pastNames = (usernameHistory?.data ?? []).map((e) => e.name).reverse();
  const currentUsername = userDetails?.name ?? resolvedUsername;
  const nameHistory = [...pastNames, `${currentUsername} (Current)`];
  const friendsCount = friendsData?.count ?? 0;
  const followersCount = followersData?.count ?? 0;
  const followingCount = followingData?.count ?? 0;

  // Groups analysis
  const groupsList = groupsData?.data ?? [];
  const groupsTotal = groupsList.length;
  const baseRankCount = groupsList.filter((g) => g.role.rank === 1).length;
  const baseRankPercentage =
    groupsTotal > 0 ? (baseRankCount / groupsTotal) * 100 : 0;

  const groupsDetails = groupsList.map((g: any) => ({
    id: g.group?.id,
    name: g.group?.name,
    rank: g.role?.rank,
    rankName: g.role?.name,
  }));

  // Real inventory & badges
  let totalAssets = 0;
  let estimatedInventoryValue = 0;

  if (inventoryData?.data) {
    totalAssets = inventoryData.data.length;
    estimatedInventoryValue = inventoryData.data.reduce(
      (sum, item) => sum + (item.recentAveragePrice || 0),
      0,
    );
  }

  let officialBadgesCount = 0;
  if (Array.isArray(badgesData)) {
    officialBadgesCount = badgesData.length;
  } else if (badgesData?.data) {
    officialBadgesCount = badgesData.data.length;
  }

  let playerBadgesCount: number | undefined = undefined;
  let isPlayerBadgesLimited = false;
  let badgeTimelineData: BadgeTimelineData[] | undefined = undefined;
  const rawBadgesCookie = process.env.ROBLOX_COOKIE;
  const badgesCookie = rawBadgesCookie
    ? rawBadgesCookie.replace(/^"|"$|^'|'$/g, "")
    : undefined;

  if (badgesCookie) {
    try {
      playerBadgesCount = 0;
      let url: string | null =
        `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc`;
      let pagesFetched = 0;

      const timelineMap: Record<string, number> = {};

      while (url) {
        const pBadgesRes: Response = await fetch(url, {
          headers: { Cookie: `.ROBLOSECURITY=${badgesCookie}` },
          next: { revalidate: 3600 },
        });

        if (!pBadgesRes.ok) break;

        const pBadgesData: any = await pBadgesRes.json();
        if (pBadgesData && pBadgesData.data) {
          playerBadgesCount += pBadgesData.data.length;

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

      // Timeline generation is now handled by a separate endpoint
      // to improve initial profile loading speed.
    } catch (e) {
      console.error("Error fetching player badges:", e);
    }
  }

  const totalBadges = officialBadgesCount + (playerBadgesCount || 0);

  let selfCreatedGamepassesCount = 0;
  let selfCreatedGamepassesValue = 0;
  try {
    let allGames: any[] = [];
    let nextPageCursor: string | null = "";

    while (nextPageCursor !== null) {
      const cursorParam: string = nextPageCursor ? `&cursor=${nextPageCursor}` : "";
      const gamesRes = await fetch(
        `https://games.roblox.com/v2/users/${userId}/games?limit=50&sortOrder=Asc${cursorParam}`,
        { next: { revalidate: 3600 } },
      );

      if (!gamesRes.ok) break;

      const gamesData = await gamesRes.json();
      if (gamesData && gamesData.data) {
        allGames = allGames.concat(gamesData.data);
      }

      nextPageCursor = gamesData.nextPageCursor || null;

      // Safety limit: max 500 games (10 pages) to prevent timeout
      if (allGames.length >= 500) break;
    }

    if (allGames.length > 0) {
      // Method 3: Throttling / Batching requests to avoid Rate Limit (429)
      const chunkSize = 5;
      for (let i = 0; i < allGames.length; i += chunkSize) {
        const chunk = allGames.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (game: any) => {
          try {
            const passesRes = await fetch(
              `https://apis.roblox.com/game-passes/v1/universes/${game.id}/game-passes?limit=100`,
              { next: { revalidate: 3600 } },
            );
            if (passesRes.ok) {
              const passesData = await passesRes.json();
              if (passesData && passesData.gamePasses) {
                selfCreatedGamepassesCount += passesData.gamePasses.length;

                // Fetch price for each gamepass (batch of 10)
                const passChunkSize = 10;
                for (
                  let p = 0;
                  p < passesData.gamePasses.length;
                  p += passChunkSize
                ) {
                  const pChunk = passesData.gamePasses.slice(
                    p,
                    p + passChunkSize,
                  );
                  await Promise.allSettled(
                    pChunk.map(async (pass: any) => {
                      try {
                        const priceRes = await fetch(
                          `https://apis.roblox.com/game-passes/v1/game-passes/${pass.id}/product-info`,
                          { next: { revalidate: 3600 } },
                        );
                        if (priceRes.ok) {
                          const priceData = await priceRes.json();
                          if (priceData.PriceInRobux) {
                            selfCreatedGamepassesValue +=
                              priceData.PriceInRobux;
                          }
                        }
                      } catch (e) {}
                    }),
                  );
                }
              }
            }
          } catch (err) {
            // ignore
          }
        });
        await Promise.allSettled(chunkPromises);

        // Small delay between chunks to keep Roblox API happy
        if (i + chunkSize < allGames.length) {
          await new Promise((res) => setTimeout(res, 300));
        }
      }
    }
  } catch (e) {
    console.error("Error fetching self created gamepasses:", e);
  }

  // ─── Avatar Value Estimator ────────────────────────────────
  const avatarItemsData =
    avatarItemsResult.status === "fulfilled" ? avatarItemsResult.value : null;

  let avatarValueResult: AvatarValue = {
    items: [],
    totalValue: 0,
    limitedCount: 0,
    isDefaultAvatar: false,
  };

  if (avatarItemsData) {
    // Detect default avatar
    avatarValueResult.isDefaultAvatar =
      avatarItemsData.defaultShirtApplied && avatarItemsData.defaultPantsApplied;

    // Fetch economy details for wearable accessories
    const pricedAssetTypes = new Set([
      8, 41, 42, 43, 44, 45, 46, 47, // Hat, HairAccessory, FaceAccessory, NeckAccessory, ShoulderAccessory, FrontAccessory, BackAccessory, WaistAccessory
      18, 19, 17, 2, // Face, Gear, Head, TShirt
    ]);

    const pricedAssets = avatarItemsData.assets.filter(a =>
      pricedAssetTypes.has(a.assetType.id)
    );

    const economyResults = await Promise.allSettled(
      pricedAssets.map(async (asset) => {
        const details = await safeFetch<RobloxEconomyAssetDetails>(
          `https://economy.roblox.com/v2/assets/${asset.id}/details`
        );
        return { asset, details };
      })
    );

    for (const result of economyResults) {
      if (result.status === "fulfilled" && result.value.details) {
        const { asset, details } = result.value;
        const resalePrice = details.CollectiblesItemDetails?.CollectibleLowestResalePrice ?? null;
        const price = details.PriceInRobux;
        const isLimited = details.IsLimited || details.IsLimitedUnique;
        const value = resalePrice ?? price ?? 0;

        if (value > 0 || isLimited) {
          avatarValueResult.items.push({
            id: asset.id,
            name: details.Name || asset.name,
            assetType: asset.assetType.name,
            isLimited,
            price,
            resalePrice,
          });
        }

        avatarValueResult.totalValue += value;
        if (isLimited) avatarValueResult.limitedCount++;
      }
    }

    // Sort by value descending
    avatarValueResult.items.sort((a, b) => {
      const aVal = a.resalePrice ?? a.price ?? 0;
      const bVal = b.resalePrice ?? b.price ?? 0;
      return bVal - aVal;
    });
  }

  // ─── Banned Friends Radar ─────────────────────────────────
  const friendsListData =
    friendsListResult.status === "fulfilled" ? friendsListResult.value : null;

  let bannedFriendsResult: BannedFriendsData = {
    totalFriends: friendsCount,
    bannedCount: 0,
    bannedPercentage: 0,
  };

  if (friendsListData?.data && friendsListData.data.length > 0) {
    const friendIds = friendsListData.data
      .filter((f) => f.id > 0)
      .map((f) => f.id);

    if (friendIds.length > 0) {
      const [allUsersResult, activeUsersResult] = await Promise.allSettled([
        safeFetch<{ data: { id: number }[] }>(
          "https://users.roblox.com/v1/users",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: friendIds, excludeBannedUsers: false }),
          }
        ),
        safeFetch<{ data: { id: number }[] }>(
          "https://users.roblox.com/v1/users",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: friendIds, excludeBannedUsers: true }),
          }
        ),
      ]);

      const allCount =
        allUsersResult.status === "fulfilled"
          ? allUsersResult.value?.data?.length ?? 0
          : 0;
      const activeCount =
        activeUsersResult.status === "fulfilled"
          ? activeUsersResult.value?.data?.length ?? 0
          : 0;

      bannedFriendsResult.bannedCount = allCount - activeCount;
      bannedFriendsResult.bannedPercentage =
        allCount > 0 ? (bannedFriendsResult.bannedCount / allCount) * 100 : 0;
    }
  }

  // ─── Bot & Alt Account Signature Analysis ─────────────────
  const botSignatures: string[] = [];
  let isLikelyBot = false;
  let isLikelyAlt = false;
  const similarUsernames: string[] = [];

  // Check 1: Default avatar
  if (avatarValueResult.isDefaultAvatar) {
    botSignatures.push("Default avatar (stock clothing)");
  }

  // Check 2: Bot-like username patterns
  const botPatterns = [
    /^(User|Player|Guest)_?\d{4,}$/i,
    /^[a-z]{2,4}\d{6,}$/i,
    /^\d{8,}$/,
    /^[a-z]+\d+[a-z]+\d+$/i,
  ];

  for (const pattern of botPatterns) {
    if (pattern.test(currentUsername)) {
      botSignatures.push("Bot-like username pattern");
      break;
    }
  }

  // Check 3: Combined signals for bot
  const ageDaysForBot = joinDate
    ? Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  if (
    ageDaysForBot >= 0 && ageDaysForBot < 30 &&
    friendsCount === 0 &&
    avatarValueResult.isDefaultAvatar
  ) {
    botSignatures.push("Young account + no friends + default avatar");
    isLikelyBot = true;
  } else if (
    ageDaysForBot >= 0 && ageDaysForBot < 90 &&
    friendsCount <= 2 &&
    avatarValueResult.isDefaultAvatar &&
    groupsTotal === 0
  ) {
    botSignatures.push("New account with minimal activity");
    isLikelyBot = true;
  }

  // Check 4: Similar usernames among friends (Alt detection)
  if (friendsListData?.data) {
    for (const friend of friendsListData.data) {
      if (!friend.name || friend.id <= 0) continue;
      
      if (isSimilarUsername(currentUsername, friend.name)) {
        similarUsernames.push(friend.name);
      }
    }
  }

  // Check 5: Global User Search for Alts
  try {
    const baseUsernameForSearch = cleanUsername(currentUsername);
    if (baseUsernameForSearch.length >= 4) { // Only search if base name is sufficiently unique
      const searchRes = await fetch(
        `https://users.roblox.com/v1/users/search?keyword=${baseUsernameForSearch}&limit=25`,
        { cache: "no-store", headers: authHeaders }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && searchData.data) {
          for (const searchUser of searchData.data) {
            if (
              searchUser.name.toLowerCase() !== currentUsername.toLowerCase() &&
              isSimilarUsername(currentUsername, searchUser.name)
            ) {
              similarUsernames.push(searchUser.name);
            }
          }
        }
      }
    }
  } catch (err) {
    // Ignore search errors
  }

  // Remove duplicates
  const uniqueSimilarUsernames = Array.from(new Set(similarUsernames));

  if (uniqueSimilarUsernames.length >= 1) {
    isLikelyAlt = true;
    botSignatures.push(
      `${uniqueSimilarUsernames.length} related alt accounts detected`
    );
  }

  const botAnalysisResult: BotAnalysis = {
    isLikelyBot,
    isLikelyAlt,
    signatures: botSignatures,
    similarUsernames: uniqueSimilarUsernames,
  };

  // AI Analysis
  const aiAnalysis = computeSuspicionScore(
    joinDate,
    friendsCount,
    followersCount,
    groupsTotal,
    baseRankPercentage,
    pastNames.length,
    totalAssets,
    groupsList,
    bannedFriendsResult.bannedPercentage,
    avatarValueResult.isDefaultAvatar,
    botSignatures,
    isLikelyBot,
    isLikelyAlt,
  );

  const profileData: RobloxProfileData = {
    userId,
    username: userDetails?.name ?? resolvedUsername,
    displayName: userDetails?.displayName ?? resolvedUsername,
    avatarUrl,
    joinDate: joinDate || "Unknown",
    joinDateAgo: joinDate ? timeAgo(joinDate) : "Unknown",
    nameHistory,
    connections: {
      friends: friendsCount,
      followers: followersCount,
      following: followingCount,
    },
    groups: {
      total: groupsTotal,
      baseRankCount,
      baseRankPercentage: Math.round(baseRankPercentage * 10) / 10,
      details: groupsDetails,
    },
    inventory: {
      isPrivate: inventoryIsPrivate,
      totalAssets,
      estimatedValue: estimatedInventoryValue,
    },
    badges: {
      official: officialBadgesCount,
      player: playerBadgesCount,
      total: totalBadges,
      isPlayerBadgesLimited,
      timeline: badgeTimelineData,
    },
    gamepasses: {
      createdCount: selfCreatedGamepassesCount,
      createdValue: selfCreatedGamepassesValue,
    },
    avatarValue: avatarValueResult,
    bannedFriends: bannedFriendsResult,
    botAnalysis: botAnalysisResult,
    aiAnalysis,
    presence: {
      isOnline:
        (presenceDataRaw?.userPresences?.[0]?.userPresenceType ?? 0) !== 0,
      userPresenceType:
        presenceDataRaw?.userPresences?.[0]?.userPresenceType ?? 0,
      lastLocation:
        presenceDataRaw?.userPresences?.[0]?.lastLocation ?? "Offline",
      placeId: presenceDataRaw?.userPresences?.[0]?.placeId ?? null,
      gameId: presenceDataRaw?.userPresences?.[0]?.gameId ?? null,
      joinable:
        presenceDataRaw?.userPresences?.[0]?.userPresenceType === 2 &&
        presenceDataRaw?.userPresences?.[0]?.gameId !== null,
      joinsOff:
        presenceDataRaw?.userPresences?.[0]?.userPresenceType === 2 &&
        presenceDataRaw?.userPresences?.[0]?.gameId === null,
    },
  };

  return Response.json(profileData);
}
