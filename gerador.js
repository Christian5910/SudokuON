/* ==========================================================================
   SudokuON! - gerador.js (cria partidas com solução única e nível conferido; sem DOM)

   gerar(variante, nivel, semente) é determinístico: a mesma semente dá sempre a mesma partida,
   em qualquer aparelho (só contas com inteiros). Por isso o "Jogo do dia" e os números de jogo
   podem ser repetidos. Não usa relógio: o limite é de tentativas, não de tempo.

   Como funciona: sorteia uma grade completa, tira células (em pares simétricos, como nos
   jornais) enquanto a solução continuar única e o solucionador lógico (tecnicas.js) ainda
   resolver com as técnicas do nível. O nível final é a técnica mais difícil que a partida exige.
   ========================================================================== */
(function (raiz) {
  'use strict';

  const R = (typeof module !== 'undefined' && module.exports) ? require('./regras.js') : raiz.Sudoku;
  const T = (typeof module !== 'undefined' && module.exports) ? require('./tecnicas.js') : raiz.Sudoku;
  const { montar, buscar, contarSolucoes, mulberry32 } = R;

  // mínimo de pistas que cada nível mantém (para não ficar áspero demais) e níveis que a variante tem
  const PERFIL = {
    classico: { niveis: [1, 2, 3, 4, 5, 6], min: { 1: 38, 2: 32, 3: 28, 4: 25, 5: 23, 6: 0 } },
    x:        { niveis: [1, 2, 3, 4, 5, 6], min: { 1: 36, 2: 30, 3: 27, 4: 24, 5: 22, 6: 0 } },
    mini6:    { niveis: [1, 2],             min: { 1: 20, 2: 0 } },
    mini4:    { niveis: [1],                min: { 1: 0 } }
  };
  const MAX_TENTATIVAS = 400;

  const texto = (g) => g.join('');
  const grade = (s) => Array.from(s, (c) => (c >= '0' && c <= '9' ? +c : 0));

  function embaralhar(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function tentar(G, idVar, nivel, rng, simetrico) {
    const N = G.N;
    const vazia = new Array(N).fill(0);
    const sol = buscar(G, vazia, 1, rng).sol;
    const g = sol.slice();
    const min = PERFIL[idVar].min[nivel];
    const orbitas = [];
    for (let i = 0; i < N; i++) {
      const j = N - 1 - i;
      if (!simetrico) orbitas.push([i]);
      else if (i < j) orbitas.push([i, j]);
      else if (i === j) orbitas.push([i]);
    }
    embaralhar(orbitas, rng);
    let pistas = N;
    for (const o of orbitas) {
      if (pistas - o.length < min) continue;
      const salvo = o.map((i) => g[i]);
      o.forEach((i) => { g[i] = 0; });
      let bom = contarSolucoes(G, g, 2) === 1;
      if (bom && nivel < 6) bom = T.avaliar(G, g, nivel).nivel <= nivel;
      if (bom) pistas -= o.length;
      else o.forEach((i, k) => { g[i] = salvo[k]; });
    }
    const aval = T.avaliar(G, g, nivel < 6 ? nivel : 5);
    return { g, sol, pistas, nivelReal: aval.nivel, resolvido: aval.resolvido };
  }

  function gerar(idVar, nivel, semente) {
    const G = montar(idVar);
    const perfil = PERFIL[idVar];
    if (perfil.niveis.indexOf(nivel) < 0) nivel = perfil.niveis[perfil.niveis.length - 1];
    const rng = mulberry32(semente);
    let melhor = null;
    for (let t = 1; t <= MAX_TENTATIVAS; t++) {
      const r = tentar(G, idVar, nivel, rng, t <= MAX_TENTATIVAS / 2);
      const bateu = nivel === 6 ? r.nivelReal === 6 : (r.resolvido && r.nivelReal === nivel);
      const dist = Math.abs(r.nivelReal - nivel);
      if (bateu) return { variante: idVar, nivel, nivelReal: r.nivelReal, semente, puzzle: texto(r.g), solucao: texto(r.sol), pistas: r.pistas, tentativas: t, aproximado: false };
      if (!melhor || dist < melhor.dist) melhor = { dist, r, t };
    }
    const r = melhor.r;
    return { variante: idVar, nivel, nivelReal: r.nivelReal, semente, puzzle: texto(r.g), solucao: texto(r.sol), pistas: r.pistas, tentativas: MAX_TENTATIVAS, aproximado: true };
  }

  // mistura variante, nível e número do jogo numa semente
  function semente(idVar, nivel, numero) {
    let h = 2166136261 >>> 0;
    const s = idVar + ':' + nivel + ':' + numero;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  const numeroDoDia = (d) => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  const API = { gerar, semente, numeroDoDia, PERFIL, texto, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Sudoku = Object.assign(raiz.Sudoku || {}, API);
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
