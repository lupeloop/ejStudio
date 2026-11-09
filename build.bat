@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist src\00_head.html (node bundle.js || (echo Bundle failed. & pause & exit /b))
if not exist ejstudio.html (echo ejstudio.html is missing from this folder. & pause & exit /b)
call npm i || (pause & exit /b)
call npx electron-builder --win --x64 --dir || (pause & exit /b)
node seticon.js || (pause & exit /b)
echo.
if exist dist\*.exe del /q dist\*.exe
call npx electron-builder --win --x64 --prepackaged dist/win-unpacked
echo.
echo Done: the ejStudio-Setup installer is in the dist folder
pause
