import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  type DreamInput,
  type Interpretation,
  InterpretationSchema,
  type InterpreterMode,
} from "../shared/schemas";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";

export interface Interpreter {
  readonly mode: InterpreterMode;
  interpret(input: DreamInput): Promise<Interpretation>;
}

export type InterpretationErrorKind = "refusal" | "invalid_output" | "upstream";

export class InterpretationError extends Error {
  constructor(
    message: string,
    readonly kind: InterpretationErrorKind,
  ) {
    super(message);
    this.name = "InterpretationError";
  }
}

export const DEFAULT_MODEL = "claude-opus-5-5";

/** Server-side refusal fallbacks are not offered for Haiku models. */
const supportsServerFallback = (model: string) => !model.startsWith("claude-haiku");

export class LlmInterpreter implements Interpreter {
  readonly mode = "live" as const;

  constructor(
    private readonly client: Anthropic,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async interpret(input: DreamInput): Promise<Interpretation> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // `low` keeps the morning flow fast; raise it if quality needs it.
        output_config: { effort: "low", format: zodOutputFormat(InterpretationSchema) },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserMessage(input) }],
        // If a safety classifier declines a benign dream, retry on Anthropic's
        // recommended fallback model instead of failing the request.
        ...(supportsServerFallback(this.model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new InterpretationError(`AI API error ${error.status ?? "?"}`, "upstream");
      }
      throw error;
    }

    if (response.stop_reason === "refusal") {
      throw new InterpretationError("The model declined this dream", "refusal");
    }
    if (response.stop_reason === "max_tokens") {
      throw new InterpretationError("The interpretation was cut off", "invalid_output");
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return parseInterpretation(text);
  }
}

export function parseInterpretation(text: string): Interpretation {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InterpretationError("The model did not return JSON", "invalid_output");
  }
  const parsed = InterpretationSchema.safeParse(json);
  if (!parsed.success) {
    throw new InterpretationError("The model returned an unexpected shape", "invalid_output");
  }
  return parsed.data;
}

/**
 * Deterministic stand-in used when no API key is configured (local dev, tests,
 * preview environments). Never used in production once the secret is set.
 */
export class MockInterpreter implements Interpreter {
  readonly mode = "mock" as const;

  async interpret(input: DreamInput): Promise<Interpretation> {
    const firstWords = input.text.split(/\s+/).slice(0, 4).join(" ");
    const showPsych = input.lens !== "folk";
    const showFolk = input.lens !== "psychology";
    return {
      title: "Giấc mơ thử nghiệm",
      summary: `Đây là bài giải mẫu (chế độ mock) cho giấc mơ bắt đầu bằng "${firstWords}".`,
      symbols: [
        {
          name: "Biểu tượng mẫu",
          psychology: showPsych ? "Góc tâm lý sẽ xuất hiện ở đây khi kết nối API AI." : "",
          folk: showFolk ? "Góc dân gian Việt sẽ xuất hiện ở đây khi kết nối API AI." : "",
        },
      ],
      lifeConnection: "Thêm ANTHROPIC_API_KEY vào .dev.vars để nhận bài giải thật.",
      reflectionQuestion: "Điều gì trong giấc mơ khiến bạn nhớ nhất khi vừa tỉnh dậy?",
      todayMessage: "Uống một cốc nước và hít thở sâu ba lần trước khi bắt đầu ngày mới.",
      distressSignal: false,
    };
  }
}

export function createInterpreter(apiKey: string | undefined, model: string | undefined): Interpreter {
  if (!apiKey) return new MockInterpreter();
  return new LlmInterpreter(new Anthropic({ apiKey }), model || DEFAULT_MODEL);
}
