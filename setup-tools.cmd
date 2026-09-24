@echo off
rem Double-click to set up and verify everything Grow an Empire needs on this computer.
rem   1. Node.js 22.13 or newer (offers to install or update it with winget)
rem   2. pnpm 11.19.0 (installs it for your user account with npm if missing)
rem   3. pnpm install  - the project's dependencies
rem   4. pnpm check    - type-checks, lint and the 105 tests
rem   5. pnpm package  - builds dist\ and release\grow-an-empire-<version>.zip
rem At the end it can open the built game in your browser (pnpm preview).
rem Batch files run even when PowerShell scripts are blocked, so this avoids the
rem "running scripts is disabled on this system" error.

setlocal
cd /d "%~dp0"
title Grow an Empire - setup and check

echo.
echo === Step 1 of 5: Node.js ===
call :find_node
if errorlevel 1 goto :no_node
:have_node
for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 goto :old_node
echo Node %NODE_VERSION% - OK

echo.
echo === Step 2 of 5: pnpm ===
call :add_npm_bin
where pnpm >nul 2>nul
if not errorlevel 1 goto :have_pnpm
echo pnpm is not installed. Installing pnpm 11.19.0 for your user account...
call npm install -g pnpm@11.19.0
if errorlevel 1 goto :pnpm_failed
call :add_npm_bin
where pnpm >nul 2>nul
if errorlevel 1 goto :pnpm_failed
:have_pnpm
for /f "delims=" %%v in ('pnpm -v') do set "PNPM_VERSION=%%v"
echo pnpm %PNPM_VERSION% - OK

echo.
echo === Step 3 of 5: pnpm install ===
rem confirm-modules-purge=false: rebuild node_modules without asking if another
rem tool installed it with a different package store.
call pnpm install --config.confirm-modules-purge=false
if errorlevel 1 goto :step_failed

echo.
echo === Step 4 of 5: pnpm check - type-checks, lint and tests ===
call pnpm check
if errorlevel 1 goto :step_failed

echo.
echo === Step 5 of 5: pnpm package - portal build and ZIP ===
call pnpm package
if errorlevel 1 goto :step_failed

echo.
echo ============================================================
echo  All done. Everything is installed and the build is ready:
echo    dist\                           the game, for testing
echo    release\grow-an-empire-*.zip    upload this to the portal
echo ============================================================
echo.
choice /C YN /M "Open the built game in your browser now"
if errorlevel 2 goto :end
echo.
echo The game opens at http://127.0.0.1:4174/ - close this window to stop it.
call pnpm preview
goto :end

rem --- helpers --------------------------------------------------------------

rem Finds node.exe on PATH, then in the standard install folders (a fresh
rem install is often not on PATH yet until you sign out and back in).
:find_node
where node >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"& exit /b 0
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"& exit /b 0
exit /b 1

rem Puts npm's global folder (where "npm install -g" puts pnpm) on PATH for this window.
:add_npm_bin
for /f "delims=" %%p in ('npm prefix -g 2^>nul') do set "PATH=%%p;%PATH%"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"
exit /b 0

:no_node
echo Node.js is not installed on this computer.
where winget >nul 2>nul
if errorlevel 1 goto :manual_node
choice /C YN /M "Install Node.js LTS now using winget"
if errorlevel 2 goto :manual_node
winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
call :find_node
if errorlevel 1 goto :manual_node
goto :have_node

:old_node
echo Node %NODE_VERSION% is too old. pnpm 11, which this project uses, needs Node 22.13 or newer.
where winget >nul 2>nul
if errorlevel 1 goto :manual_node
choice /C YN /M "Update Node.js to the latest LTS now using winget"
if errorlevel 2 goto :manual_node
winget upgrade --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
echo.
echo If Node was updated, close this window and double-click setup-tools.cmd again.
goto :failed
:manual_node
echo Install the LTS version from https://nodejs.org, then double-click setup-tools.cmd again.
goto :failed

:pnpm_failed
echo Installing pnpm failed. See the messages above.
goto :failed

:step_failed
echo.
echo That step failed. See the messages above.
goto :failed

:failed
echo.
echo Setup stopped. Copy the text in this window and send it to Claude.
pause
exit /b 1

:end
endlocal
exit /b 0
