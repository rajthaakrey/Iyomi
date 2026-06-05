const Conversation = require('../models/Conversation');
const { needsWebSearch, searchWeb, buildSearchContext } = require('../services/webSearch');

const PERSONA_PROMPTS = {
  default:     `You are Iyomi, a warm and emotionally intelligent AI companion. You genuinely care about the person you're talking to. You listen deeply, respond thoughtfully, and make people feel understood.`,
  study:       `You are a focused, academic study companion. Break down complex topics clearly using examples, analogies, and structured explanations. Always explain the "why" behind concepts.`,
  therapist:   `You are a calm, empathetic, reflective conversational companion in the style of a supportive therapist. Listen without judgment. Help the user explore their feelings. Always encourage professional help for serious issues.`,
  straight:    `You are brutally honest and direct. No sugarcoating, no filler. Get straight to the point. Short sentences. Just facts, honest opinions, and actionable advice.`,
  hype:        `You are an incredibly energetic, motivational hype man. Make the user feel like they can conquer anything. Be enthusiastic and pumped up. Celebrate wins. Turn obstacles into opportunities.`,
  storyteller: `You are a creative, imaginative storyteller with a poetic soul. Weave explanations into stories. Use rich, vivid language. Make even technical topics feel alive and meaningful.`
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
- Always put intro text as a SEPARATE paragraph BEFORE the table
- Format: | Col | Col | followed by | --- | --- |`;

exports.chatGroq = async (req, res) => {
  const { messages, model, conversationId, userId, title, persona } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const basePrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.default;

  // get last user message for web search
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText    = lastUserMsg?.content || '';

  // web search if needed
  let searchContext = '';
  if (needsWebSearch(userText)) {
    console.log('[search] Searching for:', userText.slice(0, 80));
    const searchData = await searchWeb(userText);
    searchContext    = buildSearchContext(searchData);
    if (searchData) console.log(`[search] Got ${searchData.results.length} results`);
  }

  const systemPrompt = basePrompt + FORMAT_RULES + searchContext;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Expose-Headers', 'X-Conversation-Id, X-Conversation-Title');

  // auto-create conversation
  let convId = (conversationId && !conversationId.startsWith('temp-')) ? conversationId : null;
  if (userId && !convId) {
    try {
      const convTitle = title || userText.slice(0, 60) || 'New Chat';
      const newConv   = await Conversation.create({
        userId, title: convTitle,
        model: model || 'llama-3.3-70b-versatile', messages: []
      });
      convId = newConv._id.toString();
      res.setHeader('X-Conversation-Id', convId);
      res.setHeader('X-Conversation-Title', encodeURIComponent(convTitle));
    } catch (err) { console.error('[groq] Conv create error:', err.message); }
  }

  res.flushHeaders();

  try {
    const realModel = (model || '').replace('groq:', '') || 'llama-3.3-70b-versatile';

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       realModel,
        messages:    [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens:  1024,
        temperature: 0.7,
        stream:      true
      })
    });

    console.log(`[groq] model: ${realModel} | status: ${groqRes.status} | search: ${searchContext ? 'yes' : 'no'}`);

    if (!groqRes.ok) {
      let errMsg = `HTTP ${groqRes.status}`;
      try { const e = await groqRes.json(); errMsg = e?.error?.message || errMsg; } catch (_) {}
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      return res.end();
    }

    const reader  = groqRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      const lines = chunk.split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const token  = parsed.choices?.[0]?.delta?.content;
          if (token) fullText += token;
        } catch (_) {}
      }
    }

    res.end();
    console.log('[groq] Stream complete');

    // save to DB
    if (userId && fullText && convId) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      if (lastUser) {
        Conversation.findByIdAndUpdate(convId, {
          $push: { messages: { $each: [
            { role: 'user',      content: lastUser.content },
            { role: 'assistant', content: fullText }
          ]}},
          $set: { updatedAt: new Date() }
        }).catch(err => console.error('[groq] DB error:', err.message));
      }
    }

  } catch (err) {
    console.error('[groq] Fatal:', err.message);
    try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch (_) {}
  }
};