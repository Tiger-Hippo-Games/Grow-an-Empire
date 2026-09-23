@echo off
rem Double-click to play/test Grow an Empire locally.
rem Checks Node, installs dependencies when needed, starts the Vite dev server
rem on http://127.0.0.1:4173/ and opens it in your browser.
rem Close this window (or press Ctrl+C) to stop the server.
rem Tip: open http://127.0.0.1:4173/?reset to start over as a first-time player.

setlocal
cd /d "%~dp0"
title Grow an Empire - local dev server

call :find_node
if errorlevel 1 goto :no_node

:have_node
set "PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "PNPM=npx --yes pnpm@11.19.0"

node Tools\dev\preflight.mjs
if errorlevel 20 goto :already_running
if errorlevel 10 goto :install
if errorlevel 1 goto :failed
goto :start

:install
echo Installing dependencies, this can take a minute the first time...
rem confirm-modules-purge=false: if node_modules was installed by another tool with a
rem different package store, rebuild it automatically instead of stopping to ask.
call %PNPM% install --config.confirm-modules-purge=false
if errorlevel 1 goto :install_failed

:start
echo.
echo Starting Grow an Empire at http://127.0.0.1:4173/
echo Keep this window open while you play. Close it to stop the server.
echo.
call %PNPM% run start
if errorlevel 1 goto :failed
goto :eof

:already_running
start "" "http://127.0.0.1:4173/"
goto :eof

rem Looks for node.exe on PATH, then in the standard install folders. A fresh
rem install is often not on PATH yet for programs started from Explorer,
rem until you sign out and back in.
:find_node
where node >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"& exit /b 0
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"& exit /b 0
exit /b 1

:no_node
echo Node.js is not installed on this computer.
echo It is needed to run the game's development server.
echo.
where winget >nul 2>nul
if errorlevel 1 goto :manual_node
choice /C YN /M "Install Node.js LTS now using winget"
if errorlevel 2 goto :manual_node
echo.
echo Installing Node.js LTS. Windows may ask for permission...
winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
call :find_node
if errorlevel 1 goto :manual_node
echo.
echo Node.js is installed.
goto :have_node

:manual_node
echo.
echo Install the LTS version from https://nodejs.org
echo then double-click start-game.cmd again.
goto :failed

:install_failed
echo Installing dependencies failed. See the messages above.
goto :failed

:failed
echo.
pause
exit /b 1
