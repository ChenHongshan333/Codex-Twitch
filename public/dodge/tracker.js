// Pure colour/connected-component detection is shared by the camera and tests.
// Only marker coordinates leave the page. The webcam frame stays in this canvas.
export function findMarker(pixels, width, height, colour = [50, 220, 80]) {
  const mask = new Uint8Array(width * height), seen = new Uint8Array(width * height);
  const chroma = rgb => { const total = rgb[0] + rgb[1] + rgb[2]; return total ? rgb.map(x => x / total) : [0, 0, 0]; };
  const target = chroma(colour);
  if (Math.max(...colour) - Math.min(...colour) < 50) return null;
  for (let i = 0; i < mask.length; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2], total = r + g + b;
    if (total < 90 || Math.max(r, g, b) - Math.min(r, g, b) < 50) continue;
    mask[i] = Math.hypot(r / total - target[0], g / total - target[1], b / total - target[2]) < .12 ? 1 : 0;
  }
  let best = null;
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 1, sx = 0, sy = 0; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width); sx += x; sy += y;
      for (const next of [x > 0 ? i - 1 : -1, x + 1 < width ? i + 1 : -1, y > 0 ? i - width : -1, y + 1 < height ? i + width : -1]) if (next >= 0 && mask[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
    }
    if (!best || tail > best.size) best = { x: sx / tail / width, y: sy / tail / height, size: tail };
  }
  return best && best.size >= Math.max(8, width * height * .0005) && best.size <= width * height * .2 ? best : null;
}

if (typeof document !== 'undefined' && document.getElementById('camera')) {
  if (new URLSearchParams(location.search).get('embedded') === '1') document.body.classList.add('embedded-tracker');
  const $ = id => document.getElementById(id), video = $('video'), preview = $('camera-preview'), ctx = preview.getContext('2d', { willReadFrequently: true });
  const sample = document.createElement('canvas'); sample.width = 320; sample.height = 180;
  const sc = sample.getContext('2d', { willReadFrequently: true }), side = location.pathname.split('/').pop();
  let stream, busy = false, colour = [50, 220, 80], generation = 0;
  $('tracker-side').textContent = `${side === 'a' ? 'CORAL' : 'VIOLET'} CAMERA TRACKER`;
  function stop() { generation++; stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; $('tracker-status').textContent = 'Camera stopped. Match pauses when this marker expires.'; }
  async function start() {
    stop(); const epoch = generation;
    try {
      const deviceId = $('device').value;
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
      if (epoch !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; video.srcObject = stream; await video.play();
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(item => item.kind === 'videoinput');
      $('device').replaceChildren(new Option('Default camera', ''), ...devices.map(item => new Option(item.label || 'Camera', item.deviceId)));
      $('device').value = deviceId;
      $('tracker-status').textContent = 'Click your coloured sticker in the preview to calibrate.';
    } catch (error) { stop(); $('tracker-status').textContent = `Camera unavailable: ${error.name}. Allow camera access, or select OBS Virtual Camera if OBS is using the webcam.`; }
  }
  $('camera').addEventListener('click', start); $('stop-camera').addEventListener('click', stop);
  $('device').addEventListener('change', () => { if (stream) void start(); });
  preview.addEventListener('click', event => {
    if (!stream) return;
    const bounds = preview.getBoundingClientRect();
    const x = Math.max(0, Math.min(319, Math.floor((event.clientX - bounds.left) / bounds.width * 320))), y = Math.max(0, Math.min(179, Math.floor((event.clientY - bounds.top) / bounds.height * 180)));
    colour = [...sc.getImageData(x, y, 1, 1).data].slice(0, 3);
    $('tracker-status').textContent = 'Colour selected. Keep only one matching marker in view.';
  });
  setInterval(async () => {
    if (!stream || busy || document.hidden || video.readyState < 2) return;
    busy = true;
    try {
      const vw = video.videoWidth, vh = video.videoHeight, ratio = 16 / 9;
      const cropW = Math.min(vw, vh * ratio), cropH = Math.min(vh, vw / ratio);
      sc.save(); sc.clearRect(0, 0, 320, 180);
      if ($('mirror').checked) { sc.translate(320, 0); sc.scale(-1, 1); }
      sc.drawImage(video, (vw - cropW) / 2, (vh - cropH) / 2, cropW, cropH, 0, 0, 320, 180); sc.restore();
      ctx.drawImage(sample, 0, 0, 960, 540);
      const marker = findMarker(sc.getImageData(0, 0, 320, 180).data, 320, 180, colour);
      if (!marker) { $('tracker-status').textContent = 'MARKER LOST · reselect colour or improve lighting. Match pauses automatically.'; return; }
      const x = marker.x * 960, y = marker.y * 540;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      const response = await fetch('/api/dodge/marker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, x, y }), signal: AbortSignal.timeout(1500) });
      if (!response.ok) throw new Error('Marker rejected');
      $('tracker-status').textContent = `TRACKING · ${Math.round(x)}, ${Math.round(y)} · match this circle to the OBS camera crop.`;
    } catch { $('tracker-status').textContent = 'Tracking connection failed. Match pauses when marker expires.'; }
    finally { busy = false; }
  }, 100);
  window.addEventListener('pagehide', stop);
}
