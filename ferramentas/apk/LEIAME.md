# APK do app Godot

O APK é gerado sozinho pelo GitHub Actions (`.github/workflows/apk.yml`):

- **Em todo push na main** que mexe no app: gera o APK e publica no release **apk**.
  Link para baixar no celular (precisa estar logado no GitHub, o repositório é privado):
  https://github.com/rcandrerc/Rpg-realista/releases/download/apk/rpg-realista.apk
- **Em pull request**: gera o APK para testar antes do merge (fica em Actions → a execução → Artifacts).

O que o build faz: sobe o site em modo dev (vite), exporta a vila, os personagens e os monstros com o Chromium
(`client/exportar-godot/gerar-modelos.mjs`; a pasta `godot-prototipo/modelos/` não vai para o git), baixa o
Godot 4.5 e exporta o APK com o modelo de compilação Android (Gradle).

## Chave de assinatura (uma vez só)

O Android só instala uma atualização por cima se ela vier assinada com a mesma chave. A chave fica nos Secrets do
repositório, nunca no código:

1. No computador (precisa do Java): `keytool -genkeypair -keystore rpg.keystore -alias rpg -keyalg RSA -keysize 2048 -validity 10000`
2. `base64 -w0 rpg.keystore` (no Mac: `base64 -i rpg.keystore`) e copie o texto.
3. GitHub → Settings → Secrets and variables → Actions → New repository secret:
   `ANDROID_KEYSTORE_BASE64` (o texto), `ANDROID_KEYSTORE_SENHA` (a senha) e `ANDROID_KEYSTORE_ALIAS` (`rpg`).
4. Guarde o `rpg.keystore` e a senha num lugar seguro (sem eles não dá para atualizar o app na Play Store depois).

Sem esses secrets o build ainda funciona, mas cria uma chave nova a cada vez: para instalar um APK novo é preciso
desinstalar o anterior antes. O primeiro APK do Actions também não instala por cima do APK antigo do repositório
(outra chave): desinstale o app antigo uma vez.
