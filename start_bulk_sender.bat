@echo off
title Aditya Enterprises - Free WhatsApp Bulk Sender
color 0A
cd /d "%~dp0"

echo =====================================================================
echo    ADITYA ENTERPRISES - 100%% FREE WHATSAPP BULK SENDER (TEXT + IMAGE)
echo =====================================================================
echo.

if exist "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" (
    "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe" send_whatsapp_bulk.py
) else (
    python send_whatsapp_bulk.py
)

pause
