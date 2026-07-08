const cfg = window.EVENT_CONFIG;
const MAX_PHOTO_EDGE = 1600;
const JPEG_QUALITY = 0.86;

const els = {
  eventTitle: document.getElementById('eventTitle'),
  eventSubtitle: document.getElementById('eventSubtitle'),
  startCard: document.getElementById('startCard'),
  cameraCard: document.getElementById('cameraCard'),
  doneCard: document.getElementById('doneCard'),
  errorCard: document.getElementById('errorCard'),
  errorText: document.getElementById('errorText'),
  guestName: document.getElementById('guestName'),
  startBtn: document.getElementById('startBtn'),
  switchBtn: document.getElementById('switchBtn'),
  captureBtn: document.getElementById('captureBtn'),
  finishBtn: document.getElementById('finishBtn'),
  video: document.getElementById('video'),
  canvas: document.getElementById('canvas'),
  shotsLeft: document.getElementById('shotsLeft'),
  filmStrip: document.getElementById('filmStrip'),
  status: document.getElementById('status')
};

els.eventTitle.textContent = cfg.eventTitle;
els.eventSubtitle.textContent = cfg.eventSubtitle;

const deviceId = getOrCreateDeviceId();
const storageKey = `disposable-camera-${cfg.folder}-${deviceId}`;
let state = JSON.parse(localStorage.getItem(storageKey) || '{"shots":0,"guestName":""}');
let stream = null;
let facingMode = 'environment';

renderFilm();

els.startBtn.addEventListener('click', async () => {
  const name = els.guestName.value.trim() || 'Ospite';
  state.guestName = name;
  saveState();
  await startCamera();
});
els.switchBtn.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera(true);
});
els.captureBtn.addEventListener('click', captureAndUpload);
els.finishBtn.addEventListener('click', finish);

if (state.shots >= cfg.maxShots) {
  els.startCard.classList.add('hidden');
  els.doneCard.classList.remove('hidden');
}

function getOrCreateDeviceId() {
  const key = 'disposable-camera-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function showError(message) {
  els.errorText.textContent = message;
  els.errorCard.classList.remove('hidden');
}
function hideError() { els.errorCard.classList.add('hidden'); }
function setStatus(message) { els.status.textContent = message; }

function renderFilm() {
  els.filmStrip.innerHTML = '';
  for (let i = 0; i < cfg.maxShots; i++) {
    const frame = document.createElement('span');
    frame.className = `frame ${i < state.shots ? 'used' : ''}`;
    els.filmStrip.appendChild(frame);
  }
  els.shotsLeft.textContent = Math.max(cfg.maxShots - state.shots, 0);
}

async function startCamera(restarting = false) {
  if (state.shots >= cfg.maxShots) return finish();
  if (cfg.cloudName.includes('INSERISCI') || cfg.uploadPreset.includes('INSERISCI')) {
    showError('Prima devi inserire cloudName e uploadPreset nel file config.js.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Questo browser non permette di aprire la fotocamera da qui. Apri il sito da Safari o Chrome aggiornato.');
    return;
  }

  els.startBtn.disabled = true;
  els.switchBtn.disabled = true;
  els.captureBtn.disabled = true;
  setStatus(restarting ? 'Sto girando la camera...' : 'Apro la fotocamera...');

  try {
    stopStream();
    stream = await getCameraStream();
    els.video.srcObject = stream;
    await waitForVideoReady(els.video);
    els.startCard.classList.add('hidden');
    els.cameraCard.classList.remove('hidden');
    hideError();
    renderFilm();
    setStatus(restarting ? 'Camera girata. Filtro vintage attivo.' : 'Camera pronta. Filtro vintage attivo.');
  } catch (err) {
    console.error(err);
    stopStream();
    showError(getCameraErrorMessage(err));
  } finally {
    els.startBtn.disabled = false;
    els.switchBtn.disabled = !stream;
    els.captureBtn.disabled = !stream || state.shots >= cfg.maxShots;
  }
}

async function captureAndUpload() {
  if (state.shots >= cfg.maxShots) return finish();
  if (!stream || !els.video.videoWidth || !els.video.videoHeight) {
    setStatus('La fotocamera si sta preparando. Riprova tra un attimo.');
    return;
  }

  els.captureBtn.disabled = true;
  els.switchBtn.disabled = true;
  setStatus(`Scatto ${state.shots + 1} di ${cfg.maxShots}: filtro vintage in corso...`);

  const video = els.video;
  const canvas = els.canvas;
  const size = getCaptureSize(video);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  applyDisposableFilter(ctx, canvas.width, canvas.height);

  try {
    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    setStatus('Salvataggio foto...');
    await uploadToCloudinary(blob);
    state.shots += 1;
    saveState();
    renderFilm();
    if (state.shots >= cfg.maxShots) {
      finish();
    } else {
      setStatus(`Foto salvata con filtro vintage! Te ne restano ${cfg.maxShots - state.shots}.`);
    }
  } catch (err) {
    console.error(err);
    setStatus('Salvataggio non riuscito. Riprova con una connessione migliore.');
  } finally {
    els.captureBtn.disabled = false;
    els.switchBtn.disabled = false;
  }
}

async function getCameraStream() {
  const preferredConstraints = {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1440 },
      height: { ideal: 1920 }
    },
    audio: false
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferredConstraints);
  } catch (err) {
    if (['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(err.name)) {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw err;
  }
}

async function waitForVideoReady(video) {
  await video.play().catch(() => {});
  if (video.videoWidth && video.videoHeight) return;

  await new Promise(resolve => {
    const done = () => {
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('canplay', done);
      resolve();
    };
    video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('canplay', done, { once: true });
    setTimeout(done, 2000);
  });
  await video.play().catch(() => {});
}

function getCameraErrorMessage(err) {
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    return 'Per aprire la fotocamera il sito deve essere in HTTPS. Usa il link GitHub Pages, non un file aperto localmente.';
  }
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Serve il permesso della fotocamera. Ricarica la pagina e premi Consenti quando il telefono lo chiede.';
  }
  if (err?.name === 'NotFoundError') {
    return 'Non trovo una fotocamera disponibile su questo dispositivo.';
  }
  return 'Non riesco ad aprire la fotocamera. Controlla il permesso camera e riprova.';
}

function getCaptureSize(video) {
  const sourceWidth = video.videoWidth || 1080;
  const sourceHeight = video.videoHeight || 1440;
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale)
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Impossibile preparare la foto.'));
    }, type, quality);
  });
}

// The saved image gets the same disposable-camera look on every phone.
function applyDisposableFilter(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const centerX = width / 2;
  const centerY = height * 0.48;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  let index = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDistance;
      const vignette = 1 - Math.min(0.36, distance ** 1.8 * 0.38);
      const grain = (Math.random() - 0.5) * 18;

      let nextRed = gray + (red - gray) * 0.82;
      let nextGreen = gray + (green - gray) * 0.78;
      let nextBlue = gray + (blue - gray) * 0.72;

      nextRed = (nextRed - 128) * 1.08 + 146;
      nextGreen = (nextGreen - 128) * 1.04 + 133;
      nextBlue = (nextBlue - 128) * 0.96 + 116;

      data[index] = clamp(nextRed * vignette + grain);
      data[index + 1] = clamp(nextGreen * vignette + grain);
      data[index + 2] = clamp(nextBlue * vignette + grain * 0.6);
      index += 4;
    }
  }

  ctx.putImageData(image, 0, 0);

  ctx.globalCompositeOperation = 'screen';
  const lightLeak = ctx.createLinearGradient(0, height * 0.12, width * 0.72, height);
  lightLeak.addColorStop(0, 'rgba(255, 146, 92, 0.22)');
  lightLeak.addColorStop(0.34, 'rgba(255, 210, 150, 0.08)');
  lightLeak.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = lightLeak;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'multiply';
  const edgeFade = ctx.createRadialGradient(centerX, centerY, width * 0.18, centerX, centerY, width * 0.72);
  edgeFade.addColorStop(0, 'rgba(255, 255, 255, 1)');
  edgeFade.addColorStop(0.7, 'rgba(244, 228, 198, 0.94)');
  edgeFade.addColorStop(1, 'rgba(86, 45, 23, 0.78)');
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

async function uploadToCloudinary(blob) {
  const shotNumber = String(state.shots + 1).padStart(2, '0');
  const safeName = state.guestName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'ospite';
  const publicId = `${safeName}-${deviceId.slice(0, 8)}-${shotNumber}`;
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', cfg.uploadPreset);
  formData.append('folder', cfg.folder);
  formData.append('public_id', publicId);
  formData.append('tags', `laurea,${cfg.folder},${safeName}`);
  formData.append('context', `guest=${state.guestName}|device=${deviceId}|shot=${shotNumber}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function finish() {
  stopStream();
  els.startCard.classList.add('hidden');
  els.cameraCard.classList.add('hidden');
  els.doneCard.classList.remove('hidden');
}

function stopStream() {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
  stream = null;
}
