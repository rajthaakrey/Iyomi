const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const SEARCH_TRIGGERS = [
  'latest', 'recent', 'current', 'today', 'now', 'news',
  'price', 'stock', 'weather', 'who is', 'what is',
  'when did', 'happened', '2024', '2025', '2026',
  'update', 'release', 'launched', 'announced',
  'score', 'result', 'match', 'election', 'trending', 'new'
];

function needsWebSearch(query) {
  const q = query.toLowerCase();
  return SEARCH_TRIGGERS.some(t => q.includes(t));
}

async function searchWeb(query) {
  if (!TAVILY_API_KEY) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false
      })
    });
    if (!res.ok) { console.error('[search] Tavily error:', res.status); return null; }
    const data = await res.json();
    return {
      answer:  data.answer || null,
      results: (data.results || []).map(r => ({
        title:   r.title,
        url:     r.url,
        snippet: r.content?.slice(0, 400)
      })),
      query
    };
  } catch (err) {
    console.error('[search] Fatal:', err.message);
    return null;
  }
}

function buildSearchContext(searchData) {
  if (!searchData) return '';
  let ctx = `\n\n[WEB SEARCH RESULTS for: "${searchData.query}"]\n`;
  if (searchData.answer) ctx += `Summary: ${searchData.answer}\n\n`;
  searchData.results.forEach((r, i) => {
    ctx += `[${i+1}] ${r.title}\n${r.snippet}\nSource: ${r.url}\n\n`;
  });
  ctx += `[Use the above to give accurate, up-to-date answers. Cite sources.]\n`;
  return ctx;
}

module.exports = { needsWebSearch, searchWeb, buildSearchContext };