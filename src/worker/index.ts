import { createApp } from "./app";
import type { Env } from "./env";
import { createInterpreter } from "./interpreter";
import { D1DreamRepo } from "./repo";

const app = createApp((env: Env) => ({
  repo: new D1DreamRepo(env.DB),
  interpreter: createInterpreter(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL),
}));

export default app satisfies ExportedHandler<Env>;
