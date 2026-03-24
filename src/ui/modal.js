// ═══════════════════════════════════════
//  ui/modal.js — リンク追加モーダル
// ═══════════════════════════════════════

import { state } from '../store.js';
import { addLink } from '../data.js';
import { showToast } from './toast.js';

let _selected = { bookId: null, relation: null };
let _onSuccess = null;

export function initModal() {
  const modal      = document.getElementById('linkModal');
  const closeBtn   = document.getElementById('linkModalClose');
  const cancelBtn  = document.getElementById('linkModalCancel');
  const searchInput = document.getElementById('lmSearch');
  const submitBtn  = document.getElementById('lmSubmit');
  const relBtns    = document.querySelectorAll('.lm-rel-btn');

  closeBtn.addEventListener('click',  closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  searchInput.addEventListener('input', () => renderResults(searchInput.value));

  relBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      relBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _selected.relation = btn.dataset.rel;
      checkSubmit();
    });
  });

  submitBtn.addEventListener('click', async () => {
    const { bookId, relation } = _selected;
    if (!bookId || !relation) return;
    const note = document.getElementById('lmNote').value.trim();
    const scope = state.linkModalScope;
    const fromStoryId = scope.startsWith('story_')
      ? state.stories.find((_, i) => i === parseInt(scope.split('_')[1]))?.id || ''
      : '';

    try {
      await addLink(state.currentBookId, fromStoryId, bookId, '', relation, note);
      showToast('リンクを追加しました', 'success');
      closeModal();
      if (_onSuccess) _onSuccess();
    } catch (e) {
      showToast('保存に失敗しました: ' + e.message, 'error');
    }
  });
}

export function openModal(scope, onSuccess) {
  state.linkModalScope = scope || 'book';
  _onSuccess = onSuccess;
  _selected = { bookId: null, relation: null };

  document.getElementById('lmSearch').value = '';
  document.getElementById('lmNote').value = '';
  document.getElementById('lmResults').innerHTML = '';
  document.querySelectorAll('.lm-rel-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('lmSubmit').disabled = true;

  renderResults('');
  document.getElementById('linkModal').classList.add('open');
}

export function closeModal() {
  document.getElementById('linkModal').classList.remove('open');
}

function renderResults(query) {
  const container = document.getElementById('lmResults');
  const q = query.trim().toLowerCase();
  const matches = state.books
    .filter(b => b.id !== state.currentBookId)
    .filter(b => !q || b.title_jp.includes(q) || b.author_name.includes(q))
    .slice(0, 6);

  container.innerHTML = matches.map(b => `
    <div class="lm-result-item" data-id="${b.id}">
      <span style="font-family:'Shippori Mincho',serif">${b.title_jp}</span>
      <span style="font-size:0.62rem;color:var(--text-dim);margin-left:0.5rem">${b.author_name}</span>
    </div>`).join('');

  container.querySelectorAll('.lm-result-item').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.lm-result-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      _selected.bookId = el.dataset.id;
      checkSubmit();
    });
  });
}

function checkSubmit() {
  document.getElementById('lmSubmit').disabled = !(_selected.bookId && _selected.relation);
}