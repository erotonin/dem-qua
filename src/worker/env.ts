export interface Env {
  DB: D1Database;
  /** Worker secret. When unset the app falls back to the mock interpreter. */
  ANTHROPIC_API_KEY?: string;
  CLAUDE_MODEL?: string;
  APP_ENV?: string;
}
