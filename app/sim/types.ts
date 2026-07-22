import type { MapAction } from "@/lib/tools/types";

export type Step = "profile" | "neighborhood" | "sim";
export type SceneMode = "street" | "map" | "city3d";
export type RunState = "idle" | "running" | "paused" | "done";
// Idle-mode presentation: the season-ticket interstitial (default after picking
// a neighborhood) or the debrief/Q&A two-panel screen.
export type IdleView = "interstitial" | "debrief";
export type MobilePanel = "map" | "advisor" | "seasons";
export type AuthPromptReason = "chat" | "year";

export type SimAct = 1 | 2 | 3 | 4;
export type ActSeason = "spring" | "summer" | "autumn" | "winter";
export const ACT_SEASON: Record<SimAct, ActSeason> = { 1: "spring", 2: "summer", 3: "autumn", 4: "winter" };
export const ACT_MONTH: Record<SimAct, number> = { 1: 4, 2: 7, 3: 10, 4: 1 };
export const SEASON_ORDER: SimAct[] = [1, 2, 3, 4];
// Reverse of ACT_MONTH — which act a chat-context month belongs to.
export const MONTH_TO_ACT: Partial<Record<number, SimAct>> = { 4: 1, 7: 2, 10: 3, 1: 4 };

export interface AgentResponse {
  response?: string;
  toolsUsed?: string[];
  mapActions?: MapAction[];
  sessionId?: string;
  error?: string;
}

export interface NeighborhoodMatch {
  communityAreaNumber: number;
  name: string;
  slug: string;
  descriptors: string[];
  matchReason: string;
}
