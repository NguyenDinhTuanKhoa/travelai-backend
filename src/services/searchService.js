// Web search fallback: khi câu hỏi nằm NGOÀI dữ liệu hệ thống, tra Google để trả lời
// chính xác thay vì để model bịa. SERPER.DEV LÀ NGUỒN CHÍNH (nhanh & ổn định ~1s); SerpApi
// chạy SONG SONG như phần bổ sung nhưng chỉ được CỬA SỔ NGẮN (SERPAPI_BUDGET_MS) — kịp thì
// gộp thêm, chậm (SerpApi hay lề mề 4-17s) thì bỏ qua để KHÔNG kéo dài lượt trả lời chat.
const serperManager = require('../utils/serperManager');
const serpApiManager = require('../utils/serpApiManager');

const TIMEOUT_MS = 8000;          // ngân sách cho nguồn CHÍNH (Serper) — nó nhanh nên hiếm khi chạm
const SERPAPI_BUDGET_MS = 3000;   // cửa sổ ngắn cho SerpApi (bổ sung): quá hạn → bỏ, Serper gánh

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

// Tra Google: Serper (CHÍNH, full window) + SerpApi (bổ sung, cửa sổ ngắn) song song rồi GỘP.
// Tổng độ trễ ≈ max(Serper, SerpApi≤3s). Trả về text hoặc null.
async function webSearch(query, num = 5) {
  if (!query || !query.trim()) return null;

  const tasks = [];
  if (process.env.SERPER_API_KEYS || process.env.SERPER_API_KEY) tasks.push({ name: 'Serper', budget: TIMEOUT_MS, run: () => fetchSerper(query, num) });
  if (process.env.SERPAPI_KEYS) tasks.push({ name: 'SerpApi', budget: SERPAPI_BUDGET_MS, run: () => fetchSerpApi(query, num) });
  if (!tasks.length) return null;

  const settled = await Promise.allSettled(tasks.map(t => withTimeout(t.run(), t.budget)));
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

// ── Tìm ĐỊA ĐIỂM THỰC (quán ăn/nhà hàng/khách sạn/cafe...) qua Google ──────────
// Khác webSearch (trả snippet chung): lấy local pack (SerpApi engine 'google' +
// Serper /places) để có DANH SÁCH cơ sở kèm tên/⭐rating/giá/địa chỉ — đúng thứ người
// dùng cần khi hỏi "quán nào ngon/rẻ/mắc". Model chỉ trình bày lại, KHÔNG bịa.

// Chuẩn hoá 1 địa điểm SerpApi google_local → { name, rating, reviews, price, address, category, link }
function mapSerpApiVenue(r) {
  return {
    name: r.title || '',
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviews: r.reviews || null,
    price: r.price || '',           // vd "₫₫", "$$"
    address: r.address || '',
    category: r.type || '',
    link: r.links?.website
      || (r.place_id ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : ''),
  };
}

// Chuẩn hoá 1 địa điểm Serper /places
function mapSerperVenue(r) {
  return {
    name: r.title || '',
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviews: r.ratingCount || null,
    price: r.priceLevel || '',
    address: r.address || '',
    category: r.category || '',
    link: r.website || (r.cid ? `https://www.google.com/maps?cid=${r.cid}` : ''),
  };
}

async function fetchSerpApiVenues(query, num) {
  // Engine 'google' (thường ~4s) thay vì 'google_local' (~17s, vượt cap timeout của chat).
  // Vẫn trả local pack; tuỳ engine, local_results là MẢNG (google_local) hoặc { places: [...] }
  // (google) → nhận cả 2 dạng.
  const data = await serpApiManager.fetchWithRotation({ engine: 'google', q: query, hl: 'vi', gl: 'vn', num });
  if (!data) return [];
  const local = Array.isArray(data.local_results)
    ? data.local_results
    : (data.local_results?.places || []);
  return local.slice(0, num).map(mapSerpApiVenue).filter(v => v.name);
}

async function fetchSerperVenues(query, num) {
  const data = await serperManager.searchPlaces(query);
  if (!data || !Array.isArray(data.places)) return [];
  return data.places.slice(0, num).map(mapSerperVenue).filter(v => v.name);
}

// Tra ĐỊA ĐIỂM: Serper places (CHÍNH, full window) + SerpApi local (bổ sung, cửa sổ ngắn)
// song song rồi GỘP + khử trùng theo tên. Tổng độ trễ ≈ max(Serper, SerpApi≤3s). Trả về text
// (mỗi dòng 1 cơ sở) hoặc null nếu không có provider/kết quả.
async function searchVenues(query, num = 6) {
  if (!query || !query.trim()) return null;

  const tasks = [];
  if (process.env.SERPER_API_KEYS || process.env.SERPER_API_KEY) tasks.push({ name: 'SerperPlaces', budget: TIMEOUT_MS, run: () => fetchSerperVenues(query, num) });
  if (process.env.SERPAPI_KEYS) tasks.push({ name: 'SerpApiLocal', budget: SERPAPI_BUDGET_MS, run: () => fetchSerpApiVenues(query, num) });
  if (!tasks.length) return null;

  const settled = await Promise.allSettled(tasks.map(t => withTimeout(t.run(), t.budget)));
  const all = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      all.push(...s.value);
      console.log(`[venues] ${tasks[i].name} OK (${s.value.length})`);
    } else {
      console.warn(`[venues] ${tasks[i].name} failed:`, s.reason?.message || 'no data');
    }
  });
  if (!all.length) return null;

  // Khử trùng theo tên chuẩn hoá; ưu tiên cơ sở CÓ rating (đưa lên trước)
  all.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const seen = new Set();
  const lines = [];
  for (const v of all) {
    const key = v.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const rt = v.rating ? `⭐${v.rating}${v.reviews ? ` (${v.reviews} đánh giá)` : ''}` : '';
    const meta = [rt, v.price, v.category].filter(Boolean).join(' · ');
    const parts = [v.name];
    if (meta) parts.push(meta);
    if (v.address) parts.push(v.address);
    let line = `• ${parts.join(' — ')}`;
    if (v.link) line += ` [${v.link}]`;
    lines.push(line);
    if (lines.length >= num) break;
  }

  return lines.length ? lines.join('\n') : null;
}

module.exports = { webSearch, searchVenues };
