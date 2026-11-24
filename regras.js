/* ==========================================================================
   SudokuON! - regras.js (regras puras, sem DOM; roda no navegador, no Worker e no Node)

   Uma "grade" é uma lista de N = n*n números (0 = vazio), célula i = linha * n + coluna.
   Variantes (todas com o mesmo motor): Clássico 9x9, Diagonal (X) 9x9, Mini 6x6 (blocos 2x3)
   e Mini 4x4 (blocos 2x2). Uma "unidade" é um grupo que não repete número: linha, coluna,
   bloco e, no X, as duas diagonais.

   API (window.Sudoku, ou module.exports no Node):
     VARIANTES, NIVEIS, montar(idVariante) -> G (tabelas prontas da variante)
     contarSolucoes(G, grade, limite) -> quantas soluções (para no limite)
     resolver(G, grade, semente) -> grade completa ou null
     conflitos(G, grade) -> Uint8Array com 1 nas células que repetem número numa unidade
     nomeCelula(G, i), nomeUnidade(G, k)
     mulberry32(semente), bits(m), contaBits(m)
   ========================================================================== */
(function (raiz) {
  'use strict';

  const VARIANTES = {
    classico: { id: 'classico', nome: 'Clássico', n: 9, br: 3, bc: 3, diag: false },
    x: { id: 'x', nome: 'Diagonal (X)', n: 9, br: 3, bc: 3, diag: true },
    mini6: { id: 'mini6', nome: 'Mini 6×6', n: 6, br: 2, bc: 3, diag: false },
    mini4: { id: 'mini4', nome: 'Mini 4×4', n: 4, br: 2, bc: 2, diag: false }
  };

  // nível (1 a 6) = técnica mais difícil que a partida exige (veja tecnicas.js)
  const NIVEIS = ['', 'Iniciante', 'Fácil', 'Médio', 'Difícil', 'Especialista', 'Mestre'];

  /* ---------- bits ---------- */
  const POP = new Uint8Array(1 << 9);
  for (let i = 1; i < POP.length; i++) POP[i] = POP[i >> 1] + (i & 1);
  const contaBits = (m) => POP[m];
  function bits(m) { const r = []; for (let d = 1; m; d++, m >>= 1) if (m & 1) r.push(d); return r; }

  /* ---------- sorteio com semente (mulberry32: só inteiros, igual em qualquer aparelho) ---------- */
  function mulberry32(sem) {
    let a = sem >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- tabelas da variante ---------- */
  const cache = {};
  function montar(id) {
    if (cache[id]) return cache[id];
    const v = VARIANTES[id];
    if (!v) throw new Error('Variante desconhecida: ' + id);
    const n = v.n, N = n * n, br = v.br, bc = v.bc;
    const unidades = [], tipo = [];
    for (let r = 0; r < n; r++) { const u = []; for (let c = 0; c < n; c++) u.push(r * n + c); unidades.push(u); tipo.push('linha'); }
    for (let c = 0; c < n; c++) { const u = []; for (let r = 0; r < n; r++) u.push(r * n + c); unidades.push(u); tipo.push('coluna'); }
    const blocosAcima = n / bc;                       // quantos blocos lado a lado
    const nBlocos = n;
    for (let b = 0; b < nBlocos; b++) {
      const u = [], r0 = Math.floor(b / blocosAcima) * br, c0 = (b % blocosAcima) * bc;
      for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) u.push((r0 + r) * n + c0 + c);
      unidades.push(u); tipo.push('bloco');
    }
    if (v.diag) {
      const d1 = [], d2 = [];
      for (let k = 0; k < n; k++) { d1.push(k * n + k); d2.push(k * n + (n - 1 - k)); }
      unidades.push(d1); tipo.push('diagonal1');
      unidades.push(d2); tipo.push('diagonal2');
    }
    const deCelula = Array.from({ length: N }, () => []);
    unidades.forEach((u, k) => u.forEach((i) => deCelula[i].push(k)));
    const vizinhos = [], ve = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) {
      const s = new Set();
      deCelula[i].forEach((k) => unidades[k].forEach((j) => { if (j !== i) s.add(j); }));
      const l = Array.from(s).sort((a, b) => a - b);
      vizinhos.push(l);
      l.forEach((j) => { ve[i * N + j] = 1; });
    }
    // cruzamentos entre duas unidades (2 ou mais células em comum), usados em "apontando" e "reivindicação"
    const cruzamentos = [];
    for (let a = 0; a < unidades.length; a++) {
      for (let b = 0; b < unidades.length; b++) {
        if (a === b) continue;
        const sa = new Set(unidades[a]);
        const comum = unidades[b].filter((i) => sa.has(i));
        if (comum.length >= 2 && comum.length < unidades[a].length && comum.length < unidades[b].length) cruzamentos.push({ a, b, comum });
      }
    }
    const G = {
      id, nome: v.nome, n, N, br, bc, diag: v.diag, cheia: (1 << n) - 1,
      unidades, tipo, deCelula, vizinhos, ve, cruzamentos,
      linha: (i) => Math.floor(i / n), coluna: (i) => i % n,
      bloco: (i) => Math.floor(Math.floor(i / n) / br) * blocosAcima + Math.floor((i % n) / bc),
      nLinhas: n
    };
    cache[id] = G;
    return G;
  }

  /* ---------- nomes (para as explicações) ---------- */
  function nomeCelula(G, i) { return 'linha ' + (Math.floor(i / G.n) + 1) + ', coluna ' + ((i % G.n) + 1); }
  function nomeUnidade(G, k) {
    const t = G.tipo[k];
    if (t === 'linha') return 'linha ' + (k + 1);
    if (t === 'coluna') return 'coluna ' + (k - G.n + 1);
    if (t === 'bloco') return 'bloco ' + (k - 2 * G.n + 1);
    return t === 'diagonal1' ? 'diagonal principal' : 'diagonal secundária';
  }

  /* ---------- conflitos (números repetidos numa unidade) ---------- */
  function conflitos(G, grade) {
    const f = new Uint8Array(G.N);
    G.unidades.forEach((u) => {
      const vistos = {};
      u.forEach((i) => { const d = grade[i]; if (d) (vistos[d] = vistos[d] || []).push(i); });
      Object.keys(vistos).forEach((d) => { if (vistos[d].length > 1) vistos[d].forEach((i) => { f[i] = 1; }); });
    });
    return f;
  }

  /* ---------- busca (contar soluções e resolver) ---------- */
  // Retorna { n: quantas soluções achou (até limite), sol: a primeira (ou null) }
  function buscar(G, grade, limite, rng) {
    const { N, cheia, unidades, deCelula } = G;
    const g = Int8Array.from(grade);
    const uso = new Int16Array(unidades.length);
    for (let i = 0; i < N; i++) {
      if (!g[i]) continue;
      const b = 1 << (g[i] - 1);
      for (const u of deCelula[i]) { if (uso[u] & b) return { n: 0, sol: null }; uso[u] |= b; }
    }
    let cont = 0, primeira = null;
    function rec() {
      let melhor = -1, mm = 0, mc = 99;
      for (let i = 0; i < N; i++) {
        if (g[i]) continue;
        let m = 0;
        const us = deCelula[i];
        for (let k = 0; k < us.length; k++) m |= uso[us[k]];
        m = cheia & ~m;
        const c = POP[m];
        if (c === 0) return false;
        if (c < mc) { mc = c; melhor = i; mm = m; if (c === 1) break; }
      }
      if (melhor < 0) { cont++; if (!primeira) primeira = Array.from(g); return cont >= limite; }
      const ds = bits(mm);
      if (rng) for (let a = ds.length - 1; a > 0; a--) { const b = Math.floor(rng() * (a + 1)); const t = ds[a]; ds[a] = ds[b]; ds[b] = t; }
      const us = deCelula[melhor];
      for (let k = 0; k < ds.length; k++) {
        const b = 1 << (ds[k] - 1);
        g[melhor] = ds[k];
        for (let q = 0; q < us.length; q++) uso[us[q]] |= b;
        const fim = rec();
        for (let q = 0; q < us.length; q++) uso[us[q]] &= ~b;
        g[melhor] = 0;
        if (fim) return true;
      }
      return false;
    }
    rec();
    return { n: cont, sol: primeira };
  }

  function contarSolucoes(G, grade, limite) { return buscar(G, grade, limite || 2, null).n; }

  // semente opcional: com ela a solução sorteada é sempre a mesma
  function resolver(G, grade, semente) {
    const r = buscar(G, grade, 1, semente === undefined ? null : mulberry32(semente));
    return r.sol;
  }

  const API = { VARIANTES, NIVEIS, montar, contarSolucoes, resolver, buscar, conflitos, nomeCelula, nomeUnidade, mulberry32, bits, contaBits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Sudoku = Object.assign(raiz.Sudoku || {}, API);
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
