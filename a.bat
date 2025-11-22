@echo off
git add .

for /f "tokens=1-3 delims=/" %%a in ('date /t') do (
    set date_=%%c-%%b-%%a
)
for /f "tokens=1-2 delims=:" %%a in ('time /t') do (
    set time_=%%a:%%b
)

git commit -m "Fix %date_% %time_%"
git push origin master