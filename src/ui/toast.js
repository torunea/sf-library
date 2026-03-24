// ═══════════════════════════════════════
//  ui/toast.js — トースト通知
// ═══════════════════════════════════════

let _timer = null;

export function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  if (_timer) clearTimeout(_timer);

  const el = document.createElement('div');
  el.className = `toast${type ? ' ' + type : ''}`;
  el.textContent = message;
  document.body.appendChild(el);

  _timer = setTimeout(() => el.remove(), 2500);
}