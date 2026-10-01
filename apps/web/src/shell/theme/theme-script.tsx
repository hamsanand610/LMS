/**
 * Resolves the colour scheme and the sidebar state before first paint, so neither flashes.
 *
 * Theme: a stored explicit choice wins, otherwise the system preference, stamped on
 * <html data-theme> so both the token injection and Tailwind's `dark:` variant key off one
 * attribute. Changes to the system preference are followed while no explicit choice is stored.
 *
 * Sidebar: `data-nav="collapsed"` when the person collapsed it last time (plan §15.2: "state
 * remembered per user (local storage)"); the layout reads the attribute, so the first frame
 * already has the right width.
 */
export function ThemeScript() {
  const code = `(function(){try{var d=document.documentElement;var mq=window.matchMedia('(prefers-color-scheme: dark)');function apply(){var s=localStorage.getItem('lms.theme');d.setAttribute('data-theme',(s==='light'||s==='dark')?s:(mq.matches?'dark':'light'));}apply();mq.addEventListener('change',apply);if(localStorage.getItem('lms.nav')==='collapsed'){d.setAttribute('data-nav','collapsed');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
