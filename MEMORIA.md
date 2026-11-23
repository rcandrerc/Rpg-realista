# MEMORIA (estado do projeto, máx 30 linhas)
Repo público: nunca pôr senha, chave ou endereço de servidor aqui.

## Jogo
- Age of Embers, mundo Aethra, vilão Vesper. APK Android 10+ 64-bit. Mapa sem mudanças.
- Sem classe (estilo pela arma). Uma linha de armadura, sem mithril. Herói VRoid "Ruiva".
- Servidor decide o combate (`shared/simulacao.js`); conteúdo em `shared/dados.js`.
- Câmera lenta/congelada do golpe removida pelo irmão: nunca religar.
- Clãs (até 6 recrutas), base/fazenda do clã e arena PvP 4x4 entram desde 20/11.

## Foco único até 30/11: desempenho e gráfico
1. Medir o desempenho. 2. Personagens mais leves. 3. Mundo mais leve, sem travadas (inclui OOM no S9).
4. Visual com fotos antes/depois no jogo, só com OK do André.

## Abortado (não retomar sem pedido)
Cecília/Dário, segurança, história/missões, economia/lojas.

## Rotinas
- Robô de testes: ronda diária às 9h, um relatório entre 9h e 10h, correção automática com cuidado.
- Não reduzir bots/recrutas (André quer 50-60 bots para medir o servidor).

## Fluxo
- Agentes efêmeros por cargo: ver `agentes/` e a regra no topo do `CLAUDE.md`.
- Todo merge: PR, main mais recente, verificação verde, nada some.

## Feito
- 23/11: criada a estrutura enxuta (MEMORIA.md + agentes/).

## Próximas tarefas
- Medição de desempenho -> personagens leves -> mundo leve -> visual.
