import type { Concern, Lens, Mood } from "./schemas";

export const MOOD_LABELS: Record<Mood, string> = {
  scared: "Sợ hãi",
  sad: "Buồn",
  peaceful: "Bình yên",
  confused: "Bối rối",
  happy: "Vui",
};

export const CONCERN_LABELS: Record<Concern, string> = {
  work: "Công việc",
  love: "Tình cảm",
  family: "Gia đình",
  health: "Sức khỏe",
  money: "Tiền bạc",
  study: "Học hành",
};

export const LENS_LABELS: Record<Lens, string> = {
  psychology: "Tâm lý",
  folk: "Dân gian Việt",
  both: "Cả hai",
};
