// ═══════════════════════════════════════
//  config.js — アプリ設定
//  GAS_URL をデプロイURLに書き換えてください
// ═══════════════════════════════════════

export const GAS_URL = 'YOUR_GAS_DEPLOY_URL'; // ← ここにデプロイURLを貼り付け

export const CACHE_TTL = 60 * 60 * 1000; // 1時間（ミリ秒）

export const GENRE_MAP = {
  'サイバーパンク':         { cls: 'gt-cyber', color: '#2de8b0' },
  'スペースオペラ':         { cls: 'gt-space', color: '#9b6ee8' },
  'ファーストコンタクト':   { cls: 'gt-first', color: '#c8a96e' },
  'ディストピア':           { cls: 'gt-dys',   color: '#e85c4a' },
  'AI・意識':               { cls: 'gt-ai',    color: '#4adee8' },
  'ニュー・ウィーブ':       { cls: 'gt-new',   color: '#e87dc8' },
};

export const RELATION_STYLES = {
  '同一世界観': { color: 'rgba(74,144,217,0.35)',   activeColor: 'rgba(74,144,217,0.9)',   arrow: false, dash: false },
  '影響元':     { color: 'rgba(100,140,200,0.35)',  activeColor: 'rgba(100,140,200,0.9)',  arrow: true,  dash: true  },
  'オマージュ': { color: 'rgba(200,169,110,0.35)',  activeColor: 'rgba(200,169,110,0.9)',  arrow: true,  dash: false },
  '引用・参照': { color: 'rgba(232,125,200,0.35)',  activeColor: 'rgba(232,125,200,0.9)',  arrow: true,  dash: false },
};