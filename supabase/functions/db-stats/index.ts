// إحصائيات قاعدة البيانات للوحة الإدارة: الحجم المستخدم والمساحة الفارغة لكل جدول
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://talabiat2026.lovable.app")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ADMIN_CODES = (Deno.env.get("ADMIN_CODES") ?? "admin").split(",").map((s) => s.trim());
// الحصة الكلية لقاعدة البيانات بالميجابايت (تُضبط حسب خطتك في Supabase)
const QUOTA_MB = Number(Deno.env.get("DB_QUOTA_MB") ?? "500");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function isAdmin(code: unknown): Promise<boolean> {
  if (typeof code !== "string" || !code || code.length > 100) return false;
  if (ADMIN_CODES.includes(code)) return true;
  const { data } = await admin.from("users").select("data").eq("id", code).maybeSingle();
  const roles = Array.isArray(data?.data?.roles) ? (data!.data.roles as string[]) : [];
  return roles.includes("admin_page") || roles.includes("all");
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

  try {
    const body = await req.json().catch(() => ({})) as { userCode?: unknown };
    if (!(await isAdmin(body.userCode))) return json({ error: "غير مصرح" }, 403);

    const { data, error } = await admin.rpc("db_size_stats");
    if (error) { console.error("db_size_stats", error.message); return json({ error: "تعذر قراءة الإحصائيات" }, 500); }

    return json({
      used_bytes: Number(data?.total_bytes ?? 0),
      quota_bytes: QUOTA_MB * 1024 * 1024,
      tables: (data?.tables ?? []).map((t: { name: string; bytes: number; rows: number }) => ({
        name: t.name, bytes: Number(t.bytes), rows: Number(t.rows),
      })),
    });
  } catch (e) {
    console.error("db-stats error", e);
    return json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});
