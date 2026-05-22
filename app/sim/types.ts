import type { MapAction } from "@/lib/tools/types";

export type Step = "profile" | "neighborhood" | "sim";
export type SceneMode = "street" | "map";
export type RunState = "idle" | "running" | "paused" | "done";
export type MobilePanel = "map" | "advisor" | "timeline";
export type AuthPromptReason = "chat" | "year";

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
