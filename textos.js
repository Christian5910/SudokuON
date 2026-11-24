/* ==========================================================================
   SudokuON! - textos.js (os textos do Como Jogar; sem lógica)
   Três abas: O site, Sudoku e Técnicas. Os exemplos das técnicas são montados por javinhas.js
   a partir de exemplos.js (estados reais achados pelo solucionador), então o texto de cada
   exemplo é o mesmo que a dica do jogo mostra.
   ========================================================================== */
window.STXT = (function () {
  'use strict';

  const site = `
<h3>A tela do jogo</h3>
<p>No alto fica o botão da <b>partida</b>: ele mostra a variante, o nível e o número do jogo. Tocando nele você escolhe outra partida. Logo abaixo ficam o <b>tempo</b>, os <b>erros</b> e as <b>dicas</b> usadas. Depois vem o tabuleiro, os números para tocar e as ferramentas.</p>
<p>No computador e no celular deitado, os controles ficam na coluna da esquerda e o tabuleiro fica sempre à direita, do tamanho que couber na janela.</p>

<h3>Começar uma partida</h3>
<ol>
  <li>Toque no botão da partida, no alto da tela.</li>
  <li>Escolha a <b>variante</b>: Clássico, Diagonal (X), Mini 6×6 ou Mini 4×4.</li>
  <li>Escolha o <b>nível</b>, de Iniciante a Mestre. As variantes menores têm menos níveis.</li>
  <li>Se quiser, digite um <b>número do jogo</b>. Deixando vazio, o número é sorteado.</li>
  <li>Toque em <b>Jogar</b>.</li>
</ol>
<p>O botão <b>Nova partida</b>, no fim da tela, começa outra com a mesma variante e o mesmo nível. Se a partida atual ainda não terminou, o jogo pergunta antes de abandoná-la.</p>

<h3>Número do jogo e jogo do dia</h3>
<p>A grade não é sorteada na hora: ela sai de uma conta que usa a variante, o nível e o número do jogo. Por isso o mesmo conjunto dá <b>exatamente a mesma grade em qualquer aparelho</b>. Dá para combinar com um amigo: "Clássico, Médio, jogo 4821" é a mesma partida para os dois.</p>
<p>O botão <b>Jogo do dia</b> usa a data de hoje como número (por exemplo, 20261105). Todo mundo que escolher a mesma variante e o mesmo nível joga a mesma grade naquele dia. O jogo guarda os dias em que você terminou o jogo do dia e conta os dias seguidos nas estatísticas.</p>
<p>O botão <b>Sortear</b> escolhe um número ao acaso e mostra no campo, para você anotar se gostar da grade.</p>

<h3>Salvamento</h3>
<p>A partida é salva sozinha a cada jogada, neste aparelho. Se você fechar a página ou o navegador, ao voltar ela está lá, <b>em pausa</b>, com o tempo parado. Toque em Continuar para seguir de onde parou. Cada aparelho tem o seu próprio jogo salvo. O histórico de Desfazer não é salvo: depois de fechar a página, só as jogadas novas podem ser desfeitas.</p>

<h3>Pausa</h3>
<p>Tocar no quadro do tempo pausa o jogo e cobre o tabuleiro, para o relógio não correr e ninguém espiar. O tempo também para sozinho quando você abre o menu ou uma janela, e quando a aba fica em segundo plano.</p>

<h3>Ajudas</h3>
<p>No fim da tela, o painel <b>Ajudas</b> deixa o jogo do seu jeito. As escolhas ficam salvas neste aparelho.</p>
<ul>
  <li><b>Erros</b>: "Na hora" marca em vermelho todo número que não é o certo assim que você coloca. "Só ao verificar" não avisa nada até você tocar em <b>Verificar a grade</b>.</li>
  <li><b>Repetidos</b>: marca em vermelho os números que se repetem na mesma linha, coluna, bloco ou diagonal.</li>
  <li><b>Iguais</b>: realça todos os números iguais ao da célula escolhida.</li>
  <li><b>Notas</b>: "Limpar sozinho" apaga das notas das células vizinhas o número que você acabou de colocar. "Manter" deixa as notas como estão.</li>
  <li><b>Verificar a grade</b>: mostra quais números colocados estão errados.</li>
  <li><b>Anotar tudo</b>: preenche as notas de todas as células vazias com os números que ainda cabem.</li>
</ul>

<h3>Teclado</h3>
<ul>
  <li>Setas: mudam a célula escolhida.</li>
  <li>1 a 9: colocam o número (ou ligam e desligam a nota, no modo de notas).</li>
  <li>Delete ou Backspace: apagam a célula.</li>
  <li>N: liga e desliga o modo de notas.</li>
  <li>Ctrl+Z e Ctrl+Y (ou Z e Y): desfazem e refazem.</li>
  <li>H: pede uma dica. P: pausa.</li>
</ul>

<h3>Menu, estatísticas e configurações</h3>
<p>O botão do menu (as três linhas, no canto) abre a lista dos outros jogos, as <b>estatísticas</b> (partidas, vitórias, melhores tempos e dias seguidos) e as <b>configurações</b>: som, vibração, tremor da tela, modo escuro e reduzir animações. Se o modo escuro nunca foi escolhido, o jogo segue o tema do aparelho.</p>

<h3>Instalar e jogar sem internet</h3>
<p>O SudokuON! funciona offline depois da primeira visita. No menu há o botão de instalar, que coloca o jogo na tela inicial do celular ou no computador, como um aplicativo. Nada do que você joga sai do seu aparelho.</p>
`;

  const sudoku = `
<h3>Objetivo</h3>
<p>Preencher todas as células vazias para que <b>nenhum número se repita</b> na mesma linha, na mesma coluna e no mesmo bloco. Nada de conta: os números são só símbolos, poderiam ser letras.</p>
<p>Cada partida do SudokuON! tem <b>uma única solução</b> e dá para chegar nela só pensando, sem chutar. Se você precisou chutar, existe uma jogada lógica que você ainda não viu, e a dica pode mostrá-la.</p>

<h3>Linhas, colunas e blocos</h3>
<p>As <b>linhas</b> correm na horizontal, as <b>colunas</b> na vertical. Os <b>blocos</b> são os quadrados separados por linhas mais grossas: no 9×9 são nove blocos de 3×3 células. Cada um desses grupos precisa ter todos os números de 1 a 9 uma única vez.</p>
<p>Nas dicas, cada célula tem um nome curto: <b>L3C4</b> é a linha 3, coluna 4, contando de cima para baixo e da esquerda para a direita.</p>

<h3>As quatro variantes</h3>
<h4>Clássico 9×9</h4>
<p>O Sudoku de sempre, com os números de 1 a 9.</p>
<h4>Diagonal (X)</h4>
<p>Igual ao clássico, mas as <b>duas diagonais grandes</b> (de canto a canto) também não podem repetir número. Elas aparecem num tom diferente. Essa regra extra dá mais pistas ao raciocínio e muda o jeito de enxergar a grade.</p>
<h4>Mini 6×6</h4>
<p>Grade de 6×6 com os números de 1 a 6. Os blocos têm 2 linhas por 3 colunas. Boa para treinar, cada partida leva poucos minutos.</p>
<h4>Mini 4×4</h4>
<p>Grade de 4×4 com os números de 1 a 4 e blocos de 2×2. É o jeito mais fácil de aprender a ideia, até para crianças.</p>

<h3>Como jogar, passo a passo</h3>
<ol>
  <li><b>Escolha uma célula vazia</b> tocando nela. A linha, a coluna e o bloco dela ficam levemente realçados, e os números iguais ao dela também.</li>
  <li><b>Toque num número</b> da fileira de baixo. Ele entra na célula. O número pequeno embaixo de cada tecla mostra <b>quantos ainda faltam</b> na grade, e a tecla de um número completo fica apagada.</li>
  <li>As células que já vinham com número <b>não mudam</b>. Os números que você coloca aparecem em azul.</li>
  <li>Para <b>apagar</b>, escolha a célula e toque em Apagar.</li>
  <li><b>Desfazer</b> e <b>Refazer</b> andam pela sua história de jogadas, quantas você quiser.</li>
</ol>
<p>O jogo termina quando a grade fica completa e certa. Aparece o resumo com seu tempo, erros e dicas, e o tempo vai para as estatísticas.</p>

<h3>Notas (candidatos)</h3>
<p>Ligue o botão <b>Notas</b> e os números que você tocar viram <b>notas pequenas</b> dentro da célula: os números que ainda podem caber ali. Tocar de novo no mesmo número tira a nota. Notas são o caderno de rascunho do Sudoku. Quase toda técnica de nível médio para cima usa notas.</p>
<p>Em telas pequenas, as notas dentro da grade ficam bem miúdas. Por isso, quando você escolhe uma célula com notas, os números das notas dela aparecem <b>acesos na fileira de baixo</b>, em tamanho grande.</p>
<p>A forma mais rápida de começar as notas é o botão <b>Anotar tudo</b>, no painel Ajudas. Depois, a cada número colocado, o jogo apaga sozinho esse número das notas vizinhas (dá para desligar em Ajudas).</p>

<h3>Os níveis</h3>
<p>O nível de uma partida é a <b>técnica mais difícil que ela exige</b>. O jogo gera a grade, confere com um solucionador que pensa como uma pessoa e só entrega a partida se o nível bater.</p>
<ul>
  <li><b>1 Iniciante</b>: só Único candidato. Em toda jogada existe uma célula com uma única opção.</li>
  <li><b>2 Fácil</b>: também Único lugar. Um número só cabe em uma célula de uma linha, coluna ou bloco.</li>
  <li><b>3 Médio</b>: pede Apontando, Reivindicação ou Par exposto, que já usam notas.</li>
  <li><b>4 Difícil</b>: pede Par escondido, Trio exposto, Trio escondido ou X-Wing.</li>
  <li><b>5 Especialista</b>: pede Swordfish, XY-Wing ou XYZ-Wing.</li>
  <li><b>6 Mestre</b>: pede testar uma hipótese e ver que ela trava (Contradição). É o nível mais duro.</li>
</ul>
<p>Mini 6×6 tem Iniciante e Fácil. Mini 4×4 tem só Iniciante. Quando o jogo precisa de muita tentativa para achar uma grade muito dura, ele avisa na tela de resultado que o nível ficou aproximado.</p>

<h3>Erros</h3>
<p>Com "Na hora", um número que não é o da solução fica em vermelho e conta como <b>erro</b>. Cada número errado conta uma vez, mesmo que você troque várias vezes na mesma célula. O erro não encerra a partida, mas aparece nas estatísticas: terminar sem nenhum erro é o melhor resultado.</p>

<h3>Dicas</h3>
<p>O botão <b>Dica</b> procura a jogada lógica mais simples que existe agora e <b>explica o raciocínio em duas etapas</b>:</p>
<ol>
  <li>Primeiro mostra só <b>onde olhar</b>: as células importantes ficam marcadas em amarelo e o painel diz o nome da técnica.</li>
  <li>Se você quiser, toque em <b>Mostrar a explicação</b> para ler o raciocínio inteiro, com as células envolvidas e os números que saem ou entram.</li>
  <li>Toque em <b>Aplicar</b> para o jogo fazer a jogada por você, ou feche e faça você mesmo.</li>
</ol>
<p>Cada dica pedida conta no quadro de dicas. Se houver um número errado na grade, a dica começa por ele. Quando a jogada é tirar um número das possibilidades, as células envolvidas mostram essas possibilidades temporariamente, com o número que sai riscado.</p>
`;

  /* Técnicas, na ordem de dificuldade. nivel = nível a partir do qual a técnica aparece */
  const tec = [
    {
      id: 'unico', nome: 'Único candidato', nivel: 1,
      como: [
        'Olhe uma célula vazia e risque, de cabeça, todos os números que já estão na linha, na coluna e no bloco dela (e na diagonal, no Diagonal X). Se sobrar um número só, é ele.',
        'Dica de caça: comece pelas células cercadas, onde linha, coluna e bloco já estão quase cheios.'
      ]
    },
    {
      id: 'unicoLugar', nome: 'Único lugar', nivel: 2,
      como: [
        'Escolha um número e uma linha, uma coluna ou um bloco. Veja em quais células vazias dela esse número ainda pode entrar. Se só cabe em uma, é ali, mesmo que a célula aceite outros números também.',
        'A técnica fica mais fácil se você olhar um número de cada vez, começando pelos que já aparecem muitas vezes na grade.'
      ]
    },
    {
      id: 'apontando', nome: 'Apontando', nivel: 3,
      como: [
        'Dentro de um bloco, um número só cabe em células que estão na mesma linha (ou na mesma coluna). Então ele vai ficar nessa linha, dentro do bloco, e não pode estar em nenhuma outra célula da linha, fora do bloco.',
        'Em notas: você vê que todas as notas de um número num bloco estão alinhadas e apaga esse número do resto da linha.'
      ]
    },
    {
      id: 'reivindicacao', nome: 'Reivindicação', nivel: 3,
      como: [
        'É o contrário do Apontando. Numa linha (ou coluna), um número só cabe em células que estão dentro do mesmo bloco. Esse bloco "reivindica" o número: ele sai das outras células do bloco, as que ficam fora da linha.'
      ]
    },
    {
      id: 'nuPar', nome: 'Par exposto', nivel: 3,
      como: [
        'Se duas células de uma mesma linha, coluna ou bloco só aceitam os mesmos dois números, um dos dois vai numa e o outro na outra. Não sabemos qual vai onde, mas esses dois números ficam presos ali, então saem das notas das outras células do grupo.'
      ]
    },
    {
      id: 'escondidoPar', nome: 'Par escondido', nivel: 4,
      como: [
        'Dois números que, num grupo, só cabem nas mesmas duas células. Essas duas células ficam com eles, então todo o resto que estava nas notas delas pode sair, mesmo que parecesse haver outras opções.'
      ]
    },
    {
      id: 'nuTrio', nome: 'Trio exposto', nivel: 4,
      como: [
        'A mesma ideia do Par exposto, com três células que, juntas, só aceitam três números. Cada célula não precisa ter os três: basta que, somadas, só apareçam esses três. Eles saem das outras células do grupo.'
      ]
    },
    {
      id: 'escondidoTrio', nome: 'Trio escondido', nivel: 4,
      como: [
        'A mesma ideia do Par escondido, com três números que só cabem em três células de um grupo. As outras notas dessas células podem sair.'
      ]
    },
    {
      id: 'xwing', nome: 'X-Wing', nivel: 4,
      como: [
        'Um número que, em duas linhas, só cabe nas duas mesmas colunas. Ele ocupa um canto de cada diagonal do retângulo formado, então some do resto dessas duas colunas. Vale também trocando linhas por colunas.',
        'Imagine as quatro células nos cantos de um retângulo: o número tem que estar em dois cantos opostos, e isso basta para limpar as colunas.'
      ]
    },
    {
      id: 'swordfish', nome: 'Swordfish', nivel: 5,
      como: [
        'O primo grande do X-Wing, com três linhas e três colunas. Se, em três linhas, um número só cabe em três colunas no total, ele ocupa uma célula de cada linha e uma de cada coluna, e sai do resto dessas três colunas. Também vale com linhas e colunas trocadas.'
      ]
    },
    {
      id: 'xywing', nome: 'XY-Wing', nivel: 5,
      como: [
        'Três células que formam um "Y": o <b>pivô</b>, com dois números (por exemplo 2 e 5), enxerga duas <b>asas</b>. Uma asa tem os números 2 e 7, a outra 5 e 7. Se o pivô for 2, a primeira asa vira 7. Se o pivô for 5, a segunda asa vira 7. Seja qual for o caso, uma das asas é 7, então o 7 sai de qualquer célula que enxerga as duas asas.'
      ]
    },
    {
      id: 'xyzwing', nome: 'XYZ-Wing', nivel: 5,
      como: [
        'Parecido com o XY-Wing, mas o pivô tem três números (X, Y e Z) e as asas têm XZ e YZ. O Z tem que estar no pivô ou numa das asas, então sai de toda célula que enxerga as três ao mesmo tempo.'
      ]
    },
    {
      id: 'contradicao', nome: 'Contradição', nivel: 6,
      como: [
        'Quando nada acima funciona, vale testar: "e se este número fosse o certo?". Coloque ele de teste e siga só com jogadas simples. Se em algum momento uma célula ficar sem opção, ou um número ficar sem lugar, o teste estava errado e esse número sai das notas da célula.',
        'É o mais próximo de chutar que o jogo exige, mas a conclusão é lógica: você prova que o chute não pode estar certo. Só o nível Mestre pede isso.'
      ]
    }
  ];

  const tecIntro = `
<p>Esta aba explica as técnicas na ordem em que elas aparecem nos níveis. Cada uma tem um <b>exemplo de verdade</b>: uma situação que o solucionador do jogo encontrou numa partida, com as células envolvidas em amarelo e o que sai em vermelho. O texto do exemplo é o mesmo que a dica do jogo mostra.</p>
<p>Você não precisa decorar nomes. Jogue, peça uma dica quando travar e leia o raciocínio. Com o tempo, o olho passa a achar sozinho.</p>
<p class="nota">As células aparecem com o nome curto: <b>L3C4</b> é a linha 3, coluna 4.</p>
`;

  /* Textos dos níveis, usados no seletor de partida (por variante) */
  const nivelDesc = {
    1: 'Iniciante: usa só Único candidato. Em toda jogada há uma célula com uma única opção.',
    2: 'Fácil: além disso, usa Único lugar, quando um número só cabe numa célula do grupo.',
    3: 'Médio: pede Apontando, Reivindicação ou Par exposto. Vale usar notas.',
    4: 'Difícil: pede Par escondido, Trio exposto, Trio escondido ou X-Wing.',
    5: 'Especialista: pede Swordfish, XY-Wing ou XYZ-Wing.',
    6: 'Mestre: pede testar uma hipótese e ver que ela trava. O nível mais duro.'
  };

  const varDesc = {
    classico: 'O Sudoku de sempre, 9×9, com os números de 1 a 9.',
    x: 'Como o clássico, mas as duas diagonais grandes também não repetem número.',
    mini6: 'Grade 6×6 com os números de 1 a 6. Partidas curtas.',
    mini4: 'Grade 4×4 com os números de 1 a 4. Ótima para aprender.'
  };

  return { site, sudoku, tec, tecIntro, nivelDesc, varDesc };
})();
