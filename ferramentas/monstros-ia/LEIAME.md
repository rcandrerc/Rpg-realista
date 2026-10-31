# Monstros feitos por IA

Receita do lobo (client/public/assets/monstros/lobo.glb), feita toda na nuvem:

1. `gerar.py` — desenho com FLUX.1-schnell (Apache 2.0) e modelo 3D com TRELLIS (MIT), pelos Spaces do Hugging Face.
   Precisa de `HF_TOKEN` (conta grátis, chave "Read"). Sai ~10 mil triângulos e textura 1024.
2. `rig.py` (Blender 4.2) — acerta a proporção (tronco mais comprido e largo, pernas 15% mais curtas: função `F`),
   esqueleto de quadrúpede (25 ossos, rabo com 5) e pesos por distância aos ossos.
   A malha do TRELLIS não é fechada, então os pesos automáticos do Blender falham; as posições dos ossos foram medidas no lobo.
   Também cria as mechas do rabo: cartões inclinados para trás com textura recortada (`pelo_tex.py` desenha os fios
   com as cores do rabo, que `cor_rabo.py` mede na textura).
3. `anim.py` — animações feitas por código: parado, andar, correr, atacar, dano, morrer. O rabo é uma corrente:
   cada osso segue o anterior com atraso e balança mais na ponta. No jogo, `montaria.js` ainda põe uma mola quando o lobo vira.
4. `clarear.py` — clareia a textura e separa os olhos numa textura de brilho (pedido da direção de arte).
5. `exportar.py` — GLB final (textura JPEG, mechas PNG com alfa, brilho dos olhos, animações). `mascara.py` troca o alfa
   das mechas para recorte (MASK), que o Blender 4.2 exporta como BLEND. `render.py` faz a folha de conferência.

```
blender -b --python cor_rabo.py   # precisa de lobo_rig.blend e tex_clara.png na pasta; grava cor_rabo.json
python3 pelo_tex.py cor_rabo.json pelo.png
blender -b --python rig.py -- modelo.glb pelo.png lobo_rig.blend
blender -b --python anim.py -- lobo_rig.blend lobo_anim.blend
python3 clarear.py textura.png cor.png brilho.png
blender -b --python exportar.py -- lobo_anim.blend cor.jpg brilho.png lobo.glb
python3 mascara.py lobo.glb
```

Para outro bicho, o que muda é o dicionário de ossos em `rig.py` (medido no modelo novo) e os movimentos em `anim.py`.
