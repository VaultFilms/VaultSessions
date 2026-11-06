@echo off
setlocal
rem pushd also supports UNC shares by assigning a temporary drive letter.
pushd "%~dp0"
if errorlevel 1 (
  echo Unable to open the VaultSessions folder.
  pause
  exit /b 1
)

rem Check the interpreter before starting the server. Never retry another
rem interpreter after a server failure, such as an occupied port.
py -3 -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>&1
if not errorlevel 1 goto launch_py
python -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>&1
if not errorlevel 1 goto launch_python

echo Python 3 was not found. Install Python 3 and try again.
echo Alternatively, use the side panel or file mode without a server.
set "vault_exit_code=1"
goto finish

:launch_py
py -3 serve.py
set "vault_exit_code=%errorlevel%"
goto finish

:launch_python
python serve.py
set "vault_exit_code=%errorlevel%"

:finish
popd
if not "%vault_exit_code%"=="0" pause
exit /b %vault_exit_code%
