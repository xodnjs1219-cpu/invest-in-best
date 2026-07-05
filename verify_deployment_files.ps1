# Railway Deployment Files Verification Script
# Check if all required files are created

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Railway Deployment Files Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allFilesExist = $true

# Required files list
$requiredFiles = @(
    # Backend files
    @{Path="backend\Procfile"; Description="Railway start command"},
    @{Path="backend\runtime.txt"; Description="Python version"},
    @{Path="backend\railway.json"; Description="Railway build config"},
    @{Path="backend\nixpacks.toml"; Description="Nixpacks config"},
    @{Path="backend\.env.example"; Description="Environment variables example"},
    @{Path="backend\generate_secret_key.py"; Description="Secret key generator"},
    @{Path="backend\config\settings\production.py"; Description="Production settings"},
    @{Path="backend\requirements.txt"; Description="Python dependencies"},
    
    # Frontend files
    @{Path="frontend\railway.json"; Description="Railway build config"},
    @{Path="frontend\nixpacks.toml"; Description="Nixpacks config"},
    @{Path="frontend\.env.example"; Description="Environment variables example"},
    @{Path="frontend\vite.config.ts"; Description="Vite config"},
    @{Path="frontend\package.json"; Description="Node dependencies"},
    
    # Root files
    @{Path=".gitignore"; Description="Git ignore file"},
    @{Path="RAILWAY_QUICKSTART.md"; Description="Quick start guide"},
    @{Path="RAILWAY_DEPLOYMENT_GUIDE.md"; Description="Detailed deployment guide"},
    @{Path="DEPLOYMENT_CHECKLIST.md"; Description="Deployment checklist"},
    @{Path="DEPLOYMENT_FILES_SUMMARY.md"; Description="Files summary"}
)

Write-Host "Checking required files...`n" -ForegroundColor Yellow

foreach ($file in $requiredFiles) {
    $filePath = $file.Path
    $description = $file.Description
    
    if (Test-Path $filePath) {
        Write-Host "[OK] $filePath" -ForegroundColor Green
        Write-Host "     -> $description" -ForegroundColor Gray
    } else {
        Write-Host "[MISSING] $filePath" -ForegroundColor Red
        Write-Host "          -> $description" -ForegroundColor Gray
        $allFilesExist = $false
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Content Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if requirements.txt has gunicorn and whitenoise
$requirementsPath = "backend\requirements.txt"
if (Test-Path $requirementsPath) {
    $requirements = Get-Content $requirementsPath
    $hasGunicorn = $requirements -match "gunicorn"
    $hasWhitenoise = $requirements -match "whitenoise"
    
    if ($hasGunicorn -and $hasWhitenoise) {
        Write-Host "[OK] requirements.txt includes gunicorn and whitenoise" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] requirements.txt is missing gunicorn or whitenoise!" -ForegroundColor Red
        $allFilesExist = $false
    }
}

# Check if package.json has preview script
$packagePath = "frontend\package.json"
if (Test-Path $packagePath) {
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    if ($package.scripts.preview) {
        Write-Host "[OK] package.json has preview script" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] package.json is missing preview script!" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Verification Result" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($allFilesExist) {
    Write-Host "[SUCCESS] All required files are ready!" -ForegroundColor Green
    Write-Host "`nNext Steps:" -ForegroundColor Yellow
    Write-Host "1. Generate Secret Key: python backend\generate_secret_key.py" -ForegroundColor White
    Write-Host "2. Commit changes: git add . ; git commit -m 'feat: add Railway deployment config'" -ForegroundColor White
    Write-Host "3. Push to GitHub: git push origin main" -ForegroundColor White
    Write-Host "4. Follow RAILWAY_QUICKSTART.md guide" -ForegroundColor White
} else {
    Write-Host "[FAILED] Some files are missing. Please check above." -ForegroundColor Red
}

Write-Host "`n========================================`n" -ForegroundColor Cyan
