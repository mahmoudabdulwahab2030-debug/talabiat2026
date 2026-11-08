// مساعد "محمود عبدالوهاب" - Supabase Edge Function
// تقرأ بيانات المشروع من قاعدة البيانات، وتتحقق من المستخدم قبل الرد.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// مفتاح الذكاء الاصطناعي يُوفَّر تلقائياً من Lovable Cloud ولا يُكتب في الكود
const AI_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://talabiat2026.lovable.app")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ADMIN_CODES = (Deno.env.get("ADMIN_CODES") ?? "admin").split(",").map((s) => s.trim());

const MAX_MESSAGE_CHARS = 1000;
const CONTEXT_TABLES = [
  { name: "branches", limit: 100 },
  { name: "warehouses", limit: 50 },
  { name: "products", limit: 150 },
  { name: "orders", limit: 150 },
];
const SENSITIVE_KEY = /pass|token|secret|apikey|pin/i;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function toMs(t: unknown): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") { const n = Date.parse(t); return isNaN(n) ? 0 : n; }
  return 0;
}

// التحقق من المستخدم: وثيقة موجودة ولم تنتهِ تجربته
async function verifyUser(code: unknown) {
  if (typeof code !== "string" || !code || code.length > 100) return null;
  if (ADMIN_CODES.includes(code)) return { code, name: "الإدارة", roles: ["admin"] };
  const { data, error } = await admin.from("users").select("id,data").eq("id", code).maybeSingle();
  if (error || !data) return null;
  const u = (data.data ?? {}) as Record<string, unknown>;
  const trialEnd = toMs(u.trialExpiresAt);
  if (trialEnd && trialEnd < Date.now()) return null;
  return {
    code,
    name: (u.name as string) || code,
    roles: Array.isArray(u.roles) ? (u.roles as string[]) : [],
  };
}

// تجهيز بيانات المشروع للنموذج: حد أقصى للعدد وإزالة الحقول الحساسة
async function buildContext(): Promise<string> {
  const parts: string[] = [];
  for (const t of CONTEXT_TABLES) {
    const { data, error } = await admin.from(t.name).select("id,data").limit(t.limit);
    if (error) { console.error("context read failed", t.name, error.message); continue; }
    const docs = (data ?? []).map((r: { id: string; data: Record<string, unknown> }) => ({ _id: r.id, ...(r.data ?? {}) }));
    const clean = JSON.stringify(docs, (k, v) => (SENSITIVE_KEY.test(k) ? undefined : v));
    parts.push(`== ${t.name} (${docs.length} سجل) ==\n${clean.slice(0, 15000)}`);
  }
  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `أنت "محمود عبدالوهاب"، المساعد الذكي لنظام إدارة الطلبيات والمخازن والفروع (مشروع talabiat2026).
- تخصصك الأساسي هو هذا المشروع وبياناته. عند السؤال عن الفروع أو الطلبيات أو المخازن أو المنتجات، استخدم البيانات المرفقة فقط واذكر الأرقام كما هي.
- إذا لم تجد الإجابة في البيانات المرفقة، قل ذلك بوضوح ولا تخترع أرقاماً أو أسماء.
- إذا كان السؤال خارج المشروع، أجب إجابة عامة مفيدة ومختصرة.
- لا تكشف كلمات المرور أو أي بيانات دخول.
- أجب دائماً باللغة العربية، بأسلوب واضح ومنظم وقصير قدر الإمكان.`;

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

  try {
    const body = await req.json().catch(() => ({})) as { message?: unknown; userCode?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "اكتب سؤالك أولاً" }, 400);
    if (message.length > MAX_MESSAGE_CHARS) return json({ error: "السؤال طويل جداً" }, 400);

    const user = await verifyUser(body.userCode);
    if (!user) return json({ error: "يجب تسجيل الدخول لاستخدام المساعد" }, 401);

    const context = await buildContext();
    const system = `${SYSTEM_PROMPT}\n\nالمستخدم الحالي: ${user.name}\n\nبيانات المشروع:\n${context}`;

    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
    });

    if (r.status === 429) return json({ error: "عدد الطلبات كبير الآن، حاول بعد دقيقة" }, 429);
    if (r.status === 402) return json({ error: "رصيد الذكاء الاصطناعي غير كافٍ حالياً" }, 402);
    if (!r.ok) {
      console.error("AI gateway error", r.status, await r.text());
      return json({ error: "حدث خطأ أثناء معالجة السؤال، حاول مرة أخرى" }, 500);
    }

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content || "لم أتمكن من توليد إجابة.";
    return json({ answer });
  } catch (e) {
    console.error("ai-assistant error", e);
    return json({ error: "حدث خطأ أثناء معالجة السؤال، حاول مرة أخرى" }, 500);
  }
});
