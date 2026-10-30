const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const clock = ms => { const total = Math.ceil(Math.max(0, ms) / 1000); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
const seconds = ms => `${Math.max(0, Math.ceil(ms / 1000))}s`;
const nameOf = team => state?.config[team === 'a' ? 'nameA' : 'nameB'] ?? team;
let state, admin = false, busy = false, connected = false, seenMatch, seenSequence = 0, sound = false, audio;
let announcementTimer;
const route = location.pathname.match(/^\/(overlay|cue)\/([ab])$/);
const screen = route ? { type: route[1], team: route[2] } : null;

function toast(message, type = 'info') {
  const item = document.createElement('div'); item.className = `toast ${type}`;
  item.textContent = message; $('#toasts').append(item);
  setTimeout(() => item.remove(), 4800);
}

async function api(path, input) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'The request could not be completed.');
  if (value.id) render(value);
  return value;
}

async function perform(path, input) {
  if (busy) return;
  busy = true; updateControls();
  try { return await api(path, input); }
  catch (error) { toast(error.message, 'error'); }
  finally { busy = false; updateControls(); }
}

function beep(kind) {
  if (!sound || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  oscillator.type = kind === 'defected' ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(kind === 'volley' ? 150 : kind === 'defected' ? 620 : 380, now);
  oscillator.frequency.exponentialRampToValueAtTime(kind === 'volley' ? 65 : 900, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + 0.22);
}

function animate(event) {
  if (event.type === 'attack' || event.type === 'volley') {
    const target = screen ? $('#screen-effects') : $('#effects');
    if (!target) return;
    const projectile = document.createElement('div');
    projectile.className = `projectile from-${event.team} ${event.type === 'volley' ? 'volley' : ''}`;
    projectile.style.setProperty('--shot-y', `${34 + Math.random() * 29}%`);
    projectile.textContent = event.type === 'volley' ? '⚡' : '↗';
    target.append(projectile); setTimeout(() => projectile.remove(), 1200); beep(event.type);
    if (event.type === 'volley' && !screen) {
      const card = $(`#team-${event.target}`); card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
      setTimeout(() => card.classList.remove('hit'), 900);
    }
  }
  if (event.type === 'defected') {
    const banner = $('#defection-announcement'); banner.hidden = false;
    banner.dataset.team = event.to;
    $('#defection-name').textContent = `${event.name} crossed the line.`;
    $('#defection-detail').textContent = `${nameOf(event.from)} → ${nameOf(event.to)}`;
    clearTimeout(announcementTimer); announcementTimer = setTimeout(() => { banner.hidden = true; }, 4500);
    beep('defected');
  }
  if (event.type === 'window_open') { beep('defected'); if (!screen) toast('Defection window open. Type !switch in chat.'); }
}

function render(next) {
  // An HTTP response can arrive after a newer SSE update. Do not rewind the live room.
  if (state?.id === next.id && (next.revision < state.revision || next.revision === state.revision && next.serverTime < state.serverTime)) return;
  state = next;
  const first = seenMatch !== state.id;
  if (first) {
    seenMatch = state.id; seenSequence = state.events.at(-1)?.id ?? 0;
    $('#defection-announcement').hidden = true;
  } else {
    for (const event of state.events) if (event.id > seenSequence) animate(event);
    seenSequence = state.events.at(-1)?.id ?? seenSequence;
  }
  if (screen) { renderScreen(); return; }
  const openWindow = state.defectionRemainingMs > 0;
  document.body.dataset.phase = state.phase;
  $('#match-title').textContent = state.config.title;
  $('#room-code').textContent = `ROOM / ${state.id.slice(0, 6).toUpperCase()}`;
  $('#mode-demo').classList.toggle('selected', state.mode === 'demo');
  $('#mode-live').classList.toggle('selected', state.mode === 'live');
  $('#mode-description').textContent = state.mode === 'demo' ? 'SIMULATED CHAT · NO TWITCH MESSAGES' : `${state.twitch.channels.filter(channel => channel.subscribed).length}/2 REAL TWITCH CHATS CONNECTED`;
  $('#arena-label').textContent = state.mode === 'demo' ? 'DEMO · SIMULATED VIEWERS' : 'TWITCH · REAL CHAT INPUT';
  $('#phase-tag').textContent = { lobby: 'OPEN LOBBY', running: openWindow ? 'DEFECTION OPEN' : 'ROUND LIVE', paused: 'PAUSED', finished: 'ROUND COMPLETE' }[state.phase];
  $('#phase-tag').classList.toggle('live', state.phase === 'running');
  $('#arena').classList.toggle('window-open', openWindow);
  $('#clock').textContent = clock(state.remainingMs);
  $('#phase-label').textContent = { lobby: 'READY WHEN YOU ARE', running: 'MAKE EVERY SECOND COUNT', paused: 'ALL TIMERS FROZEN', finished: 'THAT’S A WRAP' }[state.phase];
  $('#window-label').innerHTML = openWindow ? `DEFECT NOW<br><strong>${seconds(state.defectionRemainingMs)} REMAINING${state.phase === 'paused' ? ' · PAUSED' : ''}</strong>` : state.windowUsed ? 'ALLEGIANCES<br>LOCKED IN' : 'ALLEGIANCES<br>NOT YET TESTED';
  for (const team of ['a', 'b']) {
    const data = state.teams[team], channel = state.config[team === 'a' ? 'channelA' : 'channelB'];
    $(`#team-name-${team}`).textContent = nameOf(team);
    $(`#channel-${team}`).textContent = channel ? `twitch.tv/${channel}` : 'Awaiting a challenger';
    $(`#members-${team}`).textContent = data.members;
    $(`#score-${team}`).textContent = String(data.score).padStart(2, '0');
    $(`#charge-${team}`).max = state.config.attackThreshold; $(`#charge-${team}`).value = data.energy;
    $(`#charge-number-${team}`).textContent = `${data.energy} / ${state.config.attackThreshold}`;
    const cooldown = Math.max(0, data.nextVolleyAt - state.elapsedMs);
    $(`#cooldown-${team}`).textContent = state.phase === 'lobby' ? 'Waiting for the first move' : state.phase === 'finished' ? `${data.volleys} challenges sent · ${data.attacks} charges` : cooldown ? `Next attack slot in ${seconds(cooldown)}` : data.energy >= state.config.attackThreshold ? 'Charged · waiting for a challenge slot' : `${data.volleys} challenges sent · type !attack`;
    $(`#challenge-${team}`).textContent = data.activeChallenge?.text ?? 'Clear skies. For now.';
    $(`#challenge-time-${team}`).textContent = data.activeChallenge ? seconds(data.activeChallenge.endsAt - state.elapsedMs) : '';
    $(`#queued-${team}`).textContent = data.queuedChallenge ? `Up next: ${data.queuedChallenge.text}` : '';
    $(`#challenge-slot-${team}`).classList.toggle('has-challenge', Boolean(data.activeChallenge));
    $(`#loyalty-name-${team}`).textContent = nameOf(team);
    $(`#loyalty-count-${team}`).textContent = data.members;
  }
  $('#loyalty-a').style.width = `${state.participants ? state.teams.a.members / state.participants * 100 : 50}%`;
  $('#allegiance-count').textContent = `${state.participants} ${state.participants === 1 ? 'viewer has' : 'viewers have'} picked a side`;
  $('#allegiance-status').textContent = openWindow ? `⇄ Defection open · ${seconds(state.defectionRemainingMs)}` : state.windowUsed ? '◇ Allegiances locked' : state.config.autoDefection ? '⇄ Window opens at halftime' : '⇄ Host opens the window';
  $('#allegiance-status').classList.toggle('open', openWindow);
  $('#simulator-panel').hidden = state.mode !== 'demo'; $('#twitch-panel').hidden = state.mode !== 'live';
  $('#twitch-message').textContent = state.twitch.message;
  $('#twitch-channels').innerHTML = state.twitch.channels.map(channel => `<a class="twitch-channel" href="https://www.twitch.tv/${encodeURIComponent(channel.login)}/chat" target="_blank" rel="noreferrer"><i class="dot dot-${escape(channel.team)}"></i><span>${escape(channel.login)}</span><small>${channel.subscribed ? 'CONNECTED ↗' : 'WAITING'}</small></a>`).join('');
  $('#result-banner').hidden = !state.result;
  if (state.result) {
    $('#result-title').textContent = state.result.provisional ? 'Round complete. Who takes it?' : state.result.winner === 'tie' ? 'An honorable draw.' : `${nameOf(state.result.winner)} takes the win.`;
    $('#result-note').textContent = state.result.provisional ? 'Set the final scores, then confirm the result.' : `${state.teams.a.score} : ${state.teams.b.score} · ${state.participants} recruits · ${state.teams.a.switchedIn + state.teams.b.switchedIn} defections`;
  }
  const events = state.events.filter(event => !['reset', 'configured'].includes(event.type)).slice(-9).reverse();
  const eventLabels = { joined: 'RECRUIT', attack: 'CHARGE', volley: 'ATTACK', defected: 'DEFECTION', window_open: 'WINDOW OPEN', window_closed: 'LOCKED', started: 'ROUND LIVE', paused: 'PAUSED', resumed: 'RESUMED', finished: 'FINISH', score: 'SCORE', confirmed: 'RESULT', challenge_complete: 'CHALLENGE', challenge_cancelled: 'HOST' };
  const feedKey = `${state.id}:${events[0]?.id ?? 0}`;
  if ($('#event-feed').dataset.key !== feedKey) {
    $('#event-feed').dataset.key = feedKey;
    $('#event-feed').innerHTML = events.length ? events.map(event => `<div class="feed-row ${event.type === 'defected' ? 'feed-defection' : ''}"><span class="feed-time">${new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span><span class="feed-type ${event.team ? `text-${escape(event.team)}` : ''}">${escape(eventLabels[event.type] ?? 'EVENT')}</span><span class="feed-text">${escape(event.text)}</span></div>`).join('') : '<div class="feed-empty"><span>↗↙</span><p>Quiet before the crossfire.<br><small>Recruit a viewer to get things moving.</small></p></div>';
  }
  $('#event-count').textContent = `${state.teams.a.attacks + state.teams.b.attacks} CHARGES / ${state.teams.a.volleys + state.teams.b.volleys} ATTACKS`;
  const leaderKey = JSON.stringify(state.leaders);
  if ($('#leaders').dataset.key !== leaderKey) {
    $('#leaders').dataset.key = leaderKey;
    $('#leaders').innerHTML = state.leaders.length ? state.leaders.slice(0, 5).map((leader, index) => `<div class="leader-row"><span class="leader-rank">${String(index + 1).padStart(2, '0')}</span><span class="leader-avatar avatar-${escape(leader.team)}">${escape(leader.name.slice(0, 1).toUpperCase())}</span><span class="leader-name">${escape(leader.name)}${leader.switched ? '<small>⇄ SWITCHED SIDES</small>' : ''}</span><span class="leader-attacks">${leader.attacks}<small>CHARGES</small></span></div>`).join('') : '<p class="empty-contributors">Every great rivalry needs an instigator.<br>Who’s going first?</p>';
  }
  updateConnection(); updateControls();
}

function updateConnection() {
  const status = screen ? $('#screen-connection') : $('#stream-status'); if (!status) return;
  let label, healthy;
  if (!connected) { label = 'Room disconnected · reconnecting'; healthy = false; }
  else if (state?.mode === 'demo') { label = 'Demo room connected'; healthy = true; }
  else { healthy = state?.twitch.state === 'connected'; label = healthy ? `Twitch connected · ${state.twitch.channels.length}/2 chats` : state?.twitch.state === 'reconnecting' ? 'Twitch reconnecting' : state?.twitch.state === 'connecting' ? 'Connecting to Twitch' : 'Twitch needs attention'; }
  status.innerHTML = `<i></i>${escape(label)}`; status.classList.toggle('unhealthy', !healthy);
}

function updateControls() {
  if (screen) return;
  $$('[data-host]').forEach(button => { button.disabled = !admin || busy || !connected; });
  $('#unlock-btn span').textContent = admin ? 'Host access' : 'Viewer access'; $('#unlock-btn').classList.toggle('unlocked', admin);
  if (!state) return;
  const phase = state.phase, runnable = admin && !busy && connected;
  $('#primary-action span').textContent = { lobby: 'Start the round', running: 'Pause the round', paused: 'Resume the round', finished: 'Set up another round' }[phase];
  $('#primary-action').disabled = !runnable || phase === 'lobby' && state.mode === 'live' && state.twitch.state !== 'connected';
  $('#host-description').textContent = !admin ? 'Viewing the room. Unlock host access to run the show.' : { lobby: 'Everyone’s here? Give them something to fight for.', running: 'The crowd is in charge. You’re keeping the score.', paused: 'Take a breath. All game timers are frozen.', finished: 'Confirm the scores. Give the crowd their ending.' }[phase];
  $('#window-button').textContent = state.defectionRemainingMs ? '⇄ Close window' : '⇄ Open defection';
  $('#window-button').disabled = !runnable || phase !== 'running' || state.windowUsed && !state.defectionRemainingMs;
  $('#finish-button').disabled = !runnable || !['running', 'paused'].includes(phase);
  $('#confirm-button').hidden = phase !== 'finished' || !state.result?.provisional;
  $('#reconnect-button').hidden = state.mode !== 'live';
  for (const mode of ['demo', 'live']) $(`#mode-${mode}`).disabled = !runnable || ['running', 'paused'].includes(phase);
  $$('[data-score]').forEach(button => { button.disabled = !runnable || phase === 'lobby' || Number(button.dataset.delta) < 0 && state.teams[button.dataset.score].score === 0; });
  $$('[data-demo]').forEach(button => {
    button.disabled = !runnable || state.mode !== 'demo' || phase === 'finished' || phase === 'paused' || button.dataset.demo === '!attack' && phase !== 'running' || button.dataset.demo === '!switch' && (!state.defectionRemainingMs || phase !== 'running');
  });
  $$('[data-cancel]').forEach(button => { button.hidden = !admin || !state.teams[button.dataset.cancel].activeChallenge; });
  $('#setup-form button[type="submit"]').disabled = !runnable || phase !== 'lobby' || state.participants > 0;
}

function setupScreen() {
  $('#dashboard').hidden = true; $('#screen-root').hidden = false;
  document.body.classList.add('screen-mode', `${screen.type}-mode`);
  document.body.dataset.team = screen.team;
  $('#screen-root').innerHTML = `<div class="screen-top"><a class="screen-brand" href="/">↗↙ <strong>CHATCROSSFIRE</strong></a><div class="screen-match"><span id="screen-mode"></span><strong id="screen-title"></strong></div><div class="screen-clock" id="screen-clock">05:00</div><div class="screen-score"><span class="text-a" id="screen-score-a">0</span><i>:</i><span class="text-b" id="screen-score-b">0</span></div></div><div class="screen-status-row"><span class="connection" id="screen-connection"><i></i>Connecting…</span><span id="screen-phase"></span></div><div class="screen-center"><span class="screen-side" id="screen-side"></span><div class="screen-window" id="screen-window" hidden></div><div class="screen-challenge" id="screen-challenge"><span class="eyebrow">INCOMING CHALLENGE</span><h1 id="screen-challenge-text">Clear skies. For now.</h1><span id="screen-challenge-time"></span><p id="screen-queued"></p></div><div class="screen-result" id="screen-result" hidden></div></div><div class="screen-bottom"><div><span class="screen-recruits" id="screen-recruits"></span><span id="screen-charge"></span></div><div class="screen-command"><code>!join</code> enlist <code>!attack</code> strike <code>!switch</code> defect</div><span class="screen-score-note">HOST-SCORED · COMMUNITY-POWERED</span></div><div class="effects" id="screen-effects" aria-hidden="true"></div>`;
  document.title = `ChatCrossfire · ${screen.type === 'cue' ? 'Streamer cue' : 'OBS overlay'} ${screen.team.toUpperCase()}`;
}

function renderScreen() {
  const team = state.teams[screen.team], challenge = team.activeChallenge;
  $('#screen-mode').textContent = state.mode === 'demo' ? 'DEMO · SIMULATED INPUT' : 'LIVE TWITCH INPUT';
  $('#screen-title').textContent = state.config.title;
  $('#screen-clock').textContent = clock(state.remainingMs);
  $('#screen-score-a').textContent = `${nameOf('a')} ${state.teams.a.score}`;
  $('#screen-score-b').textContent = `${state.teams.b.score} ${nameOf('b')}`;
  $('#screen-phase').textContent = { lobby: 'WAITING TO START', running: 'ROUND LIVE', paused: 'PAUSED · TIMERS FROZEN', finished: 'ROUND COMPLETE' }[state.phase];
  $('#screen-side').textContent = `SIDE ${screen.team.toUpperCase()} / ${nameOf(screen.team)}`;
  $('#screen-challenge').classList.toggle('active', Boolean(challenge));
  $('#screen-challenge').hidden = screen.type === 'overlay' && !challenge;
  $('#screen-challenge-text').textContent = challenge?.text ?? 'Clear skies. For now.';
  $('#screen-challenge-time').textContent = challenge ? `${seconds(challenge.endsAt - state.elapsedMs)} ${state.phase === 'paused' ? '· PAUSED' : 'REMAINING'}` : 'Keep an eye on the other chat.';
  $('#screen-queued').textContent = team.queuedChallenge ? `Up next: ${team.queuedChallenge.text}` : '';
  $('#screen-window').hidden = !state.defectionRemainingMs;
  $('#screen-window').textContent = `⇄ DEFECTION WINDOW · ${seconds(state.defectionRemainingMs)} · TYPE !switch${state.phase === 'paused' ? ' · PAUSED' : ''}`;
  $('#screen-recruits').textContent = `${team.members} RECRUITS`;
  $('#screen-charge').textContent = `${team.energy}/${state.config.attackThreshold} ATTACK CHARGE · ${team.volleys} CHALLENGES SENT`;
  $('#screen-result').hidden = !state.result;
  if (state.result) $('#screen-result').textContent = state.result.provisional ? 'ROUND COMPLETE · HOST IS CONFIRMING THE SCORE' : state.result.winner === 'tie' ? 'MATCH DRAWN' : `${nameOf(state.result.winner)} WINS`;
  updateConnection();
}

function populateSettings() {
  if (!state) return;
  const form = $('#setup-form');
  for (const [key, value] of Object.entries(state.config)) {
    const input = form.elements.namedItem(key); if (!input) continue;
    if (typeof value === 'boolean') input.checked = value;
    else input.value = Array.isArray(value) ? value.join('\n') : value;
  }
  $('#setup-message').textContent = state.phase !== 'lobby' || state.participants ? 'Reset the room before changing settings. Current settings are shown below.' : '';
  updateControls();
}

function openBroadcastKit() {
  $('#broadcast-links').innerHTML = ['a', 'b'].map(team => `<div class="broadcast-side"><span class="section-kicker text-${team}">SIDE ${team.toUpperCase()} / ${escape(nameOf(team))}</span>${['overlay', 'cue'].map(type => {
    const url = `${location.origin}/${type}/${team}`;
    return `<div class="broadcast-link"><div><strong>${type === 'overlay' ? 'OBS transparent overlay' : 'Streamer challenge cues'}</strong><a href="${url}" target="_blank" rel="noreferrer">${url} ↗</a></div><button class="button secondary compact" data-copy="${url}">Copy</button></div>`;
  }).join('')}</div>`).join('');
}

if (screen) setupScreen();
else {
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.open) {
      if (button.dataset.open === 'setup-dialog') populateSettings();
      if (button.dataset.open === 'broadcast-dialog') openBroadcastKit();
      $(`#${button.dataset.open}`).showModal();
    }
    if (button.hasAttribute('data-close')) button.closest('dialog').close();
    if (button.dataset.copy) {
      try { await navigator.clipboard.writeText(button.dataset.copy); toast('Link copied. Add it to your OBS Browser Source.'); }
      catch { toast('Clipboard unavailable. Select and copy the visible link.'); }
    }
    if (button.dataset.demo) await perform('/api/demo', { team: button.dataset.team, command: button.dataset.demo });
    if (button.dataset.score) await perform('/api/action', { action: 'score', team: button.dataset.score, value: Math.max(0, state.teams[button.dataset.score].score + Number(button.dataset.delta)) });
    if (button.dataset.cancel) await perform('/api/action', { action: 'cancel_challenge', team: button.dataset.cancel });
  });
  for (const mode of ['demo', 'live']) $(`#mode-${mode}`).addEventListener('click', async () => {
    if (state.mode === mode) return;
    if (state.participants && !confirm('Changing input mode clears this room’s viewers, scores and events. Continue?')) return;
    await perform('/api/mode', { mode });
  });
  $('#primary-action').addEventListener('click', () => perform('/api/action', { action: { lobby: 'start', running: 'pause', paused: 'resume', finished: 'reset' }[state.phase] }));
  $('#window-button').addEventListener('click', () => perform('/api/action', { action: state.defectionRemainingMs ? 'close_defection' : 'open_defection' }));
  $('#finish-button').addEventListener('click', () => { if (confirm('End the round now? You can adjust scores before confirming the result.')) void perform('/api/action', { action: 'finish' }); });
  $('#reset-button').addEventListener('click', () => { if (confirm('Reset this room? Viewers, scores and timers will be cleared. Settings are kept.')) void perform('/api/action', { action: 'reset' }); });
  $('#confirm-button').addEventListener('click', () => perform('/api/action', { action: 'confirm' }));
  $('#reconnect-button').addEventListener('click', () => perform('/api/action', { action: 'reconnect' }));
  $('#unlock-btn').addEventListener('click', () => { if (admin) toast('Host controls are unlocked in this browser. Keep the terminal host link private.'); else $('#unlock-dialog').showModal(); });
  $('#sound-btn').addEventListener('click', async () => {
    try {
      audio ??= new AudioContext(); await audio.resume(); sound = !sound;
      $('#sound-btn span').textContent = sound ? 'Sound on' : 'Sound off';
      $('#sound-btn').setAttribute('aria-label', sound ? 'Disable sound effects' : 'Enable sound effects');
      $('#sound-btn').classList.toggle('sound-on', sound); beep('attack');
    } catch { toast('Sound is unavailable in this browser.'); }
  });
  $('#setup-form').addEventListener('submit', async event => {
    event.preventDefault(); const input = Object.fromEntries(new FormData(event.target));
    for (const key of ['durationSeconds', 'attackThreshold', 'challengeDurationSeconds', 'userCooldownSeconds', 'volleyCooldownSeconds', 'defectionDurationSeconds']) input[key] = Number(input[key]);
    input.autoDefection = event.target.elements.autoDefection.checked;
    input.challenges = input.challenges.split('\n').map(line => line.trim()).filter(Boolean);
    try { await api('/api/config', input); $('#setup-dialog').close(); toast('Match settings saved. Make it a good rivalry.'); }
    catch (error) { $('#setup-message').textContent = error.message; }
  });
  $('#unlock-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await api('/api/session', { key: event.target.elements.key.value.trim() }); admin = true; event.target.reset(); $('#unlock-dialog').close(); updateControls(); toast('Host controls unlocked. You run the show.'); }
    catch (error) { $('#unlock-message').textContent = error.message; }
  });
}

async function initialize() {
  if (!screen) {
    try {
      const key = new URLSearchParams(location.hash.slice(1)).get('key');
      if (key) {
        history.replaceState(null, '', location.pathname + location.search);
        try { await api('/api/session', { key }); admin = true; }
        catch (error) { toast(error.message, 'error'); }
      }
      const session = await fetch('/api/session').then(response => response.json()); admin = session.admin;
    } catch { toast('Could not check host access. Reconnect to the room.', 'error'); }
    updateControls();
  }
  const events = new EventSource('/api/events');
  events.addEventListener('state', event => {
    connected = true;
    try { render(JSON.parse(event.data)); }
    catch (error) { console.error('Unable to render match state.', error); toast('A display error occurred. Refresh this page.', 'error'); }
  });
  events.addEventListener('error', () => { connected = false; updateConnection(); updateControls(); });
  window.addEventListener('pagehide', () => events.close(), { once: true });
}
void initialize();
