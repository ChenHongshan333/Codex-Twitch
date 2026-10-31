const $ = id => document.getElementById(id);
const sides = ['a', 'b'];
const colours = { a: '#ff826e', b: '#bda4ff' };
const overlay = $('overlay'), overlaySide = location.pathname.split('/').pop();
let state, receivedAt = 0, demoTimer, demoStep = 0, connected = false, starting = false, feedCursor = '';
const positions = { a: { x: 480, y: 270 }, b: { x: 480, y: 270 } }, keys = new Set();

async function post(path, body) {
  const response = await fetch(`/api/dodge/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2500) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.reason || 'Action failed');
  return result;
}
function notice(message) { if ($('notice') && $('notice').textContent !== message) $('notice').textContent = message; }
function receive(next) { state = next; connected = true; receivedAt = performance.now(); if (!overlay) renderControls(); }
async function poll() {
  try {
    const response = await fetch('/api/dodge/state', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Connection failed');
    receive(await response.json()); if ($('connection')) $('connection').textContent = 'LOCAL CONNECTION OK';
  } catch { connected = false; if ($('connection')) $('connection').textContent = 'Disconnected · view is stale'; if (!overlay && state) renderControls(); }
  setTimeout(poll, 100);
}
function renderControls() {
  const seconds = Math.ceil((state.phase === 'lobby' ? Number($('duration').value) * 1000 : state.remainingMs) / 1000);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('phase').textContent = state.phase.toUpperCase();
  $('round-caption').textContent = state.result ? 'Round complete' : state.switchOpen ? 'Defection is open' : state.phase === 'paused' ? 'Waiting to resume' : state.phase === 'running' ? 'Dodge incoming messages' : 'Make your next move';
  const synthetic = state.inputSource === 'synthetic';
  $('rehearsal-intro').hidden = !synthetic || state.phase !== 'lobby';
  $('quick-start').disabled = !connected || starting;
  $('simulator-controls').hidden = !synthetic;
  $('test-label').hidden = !synthetic;
  $('live-chat-help').hidden = synthetic;
  $('activity-title').textContent = synthetic ? 'Rehearsal chat' : 'Twitch activity';
  $('duration').disabled = state.phase !== 'lobby';
  $('source').textContent = synthetic ? 'LOCAL REHEARSAL' : 'TWITCH INPUT';
  $('count-source').textContent = `${state.pressure.source.toUpperCase()} COUNTS`;
  $('twitch-status').textContent = [state.twitch.message, ...Object.entries(state.support).map(([side, status]) => `${side === 'a' ? 'Coral' : 'Violet'} support: ${status.message}`)].join(' ');
  for (const side of sides) {
    $(`health-${side}`).textContent = `${state.health[side]} / ${state.config.health} HP`;
    $(`tracking-${side}`).textContent = state.tracking[side] ? '● MARKER TRACKING' : '○ MARKER OFFLINE';
    const pips = $(`health-pips-${side}`);
    if (pips.dataset.health !== String(state.health[side])) {
      pips.replaceChildren(...Array.from({ length: state.config.health }, (_, index) => { const pip = document.createElement('i'); if (index < state.health[side]) pip.className = 'filled'; return pip; }));
      pips.dataset.health = String(state.health[side]);
    }
  }
  if (state.reason) notice(state.reason);
  if (state.result) notice(state.result.winner === 'tie' ? 'Round complete · draw' : `Round complete · ${state.result.winner === 'a' ? 'Coral' : 'Violet'} wins`);
  const totals = state.pressure.current, sum = totals.a + totals.b;
  const bars = $('pressure').children;
  bars[0].style.width = `${sum ? totals.a / sum * 100 : 50}%`; bars[1].style.width = `${sum ? totals.b / sum * 100 : 50}%`;
  $('barrage-label').textContent = !state.pressure.enabled ? 'Counts unavailable' : state.pressure.barrage ? `${state.pressure.barrage === 'a' ? 'Coral' : 'Violet'} barrage` : !sum || totals.a === totals.b ? 'Even ground' : `${totals.a > totals.b ? 'Coral' : 'Violet'} leads`;
  const denominator = state.pressure.denominator;
  $('pressure-detail').textContent = !state.pressure.enabled ? 'Admission suspended · waiting for fresh live viewer counts on both sides.' :
    `${state.pressure.barrage ? `${state.pressure.barrage === 'a' ? 'CORAL' : 'VIOLET'} BARRAGE · ` : ''}A ${totals.a.toFixed(3)} / B ${totals.b.toFixed(3)} units per viewer · denominators ${Math.round(denominator.a)} / ${Math.round(denominator.b)} · ${(state.pressure.windowRemainingMs / 1000).toFixed(1)}s in bucket`;
  $('switch-status').textContent = state.switchOpen ? 'DEFECTION OPEN · switch once; cooldown stays, future messages attack your former side.' : 'Defection opens around halftime. One switch per viewer.';
  document.querySelectorAll('[data-action]').forEach(button => {
    button.disabled = !connected || ({ start: state.phase !== 'lobby' || !state.tracking.a || !state.tracking.b, pause: state.phase !== 'running', resume: state.phase !== 'paused' || !state.tracking.a || !state.tracking.b, reset: false })[button.dataset.action];
  });
  for (const form of [$('audience-form'), $('attack-form')]) for (const item of form.elements) item.disabled = !connected || !synthetic;
  $('switch').disabled = !connected || !state.switchOpen || !synthetic;
  $('attack-form').querySelector('button[type="submit"]').disabled = !connected || !synthetic || state.phase !== 'running';
  $('demo').disabled = !connected || !synthetic || state.phase !== 'running';
  $('stop-demo').disabled = !demoTimer;
  renderFeed();
}
function renderFeed() {
  const cursor = `${state.id}:${state.events.at(-1)?.id ?? 0}`;
  if (cursor === feedCursor) return;
  feedCursor = cursor;
  const feed = $('activity-feed'), wasAtBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 20;
  const teamName = side => side === 'a' ? 'Coral' : 'Violet';
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
function drawArena(canvas, side) {
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 960, 540);
  if (!state) return;
  const stale = performance.now() - receivedAt > 1000;
  if (!overlay) {
    ctx.fillStyle = '#141820'; ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = '#303440'; ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, 900, 480);
    ctx.beginPath(); ctx.moveTo(30, 450); ctx.lineTo(930, 450); ctx.stroke();
    const p = state.markers[side] ?? { x: 480, y: 270 };
    if ($(`input-${side}`).value !== 'camera') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = state.tracking[side] ? 1 : .45;
      ctx.fillStyle = '#2b303d'; ctx.strokeStyle = '#6a7084'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -79, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -42); ctx.quadraticCurveTo(-58, -35, -61, 24); ctx.lineTo(-45, 78); ctx.lineTo(-25, 75); ctx.lineTo(-20, 112); ctx.lineTo(20, 112); ctx.lineTo(25, 75); ctx.lineTo(45, 78); ctx.lineTo(61, 24); ctx.quadraticCurveTo(58, -35, 22, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 112); ctx.lineTo(-24, 174); ctx.moveTo(14, 112); ctx.lineTo(24, 174); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#a5a8b7'; ctx.font = '13px system-ui'; ctx.textAlign = 'left'; ctx.fillText('960 × 540 · REHEARSAL TARGET', 47, 58);
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
    ctx.fillStyle = '#101116cc'; ctx.fillRect(16, 16, 250, 48);
    ctx.fillStyle = colours[side]; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`${side === 'a' ? 'CORAL' : 'VIOLET'}  ${state.health[side]}/${state.config.health} HP  ·  ${Math.ceil(state.remainingMs / 1000)}s`, 28, 46);
  }
  if (state.phase !== 'running' || stale || !state.tracking[side]) {
    const message = stale ? 'CONNECTION LOST' : state.phase === 'paused' ? (state.tracking.a && state.tracking.b ? 'PAUSED · RESUME WHEN READY' : 'PAUSED · RECOVER MARKERS') : state.phase === 'finished' ? `ROUND OVER · ${state.result.winner === 'tie' ? 'DRAW' : state.result.winner.toUpperCase() + ' WINS'}` : 'READY YOUR MARKER';
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
    const drag = event => { if ($(`input-${side}`).value !== 'keyboard') return; const rect = canvas.getBoundingClientRect(); positions[side] = { x: Math.max(14, Math.min(946, (event.clientX - rect.left) / rect.width * 960)), y: Math.max(14, Math.min(526, (event.clientY - rect.top) / rect.height * 540)) }; };
    canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); canvas.focus(); drag(event); });
    canvas.addEventListener('pointermove', event => { if (event.buttons) drag(event); });
  }
  let markersSending = false;
  setInterval(async () => {
    if (document.hidden || markersSending) return; markersSending = true;
    try { await Promise.all(sides.map(async side => {
      if ($(`input-${side}`).value !== 'keyboard') return;
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
