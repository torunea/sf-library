// ═══════════════════════════════════════
//  main.js — アプリ起動・ルーティング
// ═══════════════════════════════════════

import { state } from './store.js';
import { fetchBooks, fetchStories, fetchMemos, fetchLinks } from './data.js';
import { renderList, renderGenreFilters } from './views/list.js';
import { openDetail, closeDetail, switchTab, initCompose } from './views/detail.js';
import { initModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { GAS_URL } from './config.js';

// ── 起動 ────────────────────────────────
async function init() {
  // GAS URL をlocalStorageから復元
  const savedUrl = localStorage.getItem('sfl_gas_url');
  if (savedUrl) document.getElementById('gasUrlInput').value = savedUrl;

  showLoading(true);
  try {
    // 並列フェッチ
    const [books, stories, memos, links] = await Promise.all([
      fetchBooks(), fetchStories(), fetchMemos(), fetchLinks()
    ]);
    state.books   = books   || [];
    state.stories = stories || [];
    state.memos   = memos   || [];
    state.links   = links   || [];
  } catch (e) {
    showToast('データ取得に失敗しました: ' + e.message, 'error');
    // フォールバック：空で起動
  }
  showLoading(false);

  renderGenreFilters();
  renderList(bookId => openDetail(bookId));
  showView('list');
}

// ── ローディング ─────────────────────────
function showLoading(on) {
  document.getElementById('loadingScreen').style.display = on ? 'flex' : 'none';
  document.getElementById('listView').style.display      = on ? 'none' : '';
}

// ── ビュー切り替え ───────────────────────
let graphModule = null;

async function showView(view) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'list') {
    document.getElementById('listView').style.display  = '';
    document.getElementById('graphView').style.display = 'none';
  } else {
    document.getElementById('listView').style.display  = 'none';
    document.getElementById('graphView').style.display = '';
    // グラフは初回のみ動的import（軽量化）
    if (!graphModule) {
      graphModule = await import('./views/graph.js');
      graphModule.initGraph(bookId => openDetail(bookId));
      // SVGクリックでポップアップ閉じ
      document.getElementById('graphSvg').addEventListener('click', () => {
        document.getElementById('edgePopup')?.remove();
      });
    }
    graphModule.drawGraph(bookId => openDetail(bookId));
  }
}

// ── イベント登録 ─────────────────────────
function bindEvents() {
  // ナビゲーション
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // パネルを閉じる
  document.getElementById('panelClose').addEventListener('click',   closeDetail);
  document.getElementById('overlay').addEventListener('click',      closeDetail);

  // パネルタブ
  document.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // GAS URL保存
  document.getElementById('gasSaveBtn').addEventListener('click', async () => {
    const url    = document.getElementById('gasUrlInput').value.trim();
    const status = document.getElementById('gasStatus');
    if (!url) { status.style.color = 'var(--dystopia)'; status.textContent = 'URLを入力してください'; return; }
    localStorage.setItem('sfl_gas_url', url);
    // 接続テスト
    status.style.color = 'var(--text-dim)'; status.textContent = '確認中…';
    try {
      const res = await fetch(`${url}?type=books`);
      const json = await res.json();
      if (json.ok) {
        status.style.color = 'var(--cyber)'; status.textContent = '✓ 接続OK';
        // データを再取得
        state.books   = json.data || [];
        const [stories, memos, links] = await Promise.all([fetchStories(), fetchMemos(true), fetchLinks(true)]);
        state.stories = stories || [];
        state.memos   = memos   || [];
        state.links   = links   || [];
        renderList(bookId => openDetail(bookId));
        showToast('データを更新しました', 'success');
      } else {
        status.style.color = 'var(--dystopia)'; status.textContent = 'エラー: ' + json.error;
      }
    } catch (e) {
      status.style.color = 'var(--dystopia)'; status.textContent = '接続失敗';
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
  });
}

// ── エントリーポイント ────────────────────
bindEvents();
initCompose();
initModal();
init();