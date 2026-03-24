// ═══════════════════════════════════════
//  data.js — GASとの通信・キャッシュ管理
// ═══════════════════════════════════════

import { GAS_URL, CACHE_TTL } from './config.js';

// ── キャッシュ取得 ──────────────────────
function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ── GET ────────────────────────────────
async function gasGet(type, bustCache = false) {
  const key = `sfl_${type}`;
  if (!bustCache) {
    const cached = getCached(key);
    if (cached) return cached;
  }
  const url = `${GAS_URL}?type=${type}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'GAS error');
  setCache(key, json.data);
  return json.data;
}

// ── POST ───────────────────────────────
async function gasPost(action, data) {
  const res  = await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors', // GASはCORSヘッダーを返さないためno-cors
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  // no-corsではレスポンスが読めないため楽観的更新
  return { ok: true };
}

// ── 公開API ────────────────────────────

/** 本一覧を取得（スプレッドシートから） */
export async function fetchBooks() {
  return gasGet('books');
}

/** 短編各話一覧を取得 */
export async function fetchStories() {
  return gasGet('stories');
}

/** メモ一覧を取得 */
export async function fetchMemos(bustCache = false) {
  return gasGet('memos', bustCache);
}

/** リンク一覧を取得 */
export async function fetchLinks(bustCache = false) {
  return gasGet('links', bustCache);
}

/** メモを追加 */
export async function addMemo(bookId, storyId, text, tags) {
  const result = await gasPost('add_memo', {
    book_id: bookId, story_id: storyId || '',
    text, tags,
  });
  localStorage.removeItem('sfl_memos'); // キャッシュ破棄
  return result;
}

/** メモを編集 */
export async function editMemo(id, text, tags) {
  const result = await gasPost('edit_memo', { id, text, tags });
  localStorage.removeItem('sfl_memos');
  return result;
}

/** メモを削除 */
export async function deleteMemo(id) {
  const result = await gasPost('delete_memo', { id });
  localStorage.removeItem('sfl_memos');
  return result;
}

/** リンクを追加 */
export async function addLink(fromBookId, fromStoryId, toBookId, toStoryId, relation, note) {
  const result = await gasPost('add_link', {
    from_book_id: fromBookId, from_story_id: fromStoryId || '',
    to_book_id:   toBookId,   to_story_id:   toStoryId   || '',
    relation, note: note || '',
  });
  localStorage.removeItem('sfl_links');
  return result;
}

/** リンクを削除 */
export async function deleteLink(id) {
  const result = await gasPost('delete_link', { id });
  localStorage.removeItem('sfl_links');
  return result;
}