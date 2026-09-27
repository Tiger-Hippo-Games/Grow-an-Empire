@echo off
rem Double-click to test the release ZIP you are about to upload, exactly as it is.
rem Unpacks the newest release\grow-an-empire-*.zip into .tmp\release-test and serves
rem it at the portal's path, with a stand-in portal SDK, then opens a test page in
rem your browser where you can switch the frame size (1920x1080 portal frame,
rem laptops, phone portrait/landscape, whole window).
rem
rem To test on your phone too: run   test-release.cmd lan   from a Command Prompt
rem in this folder, then open the "On a phone" address it prints (same Wi-Fi;
rem allow Node through the Windows firewall if asked).
rem Close this window to stop the server.

setlocal
cd /d "%~dp0"
title Grow an Empire - test the release ZIP

where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if errorlevel 1 if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto :no_node

set "ZIP="
for /f "usebackq delims=" %%z in (`powershell -NoProfile -Command "$z = Get-ChildItem -Path 'release' -Filter 'grow-an-empire-*.zip' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($z) { $z.FullName }"`) do set "ZIP=%%z"
if not defined ZIP goto :no_zip

echo Testing %ZIP%
if exist ".tmp\release-test" rmdir /s /q ".tmp\release-test"
powershell -NoProfile -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath '.tmp\release-test' -Force"
if errorlevel 1 goto :unzip_failed
if not exist ".tmp\release-test\index.html" goto :bad_zip

set "LAN="
if /i "%~1"=="lan" set "LAN=--lan"
node Tools\dev\serve-release.mjs ".tmp\release-test" %LAN%
if errorlevel 1 goto :failed
goto :eof

:no_node
echo Node.js is not installed. Double-click setup-tools.cmd or start-game.cmd first.
goto :failed

:no_zip
echo There is no release\grow-an-empire-*.zip yet. Run "pnpm package" first.
goto :failed

:unzip_failed
echo Could not unpack %ZIP%.
goto :failed

:bad_zip
echo The ZIP has no index.html at its root, so the portal would reject it too.
goto :failed

:failed
echo.
pause
exit /b 1
