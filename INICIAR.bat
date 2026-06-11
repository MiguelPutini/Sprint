@echo off
echo ======================================
echo   EV CHARGE SP - INICIAR SISTEMA
echo ======================================
echo.

REM Verifica Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor instale Python em: https://www.python.org/downloads/
    echo IMPORTANTE: Marque "Add Python to PATH" durante a instalacao!
    pause
    exit /b 1
)

echo [OK] Python encontrado!
python --version
echo.

REM Instala dependencias
echo [1/2] Instalando dependencias Python...
python -m pip install flask flask-cors mysql-connector-python bcrypt PyJWT python-dotenv --quiet
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas!
echo.

REM Inicia servidor
echo [2/2] Iniciando servidor Flask...
echo.
echo  Acesse: http://localhost:5000
echo  Para parar: CTRL+C
echo.
python app.py

pause
