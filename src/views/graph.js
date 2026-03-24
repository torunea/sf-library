// ═══════════════════════════════════════
//  views/graph.js — グラフビュー
//  force-directed layout + クラスタ切り替え
// ═══════════════════════════════════════

import { state, titleById } from '../store.js';
import { RELATION_STYLES, GENRE_MAP } from '../config.js';

let _resizeTimer  = null;
let _clusterMode  = 'author'; // 'author' | 'genre'
let _onNodeClick  = null;

export function initGraph(onNodeClick) {
  _onNodeClick = onNodeClick;

  // リサイズ対応
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => drawGraph(_onNodeClick), 300);
  });

  // クラスタ切り替えボタン
  document.querySelectorAll('.graph-ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.graph-ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _clusterMode = btn.dataset.cluster;
      drawGraph(_onNodeClick);
    });
  });
}

export function drawGraph(onNodeClick) {
  if (onNodeClick) _onNodeClick = onNodeClick;
  const svg = document.getElementById('graphSvg');
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;

  const ns = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  if (!state.books.length) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', W/2); t.setAttribute('y', H/2);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'rgba(90,106,130,0.5)');
    t.setAttribute('font-size', '13');
    t.setAttribute('font-family', 'Space Mono, monospace');
    t.textContent = 'NO DATA';
    svg.appendChild(t);
    return;
  }

  // ── ノード初期化 ──────────────────────
  const nodes = initNodes(state.books, W, H);

  // ── クラスタ中心を計算 ────────────────
  const clusterCenters = computeClusterCenters(nodes, W, H);

  // ── force-directed シミュレーション ───
  simulate(nodes, clusterCenters, W, H);

  // ── SVG描画 ──────────────────────────
  renderSVG(svg, ns, nodes, clusterCenters, W, H);
}

// ── ノード初期化（ランダム初期配置）──────
function initNodes(books, W, H) {
  return books.map(b => {
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * Math.min(W, H) * 0.3;
    return {
      id:       b.id,
      label:    b.title_jp,
      year:     b.year_jp,
      color:    bookColor(b),
      r:        20,
      read:     String(b.is_read).toUpperCase() === 'TRUE',
      author:   b.author_name,
      genre:    (b.genre_tags || '').split(';')[0],
      // clusterKey はモードに応じて変わる
      get clusterKey() { return _clusterMode === 'author' ? this.author : this.genre; },
      x:  W / 2 + Math.cos(angle) * r,
      y:  H / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    };
  });
}

// ── クラスタ中心座標を計算 ──────────────
function computeClusterCenters(nodes, W, H) {
  const keys = [...new Set(nodes.map(n => n.clusterKey))];
  const centers = {};

  // クラスタ数に応じて円状に均等配置
  keys.forEach((key, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const rx = W * 0.3, ry = H * 0.3;
    centers[key] = {
      x: W / 2 + Math.cos(angle) * rx,
      y: H / 2 + Math.sin(angle) * ry,
    };
  });
  return centers;
}

// ── Force-directed シミュレーション ─────
function simulate(nodes, clusterCenters, W, H) {
  const ITERATIONS  = 180;   // 計算回数
  const NODE_R      = 22;    // ノード半径（反発計算用）
  const MIN_DIST    = NODE_R * 2 + 20; // 最小ノード間距離

  // リンクインデックス（bookId → bookId）
  const linkedPairs = new Set(
    state.links.map(l => `${l.from_book_id}__${l.to_book_id}`)
  );
  function isLinked(a, b) {
    return linkedPairs.has(`${a.id}__${b.id}`) || linkedPairs.has(`${b.id}__${a.id}`);
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const alpha = 1 - iter / ITERATIONS; // 冷却係数

    nodes.forEach(n => { n.vx = 0; n.vy = 0; });

    // ① ノード間反発力
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < MIN_DIST) {
          const force = (MIN_DIST - dist) / dist * 0.5;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }
    }

    // ② リンク引力（繋がったノードを引き寄せる）
    state.links.forEach(l => {
      const a = nodes.find(n => n.id === l.from_book_id);
      const b = nodes.find(n => n.id === l.to_book_id);
      if (!a || !b) return;
      const dx   = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const target = MIN_DIST * 1.8; // リンク同士の理想距離
      const force  = (dist - target) / dist * 0.12;
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    });

    // ③ クラスタ引力（同クラスタのノードを中心に引き寄せる）
    nodes.forEach(n => {
      const center = clusterCenters[n.clusterKey];
      if (!center) return;
      const dx   = center.x - n.x, dy = center.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = 0.08 * alpha; // 冷却とともに弱める
      n.vx += dx * force;
      n.vy += dy * force;
    });

    // ④ 速度を適用・画面内に収める
    const padding = 50;
    nodes.forEach(n => {
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
      n.x = Math.max(padding, Math.min(W - padding, n.x));
      n.y = Math.max(padding, Math.min(H - padding, n.y));
    });
  }
}

// ── SVG描画 ──────────────────────────────
function renderSVG(svg, ns, nodes, clusterCenters, W, H) {
  // クラスタラベル（重心に薄く表示）
  renderClusterLabels(svg, ns, nodes, clusterCenters);

  // エッジ（重複パスを曲線でずらす）
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
    const total      = edgePairCount[key];
    const idx        = edgePairIndex[key];
    const curvature  = total > 1 ? (idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * 30 : 0;
    const style      = RELATION_STYLES[l.relation] || RELATION_STYLES['引用・参照'];
    drawEdge(svg, ns, a, b, l, style, curvature);
  });

  // ノード
  nodes.forEach(n => drawNode(svg, ns, n));
}

// ── クラスタラベル ────────────────────────
function renderClusterLabels(svg, ns, nodes, clusterCenters) {
  // クラスタごとのノード重心を計算
  const clusterNodes = {};
  nodes.forEach(n => {
    if (!clusterNodes[n.clusterKey]) clusterNodes[n.clusterKey] = [];
    clusterNodes[n.clusterKey].push(n);
  });

  Object.entries(clusterNodes).forEach(([key, members]) => {
    const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
    const cy = members.reduce((s, n) => s + n.y, 0) / members.length;

    // ラベルをノード群の重心の少し上に配置
    const label = _clusterMode === 'genre'
      ? (GENRE_MAP[key] ? key : key)
      : key;

    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', cy - 36); // ノードより上
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '11');
    t.setAttribute('letter-spacing', '0.15em');
    t.setAttribute('font-family', 'Space Mono, monospace');
    t.setAttribute('text-transform', 'uppercase');
    t.setAttribute('pointer-events', 'none');

    // ジャンルモードはジャンル色、著者モードは著者色
    const color = _clusterMode === 'genre'
      ? (GENRE_MAP[key]?.color || 'rgba(200,212,232,0.25)')
      : authorColor(key);
    t.setAttribute('fill', color);
    t.setAttribute('opacity', '0.28');
    t.textContent = label.toUpperCase();
    svg.appendChild(t);
  });
}

// ── ノード描画 ────────────────────────────
function drawNode(svg, ns, n) {
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('cursor', 'pointer');
  g.setAttribute('transform', `translate(${n.x},${n.y})`);
  g.addEventListener('click', () => _onNodeClick?.(n.id));

  if (n.read) {
    const glow = document.createElementNS(ns, 'circle');
    glow.setAttribute('r', n.r + 6);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', n.color);
    glow.setAttribute('stroke-width', '1');
    glow.setAttribute('opacity', '0.2');
    g.appendChild(glow);
  }

  const c = document.createElementNS(ns, 'circle');
  c.setAttribute('r', n.r);
  c.setAttribute('fill', n.read ? 'rgba(10,12,16,0.9)' : 'rgba(10,12,16,0.6)');
  c.setAttribute('stroke', n.color);
  c.setAttribute('stroke-width', n.read ? '2' : '1');
  g.appendChild(c);

  const yt = document.createElementNS(ns, 'text');
  yt.setAttribute('y', -n.r - 8);
  yt.setAttribute('text-anchor', 'middle');
  yt.setAttribute('fill', 'rgba(90,106,130,0.8)');
  yt.setAttribute('font-size', '9');
  yt.setAttribute('font-family', 'Space Mono, monospace');
  yt.setAttribute('pointer-events', 'none');
  yt.textContent = n.year;
  g.appendChild(yt);

  const lt = document.createElementNS(ns, 'text');
  lt.setAttribute('y', n.r + 16);
  lt.setAttribute('text-anchor', 'middle');
  lt.setAttribute('fill', n.color);
  lt.setAttribute('font-size', '10');
  lt.setAttribute('font-family', 'Shippori Mincho, serif');
  lt.setAttribute('opacity', '0.85');
  lt.setAttribute('pointer-events', 'none');
  lt.textContent = n.label;
  g.appendChild(lt);

  svg.appendChild(g);
}

// ── エッジ描画（二次ベジェ曲線） ──────────
function drawEdge(svg, ns, a, b, linkData, style, curvature = 0) {
  const dx  = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const cx  = (a.x + b.x) / 2 - (dy / len) * curvature;
  const cy  = (a.y + b.y) / 2 + (dx / len) * curvature;
  const tx  = b.x - dx / len * (b.r || 20);
  const ty  = b.y - dy / len * (b.r || 20);
  const endX = style.arrow ? tx : b.x;
  const endY = style.arrow ? ty : b.y;
  const d    = `M ${a.x} ${a.y} Q ${cx} ${cy} ${endX} ${endY}`;

  const eg = document.createElementNS(ns, 'g');
  eg.setAttribute('cursor', 'pointer');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', style.color);
  path.setAttribute('stroke-width', '1.5');
  if (style.dash) path.setAttribute('stroke-dasharray', '5,4');
  eg.appendChild(path);

  let tri;
  if (style.arrow) {
    const adx  = endX - cx, ady = endY - cy;
    const alen = Math.sqrt(adx * adx + ady * ady) || 0.01;
    const mx2  = (cx + endX) / 2, my2 = (cy + endY) / 2;
    const ax2  = mx2 + adx / alen * 8, ay2 = my2 + ady / alen * 8;
    const perp = [-ady / alen * 5, adx / alen * 5];
    tri = document.createElementNS(ns, 'polygon');
    tri.setAttribute('points',
      `${ax2},${ay2} ${ax2 - adx/alen*12 + perp[0]},${ay2 - ady/alen*12 + perp[1]} ${ax2 - adx/alen*12 - perp[0]},${ay2 - ady/alen*12 - perp[1]}`);
    tri.setAttribute('fill', style.color);
    eg.appendChild(tri);
  }

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
    showEdgePopup(ev, linkData, a, b);
  });

  svg.appendChild(eg);
}

// ── エッジポップアップ ────────────────────
function showEdgePopup(ev, link, nodeA, nodeB) {
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

  popup.style.visibility = 'hidden';
  document.body.appendChild(popup);

  const margin = 12;
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  let x = ev.clientX + margin, y = ev.clientY + margin;
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
      _onNodeClick?.(el.dataset.id);
    });
  });
}

// ── ユーティリティ ────────────────────────
function bookColor(b) {
  const genre = (b.genre_tags || '').split(';')[0];
  return GENRE_MAP[genre]?.color || 'hsl(210,50%,60%)';
}

const _authorColorCache = {};
function authorColor(name) {
  if (!_authorColorCache[name]) {
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    _authorColorCache[name] = `hsl(${hue},45%,55%)`;
  }
  return _authorColorCache[name];
}