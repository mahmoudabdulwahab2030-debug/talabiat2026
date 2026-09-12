const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * AI Assistant Cloud Function
 * Receives user questions and returns AI-powered responses with Firebase data
 */
exports.aiAssistant = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    try {
      // Validate request
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    // Get context from Firebase
    const context = await getFirebaseContext();

    // Call Groq AI
    const aiResponse = await callGroqAI(message, context);

    return res.status(200).json({
      success: true,
      message: message,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in aiAssistant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Fetch context data from Firestore
 */
async function getFirebaseContext() {
  try {
    let context = 'معلومات النظام الحالية:\n';

    // Fetch orders count
    const ordersSnap = await db.collection('orders').limit(1).get();
    context += `إجمالي الطلبيات: ${ordersSnap.size}\n`;

    // Fetch warehouses
    const warehousesSnap = await db.collection('warehouses').limit(10).get();
    const warehouses = [];
    warehousesSnap.forEach(doc => {
      const data = doc.data();
      warehouses.push(`${data.name || doc.id}`);
    });
    if (warehouses.length > 0) {
      context += `المخازن: ${warehouses.join(', ')}\n`;
    }

    // Fetch branches
    const branchesSnap = await db.collection('branches').limit(10).get();
    const branches = [];
    branchesSnap.forEach(doc => {
      const data = doc.data();
      branches.push(data.name || doc.id);
    });
    if (branches.length > 0) {
      context += `الفروع: ${branches.join(', ')}\n`;
    }

    // Fetch recent products
    const productsSnap = await db.collection('products').limit(5).get();
    const products = [];
    productsSnap.forEach(doc => {
      const data = doc.data();
      products.push(data.name || doc.id);
    });
    if (products.length > 0) {
      context += `أمثلة منتجات: ${products.join(', ')}\n`;
    }

    return context;
  } catch (error) {
    console.error('Error fetching Firebase context:', error);
    return 'معلومات النظام متاحة\n';
  }
}

/**
 * Call Groq AI API
 */
async function callGroqAI(userMessage, context) {
  try {
    const apiKey = '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';

    const systemPrompt = `أنت مساعد ذكاء اصطناعي متخصص في نظام إدارة الطلبيات والمخازن والفروع.
- فهم دقيق للأسئلة بالعربية
- إجابات واضحة وحقيقية
- استخدام بيانات النظام المتاحة
- أجب باللغة العربية فقط

${context}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }

    return 'عذراً، لم أتمكن من معالجة طلبك.';
  } catch (error) {
    console.error('Groq API Error:', error.response?.data || error.message);
    throw new Error('خطأ في الاتصال بخدمة الذكاء الاصطناعي');
  }
}

/**
 * Alternative: SimpleAI for testing (when Groq is not available)
 */
exports.simpleAI = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'No message provided' });
      }

      // Simple intelligent response system
      const response = getIntelligentResponse(message);

      return res.status(200).json({
        success: true,
        response: response
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

function getIntelligentResponse(message) {
  const msg = message.toLowerCase().trim();

  // Orders
  if (msg.includes('طلب') || msg.includes('أوردر')) {
    if (msg.includes('كم') || msg.includes('عدد')) {
      return 'يمكنك عرض عدد الطلبيات من صفحة "تجميع طلبيات ليدو"';
    }
    return 'قسم إدارة الطلبيات يوفر رؤية شاملة لجميع الطلبيات';
  }

  // Warehouses
  if (msg.includes('مخزن') || msg.includes('تخزين')) {
    return 'اذهب إلى "إدارة المخازن" لإدارة جميع مخازنك وتتبع الأصناف';
  }

  // Branches
  if (msg.includes('فرع')) {
    return 'الفروع المتاحة: الكوربة، الدقي، التجمع، والعبور';
  }

  // Default
  return 'مرحباً! أنا هنا لمساعدتك في إدارة الطلبيات والمخازن والفروع. كيف يمكنني مساعدتك؟';
}
