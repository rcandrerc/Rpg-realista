# MEMORIA (estado do projeto, máx 30 linhas)
Repo público: nunca pôr senha, chave ou endereço de servidor aqui.
## Jogo
- Age of Embers, mundo Aethra, vilão Vesper. APK Android 10+ 64-bit. Mapa sem mudanças.
- Sem classe (estilo pela arma). Uma linha de armadura, sem mithril. Herói VRoid "Ruiva".
- Servidor decide o combate (`shared/simulacao.js`); conteúdo em `shared/dados.js`.
- Câmera lenta/congelada do golpe removida pelo irmão: nunca religar.
- Clãs (até 6 recrutas), base/fazenda do clã e arena PvP 4x4 entram desde 20/11.
- Estratégia (23/11): luta de clãs. André lidera; recrutas pagos (taxa + semanal) obedecem cegamente e só respondem. Jogadores nascem Chama; clãs bot líderes são Geada. Quantos clãs bot de cada lado: sem regra ainda (André decide conforme entrarem jogadores; não mexer). Feito: nunca voltar ao jogo de antes de 20/11.

## Foco único até 30/11: desempenho e gráfico
1. Medir. 2. Personagens leves (23/11: máx. 2 NPCs aparecem/somem por quadro; instanciar corpo em linha de fundo deu erro de RID, não usar). 3. Mundo leve, sem travadas (OOM no S9). 4. Visual com fotos antes/depois, só com OK.

## Abortado (não retomar sem pedido)
Cecília/Dário, segurança, história/missões, economia/lojas.

## Rotinas
- Robô de testes: ronda diária às 9h, um relatório entre 9h e 10h, correção automática com cuidado. Não reduzir bots/recrutas (André quer 50-60 bots para medir o servidor).

## Fluxo
- Agentes efêmeros por cargo: ver `agentes/` e a regra no topo do `CLAUDE.md`.
- Todo merge: PR, main mais recente, verificação verde, nada some.

## Feito
- 23/11: armadura v5 (`LINHA_V5`, `roupa_v5.gdshader`): Aparência > Traje Patrulheiro/Roupão nos dois corpos (`aparencia.traje`: null = padrão do corpo, moça patrulheira, rapaz roupão; rapaz patrulheiro com túnica curta); capuz entra na gola com cordão. Linha antiga fica atrás da flag.
- 23/11: "Ver" o recruta (`centro_visao`, "Ver no mapa"). Botão "Trocar alvo" (4 camadas: quem te bateu 5 s > PK no alcance > monstro > espantalho); sem tocar, alvo igual.
- 23/11: líder bot comanda o clã a cada 15 min pelo que falta (grind/material/alma/proteger/fazenda), peso da personalidade (Gael agressivo, Dario construtor), recruta de clã bot caça até 2 h/dia com XP real (`CLAS_NPC_ORDENS`). Recrutas do André: online sem limite, offline 0,25 nv/h (sem mudança). Membros antigos (Kira, Rufo, Lis, Cecília, Lia) viraram recrutas do líder; líder sobe o clã com a mochila também; amigos: dos bots só o líder de clã da sua raça.
- 23/11: ficha do recruta (`FICHA_RECRUTA`): jeito, preferência espada/meio/magia (pontos INT x FOR), coragem, cuidado; 3 candidatos no Recrutador; líder bot escolhe pelo jeito; perfil na janela de equipamento; jogador preenche a dele (opcional, aba Status).
- 23/11: Proteger > Carrinho / Mercante (painel do clã): ataca o que chega a 12 m, larga a 15 m (não persegue), roda de 3 m; no mercante fica no convés (`CLA.protegeVeiculo`).
## Próximas tarefas: medição de desempenho -> personagens leves -> mundo leve -> visual.
