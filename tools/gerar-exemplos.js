/* Gera exemplos.js: para cada técnica, um estado real de partida (valores + candidatos das células envolvidas)
   achado pelo próprio solucionador. Não vai para o site; o resultado (exemplos.js) vai. */
'use strict';
const fs = require('fs');
const R = require('../regras.js'), T = require('../tecnicas.js'), Gn = require('../gerador.js');
const G = R.montar('classico');
const quer = ['unico', 'unicoLugar', 'apontando', 'reivindicacao', 'nuPar', 'escondidoPar', 'nuTrio', 'escondidoTrio', 'xwing', 'swordfish', 'xywing', 'xyzwing', 'contradicao'];
const melhor = {};
const custo = (p) => (p.eliminar ? p.eliminar.length : 0) * 10 + p.celulas.length;
for (const nivel of [1, 2, 3, 4, 5, 6]) for (let k = 1; k <= 60; k++) {
  const r = Gn.gerar('classico', nivel, Gn.semente('classico', nivel, 5000 + k));
  const E = T.novoEstado(G, Gn.grade(r.puzzle));
  for (let g = 0; g < 300; g++) {
    if (E.val.every((d) => d)) break;
    const p = T.proximoPasso(E, 6);
    if (!p) break;
    if (quer.includes(p.tec)) {
      const c = custo(p);
      if (!melhor[p.tec] || c < melhor[p.tec].c) {
        const ci = new Set(p.celulas); (p.eliminar || []).forEach((e) => ci.add(e.i));
        const cand = {}; ci.forEach((i) => { cand[i] = E.cand[i]; });
        melhor[p.tec] = { c, tec: p.tec, grade: Array.from(E.val).join(''), cand, passo: p };
      }
    }
    T.aplicarPasso(E, p);
  }
}
const saida = quer.filter((q) => melhor[q]).map((q) => { const m = melhor[q]; return { tec: m.tec, grade: m.grade, cand: m.cand, passo: m.passo }; });
console.error('achadas:', saida.map((s) => s.tec).join(', '), '| faltam:', quer.filter((q) => !melhor[q]).join(', ') || 'nenhuma');
const js = '/* SudokuON! - exemplos.js (gerado por tools/gerar-exemplos.js: estados reais achados pelo solucionador; não editar à mão) */\n(function (raiz) {\n  \'use strict\';\n  raiz.Sudoku = Object.assign(raiz.Sudoku || {}, { EXEMPLOS: ' + JSON.stringify(saida) + ' });\n  if (typeof module !== \'undefined\' && module.exports) module.exports = raiz.Sudoku.EXEMPLOS;\n})(typeof window !== \'undefined\' ? window : (typeof self !== \'undefined\' ? self : globalThis));\n';
fs.writeFileSync(__dirname + '/../exemplos.js', js);
