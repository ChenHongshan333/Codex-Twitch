(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const duration = ms => { const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000)); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
  const seconds = ms => `${Math.max(0, Math.ceil((Number(ms) || 0) / 1000))}s`;
  const query = new URLSearchParams(location.search);
  const requestedView = query.get('view') || $('meta[name="crossfire-view"]')?.content || 'panel';
  let view = ['config', 'dashboard', 'panel', 'overlay'].includes(requestedView) ? requestedView : 'panel';
  let simulatorPersona = null;
  /* LOCAL_SIMULATOR_START */
  const requestedPersona = query.get('simulator');
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (localHost && ['streamer-a', 'streamer-b', 'viewer-a', 'viewer-b'].includes(requestedPersona) && window.CROSSFIRE_CONFIG?.enableSandbox !== false) simulatorPersona = requestedPersona;
  /* LOCAL_SIMULATOR_END */
  let token = '', backend, state = null, connected = false, inFlight = false, mutating = false;
  let stopped = false, visible = true, failures = 0, pollTimer, pollController, requestGeneration = 0;
  let feedbackTimer, effectTimer, eventMatch = null, eventSequence = null;

  function setView(next) { view = next; document.body.dataset.view = next; $('#extension-root').dataset.view = next; }
  function origin(value) {
    const url = new URL(value || location.origin);
    const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Configure a public HTTPS backend origin, or use localhost for local testing.');
    }
    return url.origin;
  }
  function feedback(message, success = false) {
    const node = $('#feedback'); node.hidden = false; node.textContent = message; node.classList.toggle('success', success);
    clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { node.hidden = true; }, 6500);
  }
  function connection(label, healthy) {
    connected = healthy; $('#connection span').textContent = label; $('#connection').classList.toggle('offline', !healthy); updateControls();
  }
  function schedule(delay = 1000) {
    clearTimeout(pollTimer);
    if (!stopped && visible && token) pollTimer = setTimeout(() => { void poll(); }, delay);
  }
  async function request(path, body, { signal, authenticated = true } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const response = await fetch(`${backend}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal, credentials: 'omit', cache: 'no-store',
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error('The backend returned an unreadable response. Check the configured backend origin.'); }
      if (!response.ok) {
        const error = new Error(payload.error || 'The backend could not complete this request.');
        error.status = response.status; error.code = payload.code; throw error;
      }
      return payload;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  async function poll() {
    if (stopped || !visible || !token || inFlight || mutating) { schedule(); return; }
    const generation = requestGeneration; inFlight = true; pollController = new AbortController();
    try {
      const result = await request('/api/extension/state', undefined, { signal: pollController.signal });
      if (generation !== requestGeneration || stopped) return;
      if (!result.identity) throw new Error('Backend identity verification did not return a valid state.');
      failures = 0; connection(simulatorPersona ? 'Local connection' : 'Twitch connected', true); render(result);
    } catch (error) {
      if (generation !== requestGeneration || stopped || error.name === 'AbortError') return;
      failures++;
      connection(error.status === 401 ? 'Identity needs refresh' : 'Reconnecting', false);
      if (failures === 1) feedback(error.status === 401 ? 'Waiting for a fresh Twitch identity. Reopen the extension if it does not reconnect.' : error.message);
    } finally { inFlight = false; pollController = null; schedule(Math.min(15000, 1000 * 2 ** Math.min(failures, 4))); }
  }
  async function mutate(path, input, successMessage) {
    if (mutating || !token || !connected) return;
    mutating = true; requestGeneration++; pollController?.abort(); clearTimeout(pollTimer); updateControls();
    try {
      const response = await request(path, input);
      if (stopped) return;
      const next = response.state || response;
      if (next.identity) render(next);
      else { mutating = false; await poll(); }
      if (successMessage) feedback(successMessage, true);
    } catch (error) {
      if (stopped) return;
      feedback(error.message);
      if (error.status === 401) connection('Identity needs refresh', false);
    } finally { mutating = false; if (!stopped) { updateControls(); schedule(200); } }
  }
  const nameOf = side => state?.room?.channels?.[side]?.name || state?.room?.channels?.[side]?.login || `SIDE ${side?.toUpperCase() || '?'}`;
  function roomSide(next = state) {
    if (next?.roomSide === 'a' || next?.roomSide === 'b') return next.roomSide;
    return ['a', 'b'].find(side => next?.room?.channels?.[side]?.id === next?.identity?.channelId) || null;
  }
  function render(next) {
    if (state?.room?.id && state.room.id === next.room?.id && Number(next.room.revision) < Number(state.room.revision)) return;
    state = next;
    const identity = state.identity, room = state.room, engine = room?.engine;
    document.body.dataset.lifecycle = room?.lifecycle || 'idle';
    document.body.dataset.role = identity.broadcaster ? 'broadcaster' : 'viewer';
    const channel = room?.channels?.[roomSide()]?.login;
    $('#channel-label').textContent = channel ? `TWITCH.TV/${channel.toUpperCase()}` : `CHANNEL / ${identity.channelId}`;
    $('#identity-label').textContent = identity.broadcaster ? 'STREAMER' : identity.userId ? 'VIEWER · LINKED' : 'VIEWER';
    $('#welcome').hidden = Boolean(room);
    $('#room').hidden = !room;
    $('#invite-form').hidden = Boolean(room) || !identity.broadcaster || view === 'config';
    $('#waiting-viewer').hidden = !$('#invite-form').hidden;
    if (!room) {
      $('#welcome-note').textContent = view === 'config' ? `Backend connected. This extension is ready for your channel. Open the live dashboard or your channel’s extension to invite another streamer. Both channels must have ChatCrossfire installed and activated.` : identity.broadcaster ? 'Invite another streamer to begin.' : 'Your streamer has not started a PK yet. Stay here — the action appears automatically.';
      eventMatch = null; eventSequence = null;
      updateControls(); return;
    }
    $('#phase-pill').textContent = ({ invited: 'INVITATION SENT', lobby: 'READY CHECK', countdown: 'STARTING SOON', running: engine?.defectionRemainingMs ? 'DEFECTION OPEN' : 'PK LIVE', paused: 'PAUSED', finished: 'FINAL RESULT', cancelled: 'PK CLOSED' })[room.lifecycle] || room.lifecycle.toUpperCase();
    $('#phase-pill').classList.toggle('live', room.lifecycle === 'running');
    $('#round-clock').textContent = room.lifecycle === 'invited' ? duration(room.invitationRemainingMs) : room.lifecycle === 'countdown' ? duration(room.countdownRemainingMs) : duration(engine?.remainingMs);
    $('#room-title').textContent = engine?.config?.title || room.title || 'Community crossfire';
    $('#room-subtitle').textContent = room.lifecycle === 'cancelled' ? room.cancellationReason || 'This PK has ended. You can start a new rivalry.' : room.lifecycle === 'paused' ? 'All match timers are frozen. Either streamer can resume.' : room.lifecycle === 'finished' ? 'The backend has settled the community battle.' : 'One shared match. Two very different loyalties.';
    for (const side of ['a', 'b']) {
      const team = engine?.teams?.[side] || {};
      $(`#name-${side}`).textContent = nameOf(side);
      $(`#login-${side}`).textContent = room.channels?.[side]?.login ? `@${room.channels[side].login}` : '';
      $(`#members-${side}`).textContent = team.members || 0;
      $(`#score-${side}`).textContent = String(team.score || 0).padStart(2, '0');
      $(`#charge-${side}`).max = engine?.config?.attackThreshold || 3;
      $(`#charge-${side}`).value = team.energy || 0;
      $(`#charge-text-${side}`).textContent = `${team.energy || 0} / ${engine?.config?.attackThreshold || 3}`;
      $(`#ready-${side}`).hidden = !['invited', 'lobby', 'countdown'].includes(room.lifecycle);
      $(`#ready-${side}`).textContent = room.ready?.[side] ? '✓ READY FOR CROSSFIRE' : 'WAITING TO READY UP';
      $(`#ready-${side}`).classList.toggle('ready', Boolean(room.ready?.[side]));
    }
    const side = roomSide(), myTeam = state.viewer?.team || side;
    const challenge = engine?.teams?.[side]?.activeChallenge;
    const queued = engine?.teams?.[side]?.queuedChallenge;
    $('#challenge-text').textContent = challenge?.text || 'Clear skies. For now.';
    $('#challenge-label').textContent = side ? `${nameOf(side)}’S CHALLENGE` : 'STREAMER CHALLENGE';
    $('#challenge-seconds').textContent = challenge ? seconds(challenge.endsAt - engine.elapsedMs) : '';
    $('#queued-challenge').textContent = queued ? `Up next: ${queued.text}` : '';
    $('#challenge-box').classList.toggle('active', Boolean(challenge));
    $('#challenge-box').hidden = ['invited', 'cancelled'].includes(room.lifecycle);
    $('#countdown-banner').hidden = room.lifecycle !== 'countdown';
    $('#countdown-number').textContent = Math.max(1, Math.ceil((room.countdownRemainingMs || 0) / 1000));
    const windowOpen = (engine?.defectionRemainingMs || 0) > 0;
    $('#defection-window').hidden = !windowOpen;
    $('#defection-time').textContent = `${seconds(engine?.defectionRemainingMs)} remaining${room.lifecycle === 'paused' ? ' · PAUSED' : ' · one switch per round'}`;
    $('#result-box').hidden = !engine?.result || room.lifecycle !== 'finished';
    if (engine?.result && room.lifecycle === 'finished') {
      const result = engine.result;
      $('#result-label').textContent = result.provisional ? 'COMMUNITY BATTLE · AWAITING CONFIRMATION' : 'COMMUNITY BATTLE · AUTOMATIC RESULT';
      $('#result-title').textContent = result.winner === 'tie' ? 'An honorable draw.' : `${nameOf(result.winner)} wins.`;
      $('#result-detail').textContent = `${engine.teams.a.score} : ${engine.teams.b.score} · ${engine.participants} recruits · ${(engine.teams.a.switchedIn || 0) + (engine.teams.b.switchedIn || 0)} defections`;
    }
    $('#streamer-controls').hidden = !identity.broadcaster;
    $('#streamer-side').textContent = side ? `SIDE ${side.toUpperCase()}` : '';
    const invitedToMe = room.inviterChannelId !== identity.channelId;
    $('#invite-message').textContent = room.lifecycle === 'invited' ? invitedToMe ? `${nameOf('a')} has challenged your community. Accept to open the ready check.` : `Waiting for ${nameOf('b')} to accept. The invitation expires automatically.` : '';
    $('#invite-message').hidden = room.lifecycle !== 'invited';
    $('#accept-button').hidden = room.lifecycle !== 'invited' || !invitedToMe;
    $('#decline-button').hidden = room.lifecycle !== 'invited' || !invitedToMe;
    $('#ready-button').hidden = room.lifecycle !== 'lobby';
    $('#ready-button').dataset.action = room.ready?.[side] ? 'unready' : 'ready';
    $('#ready-button').textContent = room.ready?.[side] ? '✓ Ready · undo' : 'I’m ready ↗';
    $('#pause-button').hidden = room.lifecycle !== 'running';
    $('#resume-button').hidden = room.lifecycle !== 'paused';
    $('#leave-button').hidden = ['finished', 'cancelled'].includes(room.lifecycle) && !identity.broadcaster;
    $('#leave-button').textContent = ['finished', 'cancelled'].includes(room.lifecycle) ? 'Close result' : room.lifecycle === 'invited' ? 'Cancel invitation' : 'Leave PK';
    $('#automation-note').textContent = room.lifecycle === 'countdown' ? 'Both streamers are ready. The round starts automatically.' : room.lifecycle === 'running' ? 'The backend schedules defection and settles the community battle automatically.' : 'Both streamers ready up. The backend handles the rest.';
    $('#viewer-controls').hidden = ['invited', 'cancelled'].includes(room.lifecycle) || view === 'config';
    $('#identity-link').hidden = Boolean(identity.userId);
    $('#viewer-action-row').hidden = !identity.userId;
    $('#my-team').textContent = state.viewer?.joined ? `FIGHTING FOR ${nameOf(myTeam)}` : '';
    $('#join-button').textContent = state.viewer?.joined ? `✓ Joined ${nameOf(myTeam)}` : `+ Join side ${side?.toUpperCase() || ''}`;
    $('#attack-button').innerHTML = state.viewer?.attackReadyInMs > 0 ? `Ready in ${escape(seconds(state.viewer.attackReadyInMs))}` : '<span aria-hidden="true">↗</span> Attack';
    $('#switch-button').classList.toggle('enabled', windowOpen && !state.viewer?.switched);
    $('#switch-button').innerHTML = state.viewer?.switched ? '✓ Defected' : '<span aria-hidden="true">⇄</span> Defect';
    $('#play-hint').textContent = room.lifecycle === 'finished' ? 'Community battle complete. External creative challenges are judged by the streamers.' : room.lifecycle === 'paused' ? 'Match paused. No attacks or defections until the streamers resume.' : state.viewer?.joined ? `Your attacks target ${nameOf(myTeam === 'a' ? 'b' : 'a')}, even if you visit the other chat.` : 'Join once. Attack your rival. Defect when the window opens.';
    $('#score-explainer').textContent = `${engine?.scoreLabel || 'Community battle points'} settle automatically. External challenge content is not automatically judged.`;
    renderEvents(room, engine?.events || []); updateControls();
  }
  function renderEvents(room, events) {
    const first = eventMatch !== room.id || eventSequence === null;
    if (first) { eventMatch = room.id; eventSequence = events.at(-1)?.id || 0; }
    else {
      for (const event of events) if (event.id > eventSequence) effect(event);
      eventSequence = Math.max(eventSequence, events.at(-1)?.id || 0);
    }
    const rows = events.filter(event => !['configured', 'reset'].includes(event.type)).slice(-3).reverse();
    const key = `${room.id}:${rows[0]?.id || 0}`;
    if ($('#event-feed').dataset.key === key) return;
    $('#event-feed').dataset.key = key;
    $('#event-feed').innerHTML = rows.map(event => `<div class="event-row ${event.type === 'defected' ? 'defected' : ''}"><span>${escape(event.type === 'defected' ? '⇄' : event.type === 'volley' ? '⚡' : '↗')}</span><span class="${event.team ? `event-team-${escape(event.team)}` : ''}">${escape(event.text)}</span></div>`).join('');
  }
  function effect(event) {
    if (event.type === 'attack' || event.type === 'volley') {
      const node = document.createElement('div'); node.className = `shot side-${event.team === 'b' ? 'b' : 'a'} ${event.type === 'volley' ? 'volley' : ''}`;
      $('#effects').append(node); setTimeout(() => node.remove(), 850);
    } else if (event.type === 'defected') {
      $('#effects .switch-notice')?.remove(); clearTimeout(effectTimer);
      const node = document.createElement('div'); node.className = 'switch-notice';
      node.innerHTML = `<strong>${escape(event.name)} crossed the line.</strong><span>${escape(nameOf(event.from))} → ${escape(nameOf(event.to))}</span>`;
      $('#effects').append(node); effectTimer = setTimeout(() => node.remove(), 4000);
    }
  }
  function updateControls() {
    const canUse = connected && !mutating && Boolean(token);
    $$('button').forEach(button => { button.disabled = !canUse; });
    const room = state?.room, lifecycle = room?.lifecycle, viewer = state?.viewer;
    if (!room) return;
    $('#join-button').disabled = !canUse || !state.identity.userId || Boolean(viewer?.joined) || !['lobby', 'countdown', 'running'].includes(lifecycle);
    const ownTeam = room.engine?.teams?.[viewer?.team || roomSide()];
    $('#attack-button').disabled = !canUse || !viewer?.joined || lifecycle !== 'running' || viewer.attackReadyInMs > 0 || (ownTeam?.energy || 0) >= (room.engine?.config?.attackThreshold || 3);
    $('#switch-button').disabled = !canUse || !viewer?.joined || viewer.switched || lifecycle !== 'running' || !(room.engine?.defectionRemainingMs > 0);
  }
  $('#invite-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!state?.identity?.broadcaster) return;
    const values = new FormData(event.currentTarget);
    void mutate('/api/extension/invite', { targetLogin: String(values.get('targetLogin') || '').trim().toLowerCase(), title: String(values.get('title') || '').trim(), durationSeconds: Number(values.get('durationSeconds')) }, 'Invitation sent. Your rival can accept from their own Twitch channel.');
  });
  $('#streamer-controls').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled || !state?.identity?.broadcaster || !state.room) return;
    void mutate('/api/extension/action', { action: button.dataset.action, roomId: state.room.id });
  });
  $('#viewer-action-row').addEventListener('click', event => {
    const button = event.target.closest('button[data-command]');
    if (!button || button.disabled || !state?.room) return;
    void mutate('/api/extension/play', { roomId: state.room.id, command: button.dataset.command });
  });
  $('#link-identity-button').addEventListener('click', () => {
    if (window.Twitch?.ext?.actions?.requestIdShare) window.Twitch.ext.actions.requestIdShare();
    else feedback('Open this extension on Twitch and share your identity to participate.');
  });
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) schedule(0); else { clearTimeout(pollTimer); requestGeneration++; pollController?.abort(); }
  });
  window.addEventListener('pagehide', () => { stopped = true; clearTimeout(pollTimer); clearTimeout(feedbackTimer); clearTimeout(effectTimer); requestGeneration++; pollController?.abort(); }, { once: true });

  async function waitForHelper() {
    if (window.Twitch?.ext) return window.Twitch.ext;
    const script = $('#twitch-extension-helper');
    if (!script) return null;
    return new Promise(resolve => {
      let timeout;
      const done = () => {
        clearTimeout(timeout); script.removeEventListener('load', done); script.removeEventListener('error', done);
        resolve(window.Twitch?.ext || null);
      };
      script.addEventListener('load', done, { once: true }); script.addEventListener('error', done, { once: true });
      timeout = setTimeout(done, 8000);
    });
  }
  async function initialize() {
    setView(view); updateControls();
    try { backend = origin(window.CROSSFIRE_CONFIG?.backendOrigin); }
    catch (error) { connection('Setup required', false); feedback(error.message); return; }
    /* LOCAL_SIMULATOR_START */
    if (simulatorPersona) {
      $('#simulation-banner').hidden = false; $('#simulation-persona').textContent = simulatorPersona.toUpperCase().replace('-', ' / ');
      try {
        const session = await request('/api/sandbox/session', { persona: simulatorPersona }, { authenticated: false });
        if (!session.token) throw new Error('The local simulator did not provide a session.');
        token = session.token;
        if (session.backendOrigin) backend = origin(session.backendOrigin);
        await poll();
      } catch (error) { connection('Sandbox unavailable', false); feedback(error.message); }
      return;
    }
    /* LOCAL_SIMULATOR_END */
    connection('Waiting for Twitch', false);
    const helper = await waitForHelper();
    if (stopped) return;
    if (!helper) {
      connection('Open on Twitch', false);
      $('#welcome-note').textContent = 'This is a Twitch Extension. Install and activate it on your channel, or open the explicitly labeled local simulator for development.';
      return;
    }
    helper.onAuthorized(auth => {
      if (!auth?.token || stopped) return;
      token = auth.token; requestGeneration++; pollController?.abort(); failures = 0; clearTimeout(pollTimer); schedule(0);
    });
    helper.onContext?.(context => {
      if (stopped) return;
      if (!query.has('view') && !$('meta[name="crossfire-view"]') && ['dashboard', 'config'].includes(context.mode)) setView(context.mode);
      if (context.theme) document.body.dataset.twitchTheme = context.theme;
    });
    helper.onVisibilityChanged?.(isVisible => {
      if (stopped) return;
      visible = isVisible;
      if (visible) schedule(0); else { clearTimeout(pollTimer); requestGeneration++; pollController?.abort(); }
    });
    helper.onError?.(() => { connection('Twitch unavailable', false); feedback('Twitch could not authorize the extension. Reopen it to try again.'); });
  }
  void initialize();
})();
