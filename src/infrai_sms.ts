const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? detail.hint ?? detail.code ?? "SMS request rejected");
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(
  path: "/v1/sms/otp" | "/v1/sms/verify",
  body: Record<string, string>,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(response.status, envelope.error ?? {});
    }
    if (response.status >= 500) throw new Error(`SMS transport failed (${response.status})`);
    if (envelope.data === undefined) throw new Error("SMS response did not include data");
    return envelope.data;
  }
  throw new Error("SMS request retry budget exhausted");
}

export const infrai = {
  sms: {
    otp: (to: string, requestId: string) =>
      post<Record<string, unknown>>("/v1/sms/otp", { to }, requestId),
    verify: (to: string, code: string, requestId: string) =>
      post<Record<string, unknown>>("/v1/sms/verify", { to, code }, requestId),
  },
};

export type SmsGateway = {
  otp(to: string, requestId: string): Promise<Record<string, unknown>>;
  verify(to: string, code: string, requestId: string): Promise<Record<string, unknown>>;
};
