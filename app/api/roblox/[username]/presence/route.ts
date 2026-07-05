import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    let userId: number | null = null;
    const isNumeric = /^\d+$/.test(username);

    if (isNumeric) {
      const userByIdRes = await fetch(`https://users.roblox.com/v1/users/${username}`);
      if (userByIdRes.ok) {
        const userById = await userByIdRes.json();
        if (!userById.isBanned) userId = userById.id;
      }
    }

    if (!userId) {
      const userLookupRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      });
      if (userLookupRes.ok) {
        const userLookup = await userLookupRes.json();
        if (userLookup?.data?.[0]) userId = userLookup.data[0].id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rawCookie = process.env.ROBLOX_COOKIE;
    const robloxCookie = rawCookie ? rawCookie.replace(/^"|"$|^'|'$/g, "") : undefined;
    const authHeaders: HeadersInit = robloxCookie
      ? {
          "Content-Type": "application/json",
          Cookie: `.ROBLOSECURITY=${robloxCookie}`,
        }
      : { "Content-Type": "application/json" };

    const presenceRes = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ userIds: [userId] }),
    });

    if (!presenceRes.ok) {
      throw new Error("Failed to fetch presence");
    }

    const presenceData = await presenceRes.json();
    const presence = presenceData?.userPresences?.[0] || {};
    
    const parsedPresence = {
      isOnline: presence.userPresenceType !== 0,
      userPresenceType: presence.userPresenceType || 0,
      lastLocation: presence.lastLocation || "",
      placeId: presence.placeId || null,
      gameId: presence.gameId || null,
      joinable: presence.userPresenceType === 2 && !!presence.gameId && !!presence.placeId,
      joinsOff: presence.userPresenceType === 2 && (!presence.gameId || !presence.placeId),
    };

    return NextResponse.json(parsedPresence);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
