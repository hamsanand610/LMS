/**
 * Resolves the colour scheme before first paint: a stored explicit choice wins, otherwise the
 * system preference. The result is stamped on <html data-theme> so both the token injection and
 * Tailwind's `dark:` variant key off one attribute. Changes to the system preference are followed
 * while no explicit choice is stored.
 */
export function ThemeScript() {
  const code = `(function(){try{var d=document.documentElement;var m=localStorage.getItem('lms.theme');var mq=window.matchMedia('(prefers-color-scheme: dark)');function apply(){var s=localStorage.getItem('lms.theme');d.setAttribute('data-theme',(s==='light'||s==='dark')?s:(mq.matches?'dark':'light'));}apply();mq.addEventListener('change',apply);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
