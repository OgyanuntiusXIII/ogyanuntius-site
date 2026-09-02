@echo off
rem ---------------------------------------------------------------
rem  Inbox app launcher.  Keep this file ASCII-only:
rem  cmd.exe parses .cmd bytes with the console codepage, so Japanese
rem  characters here can turn into garbage before chcp takes effect.
rem  The Japanese window title is set from Node (process.title).
rem ---------------------------------------------------------------
chcp 65001 > nul
cd /d "%~dp0.."
node "tools\inbox-app.mjs" %*
if errorlevel 1 pause
