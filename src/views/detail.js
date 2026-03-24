// ═══════════════════════════════════════
//  views/detail.js — 詳細パネル
// ═══════════════════════════════════════

import { state, getBook, getStoriesForBook, getMemosForBook, getMemosForStory, getLinksFrom, getLinksFromStory, titleById } from '../store.js';
import { addMemo, editMemo, deleteMemo, fetchMemos, fetchLinks, deleteLink } from '../data.js';
import { openModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { GENRE_MAP } from '../config.js';

export function openDetail(bookId) {
  const b = getBook(bookId);
  if (!b) return;
  state.currentBookId = bookId;

  document.getElementById('panelYear').textContent  = b.year_jp;
  document.getElementById('panelTitle').textContent = b.title_jp;
  document.getElementById('panelOrig').textContent  = b.title_orig;

  const genres = (b.genre_tags || '').split(';').filter(Boolean);
  document.getElementById('panelMeta').innerHTML =
    `<span class="meta-chip">${b.author_name}</span>
     <span class="meta-chip">${b.publisher}</span>
     ${String(b.is_anthology).toUpperCase() === 'TRUE' ? '<span class="meta-chip" style="color:var(--gold)">短編集</span>' : ''}`;

  document.getElementById('panelTags').innerHTML = genres.map(g => {
    const cls = GENRE_MAP[g]?.cls || '';
    return `<span class="genre-tag ${cls}" style="margin:0.2rem 0.2rem 0 0;font-size:0.65rem">${g}</span>`;
  }).join('');

  switchTab('info');
  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('overlay').classList.add('active');
}

export function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
  state.currentBookId = null;
}

export function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.panel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const body    = document.getElementById('panelBody');
  const compose = document.getElementById('composeArea');
  const b = getBook(state.currentBookId);
  if (!b) return;

  // タブ切り替え時に必ずリセット
  body.innerHTML = '';
  compose.style.display = 'none';

  if (tab === 'info') {
    renderInfo(b, body);
  } else if (tab === 'memo') {
    compose.style.display = '';
    renderMemoThread(state.currentBookId, null, body);
  } else if (tab === 'links') {
    renderLinksSection(state.currentBookId, null, body);
  }
}

// ── 概要タブ ────────────────────────────
function renderInfo(b, container) {
  const isAnthology = String(b.is_anthology).toUpperCase() === 'TRUE';
  let html = `<p class="synopsis-text">${b.synopsis || 'あらすじ未登録'}</p>`;

  if (isAnthology) {
    const stories = getStoriesForBook(b.id);
    html += `<div class="stories-list">`;
    stories.forEach((s, i) => {
      html += `
        <div class="story-item" data-idx="${i}" data-story-id="${s.id}">
          <span class="story-num">${String(s.order).padStart(2, '0')}</span>
          <span class="story-title">${s.title_jp}</span>
          <span class="story-orig">${s.title_orig}</span>
          ${s.year_orig ? `<span style="font-family:'Space Mono',monospace;font-size:0.58rem;color:var(--text-dim);margin-left:auto;padding-right:0.4rem">${s.year_orig}</span>` : ''}
          <span class="story-expand-icon">▶</span>
        </div>
        <div class="story-sub-panel" id="storySub_${i}">
          <div class="story-sub-tabs">
            <button class="story-sub-tab active" data-sub-tab="memo" data-idx="${i}">メモ</button>
            <button class="story-sub-tab" data-sub-tab="links" data-idx="${i}">リンク</button>
          </div>
          <div class="story-sub-body" id="storySubBody_${i}"></div>
        </div>`;
    });
    html += `</div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('.story-item').forEach(row => {
    row.addEventListener('click', () => toggleStory(parseInt(row.dataset.idx)));
  });
  container.querySelectorAll('.story-sub-tab').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      switchStorySub(parseInt(btn.dataset.idx), btn.dataset.subTab, btn);
    });
  });
}

function toggleStory(idx) {
  const row = document.querySelector(`.story-item[data-idx="${idx}"]`);
  const sub = document.getElementById(`storySub_${idx}`);
  const isOpen = sub.classList.contains('open');
  document.querySelectorAll('.story-sub-panel.open').forEach(el => {
    el.classList.remove('open');
    el.previousElementSibling?.classList.remove('open');
  });
  if (!isOpen) {
    row.classList.add('open');
    sub.classList.add('open');
    switchStorySub(idx, 'memo', sub.querySelector('.story-sub-tab'));
  }
}

function switchStorySub(idx, tab, activeBtn) {
  const stories = getStoriesForBook(state.currentBookId);
  const s = stories[idx];
  if (!s) return;

  const sub = document.getElementById(`storySub_${idx}`);
  if (!sub) return;
  sub.querySelectorAll('.story-sub-tab').forEach(t => t.classList.remove('active'));
  if (activeBtn) activeBtn.classList.add('active');

  const storyId = document.querySelector(`.story-item[data-idx="${idx}"]`)?.dataset.storyId;
  const body    = document.getElementById(`storySubBody_${idx}`);
  body.innerHTML = ''; // サブパネルをリセット

  if (tab === 'memo') {
    // 話のタグを先頭に表示
    const storyTags = (s.genre_tags || '').split(';').filter(Boolean);
    if (storyTags.length > 0) {
      const tagHtml = `<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.7rem">
        ${storyTags.map(g => {
          const cls = GENRE_MAP[g]?.cls || '';
          return `<span class="genre-tag ${cls}" style="font-size:0.62rem">${g}</span>`;
        }).join('')}
      </div>`;
      body.insertAdjacentHTML('afterbegin', tagHtml);
    }
    renderMemoThread(state.currentBookId, storyId, body);
    body.insertAdjacentHTML('beforeend', `
      <div class="story-compose" style="margin-top:0.6rem">
        <input class="story-compose-tag" id="storyTag_${idx}" placeholder="タグ（スペース区切り）">
        <textarea class="story-compose-input" id="storyMemo_${idx}" placeholder="この話についてのメモ…" rows="2"></textarea>
        <button class="story-compose-send" data-idx="${idx}" data-story-id="${storyId}">記録する</button>
      </div>`);
    body.querySelector('.story-compose-send').addEventListener('click', async btn => {
      const el = btn.currentTarget;
      await postStoryMemo(idx, el.dataset.storyId);
    });
  } else {
    // 話のリンク（storyIdを必ず渡して本のリンクと分離）
    renderLinksSection(state.currentBookId, storyId, body);
  }
}

async function postStoryMemo(idx, storyId) {
  const text = document.getElementById(`storyMemo_${idx}`)?.value.trim();
  if (!text) return;
  const tagVal = document.getElementById(`storyTag_${idx}`)?.value.trim();
  const tags   = tagVal ? tagVal.split(/\s+/).filter(Boolean) : [];
  try {
    await addMemo(state.currentBookId, storyId, text, tags);
    state.memos = await fetchMemos(true);
    switchStorySub(idx, 'memo', null);
    showToast('メモを追加しました', 'success');
  } catch (e) {
    showToast('保存に失敗: ' + e.message, 'error');
  }
}

// ── メモスレッド ────────────────────────
function renderMemoThread(bookId, storyId, container) {
  const memos = storyId
    ? getMemosForStory(storyId)
    : getMemosForBook(bookId);

  let html = '<div class="memo-thread">';
  memos.forEach(m => {
    html += `<div class="memo-item" data-memo-id="${m.id}">
      <div class="memo-header">
        <div class="memo-tags-row">
          ${(m.tags || '').split(';').filter(Boolean).map(t => `<span class="memo-tag">${t}</span>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span class="memo-date">${String(m.created_at).slice(0, 10)}</span>
          <div class="memo-actions">
            <button class="memo-action-btn edit-btn">編集</button>
            <button class="memo-action-btn del del-btn">削除</button>
          </div>
        </div>
      </div>
      <div class="memo-text">${m.text}</div>
    </div>`;
  });
  html += '</div>';

  const existing = container.querySelector('.memo-thread');
  if (existing) existing.outerHTML = html;
  else container.insertAdjacentHTML('afterbegin', html);

  container.querySelectorAll('.memo-item').forEach(item => {
    const id = item.dataset.memoId;
    item.querySelector('.edit-btn').addEventListener('click', () => startEditMemo(item, id));
    item.querySelector('.del-btn').addEventListener('click',  () => doDeleteMemo(id, bookId, storyId, container));
  });
}

function startEditMemo(item, id) {
  if (item.querySelector('.memo-edit-area')) return;
  const textEl = item.querySelector('.memo-text');
  const tagsEl = item.querySelector('.memo-tags-row');
  const currentText = textEl.textContent;
  const currentTags = [...tagsEl.querySelectorAll('.memo-tag')].map(t => t.textContent).join(' ');
  textEl.style.display = 'none';
  item.insertAdjacentHTML('beforeend', `
    <div class="memo-edit-area">
      <textarea class="memo-edit-textarea">${currentText}</textarea>
      <input class="memo-edit-tag-input" value="${currentTags}" placeholder="タグ（スペース区切り）">
      <div class="memo-edit-btns">
        <button class="memo-edit-cancel">キャンセル</button>
        <button class="memo-edit-save">保存</button>
      </div>
    </div>`);
  item.querySelector('.memo-edit-cancel').addEventListener('click', () => {
    item.querySelector('.memo-edit-area').remove();
    textEl.style.display = '';
  });
  item.querySelector('.memo-edit-save').addEventListener('click', async () => {
    const newText = item.querySelector('.memo-edit-textarea').value.trim();
    const newTags = item.querySelector('.memo-edit-tag-input').value.trim().split(/\s+/).filter(Boolean);
    if (!newText) return;
    try {
      await editMemo(id, newText, newTags);
      state.memos = await fetchMemos(true);
      switchTab(state.currentTab);
      showToast('メモを更新しました', 'success');
    } catch (e) {
      showToast('更新に失敗: ' + e.message, 'error');
    }
  });
}

async function doDeleteMemo(id, bookId, storyId, container) {
  if (!confirm('このメモを削除しますか？')) return;
  try {
    await deleteMemo(id);
    state.memos = await fetchMemos(true);
    renderMemoThread(bookId, storyId, container);
    showToast('削除しました');
  } catch (e) {
    showToast('削除に失敗: ' + e.message, 'error');
  }
}

// ── リンクセクション ─────────────────────
function renderLinksSection(bookId, storyId, container) {
  const links = storyId
    ? getLinksFromStory(storyId)
    : getLinksFrom(bookId);

  const scope = storyId ? 'story' : 'book';
  let html = `<div class="links-section">
    <button class="add-link-btn" data-scope="${scope}" data-story-id="${storyId || ''}">＋ リンクを追加</button>`;

  links.forEach(l => {
    const isSameWorld = l.relation === '同一世界観';
    const icon = isSameWorld
      ? `<svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="rgba(74,144,217,0.7)" stroke-width="1.5"/></svg>`
      : `<svg width="32" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="rgba(100,140,200,0.7)" stroke-width="1.5" stroke-dasharray="4,3"/><polygon points="32,5 22,2 22,8" fill="rgba(100,140,200,0.7)"/></svg>`;
    html += `<div class="link-item" data-link-id="${l.id}">
      ${icon}
      <span class="link-rel">${l.relation}</span>
      <span class="link-target">${titleById(l.to_book_id)}</span>
      <span class="link-dir">→</span>
      <button class="link-del-btn">✕</button>
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;

  container.querySelector('.add-link-btn').addEventListener('click', () => {
    openModal(scope, async () => {
      state.links = await fetchLinks(true);
      renderLinksSection(bookId, storyId, container);
    });
  });

  container.querySelectorAll('.link-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('このリンクを削除しますか？')) return;
      const id = btn.closest('.link-item').dataset.linkId;
      try {
        await deleteLink(id);
        state.links = await fetchLinks(true);
        renderLinksSection(bookId, storyId, container);
        showToast('削除しました');
      } catch (e) {
        showToast('削除に失敗: ' + e.message, 'error');
      }
    });
  });
}

// ── メモ投稿（本全体） ───────────────────
export function initCompose() {
  const input   = document.getElementById('composeTagInput');
  const preview = document.getElementById('composeTagPreview');

  input.addEventListener('input', () => {
    const tags = input.value.trim().split(/\s+/).filter(Boolean);
    preview.innerHTML = tags.map(t => `<span class="compose-tag-pill">${t}</span>`).join('');
  });

  document.getElementById('composeSend').addEventListener('click', async () => {
    const text = document.getElementById('composeText').value.trim();
    if (!text || !state.currentBookId) return;
    const tagVal = input.value.trim();
    const tags   = tagVal ? tagVal.split(/\s+/).filter(Boolean) : [];
    try {
      await addMemo(state.currentBookId, '', text, tags);
      state.memos = await fetchMemos(true);
      document.getElementById('composeText').value = '';
      input.value       = '';
      preview.innerHTML = '';
      switchTab('memo');
      showToast('メモを追加しました', 'success');
    } catch (e) {
      showToast('保存に失敗: ' + e.message, 'error');
    }
  });
}