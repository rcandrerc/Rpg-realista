# Galope do cavalo no lobo

Pedido do André (2026-11-05): a corrida do lobo (feita por código em `../anim.py`) parecia de robô. O cavalo
anão do Quimera (`px/cavalo_n.glb` do repositório Quimera_Sandbox; é o cavalo do pack Ultimate Animated Animals da
Quaternius, CC0) tem um galope feito à mão, e ele foi passado para o esqueleto do lobo.

```
python3 rabo_pesos.py lobo.glb lobo_base2.glb   # pesos do rabo (antes, o rabo virava um espinho no galope)
blender -b --python galope_cavalo.py -- Gallop galope galope.blend
blender -b --python exportar_clipe.py -- galope.blend galope galope_tmp.glb
python3 juntar_clipe.py lobo_base2.glb galope_tmp.glb lobo_novo.glb galope=correr_cavalo
```

O `lobo.glb` do jogo (`client/public/assets/monstros/`) ganhou o clipe `correr_cavalo`; os clipes antigos continuam lá.
No app (Godot), `client/exportar-bestiario-godot.html` usa `correr_cavalo` como `corrida` (lobo de caça e montaria)
e guarda a corrida antiga como `corrida_antiga`. O jogo HTML continua com a corrida antiga.

Os números do galope usados no jogo estão no começo de `galope_cavalo.py`.
