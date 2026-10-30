fetch('/api/health').then(response => response.json()).then(health => {
  const status = document.querySelector('#extension-status');
  if (status) status.textContent = health.extensionConfigured ? 'Backend Extension credentials configured. Install and activate through Twitch to authenticate.' : 'Twitch Extension ID / shared secret not configured yet.';
  const sandbox = document.querySelector('#sandbox-status');
  if (sandbox) sandbox.textContent = health.sandboxEnabled ? 'Local simulator enabled in this process.' : 'Run npm run sandbox → http://127.0.0.1:3010/sandbox';
  const grid = document.querySelector('#sandbox-grid');
  if (grid) {
    document.querySelector('#sandbox-unavailable').hidden = health.sandboxEnabled;
    grid.hidden = !health.sandboxEnabled;
    if (health.sandboxEnabled) for (const frame of grid.querySelectorAll('iframe')) frame.src = `/extension/index.html?simulator=${encodeURIComponent(frame.dataset.persona)}`;
  }
}).catch(() => {
  for (const element of document.querySelectorAll('.launch-status')) element.textContent = 'Backend unavailable. Check the server terminal.';
  const warning = document.querySelector('#sandbox-unavailable'); if (warning) warning.hidden = false;
});
