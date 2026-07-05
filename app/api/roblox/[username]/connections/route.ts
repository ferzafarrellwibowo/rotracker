import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // 'friends', 'followers', 'following'

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  if (!type || !["friends", "followers", "following"].includes(type)) {
    return NextResponse.json({ error: "Invalid connection type" }, { status: 400 });
  }

  try {
    // 1. Resolve username to userId
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

    const rawCookie = process.env.ROBLOX_COOKIE || "";
    const cookie = rawCookie.replace(/^"|"$|^'|'$/g, "");
    const headers: Record<string, string> = cookie ? { Cookie: `.ROBLOSECURITY=${cookie}` } : {};

    // 2. Fetch connections IDs
    let ids: number[] = [];
    if (type === "friends") {
      const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends`, { headers, next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        ids = (data.data || []).map((u: any) => u.id);
      }
    } else {
      const endpoint = type === "followers" ? "followers" : "followings";
      const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/${endpoint}?limit=100&sortOrder=Desc`, { headers, next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        ids = (data.data || []).map((u: any) => u.id);
      } else {
        console.error(`Failed to fetch ${type}:`, await res.text());
      }
    }

    // Filter out ghost accounts (deleted/banned accounts typically have ID -1 or 0)
    ids = ids.filter(id => id > 0);

    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 3. Fetch Usernames
    const usersRes = await fetch("https://users.roblox.com/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: ids, excludeBannedUsers: false }),
      next: { revalidate: 3600 },
    });
    
    let usersMap: Record<number, { name: string, displayName: string }> = {};
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      (usersData.data || []).forEach((u: any) => {
        usersMap[u.id] = { name: u.name, displayName: u.displayName };
      });
    }

    // 4. Fetch Avatars
    // Max 100 per request, which matches our limit
    const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=false`;
    const avatarRes = await fetch(avatarUrl, { next: { revalidate: 3600 } });
    
    let avatarsMap: Record<number, string> = {};
    if (avatarRes.ok) {
      const avatarData = await avatarRes.json();
      (avatarData.data || []).forEach((a: any) => {
        avatarsMap[a.targetId] = a.imageUrl;
      });
    }

    // 5. Combine Data
    const result = ids.map(id => ({
      id,
      name: usersMap[id]?.name || "Unknown",
      displayName: usersMap[id]?.displayName || "Unknown",
      avatarUrl: avatarsMap[id] || "",
    }));

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error("Connections API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
