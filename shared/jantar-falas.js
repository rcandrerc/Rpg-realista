// Conversas do jantar do clã (André 2026-11-25: "de acordo com a personalidade, um leque de, sei lá, 5.000 conversas
// aleatórias para eles conversarem entre si"). Só texto em balão (nada de voz).
// Cada jeito do recruta (CLA.jeitos, na mesma ordem: disciplinado, brincalhão, ambicioso, medroso, rabugento, curioso,
// orgulhoso, gentil, competitivo, saudoso) tem frases para puxar assunto (abre), responder (resp), falar da comida
// (comida) e do líder sentado à mesa (lider). As lacunas trocam a cada fala, e é daí que sai o leque grande:
//   {n} quem ouve · {l} o líder · {c} a comida da mesa · {r} a raça inimiga · {eu} a raça do clã · {lug} um lugar (e
//   {em_lug}, {de_lug}: já com na/no/do) · {b} um monstro · {coisa} um assunto do dia a dia
// totalFalasJantar() conta as combinações (o teste ferramentas/testes/cla-jantar.mjs confere que passa de 5.000).

// lugares: [com artigo, "em", "de"] (o português junta: na Clareira, do Juncal); {lug}/{Lug} {em_lug}/{Em_lug} {de_lug}
export const JANTAR_LUGARES = [['a Clareira', 'na Clareira', 'da Clareira'], ['o Juncal', 'no Juncal', 'do Juncal'], ['o Bosque do Sul', 'no Bosque do Sul', 'do Bosque do Sul'],
  ['o Rio Claro', 'no Rio Claro', 'do Rio Claro'], ['Aurora', 'em Aurora', 'de Aurora'], ['a Caverna da Montanha', 'na Caverna da Montanha', 'da Caverna da Montanha'],
  ['a ponte dos Juncos', 'na ponte dos Juncos', 'da ponte dos Juncos'], ['o lago fundo', 'no lago fundo', 'do lago fundo'], ['Vael', 'em Vael', 'de Vael'],
  ['as Terras da Estrada', 'nas Terras da Estrada', 'das Terras da Estrada'], ['o Porto de Vael', 'no Porto de Vael', 'do Porto de Vael'], ['a Ilha', 'na Ilha', 'da Ilha'],
  ['o Posto do Oeste', 'no Posto do Oeste', 'do Posto do Oeste'], ['a beira da Névoa', 'na beira da Névoa', 'da beira da Névoa']];
export const JANTAR_LACUNAS = {
  b: ['lobo', 'Puglin', 'Imp', 'Golem de Magma', 'Warrok', 'Maw', 'dragão', 'Titã'],
  coisa: ['o leilão', 'o preço do ferro', 'a taxa da base', 'a lenha da semana', 'o Baú do Clã', 'a forja', 'a horta', 'o treino de amanhã', 'a pescaria', 'o vigor que não volta',
    'a cerca da base', 'o preço da poção', 'a escolta do mercante', 'a fornalha'],
};
const LUG = { lug: 0, Lug: 0, em_lug: 1, Em_lug: 1, de_lug: 2 };

export const JANTAR_FALAS = [
  { // 0 disciplinado e leal
    abre: ['{n}, amanhã cedo a gente revisa as armas antes de sair.', 'Ordem é ordem, {n}. Se o {l} mandar, eu vou até {lug}.', 'Passei {em_lug} hoje. Tudo limpo, nenhum {b} por perto.',
      '{n}, você deixou a mochila aberta de novo. Arruma isso.', 'Quem ficou de vigia ontem? Vi pegada de {b} perto da base.', 'Se a {r} aparecer, ninguém sai correndo. Fica todo mundo junto.',
      'Contei as flechas e as poções. Falta pouco, mas dá pra semana.', '{n}, depois do jantar tem ronda. Não esquece.', 'A {r} não respeita trégua nenhuma. A gente respeita o clã.',
      'Tô de olho em {coisa}. Tem que ficar em ordem.', 'Treinei golpe até cansar o braço. Amanhã de novo.', 'Um clã forte começa na disciplina, {n}.',
      'Vi um {b} enorme {em_lug}. Marquei o lugar pro {l}.', 'Comida na hora certa, sono na hora certa. É assim que se vence.'],
    resp: ['Entendido.', 'Certo, {n}. Pode contar comigo.', 'Faz sentido. Anotado.', 'Sem reclamação. Vamos nessa.', 'Eu cuido disso amanhã cedo.', 'Concordo. O clã vem primeiro.',
      'Se for ordem do {l}, tá feito.', 'Calma, {n}. Primeiro a gente come, depois resolve.', 'Já conferi isso hoje. Tá em ordem.', 'Melhor prevenir. Fico de olho.'],
    comida: ['{c} na medida. Bom pra aguentar a ronda.', 'Come devagar, {n}. A ronda é longa.', 'Nada de sobrar {c} no prato. Comida não se desperdiça.', 'Esse {c} tá no ponto. Obrigado, {l}.', 'Comida quente e o clã junto. Isso que importa.'],
    lider: ['Um brinde ao {l}. Sigo onde ele mandar.', '{l}, pode contar comigo pra qualquer ordem.', 'Com o {l} na cabeceira, a mesa fica em ordem.', 'Obrigado pelo jantar, {l}. Amanhã eu pago em trabalho.', 'Pelo {l} e pela {eu}!'],
  },
  { // 1 brincalhão
    abre: ['{n}, sabe por que o {b} não joga cartas? Porque sempre tem um Imp roubando! Hahaha.', 'Ontem {em_lug} eu escorreguei e caí de cara no barro. O {b} riu de mim, juro.',
      'Se a {r} cozinhasse assim, eles nem brigavam com a gente.', '{n}, você tá com cara de quem perdeu a briga pro {b}.', 'Aposto que o {l} não sabe dançar. Alguém já viu?',
      'Quem roncou mais alto essa noite? Achei que era um {b} na base.', 'Falei com um {b} {em_lug}. Ele não respondeu, mal-educado.', '{n}, cuidado que esse garfo tá afiado. Mais que a sua espada!',
      'Vou contar uma do pessoal da {r}: eles se perdem até na própria base!', 'Tô pensando em abrir uma barraca de piada {em_lug}. Vou ficar rico.', 'Alguém viu minha bota? Acho que um {b} levou.',
      'Juro que vi um {b} usando chapéu {em_lug}.', 'Se rir desse jeito der XP, eu já tô no nível 100.', 'Falaram que {coisa} vai subir. Só sobe o que eu como!'],
    resp: ['Hahaha, essa foi boa!', 'Para, {n}, que eu engasgo!', 'Só você mesmo, {n}.', 'Kkkkk, não acredito.', 'Isso merece um brinde!', 'Vou contar essa pro {l} depois.', 'Rapaz, que história é essa?',
      'Se for mentira, é das boas.', 'Você não presta, {n}. Hahaha.', 'Eu ri, mas não conta pra ninguém.'],
    comida: ['{c} tão bom que eu vou chorar. Brincadeira. Ou não.', 'Se sobrar {c}, é meu, {n}!', 'Esse {c} tá melhor que a comida da {r}. Também, não é difícil.', 'Vou guardar um pouco de {c} no bolso pro {b} de amanhã.', 'Chef {l}! Abre um restaurante!'],
    lider: ['{l}, se cansar de liderar, vira cozinheiro!', 'Um brinde ao {l}, que paga o jantar e aguenta minhas piadas!', 'Ô {l}, conta uma piada também. Ou deixa comigo.', 'Com o {l} aqui até a comida fica mais engraçada.', 'Viva o {l}! E viva o {c}!'],
  },
  { // 2 ambicioso
    abre: ['{n}, um dia eu vou ter meu próprio esquadrão. Guarda o que eu tô falando.', 'Derrubei um {b} sozinho {em_lug} hoje. O {l} precisa saber disso.', 'Se o clã subir de nível, quero ser o primeiro da fila.',
      'Ouvi dizer que tem tesouro {em_lug}. Quem vem comigo?', 'A {r} tá fraca nessa semana. Hora de avançar.', 'Tô juntando ouro pra uma espada melhor. {n}, sabe de alguém vendendo?',
      'Já pensou o clã com castelo, {n}? Eu já tô planejando.', 'Quero falar com o {l} sobre {coisa}. Tenho ideias.', 'Nível alto, peça boa, nome conhecido. Esse é o plano.',
      'Quem domina {lug} domina o comércio. Pensa nisso.', 'Um {b} a menos é um passo a mais.', 'Esse ano eu chego na frente de todo mundo, {n}.', 'Vou ser lembrado {em_lug}. Pode escrever.', 'O {l} vai me dar mais responsabilidade. Eu sinto.'],
    resp: ['Pensa grande, hein, {n}.', 'Calma, primeiro termina o jantar.', 'Se der certo, lembra de mim.', 'Pode ser. Mas tem que ralar muito.', 'Eu vou com você nessa.', 'Gosto da ideia. Fala com o {l}.',
      'Sonhar não custa ouro.', 'Ambição demais dá indigestão, {n}.', 'Tá, mas quem paga a poção?', 'Se for pra crescer o clã, tô dentro.'],
    comida: ['{c} de primeira. Um dia eu pago um banquete desses.', 'Comendo bem hoje, lutando melhor amanhã.', 'Isso aqui é jantar de clã grande. A gente chega lá.', '{c} bom assim dá força pra subir de nível.', 'Guarda a receita, {l}. Vai servir no castelo.'],
    lider: ['{l}, quando precisar de alguém de confiança, me chama primeiro.', 'Um brinde ao {l} e ao clã que vai dominar {lug}!', 'Com o {l} na frente, a {r} que se cuide.', 'Obrigado pela mesa, {l}. Vou retribuir em vitórias.', '{l}, tenho um plano pra {coisa}. Depois a gente conversa.'],
  },
  { // 3 medroso
    abre: ['{n}, você ouviu esse barulho? Acho que é um {b}...', 'Não volto {em_lug} sozinho nem amarrado.', 'E se a {r} atacar agora, no meio do jantar?', 'Treinei escondido de novo. Ainda tremo na hora do golpe.',
      'Sonhei com um {b} do tamanho da base. Acordei suando.', '{n}, amanhã você vai na frente, tá?', 'Dizem que {em_lug} tem coisa pior que {b}.', 'Contei as poções três vezes. Nunca parece suficiente.',
      'Prefiro ficar na horta. Planta não morde.', 'Ainda bem que a base tem cerca. Tem cerca, né?', 'Ouvi a {r} falando de nós. Fiquei com medo.', 'Se eu cair, alguém me levanta?', 'A escuridão {em_lug} me dá arrepio.', 'Tô tentando ser corajoso, {n}. Juro que tô.'],
    resp: ['T-tá bom...', 'Se você diz, {n}, eu acredito.', 'Ai, nem fala isso.', 'Fico perto de você então.', 'Tomara que dê tudo certo.', 'Vou levar poção extra, por via das dúvidas.', 'Eu tento. Prometo que tento.',
      'Só se o {l} for junto.', 'Será? Fiquei nervoso agora.', 'Ufa. Que alívio.'],
    comida: ['{c} quentinho acalma o coração.', 'Comendo assim, quase esqueço o {b} de ontem.', 'Posso repetir o {c}? Ansiedade dá fome.', 'Obrigado, {l}. Aqui na mesa eu me sinto seguro.', 'Se tiver {c} todo dia, eu fico mais corajoso.'],
    lider: ['Com o {l} aqui eu fico tranquilo.', '{l}, obrigado por não me deixar pra trás.', 'Um brinde ao {l}... e que nenhum {b} apareça.', 'O {l} me dá coragem. Um pouquinho, pelo menos.', 'Se o {l} confia em mim, eu também vou confiar.'],
  },
  { // 4 rabugento
    abre: ['{n}, de novo você mastigando de boca aberta.', '{Lug} tá infestado de {b}. Ninguém limpa aquilo nunca.', 'A {r} é um bando de frouxo. E ainda fedem.', 'Quem mexeu no Baú do Clã e não arrumou?',
      'Essa cadeira tá torta. Tudo nessa base tá torto.', '{coisa} de novo? Ninguém aguenta mais.', 'Trabalhei o dia todo e ninguém agradece. Normal.', 'O vento {de_lug} entra até nos ossos.',
      '{n}, sua espada tá cega. Uma vergonha.', 'No meu tempo, um {b} desses a gente derrubava com um soco.', 'Reclamo, mas faço. Alguém tem que fazer.', 'Barulho demais nesse jantar.', 'Se a {r} aparecer, eu mesmo boto pra correr. De mau humor.', 'Quem escolheu esse lugar pra base? Hein?'],
    resp: ['Hunf.', 'Tá, tá, que seja.', 'Grande coisa, {n}.', 'Eu já sabia.', 'Não me enche, {n}.', 'Isso não vai dar certo. Mas eu vou.', 'Falou o especialista.', 'Pff. Come e fica quieto.', 'Tanto faz.', 'Hmm. Pode ser.'],
    comida: ['{c} tá salgado. Mas tá bom. Pronto, falei.', 'Já comi {c} melhor. Mas não lembro onde.', 'Pelo menos não é a gororoba da {r}.', 'Esse {c}... até que dá pro gasto.', 'Não vou repetir. ...Tá, só mais um pouco.'],
    lider: ['{l}, a comida tá boa. Não se acostuma com elogio.', 'O {l} pelo menos aparece. Já é alguma coisa.', 'Um brinde ao {l}. Rápido, que o {c} esfria.', 'Reclamo de tudo, {l}, menos de você. Hoje.', 'Tá certo, {l}. Esse jantar foi uma boa ideia.'],
  },
  { // 5 curioso
    abre: ['{n}, por que será que o {b} {de_lug} é mais bravo?', 'Alguém sabe de onde veio a Névoa?', 'Como a {r} aguenta aquele frio? Ou aquele calor? Nunca entendi.', 'Será que dá pra pescar {em_lug}?',
      '{n}, como você aprendeu a lutar desse jeito?', 'Li uma placa estranha {em_lug}. Quem escreveu aquilo?', 'Por que o Vesper quer tanto essas terras?', 'Se um {b} comer {c}, ele fica mais forte?',
      'Quanto será que vale {coisa} no leilão?', 'Já reparou que a lua fica diferente {em_lug}?', 'O que tem do outro lado do mar, {n}?', 'Como se faz uma espada de cristal?', 'Por que a gente chama de Aethra?', 'Quero ver um dragão de perto. Só de longe. Bem de longe.'],
    resp: ['Boa pergunta, {n}.', 'Nunca tinha pensado nisso.', 'Hmm, acho que sei. Depois te conto.', 'Pergunta pro {l}, ele sabe de tudo.', 'Você e suas perguntas, {n}!', 'Também quero saber.', 'Vamos descobrir juntos?',
      'Dizem que é coisa antiga.', 'Isso daria uma boa aventura.', 'Sei lá. Mas fiquei curioso agora.'],
    comida: ['Que tempero é esse no {c}? Quero aprender.', '{l}, como você fez esse {c}?', 'O {c} da {r} é parecido com esse?', 'Será que dá pra fazer {c} com peixe {de_lug}?', 'Se eu misturar {c} com mel, fica bom?'],
    lider: ['{l}, conta como você começou o clã!', 'Um brinde ao {l}! E depois ele conta uma história.', '{l}, qual foi o {b} mais difícil que você já enfrentou?', 'O {l} já foi até {lug}? Como é lá?', 'Com o {l} sempre se aprende alguma coisa.'],
  },
  { // 6 orgulhoso
    abre: ['{n}, viu como eu derrubei aquele {b}? Um golpe só.', 'Ninguém luta como eu nesse clã. Desculpa, é a verdade.', 'A {r} treme quando ouve meu nome.', '{Em_lug} já me chamam de herói.',
      'Minha espada brilha mais que a sua, {n}.', 'Fiz em uma hora o que vocês fazem em três.', 'Se precisarem, eu resolvo {coisa}. Como sempre.', 'Esse clã tem sorte de me ter.',
      'Um {b} me olhou e saiu correndo. Juro.', 'Quero ver alguém da {r} me encarar.', 'Treino? Eu nasci pronto.', '{n}, quando quiser aprender, é só pedir.', 'Meu nome ainda vai ser cantado {em_lug}.', 'Elogio pra mim é rotina.'],
    resp: ['Claro, como sempre, né?', 'Lá vem você de novo, {n}.', 'Tá, campeão.', 'Ninguém aguenta tanta modéstia.', 'Mostra amanhã então.', 'Se é tão bom, carrega o pack.', 'Hmpf. Veremos.',
      'Eu faria melhor. Talvez.', 'Até o {b} concorda, {n}.', 'Aplausos pra ele. Pronto.'],
    comida: ['{c} digno de um campeão. Ou seja, de mim.', 'Comida boa pra quem luta bem. Eu mereço dois pratos.', 'Esse {c} quase é tão bom quanto meu golpe.', 'Só elogio o que merece. O {c} merece.', 'Na minha vila eu fazia {c} melhor. Mas esse tá bom.'],
    lider: ['{l}, você escolheu bem quando me chamou.', 'Um brinde ao {l}. O segundo melhor desse clã. Brincadeira... ou não.', 'Com o {l} e comigo, a {r} não tem chance.', '{l}, me põe na linha de frente. Você não vai se arrepender.', 'Obrigado pelo jantar, {l}. Combina com a minha grandeza.'],
  },
  { // 7 calmo e gentil
    abre: ['{n}, você se machucou hoje? Deixa eu ver esse braço.', 'Guardei uma poção pra você, {n}.', 'Que bom ter todo mundo junto na mesa.', '{Em_lug} ajudei um viajante perdido. Ele agradeceu tanto.',
      'Se alguém estiver cansado, eu fico de vigia hoje.', 'Até a {r} deve sentir saudade de casa.', '{n}, você tá dormindo bem?', 'Plantei umas flores perto da horta.', 'Briga demais cansa. Hoje é dia de descansar.',
      'O {b} só ataca quando tá com fome. Coitado.', 'Vamos cuidar uns dos outros amanhã.', 'Quem quiser, eu remendo a roupa depois.', 'O céu tá bonito sobre {lug} hoje.', 'Obrigado por cuidarem de mim lá fora.'],
    resp: ['Que gentil, {n}.', 'Obrigado, de coração.', 'Você é um amor, {n}.', 'Fico feliz de ouvir isso.', 'Conta comigo também.', 'Que bom, {n}.', 'Isso aquece mais que a lareira.',
      'Vamos juntos, então.', 'Descansa um pouco, {n}.', 'Eu também me preocupo com você.'],
    comida: ['{c} feito com carinho tem outro gosto.', 'Obrigado, {l}. Tá delicioso.', 'Come mais, {n}. Você trabalhou muito hoje.', 'Guardei um pouco de {c} pra quem chegar atrasado.', 'Comida boa e gente boa. Não precisa de mais nada.'],
    lider: ['Obrigado por cuidar da gente, {l}.', 'Um brinde ao {l}, que nunca deixa ninguém pra trás.', '{l}, descansa também. Você trabalha demais.', 'Que bom te ver na mesa, {l}.', 'Com o {l} aqui, parece família.'],
  },
  { // 8 competitivo
    abre: ['{n}, aposta quem derruba mais {b} amanhã? Conta por cabeça.', 'Ontem eu juntei mais lenha que você. Admite.', 'Quem chegar primeiro {em_lug} ganha o último {c}.', 'Duelo depois do jantar, {n}?',
      'Contei: fiz mais XP que todo mundo essa semana.', 'A {r} acha que é forte. Quero competir com eles.', 'Corrida até o Baú do Clã! Valendo!', 'Quem pescar o maior peixe {em_lug} escolhe o lugar na mesa.',
      '{n}, minha marca é melhor que a sua. Quer conferir?', 'Perdi ontem. Não vai acontecer de novo.', 'Vou bater o recorde de {coisa}.', 'Melhor de três? Braço de ferro?', 'Treino amanhã às seis. Quem chegar depois paga a poção.', 'Ser o segundo não é ruim. É péssimo.'],
    resp: ['Fechado! Vai perder.', 'Aposta aceita, {n}.', 'Você não tem chance.', 'Na próxima eu ganho.', 'Tá com medo, {n}?', 'Valendo o quê?', 'Dessa vez eu vou com tudo.',
      'Só se for agora.', 'Empate não vale!', 'Eu deixei você ganhar. Ontem.'],
    comida: ['Quem terminar o {c} primeiro ganha!', 'Já repeti duas vezes. Ganhei de você, {n}.', '{c} é combustível de campeão.', 'Aposto que como mais {c} que todo mundo.', 'Esse {c} tá valendo medalha, {l}.'],
    lider: ['{l}, quem foi o melhor do clã essa semana? Fala que fui eu.', 'Um brinde ao {l}! Agora aposta comigo quem bebe mais rápido.', '{l}, faz um torneio no clã!', 'Com o {l} julgando, eu ganho fácil.', 'Obrigado pelo jantar, {l}. Amanhã eu bato meta por você.'],
  },
  { // 9 saudoso
    abre: ['{n}, na minha vila a gente comia assim todo domingo.', 'Saudade da minha mãe. Ela fazia um {c} igualzinho.', 'Lá em casa dava pra ver {lug} da janela.', 'Meu avô contava histórias do {b} em volta do fogo.',
      'Um dia eu volto pra visitar minha vila.', 'A {r} queimou a ponte da minha terra. Não esqueço.', '{n}, de onde você veio?', 'Essa mesa me lembra a casa da minha tia.', 'Sinto falta do cheiro do rio de manhã.',
      'Lá em casa a gente cantava depois do jantar.', 'Minha irmã deve estar enorme agora.', 'Quando chove, lembro de casa.', 'Levei uma pedra {de_lug} de lembrança.', 'Aqui no clã a gente virou família, né, {n}?'],
    resp: ['Bonito isso, {n}.', 'Também sinto saudade de casa.', 'Um dia você volta, {n}.', 'Aqui também é sua casa.', 'Conta mais, {n}.', 'Que lembrança boa.', 'Me deu saudade também.',
      'Sua família ia ter orgulho de você.', 'Leva a gente lá um dia.', 'Família é quem senta na mesma mesa.'],
    comida: ['Esse {c} tem gosto de casa.', 'Minha mãe ia gostar desse {c}, {l}.', 'Comer junto assim dá saudade e alegria ao mesmo tempo.', 'Na minha vila esse {c} era comida de festa.', 'Obrigado, {l}. Fazia tempo que não comia assim.'],
    lider: ['{l}, você virou meio que a minha família aqui.', 'Um brinde ao {l}, que trouxe a gente pra essa mesa.', 'Obrigado, {l}. Hoje a saudade ficou menor.', 'Com o {l} na cabeceira, parece jantar de casa.', 'Que a gente sente nessa mesa por muitos anos, {l}.'],
  },
];

// troca as lacunas (vars: n, l, c, r, eu; o resto sorteia de JANTAR_LACUNAS)
export function encherFala(t, vars, rnd = Math.random) {
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    if (vars[k] != null) return vars[k];
    if (k in LUG) { const t = JANTAR_LUGARES[Math.floor(rnd() * JANTAR_LUGARES.length)][LUG[k]]; return k[0] === k[0].toUpperCase() ? t[0].toUpperCase() + t.slice(1) : t; }
    const L = JANTAR_LACUNAS[k];
    return L ? L[Math.floor(rnd() * L.length)] : '';
  });
}
// uma fala do jeito j (0 a 9) do tipo tipo ('abre', 'resp', 'comida', 'lider'), já com as lacunas
// fem: quem fala é moça (recruta g 'f'): "Obrigada", "sozinha", "segura"... (as frases são escritas no masculino)
const FEM = [[/\bObrigado\b/g, 'Obrigada'], [/\bsozinho\b/g, 'sozinha'], [/\bme sinto seguro\b/g, 'me sinto segura'], [/\bcorajoso\b/g, 'corajosa'],
  [/\bnasci pronto\b/g, 'nasci pronta'], [/\beu mesmo\b/g, 'eu mesma'], [/\bo primeiro da fila\b/g, 'a primeira da fila']];
export function falaJantar(j, tipo, vars, rnd = Math.random, fem = false) {
  const J = JANTAR_FALAS[((j | 0) % JANTAR_FALAS.length + JANTAR_FALAS.length) % JANTAR_FALAS.length], l = J[tipo] || J.abre;
  let t = encherFala(l[Math.floor(rnd() * l.length)], vars, rnd);
  if (fem) for (const [a, b] of FEM) t = t.replace(a, b);
  return t[0].toUpperCase() + t.slice(1);
}
// como a comida aparece na fala ({c}): as frases tratam a comida no masculino ("esse {c} tá no ponto"), então cada prato
// tem um nome de cabeça masculina; peixe cru vira "peixe" e legume cru, "refogado de legumes"
const NOME_FALA = { carne_assada: 'assado de carne', sopa_legumes: 'caldo de legumes', pao_milho: 'pão de milho', ensopado: 'ensopado de carne', torta_abobora: 'pedaço de torta de abóbora',
  peixe_assado: 'peixe assado', carne: 'churrasco' };
export function comidaNaFala(k, itens) {
  if (NOME_FALA[k]) return NOME_FALA[k];
  const it = itens?.[k];
  return it?.peixe ? 'peixe' : 'refogado de legumes';
}
// quantas falas diferentes dá para sair (nomes: quantos nomes diferentes de quem ouve; comidas: quantas comidas)
export function totalFalasJantar(nomes = 10, comidas = 15) {
  const op = { n: nomes, l: 1, c: comidas, r: 1, eu: 1, ...Object.fromEntries(Object.entries(JANTAR_LACUNAS).map(([k, v]) => [k, v.length])), ...Object.fromEntries(Object.keys(LUG).map((k) => [k, JANTAR_LUGARES.length])) };
  let total = 0;
  for (const J of JANTAR_FALAS) for (const l of Object.values(J)) for (const t of l) total += (t.match(/\{(\w+)\}/g) || []).reduce((p, m) => p * (op[m.slice(1, -1)] || 1), 1);
  return total;
}
