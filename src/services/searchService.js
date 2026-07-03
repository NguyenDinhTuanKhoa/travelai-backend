// Web search fallback: khi câu hỏi nằm NGOÀI dữ liệu hệ thống, tra Google để trả lời
// chính xác thay vì để model bịa. KẾT HỢP cả Serper.dev lẫn SerpApi (chạy song song,
// gộp kết quả) — SerpApi thường có answer box chứa câu trả lời trực tiếp (giá/giờ...).
const serperManager = require('../utils/serperManager');
const serpApiManager = require('../utils/serpApiManager');

const TIMEOUT_MS = 8000;

// Bọc timeout để tìm kiếm không làm treo luồng chat
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('search-timeout')), ms)),
  ]);
}

// Chuẩn hoá kết quả Serper.dev → { answer, kg, organic[] }
async function fetchSerper(query, num) {
  const data = await serperManager.search(query);
  if (!data) return null;
  const out = { answer: null, kg: null, organic: [] };
  const ab = data.answerBox;
  if (ab) {
    const a = ab.answer || ab.snippet || (Array.isArray(ab.snippetHighlighted) ? ab.snippetHighlighted.join(' ') : '');
    if (a) out.answer = `${a}${ab.source ? ` (nguồn: ${ab.source})` : ''}`;
  }
  const kg = data.knowledgeGraph;
  if (kg && (kg.title || kg.description)) {
    out.kg = `${kg.title || ''}${kg.type ? ` (${kg.type})` : ''}: ${kg.description || ''}`;
  }
  if (Array.isArray(data.organic)) {
    for (const r of data.organic.slice(0, num)) {
      if (r.title && r.snippet) out.organic.push({ title: r.title, snippet: r.snippet, link: r.link || '' });
    }
  }
  return out;
}

// Chuẩn hoá kết quả SerpApi → { answer, kg, organic[] }
async function fetchSerpApi(query, num) {
  const data = await serpApiManager.fetchWithRotation({ engine: 'google', q: query, hl: 'vi', gl: 'vn', num });
  if (!data) return null;
  const out = { answer: null, kg: null, organic: [] };
  const ab = data.answer_box;
  if (ab) {
    const a = ab.answer || ab.snippet || ab.result ||
      (Array.isArray(ab.snippet_highlighted_words) ? ab.snippet_highlighted_words.join(' ') : '');
    if (a) out.answer = a;
  }
  const kg = data.knowledge_graph;
  if (kg && (kg.title || kg.description)) {
    out.kg = `${kg.title || ''}: ${kg.description || ''}`;
  }
  if (Array.isArray(data.organic_results)) {
    for (const r of data.organic_results.slice(0, num)) {
      if (r.title && r.snippet) out.organic.push({ title: r.title, snippet: r.snippet, link: r.link || '' });
    }
  }
  return out;
}

// Tra Google: chạy SONG SONG Serper + SerpApi rồi GỘP kết quả. Trả về text hoặc null.
async function webSearch(query, num = 5) {
  if (!query || !query.trim()) return null;

  const tasks = [];
  if (process.env.SERPER_API_KEY) tasks.push({ name: 'Serper', run: () => fetchSerper(query, num) });
  if (process.env.SERPAPI_KEYS) tasks.push({ name: 'SerpApi', run: () => fetchSerpApi(query, num) });
  if (!tasks.length) return null;

  const settled = await Promise.allSettled(tasks.map(t => withTimeout(t.run(), TIMEOUT_MS)));
  const blocks = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value) { blocks.push(s.value); console.log(`[search] ${tasks[i].name} OK`); }
    else console.warn(`[search] ${tasks[i].name} failed:`, s.reason?.message || 'no data');
  });
  if (!blocks.length) return null;

  // GỘP: answer box (tối đa 2 cái khác nhau) + knowledge graph + organic (khử trùng theo link/title)
  const lines = [];
  const answers = [...new Set(blocks.map(b => b.answer).filter(Boolean))];
  answers.slice(0, 2).forEach(a => lines.push(`• Trả lời nhanh: ${a}`));
  const kg = blocks.map(b => b.kg).filter(Boolean)[0];
  if (kg) lines.push(`• ${kg}`);

  const seen = new Set();
  for (const b of blocks) {
    for (const r of b.organic) {
      const key = (r.link || r.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`• ${r.title} — ${r.snippet}${r.link ? ` [${r.link}]` : ''}`);
      if (lines.length >= 10) break;
    }
    if (lines.length >= 10) break;
  }

  return lines.length ? lines.join('\n') : null;
}

module.exports = { webSearch };
