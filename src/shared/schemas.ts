import { z } from "zod";

export const MOODS = ["scared", "sad", "peaceful", "confused", "happy"] as const;
export const CONCERNS = ["work", "love", "family", "health", "money", "study"] as const;
export const LENSES = ["psychology", "folk", "both"] as const;

export type Mood = (typeof MOODS)[number];
export type Concern = (typeof CONCERNS)[number];
export type Lens = (typeof LENSES)[number];

export const DREAM_TEXT_MIN = 10;
export const DREAM_TEXT_MAX = 4000;

/** What the client sends when telling a dream. */
export const DreamInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(DREAM_TEXT_MIN, "Kể thêm một chút nữa nhé (ít nhất 10 ký tự).")
    .max(DREAM_TEXT_MAX, "Giấc mơ dài quá, bạn rút gọn dưới 4000 ký tự nhé."),
  mood: z.enum(MOODS).optional(),
  concern: z.enum(CONCERNS).optional(),
  lens: z.enum(LENSES).default("both"),
});

export type DreamInput = z.output<typeof DreamInputSchema>;
export type DreamInputPayload = z.input<typeof DreamInputSchema>;

/**
 * The 6-part interpretation (see docs/KE-HOACH-SAN-PHAM.md, section 4).
 * Also used as the structured-output schema for the AI API call.
 */
export const InterpretationSchema = z.object({
  title: z.string().describe("Tên gợi hình cho giấc mơ, 2–7 chữ"),
  summary: z.string().describe("Một câu tóm ý giấc mơ đang nói gì"),
  symbols: z
    .array(
      z.object({
        name: z.string().describe("Tên biểu tượng, ví dụ: Răng rụng"),
        psychology: z.string().describe("Góc tâm lý, rỗng nếu người dùng chỉ chọn góc dân gian"),
        folk: z.string().describe("Góc dân gian Việt, rỗng nếu người dùng chỉ chọn góc tâm lý"),
      }),
    )
    .describe("2 đến 4 biểu tượng chính"),
  lifeConnection: z.string().describe("Liên hệ với hoàn cảnh hiện tại của người dùng"),
  reflectionQuestion: z.string().describe("Một câu hỏi mở để tự suy ngẫm"),
  todayMessage: z.string().describe("Một việc nhỏ, cụ thể, tích cực nên làm hôm nay"),
  distressSignal: z
    .boolean()
    .describe(
      "true chỉ khi người dùng bày tỏ ý định tự hại hoặc khủng hoảng ở ĐỜI THỰC (không phải nội dung trong giấc mơ)",
    ),
});

export type Interpretation = z.infer<typeof InterpretationSchema>;

export type NoticeKind = "crisis" | "lottery";

export interface Notice {
  kind: NoticeKind;
  message: string;
}

export interface DreamRecord {
  id: string;
  createdAt: string;
  text: string;
  mood: Mood | null;
  concern: Concern | null;
  lens: Lens;
  /** null when the interpretation was withheld (e.g. a crisis notice was shown instead). */
  interpretation: Interpretation | null;
  notices: Notice[];
}

export type InterpreterMode = "live" | "mock";

export interface CreateDreamResponse {
  dream: DreamRecord;
  mode: InterpreterMode;
}

export interface ListDreamsResponse {
  dreams: DreamRecord[];
}

export interface ApiError {
  error: string;
  details?: string[];
}
