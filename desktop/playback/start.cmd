@echo off
setlocal
cd /d "%~dp0"
set "STUDIO_PLAYBACK_PORT=8080"
echo Opening presentation at http://127.0.0.1:%STUDIO_PLAYBACK_PORT%/
echo Close the server window to stop playback hosting.
start "Studio playback server" "%~dp0miniserve.exe" "%~dp0web" --index index.html --spa -i 127.0.0.1 -p %STUDIO_PLAYBACK_PORT%
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:%STUDIO_PLAYBACK_PORT%/"
endlocal
