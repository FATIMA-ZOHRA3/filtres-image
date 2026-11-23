import { runJS } from './filters.js';
import { loadWasm } from './wasm.js';

const $ = (id) => document.getElementById(id);
const cv = { js: $('canvasJs'), wasm: $('canvasWasm') };
let W = 0, H = 0, pixels = null, runWasm = null, original = null, results = { js: null, wasm: null }, showOriginal = false;
const rows = [];
const nextFrame = () => new Promise((r) => setTimeout(r, 0));
const opts = () => ({ radius: +$('radius').value });
const fmt = (n) => n.toFixed(n < 10 ? 1 : 0);
const say = (t) => ($('status').textContent = t);

function setBusy(busy) {
  $('runJs').disabled = busy || !pixels;
  $('runWasm').disabled = busy || !pixels || !runWasm;
  $('compare').disabled = busy || !pixels || !runWasm;
  $('toggle').disabled = busy || (!results.js && !results.wasm);
}

function draw(kind, data) {
  const c = cv[kind], K = kind === 'js' ? 'Js' : 'Wasm'; c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  c.hidden = false; $('ph' + K).hidden = true;
}
function hideCard(kind) { cv[kind].hidden = true; $('ph' + (kind === 'js' ? 'Js' : 'Wasm')).hidden = false; }
function refresh() {
  for (const k of ['js', 'wasm']) {
    const d = showOriginal ? original : results[k];
    if (d) draw(k, d); else hideCard(k);
  }
}

function resetCards() {
  results = { js: null, wasm: null }; showOriginal = false; $('toggle').textContent = 'Voir l’image originale';
  for (const k of ['Js', 'Wasm']) {
    $('time' + k).textContent = '–'; $('bar' + k).style.width = '0';
    $('meta' + k).textContent = 'Moyenne sur les répétitions';
    $('card' + k).classList.remove('win', 'is-js');
  }
  $('verdict').hidden = true;
}

function useImage(source, sw, sh) {
  const k = Math.min(1, +$('maxside').value / Math.max(sw, sh));
  W = Math.round(sw * k); H = Math.round(sh * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(source, 0, 0, W, H);
  original = pixels = g.getImageData(0, 0, W, H).data;
  $('info').textContent = `${W} × ${H} px (${(W * H / 1e6).toFixed(1)} Mpx)`;
  const p = $('preview'); p.width = W; p.height = H; p.getContext('2d').putImageData(new ImageData(original, W, H), 0, 0); p.hidden = false;
  resetCards(); refresh(); setBusy(false); say('Image prête. Lancez la comparaison quand vous voulez.');
}

function makeSample() {
  const max = +$('maxside').value, c = document.createElement('canvas');
  c.width = max; c.height = Math.round(max * 0.75);
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#ff9a6b'); grad.addColorStop(.5, '#4aa8e8'); grad.addColorStop(1, '#6f5bd0');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `hsla(${(i * 47) % 360},70%,${30 + (i % 5) * 10}%,.7)`;
    g.beginPath(); g.arc((i * 997) % c.width, (i * 619) % c.height, 20 + ((i * 53) % 160), 0, 7); g.fill();
  }
  g.fillStyle = '#fff'; g.font = `bold ${c.width / 8}px sans-serif`; g.fillText('Wasm', c.width * .08, c.height * .55);
  useImage(c, c.width, c.height);
}

async function bench(kind, runs) {
  const fn = kind === 'js' ? runJS : runWasm, name = $('filter').value;
  const label = kind === 'js' ? 'JavaScript' : 'WebAssembly', K = kind === 'js' ? 'Js' : 'Wasm';
  const times = []; let out;
  $('time' + K).textContent = '…'; $('meta' + K).textContent = 'Échauffement…'; await nextFrame();
  fn(name, pixels, W, H, opts()); // échauffement : compilation JIT, mémoire Wasm
  for (let i = 0; i < runs; i++) {
    say(`${label} : essai ${i + 1} sur ${runs}…`); $('meta' + K).textContent = `Essai ${i + 1} sur ${runs}`; await nextFrame();
    const t = performance.now(); out = fn(name, pixels, W, H, opts()); times.push(performance.now() - t);
    $('time' + K).textContent = fmt(times.reduce((a, b) => a + b, 0) / times.length);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length, min = Math.min(...times);
  results[kind] = out; draw(kind, out);
  $('meta' + K).textContent = `Moyenne de ${runs} essai${runs > 1 ? 's' : ''} · meilleur : ${fmt(min)} ms`;
  return avg;
}

async function go(mode) {
  setBusy(true); showOriginal = false; $('toggle').textContent = 'Voir l’image originale'; $('verdict').hidden = true;
  const runs = +$('runs').value, avg = {};
  try {
    if (mode !== 'wasm') avg.js = await bench('js', runs);
    if (mode !== 'js') avg.wasm = await bench('wasm', runs);
    if (avg.js && avg.wasm) {
      const max = Math.max(avg.js, avg.wasm), gain = avg.js / avg.wasm, wasmWins = gain >= 1;
      $('barJs').style.width = `${(avg.js / max) * 100}%`; $('barWasm').style.width = `${(avg.wasm / max) * 100}%`;
      $('cardWasm').classList.toggle('win', wasmWins);
      $('cardJs').classList.toggle('win', !wasmWins); $('cardJs').classList.toggle('is-js', !wasmWins);
      const same = results.js.every((v, i) => v === results.wasm[i]);
      const x = (wasmWins ? gain : 1 / gain).toFixed(1).replace('.', ',');
      const v = $('verdict'); v.hidden = false; v.className = 'verdict' + (wasmWins ? '' : ' js');
      v.innerHTML = wasmWins
        ? `WebAssembly est ${x} fois plus rapide<small>${same ? 'Les deux images sont identiques pixel par pixel.' : 'Attention : les images diffèrent.'}</small>`
        : `JavaScript est ${x} fois plus rapide ici<small>Le filtre est trop léger : la copie des pixels vers Wasm coûte plus que le calcul gagné. Essayez le flou avec un grand rayon.</small>`;
      if (!rows.length) $('history').innerHTML = '';
      rows.push([$('filter').selectedOptions[0].text, `${W}x${H}`, fmt(avg.js), fmt(avg.wasm), gain.toFixed(2)]);
      $('history').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>×${r[4]}</td></tr>`).join('');
    }
    say('Terminé.');
  } catch (e) { say(`Erreur : ${e.message}. Essayez un côté max plus petit (mémoire limitée sur mobile).`); }
  setBusy(false);
}

for (const id of ['file', 'camera']) $(id).addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  createImageBitmap(f, { imageOrientation: 'from-image' }).then((b) => useImage(b, b.width, b.height)).catch(() => say('Image illisible. Essayez un fichier JPEG ou PNG.'));
  e.target.value = '';
});
let stream = null;
async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { $('camera').click(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false });
    $('video').srcObject = stream; $('camBox').hidden = false; $('snap').focus();
  } catch { say('Caméra inaccessible : autorisation refusée ou aucune caméra détectée.'); }
}
function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  $('video').srcObject = null; $('camBox').hidden = true;
}
$('cameraBtn').onclick = openCamera;
$('camClose').onclick = closeCamera;
$('snap').onclick = () => { const v = $('video'); if (!v.videoWidth) return; useImage(v, v.videoWidth, v.videoHeight); closeCamera(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stream) closeCamera(); });
$('sample').onclick = makeSample;
$('maxside').onchange = () => { if (pixels) say('Rechargez l’image pour appliquer la nouvelle taille.'); };
$('runJs').onclick = () => go('js'); $('runWasm').onclick = () => go('wasm'); $('compare').onclick = () => go('both');
const staleReset = () => { if (results.js || results.wasm) { resetCards(); refresh(); setBusy(false); say('Réglage modifié. Lancez la comparaison.'); } };
$('filter').onchange = () => { $('radiusField').hidden = $('filter').value !== 'blur'; staleReset(); };
$('radius').onchange = staleReset; $('runs').onchange = staleReset;
$('radius').oninput = () => { $('radiusOut').textContent = $('radius').value; };
$('toggle').onclick = () => { showOriginal = !showOriginal; $('toggle').textContent = showOriginal ? 'Voir le résultat des filtres' : 'Voir l’image originale'; refresh(); };
$('copy').onclick = async () => {
  const csv = ['filtre;taille;js_ms;wasm_ms;gain', ...rows.map((r) => r.join(';'))].join('\n');
  try { await navigator.clipboard.writeText(csv); say('CSV copié.'); } catch { say(csv); }
};
$('device').textContent = `Appareil : ${navigator.userAgent}`;

setBusy(true);
loadWasm('build/filtre.wasm')
  .then((f) => { runWasm = f; setBusy(!pixels); })
  .catch(() => say('Impossible de charger build/filtre.wasm. Lancez « npm start » (n’ouvrez pas index.html directement).'));
