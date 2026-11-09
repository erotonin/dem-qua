import "./style.css";
import { CONCERN_LABELS, LENS_LABELS, MOOD_LABELS } from "../shared/labels";
import type { DreamInputPayload, DreamRecord } from "../shared/schemas";
import { api, ApiRequestError } from "./api";
import { createDictation } from "./speech";

const $ = <T extends HTMLElement>(selector: string) => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element ${selector}`);
  return node;
};

/** Small DOM helper. Always sets text via textContent, never innerHTML. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  node.append(...children);
  return node;
}

const form = $<HTMLFormElement>("#dream-form");
const textarea = $<HTMLTextAreaElement>("#dream-text");
const micButton = $<HTMLButtonElement>("#mic");
const micStatus = $<HTMLParagraphElement>("#mic-status");
const formError = $<HTMLParagraphElement>("#form-error");
const submitButton = $<HTMLButtonElement>("#submit");
const resultSection = $<HTMLElement>("#result");
const journalList = $<HTMLUListElement>("#journal-list");

// --- Greeting by time of day ---------------------------------------------
const hour = new Date().getHours();
$("#greeting").textContent =
  hour < 11 ? "Đêm qua bạn mơ gì?" : hour < 18 ? "Bạn còn nhớ giấc mơ đêm qua không?" : "Ghi lại giấc mơ gần nhất nhé";

// --- Choice chips -----------------------------------------------------------
const selections: { mood?: string; concern?: string; lens: string } = { lens: "both" };

function renderChips(name: "mood" | "concern" | "lens", labels: Record<string, string>) {
  const container = $<HTMLDivElement>(`.chips[data-name="${name}"]`);
  for (const [value, label] of Object.entries(labels)) {
    const chip = el("button", { className: "chip", text: label });
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(selections[name] === value));
    chip.addEventListener("click", () => {
      const isSelected = selections[name] === value;
      // Mood and concern can be cleared; lens always keeps one value.
      if (name === "lens") selections.lens = value;
      else selections[name] = isSelected ? undefined : value;
      for (const sibling of container.querySelectorAll("button")) {
        sibling.setAttribute("aria-pressed", "false");
      }
      if (name === "lens" || !isSelected) chip.setAttribute("aria-pressed", "true");
    });
    container.append(chip);
  }
}
renderChips("mood", MOOD_LABELS);
renderChips("concern", CONCERN_LABELS);
renderChips("lens", LENS_LABELS);

// --- Voice input ------------------------------------------------------------
let listening = false;
let baseText = "";
const dictation = createDictation({
  onText(finalText, interimText) {
    if (finalText) baseText = `${baseText} ${finalText}`.trim();
    textarea.value = `${baseText} ${interimText}`.trim();
  },
  onEnd() {
    listening = false;
    micButton.setAttribute("aria-pressed", "false");
    micStatus.textContent = "";
  },
  onError(code) {
    micStatus.textContent =
      code === "not-allowed" ? "Bạn cần cho phép dùng micro để kể bằng giọng nói." : "Micro gặp lỗi, bạn gõ giúp mình nhé.";
  },
});

if (!dictation) {
  micButton.hidden = true;
} else {
  micButton.addEventListener("click", () => {
    if (listening) {
      dictation.stop();
      return;
    }
    baseText = textarea.value.trim();
    listening = true;
    micButton.setAttribute("aria-pressed", "true");
    micStatus.textContent = "Đang nghe… bấm lần nữa để dừng.";
    dictation.start();
  });
}

// --- Rendering --------------------------------------------------------------
function renderDream(dream: DreamRecord, mode?: string) {
  resultSection.replaceChildren();
  resultSection.hidden = false;

  for (const notice of dream.notices) {
    resultSection.append(el("p", { className: `notice notice-${notice.kind}`, text: notice.message }));
  }

  const it = dream.interpretation;
  if (it) {
    resultSection.append(
      el("h2", { className: "result-title", text: `🌙 ${it.title}` }),
      el("p", { className: "summary", text: it.summary }),
      ...it.symbols.map((s) =>
        el("div", { className: "symbol" }, [
          el("h3", { text: s.name }),
          ...(s.psychology ? [el("p", {}, [el("strong", { text: "Góc tâm lý: " }), document.createTextNode(s.psychology)])] : []),
          ...(s.folk ? [el("p", {}, [el("strong", { text: "Góc dân gian: " }), document.createTextNode(s.folk)])] : []),
        ]),
      ),
      el("h3", { text: "💭 Điều này liên quan gì tới bạn" }),
      el("p", { text: it.lifeConnection }),
      el("h3", { text: "❓ Câu hỏi cho bạn" }),
      el("p", { className: "question", text: it.reflectionQuestion }),
      el("h3", { text: "☀️ Lời nhắn hôm nay" }),
      el("p", { text: it.todayMessage }),
    );
  }
  if (mode === "mock") {
    resultSection.append(el("p", { className: "hint", text: "Đang chạy chế độ mock (chưa có ANTHROPIC_API_KEY)." }));
  }
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

function renderJournal(dreams: DreamRecord[]) {
  journalList.replaceChildren();
  if (dreams.length === 0) {
    journalList.append(el("li", { className: "empty", text: "Chưa có giấc mơ nào. Giấc mơ đầu tiên sẽ nằm ở đây." }));
    return;
  }
  for (const dream of dreams) {
    const item = el("li", {}, [
      el("button", { className: "journal-item" }, [
        el("span", { className: "journal-title", text: dream.interpretation?.title ?? "Giấc mơ" }),
        el("span", { className: "journal-date", text: dateFormat.format(new Date(dream.createdAt)) }),
      ]),
    ]);
    item.querySelector("button")?.addEventListener("click", () => renderDream(dream));
    journalList.append(item);
  }
}

async function refreshJournal() {
  try {
    const { dreams } = await api.listDreams();
    renderJournal(dreams);
  } catch {
    journalList.replaceChildren(el("li", { className: "empty", text: "Chưa tải được nhật ký." }));
  }
}

// --- Submit -----------------------------------------------------------------
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  if (listening) dictation?.stop();

  const payload: DreamInputPayload = {
    text: textarea.value,
    mood: selections.mood as DreamInputPayload["mood"],
    concern: selections.concern as DreamInputPayload["concern"],
    lens: selections.lens as DreamInputPayload["lens"],
  };

  submitButton.disabled = true;
  submitButton.textContent = "Đang lắng nghe giấc mơ của bạn…";
  try {
    const { dream, mode } = await api.createDream(payload);
    renderDream(dream, mode);
    textarea.value = "";
    await refreshJournal();
  } catch (error) {
    formError.textContent =
      error instanceof ApiRequestError ? (error.details[0] ?? error.message) : "Mất kết nối, bạn thử lại nhé.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Giải mã giấc mơ";
  }
});

void refreshJournal();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* offline support is optional */
  });
}
