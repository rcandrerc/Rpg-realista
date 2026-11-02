# Nada some

Proteção para uma atualização não apagar o que já estava no jogo.

- `recursos.json`: lista de recursos já entregues, cada um com um arquivo e trechos que precisam continuar lá.
- `conferir.mjs`: confere a lista (`node ferramentas/protecao/conferir.mjs --main`).
- `antes-do-apk.sh`: rodar antes de gerar um APK; falha se o ramo está atrás da main ou se algo sumiu.
- O workflow `.github/workflows/protecao.yml` ("Nada some") roda os dois em todo PR e em todo push na main.

Recurso novo: acrescente uma linha na lista no mesmo PR. Tirar ou mudar uma linha só quando o André pedir.
