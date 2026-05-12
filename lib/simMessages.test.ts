import assert from "node:assert/strict";
import test from "node:test";

import { groupMessagesByMonth, toChatHistory, type SimMessage } from "./simMessages";

const messages: SimMessage[] = [
  { role: "user", content: "How is transit?", month: 10, year: 2024, kind: "user" },
  { role: "assistant", content: "October answer", month: 10, year: 2024, kind: "answer" },
  { role: "assistant", content: "October opener", month: 10, year: 2024, kind: "opener" },
  { role: "assistant", content: "November opener", month: 11, year: 2024, kind: "opener" },
  { role: "assistant", content: "Sam is thinking...", month: 11, year: 2024, kind: "thinking" },
];

test("month grouping keeps opener at the start of its month chapter", () => {
  const groups = groupMessagesByMonth(messages);
  const october = groups.find((group) => group.month === 10);

  assert.ok(october);
  assert.equal(october.messages[0].kind, "opener");
  assert.equal(october.messages[0].content, "October opener");
});

test("chat history strips UI-only message metadata", () => {
  const history = toChatHistory(messages);

  assert.deepEqual(history, [
    { role: "user", content: "How is transit?" },
    { role: "assistant", content: "October answer" },
    { role: "assistant", content: "October opener" },
    { role: "assistant", content: "November opener" },
  ]);
});
