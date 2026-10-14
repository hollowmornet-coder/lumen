@echo off
REM =====================================================================
REM  LUMEN - Digital School Library Management System
REM  Menjalankan backend + frontend sekaligus.
REM
REM  Prasyarat: Node.js terpasang, database MariaDB/MySQL sudah berjalan,
REM             dan `npm install` sudah dilakukan di kedua folder.
REM =====================================================================

setlocal
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   LUMEN - Sistem Perpustakaan Sekolah Digital
echo  ==========================================================
echo.

REM --- Cek Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan.
    echo         Silakan pasang Node.js 18 atau lebih baru.
    echo         Download: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js %NODE_VERSION%
echo.

REM --- Cek dependensi backend ---
if not exist "backend\node_modules" (
    echo [INFO] Dependensi backend belum ada, memasang...
    pushd backend
    call npm install
    popd
    echo.
)

REM --- Cek dependensi frontend ---
if not exist "frontend\node_modules" (
    echo [INFO] Dependensi frontend belum ada, memasang...
    pushd frontend
    call npm install
    popd
    echo.
)

REM --- Peringatan bila .env backend belum ada ---
if not exist "backend\.env" (
    echo [PERINGATAN] backend\.env belum ada.
    echo              Salin backend\.env.example ke backend\.env lalu isi nilainya.
    echo.
)

echo [INFO] Menjalankan backend di http://localhost:4000
echo [INFO] Menjalankan frontend di http://localhost:5173
echo.
echo  Tutup jendela ini untuk menghentikan keduanya.
echo.

start "LUMEN Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak >nul
start "LUMEN Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  Silakan buka:  http://localhost:5173
echo.
echo  Akun demo:
echo    Petugas : admin  / Admin123!
echo    Siswa   : andira / Siswa123!
echo.

pause
endlocal
