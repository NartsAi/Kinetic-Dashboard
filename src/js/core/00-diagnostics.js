// Error details are kept in memory only. Nothing is automatically uploaded.
window.KINETIC_DIAGNOSTICS = (() => {
  const errors = [];
  const scrub = value => String(value || '').replace(/([?&](?:token|access_token|refresh_token|auth|key)=)[^&\s)]+/gi, '$1[redacted]');
  const api = { errors, connection: '', render, record, open };
  function render() {
    const status = document.getElementById('st'); if (!status || !errors.length) return;
    document.documentElement.classList.remove('boot');
    status.classList.add('bad'); status.textContent = 'JS ERROR: ' + errors[errors.length - 1].message;
    status.title = 'Tap for full error details'; status.setAttribute('role', 'button'); status.setAttribute('aria-label', 'View JavaScript error details'); status.tabIndex = 0; status.style.cursor = 'pointer';
    status.onclick = open;
    status.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
  }
  function record(message, source, line, column, error) {
    let file = ''; try { file = source ? new URL(source, location.href).pathname : ''; } catch (_) {}
    errors.push({ time: new Date().toISOString(), message: scrub(message).slice(0, 1500), file, line: line || 0, column: column || 0, stack: scrub(error && error.stack).slice(0, 6000) });
    if (errors.length > 5) errors.shift(); render();
  }
  function open() {
    const prior = document.getElementById('kinetic-error-dialog'); if (prior) prior.remove();
    const dialog = document.createElement('dialog'); dialog.id = 'kinetic-error-dialog';
    dialog.style.cssText = 'margin:auto;padding:24px;max-width:680px;width:calc(100% - 24px);max-height:90dvh;overflow:auto;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:var(--ink)';
    const heading = document.createElement('h2'); heading.textContent = 'Dashboard error details'; heading.id = 'kinetic-error-title'; dialog.setAttribute('aria-labelledby', heading.id);
    const note = document.createElement('p'); note.textContent = 'Copy these details when reporting the error. This records the error; it does not fix its cause.'; note.style.margin = '12px 0';
    const text = document.createElement('textarea'); text.readOnly = true; text.setAttribute('aria-label', 'Error report'); text.style.cssText = 'width:100%;min-height:220px;max-height:50dvh;padding:12px;background:rgba(128,128,128,.12);color:inherit;border:1px solid var(--line);font:13px/1.5 monospace';
    text.value = 'Kinetic ' + (window.DASH_VER || 'unknown') + '\nPage: ' + location.hash + '\nViewport: ' + innerWidth + 'x' + innerHeight + '\nConnection: ' + (api.connection || 'unknown') + '\n\n' + errors.map(e => e.time + '\n' + e.message + '\n' + e.file + ':' + e.line + ':' + e.column + '\n' + e.stack).join('\n\n');
    const copy = document.createElement('button'); copy.textContent = 'Copy error details'; copy.style.cssText = 'padding:12px;margin:14px 10px 0 0;cursor:pointer'; copy.onclick = async () => {
      try { await navigator.clipboard.writeText(text.value); copy.textContent = 'Copied'; } catch (_) { text.focus(); text.select(); copy.textContent = 'Select text to copy'; }
    };
    const close = document.createElement('button'); close.textContent = 'Close'; close.style.cssText = 'padding:12px;cursor:pointer'; close.onclick = () => dialog.remove();
    dialog.append(heading, note, text, copy, close); document.body.append(dialog); dialog.showModal();
  }
  addEventListener('unhandledrejection', event => { const error = event.reason; record('Unhandled promise: ' + (error && error.message || error), '', 0, 0, error); });
  return api;
})();
