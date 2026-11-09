import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { DreamInput, Interpretation } from "../src/shared/schemas";
import {
  LlmInterpreter,
  createInterpreter,
  InterpretationError,
  MockInterpreter,
  parseInterpretation,
} from "../src/worker/interpreter";
import { buildUserMessage, SYSTEM_PROMPT } from "../src/worker/prompt";

const input: DreamInput = {
  text: "Mơ đang thuyết trình trước sếp thì răng rụng từng cái",
  mood: "scared",
  concern: "work",
  lens: "both",
};

const sample: Interpretation = {
  title: "Lời nói rơi rụng",
  summary: "Bạn đang sợ mình nói sai trước người quan trọng.",
  symbols: [{ name: "Răng rụng", psychology: "Lo về hình ảnh bản thân.", folk: "Lời nhắc quan tâm gia đình." }],
  lifeConnection: "Áp lực công việc đang theo bạn vào giấc ngủ.",
  reflectionQuestion: "Điều tệ nhất có thể xảy ra thật sự là gì?",
  todayMessage: "Nói to phần mở đầu một lần trước cuộc họp.",
  distressSignal: false,
};

function fakeClient(response: Partial<Anthropic.Beta.BetaMessage>) {
  const create = vi.fn().mockResolvedValue({
    content: [],
    stop_reason: "end_turn",
    ...response,
  });
  const client = { beta: { messages: { create } } } as unknown as Anthropic;
  return { client, create };
}

describe("buildUserMessage", () => {
  it("includes labels and wraps the dream as data", () => {
    const msg = buildUserMessage(input);
    expect(msg).toContain("Sợ hãi");
    expect(msg).toContain("Công việc");
    expect(msg).toContain("<giac_mo>\nMơ đang thuyết trình");
  });

  it("keeps the system prompt free of volatile content so it stays cacheable", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("LlmInterpreter", () => {
  it("parses a structured response", async () => {
    const { client, create } = fakeClient({
      content: [{ type: "text", text: JSON.stringify(sample), citations: null }],
    });
    const result = await new LlmInterpreter(client, "claude-opus-5-5").interpret(input);
    expect(result).toEqual(sample);

    const params = create.mock.calls[0]?.[0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.output_config.format.type).toBe("json_schema");
  });

  it("omits server fallbacks for Haiku models", async () => {
    const { client, create } = fakeClient({
      content: [{ type: "text", text: JSON.stringify(sample), citations: null }],
    });
    await new LlmInterpreter(client, "claude-haiku-5-5").interpret(input);
    expect(create.mock.calls[0]?.[0].fallbacks).toBeUndefined();
  });

  it("turns a refusal into an InterpretationError", async () => {
    const { client } = fakeClient({ stop_reason: "refusal" });
    await expect(new LlmInterpreter(client).interpret(input)).rejects.toMatchObject({
      name: "InterpretationError",
      kind: "refusal",
    });
  });
});

describe("parseInterpretation", () => {
  it("rejects non-JSON and wrong shapes", () => {
    expect(() => parseInterpretation("not json")).toThrow(InterpretationError);
    expect(() => parseInterpretation(JSON.stringify({ title: "x" }))).toThrow(InterpretationError);
  });
});

describe("createInterpreter", () => {
  it("uses the mock without an API key", () => {
    expect(createInterpreter(undefined, undefined)).toBeInstanceOf(MockInterpreter);
    expect(createInterpreter("sk-test", undefined).mode).toBe("live");
  });
});
