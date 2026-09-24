@echo off
rem Double-click to test the portal build in dist\ in your browser.
rem Serves it at http://127.0.0.1:4174/ the same way the portal does; opening
rem dist\index.html directly from the folder can't work, because browsers block
rem a page's scripts and styles there. Close this window to stop the server.
rem Run setup-tools.cmd first if pnpm isn't installed or dist\ is missing.

setlocal
cd /d "%~dp0"
title Grow an Empire - test the portal build

where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
for /f "delims=" %%p in ('npm prefix -g 2^>nul') do set "PATH=%%p;%PATH%"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"

where pnpm >nul 2>nul
if errorlevel 1 goto :no_pnpm
if not exist "dist\index.html" goto :no_dist

echo Opening the portal build at http://127.0.0.1:4174/
echo Close this window to stop it.
call pnpm preview
goto :eof

:no_pnpm
echo pnpm isn't installed yet. Double-click setup-tools.cmd first.
pause
exit /b 1

:no_dist
echo There is no build in dist\ yet. Double-click setup-tools.cmd first.
pause
exit /b 1
