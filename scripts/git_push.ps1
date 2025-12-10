<#
  Simple PowerShell helper to commit and push local changes to a Git remote.
  Usage:
    .\git_push.ps1 -Remote origin -Branch main -Message "My changes"

  This script will:
  - stage all changes
  - create a commit (if there are staged changes)
  - push to the specified remote and branch

  NOTE: This script does not create the remote. Ensure your Git remote is configured.
#>

param(
  [string]$Remote = 'origin',
  [string]$Branch = 'main',
  [string]$Message = 'Deploy: update backend-api-base for Render',
  [switch]$Force
)

Write-Output "Staging all changes..."
git add -A

$status = git status --porcelain
if (-not $status) {
  Write-Output "No changes to commit. Pushing branch $Branch to $Remote..."
  git push $Remote $Branch
  exit $LASTEXITCODE
}

Write-Output "Committing..."
if ($Force) {
  git commit -m $Message --no-verify
} else {
  git commit -m $Message
}

Write-Output "Pushing to $Remote/$Branch..."
git push $Remote $Branch

if ($LASTEXITCODE -eq 0) { Write-Output 'Push succeeded.' } else { Write-Output 'Push failed.'; exit $LASTEXITCODE }
