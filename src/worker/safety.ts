import type { Notice } from "../shared/schemas";

/**
 * Keyword screens that run before (crisis) and around (lottery) the model call.
 * They are a first line only: the model also returns `distressSignal`, which
 * catches cases these lists miss. Dreams often contain death or violence, so
 * the crisis list targets first-person, real-life intent, not dream imagery.
 */

const normalize = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ");

const CRISIS_PATTERNS: readonly RegExp[] = [
  /(tôi|em|mình|tao|tớ) (thật sự |thực sự |đang |rất )?muốn chết/,
  /(muốn|định|sẽ|đang nghĩ đến|nghĩ tới|nghĩ đến) (việc )?(tự tử|tự sát)/,
  /không muốn sống nữa/,
  /muốn kết thúc cuộc (đời|sống)/,
  /tự làm (hại|đau) (bản thân|mình)/,
  /(muốn|định) (rạch|cắt) tay/,
];

const LOTTERY_PATTERNS: readonly RegExp[] = [
  /số đề/,
  /lô đề/,
  /đánh (đề|lô)/,
  /ghi (đề|lô)/,
  /xổ số/,
  /\bxs ?m[bnt]\b/,
  /(con )?số may mắn/,
  /đánh (con|số) (gì|nào|mấy)/,
  /(nên|sẽ) đánh (con|số)/,
];

export function hasCrisisSignal(text: string): boolean {
  const t = normalize(text);
  return CRISIS_PATTERNS.some((p) => p.test(t));
}

export function asksForLotteryNumbers(text: string): boolean {
  const t = normalize(text);
  return LOTTERY_PATTERNS.some((p) => p.test(t));
}

// TODO(before launch): verify and add a Vietnamese mental-health hotline number.
export const CRISIS_NOTICE: Notice = {
  kind: "crisis",
  message:
    "Mình nghe thấy bạn đang trải qua điều rất nặng nề, và bạn không phải chịu đựng một mình. " +
    "Hãy nói chuyện ngay với một người thân bạn tin tưởng hoặc một chuyên gia tâm lý. " +
    "Nếu bạn đang gặp nguy hiểm, hãy gọi cấp cứu 115.",
};

export const LOTTERY_NOTICE: Notice = {
  kind: "lottery",
  message: "Đêm Qua chỉ giải nghĩa giấc mơ, không cho số nha 😄",
};
