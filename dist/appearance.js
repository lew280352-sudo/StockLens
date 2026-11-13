// Runs before styles to apply a saved appearance without a light/dark flash.
(() => {
  const key = 'stocklens-appearance', modes = ['system', 'light', 'dark'];
  const labels = {system: 'ตามระบบ', light: 'สว่าง', dark: 'มืด'};
  const media = matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';
  try {const saved = localStorage.getItem(key);if (modes.includes(saved)) mode = saved;} catch {}
  function apply() {
    const theme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appearance = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14101d' : '#f6f5fa');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = modes[(modes.indexOf(mode) + 1) % modes.length];
      button.setAttribute('aria-label', `ธีม${labels[mode]} · เปลี่ยนเป็น${labels[next]}`);
      button.title = `ธีม${labels[mode]} · เปลี่ยนเป็น${labels[next]}`;
      const glyph = mode === 'system' ? 'monitor' : mode === 'light' ? 'sun' : 'moon';
      button.innerHTML = `${globalThis.StockLensIcons?.icon(glyph) || ''}<span>${labels[mode]}</span>`;
    });
  }
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    try {localStorage.setItem(key, mode);} catch {}
    apply();
  });
  media.addEventListener('change', () => {if (mode === 'system') apply();});
  addEventListener('storage', event => {if (event.key === key) {mode = modes.includes(event.newValue) ? event.newValue : 'system';apply();}});
})();
