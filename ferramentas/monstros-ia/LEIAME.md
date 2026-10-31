# Monstros feitos por IA

Receita do lobo (client/public/assets/monstros/lobo.glb), feita toda na nuvem:

1. `gerar.py` — desenho com FLUX.1-schnell (Apache 2.0) e modelo 3D com TRELLIS (MIT), pelos Spaces do Hugging Face.
   Precisa de `HF_TOKEN` (conta grátis, chave "Read"). Sai ~10 mil triângulos e textura 1024.
2. `rig.py` (Blender 4.2) — esqueleto de quadrúpede (22 ossos) e pesos por distância aos ossos.
   A malha do TRELLIS não é fechada, então os pesos automáticos do Blender falham; as posições dos ossos foram medidas no lobo.
3. `anim.py` — animações feitas por código: parado, andar, correr, atacar, dano, morrer.
4. `clarear.py` — clareia a textura e separa os olhos numa textura de brilho (pedido da direção de arte).
5. `exportar.py` — GLB final (textura JPEG, brilho dos olhos, animações). `render.py` faz a folha de conferência.

```
blender -b --python rig.py -- modelo.glb lobo_rig.blend
blender -b --python anim.py -- lobo_rig.blend lobo_anim.blend
python3 clarear.py textura.png cor.png brilho.png
blender -b --python exportar.py -- lobo_anim.blend cor.png brilho.png lobo.glb
```

Para outro bicho, o que muda é o dicionário de ossos em `rig.py` (medido no modelo novo) e os movimentos em `anim.py`.
