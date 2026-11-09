import { Hono, type MiddlewareHandler } from "hono";
import {
  type ApiError,
  type CreateDreamResponse,
  type DreamRecord,
  DreamInputSchema,
  type ListDreamsResponse,
  type Notice,
} from "../shared/schemas";
import type { Env } from "./env";
import { type Interpreter, InterpretationError } from "./interpreter";
import type { DreamRepo } from "./repo";
import { asksForLotteryNumbers, CRISIS_NOTICE, hasCrisisSignal, LOTTERY_NOTICE } from "./safety";

export interface Deps {
  repo: DreamRepo;
  interpreter: Interpreter;
  now?: () => Date;
  newId?: () => string;
}

type AppEnv = {
  Bindings: Env;
  Variables: { deps: Deps; deviceId: string };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_LIMIT = 50;

export function createApp(resolveDeps: (env: Env) => Deps) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", async (c, next) => {
    c.set("deps", resolveDeps(c.env));
    await next();
  });

  app.get("/health", (c) =>
    c.json({ ok: true, mode: c.get("deps").interpreter.mode, env: c.env?.APP_ENV ?? "unknown" }),
  );

  // Anonymous device id until accounts (Zalo/Google/phone) are added.
  const requireDevice: MiddlewareHandler<AppEnv> = async (c, next) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!UUID_RE.test(deviceId)) {
      return c.json<ApiError>({ error: "Missing or invalid x-device-id header" }, 400);
    }
    c.set("deviceId", deviceId.toLowerCase());
    await next();
  };
  app.use("/dreams", requireDevice);
  app.use("/dreams/*", requireDevice);

  app.post("/dreams", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = DreamInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: "Invalid dream", details: parsed.error.issues.map((i) => i.message) },
        400,
      );
    }
    const input = parsed.data;
    const { repo, interpreter, now = () => new Date(), newId = () => crypto.randomUUID() } =
      c.get("deps");

    const notices: Notice[] = [];
    let interpretation: DreamRecord["interpretation"] = null;

    if (hasCrisisSignal(input.text)) {
      // Do not interpret: respond with care and point to real help.
      notices.push(CRISIS_NOTICE);
    } else {
      try {
        interpretation = await interpreter.interpret(input);
      } catch (error) {
        if (error instanceof InterpretationError) {
          console.error(JSON.stringify({ event: "interpret_failed", kind: error.kind }));
          const status = error.kind === "upstream" ? 502 : 422;
          return c.json<ApiError>(
            { error: "Chưa giải được giấc mơ này, bạn thử lại sau ít phút nhé." },
            status,
          );
        }
        throw error;
      }
      if (interpretation.distressSignal) notices.push(CRISIS_NOTICE);
      if (asksForLotteryNumbers(input.text)) notices.push(LOTTERY_NOTICE);
    }

    const dream: DreamRecord = {
      id: newId(),
      createdAt: now().toISOString(),
      text: input.text,
      mood: input.mood ?? null,
      concern: input.concern ?? null,
      lens: input.lens,
      interpretation,
      notices,
    };
    await repo.insert(c.get("deviceId"), dream);

    return c.json<CreateDreamResponse>({ dream, mode: interpreter.mode }, 201);
  });

  app.get("/dreams", async (c) => {
    const dreams = await c.get("deps").repo.list(c.get("deviceId"), LIST_LIMIT);
    return c.json<ListDreamsResponse>({ dreams });
  });

  app.get("/dreams/:id", async (c) => {
    const dream = await c.get("deps").repo.get(c.get("deviceId"), c.req.param("id"));
    if (!dream) return c.json<ApiError>({ error: "Not found" }, 404);
    return c.json(dream);
  });

  app.notFound((c) => c.json<ApiError>({ error: "Not found" }, 404));

  app.onError((error, c) => {
    // Never log request bodies: dreams are sensitive personal data.
    console.error(JSON.stringify({ event: "unhandled_error", name: error.name, message: error.message }));
    return c.json<ApiError>({ error: "Internal error" }, 500);
  });

  return app;
}
