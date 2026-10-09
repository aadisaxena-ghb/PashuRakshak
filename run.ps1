Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting PashuRakshak Unified Application" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Compile C++ risk engine if needed
if (-not (Test-Path "cpp-risk-engine\risk_engine.exe")) {
    Write-Host "[*] Compiling C++ Risk Engine..." -ForegroundColor Yellow
    Push-Location "cpp-risk-engine"
    g++ -O2 -std=c++17 -Wall -o risk_engine.exe risk_engine.cpp
    Pop-Location
}

# 2. Run backend (serves both React UI and REST API on http://localhost:8080)
Write-Host "[*] Launching unified server on http://localhost:8080 ..." -ForegroundColor Green
Push-Location "backend-java"
if (Test-Path "target\livestock-guard-backend-1.0.0.jar") {
    java -jar target\livestock-guard-backend-1.0.0.jar
} else {
    mvn spring-boot:run
}
Pop-Location
