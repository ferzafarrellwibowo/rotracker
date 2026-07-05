export interface RobloxConnections {
  friends: number;
  followers: number;
  following: number;
}

export interface ConnectionData {
  id: number;
  name: string;
  displayName: string;
  avatarUrl: string;
}

export interface RobloxGroupDetail {
  id: number;
  name: string;
  rank: number;
  rankName: string;
}

export interface RobloxPresence {
  isOnline: boolean;
  userPresenceType: number;
  lastLocation: string;
  placeId: number | null;
  gameId: string | null;
  joinable: boolean;
  joinsOff: boolean;
}

export interface RobloxGroups {
  total: number;
  baseRankCount: number;
  baseRankPercentage: number;
  details?: RobloxGroupDetail[];
}

export interface RobloxInventory {
  isPrivate?: boolean;
  totalAssets: number;
  estimatedValue: number;
}

export interface BadgeTimelineData {
  date: string; // e.g., "2022-01", "2023", etc.
  timestamp?: number; // exact ms timestamp for scatter-plot like plotting
  count: number;
  isFarming?: boolean;
}

export interface RobloxBadges {
  official: number;
  player?: number;
  total: number;
  isPlayerBadgesLimited?: boolean;
  timeline?: BadgeTimelineData[];
}

export interface RobloxGamepasses {
  createdCount: number;
  createdValue: number;
}

export interface AvatarItem {
  id: number;
  name: string;
  assetType: string;
  isLimited: boolean;
  price: number | null;
  resalePrice: number | null;
}

export interface AvatarValue {
  items: AvatarItem[];
  totalValue: number;
  limitedCount: number;
  isDefaultAvatar: boolean;
}

export interface BannedFriendsData {
  totalFriends: number;
  bannedCount: number;
  bannedPercentage: number;
}

export interface BotAnalysis {
  isLikelyBot: boolean;
  isLikelyAlt: boolean;
  signatures: string[];
  similarUsernames: string[];
}

export interface AIAnalysis {
  score: number;
  verdict: string;
  factors: string[];
}

export interface RobloxProfileData {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  joinDate: string;
  joinDateAgo: string;
  nameHistory: string[];
  connections: RobloxConnections;
  groups: RobloxGroups;
  inventory: RobloxInventory;
  badges: RobloxBadges;
  gamepasses?: RobloxGamepasses;
  avatarValue?: AvatarValue;
  bannedFriends?: BannedFriendsData;
  botAnalysis?: BotAnalysis;
  aiAnalysis: AIAnalysis;
  presence: RobloxPresence;
}

export interface APIErrorResponse {
  error: string;
  details?: string;
}
