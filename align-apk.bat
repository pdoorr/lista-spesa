@echo off
cd /d "C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot\bin"
zipalign -f -v 4 "D:\progetti\lista-spesa\android\app\build\outputs\apk\release\app-release-unsigned.apk" "D:\progetti\lista-spesa\android\app\build\outputs\apk\release\lista-spesa-aligned.apk"
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA256 -keystore "D:\progetti\lista-spesa\android\lista-spesa.keystore" -storepass "lista-spesa-2025" -keypass "lista-spesa-2025" "D:\progetti\lista-spesa\android\app\build\outputs\apk\release\lista-spesa-aligned.apk" lista-sp
del "D:\progetti\lista-spesa\android\app\build\outputs\apk\release\app-release-unsigned.apk"
ren "D:\progetti\lista-spesa\android\app\build\outputs\apk\release\lista-spesa-aligned.apk" "lista-spesa.apk"
echo.
echo APK generato: D:\progetti\lista-spesa\android\app\build\outputs\apk\release\lista-spesa.apk
pause

