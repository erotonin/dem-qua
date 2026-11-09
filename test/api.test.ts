import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateDreamResponse, ListDreamsResponse } from "../src/shared/schemas";
import { createApp } from "../src/worker/app";
import type { Env } from "../src/worker/env";
import { MockInterpreter } from "../src/worker/interpreter";
import { MemoryDreamRepo } from "../src/worker/repo";

const DEVICE = "6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f";
const OTHER_DEVICE = "0f9e8d7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c";
const env = { APP_ENV: "test" } as Env;

let interpreter: MockInterpreter;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const repo = new MemoryDreamRepo();
  interpreter = new MockInterpreter();
  let n = 0;
  app = createApp(() => ({ repo, interpreter, newId: () => `dream-${++n}` }));
});

const post = (body: unknown, device = DEVICE) =>
  app.request(
    "/api/dreams",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": device },
      body: JSON.stringify(body),
    },
    env,
  );

describe("API", () => {
  it("reports health and interpreter mode", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mode: "mock" });
  });

  it("requires a device id", async () => {
    const res = await app.request("/api/dreams", {}, env);
    expect(res.status).toBe(400);
  });

  it("validates the dream text", async () => {
    const res = await post({ text: "ngắn" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details: string[] };
    expect(body.details[0]).toContain("ít nhất 10 ký tự");
  });

  it("interprets, stores and lists a dream per device", async () => {
    const res = await post({ text: "Mơ thấy mình bay qua cánh đồng lúa", mood: "happy" });
    expect(res.status).toBe(201);
    const { dream, mode } = (await res.json()) as CreateDreamResponse;
    expect(mode).toBe("mock");
    expect(dream.interpretation?.title).toBeTruthy();
    expect(dream.lens).toBe("both");

    const mine = (await (
      await app.request("/api/dreams", { headers: { "x-device-id": DEVICE } }, env)
    ).json()) as ListDreamsResponse;
    expect(mine.dreams).toHaveLength(1);

    const theirs = (await (
      await app.request("/api/dreams", { headers: { "x-device-id": OTHER_DEVICE } }, env)
    ).json()) as ListDreamsResponse;
    expect(theirs.dreams).toHaveLength(0);

    const single = await app.request(`/api/dreams/${dream.id}`, { headers: { "x-device-id": OTHER_DEVICE } }, env);
    expect(single.status).toBe(404);
  });

  it("withholds the interpretation and shows support on a crisis signal", async () => {
    const spy = vi.spyOn(interpreter, "interpret");
    const res = await post({ text: "Mơ thấy biển đen, dạo này em không muốn sống nữa" });
    const { dream } = (await res.json()) as CreateDreamResponse;
    expect(spy).not.toHaveBeenCalled();
    expect(dream.interpretation).toBeNull();
    expect(dream.notices.map((n) => n.kind)).toEqual(["crisis"]);
  });

  it("adds a friendly notice when asked for lottery numbers", async () => {
    const res = await post({ text: "Mơ thấy rắn trắng quấn chân thì đánh con gì?" });
    const { dream } = (await res.json()) as CreateDreamResponse;
    expect(dream.interpretation).not.toBeNull();
    expect(dream.notices.map((n) => n.kind)).toEqual(["lottery"]);
  });
});
