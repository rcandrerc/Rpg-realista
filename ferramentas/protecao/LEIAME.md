# Proteção

Regra do André (2026-11-04): sem trava no CI. Todo PR novo, antes do merge, busca a main mais nova, junta no ramo e se adequa a ela, sem sobrepor o trabalho de ninguém.

- `antes-do-apk.sh`: rodar antes de gerar APK para o André; para se o ramo não tem a main mais nova.
- Scripts antigos da trava "Nada some" (tirada do CI a pedido do André), para rodar à mão se quiser:
  - `nada-some.mjs`: lista o que o ramo apaga ou troca em relação à main.
  - `conferir.mjs` + `recursos.json`: confere trechos de comportamentos importantes.
