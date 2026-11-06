#!/usr/bin/env bash
# Prepara godot-prototipo/ para exportar a versão PC (Windows .exe). Roda SÓ no build do PC (.github/workflows/pc.yml),
# numa cópia de trabalho descartável: nada daqui vai para o git nem para o APK do celular.
#
#  - texturas também no formato de PC (S3TC/BPTC). O celular continua só com ETC2/ASTC (project.godot da main).
#  - se a placa não tem Vulkan/D3D12, cai sozinho para OpenGL 3 (e o zip leva Aethra-OpenGL.bat para forçar).
#  - nome da janela "Aethra", janela maximizada.
#  - controles de teclado e mouse (ferramentas/pc/controles_pc.gd) como autoload.
#  - preset de exportação "Windows" (ferramentas/pc/preset-windows.cfg) no fim do export_presets.cfg.
#  - sem [aethra] atualizacao/base: o .exe abre direto com o jogo que traz dentro (inicio.gd, base vazia);
#    as atualizações do celular são pacotes com textura de celular, não servem no PC. Versão nova = .exe novo.
set -euo pipefail
cd "$(dirname "$0")/../../godot-prototipo"

[ -f project.godot ] || { echo "project.godot não encontrado"; exit 1; }
if grep -q 'ControlesPC=' project.godot; then
  echo "já preparado"; exit 0
fi

cp ../ferramentas/pc/controles_pc.gd controles_pc.gd

# insere a linha logo depois do cabeçalho da seção
pos_secao() { sed -i "/^\[$1\]\$/a $2" project.godot; }
grep -q '^\[rendering\]$' project.godot || printf '\n[rendering]\n' >> project.godot
grep -q '^\[display\]$' project.godot || printf '\n[display]\n' >> project.godot
pos_secao rendering 'textures/vram_compression/import_s3tc_bptc=true'
# placa de vídeo sem Vulkan nem Direct3D 12 (PC mais antigo): abre em OpenGL 3 sozinho, e se nem isso, ANGLE (D3D11)
pos_secao rendering 'rendering_device/fallback_to_opengl3=true'
pos_secao rendering 'rendering_device/fallback_to_d3d12=true'
pos_secao rendering 'gl_compatibility/fallback_to_angle=true'
pos_secao display 'window/size/mode=2'
sed -i 's/^config\/name=.*/config\/name="Aethra"/' project.godot
printf '\n[autoload]\n\nControlesPC="*res://controles_pc.gd"\n' >> project.godot

N=$(grep -c '^\[preset\.[0-9]*\]$' export_presets.cfg)
sed "s/preset\.N/preset.$N/g" ../ferramentas/pc/preset-windows.cfg >> export_presets.cfg
echo "pronto: preset Windows = preset.$N"
