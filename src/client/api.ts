import type {
  ApiError,
  CreateDreamResponse,
  DreamInputPayload,
  ListDreamsResponse,
} from "../shared/schemas";

const DEVICE_KEY = "demqua.deviceId";
let memoryDeviceId: string | null = null;

/** Anonymous id kept in localStorage; falls back to memory if storage is blocked. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-device-id": getDeviceId(),
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (body ?? { error: `HTTP ${res.status}` }) as ApiError;
    throw new ApiRequestError(err.error, res.status, err.details);
  }
  return body as T;
}

export const api = {
  createDream: (payload: DreamInputPayload) =>
    request<CreateDreamResponse>("/dreams", { method: "POST", body: JSON.stringify(payload) }),
  listDreams: () => request<ListDreamsResponse>("/dreams"),
};
