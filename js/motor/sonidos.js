// Coloca los archivos .mp3 en assets/sounds/ y descomenta cada línea.

// const _cuack    = new Audio('assets/sounds/cuack.mp3');
// const _salto    = new Audio('assets/sounds/salto.mp3');
// const _recoger  = new Audio('assets/sounds/recoger.mp3');
// const _mina     = new Audio('assets/sounds/mina.mp3');
// const _gameOver = new Audio('assets/sounds/game-over.mp3');
// const _musica   = new Audio('assets/sounds/musica-menu.mp3');

function reproducir(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function sonidoCuack()    { /* reproducir(_cuack);    */ }
export function sonidoSalto()    { /* reproducir(_salto);    */ }
export function sonidoRecoger()  { /* reproducir(_recoger);  */ }
export function sonidoMina()     { /* reproducir(_mina);     */ }
export function sonidoGameOver() { /* reproducir(_gameOver); */ }
export function musicaMenu()     { /* reproducir(_musica);   */ }
