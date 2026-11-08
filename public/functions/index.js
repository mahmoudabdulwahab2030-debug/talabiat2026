const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

// المفتاح يُحفظ في Firebase Secret Manager ولا يوجد داخل الكود
const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const MODEL = 'llama-3.3-70b-versatile';

// النطاقات المسموح لها باستدعاء المساعد (تُضبط من متغيرات البيئة)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://talabiat2026.lovable.app')
  .split(',').map(s => s.trim()).filter(Boolean);
// أكواد الإدارة التي تستخدم دخول الإدارة المباشر ولا تملك وثيقة في users
const ADMIN_CODES = (process.env.ADMIN_CODES || 'admin').split(',').map(s => s.trim());

const MAX_MESSAGE_CHARS = 1000;
const CONTEXT_COLLECTIONS = [
  { name: 'branches', limit: 100 },
  { name: 'warehouses', limit: 50 },
  { name: 'products', limit: 150 },
  { name: 'orders', limit: 150 },
];
const SENSITIVE_KEY = /pass|token|secret|apikey|pin/i;

function toMs(t) {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') { const n = Date.parse(t); return isNaN(n) ? 0 : n; }
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.toDate === 'function') return t.toDate().getTime();
  return 0;
}

// التحقق من هوية المستخدم: وثيقة موجودة، ولم تنتهِ تجربته
async function verifyUser(code) {
  if (!code || typeof code !== 'string' || code.length > 100) return null;
  if (ADMIN_CODES.includes(code)) return { code, name: 'الإدارة', roles: ['admin'] };
  const snap = await db.collection('users').doc(code).get();
  if (!snap.exists) return null;
  const u = snap.data() || {};
  const trialEnd = toMs(u.trialExpiresAt);
  if (trialEnd && trialEnd < Date.now()) return null;
  return { code, name: u.name || code, roles: Array.isArray(u.roles) ? u.roles : [] };
}

// تجهيز بيانات النظام للنموذج: حد أقصى للعدد، وإزالة أي حقل حساس
async function buildContext() {
  const parts = [];
  for (const c of CONTEXT_COLLECTIONS) {
    try {
      const snap = await db.collection(c.name).limit(c.limit).get();
      const docs = [];
      snap.forEach(d => docs.push({ _id: d.id, ...d.data() }));
      const clean = JSON.stringify(docs, (k, v) => (SENSITIVE_KEY.test(k) ? undefined : v));
      parts.push(`== ${c.name} (${docs.length} سجل) ==\n${clean.slice(0, 15000)}`);
    } catch (e) {
      console.error('context read failed', c.name, e.message);
    }
  }
  return parts.join('\n\n');
}

const SYSTEM_PROMPT = `أنت "محمود عبدالوهاب"، المساعد الذكي لنظام إدارة الطلبيات والمخازن والفروع (مشروع talabiat2026).
- تخصصك الأساسي هو هذا المشروع وبياناته. عند السؤال عن الفروع أو الطلبيات أو المخازن أو المنتجات، استخدم البيانات المرفقة فقط وذكر الأرقام كما هي.
- إذا لم تجد الإجابة في البيانات المرفقة، قل ذلك بوضوح ولا تخترع أرقاماً أو أسماء.
- إذا كان السؤال خارج المشروع، أجب إجابة عامة مفيدة ومختصرة.
- لا تكشف كلمات المرور أو أي بيانات دخول.
- أجب دائماً باللغة العربية، بأسلوب واضح ومنظم وقصير قدر الإمكان.`;

exports.aiAssistant = onRequest(
  { secrets: [GROQ_API_KEY], region: 'us-central1', maxInstances: 5, timeoutSeconds: 60 },
  async (req, res) => {
    const origin = req.get('origin') || '';
    if (ALLOWED_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const body = req.body || {};
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) return res.status(400).json({ error: 'اكتب سؤالك أولاً' });
      if (message.length > MAX_MESSAGE_CHARS) return res.status(400).json({ error: 'السؤال طويل جداً' });

      const user = await verifyUser(body.userCode);
      if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لاستخدام المساعد' });

      const context = await buildContext();
      const system = `${SYSTEM_PROMPT}\n\nالمستخدم الحالي: ${user.name}\n\nبيانات المشروع:\n${context}`;

      const r = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: MODEL,
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: message },
          ],
        },
        { headers: { Authorization: `Bearer ${GROQ_API_KEY.value()}` }, timeout: 30000 }
      );

      const answer = r.data?.choices?.[0]?.message?.content || 'لم أتمكن من توليد إجابة.';
      return res.status(200).json({ answer });
    } catch (e) {
      console.error('aiAssistant error', e.response?.status, e.message);
      return res.status(500).json({ error: 'حدث خطأ أثناء معالجة السؤال، حاول مرة أخرى' });
    }
  }
);
