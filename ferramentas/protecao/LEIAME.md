# Nada some

Proteção para uma atualização não apagar o que já estava no jogo (regra do André).

## Trava geral (vale para tudo, sem lista)

`nada-some.mjs` compara o ramo com a main e falha se algo que já existe some ou é trocado:

- arquivo apagado (código, cena, dado, imagem, som, modelo);
- asset trocado (imagem, som, modelo 3D ou textura com conteúdo novo: o antigo some);
- função, constante, sinal, classe, método, ação de botão (`.gd`, `.js`), mensagem do servidor;
- nó de cena (`.tscn`), uniform de shader;
- chave de dados (`.json`, `.json.gz`, tabelas do `shared/dados.js`).

Se a definição só mudou de arquivo, não conta. Arquivos que mudam a cada versão (`.apk`, `.import`, `.uid`, `package-lock.json`) ficam de fora.

Quando o André pede para tirar ou trocar algo, o PR leva a etiqueta **`remoção aprovada`** e cita o pedido dele na descrição. Sem a etiqueta, o CI barra.

## Outras conferências

- O ramo do PR precisa ter a main mais nova (o CI confere).
- `recursos.json` + `conferir.mjs`: trechos de comportamentos importantes que precisam continuar no código.
- `antes-do-apk.sh`: rodar antes de gerar APK para o André; roda tudo acima.

O workflow `.github/workflows/protecao.yml` ("Nada some") roda em todo PR e em todo push na main.
