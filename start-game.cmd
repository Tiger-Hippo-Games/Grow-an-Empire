@echo off
rem Double-click to play/test Grow an Empire locally.
rem Checks Node, installs dependencies when needed, starts the Vite dev server
rem on http://127.0.0.1:4173/ and opens it in your browser.
rem Close this window (or press Ctrl+C) to stop the server.
rem Tip: open http://127.0.0.1:4173/?reset to start over as a first-time player.

setlocal
cd /d "%~dp0"
title Grow an Empire - local dev server

where node >nul 2>nul
if errorlevel 1 goto :no_node

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
call %PNPM% install
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

:no_node
echo Node.js was not found. Install the current LTS from https://nodejs.org
echo then double-click start-game.cmd again.
goto :failed

:install_failed
echo Installing dependencies failed. See the messages above.
goto :failed

:failed
echo.
pause
exit /b 1
