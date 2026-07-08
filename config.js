const cfg = window.EVENT_CONFIG;
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
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function showError(message) {
  els.errorText.textContent = message;
  els.errorCard.classList.remove('hidden');
}
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
  if (!cfg.cloudName.includes('INSERISCI') && !cfg.uploadPreset.includes('INSERISCI')) {
    // ok
  } else {
    showError('Prima devi inserire cloudName e uploadPreset nel file config.js.');
    return;
  }
  try {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    els.video.srcObject = stream;
    els.startCard.classList.add('hidden');
    els.cameraCard.classList.remove('hidden');
    els.errorCard.classList.add('hidden');
    setStatus(restarting ? 'Camera girata.' : 'Pronto a scattare.');
  } catch (err) {
    showError('Non riesco ad aprire la fotocamera. Controlla di aver dato il permesso e di aprire il sito in HTTPS.');
  }
}

async function captureAndUpload() {
  if (state.shots >= cfg.maxShots) return finish();
  els.captureBtn.disabled = true;
  els.switchBtn.disabled = true;
  setStatus('Caricamento foto...');

  const video = els.video;
  const canvas = els.canvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    try {
      await uploadToCloudinary(blob);
      state.shots += 1;
      saveState();
      renderFilm();
      if (state.shots >= cfg.maxShots) {
        finish();
      } else {
        setStatus(`Foto salvata! Te ne restano ${cfg.maxShots - state.shots}.`);
      }
    } catch (err) {
      console.error(err);
      setStatus('Upload non riuscito. Riprova con una connessione migliore.');
    } finally {
      els.captureBtn.disabled = false;
      els.switchBtn.disabled = false;
    }
  }, 'image/jpeg', 0.82);
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
  if (stream) stream.getTracks().forEach(track => track.stop());
  els.cameraCard.classList.add('hidden');
  els.doneCard.classList.remove('hidden');
}
