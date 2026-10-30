const $ = id => document.getElementById(id);
const sides = ['a', 'b'];
const colours = { a: '#ff826e', b: '#bda4ff' };
const overlay = $('overlay'), overlaySide = location.pathname.split('/').pop();
let state, receivedAt = 0, demoTimer, demoStep = 0;
const positions = { a: { x: 480, y: 270 }, b: { x: 480, y: 270 } }, keys = new Set();

async function post(path, body) {
  const response = await fetch(`/api/dodge/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2500) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.reason || 'Action failed');
  return result;
}
function notice(message) { if ($('notice')) $('notice').textContent = message; }
function receive(next) { state = next; receivedAt = performance.now(); if (!overlay) renderControls(); }
async function poll() {
  try {
    const response = await fetch('/api/dodge/state', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Connection failed');
    receive(await response.json()); if ($('connection')) $('connection').textContent = 'LOCAL CONNECTION OK';
  } catch { if ($('connection')) $('connection').textContent = 'DISCONNECTED · MATCH VIEW STALE'; }
  setTimeout(poll, 100);
}
function renderControls() {
  const seconds = Math.ceil(state.remainingMs / 1000);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('phase').textContent = state.phase.toUpperCase();
  $('duration').disabled = state.phase !== 'lobby';
  $('source').textContent = state.inputSource === 'twitch' ? 'TWITCH INPUT' : 'SYNTHETIC REHEARSAL';
  $('count-source').textContent = `${state.pressure.source.toUpperCase()} COUNTS`;
  $('twitch-status').textContent = [state.twitch.message, ...Object.entries(state.support).map(([side, status]) => `${side === 'a' ? 'Coral' : 'Violet'} support: ${status.message}`)].join(' ');
  for (const side of sides) {
    $(`health-${side}`).textContent = `${state.health[side]} / ${state.config.health} HP`;
    $(`tracking-${side}`).textContent = state.tracking[side] ? '● MARKER TRACKING' : '○ MARKER OFFLINE';
  }
  if (state.reason) notice(state.reason);
  if (state.result) notice(state.result.winner === 'tie' ? 'Round complete · draw' : `Round complete · ${state.result.winner === 'a' ? 'Coral' : 'Violet'} wins`);
  const totals = state.pressure.current, sum = totals.a + totals.b;
  const bars = $('pressure').children;
  bars[0].style.width = `${sum ? totals.a / sum * 100 : 50}%`; bars[1].style.width = `${sum ? totals.b / sum * 100 : 50}%`;
  const denominator = state.pressure.denominator;
  $('pressure-detail').textContent = !state.pressure.enabled ? 'Admission suspended · waiting for fresh live viewer counts on both sides.' :
    `${state.pressure.barrage ? `${state.pressure.barrage === 'a' ? 'CORAL' : 'VIOLET'} BARRAGE · ` : ''}A ${totals.a.toFixed(3)} / B ${totals.b.toFixed(3)} units per viewer · denominators ${Math.round(denominator.a)} / ${Math.round(denominator.b)} · ${(state.pressure.windowRemainingMs / 1000).toFixed(1)}s in bucket`;
  $('switch-status').textContent = state.switchOpen ? 'DEFECTION OPEN · switch once; cooldown stays, future messages attack your former side.' : 'Defection opens around halftime. One switch per viewer.';
  document.querySelectorAll('[data-action]').forEach(button => {
    button.disabled = ({ start: state.phase !== 'lobby', pause: state.phase !== 'running', resume: state.phase !== 'paused', reset: false })[button.dataset.action];
  });
  $('switch').disabled = !state.switchOpen || state.inputSource === 'twitch';
  for (const form of [$('audience-form'), $('attack-form')]) for (const item of form.elements) item.disabled = state.inputSource === 'twitch';
  $('demo').disabled = state.inputSource === 'twitch' || state.phase !== 'running';
}
function drawArena(canvas, side) {
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 960, 540);
  if (!state) return;
  const stale = performance.now() - receivedAt > 1000;
  if (!overlay) {
    ctx.strokeStyle = '#262c39'; ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke(); }
    for (let y = 0; y <= 540; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
    ctx.fillStyle = '#717a91'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.fillText('960 × 540 · EQUAL PLAY AREA', 24, 30);
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
    const message = stale ? 'CONNECTION LOST' : state.phase === 'paused' ? 'PAUSED · RECOVER MARKERS' : state.phase === 'finished' ? `ROUND OVER · ${state.result.winner === 'tie' ? 'DRAW' : state.result.winner.toUpperCase() + ' WINS'}` : 'READY YOUR MARKER';
    ctx.fillStyle = '#101116cc'; ctx.fillRect(210, 233, 540, 74); ctx.fillStyle = '#f3f0fa'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText(message, 480, 278);
  }
}
function animate() {
  if (overlay) drawArena(overlay, overlaySide);
  else for (const side of sides) drawArena($(`arena-${side}`), side);
  requestAnimationFrame(animate);
}
if (!overlay) {
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
