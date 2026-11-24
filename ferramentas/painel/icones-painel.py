# Ícones dos itens do painel do clã (client/public/painel-icones/): os pintados do jogo (godot-prototipo/icones/itens) em
# 64 px, e o Fragmento de Alma (o jogo não tem pintura): o cristal na cor da raça. Rodar de novo quando entrar ícone novo.
import os
from PIL import Image, ImageOps
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
src = os.path.join(RAIZ, 'godot-prototipo/icones/itens/'); out = os.path.join(RAIZ, 'client/public/painel-icones/')
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith('.png') and not f.endswith('_fora.png'):
        Image.open(src + f).convert('RGBA').resize((64, 64), Image.LANCZOS).save(out + f, optimize=True)
c = Image.open(src + 'cristal.png').convert('RGBA').resize((64, 64), Image.LANCZOS)
for k, escuro, cor in [('alma_geada', '#081420', '#7fd3ff'), ('alma_chama', '#1a0e08', '#ff8a4a')]:
    t = ImageOps.colorize(ImageOps.grayscale(c), escuro, cor).convert('RGBA'); t.putalpha(c.split()[3]); t.save(out + k + '.png', optimize=True)
print(len(os.listdir(out)), 'ícones', sum(os.path.getsize(out + f) for f in os.listdir(out)) // 1024, 'KB')
print(sorted(f[:-4] for f in os.listdir(out)))
