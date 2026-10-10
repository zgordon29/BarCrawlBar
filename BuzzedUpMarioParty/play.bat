@echo off
cd /d "%~dp0"
start "" http://localhost:5173
".venv\Scripts\python.exe" serve.py
