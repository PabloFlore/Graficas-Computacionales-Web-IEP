// Generador determinístico Mulberry32 — mismo seed = misma secuencia
let _rng = () => Math.random();

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setSeed(seed) {
  _rng = mulberry32(seed >>> 0);
}

export function rand() {
  return _rng();
}
