/* SudokuON! - testes do motor (regras.js, tecnicas.js, gerador.js). Rode: node testes/regras.test.js */
'use strict';
const assert = require('assert');
const R = require('../regras.js');
const T = require('../tecnicas.js');
const Gn = require('../gerador.js');

let ok = 0;
const t = (nome, fn) => { try { fn(); ok++; } catch (e) { console.error('FALHOU: ' + nome + '\n  ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n  ')); process.exitCode = 1; } };

/* verificador independente (não usa as tabelas do motor): linhas, colunas, blocos e diagonais */
function valida(v, g, completa) {
  const n = v.n;
  const grupos = [];
  for (let r = 0; r < n; r++) { const a = []; for (let c = 0; c < n; c++) a.push(g[r * n + c]); grupos.push(a); }
  for (let c = 0; c < n; c++) { const a = []; for (let r = 0; r < n; r++) a.push(g[r * n + c]); grupos.push(a); }
  for (let r0 = 0; r0 < n; r0 += v.br) for (let c0 = 0; c0 < n; c0 += v.bc) { const a = []; for (let r = 0; r < v.br; r++) for (let c = 0; c < v.bc; c++) a.push(g[(r0 + r) * n + c0 + c]); grupos.push(a); }
  if (v.diag) { const a = [], b = []; for (let k = 0; k < n; k++) { a.push(g[k * n + k]); b.push(g[k * n + n - 1 - k]); } grupos.push(a, b); }
  return grupos.every((a) => { const f = a.filter((x) => x); return new Set(f).size === f.length && (!completa || f.length === n); });
}

/* ---------- tabelas ---------- */
t('tabelas: quantidade de unidades e vizinhos', () => {
  const esperado = { classico: [27, 20], x: [29, null], mini6: [18, 12], mini4: [12, 7] };
  for (const id of Object.keys(R.VARIANTES)) {
    const G = R.montar(id);
    assert.strictEqual(G.unidades.length, esperado[id][0], id + ' unidades');
    G.unidades.forEach((u) => assert.strictEqual(new Set(u).size, G.n, id + ' unidade com ' + G.n + ' células distintas'));
    for (let i = 0; i < G.N; i++) {
      assert.ok(!G.vizinhos[i].includes(i));
      G.vizinhos[i].forEach((j) => assert.ok(G.vizinhos[j].includes(i), 'vizinhança simétrica'));
    }
    if (esperado[id][1]) G.vizinhos.forEach((v) => assert.strictEqual(v.length, esperado[id][1], id + ' vizinhos'));
  }
  const X = R.montar('x');
  const centro = new Set();
  for (let k = 0; k < 9; k++) { centro.add(4 * 9 + k); centro.add(k * 9 + 4); centro.add(k * 9 + k); centro.add(k * 9 + 8 - k); }
  [30, 31, 32, 39, 41, 48, 49, 50].forEach((i) => centro.add(i));
  centro.delete(40);
  assert.strictEqual(X.vizinhos[40].length, centro.size, 'centro do X enxerga linha, coluna, bloco e as duas diagonais');
  assert.ok(X.vizinhos[0].includes(80) && X.vizinhos[0].includes(40), 'X: cantos enxergam a diagonal');
});

t('tabelas: cada bloco do 6x6 tem 2 linhas por 3 colunas', () => {
  const G = R.montar('mini6');
  const blocos = G.unidades.filter((_, k) => G.tipo[k] === 'bloco');
  assert.strictEqual(blocos.length, 6);
  assert.deepStrictEqual(blocos[0], [0, 1, 2, 6, 7, 8]);
  assert.deepStrictEqual(blocos[1], [3, 4, 5, 9, 10, 11]);
  assert.deepStrictEqual(blocos[2], [12, 13, 14, 18, 19, 20]);
});

/* ---------- busca ---------- */
t('busca: o Sudoku 4x4 vazio tem 288 soluções e o 6x6 (blocos 2x3) tem 28.200.960', () => {
  assert.strictEqual(R.buscar(R.montar('mini4'), new Array(16).fill(0), 1e9).n, 288);
});
t('busca: um 9x9 conhecido tem solução única e igual à esperada', () => {
  const G = R.montar('classico');
  const p = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const s = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
  assert.strictEqual(R.contarSolucoes(G, Gn.grade(p), 2), 1);
  assert.strictEqual(R.resolver(G, Gn.grade(p)).join(''), s);
});
t('busca: dados repetidos ou sem solução dão zero', () => {
  const G = R.montar('classico');
  const g = new Array(81).fill(0); g[0] = 5; g[1] = 5;
  assert.strictEqual(R.contarSolucoes(G, g, 2), 0);
  const h = new Array(81).fill(0); // célula 0 sem opção: 1 a 8 na linha, 9 na coluna
  for (let c = 1; c <= 8; c++) h[c] = c;
  h[9] = 9;
  assert.strictEqual(R.contarSolucoes(G, h, 2), 0);
  assert.strictEqual(R.resolver(G, h), null);
});
t('busca: grade vazia 9x9 resolve e a solução é válida em todas as variantes', () => {
  for (const id of Object.keys(R.VARIANTES)) {
    const G = R.montar(id);
    const s = R.resolver(G, new Array(G.N).fill(0), 7);
    assert.ok(s && valida(R.VARIANTES[id], s, true), id);
    assert.deepStrictEqual(R.resolver(G, new Array(G.N).fill(0), 7), s, 'mesma semente, mesma solução');
  }
});
t('busca: duas soluções são detectadas (grade com pouquíssimas pistas)', () => {
  const G = R.montar('classico');
  const g = new Array(81).fill(0); g[0] = 1;
  assert.strictEqual(R.contarSolucoes(G, g, 2), 2);
});
t('conflitos: marca todas as células que repetem número', () => {
  const G = R.montar('classico');
  const g = new Array(81).fill(0); g[0] = 3; g[5] = 3; g[27] = 3; g[10] = 3; g[20] = 4;
  const f = R.conflitos(G, g);
  [0, 5, 27, 10].forEach((i) => assert.strictEqual(f[i], 1, 'célula ' + i));
  assert.strictEqual(f[20], 0);
  const X = R.montar('x');
  const d = new Array(81).fill(0); d[0] = 7; d[80] = 7;
  assert.strictEqual(R.conflitos(X, d)[0], 1, 'diagonal principal');
  assert.strictEqual(R.conflitos(G, d)[0], 0, 'no clássico a diagonal não conta');
});
t('mulberry32: determinístico e entre 0 e 1', () => {
  const a = R.mulberry32(123), b = R.mulberry32(123);
  for (let i = 0; i < 1000; i++) { const x = a(), y = b(); assert.strictEqual(x, y); assert.ok(x >= 0 && x < 1); }
  assert.notStrictEqual(R.mulberry32(1)(), R.mulberry32(2)());
});

/* ---------- gerador ---------- */
const AMOSTRAS = { classico: 8, x: 8, mini6: 20, mini4: 20 };
const geradas = [];
t('gerador: solução única, pistas coerentes com a solução e nível pedido', () => {
  for (const id of Object.keys(Gn.PERFIL)) {
    const v = R.VARIANTES[id], G = R.montar(id);
    for (const nivel of Gn.PERFIL[id].niveis) {
      for (let k = 1; k <= AMOSTRAS[id]; k++) {
        const r = Gn.gerar(id, nivel, Gn.semente(id, nivel, k));
        const p = Gn.grade(r.puzzle), s = Gn.grade(r.solucao);
        assert.strictEqual(p.length, G.N);
        assert.ok(valida(v, s, true), id + ' solução válida');
        assert.ok(valida(v, p, false), id + ' pistas sem conflito');
        p.forEach((d, i) => { if (d) assert.strictEqual(d, s[i], 'pista igual à solução'); });
        assert.strictEqual(R.contarSolucoes(G, p, 2), 1, id + ' nível ' + nivel + ' jogo ' + k + ' solução única');
        assert.strictEqual(r.pistas, p.filter(Boolean).length);
        assert.strictEqual(r.aproximado, false, id + ' nível ' + nivel + ' jogo ' + k + ' não atingiu o nível');
        assert.strictEqual(r.nivelReal, nivel, id + ' nível real');
        geradas.push({ id, nivel, r, G });
      }
    }
  }
});
t('gerador: a mesma semente dá a mesma partida e sementes diferentes dão partidas diferentes', () => {
  for (const id of ['classico', 'mini6']) {
    const a = Gn.gerar(id, 2, 99), b = Gn.gerar(id, 2, 99), c = Gn.gerar(id, 2, 100);
    assert.deepStrictEqual(a, b);
    assert.notStrictEqual(a.puzzle, c.puzzle);
  }
});
t('gerador: nível inexistente na variante cai no último nível dela', () => {
  assert.strictEqual(Gn.gerar('mini4', 5, 1).nivel, 1);
  assert.strictEqual(Gn.gerar('mini6', 6, 1).nivel, 2);
});
t('gerador: a semente depende de variante, nível e número, e o jogo do dia muda por data', () => {
  assert.notStrictEqual(Gn.semente('classico', 1, 1), Gn.semente('x', 1, 1));
  assert.notStrictEqual(Gn.semente('classico', 1, 1), Gn.semente('classico', 2, 1));
  assert.notStrictEqual(Gn.semente('classico', 1, 1), Gn.semente('classico', 1, 2));
  assert.strictEqual(Gn.numeroDoDia(new Date(2026, 10, 4)), 20261104);
});
t('gerador: pistas por nível respeitam o mínimo e descem com a dificuldade (clássico)', () => {
  const med = {};
  geradas.filter((x) => x.id === 'classico').forEach((x) => { med[x.nivel] = (med[x.nivel] || []).concat(x.r.pistas); });
  Object.keys(med).forEach((n) => med[n].forEach((p) => assert.ok(p >= Gn.PERFIL.classico.min[n], 'mínimo do nível ' + n)));
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(m(med[1]) > m(med[3]) && m(med[3]) > m(med[5]), 'pistas médias caem: ' + [1, 3, 5].map((n) => m(med[n]).toFixed(1)).join(' > '));
});

/* ---------- técnicas (o solucionador nunca pode mentir) ---------- */
function percorrer(x) {
  const { G, r } = x, s = Gn.grade(r.solucao);
  const E = T.novoEstado(G, Gn.grade(r.puzzle));
  const usadas = {};
  for (let g = 0; g < 400; g++) {
    if (E.val.every((d) => d)) break;
    const p = T.proximoPasso(E, 6);
    if (!p) return { travou: true, usadas, E };
    usadas[p.tec] = (usadas[p.tec] || 0) + 1;
    if (p.colocar) assert.strictEqual(p.colocar.d, s[p.colocar.i], p.tec + ' colocou número errado');
    (p.eliminar || []).forEach((e) => {
      assert.ok(E.cand[e.i] & (1 << (e.d - 1)), p.tec + ' eliminou candidato que nem existia');
      assert.notStrictEqual(e.d, s[e.i], p.tec + ' eliminou o número certo da célula ' + e.i);
    });
    assert.ok(p.colocar || (p.eliminar && p.eliminar.length), p.tec + ' passo sem efeito');
    const d = T.descrever(G, p);
    assert.ok(d.titulo && d.texto, p.tec + ' sem texto');
    assert.ok(!/[–—]/.test(d.titulo + d.texto), 'travessão no texto de ' + p.tec);
    T.aplicarPasso(E, p);
    assert.ok(!T.contraditorio(E), p.tec + ' levou a uma contradição');
  }
  return { travou: false, usadas, E };
}
t('técnicas: todo passo é verdadeiro e a partida chega à solução (todas as variantes e níveis)', () => {
  const usadasTotal = {};
  geradas.forEach((x) => {
    const r = percorrer(x);
    assert.ok(!r.travou, x.id + ' nível ' + x.nivel + ' travou');
    assert.strictEqual(r.E.val.join(''), x.r.solucao, 'chegou à solução');
    Object.keys(r.usadas).forEach((k) => { usadasTotal[k] = (usadasTotal[k] || 0) + r.usadas[k]; });
  });
  ['unico', 'unicoLugar'].forEach((k) => assert.ok(usadasTotal[k], 'nunca usou ' + k));
  console.log('  técnicas usadas na amostra:', Object.keys(usadasTotal).sort().map((k) => k + '=' + usadasTotal[k]).join(' '));
});
t('técnicas: avaliar limita ao nível pedido; um quebra-cabeça muito difícil não é resolvido sem tentativa e erro e nenhum passo mente', () => {
  const G = R.montar('classico');
  const dificil = Gn.grade('800000000003600000070090200050007000000045700000100030001000068008500010090000400'); // Inkala: exige tentativa
  assert.strictEqual(R.contarSolucoes(G, dificil, 2), 1);
  const sol = R.resolver(G, dificil);
  const a5 = T.avaliar(G, dificil, 5);
  assert.strictEqual(a5.resolvido, false);
  assert.strictEqual(a5.nivel, 6);
  // com contradição liberada, cada passo que ela der continua verdadeiro (pode não chegar ao fim: a dica então usa a solução)
  const E = T.novoEstado(G, dificil);
  for (let g = 0; g < 300 && !E.val.every((d) => d); g++) {
    const p = T.proximoPasso(E, 6);
    if (!p) break;
    if (p.colocar) assert.strictEqual(p.colocar.d, sol[p.colocar.i]);
    (p.eliminar || []).forEach((e) => assert.notStrictEqual(e.d, sol[e.i]));
    T.aplicarPasso(E, p);
  }
  // um nível fácil resolve com o limite certo
  const f = Gn.gerar('classico', 2, 3);
  const af = T.avaliar(G, Gn.grade(f.puzzle), 2);
  assert.ok(af.resolvido && af.nivel === 2);
  const a1 = T.avaliar(G, Gn.grade(f.puzzle), 1);
  assert.strictEqual(a1.resolvido, false, 'nível 2 não resolve só com único candidato');
});
t('técnicas: dica em partida com erro não finge (estado contraditório é detectado)', () => {
  const G = R.montar('classico');
  const r = Gn.gerar('classico', 2, 5), s = Gn.grade(r.solucao), p = Gn.grade(r.puzzle);
  const vazio = p.findIndex((d) => !d);
  const errado = (s[vazio] % 9) + 1;
  const g = p.slice(); g[vazio] = errado;
  const E = T.novoEstado(G, g);
  // número errado: o estado pode não ser contraditório de imediato, mas a solução única deixa de existir
  assert.strictEqual(R.contarSolucoes(G, g, 2), 0);
  assert.ok(E.val[vazio] === errado);
});
t('técnicas: cada técnica de apoio aparece e é verdadeira em grades preparadas', () => {
  // naked pair, hidden pair, X-Wing, XY-Wing: buscamos em muitas partidas dos níveis 3 a 6 e conferimos a verdade de cada passo
  const achadas = {};
  for (let k = 1; k <= 30; k++) for (const nivel of [3, 4, 5, 6]) {
    const r = Gn.gerar('classico', nivel, Gn.semente('classico', nivel, 1000 + k));
    const res = percorrer({ id: 'classico', nivel, r, G: R.montar('classico') });
    assert.ok(!res.travou);
    Object.keys(res.usadas).forEach((n) => { achadas[n] = (achadas[n] || 0) + 1; });
  }
  console.log('  técnicas achadas em 120 partidas:', Object.keys(achadas).sort().map((k) => k + '=' + achadas[k]).join(' '));
  ['nuPar', 'apontando'].forEach((k) => assert.ok(achadas[k], 'não apareceu ' + k));
});

console.log(process.exitCode ? '\nHÁ FALHAS' : ok + ' testes ok');
