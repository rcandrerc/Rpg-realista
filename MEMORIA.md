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
1. Medir. 2. Personagens leves. 3. Mundo leve, sem travadas (OOM no S9). 4. Visual com fotos antes/depois, só com OK.

## Abortado (não retomar sem pedido)
Cecília/Dário, segurança, história/missões, economia/lojas.

## Rotinas
- Robô de testes: ronda diária às 9h, um relatório entre 9h e 10h, correção automática com cuidado.
- Não reduzir bots/recrutas (André quer 50-60 bots para medir o servidor).

## Fluxo
- Agentes efêmeros por cargo: ver `agentes/` e a regra no topo do `CLAUDE.md`.
- Todo merge: PR, main mais recente, verificação verde, nada some.

## Feito
- 23/11: "Ver" o recruta: animação, sombra e magia contam a partir dele (`centro_visao`); "Ver no mapa" com ponto dele.
- 23/11: personagens leves 1: corpo novo de jogador/NPC instanciado em segundo plano (online.gd _pedir_fundo); no máx. 2 NPCs aparecem/somem por quadro (li:npc_mostrar).
- 23/11: botão "Trocar alvo" (4 camadas: quem te bateu 5 s > PK no alcance > monstro > espantalho); sem tocar, alvo igual.

## Próximas tarefas: medição de desempenho -> personagens leves -> mundo leve -> visual.
