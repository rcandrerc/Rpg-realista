# Ícones dos itens do painel do clã (client/public/painel-icones/): os pintados do jogo (godot-prototipo/icones/itens) em
# 64 px (o Fragmento de Alma sai do alma-icone.py: fumaça espiritual, não cristal). Rodar de novo quando entrar ícone novo.
import os
from PIL import Image
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
src = os.path.join(RAIZ, 'godot-prototipo/icones/itens/'); out = os.path.join(RAIZ, 'client/public/painel-icones/')
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith('.png') and not f.endswith('_fora.png'):
        Image.open(src + f).convert('RGBA').resize((64, 64), Image.LANCZOS).save(out + f, optimize=True)
print(len(os.listdir(out)), 'ícones', sum(os.path.getsize(out + f) for f in os.listdir(out)) // 1024, 'KB')
print(sorted(f[:-4] for f in os.listdir(out)))
