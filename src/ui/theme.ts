/** Theme toggle shared with the lernspiele start page (same origin, same storage key). */
const THEME_KEY = 'lernspiele-theme';

export function initThemeToggle(): void {
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const apply = (theme: 'light' | 'dark'): void => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f8f6' : '#121212');
    button.setAttribute('aria-label', theme === 'light' ? 'Zum dunklen Design wechseln' : 'Zum hellen Design wechseln');
  };
  apply(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  button.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked: theme lasts for this visit */
    }
  });
}
