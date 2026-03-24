// ═══════════════════════════════════════
//  views/list.js — 一覧ビュー
// ═══════════════════════════════════════

import { state } from '../store.js';
import { GENRE_MAP } from '../config.js';

export function renderList(onBookClick) {
  const container = document.getElementById('clusterContainer');
  const countEl   = document.getElementById('viewCount');

  // 作者でグループ化
  const byAuthor = {};
  state.books.forEach(b => {
    if (!byAuthor[b.author_name]) byAuthor[b.author_name] = [];
    byAuthor[b.author_name].push(b);
  });

  countEl.textContent = `${state.books.length} BOOKS`;

  container.innerHTML = Object.entries(byAuthor).map(([author, books], ci) => `
    <div class="author-cluster" style="animation-delay:${ci * 0.08}s">
      <div class="cluster-header">
        <div class="cluster-author">
          <div class="cluster-author-dot" style="background:${authorColor(author)}"></div>
          ${author}
        </div>
        <div class="cluster-line"></div>
      </div>
      <div class="books-grid">
        ${books.map(b => bookCardHTML(b)).join('')}
      </div>
    </div>`).join('');

  // クリックイベント
  container.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => onBookClick(card.dataset.id));
  });

  // サイドバー作者リスト
  renderAuthorList(byAuthor, onBookClick);
}

function bookCardHTML(b) {
  const genres = (b.genre_tags || '').split(';').filter(Boolean);
  const memoCount = state.memos.filter(m => m.book_id === b.id).length;
  const firstGenre = genres[0] || '';
  const borderClass = genreToBorderClass(firstGenre);
  const isRead = String(b.is_read).toUpperCase() === 'TRUE';

  return `<div class="book-card ${borderClass}" data-id="${b.id}">
    <div class="book-year">${b.year_jp}</div>
    <div class="book-title">${b.title_jp}</div>
    <div class="book-orig">${b.title_orig}</div>
    <div class="book-tags">
      ${genres.map(g => `<span class="book-tag ${GENRE_MAP[g]?.cls || ''}">${g}</span>`).join('')}
    </div>
    <div class="book-footer">
      ${isRead ? '<span class="book-read-badge">READ</span>' : '<span></span>'}
      ${String(b.is_anthology).toUpperCase() === 'TRUE'
        ? '<span class="anthology-mark">短編集</span>' : ''}
      <span class="book-memo-count">${memoCount > 0 ? memoCount + ' メモ' : '— メモ'}</span>
    </div>
  </div>`;
}

function renderAuthorList(byAuthor, onBookClick) {
  const list = document.getElementById('authorList');
  list.innerHTML = Object.entries(byAuthor).map(([author, books]) => `
    <div class="author-item" data-author="${author}">
      <div class="author-dot" style="background:${authorColor(author)}"></div>
      <span class="author-name">${author}</span>
      <span class="author-count">${books.length}</span>
    </div>`).join('');
}

export function renderGenreFilters() {
  const el = document.getElementById('genreFilters');
  el.innerHTML = Object.entries(GENRE_MAP).map(([label, { cls, color }]) => `
    <span class="genre-tag ${cls}" data-genre="${label}">
      <span class="dot" style="background:${color}"></span>${label}
    </span>`).join('');
}

// ── ユーティリティ ──────────────────────

const _colorCache = {};
export function authorColor(name) {
  if (!_colorCache[name]) {
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    _colorCache[name] = `hsl(${hue},55%,62%)`;
  }
  return _colorCache[name];
}

function genreToBorderClass(genre) {
  const map = {
    'サイバーパンク': 'bc-cyber', 'スペースオペラ': 'bc-space',
    'AI・意識': 'bc-ai', 'ディストピア': 'bc-dys',
    'ニュー・ウィーブ': 'bc-new', 'ファーストコンタクト': 'bc-first',
  };
  return map[genre] || '';
}