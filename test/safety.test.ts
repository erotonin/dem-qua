import { describe, expect, it } from "vitest";
import { asksForLotteryNumbers, hasCrisisSignal } from "../src/worker/safety";

describe("hasCrisisSignal", () => {
  it.each([
    "Dạo này em thật sự muốn chết, mơ thấy mình đi lạc",
    "Mình đang nghĩ đến việc tự tử",
    "Tôi không muốn sống nữa",
    "Mình muốn tự làm hại bản thân",
  ])("flags first-person real-life intent: %s", (text) => {
    expect(hasCrisisSignal(text)).toBe(true);
  });

  it.each([
    "Mơ thấy người chết đuối dưới sông",
    "Mình mơ bị đuổi, sợ muốn chết luôn",
    "Mơ thấy ông bà đã mất về thăm nhà",
    "Trong mơ có người tự tử trên phim",
  ])("does not flag dream imagery: %s", (text) => {
    expect(hasCrisisSignal(text)).toBe(false);
  });
});

describe("asksForLotteryNumbers", () => {
  it.each([
    "Mơ thấy rắn thì đánh con gì?",
    "Cho mình xin số đề với",
    "Mơ thấy người chết nên đánh số nào",
    "Hôm nay XSMB ra gì",
  ])("detects lottery requests: %s", (text) => {
    expect(asksForLotteryNumbers(text)).toBe(true);
  });

  it("ignores ordinary dreams", () => {
    expect(asksForLotteryNumbers("Mơ thấy mình đứng trước nhà số 5 cũ")).toBe(false);
  });
});
