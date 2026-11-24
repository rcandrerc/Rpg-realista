# MEMORIA (estado do projeto, máx 30 linhas)
Repo público: nunca pôr senha, chave ou endereço de servidor aqui.
## Jogo
- Age of Embers, mundo Aethra, vilão Vesper. APK Android 10+ 64-bit. Mapa sem mudanças.
- Sem classe (estilo pela arma). Uma linha de armadura, sem mithril. Herói VRoid "Ruiva".
- Servidor decide o combate (`shared/simulacao.js`); conteúdo em `shared/dados.js`.
- Câmera lenta/congelada do golpe removida pelo irmão: nunca religar.
- Clãs (até 10 recrutas; clã Nv 1 a 10, Nv 2-3 sem alma, 4-10 alma crescente, base para no Castelo Nv 6), base/fazenda do clã e arena PvP 4x4 entram desde 20/11.
- Estratégia (23/11): luta de clãs. André lidera; recrutas pagos (taxa + semanal) obedecem cegamente e só respondem. Jogadores nascem Chama; clãs bot líderes são Geada. Clãs bot (23/11): Geada = Gael (Lobos) e Kael (Lâminas Cinzentas); Chama = Dario. Líderes nunca saem; Configurações > Ajustes (só conta do André): "Resetar partida" (ele e líderes personagem novo Nv1, clãs Nv1 sem recrutas, bases somem; missões ficam) e "Resetar missões". Feito: nunca voltar ao jogo de antes de 20/11.
## Foco único até 30/11: desempenho e gráfico
1. Medir. 2. Personagens leves (23/11: máx. 2 NPCs aparecem/somem por quadro; instanciar corpo em linha de fundo deu erro de RID, não usar). 3. Mundo leve, sem travadas (OOM no S9). 4. Visual com fotos antes/depois, só com OK.
## Abortado (não retomar sem pedido): Cecília/Dário, segurança, história/missões, economia/lojas.
## Rotinas
- Robô de testes: ronda diária às 9h, um relatório entre 9h e 10h, correção automática com cuidado. Não reduzir bots/recrutas (André quer 50-60 bots para medir o servidor).
## Fluxo
- Agentes efêmeros por cargo: ver `agentes/` e a regra no topo do `CLAUDE.md`.
- Todo merge: PR, main mais recente, verificação verde, nada some. Testes (23/11, 110 verdes): o jeito antigo dos bots (amizade, time) importa `_amizade-antiga.mjs`; casa de bot na base via `_lote-base.mjs`; save dos bots em `npcSalvos` (tabela mundo).
## Feito
- 23/11: armadura v5 (`LINHA_V5`, `roupa_v5.gdshader`): patrulha ou roupão para moça e rapaz (Aparência > Traje, `aparencia.traje`; padrão moça patrulheira, rapaz roupão); cor de Roupa/Calça da Aparência pinta o pano (`tingir_v5`); capuz entra na gola com cordão. Linha antiga fica atrás da flag.
- 23/11: Traje "Patrulheiro 2"/"Roupão 2" = peças feitas à mão na thread de arte (`equip2.gd`, `res://equip2/*.glb`, 2 corpos, 5 raridades), com espada e cajado novos na raridade da arma; para o André comparar com a v5 do irmão. Aparência > "Raridade do visual" (`aparencia.raridade`, `Armadura.visual`): todas as peças vestidas aparecem em Comum..Mítico, seja qual for a do item; "Do item" = a real.
- 23/11: "Ver" o recruta (`centro_visao`, "Ver no mapa"). Botão "Trocar alvo" (4 camadas: quem te bateu 5 s > PK no alcance > monstro > espantalho); sem tocar, alvo igual.
- 23/11: líder bot comanda o clã a cada 15 min pelo que falta (grind/material/alma/proteger/fazenda), peso da personalidade (Gael agressivo, Dario construtor), recruta de clã bot caça até 2 h/dia com XP real (`CLAS_NPC_ORDENS`). Recrutas do André: online sem limite, offline 0,25 nv/h (sem mudança). Membros antigos (Kira, Rufo, Lis, Cecília, Lia) viraram recrutas do líder; líder sobe o clã com a mochila também; amigos: dos bots só o líder de clã da sua raça.
- 23/11: ficha do recruta (`FICHA_RECRUTA`): jeito, preferência espada/meio/magia (pontos INT x FOR), coragem, cuidado; 3 candidatos no Recrutador; líder bot escolhe pelo jeito; perfil na janela de equipamento; jogador preenche a dele (opcional, aba Status).
- 23/11: Proteger > Carrinho / Mercante (painel do clã): ataca o que chega a 12 m, larga a 15 m (não persegue), roda de 3 m; no mercante fica no convés (`CLA.protegeVeiculo`). Bot a bordo vai na foto com o lugar no navio (`bd`, `fotoBordo`) e o app prende ele no navio da tela (`_no_conves`): sem tremor.
- 23/11: Pack pela barra do time (`PACK_TIME`): "Time todo" + Pack De (palete/chão, carrinho, mercante) → Pra (carrinho, mercante, palete/chão, mercador); bot anda cada trecho (2,2 m do carrinho), entrega põe ouro no cofre do clã.
- 23/11: aba "Missão do Clã" (Escolta) ao lado de História/Diárias/Guilda; "Fixar no atalho" em toda missão (história, diária, guilda, clã): o cartão da tela mostra a fixada (`missao_ativa.fixa`, guardada no aparelho); Escolta em andamento passa na frente.
- 23/11: cor livre também no Patrulheiro 2 / Roupão 2: Roupa/Calça da Aparência pintam só o pano (`Equip2.tingir`, tipo 2). 24/11: Roupa e Calça em abas na Aparência (4 trajes); Patrulheiro 2/Roupão 2 refeitos na linha do corpo afinado do jogo (`ferramentas/trajes-justos/`: o jogo afina cintura/blusa/manga, os .glb eram do corpo cru). André aprovou pelas fotos.
- 23/11: história x clãs: Kael (líder da Geada) é rival, nunca aliado (h14, e6 com a Elara, f1, f2, cenas, diário); "A base do clã" (a12: fundar clã e base, ev `base`) e "Uma base que aguenta" (b1: cerca, tocha, baú, cama, fornalha, bigorna, taxa no cofre `cofre`), sem casa. 24/11: Ato do Clã (k1 recruta Nv 12, k2 escolta Nv 18, k3 clã Nv 2 Nv 25, k4 fim da Trégua Nv 30; ev recrutar/escolta/cla_nivel/guerra_matar).
- 24/11 (PR aberto, aguarda OK do André pelas fotos): aura azul incandescente da arma pelo reforço (`brilho_reforco.gdshader`, `Armas.brilho_reforco`, línguas de fogo e fumaça de aura `Armas.faiscas`): tom de azul por faixa de +10, força pelo +N.
- 24/11: comida não dá vigor; dá buff (`ITENS[k].buff`, um por vez, morrer tira, `bonusComida`). Vigor máximo +1 por nível sem teto (`vigorMax`, `prog.vigor.m`; jogador e recruta); cama não dá vigor (`CAMA.vigor` 0).
