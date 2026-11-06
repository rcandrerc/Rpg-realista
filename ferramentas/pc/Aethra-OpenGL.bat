@echo off
rem Abre o Aethra no modo OpenGL 3, para placas de video sem Vulkan nem Direct3D 12.
cd /d "%~dp0"
start "" "Aethra.exe" --rendering-driver opengl3
