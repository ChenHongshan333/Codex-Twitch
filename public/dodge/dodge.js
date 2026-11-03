const $ = id => document.getElementById(id);
const sides = ['a', 'b'];
const colours = { a: '#ff826e', b: '#bda4ff' };
const overlay = $('overlay'), overlaySide = location.pathname.split('/').pop();
let state, receivedAt = 0, demoTimer, demoStep = 0, connected = false, starting = false, feedCursor = '', configuredInput;
const positions = { a: { x: 480, y: 270 }, b: { x: 480, y: 270 } }, keys = new Set();
const isAiDemo = () => state?.mode === 'ai-demo';
const teamName = side => isAiDemo() ? side === 'a' ? 'You' : 'Local AI' : side === 'a' ? 'Coral' : 'Violet';
function resultText() { return state.result.winner === 'tie' ? 'Round complete · draw' : `Round complete · ${teamName(state.result.winner)} wins`; }

async function post(path, body) {
  const response = await fetch(`/api/dodge/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2500) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.reason || 'Action failed');
  return result;
}
function notice(message) { if ($('notice') && $('notice').textContent !== message) $('notice').textContent = message; }
function receive(next) {
  state = next; connected = true; receivedAt = performance.now();
  if (!overlay) {
    if (configuredInput !== state.inputSource) {
      configuredInput = state.inputSource;
      for (const side of sides) {
        const keyboard = $(`input-${side}`).querySelector('option[value="keyboard"]');
        keyboard.disabled = state.inputSource !== 'synthetic';
        if (state.inputSource !== 'synthetic') $(`input-${side}`).value = 'camera';
      }
    }
    renderControls();
  }
}
async function poll() {
  try {
    const response = await fetch('/api/dodge/state', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Connection failed');
    receive(await response.json()); if ($('connection')) $('connection').textContent = 'LOCAL CONNECTION OK';
  } catch { connected = false; if ($('connection')) $('connection').textContent = 'Disconnected · view is stale'; if (!overlay && state) renderControls(); }
  setTimeout(poll, 100);
}
function renderControls() {
  const aiDemo = isAiDemo();
  document.body.dataset.mode = aiDemo ? 'ai-demo' : 'duel';
  $('ai-demo-note').hidden = !aiDemo; $('ai-camera').hidden = !aiDemo;
  if (aiDemo && !$('camera-frame').firstChild) {
    const frame = document.createElement('iframe'); frame.src = '/track/a?embedded=1'; frame.title = 'Your local camera and marker calibration'; frame.allow = 'camera'; $('camera-frame').append(frame);
  } else if (!aiDemo && $('camera-frame').firstChild) $('camera-frame').replaceChildren();
  document.querySelector('.room-heading .eyebrow').textContent = aiDemo ? 'ONE REAL TWITCH CHANNEL · LOCAL AI OPPONENT' : 'COMMUNITY VS COMMUNITY';
  document.querySelector('.room-heading h1').textContent = aiDemo ? 'Your chat versus local AI' : 'Crossfire stream setup';
  document.querySelector('.match-team.a strong').textContent = aiDemo ? 'You + Twitch chat' : 'Coral Crew';
  document.querySelector('.match-team.b strong').textContent = aiDemo ? 'Local AI opponent' : 'Violet Crew';
  document.querySelector('.match-team.b .team-avatar').textContent = aiDemo ? 'AI' : 'V';
  document.querySelector('.team.a h2').lastChild.textContent = aiDemo ? 'Your camera arena' : 'Coral Crew';
  document.querySelector('.team.b h2').lastChild.textContent = aiDemo ? 'Local AI · simulated opponent' : 'Violet Crew';
  document.querySelector('.team.b .tools').hidden = aiDemo;
  document.querySelector('.pressure-strip').hidden = aiDemo;
  document.querySelector('.setup-grid section:last-child ol').hidden = aiDemo;
  document.querySelector('.fair-play').textContent = aiDemo ? 'Human camera · local game AI' : 'Equal arenas · equal hitboxes';
  const seconds = Math.ceil((state.phase === 'lobby' ? Number($('duration').value) * 1000 : state.remainingMs) / 1000);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('phase').textContent = state.phase.toUpperCase();
  $('round-caption').textContent = state.result ? 'Round complete' : state.switchOpen ? 'Defection is open' : state.phase === 'paused' ? 'Waiting to resume' : state.phase === 'running' ? 'Dodge incoming messages' : 'Make your next move';
  const synthetic = state.inputSource === 'synthetic';
  $('live-setup').hidden = synthetic;
  $('audience-form').hidden = !synthetic;
  document.querySelector('.preview-label').textContent = synthetic ? 'LOCAL PREVIEW · NO STREAM VIDEO' : aiDemo ? 'HUMAN MARKER × LOCAL AI · CAMERA AT RIGHT' : 'MARKER PREVIEW · CAMERA VIDEO IS IN OBS';
  for (const side of sides) if (!synthetic) $(`movement-${side}`).textContent = aiDemo && side === 'b' ? 'Local game AI · automatic movement' : 'Move your body · camera tracking';
  if (!synthetic) renderReadiness();
  $('rehearsal-intro').hidden = !synthetic || state.phase !== 'lobby';
  $('quick-start').disabled = !connected || starting;
  $('simulator-controls').hidden = !synthetic;
  $('test-label').hidden = !synthetic;
  $('live-chat-help').hidden = synthetic || aiDemo;
  $('ai-chat-help').hidden = !aiDemo;
  $('activity-title').textContent = synthetic ? 'Rehearsal chat' : aiDemo ? 'Live chat + local AI' : 'Twitch activity';
  $('duration').disabled = state.phase !== 'lobby';
  $('source').textContent = synthetic ? 'LOCAL REHEARSAL' : aiDemo ? 'TWITCH × LOCAL AI DEMO' : 'TWITCH INPUT';
  $('count-source').textContent = `${state.pressure.source.toUpperCase()} COUNTS`;
  $('twitch-status').textContent = [state.twitch.message, ...Object.entries(state.support).map(([side, status]) => `${side === 'a' ? 'Coral' : 'Violet'} support: ${status.message}`)].join(' ');
  for (const side of sides) {
    $(`health-${side}`).textContent = `${state.health[side]} / ${state.config.health} HP`;
    $(`tracking-${side}`).textContent = aiDemo && side === 'b' ? '◆ LOCAL AI · SERVER CONTROLLED' : state.tracking[side] ? '● MARKER TRACKING' : '○ MARKER OFFLINE';
    const pips = $(`health-pips-${side}`);
    if (pips.dataset.health !== String(state.health[side])) {
      pips.replaceChildren(...Array.from({ length: state.config.health }, (_, index) => { const pip = document.createElement('i'); if (index < state.health[side]) pip.className = 'filled'; return pip; }));
      pips.dataset.health = String(state.health[side]);
    }
  }
  if (state.reason) notice(state.reason);
  if (state.result) notice(resultText());
  const totals = state.pressure.current, sum = totals.a + totals.b;
  const bars = $('pressure').children;
  bars[0].style.width = `${sum ? totals.a / sum * 100 : 50}%`; bars[1].style.width = `${sum ? totals.b / sum * 100 : 50}%`;
  $('barrage-label').textContent = !state.pressure.enabled ? 'Counts unavailable' : state.pressure.barrage ? `${state.pressure.barrage === 'a' ? 'Coral' : 'Violet'} barrage` : !sum || totals.a === totals.b ? 'Even ground' : `${totals.a > totals.b ? 'Coral' : 'Violet'} leads`;
  const denominator = state.pressure.denominator;
  $('pressure-detail').textContent = !state.pressure.enabled ? 'Admission suspended · waiting for fresh live viewer counts on both sides.' :
    `${state.pressure.barrage ? `${state.pressure.barrage === 'a' ? 'CORAL' : 'VIOLET'} BARRAGE · ` : ''}A ${totals.a.toFixed(3)} / B ${totals.b.toFixed(3)} units per viewer · denominators ${Math.round(denominator.a)} / ${Math.round(denominator.b)} · ${(state.pressure.windowRemainingMs / 1000).toFixed(1)}s in bucket`;
  if (aiDemo) $('pressure-detail').textContent = state.pressure.enabled ? `Normalization denominator (minimum 20): ${Math.round(denominator.a)}. Actual viewer counts are shown above, including zero. Local AI has no viewer count; it adds a labelled test attack every 2.5 seconds. Comparative barrages are disabled.` : 'Waiting for Twitch to confirm your channel is live with a fresh viewer sample.';
  $('switch-status').textContent = state.switchOpen ? 'DEFECTION OPEN · switch once; cooldown stays, future messages attack your former side.' : 'Defection opens around halftime. One switch per viewer.';
  document.querySelectorAll('[data-action]').forEach(button => {
    const ready = synthetic ? state.tracking.a && state.tracking.b : state.setup.ready;
    button.disabled = !connected || ({ start: state.phase !== 'lobby' || !ready, pause: state.phase !== 'running', resume: state.phase !== 'paused' || !ready, reset: false })[button.dataset.action];
  });
  for (const form of [$('audience-form'), $('attack-form')]) for (const item of form.elements) item.disabled = !connected || !synthetic;
  $('switch').disabled = !connected || !state.switchOpen || !synthetic;
  $('attack-form').querySelector('button[type="submit"]').disabled = !connected || !synthetic || state.phase !== 'running';
  $('demo').disabled = !connected || !synthetic || state.phase !== 'running';
  $('stop-demo').disabled = !demoTimer;
  renderFeed();
}
function renderReadiness() {
  const checks = [{ ready: connected && state.setup.chats, text: `Twitch chats: ${state.twitch.message || state.twitch.state}` }];
  for (const side of sides) {
    if (isAiDemo() && side === 'b') {
      checks.push({ ready: true, text: 'Local AI opponent: automatic marker and labelled AI attacks; no second Twitch channel or viewer count.' });
      $('chat-link-b').hidden = true;
      continue;
    }
    const name = isAiDemo() ? 'Your Twitch channel' : side === 'a' ? 'Coral' : 'Violet', count = state.pressure.audience[side];
    const viewerValue = count?.raw ?? count?.value;
    const fresh = count && state.serverTime - count.at < state.config.freshnessMs;
    const activity = state.inputActivity[side];
    checks.push({ ready: Boolean(fresh && (isAiDemo() ? viewerValue >= 0 : viewerValue > 0)), text: `${name} viewers: ${count ? Math.round(viewerValue) : 'offline / unavailable'}${count && !fresh ? ' (stale)' : ''}. Chat received ${activity.received}, accepted ${activity.accepted}, rejected ${activity.rejected}.${activity.lastReason ? ` Last reason: ${activity.lastReason}` : ''}` });
    checks.push({ ready: state.tracking[side], text: `${name} camera marker: ${state.tracking[side] ? 'tracking' : 'open Camera setup and calibrate'}.` });
    const link = $(`chat-link-${side}`), channel = state.twitch.channels?.find(item => item.team === side);
    link.hidden = !channel || !/^[a-zA-Z0-9_]{1,25}$/.test(channel.login);
    if (!link.hidden) link.href = `https://www.twitch.tv/${channel.login}/chat`;
    if (isAiDemo() && !link.hidden) link.textContent = `Open @${channel.login} Twitch chat ↗`;
  }
  $('readiness-checks').replaceChildren(...checks.map(check => { const row = document.createElement('li'); row.dataset.ready = String(check.ready); row.textContent = `${check.ready ? '✓' : '○'} ${check.text}`; return row; }));
  $('start-requirements').textContent = !connected ? 'Local server disconnected. Reconnect before starting.' : state.setup.ready ? 'Ready. Start round once; hits, health and the final result are automatic.' : state.setup.blockers.join(' ');
}
function renderFeed() {
  const cursor = `${state.id}:${state.events.at(-1)?.id ?? 0}`;
  if (cursor === feedCursor) return;
  feedCursor = cursor;
  const feed = $('activity-feed'), wasAtBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 20;
  const rows = [];
  for (const event of state.events.slice(-12)) {
    let team = event.from ?? event.target, text;
    if (event.type === 'shot') text = `sent a message attack to ${teamName(event.target)}.`;
    else if (event.type === 'hit') text = `was hit. ${event.health} health remaining.`;
    else if (event.type === 'defected') text = `lost a viewer to ${teamName(event.to)}. Future attacks change sides.`;
    else if (event.type === 'barrage') text = 'triggered a barrage!';
    else { team = null; text = ({ started: 'Round started. Move your marker to dodge.', paused: 'Round paused.', resumed: 'Round resumed.', finished: 'Round complete.', moderated: 'Moderator removed queued and visible messages.' })[event.type]; }
    if (!text) continue;
    const row = document.createElement('div'); row.className = `feed-row${team ? ` ${team}` : ''}`;
    const time = document.createElement('time'); time.textContent = `${Math.floor(event.at / 60000)}:${String(Math.floor(event.at / 1000) % 60).padStart(2, '0')}`; row.append(time);
    if (team) { const name = document.createElement('strong'); name.textContent = teamName(team); row.append(name, document.createTextNode(' ')); }
    row.append(document.createTextNode(text)); rows.push(row);
  }
  if (rows.length) feed.replaceChildren(...rows);
  else { const empty = document.createElement('div'); empty.className = 'feed-empty'; const title = document.createElement('strong'); title.textContent = 'The next move starts in chat.'; const copy = document.createElement('p'); copy.textContent = 'Accepted attacks, hits and defections appear here when a round begins.'; empty.append(title, copy); feed.replaceChildren(empty); }
  if (wasAtBottom) feed.scrollTop = feed.scrollHeight;
}
function drawCamera(ctx) {
  const cameraDocument = $('camera-frame')?.firstElementChild?.contentDocument;
  const video = cameraDocument?.getElementById('video');
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
  const vw = video.videoWidth, vh = video.videoHeight;
  const cropW = Math.min(vw, vh * 16 / 9), cropH = Math.min(vh, vw * 9 / 16);
  ctx.save();
  if (cameraDocument.getElementById('mirror')?.checked) { ctx.translate(960, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, (vw - cropW) / 2, (vh - cropH) / 2, cropW, cropH, 0, 0, 960, 540);
  ctx.restore(); return true;
}
function drawArena(canvas, side) {
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 960, 540);
  if (!state) return;
  const stale = performance.now() - receivedAt > 1000;
  if (!overlay) {
    ctx.fillStyle = '#141820'; ctx.fillRect(0, 0, 960, 540);
    const cameraVisible = isAiDemo() && side === 'a' && drawCamera(ctx);
    ctx.strokeStyle = '#303440'; ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, 900, 480);
    ctx.beginPath(); ctx.moveTo(30, 450); ctx.lineTo(930, 450); ctx.stroke();
    const p = state.markers[side] ?? { x: 480, y: 270 };
    if (state.inputSource === 'synthetic' && $(`input-${side}`).value === 'keyboard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = state.tracking[side] ? 1 : .45;
      ctx.fillStyle = '#2b303d'; ctx.strokeStyle = '#6a7084'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -79, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -42); ctx.quadraticCurveTo(-58, -35, -61, 24); ctx.lineTo(-45, 78); ctx.lineTo(-25, 75); ctx.lineTo(-20, 112); ctx.lineTo(20, 112); ctx.lineTo(25, 75); ctx.lineTo(45, 78); ctx.lineTo(61, 24); ctx.quadraticCurveTo(58, -35, 22, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 112); ctx.lineTo(-24, 174); ctx.moveTo(14, 112); ctx.lineTo(24, 174); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#101116aa'; ctx.fillRect(38, 37, 400, 31);
    ctx.fillStyle = '#e0dfeb'; ctx.font = '13px system-ui'; ctx.textAlign = 'left'; ctx.fillText(isAiDemo() ? side === 'b' ? '960 × 540 · LOCAL GAME AI' : cameraVisible ? 'LIVE CAMERA · TRACKED PHYSICAL MARKER' : 'ENABLE CAMERA IN THE RIGHT-HAND PANEL' : state.inputSource === 'synthetic' ? '960 × 540 · REHEARSAL TARGET' : '960 × 540 · CAMERA MARKER PREVIEW', 47, 58);
  }
  if (isAiDemo() && side === 'b') {
    if (overlay) { ctx.fillStyle = '#141820'; ctx.fillRect(0, 0, 960, 540); }
    const p = state.markers.b;
    ctx.fillStyle = '#55446c'; ctx.fillRect(p.x - 32, p.y - 60, 64, 50);
    ctx.fillStyle = '#e2ceff'; ctx.fillRect(p.x - 17, p.y - 43, 10, 10); ctx.fillRect(p.x + 7, p.y - 43, 10, 10);
    ctx.strokeStyle = colours.b; ctx.lineWidth = 4; ctx.strokeRect(p.x - 28, p.y - 8, 56, 58);
    ctx.fillStyle = '#e2ceff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('LOCAL AI', p.x, p.y + 74);
  }
  ctx.strokeStyle = colours[side]; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 958, 538);
  for (const b of state.bullets) if (b.target === side) {
    const waiting = state.elapsedMs < b.armsAt;
    const drift = state.phase === 'running' && !stale && !waiting ? Math.min(100, performance.now() - receivedAt) / 1000 : 0;
    const x = b.x + b.vx * drift, y = b.y + b.vy * drift;
    if (waiting) {
      ctx.save(); ctx.globalAlpha = .35; ctx.setLineDash([6, 9]); ctx.strokeStyle = colours[b.from];
      ctx.beginPath(); ctx.moveTo(Math.max(0, Math.min(960, x)), y); ctx.lineTo(x + b.vx * 2, y + b.vy * 2); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = colours[b.from]; ctx.globalAlpha = waiting ? .55 : 1;
    ctx.fillRect(x - 64, y - 14, 128, 28); ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1; ctx.strokeRect(x - 64, y - 14, 128, 28);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 59, y - 13, 118, 26); ctx.clip();
    ctx.fillStyle = '#16131e'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    let text = b.text;
    while (ctx.measureText(text).width > 112 && text.length > 1) text = [...text].slice(0, -2).join('') + '…';
    ctx.fillText(text, x, y + 4); ctx.restore(); ctx.globalAlpha = 1;
  }
  const marker = state.markers[side];
  if (marker && state.tracking[side]) {
    ctx.beginPath(); ctx.arc(marker.x, marker.y, state.config.radius, 0, Math.PI * 2);
    ctx.fillStyle = state.invulnerable[side] ? '#ffeaa588' : `${colours[side]}44`; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (overlay) {
    ctx.fillStyle = '#101116cc'; ctx.fillRect(16, 16, isAiDemo() ? 440 : 250, 48);
    ctx.fillStyle = colours[side]; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`${isAiDemo() ? side === 'a' ? 'LIVE TWITCH · YOU' : 'LOCAL AI · DEMO' : side === 'a' ? 'CORAL' : 'VIOLET'}  ${state.health[side]}/${state.config.health} HP  ·  ${Math.ceil(state.remainingMs / 1000)}s`, 28, 46);
  }
  if (state.phase !== 'running' || stale || !state.tracking[side]) {
    const message = stale ? 'CONNECTION LOST' : state.phase === 'paused' ? (state.tracking.a && state.tracking.b ? 'PAUSED · RESUME WHEN READY' : 'PAUSED · RECOVER MARKERS') : state.phase === 'finished' ? `ROUND OVER · ${state.result.winner === 'tie' ? 'DRAW' : teamName(state.result.winner).toUpperCase() + ' WINS'}` : isAiDemo() && side === 'b' ? 'LOCAL AI · WAITING FOR YOU' : 'READY YOUR MARKER';
    ctx.fillStyle = '#101116cc'; ctx.fillRect(210, 233, 540, 74); ctx.fillStyle = '#f3f0fa'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText(message, 480, 278);
  }
}
function animate() {
  if (overlay) drawArena(overlay, overlaySide);
  else for (const side of sides) drawArena($(`arena-${side}`), side);
  requestAnimationFrame(animate);
}
if (!overlay) {
  $('quick-start').addEventListener('click', async () => {
    if (starting || !connected || state?.inputSource !== 'synthetic' || state.phase !== 'lobby') return;
    starting = true; $('quick-start').disabled = true;
    try {
      for (const side of sides) { positions[side] = { x: 480, y: 270 }; $(`input-${side}`).value = 'keyboard'; }
      await Promise.all(sides.map(side => post('marker', { side, ...positions[side] })));
      $('duration').value = '60'; receive(await post('action', { action: 'start', durationSeconds: 60 }));
      $('demo').click();
    } catch (error) { notice(error.message); }
    finally { starting = false; if (state) renderControls(); }
  });
  document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener('click', () => {
    $('arena-grid').dataset.view = button.dataset.view;
    document.querySelectorAll('button[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  document.querySelector('a[href="#setup"]').addEventListener('click', () => { $('setup').open = true; });
  $('duration').addEventListener('change', () => { if (state) renderControls(); });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
    try { receive(await post('action', { action: button.dataset.action, ...(button.dataset.action === 'start' ? { durationSeconds: Number($('duration').value) } : {}) })); notice(`Round ${button.dataset.action}`); if (button.dataset.action === 'reset') stopDemo(); }
    catch (error) { notice(error.message); }
  }));
  $('audience-form').addEventListener('submit', async event => {
    event.preventDefault(); try { receive(await post('audience', { a: Number($('audience-a').value), b: Number($('audience-b').value) })); notice('Synthetic audience counts applied.'); } catch (error) { notice(error.message); }
  });
  function activity(text = $('message').value) {
    return post('activity', { id: crypto.randomUUID(), userId: $('viewer').value, channelTeam: $('chat-side').value, kind: text === '!switch' ? 'chat' : $('kind').value, units: 1, text });
  }
  $('attack-form').addEventListener('submit', async event => { event.preventDefault(); try { const result = await activity(); notice(`Accepted for ${result.team === 'a' ? 'Coral' : 'Violet'} · targeting ${result.team === 'a' ? 'Violet' : 'Coral'}`); } catch (error) { notice(error.message); } });
  $('switch').addEventListener('click', async () => { try { const result = await activity('!switch'); notice(`Defected to ${result.team.toUpperCase()} · cooldown retained`); } catch (error) { notice(error.message); } });
  const movements = { a: { w: [0, -24], s: [0, 24], a: [-24, 0], d: [24, 0] }, b: { ArrowUp: [0, -24], ArrowDown: [0, 24], ArrowLeft: [-24, 0], ArrowRight: [24, 0] } };
  window.addEventListener('keydown', event => { if (!event.target.matches('input,select,textarea,button')) { keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key); if (event.key.startsWith('Arrow')) event.preventDefault(); } });
  window.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key)); window.addEventListener('blur', () => keys.clear());
  for (const side of sides) {
    const canvas = $(`arena-${side}`);
    const drag = event => { if (state?.inputSource !== 'synthetic' || $(`input-${side}`).value !== 'keyboard') return; const rect = canvas.getBoundingClientRect(); positions[side] = { x: Math.max(14, Math.min(946, (event.clientX - rect.left) / rect.width * 960)), y: Math.max(14, Math.min(526, (event.clientY - rect.top) / rect.height * 540)) }; };
    canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); canvas.focus(); drag(event); });
    canvas.addEventListener('pointermove', event => { if (event.buttons) drag(event); });
  }
  let markersSending = false;
  setInterval(async () => {
    if (document.hidden || markersSending) return; markersSending = true;
    try { await Promise.all(sides.map(async side => {
      if (state?.inputSource !== 'synthetic' || $(`input-${side}`).value !== 'keyboard') return;
      for (const key of keys) if (movements[side][key]) { positions[side].x += movements[side][key][0]; positions[side].y += movements[side][key][1]; }
      positions[side].x = Math.max(14, Math.min(946, positions[side].x)); positions[side].y = Math.max(14, Math.min(526, positions[side].y));
      await post('marker', { side, ...positions[side] });
    })); } catch (error) { notice(error.message); } finally { markersSending = false; }
  }, 100);
  function stopDemo() { clearInterval(demoTimer); demoTimer = null; }
  $('stop-demo').addEventListener('click', () => { stopDemo(); notice('Synthetic demo stopped.'); });
  $('demo').addEventListener('click', () => {
    stopDemo(); notice('Synthetic messages now arrive from both sides. Move the markers to dodge.');
    demoTimer = setInterval(async () => {
      if (state?.phase !== 'running' || document.hidden) return;
      const n = ++demoStep;
      try { await post('activity', { id: crypto.randomUUID(), userId: `demo-${n}`, channelTeam: n % 2 ? 'a' : 'b', kind: n % 7 === 0 ? 'gift' : 'chat', units: 1, text: ['Dodge this!', 'Here we go ✦', 'Nice move!', '弹幕来了', 'Gift incoming 🎁'][n % 5] }); } catch (error) { notice(error.message); }
    }, 2500);
  });
}
void poll(); requestAnimationFrame(animate);
