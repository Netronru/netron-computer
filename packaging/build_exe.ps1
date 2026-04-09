$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

python -m pip install pyinstaller
pyinstaller `
  --noconfirm `
  --windowed `
  --name "NTRN" `
  --collect-data netron_computer `
  --hidden-import netron_computer.desktop_app `
  -m netron_computer.desktop_app

Write-Host "Built dist/NTRN/NTRN.exe"
