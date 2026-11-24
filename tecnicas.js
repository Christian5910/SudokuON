/* ==========================================================================
   SudokuON! - tecnicas.js (solucionador lógico, como uma pessoa resolve; sem DOM)

   Serve a três coisas: classificar a dificuldade de uma partida, dar dicas explicadas e
   conferir que os níveis não exigem tentativa e erro. Cada passo é achado na ordem do mais
   simples para o mais difícil, e o nível da partida é a técnica mais difícil que ela exigiu.

   Níveis e técnicas (o número é o "tier"):
     1  único candidato (naked single)
     2  único lugar (hidden single)
     3  apontando e reivindicação (locked candidates), par exposto (naked pair)
     4  par escondido, trio exposto, trio escondido, X-Wing
     5  Swordfish, XY-Wing, XYZ-Wing
     6  contradição (tentar um número e ver que trava, só nas dicas) e o que vier além

   Estado: E = { G, val: Int8Array, cand: Int16Array } (cand = máscara de candidatos, bit d-1).
   Passo: { tier, tec, colocar: {i, d} | null, eliminar: [{i, d}], celulas, digitos, unidade, ... }

   API: novoEstado, colocar, aplicarPasso, proximoPasso, avaliar, descrever, contraditorio
   ========================================================================== */
(function (raiz) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports) ? require('./regras.js') : raiz.Sudoku;
  const { contaBits, bits, nomeUnidade } = S;

  /* ---------- estado ---------- */
  function novoEstado(G, grade) {
    const E = { G, val: new Int8Array(G.N), cand: new Int16Array(G.N).fill(G.cheia) };
    for (let i = 0; i < G.N; i++) if (grade[i]) colocar(E, i, grade[i]);
    return E;
  }

  function copiar(E) { return { G: E.G, val: Int8Array.from(E.val), cand: Int16Array.from(E.cand) }; }

  function colocar(E, i, d) {
    E.val[i] = d;
    E.cand[i] = 0;
    const m = ~(1 << (d - 1));
    const v = E.G.vizinhos[i];
    for (let k = 0; k < v.length; k++) E.cand[v[k]] &= m;
  }

  function aplicarPasso(E, p) {
    if (p.colocar) colocar(E, p.colocar.i, p.colocar.d);
    if (p.eliminar) p.eliminar.forEach((e) => { E.cand[e.i] &= ~(1 << (e.d - 1)); });
  }

  // algum vazio sem candidato, ou algum número sem lugar numa unidade
  function contraditorio(E) {
    const { G, val, cand } = E;
    for (let i = 0; i < G.N; i++) if (!val[i] && !cand[i]) return true;
    for (let k = 0; k < G.unidades.length; k++) {
      const u = G.unidades[k];
      let usado = 0, podem = 0;
      for (let q = 0; q < u.length; q++) { const i = u[q]; if (val[i]) usado |= 1 << (val[i] - 1); else podem |= cand[i]; }
      if ((usado | podem) !== G.cheia) return true;
    }
    return false;
  }

  function combinacoes(lista, k, cb) {
    const idx = [];
    (function rec(ini) {
      if (idx.length === k) { return cb(idx.map((x) => lista[x])); }
      for (let a = ini; a < lista.length; a++) {
        idx.push(a);
        const r = rec(a + 1);
        idx.pop();
        if (r) return r;
      }
      return null;
    })(0);
  }
  // versão que devolve o primeiro resultado não vazio do callback
  function primeiraComb(lista, k, cb) {
    let achado = null;
    const idx = [];
    (function rec(ini) {
      if (achado) return;
      if (idx.length === k) { achado = cb(idx.map((x) => lista[x])); return; }
      for (let a = ini; a < lista.length && !achado; a++) { idx.push(a); rec(a + 1); idx.pop(); }
    })(0);
    return achado;
  }

  /* ---------- tier 1 e 2 ---------- */
  function unicoCandidato(E) {
    const { G, val, cand } = E;
    for (let i = 0; i < G.N; i++) {
      if (!val[i] && contaBits(cand[i]) === 1) {
        return { tier: 1, tec: 'unico', colocar: { i, d: bits(cand[i])[0] }, eliminar: [], celulas: [i], digitos: [bits(cand[i])[0]] };
      }
    }
    return null;
  }

  function unicoLugar(E) {
    const { G, val, cand } = E;
    for (let k = 0; k < G.unidades.length; k++) {
      const u = G.unidades[k];
      let usado = 0;
      for (let q = 0; q < u.length; q++) if (val[u[q]]) usado |= 1 << (val[u[q]] - 1);
      for (let d = 1; d <= G.n; d++) {
        const b = 1 << (d - 1);
        if (usado & b) continue;
        let achou = -1, cont = 0;
        for (let q = 0; q < u.length; q++) if (!val[u[q]] && (cand[u[q]] & b)) { cont++; achou = u[q]; }
        if (cont === 1) return { tier: 2, tec: 'unicoLugar', colocar: { i: achou, d }, eliminar: [], celulas: [achou], digitos: [d], unidade: k };
      }
    }
    return null;
  }

  /* ---------- tier 3: apontando e reivindicação ---------- */
  function intersecao(E) {
    const { G, val, cand } = E;
    for (const x of G.cruzamentos) {
      const A = G.unidades[x.a], B = G.unidades[x.b];
      const comum = new Set(x.comum);
      for (let d = 1; d <= G.n; d++) {
        const b = 1 << (d - 1);
        const S1 = A.filter((i) => !val[i] && (cand[i] & b));
        if (S1.length < 2 || !S1.every((i) => comum.has(i))) continue;
        const el = B.filter((i) => !comum.has(i) && !val[i] && (cand[i] & b)).map((i) => ({ i, d }));
        if (el.length) {
          const tec = G.tipo[x.a] === 'bloco' ? 'apontando' : (G.tipo[x.b] === 'bloco' ? 'reivindicacao' : 'intersecao');
          return { tier: 3, tec, colocar: null, eliminar: el, celulas: S1, digitos: [d], unidade: x.a, alvoUnidade: x.b };
        }
      }
    }
    return null;
  }

  /* ---------- subconjuntos expostos (naked) ---------- */
  function expostos(E, k, tier, tec) {
    const { G, val, cand } = E;
    for (let u = 0; u < G.unidades.length; u++) {
      const U = G.unidades[u];
      const L = U.filter((i) => !val[i] && contaBits(cand[i]) >= 2 && contaBits(cand[i]) <= k);
      if (L.length < k) continue;
      const r = primeiraComb(L, k, (cs) => {
        let un = 0;
        cs.forEach((i) => { un |= cand[i]; });
        if (contaBits(un) !== k) return null;
        const ds = new Set(cs);
        const el = [];
        U.forEach((i) => {
          if (val[i] || ds.has(i)) return;
          bits(cand[i] & un).forEach((d) => el.push({ i, d }));
        });
        return el.length ? { tier, tec, colocar: null, eliminar: el, celulas: cs.slice(), digitos: bits(un), unidade: u } : null;
      });
      if (r) return r;
    }
    return null;
  }

  /* ---------- subconjuntos escondidos (hidden) ---------- */
  function escondidos(E, k, tier, tec) {
    const { G, val, cand } = E;
    for (let u = 0; u < G.unidades.length; u++) {
      const U = G.unidades[u];
      let usado = 0;
      U.forEach((i) => { if (val[i]) usado |= 1 << (val[i] - 1); });
      const pos = {};
      const D = [];
      for (let d = 1; d <= G.n; d++) {
        const b = 1 << (d - 1);
        if (usado & b) continue;
        let m = 0, c = 0;
        U.forEach((i, p) => { if (!val[i] && (cand[i] & b)) { m |= 1 << p; c++; } });
        if (c >= 2 && c <= k) { pos[d] = m; D.push(d); }
      }
      if (D.length < k) continue;
      const r = primeiraComb(D, k, (ds) => {
        let un = 0, dm = 0;
        ds.forEach((d) => { un |= pos[d]; dm |= 1 << (d - 1); });
        if (contaBits(un) !== k) return null;
        const el = [], cs = [];
        for (let p = 0; p < U.length; p++) {
          if (!(un & (1 << p))) continue;
          const i = U[p];
          cs.push(i);
          bits(cand[i] & ~dm).forEach((d) => el.push({ i, d }));
        }
        return el.length ? { tier, tec, colocar: null, eliminar: el, celulas: cs, digitos: ds.slice(), unidade: u } : null;
      });
      if (r) return r;
    }
    return null;
  }

  /* ---------- peixes: X-Wing (k=2) e Swordfish (k=3) ---------- */
  function peixe(E, k, tier, tec) {
    const { G, val, cand } = E;
    const n = G.n;
    for (let d = 1; d <= n; d++) {
      const b = 1 << (d - 1);
      for (let orient = 0; orient < 2; orient++) {
        // orient 0: linhas-base e colunas-cobertura; orient 1: o contrário
        const base = [], marca = {};
        for (let r = 0; r < n; r++) {
          let m = 0, c = 0;
          for (let c2 = 0; c2 < n; c2++) {
            const i = orient === 0 ? r * n + c2 : c2 * n + r;
            if (!val[i] && (cand[i] & b)) { m |= 1 << c2; c++; }
          }
          if (c >= 2 && c <= k) { base.push(r); marca[r] = m; }
        }
        if (base.length < k) continue;
        const res = primeiraComb(base, k, (rs) => {
          let un = 0;
          rs.forEach((r) => { un |= marca[r]; });
          if (contaBits(un) !== k) return null;
          const el = [], cs = [];
          const setR = new Set(rs);
          for (let c2 = 0; c2 < n; c2++) {
            if (!(un & (1 << c2))) continue;
            for (let r = 0; r < n; r++) {
              const i = orient === 0 ? r * n + c2 : c2 * n + r;
              if (setR.has(r)) { if (!val[i] && (cand[i] & b)) cs.push(i); }
              else if (!val[i] && (cand[i] & b)) el.push({ i, d });
            }
          }
          return el.length ? { tier, tec, colocar: null, eliminar: el, celulas: cs, digitos: [d], orient, base: rs.slice(), cobre: bits(un).map((x) => x - 1) } : null;
        });
        if (res) return res;
      }
    }
    return null;
  }

  /* ---------- XY-Wing e XYZ-Wing ---------- */
  function xyWing(E) {
    const { G, val, cand } = E;
    for (let p = 0; p < G.N; p++) {
      if (val[p] || contaBits(cand[p]) !== 2) continue;
      const [x, y] = bits(cand[p]);
      const viz = G.vizinhos[p].filter((j) => !val[j] && contaBits(cand[j]) === 2);
      for (const w1 of viz) {
        const m1 = cand[w1];
        if (!(m1 & (1 << (x - 1))) || (m1 & (1 << (y - 1)))) continue;
        const z = bits(m1 & ~(1 << (x - 1)))[0];
        for (const w2 of viz) {
          if (w2 === w1) continue;
          if (cand[w2] !== ((1 << (y - 1)) | (1 << (z - 1)))) continue;
          const el = [];
          for (let i = 0; i < G.N; i++) {
            if (i === p || i === w1 || i === w2 || val[i] || !(cand[i] & (1 << (z - 1)))) continue;
            if (G.ve[i * G.N + w1] && G.ve[i * G.N + w2]) el.push({ i, d: z });
          }
          if (el.length) return { tier: 5, tec: 'xywing', colocar: null, eliminar: el, celulas: [p, w1, w2], digitos: [x, y, z], pivo: p, asas: [w1, w2], z };
        }
      }
    }
    return null;
  }

  function xyzWing(E) {
    const { G, val, cand } = E;
    for (let p = 0; p < G.N; p++) {
      if (val[p] || contaBits(cand[p]) !== 3) continue;
      const ds = bits(cand[p]);
      for (const z of ds) {
        const [x, y] = ds.filter((d) => d !== z);
        const mx = (1 << (x - 1)) | (1 << (z - 1)), my = (1 << (y - 1)) | (1 << (z - 1));
        const viz = G.vizinhos[p].filter((j) => !val[j] && contaBits(cand[j]) === 2);
        const A = viz.filter((j) => cand[j] === mx), B = viz.filter((j) => cand[j] === my);
        for (const w1 of A) {
          for (const w2 of B) {
            const el = [];
            for (let i = 0; i < G.N; i++) {
              if (i === p || i === w1 || i === w2 || val[i] || !(cand[i] & (1 << (z - 1)))) continue;
              if (G.ve[i * G.N + p] && G.ve[i * G.N + w1] && G.ve[i * G.N + w2]) el.push({ i, d: z });
            }
            if (el.length) return { tier: 5, tec: 'xyzwing', colocar: null, eliminar: el, celulas: [p, w1, w2], digitos: [x, y, z], pivo: p, asas: [w1, w2], z };
          }
        }
      }
    }
    return null;
  }

  /* ---------- tier 6: contradição ---------- */
  // coloca só pelas técnicas 1 e 2 até travar; false se chegar a uma contradição
  function propagar(E) {
    for (let g = 0; g < E.G.N + 5; g++) {
      if (contraditorio(E)) return false;
      const p = unicoCandidato(E) || unicoLugar(E);
      if (!p) return true;
      colocar(E, p.colocar.i, p.colocar.d);
    }
    return !contraditorio(E);
  }

  function contradicao(E) {
    const { G, val, cand } = E;
    const ordem = [];
    for (let i = 0; i < G.N; i++) if (!val[i]) ordem.push(i);
    ordem.sort((a, b) => contaBits(cand[a]) - contaBits(cand[b]) || a - b);
    for (const i of ordem) {
      for (const d of bits(cand[i])) {
        const T = copiar(E);
        colocar(T, i, d);
        if (!propagar(T)) return { tier: 6, tec: 'contradicao', colocar: null, eliminar: [{ i, d }], celulas: [i], digitos: [d] };
      }
    }
    return null;
  }

  /* ---------- ordem das técnicas ---------- */
  const ORDEM = [
    [1, (E) => unicoCandidato(E)],
    [2, (E) => unicoLugar(E)],
    [3, (E) => intersecao(E)],
    [3, (E) => expostos(E, 2, 3, 'nuPar')],
    [4, (E) => escondidos(E, 2, 4, 'escondidoPar')],
    [4, (E) => expostos(E, 3, 4, 'nuTrio')],
    [4, (E) => escondidos(E, 3, 4, 'escondidoTrio')],
    [4, (E) => peixe(E, 2, 4, 'xwing')],
    [5, (E) => peixe(E, 3, 5, 'swordfish')],
    [5, (E) => xyWing(E)],
    [5, (E) => xyzWing(E)],
    [6, (E) => contradicao(E)]
  ];

  // o passo mais simples que existe (até o tier máximo), ou null
  function proximoPasso(E, maxTier) {
    const lim = maxTier || 6;
    for (const t of ORDEM) {
      if (t[0] > lim) break;
      const p = t[1](E);
      if (p) return p;
    }
    return null;
  }

  // classifica: resolve só com as técnicas até o limite; nivel = técnica mais difícil usada
  function avaliar(G, grade, limite) {
    const lim = limite || 5;
    const E = novoEstado(G, grade);
    let max = 0, passos = 0;
    const usadas = {};
    for (let g = 0; g < G.N * 12; g++) {
      let vazios = 0;
      for (let i = 0; i < G.N; i++) if (!E.val[i]) vazios++;
      if (!vazios) break;
      const p = proximoPasso(E, lim);
      if (!p) break;
      if (p.tier > max) max = p.tier;
      usadas[p.tec] = (usadas[p.tec] || 0) + 1;
      aplicarPasso(E, p);
      passos++;
    }
    let resolvido = true;
    for (let i = 0; i < G.N; i++) if (!E.val[i]) resolvido = false;
    return { resolvido, nivel: resolvido ? Math.max(1, max) : Math.min(6, lim + 1), passos, usadas, grade: Array.from(E.val) };
  }

  /* ---------- explicações (português, sem jargão desnecessário) ---------- */
  const cel = (G, i) => 'L' + (Math.floor(i / G.n) + 1) + 'C' + ((i % G.n) + 1);
  const lista = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
  const em = (G, k) => { const t = G.tipo[k], nm = nomeUnidade(G, k); return (t === 'bloco' ? 'no ' : 'na ') + nm; };
  const de = (G, k) => { const t = G.tipo[k], nm = nomeUnidade(G, k); return (t === 'bloco' ? 'do ' : 'da ') + nm; };
  const Em = (G, k) => { const s = em(G, k); return s.charAt(0).toUpperCase() + s.slice(1); };
  const elimTexto = (G, el) => {
    const por = {};
    el.forEach((e) => { (por[e.d] = por[e.d] || []).push(cel(G, e.i)); });
    return Object.keys(por).map((d) => 'o ' + d + ' de ' + lista(por[d])).join('; ');
  };

  function descrever(G, p) {
    const d0 = p.digitos ? p.digitos[0] : 0;
    const T = { titulo: '', texto: '' };
    switch (p.tec) {
      case 'unico': {
        const i = p.colocar.i;
        const diag = G.deCelula[i].some((k) => G.tipo[k].indexOf('diagonal') === 0);
        T.titulo = 'Único candidato';
        T.texto = 'A célula ' + cel(G, i) + ' só aceita o ' + p.colocar.d + '. Todos os outros números já aparecem na linha, na coluna, no bloco' + (diag ? ' ou na diagonal' : '') + ' dela.';
        break;
      }
      case 'unicoLugar':
        T.titulo = 'Único lugar';
        T.texto = Em(G, p.unidade) + ', o ' + p.colocar.d + ' só cabe em uma célula: ' + cel(G, p.colocar.i) + '.';
        break;
      case 'apontando':
      case 'reivindicacao':
      case 'intersecao':
        T.titulo = p.tec === 'apontando' ? 'Apontando' : (p.tec === 'reivindicacao' ? 'Reivindicação' : 'Cruzamento');
        T.texto = Em(G, p.unidade) + ', o ' + d0 + ' só cabe em ' + lista(p.celulas.map((i) => cel(G, i))) + ', que também ficam ' + em(G, p.alvoUnidade) + '. Então o ' + d0 + ' sai das outras células ' + de(G, p.alvoUnidade) + ': ' + lista(p.eliminar.map((e) => cel(G, e.i))) + '.';
        break;
      case 'nuPar':
      case 'nuTrio': {
        const k = p.celulas.length;
        T.titulo = k === 2 ? 'Par exposto' : 'Trio exposto';
        T.texto = (k === 2 ? 'As células ' : 'As células ') + lista(p.celulas.map((i) => cel(G, i))) + ' só aceitam ' + lista(p.digitos.map(String)) + '. Esses ' + (k === 2 ? 'dois números ficam presos nelas' : 'três números ficam presos nelas') + ', então saem das outras células ' + de(G, p.unidade) + ': ' + elimTexto(G, p.eliminar) + '.';
        break;
      }
      case 'escondidoPar':
      case 'escondidoTrio': {
        const k = p.celulas.length;
        T.titulo = k === 2 ? 'Par escondido' : 'Trio escondido';
        T.texto = Em(G, p.unidade) + ', os números ' + lista(p.digitos.map(String)) + ' só cabem em ' + lista(p.celulas.map((i) => cel(G, i))) + '. Essas células ficam com eles, então qualquer outro candidato delas pode sair: ' + elimTexto(G, p.eliminar) + '.';
        break;
      }
      case 'xwing':
      case 'swordfish': {
        const L = p.orient === 0 ? 'linha' : 'coluna', O = p.orient === 0 ? 'coluna' : 'linha';
        const bs = p.base.map((x) => x + 1), cs = p.cobre.map((x) => x + 1);
        T.titulo = p.tec === 'xwing' ? 'X-Wing' : 'Swordfish';
        T.texto = 'Nas ' + L + 's ' + lista(bs.map(String)) + ', o ' + d0 + ' só cabe em ' + (cs.length === 2 ? 'duas' : 'três') + ' ' + O + 's: ' + lista(cs.map(String)) + '. Ele ocupa uma célula de cada ' + L + ', então pode sair do resto dessas ' + O + 's: ' + lista(p.eliminar.map((e) => cel(G, e.i))) + '.';
        break;
      }
      case 'xywing': {
        const [x, y] = [p.digitos[0], p.digitos[1]];
        T.titulo = 'XY-Wing';
        T.texto = 'A célula ' + cel(G, p.pivo) + ' só aceita ' + x + ' ou ' + y + '. Ela enxerga ' + cel(G, p.asas[0]) + ' e ' + cel(G, p.asas[1]) + ', que são os pares com ' + p.z + '. Se ' + cel(G, p.pivo) + ' for ' + x + ', uma das asas vira ' + p.z + '; se for ' + y + ', a outra vira ' + p.z + '. De qualquer jeito uma delas é ' + p.z + ', então o ' + p.z + ' sai de ' + lista(p.eliminar.map((e) => cel(G, e.i))) + '.';
        break;
      }
      case 'xyzwing':
        T.titulo = 'XYZ-Wing';
        T.texto = 'A célula ' + cel(G, p.pivo) + ' aceita ' + lista(p.digitos.map(String)) + ' e enxerga ' + cel(G, p.asas[0]) + ' e ' + cel(G, p.asas[1]) + '. O ' + p.z + ' tem que estar numa dessas três células, então ele sai de quem enxerga as três: ' + lista(p.eliminar.map((e) => cel(G, e.i))) + '.';
        break;
      case 'contradicao':
        T.titulo = 'Contradição';
        T.texto = 'Teste: se o ' + d0 + ' ficasse em ' + cel(G, p.celulas[0]) + ', o jogo travaria usando só jogadas simples (um número sem lugar, ou uma célula sem opção). Então o ' + d0 + ' não vai nessa célula.';
        break;
      default:
        T.titulo = 'Dica';
        T.texto = '';
    }
    return T;
  }

  const NOMES_TECNICAS = {
    unico: 'Único candidato', unicoLugar: 'Único lugar', apontando: 'Apontando', reivindicacao: 'Reivindicação', intersecao: 'Cruzamento',
    nuPar: 'Par exposto', escondidoPar: 'Par escondido', nuTrio: 'Trio exposto', escondidoTrio: 'Trio escondido', xwing: 'X-Wing',
    swordfish: 'Swordfish', xywing: 'XY-Wing', xyzwing: 'XYZ-Wing', contradicao: 'Contradição'
  };

  const API = { novoEstado, copiar, colocar, aplicarPasso, proximoPasso, avaliar, descrever, contraditorio, propagar, NOMES_TECNICAS, celNome: cel };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Sudoku = Object.assign(raiz.Sudoku || {}, API);
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
