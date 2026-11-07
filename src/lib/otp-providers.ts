import "server-only";

/**
 * Delivery of login codes. Telegram Gateway is tried first (cheap, most people in Uzbekistan
 * have Telegram); Eskiz SMS is the fallback. Each provider is enabled by its env variables.
 *
 * Telegram Gateway: https://core.telegram.org/gateway/api
 * Eskiz:            https://documenter.getpostman.com/view/663428/RzfmES4z
 */

export type Channel = "telegram" | "sms" | "dev";
export type SendResult = { channel: Channel; providerRequestId: string | null };

type Provider = { channel: Channel; send: (phone: string, code: string, ttlSeconds: number) => Promise<string | null> };

const TIMEOUT_MS = 8000;

const telegram: Provider = {
  channel: "telegram",
  async send(phone, code, ttlSeconds) {
    const res = await fetch("https://gatewayapi.telegram.org/sendVerificationMessage", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.TELEGRAM_GATEWAY_TOKEN}`, "content-type": "application/json" },
      // Telegram refunds the fee if the message isn't delivered within ttl
      body: JSON.stringify({ phone_number: phone, code, ttl: ttlSeconds }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json()) as { ok: boolean; result?: { request_id: string }; error?: string };
    if (!data.ok) throw new Error(`telegram: ${data.error ?? res.status}`);
    return data.result?.request_id ?? null;
  },
};

// Eskiz tokens live 30 days; keep one per process and re-login when it is rejected
let eskizToken: string | null = null;

async function eskizLogin() {
  const form = new FormData();
  form.set("email", process.env.ESKIZ_EMAIL!);
  form.set("password", process.env.ESKIZ_PASSWORD!);
  const res = await fetch("https://notify.eskiz.uz/api/auth/login", { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = (await res.json()) as { data?: { token?: string } };
  if (!res.ok || !data.data?.token) throw new Error(`eskiz login: ${res.status}`);
  eskizToken = data.data.token;
  return eskizToken;
}

const sms: Provider = {
  channel: "sms",
  async send(phone, code) {
    const template = process.env.ESKIZ_TEMPLATE ?? "{code}";
    const attempt = async (token: string) => {
      const form = new FormData();
      form.set("mobile_phone", phone.replace(/\D/g, "")); // Eskiz expects 998XXXXXXXXX without "+"
      form.set("message", template.replace("{code}", code));
      form.set("from", process.env.ESKIZ_FROM ?? "4546");
      return fetch("https://notify.eskiz.uz/api/message/sms/send", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    };
    let res = await attempt(eskizToken ?? (await eskizLogin()));
    if (res.status === 401) res = await attempt(await eskizLogin());
    const data = (await res.json()) as { id?: string; status?: string; message?: string };
    if (!res.ok || !data.id) throw new Error(`eskiz send: ${res.status} ${data.message ?? ""}`);
    return data.id;
  },
};

const dev: Provider = {
  channel: "dev",
  async send(phone, code) {
    console.log(`[dev] login code for ${phone}: ${code}`);
    return null;
  },
};

/**
 * LOGIN_CODE_DELIVERY=live sends real Telegram/SMS messages; "dev" shows the code on screen.
 * Defaults: live in production, dev elsewhere, so local work never spends money or hits
 * provider restrictions (e.g. Eskiz test mode only accepts its own sample texts).
 */
function liveDelivery() {
  const mode = process.env.LOGIN_CODE_DELIVERY;
  if (process.env.NODE_ENV === "production") return mode !== "dev";
  return mode === "live";
}

function enabledProviders(): Provider[] {
  if (!liveDelivery()) return process.env.NODE_ENV === "production" ? [] : [dev];
  const list: Provider[] = [];
  if (process.env.TELEGRAM_GATEWAY_TOKEN) list.push(telegram);
  if (process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD) list.push(sms);
  if (list.length === 0 && process.env.NODE_ENV !== "production") list.push(dev);
  return list;
}

/** Tries each enabled channel in order; `skipTelegram` lets the user ask for an SMS instead. */
export async function sendCode(phone: string, code: string, ttlSeconds: number, opts: { skipTelegram?: boolean } = {}): Promise<SendResult> {
  const providers = enabledProviders().filter((p) => !(opts.skipTelegram && p.channel === "telegram" && enabledProviders().length > 1));
  if (providers.length === 0) throw new Error("No login code provider is configured (TELEGRAM_GATEWAY_TOKEN or ESKIZ_*)");

  let lastError: unknown;
  for (const p of providers) {
    try {
      return { channel: p.channel, providerRequestId: await p.send(phone, code, ttlSeconds) };
    } catch (e) {
      lastError = e;
      console.error(`login code via ${p.channel} failed`, e);
    }
  }
  throw lastError;
}

export function isDevDelivery() {
  return enabledProviders().every((p) => p.channel === "dev");
}
