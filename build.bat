@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist src\00_head.html (node bundle.js || (echo Bundle failed. & pause & exit /b))
if not exist ejstudio.html (echo ejstudio.html is missing from this folder. & pause & exit /b)
call npm i || (pause & exit /b)
echo Running ejLogger engine tests ...
node ejLogger\engine\test\golden.test.js || (echo ejLogger golden test failed. & pause & exit /b)
node ejLogger\engine\test\engine.test.js || (echo ejLogger engine test failed. & pause & exit /b)
call npx electron-builder --win --x64 --dir || (pause & exit /b)
node seticon.js || (pause & exit /b)
echo.
echo Running self-test against tests\fixtures ...
if exist selftest.txt del /q selftest.txt
echo (this takes up to a minute)
start "" /wait "dist\win-unpacked\ejStudio.exe" "--selftest=%~dp0tests\fixtures" "--out=%~dp0selftest.txt"
set ST=%errorlevel%
if exist selftest.txt (type selftest.txt) else (echo The self-test produced no report.)
if not "%ST%"=="0" (echo. & echo Self-test failed. No installer was built. & pause & exit /b)
echo.
if exist dist\*.exe del /q dist\*.exe
call npx electron-builder --win --x64 --prepackaged dist/win-unpacked
echo.
echo Done: the ejStudio-Setup installer is in the dist folder
pause
