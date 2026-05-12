import type { ChatMessage } from "@/lib/tools/types";

export type SimMessageKind = "opener" | "answer" | "user" | "thinking";

export interface SimMessage extends ChatMessage {
  month: number;
  year: number;
  kind: SimMessageKind;
}

export interface SimMessageMonthGroup {
  key: string;
  month: number;
  year: number;
  messages: SimMessage[];
}

export function monthGroupKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function groupMessagesByMonth(messages: SimMessage[]): SimMessageMonthGroup[] {
  const groups = new Map<string, SimMessageMonthGroup>();

  for (const message of messages) {
    const key = monthGroupKey(message.month, message.year);
    const group = groups.get(key);
    if (group) {
      group.messages.push(message);
    } else {
      groups.set(key, {
        key,
        month: message.month,
        year: message.year,
        messages: [message],
      });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    messages: [...group.messages].sort((a, b) => {
      if (a.kind === "opener" && b.kind !== "opener") return -1;
      if (a.kind !== "opener" && b.kind === "opener") return 1;
      return 0;
    }),
  }));
}

export function toChatHistory(messages: SimMessage[], limit = 12): ChatMessage[] {
  return messages
    .filter((message) => message.kind !== "thinking")
    .map(({ role, content }) => ({ role, content }))
    .slice(-limit);
}
