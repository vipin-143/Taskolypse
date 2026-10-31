<#
.SYNOPSIS
Taskocalypse CLI convenience script for Windows PowerShell.
#>
param (
    [Parameter(Position=0)]
    [ValidateSet("install", "run", "test", "lint", "demo", "help")]
    [string]$Command = "help"
)

switch ($Command) {
    "install" {
        python -m pip install -r requirements.txt
    }
    "run" {
        python -m app
    }
    "test" {
        python -m pytest
    }
    "lint" {
        python -m ruff check app tests demo_setup.py
        python -m ruff format --check app tests demo_setup.py
    }
    "demo" {
        python demo_setup.py
    }
    Default {
        Write-Host "Usage: .\run.ps1 [install | run | test | lint | demo]"
        Write-Host "  install : Install pinned dependencies"
        Write-Host "  run     : Start Taskocalypse web server (http://127.0.0.1:8000)"
        Write-Host "  test    : Execute full test suite with coverage report"
        Write-Host "  lint    : Run ruff checks and formatting audits"
        Write-Host "  demo    : Generate messy demo folder"
    }
}
