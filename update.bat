@echo off
REM ===========================================================================
REM  Gazy — one-click updater (Windows)
REM  Double-click this file whenever a new version has been pushed. It pulls the
REM  latest prebuilt extension into this same folder, so you never re-download or
REM  re-extract. After it finishes, just reload the extension in Chrome.
REM ===========================================================================

REM Work from the folder this script lives in, wherever it's double-clicked from.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo Git is not installed. Install "Git for Windows" from:
  echo   https://git-scm.com/download/win
  echo then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo Updating Gazy to the latest version...
echo.
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Update could not be applied automatically.
  echo If you edited files here, discard those changes (or re-clone the repo^)
  echo and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo ===========================================================================
echo  Updated. Now finish in Chrome (about 10 seconds^):
echo    1. Open  chrome://extensions
echo    2. Click the circular reload arrow on the Gazy card
echo    3. Refresh your LinkedIn tab
echo ===========================================================================
echo.
pause
