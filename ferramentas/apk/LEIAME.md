# APK do app Godot

O APK é gerado sozinho pelo GitHub Actions (`.github/workflows/apk.yml`):

- **Em todo push na main** que mexe no app: gera o APK e publica no release **apk**.
  Link para baixar no celular (precisa estar logado no GitHub, o repositório é privado):
  https://github.com/rcandrerc/Rpg-realista/releases/download/apk/rpg-realista.apk
- **Em pull request**: só gera o APK de teste se o PR tiver a etiqueta `gerar apk` (ou rodando à mão em Actions → APK do app Godot → Run workflow, no ramo do PR). Fica em Actions → a execução → Artifacts. Antes gerava em todo push de todo PR e a cota do Actions de novembro acabou em 3 dias.

O que o build faz: sobe o site em modo dev (vite), exporta a vila, os personagens e os monstros com o Chromium
(`client/exportar-godot/gerar-modelos.mjs`; a pasta `godot-prototipo/modelos/` não vai para o git), baixa o
Godot 4.5 e exporta o APK com o modelo de compilação Android (Gradle).

## Chave de assinatura (uma vez só)

O APK tem que sair sempre com a **chave oficial** do app (`prototipo.keystore`, alias `prototipo`), a mesma cadastrada
no Google Cloud. Com outra chave o login Google não abre e o celular não instala por cima. A chave e a senha estão no
repositório privado New-Game-Anime-fontes, em `chaves/android/` (LEIAME de lá). Para o build daqui usar a chave,
cadastre em Settings → Secrets and variables → Actions → New repository secret:

- `ANDROID_KEYSTORE_BASE64`: o arquivo `prototipo.keystore` em texto (`base64 -w0 prototipo.keystore`; no Mac
  `base64 -i prototipo.keystore`; no Windows `certutil -encode prototipo.keystore saida.txt` e copie o texto do meio,
  sem as linhas BEGIN/END).
- `ANDROID_KEYSTORE_SENHA`: a senha da chave.
- `ANDROID_KEYSTORE_ALIAS`: `prototipo`.

Sem esses secrets o build ainda roda (para conferir que nada quebrou), mas assina com uma chave descartável e **não
publica** no release. O log do passo "Exportar o APK" mostra o SHA-1: o certo é `08:B6:1B:...:0D:CC`.

## Por que o build às vezes demora mais (modelos)

Os modelos (vila, personagens, monstros, minimapa) saem do Chromium e levam ~6 min. Eles ficam no cache e só são
exportados de novo quando muda algo que eles usam. Quem decide é `chave-modelos.mjs`: entra o que a exportação
carrega do `client/`, os arquivos de `shared/` de mapa, relevo, rochas e terreno, e de `shared/dados.js` só os
valores que a exportação importa (MAPA_CLAREIRA, A, CRIADOR...). Mudança só em regra do servidor
(`shared/simulacao.js`), em `progresso.js` ou em tela/menu do client não refaz os modelos. Para ver o que entra:
`node ferramentas/apk/chave-modelos.mjs --lista`.

Na main, um merge novo não cancela mais o build que está rodando: ele espera na fila e roda logo depois.
