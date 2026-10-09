@echo off
echo ========================================================
echo   Starting PashuRakshak Unified Application
echo ========================================================

REM 1. Compile C++ risk engine if needed
if not exist "cpp-risk-engine\risk_engine.exe" (
    echo [*] Compiling C++ Risk Engine...
    cd cpp-risk-engine
    g++ -O2 -std=c++17 -Wall -o risk_engine.exe risk_engine.cpp
    cd ..
)

REM 2. Run backend (serves both React UI and REST API on http://localhost:8080)
echo [*] Launching unified server on http://localhost:8080 ...
cd backend-java
if exist "target\livestock-guard-backend-1.0.0.jar" (
    java -jar target\livestock-guard-backend-1.0.0.jar
) else (
    mvn spring-boot:run
)
