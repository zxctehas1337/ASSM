@echo off
git add .
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
git commit -m "Fix %datetime%"
git push origin main