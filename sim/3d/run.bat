@echo off
REM Braillix mechanism simulator — double-click this.
REM A plain http server is required: the app fetches braillix.glb and the params
REM JSON, and browsers block those over file:// (CORS). Nothing here needs internet.
cd /d "%~dp0"
start "" http://localhost:8777/
python -m http.server 8777
