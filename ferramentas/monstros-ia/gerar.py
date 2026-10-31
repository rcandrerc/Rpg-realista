# Gera um monstro por IA no Hugging Face: desenho (FLUX.1-schnell, Apache 2.0) -> 3D (TRELLIS, MIT).
# Precisa de HF_TOKEN (conta grátis, chave só de leitura). Uso: python3 gerar.py "descrição em inglês" saida/
import os, shutil, sys
from gradio_client import Client, handle_file

desc, pasta = sys.argv[1], sys.argv[2]
os.makedirs(pasta, exist_ok=True)
tok = os.environ['HF_TOKEN']
flux = Client('black-forest-labs/FLUX.1-schnell', token=tok)
img, _ = flux.predict(prompt=f'full body 3D game character concept of {desc}, stylized anime cel-shaded Genshin Impact style, '
                      'single creature, side three-quarter view, entire body visible, plain white background, no shadow, centered',
                      seed=21, randomize_seed=False, width=1024, height=1024, num_inference_steps=4, api_name='/infer')
shutil.copy(img, f'{pasta}/desenho.webp')
tr = Client('trellis-community/TRELLIS', token=tok)
tr.predict(api_name='/start_session')
pre = tr.predict(image=handle_file(img), api_name='/preprocess_image')
_, glb, _ = tr.predict(image=handle_file(pre), multiimages=[], seed=1, ss_guidance_strength=7.5, ss_sampling_steps=12,
                       slat_guidance_strength=3, slat_sampling_steps=12, multiimage_algo='stochastic',
                       mesh_simplify=0.95, texture_size=1024, api_name='/generate_and_extract_glb')
shutil.copy(glb, f'{pasta}/modelo.glb')
print('pronto:', pasta)
