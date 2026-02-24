@echo off
echo Setting up Firebase environment variables...
echo.

firebase functions:config:set app.jwt_secret="safenex_dev_secret_change_me"
firebase functions:config:set turso.database_url="libsql://safenex-unknown9920.aws-ap-south-1.turso.io"
firebase functions:config:set turso.auth_token="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2MzcwNDUsImlkIjoiMjA5YzNkMWYtZDM5YS00ODUxLWE5ZjMtNWQyZjc0MzIzZDAwIiwicmlkIjoiNGMzNjJlOWUtNGMyYS00MjQyLTk1NWMtZDE2NDRhOTgyNWM4In0.lUYcR3m25ihmi6L6tfWQLy-x4O9x3UoIBJtn7aGpcHqQZwASGHDXzSJYtxq22myhUJkg6kvIKiorOA7PUlr5Cw"
firebase functions:config:set gemini.api_key="AIzaSyB_q613NLA66hmrjYDEdv6yZV1lrWmqdEY"
firebase functions:config:set gemini.api_key_safetrace="AIzaSyCexJHb5HfQP_U7TphNSTqB0dQhzTpCmWM"
firebase functions:config:set gemini.model="gemini-3-flash-preview"
firebase functions:config:set gemini.model_nexa="gemini-2.5-flash"
firebase functions:config:set openroute.api_key="eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImY2ODMzMTRhYjJjMzQyNjI4YmYxY2JhNTgyMGM5OTY1IiwiaCI6Im11cm11cjY0In0="
firebase functions:config:set admin.email="abdullahansari01618@gmail.com"
firebase functions:config:set admin.password="9920867077@Adil"
firebase functions:config:set app.allowed_origins="https://safenex-s.web.app,https://safenex-s.firebaseapp.com"
firebase functions:config:set app.rate_limit_window_ms="900000"
firebase functions:config:set app.rate_limit_max_requests="100"
firebase functions:config:set app.log_level="info"

echo.
echo Environment variables set successfully!
echo.
echo To view all config: firebase functions:config:get
echo To deploy: firebase deploy --only hosting:safenex-s,functions
pause
