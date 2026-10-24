import fs from "fs";
import path from "path";

// Simple .env.local loader
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const appId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID; // Optional: for instant guild command testing

if (!appId || !botToken) {
  console.error("❌ Error: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set in .env.local");
  process.exit(1);
}

const commands = [
  {
    name: "lookup",
    description: "Investigate a Roblox user profile, AI suspicion score, and badges",
    options: [
      {
        name: "username",
        description: "Roblox username or user ID to investigate",
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

console.log(`Registering slash commands to ${guildId ? `guild ${guildId}` : "global Discord"}...`);

try {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ Failed to register commands (${res.status}):`, errText);
    process.exit(1);
  }

  const data = await res.json();
  console.log("✅ Successfully registered slash command(s):");
  for (const cmd of data) {
    console.log(`   - /${cmd.name}: ${cmd.description}`);
  }
} catch (err) {
  console.error("❌ Network or execution error:", err);
  process.exit(1);
}
