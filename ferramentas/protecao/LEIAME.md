# Main em dia

Regra do André (2026-11-04): antes de dar merge, o ramo do PR precisa ter a main mais nova dentro, para ninguém sobrepor o trabalho de outro.

- O workflow `.github/workflows/protecao.yml` ("Main em dia") roda em todo PR e falha se o ramo está atrás da main, mostrando quais commits da main faltam (e de quem são).
- Quando a main recebe um commit novo, ele confere de novo todos os PRs abertos e marca vermelho quem ficou para trás.
- Para consertar: junte a main no ramo (ou rebase), resolva os conflitos mantendo os dois lados e mande de novo.
- `antes-do-apk.sh`: rodar antes de gerar APK para o André; para se o ramo não tem a main mais nova.

## Trava antiga "Nada some" (tirada do CI)

O André pediu para tirar a trava "Nada some" em 2026-11-04. Os scripts continuam aqui e podem ser rodados à mão:

- `nada-some.mjs`: compara o ramo com a main e lista o que foi apagado ou trocado (arquivo, asset, função, nó de cena, chave de dados).
- `conferir.mjs` + `recursos.json`: confere trechos de comportamentos importantes.
