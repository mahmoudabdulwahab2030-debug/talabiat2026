// الدخول بالبصمة / Face ID (WebAuthn Passkeys) - Supabase Edge Function
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://talabiat2026.lovable.app")
  .split(",").map((s) => s.trim()).filter(Boolean);
const RP_NAME = "talabiat2026";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const enc = new TextEncoder();

function b64uToBytes(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 ? "=".repeat(4 - (b.length % 4)) : "";
  const bin = atob(b + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toMs(t: unknown): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") { const n = Date.parse(t); return isNaN(n) ? 0 : n; }
  return 0;
}

// التحقق من المستخدم: وثيقة موجودة ولم تنتهِ تجربته
async function verifyUser(code: unknown, password?: unknown) {
  if (typeof code !== "string" || !code || code.length > 100) return null;
  const { data, error } = await admin.from("users").select("id,data").eq("id", code).maybeSingle();
  if (error || !data) return null;
  const u = (data.data ?? {}) as Record<string, unknown>;
  // التسجيل يتطلب إثبات كلمة المرور حتى لا يضيف أحد بصمته لحساب غيره
  if (password !== undefined && String(u.password ?? "") !== String(password)) return null;
  const trialEnd = toMs(u.trialExpiresAt);
  if (trialEnd && trialEnd < Date.now()) return null;
  return { code, name: (u.name as string) || code, roles: Array.isArray(u.roles) ? (u.roles as string[]) : [] };
}

async function saveChallenge(kind: "reg" | "auth", userCode: string | null, challenge: string) {
  const id = crypto.randomUUID();
  const { error } = await admin.from("passkey_challenges").insert({
    id, kind, user_code: userCode, challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return id;
}

// التحدي يُستخدم مرة واحدة فقط ثم يُحذف
async function takeChallenge(id: unknown, kind: "reg" | "auth", userCode?: string) {
  if (typeof id !== "string" || !id) return null;
  const { data } = await admin.from("passkey_challenges").select("*").eq("id", id).eq("kind", kind).maybeSingle();
  if (!data) return null;
  await admin.from("passkey_challenges").delete().eq("id", id);
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (userCode && data.user_code !== userCode) return null;
  return data as { challenge: string };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
  if (ALLOWED_ORIGINS.includes(origin)) cors["Access-Control-Allow-Origin"] = origin;
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origin not allowed" }, 403);

  // نطاق البصمة مرتبط بالموقع نفسه
  const rpID = new URL(origin).hostname;

  try {
    const body = await req.json().catch(() => ({})) as Record<string, any>;
    const now = new Date().toISOString();

    // تنظيف التحديات المنتهية (أفضل جهد)
    await admin.from("passkey_challenges").delete().lt("expires_at", now);

    switch (body.action) {
      case "reg-options": {
        const user = await verifyUser(body.userCode, body.password);
        if (!user) return json({ error: "كود المستخدم أو كلمة المرور غير صحيحة" }, 401);
        const { data: existing } = await admin.from("passkeys").select("credential_id,transports").eq("user_code", user.code);
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID,
          userName: user.code,
          userID: enc.encode(user.code),
          attestationType: "none",
          excludeCredentials: (existing ?? []).map((c) => ({
            id: c.credential_id,
            transports: (c.transports ?? undefined) as any,
          })),
          authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
        });
        const challengeId = await saveChallenge("reg", user.code, options.challenge);
        return json({ options, challengeId });
      }

      case "reg-verify": {
        const user = await verifyUser(body.userCode, body.password);
        if (!user) return json({ error: "غير مصرح" }, 401);
        const ch = await takeChallenge(body.challengeId, "reg", user.code);
        if (!ch) return json({ error: "انتهت صلاحية المحاولة، أعد المحاولة" }, 400);
        const v = await verifyRegistrationResponse({
          response: body.response,
          expectedChallenge: ch.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        });
        if (!v.verified || !v.registrationInfo) return json({ error: "فشل التحقق من البصمة" }, 400);
        const c = v.registrationInfo.credential;
        const { error } = await admin.from("passkeys").insert({
          credential_id: c.id,
          user_code: user.code,
          public_key: bytesToB64u(c.publicKey),
          counter: c.counter,
          transports: c.transports ?? null,
          created_at: now,
        });
        if (error) return json({ error: "تعذر حفظ البصمة" }, 400);
        return json({ ok: true });
      }

      case "login-options": {
        const options = await generateAuthenticationOptions({
          rpID,
          userVerification: "required",
          allowCredentials: [],
        });
        const challengeId = await saveChallenge("auth", null, options.challenge);
        return json({ options, challengeId });
      }

      case "login-verify": {
        const ch = await takeChallenge(body.challengeId, "auth");
        if (!ch) return json({ error: "انتهت صلاحية المحاولة، أعد المحاولة" }, 400);
        const credId = body.response?.id;
        if (typeof credId !== "string" || !credId) return json({ error: "بيانات غير صالحة" }, 400);
        const { data: pk } = await admin.from("passkeys").select("*").eq("credential_id", credId).maybeSingle();
        if (!pk) return json({ error: "هذه البصمة غير مفعلة، سجّل الدخول بكلمة المرور وفعّلها" }, 401);
        const v = await verifyAuthenticationResponse({
          response: body.response,
          expectedChallenge: ch.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: pk.credential_id,
            publicKey: b64uToBytes(pk.public_key),
            counter: Number(pk.counter) || 0,
            transports: (pk.transports ?? undefined) as any,
          },
        });
        if (!v.verified) return json({ error: "فشل التحقق من البصمة" }, 401);
        await admin.from("passkeys").update({
          counter: v.authenticationInfo.newCounter,
          last_used_at: now,
        }).eq("credential_id", credId);
        const user = await verifyUser(pk.user_code);
        if (!user) return json({ error: "الحساب غير نشط" }, 401);
        return json({ userCode: user.code, name: user.name, roles: user.roles, uid: user.code });
      }

      default:
        return json({ error: "إجراء غير معروف" }, 400);
    }
  } catch (e) {
    console.error("passkey error", e);
    return json({ error: "حدث خطأ، حاول مرة أخرى" }, 500);
  }
});
