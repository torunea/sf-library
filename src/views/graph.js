// ═══════════════════════════════════════
//  views/graph.js — グラフビュー
//  タブ切り替え時に初めてimportされる（遅延ロード）
// ═══════════════════════════════════════

import { state, titleById } from '../store.js';
import { RELATION_STYLES, GENRE_MAP } from '../config.js';

let _resizeTimer = null;

export function initGraph(onNodeClick) {
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => drawGraph(onNodeClick), 300);
  });
}

export function drawGraph(onNodeClick) {
  const svg = document.getElementById('graphSvg');
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;

  const ns = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  // ── ジャンル帯域 ──────────────────────
  const zones = [
    { x: W*0.12, y: H*0.18, r: 170, color: '#2de8b0', label: 'CYBERPUNK' },
    { x: W*0.72, y: H*0.22, r: 150, color: '#9b6ee8', label: 'SPACE OPERA' },
    { x: W*0.55, y: H*0.72, r: 140, color: '#e87dc8', label: 'NEW WAVE' },
    { x: W*0.25, y: H*0.70, r: 130, color: '#4adee8', label: 'AI / 意識' },
    { x: W*0.82, y: H*0.65, r: 110, color: '#c8a96e', label: 'FIRST CONTACT' },
  ];

  const defs = document.createElementNS(ns, 'defs');
  zones.forEach((z, i) => {
    const rg = document.createElementNS(ns, 'radialGradient');
    rg.setAttribute('id', `zg${i}`);
    rg.setAttribute('cx', '50%'); rg.setAttribute('cy', '50%'); rg.setAttribute('r', '50%');
    ['0%', '100%'].forEach((offset, j) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', offset);
      s.setAttribute('stop-color', z.color);
      s.setAttribute('stop-opacity', j === 0 ? '0.07' : '0');
      rg.appendChild(s);
    });
    defs.appendChild(rg);
  });
  svg.appendChild(defs);

  zones.forEach((z, i) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', z.x); c.setAttribute('cy', z.y); c.setAttribute('r', z.r);
    c.setAttribute('fill', `url(#zg${i})`);
    svg.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', z.x);
    t.setAttribute('y', z.y - z.r * 0.55);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', z.color);
    t.setAttribute('class', 'zone-label');
    t.textContent = z.label;
    svg.appendChild(t);
  });

  // ── ノード配置（著者・ジャンルクラスタ） ──
  const nodes = buildClusteredNodes(state.books, W, H);

  // ── エッジ（重複パスを曲線でずらす） ──────
  const edgePairCount = {};
  state.links.forEach(l => {
    const key = [l.from_book_id, l.to_book_id].sort().join('__');
    edgePairCount[key] = (edgePairCount[key] || 0) + 1;
  });
  const edgePairIndex = {};
  state.links.forEach(l => {
    const a = nodes.find(n => n.id === l.from_book_id);
    const b = nodes.find(n => n.id === l.to_book_id);
    if (!a || !b) return;
    const key = [l.from_book_id, l.to_book_id].sort().join('__');
    edgePairIndex[key] = (edgePairIndex[key] || 0) + 1;
    const total = edgePairCount[key];
    const idx   = edgePairIndex[key];
    // 複数エッジがある場合のみ曲率をつける
    const curvature = total > 1 ? (idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * 30 : 0;
    const style = RELATION_STYLES[l.relation] || RELATION_STYLES['引用・参照'];
    drawEdge(svg, ns, a, b, l, style, onNodeClick, curvature);
  });

  // ── ノード ──────────────────────────────
  nodes.forEach(n => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('cursor', 'pointer');
    g.setAttribute('transform', `translate(${n.x},${n.y})`);
    g.addEventListener('click', () => onNodeClick(n.id));

    // 読了グロー
    if (n.read) {
      const glow = document.createElementNS(ns, 'circle');
      glow.setAttribute('r', n.r + 6);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', n.color);
      glow.setAttribute('stroke-width', '1');
      glow.setAttribute('opacity', '0.2');
      g.appendChild(glow);
    }

    // 短編集・通常作品ともに丸で統一
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('r', n.r);
    c.setAttribute('fill', n.read ? 'rgba(10,12,16,0.9)' : 'rgba(10,12,16,0.6)');
    c.setAttribute('stroke', n.color);
    c.setAttribute('stroke-width', n.read ? '2' : '1');
    g.appendChild(c);

    // 出版年ラベル
    const yt = document.createElementNS(ns, 'text');
    yt.setAttribute('y', -n.r - 8);
    yt.setAttribute('text-anchor', 'middle');
    yt.setAttribute('fill', 'rgba(90,106,130,0.8)');
    yt.setAttribute('font-size', '9');
    yt.setAttribute('font-family', 'Space Mono, monospace');
    yt.textContent = n.year;
    g.appendChild(yt);

    // タイトルラベル
    const lt = document.createElementNS(ns, 'text');
    lt.setAttribute('y', n.r + 16);
    lt.setAttribute('text-anchor', 'middle');
    lt.setAttribute('fill', n.color);
    lt.setAttribute('font-size', '10');
    lt.setAttribute('font-family', 'Shippori Mincho, serif');
    lt.setAttribute('opacity', '0.85');
    lt.textContent = n.label;
    g.appendChild(lt);

    svg.appendChild(g);
  });
}

// ── 著者・ジャンルクラスタ配置 ────────────
function buildClusteredNodes(books, W, H) {
  // 著者をジャンルの主タグでソートして隣接配置
  const authors = [...new Set(books.map(b => b.author_name))];
  authors.sort((a, b) => {
    const genreA = (books.find(bk => bk.author_name === a)?.genre_tags || '').split(';')[0];
    const genreB = (books.find(bk => bk.author_name === b)?.genre_tags || '').split(';')[0];
    return genreA.localeCompare(genreB, 'ja');
  });

  // 著者グループの中心を円状に配置
  const authorCenters = {};
  authors.forEach((author, i) => {
    const angle = (i / authors.length) * Math.PI * 2 - Math.PI / 2;
    authorCenters[author] = {
      x: W * 0.5 + Math.cos(angle) * W * 0.28,
      y: H * 0.5 + Math.sin(angle) * H * 0.28,
    };
  });

  // 著者ごとの本リスト
  const authorBooks = {};
  books.forEach(b => {
    if (!authorBooks[b.author_name]) authorBooks[b.author_name] = [];
    authorBooks[b.author_name].push(b);
  });

  return books.map(b => {
    const center   = authorCenters[b.author_name];
    const siblings = authorBooks[b.author_name];
    const sibIdx   = siblings.indexOf(b);
    const sibCount = siblings.length;

    // 著者内で放射状に散らす（1冊ならそのまま中心）
    let offsetX = 0, offsetY = 0;
    if (sibCount > 1) {
      const angle  = (sibIdx / sibCount) * Math.PI * 2;
      const spread = Math.min(65, sibCount * 20);
      offsetX = Math.cos(angle) * spread;
      offsetY = Math.sin(angle) * spread;
    }

    return {
      id:        b.id,
      label:     b.title_jp,
      year:      b.year_jp,
      color:     bookColor(b),
      r:         20,
      read:      String(b.is_read).toUpperCase() === 'TRUE',
      anthology: String(b.is_anthology).toUpperCase() === 'TRUE',
      x:         center.x + offsetX,
      y:         center.y + offsetY,
    };
  });
}

// ── エッジ描画（曲線対応） ─────────────────
function drawEdge(svg, ns, a, b, linkData, style, onNodeClick, curvature = 0) {
  const dx  = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  // 二次ベジェの制御点
  const cx = (a.x + b.x) / 2 - (dy / len) * curvature;
  const cy = (a.y + b.y) / 2 + (dx / len) * curvature;

  // 矢印の終点をノード縁に合わせる
  const tx = b.x - dx / len * (b.r || 20);
  const ty = b.y - dy / len * (b.r || 20);

  const eg = document.createElementNS(ns, 'g');
  eg.setAttribute('cursor', 'pointer');

  const endX = style.arrow ? tx : b.x;
  const endY = style.arrow ? ty : b.y;
  const d    = `M ${a.x} ${a.y} Q ${cx} ${cy} ${endX} ${endY}`;

  // 可視パス
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', style.color);
  path.setAttribute('stroke-width', '1.5');
  if (style.dash) path.setAttribute('stroke-dasharray', '5,4');
  eg.appendChild(path);

  // 矢印ヘッド（制御点→終点方向に向ける）
  let tri;
  if (style.arrow) {
    const adx  = endX - cx, ady = endY - cy;
    const alen = Math.sqrt(adx * adx + ady * ady);
    const mx2  = (cx + endX) / 2, my2 = (cy + endY) / 2;
    const ax2  = mx2 + adx / alen * 8, ay2 = my2 + ady / alen * 8;
    const perp = [-ady / alen * 5, adx / alen * 5];
    tri = document.createElementNS(ns, 'polygon');
    tri.setAttribute('points',
      `${ax2},${ay2} ${ax2 - adx/alen*12 + perp[0]},${ay2 - ady/alen*12 + perp[1]} ${ax2 - adx/alen*12 - perp[0]},${ay2 - ady/alen*12 - perp[1]}`);
    tri.setAttribute('fill', style.color);
    eg.appendChild(tri);
  }

  // 透明ヒットエリア（同じ曲線形状）
  const hit = document.createElementNS(ns, 'path');
  hit.setAttribute('d', d);
  hit.setAttribute('fill', 'none');
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', '18');
  eg.appendChild(hit);

  eg.addEventListener('mouseenter', () => {
    path.setAttribute('stroke', style.activeColor);
    path.setAttribute('stroke-width', '2.5');
    if (tri) tri.setAttribute('fill', style.activeColor);
  });
  eg.addEventListener('mouseleave', () => {
    path.setAttribute('stroke', style.color);
    path.setAttribute('stroke-width', '1.5');
    if (tri) tri.setAttribute('fill', style.color);
  });
  eg.addEventListener('click', ev => {
    ev.stopPropagation();
    showEdgePopup(ev, linkData, a, b, onNodeClick);
  });

  svg.appendChild(eg);
}

// ── エッジポップアップ ────────────────────
function showEdgePopup(ev, link, nodeA, nodeB, onNodeClick) {
  document.getElementById('edgePopup')?.remove();
  const popup = document.createElement('div');
  popup.id        = 'edgePopup';
  popup.className = 'link-popup';
  popup.innerHTML = `
    <button class="link-popup-close" onclick="document.getElementById('edgePopup').remove()">✕</button>
    <div class="link-popup-header">
      <span class="link-popup-rel">${link.relation}</span>
    </div>
    <div class="link-popup-body">
      <div class="link-popup-books">
        <span class="link-popup-book" data-id="${link.from_book_id}">${titleById(link.from_book_id)}</span>
        <span class="link-popup-sep">→</span>
        <span class="link-popup-book" data-id="${link.to_book_id}">${titleById(link.to_book_id)}</span>
      </div>
      <div class="link-popup-note">${link.note || ''}</div>
    </div>`;

  // 先にDOMへ追加して実サイズを取得（画面外防止）
  popup.style.visibility = 'hidden';
  document.body.appendChild(popup);

  const margin = 12;
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;

  let x = ev.clientX + margin;
  let y = ev.clientY + margin;

  if (x + pw > window.innerWidth  - margin) x = ev.clientX - pw - margin;
  if (x < margin) x = margin;
  if (y + ph > window.innerHeight - margin) y = ev.clientY - ph - margin;
  if (y < margin) y = margin;

  popup.style.left       = x + 'px';
  popup.style.top        = y + 'px';
  popup.style.visibility = '';

  popup.querySelectorAll('.link-popup-book').forEach(el => {
    el.addEventListener('click', () => {
      popup.remove();
      onNodeClick(el.dataset.id);
    });
  });
}

// ── ユーティリティ ────────────────────────
function bookColor(b) {
  const genre = (b.genre_tags || '').split(';')[0];
  return GENRE_MAP[genre]?.color || 'hsl(210,50%,60%)';
}