import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';

export async function initTheme(): Promise<void> {
  const { theme } = await getStorage(['theme']);
  if (theme === 'dark') {
    document.body.classList.add('dark');
    dom.themeToggle.textContent = '☀️';
  }

  dom.themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    void setStorage({ theme: isDark ? 'dark' : 'light' });
    dom.themeToggle.textContent = isDark ? '☀️' : '🌙';
  });
}
