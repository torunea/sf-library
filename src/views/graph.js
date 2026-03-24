// ═══════════════════════════════════════
//  views/graph.js — グラフビュー
//  このファイルはタブ切り替え時に初めてimportされる
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
    t.setAttribute('x', z.x - z.r * 0.5); t.setAttribute('y', z.y - z.r * 0.72);
    t.setAttribute('fill', z.color); t.setAttribute('class', 'zone-label');
    t.textContent = z.label;
    svg.appendChild(t);
  });

  // ── ノード配置（スプレッドシートデータから） ──
  const nodes = state.books.map((b, i) => {
    const angle = (i / state.books.length) * Math.PI * 2;
    const rx = W * 0.32, ry = H * 0.32;
    return {
      id:    b.id,
      label: b.title_jp,
      year:  b.year_jp,
      color: bookColor(b),
      r:     20,
      read:  String(b.is_read).toUpperCase() === 'TRUE',
      anthology: String(b.is_anthology).toUpperCase() === 'TRUE',
      x: W * 0.5 + Math.cos(angle) * rx,
      y: H * 0.5 + Math.sin(angle) * ry,
    };
  });

  // ── エッジ ──────────────────────────────
  state.links.forEach(l => {
    const a = nodes.find(n => n.id === l.from_book_id);
    const b = nodes.find(n => n.id === l.to_book_id);
    if (!a || !b) return;
    const style = RELATION_STYLES[l.relation] || RELATION_STYLES['引用・参照'];
    drawEdge(svg, ns, a, b, l, style, onNodeClick);
  });

  // ── ノード ──────────────────────────────
  nodes.forEach(n => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('cursor', 'pointer');
    g.setAttribute('transform', `translate(${n.x},${n.y})`);
    g.addEventListener('click', () => onNodeClick(n.id));

    if (n.read) {
      const glow = document.createElementNS(ns, 'circle');
      glow.setAttribute('r', n.r + 6); glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', n.color); glow.setAttribute('stroke-width', '1');
      glow.setAttribute('opacity', '0.2');
      g.appendChild(glow);
    }

    if (n.anthology) {
      const s = n.r * 1.4;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', -s/2); rect.setAttribute('y', -s/2);
      rect.setAttribute('width', s); rect.setAttribute('height', s);
      rect.setAttribute('fill', n.read ? 'rgba(10,12,16,0.9)' : 'rgba(10,12,16,0.6)');
      rect.setAttribute('stroke', n.color);
      rect.setAttribute('stroke-width', n.read ? '2' : '1');
      rect.setAttribute('rx', '3');
      g.appendChild(rect);
    } else {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('r', n.r);
      c.setAttribute('fill', n.read ? 'rgba(10,12,16,0.9)' : 'rgba(10,12,16,0.6)');
      c.setAttribute('stroke', n.color);
      c.setAttribute('stroke-width', n.read ? '2' : '1');
      g.appendChild(c);
    }

    const yt = document.createElementNS(ns, 'text');
    yt.setAttribute('y', -n.r - 8); yt.setAttribute('text-anchor', 'middle');
    yt.setAttribute('fill', 'rgba(90,106,130,0.8)'); yt.setAttribute('font-size', '9');
    yt.setAttribute('font-family', 'Space Mono, monospace');
    yt.textContent = n.year;
    g.appendChild(yt);

    const lt = document.createElementNS(ns, 'text');
    lt.setAttribute('y', n.r + 16); lt.setAttribute('text-anchor', 'middle');
    lt.setAttribute('fill', n.color); lt.setAttribute('font-size', '10');
    lt.setAttribute('font-family', 'Shippori Mincho, serif');
    lt.setAttribute('opacity', '0.85');
    lt.textContent = n.label;
    g.appendChild(lt);

    svg.appendChild(g);
  });
}

function drawEdge(svg, ns, a, b, linkData, style, onNodeClick) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  const mx  = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const tx  = b.x - dx / len * (b.r || 20);
  const ty  = b.y - dy / len * (b.r || 20);

  const eg = document.createElementNS(ns, 'g');
  eg.setAttribute('cursor', 'pointer');

  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
  line.setAttribute('x2', style.arrow ? tx : b.x);
  line.setAttribute('y2', style.arrow ? ty : b.y);
  line.setAttribute('stroke', style.color); line.setAttribute('stroke-width', '1.5');
  if (style.dash) line.setAttribute('stroke-dasharray', '5,4');
  eg.appendChild(line);

  let tri;
  if (style.arrow) {
    const ax2 = mx + dx/len*8, ay2 = my + dy/len*8;
    const perp = [-dy/len*5, dx/len*5];
    tri = document.createElementNS(ns, 'polygon');
    tri.setAttribute('points', `${ax2},${ay2} ${ax2-dx/len*12+perp[0]},${ay2-dy/len*12+perp[1]} ${ax2-dx/len*12-perp[0]},${ay2-dy/len*12-perp[1]}`);
    tri.setAttribute('fill', style.color);
    eg.appendChild(tri);
  }

  // 透明ヒットエリア
  const hit = document.createElementNS(ns, 'line');
  hit.setAttribute('x1', a.x); hit.setAttribute('y1', a.y);
  hit.setAttribute('x2', b.x); hit.setAttribute('y2', b.y);
  hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '18');
  eg.appendChild(hit);

  eg.addEventListener('mouseenter', () => {
    line.setAttribute('stroke', style.activeColor); line.setAttribute('stroke-width', '2.5');
    if (tri) tri.setAttribute('fill', style.activeColor);
  });
  eg.addEventListener('mouseleave', () => {
    line.setAttribute('stroke', style.color); line.setAttribute('stroke-width', '1.5');
    if (tri) tri.setAttribute('fill', style.color);
  });
  eg.addEventListener('click', ev => {
    ev.stopPropagation();
    showEdgePopup(ev, linkData, a, b, onNodeClick);
  });

  svg.appendChild(eg);
}

function showEdgePopup(ev, link, nodeA, nodeB, onNodeClick) {
  document.getElementById('edgePopup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'edgePopup';
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

  document.body.appendChild(popup);
  const pw = 320, ph = 140;
  let x = ev.clientX + 12, y = ev.clientY - 20;
  if (x + pw > window.innerWidth  - 16) x = ev.clientX - pw - 12;
  if (y + ph > window.innerHeight - 16) y = ev.clientY - ph - 12;
  popup.style.left = x + 'px'; popup.style.top = y + 'px';

  popup.querySelectorAll('.link-popup-book').forEach(el => {
    el.addEventListener('click', () => {
      popup.remove();
      onNodeClick(el.dataset.id);
    });
  });
}

function bookColor(b) {
  const genre = (b.genre_tags || '').split(';')[0];
  return GENRE_MAP[genre]?.color || 'hsl(210,50%,60%)';
}