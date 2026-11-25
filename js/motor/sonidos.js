// Síntesis de audio con WebAudio: efectos y música de fondo generativa.
// No requiere archivos .mp3. Respeta las preferencias de volumen/sonido
// guardadas en LocalStorage por js/config/preferencias.js.

const CLAVE_PREFERENCIAS = 'mini-metropolis.preferencias';

let _ctx = null;
function ctx() {
  if (_ctx === null) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      _ctx = false;
    }
  }
  if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx || null;
}

function prefs() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) || '{}');
    return {
      sonido: p.sonido !== false,
      volumen: typeof p.volumen === 'number' ? p.volumen : 50,
    };
  } catch {
    return { sonido: true, volumen: 50 };
  }
}

function master() {
  const { volumen } = prefs();
  return Math.max(0, Math.min(1, volumen / 100)) * 0.6;
}

/* ---------- Tono con envolvente ---------- */
function tono({ tipo = 'sine', freq = 440, freqFin = null, dur = 0.15, vol = 1, retardo = 0 }) {
  const c = ctx();
  if (!c || !prefs().sonido) return;
  const t0 = c.currentTime + retardo;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqFin) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqFin), t0 + dur);
  const pico = Math.max(0.0001, master() * vol);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(pico, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/* ---------- Ruido con filtro (impactos) ---------- */
function ruido({ dur = 0.3, vol = 1, corte = 900 }) {
  const c = ctx();
  if (!c || !prefs().sonido) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = master() * vol;
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = corte;
  src.connect(filtro).connect(g).connect(c.destination);
  src.start();
}

/* ---------- Efectos ---------- */
export function sonidoClick()    { tono({ tipo: 'square',   freq: 520,            dur: 0.06, vol: 0.5 }); }
export function sonidoCuack()    { tono({ tipo: 'sawtooth', freq: 320, freqFin: 170, dur: 0.18, vol: 0.7 }); }
export function sonidoSalto()    { tono({ tipo: 'sine',     freq: 300, freqFin: 620, dur: 0.14, vol: 0.45 }); }
export function sonidoRecoger()  { tono({ tipo: 'triangle', freq: 660, freqFin: 990, dur: 0.12, vol: 0.55 }); }
export function sonidoMina()     { ruido({ dur: 0.35, vol: 1, corte: 800 }); tono({ tipo: 'sawtooth', freq: 160, freqFin: 50, dur: 0.35, vol: 0.6 }); }
export function sonidoGameOver() { [523, 392, 330, 262].forEach((f, i) => tono({ tipo: 'triangle', freq: f, dur: 0.3, vol: 0.6, retardo: i * 0.18 })); }
export function sonidoEscudo()   { tono({ tipo: 'square',   freq: 440, freqFin: 880, dur: 0.2,  vol: 0.6 }); }
export function sonidoPowerup()  { [523, 659, 784, 1047].forEach((f, i) => tono({ tipo: 'triangle', freq: f, dur: 0.12, vol: 0.55, retardo: i * 0.07 })); }
export function sonidoVictoria() { [523, 659, 784, 1047, 1319].forEach((f, i) => tono({ tipo: 'triangle', freq: f, dur: 0.2, vol: 0.6, retardo: i * 0.12 })); }

/* ---------- Música de fondo generativa (loop) ---------- */
// Arpegio suave en pentatónica mayor de La; se programa nota a nota.
const _MELODIA = [0, 4, 7, 9, 12, 9, 7, 4, 0, 7, 12, 7];
let _musicaInt = null;
let _musicaPaso = 0;

export function iniciarMusica() {
  if (_musicaInt) return;
  // Despierta el contexto con el gesto del usuario que la inició.
  ctx();
  _musicaInt = setInterval(() => {
    if (!prefs().sonido) return;
    const semi = _MELODIA[_musicaPaso % _MELODIA.length];
    const freq = 220 * Math.pow(2, semi / 12);
    tono({ tipo: 'triangle', freq, dur: 0.5, vol: 0.16 });
    if (_musicaPaso % 2 === 0) {
      tono({ tipo: 'sine', freq: freq / 2, dur: 0.6, vol: 0.12 }); // bajo
    }
    _musicaPaso++;
  }, 340);
}

export function detenerMusica() {
  if (_musicaInt) {
    clearInterval(_musicaInt);
    _musicaInt = null;
  }
}

// Compatibilidad con la API anterior.
export function musicaMenu() { iniciarMusica(); }
