const Conversation = require('../models/Conversation');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/* ─────────────────────────────────────────
   PERSONA SYSTEM PROMPTS
───────────────────────────────────────── */
const PERSONA_PROMPTS = {
  default: `You are Iyomi, a warm and emotionally intelligent AI companion. You genuinely care about the person you're talking to. You listen deeply, respond thoughtfully, and make people feel understood. You're insightful without being preachy, supportive without being clingy, and honest without being harsh.`,
  study: `You are a focused, academic study companion. Break down complex topics clearly using examples, analogies, and structured explanations. Use headers and bullet points. Always explain the "why" behind concepts. Be encouraging but stay on topic.`,
  therapist: `You are a calm, empathetic, reflective conversational companion in the style of a supportive therapist. Listen without judgment. Reflect back what you hear, ask open-ended questions, help the user explore their feelings. Never rush to give advice. Always encourage professional help for serious issues.`,
  straight: `You are brutally honest and direct. No sugarcoating, no filler, no flattery. Get straight to the point. Short sentences. No "great question!" openers. Just facts, honest opinions, and actionable advice.`,
  hype: `You are an incredibly energetic, motivational hype man. You genuinely believe in the user and make them feel like they can conquer anything. Be enthusiastic, positive, and pumped up. Celebrate wins. Turn obstacles into opportunities.`,
  storyteller: `You are a creative, imaginative storyteller with a poetic soul. Weave explanations into stories. Use rich, vivid language. Find the human story in everything. Make even technical topics feel alive and meaningful.`
};

const FORMAT_RULES = `

FORMATTING RULES:
- Use ## for section headings, ### for subsections
- Use **bold** for key terms only
- Use bullet lists for grouped items, numbered lists for steps
- Use \`code\` for technical terms, code blocks for code
- For simple questions: answer directly in 1-3 sentences, no headings needed
- For complex questions: use headings and structure
- Never start with "Certainly!" or filler phrases
- Be direct and precise

TABLE RULES:
- Tables MUST be on their own lines, never inline with text
- Always put intro text as a separate paragraph BEFORE the table
- Format: | Col | Col | on its own line, followed by | --- | --- |`;

/* ─────────────────────────────────────────
   POST /api/chat
───────────────────────────────────────── */
exports.chat = async (req, res) => {
  const { messages, model, conversationId, userId, title, persona } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const activePersonaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.default;
  const systemPrompt = activePersonaPrompt + FORMAT_RULES;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Expose-Headers', 'X-Conversation-Id, X-Conversation-Title');

  // auto-create conversation
  let convId = (conversationId && !conversationId.startsWith('temp-')) ? conversationId : null;
  if (userId && !convId) {
    try {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const convTitle = title || (lastUser?.content?.slice(0, 60)) || 'New Chat';
      const newConv = await Conversation.create({
        userId,
        title: convTitle,
        model: model || 'gemini-3-flash-preview',
        messages: []
      });
      convId = newConv._id.toString();
      res.setHeader('X-Conversation-Id', convId);
      res.setHeader('X-Conversation-Title', encodeURIComponent(convTitle));
    } catch (err) {
      console.error('[chat] Conv create error:', err.message);
    }
  }

  res.flushHeaders();

  try {
    const fullText = await streamGemini({ messages, model, systemPrompt, res });

    // save to DB
    if (userId && fullText && convId) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      if (lastUser) {
        Conversation.findByIdAndUpdate(convId, {
          $push: {
            messages: {
              $each: [
                { role: 'user', content: lastUser.content },
                { role: 'assistant', content: fullText }
              ]
            }
          },
          $set: { updatedAt: new Date() }
        }).catch(err => console.error('[chat] DB save error:', err.message));
      }
    }

  } catch (err) {
    console.error('[chat] Fatal:', err.message);
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } catch (_) {}
  }
};

/* ─────────────────────────────────────────
   GEMINI STREAMING
───────────────────────────────────────── */
async function streamGemini({ messages, model, systemPrompt, res }) {
  if (!process.env.GEMINI_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: 'GEMINI_API_KEY not set in .env' })}\n\n`);
    res.end();
    return '';
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const modelName = model || 'gemini-2.0-flash';

  // enable Google Search grounding for supported models
  const tools = [{ googleSearch: {} }];

  const geminiModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools,
  });

  // convert messages to Gemini format
  // Gemini uses 'user' and 'model' roles (not 'assistant')
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const lastMessage = messages[messages.length - 1];
  const userMessage = lastMessage?.content || '';

  const chat = geminiModel.startChat({ history });

  console.log(`[chat] Gemini model: ${modelName} | web search: enabled`);

  const result = await chat.sendMessageStream(userMessage);

  let fullText = '';

  for await (const chunk of result.stream) {
    const token = chunk.text();
    if (token) {
      fullText += token;
      // send as SSE in OpenAI-compatible format so frontend parser works
      const sseData = {
        choices: [{ delta: { content: token } }]
      };
      res.write(`data: ${JSON.stringify(sseData)}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
  console.log('[chat] Gemini stream complete');

  return fullText;
}

/* ─────────────────────────────────────────
   POST /api/chat/start
───────────────────────────────────────── */
exports.startConversation = async (req, res) => {
  const { userId, title, model } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const conv = await Conversation.create({
      userId,
      title: title || 'New Chat',
      model: model || 'gemini-2.0-flash',
      messages: []
    });
    res.json({ conversationId: conv._id, title: conv.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};