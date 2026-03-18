param(
  [string]$BaseUrl = "http://localhost:3000",
  [switch]$InitDb,
  [switch]$KeepServer,
  [switch]$VerboseLog
)

$ErrorActionPreference = "Stop"

function Write-Report($report) {
  $report | ConvertTo-Json -Depth 6
}

function Invoke-Step {
  param(
    [hashtable]$Report,
    [string]$Name,
    [scriptblock]$Action
  )
  try {
    $data = & $Action
    $Report[$Name] = @{ ok = $true; data = $data }
    return $data
  } catch {
    $err = $_
    $Report[$Name] = @{
      ok = $false
      error = $err.Exception.Message
      errorDetails = $err.ErrorDetails.Message
    }
    throw
  }
}

$serverDir = Split-Path -Parent $PSScriptRoot
$logOut = Join-Path $serverDir "tmp-e2e.out.log"
$logErr = Join-Path $serverDir "tmp-e2e.err.log"
if (Test-Path $logOut) { Remove-Item $logOut -Force }
if (Test-Path $logErr) { Remove-Item $logErr -Force }

if ($InitDb) {
  Write-Host "Running init-db..."
  Push-Location $serverDir
  try {
    npm run init-db | Out-Host
  } finally {
    Pop-Location
  }
}

$proc = $null
$report = [ordered]@{}

try {
  $proc = Start-Process -FilePath "node" -ArgumentList "app.js" -WorkingDirectory $serverDir -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr

  # health check
  $health = $null
  for ($i = 0; $i -lt 12; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 2
      if ($health.status -eq "ok") { break }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $health) { throw "health-check-failed" }
  $report["health"] = @{ ok = $true; data = $health }

  # user login (dev openid)
  $ts = Get-Date -Format "yyyyMMddHHmmss"
  $devOpenId = "dev_autotest_user_$ts"
  $loginBody = @{ code = "testcode"; userInfo = @{ nickName = "AutoTester"; avatarUrl = "" }; devOpenId = $devOpenId } | ConvertTo-Json -Depth 4
  $login = Invoke-RestMethod -Uri "$BaseUrl/api/user/login" -Method Post -ContentType "application/json" -Body $loginBody
  $token = $login.data.token
  $userId = $login.data.id
  if (-not $token -or -not $userId) { throw "login-failed" }
  $headers = @{ Authorization = "Bearer $token" }
  $report["login"] = @{ ok = $true; data = @{ userId = $userId; openid = $devOpenId } }

  Invoke-Step $report "userStats" { Invoke-RestMethod -Uri "$BaseUrl/api/user/$userId/stats" -Method Get -Headers $headers }

  Invoke-Step $report "trashSearch" { Invoke-RestMethod -Uri "$BaseUrl/api/trash/search?keyword=%E5%A1%91%E6%96%99%E7%93%B6" -Method Get -Headers $headers }
  $trashId = $report["trashSearch"].data.data[0].id

  Invoke-Step $report "trashCategories" { Invoke-RestMethod -Uri "$BaseUrl/api/trash/categories" -Method Get -Headers $headers }
  Invoke-Step $report "trashByType" { Invoke-RestMethod -Uri "$BaseUrl/api/trash/type/recyclable" -Method Get -Headers $headers }
  Invoke-Step $report "trashHot" { Invoke-RestMethod -Uri "$BaseUrl/api/trash/hot?limit=5" -Method Get -Headers $headers }

  $identifyBody = @{ imageUrl = ""; imageName = "%E5%A1%91%E6%96%99%E7%93%B6.jpg" } | ConvertTo-Json
  Invoke-Step $report "trashIdentify" { Invoke-RestMethod -Uri "$BaseUrl/api/trash/identify" -Method Post -ContentType "application/json" -Headers $headers -Body $identifyBody }
  Invoke-Step $report "identifyHistory" { Invoke-RestMethod -Uri "$BaseUrl/api/user/$userId/history?limit=5" -Method Get -Headers $headers }

  $favBody = @{ userId = $userId; trashId = $trashId } | ConvertTo-Json
  Invoke-Step $report "favoriteAdd" { Invoke-RestMethod -Uri "$BaseUrl/api/favorites" -Method Post -ContentType "application/json" -Headers $headers -Body $favBody }
  Invoke-Step $report "favoriteCheck" { Invoke-RestMethod -Uri "$BaseUrl/api/favorites/check/$userId/$trashId" -Method Get -Headers $headers }
  Invoke-Step $report "favoriteList" { Invoke-RestMethod -Uri "$BaseUrl/api/favorites/$userId" -Method Get -Headers $headers }
  Invoke-Step $report "favoriteRemove" { Invoke-RestMethod -Uri "$BaseUrl/api/favorites" -Method Delete -ContentType "application/json" -Headers $headers -Body $favBody }

  Invoke-Step $report "checkIn" { Invoke-RestMethod -Uri "$BaseUrl/api/user/$userId/checkin" -Method Post -Headers $headers }
  Invoke-Step $report "pointsRecords" { Invoke-RestMethod -Uri "$BaseUrl/api/points/records/$userId?limit=5&page=1" -Method Get -Headers $headers }

  Invoke-Step $report "tasksList" { Invoke-RestMethod -Uri "$BaseUrl/api/points/tasks?userId=$userId" -Method Get -Headers $headers }
  $taskCompleteBody = @{ userId = $userId; taskId = 3 } | ConvertTo-Json
  Invoke-Step $report "taskComplete" { Invoke-RestMethod -Uri "$BaseUrl/api/points/tasks/complete" -Method Post -ContentType "application/json" -Headers $headers -Body $taskCompleteBody }

  $addBody = @{ userId = $userId; points = 1000; reason = "e2e-points" } | ConvertTo-Json
  Invoke-Step $report "pointsAdd" { Invoke-RestMethod -Uri "$BaseUrl/api/points/add" -Method Post -ContentType "application/json" -Headers $headers -Body $addBody }

  Invoke-Step $report "prizesList" { Invoke-RestMethod -Uri "$BaseUrl/api/points/prizes?status=1" -Method Get -Headers $headers }
  $prizeId = $report["prizesList"].data.data[0].id
  $exchangeBody = @{ userId = $userId; prizeId = $prizeId } | ConvertTo-Json
  Invoke-Step $report "exchangePrize" { Invoke-RestMethod -Uri "$BaseUrl/api/points/exchange" -Method Post -ContentType "application/json" -Headers $headers -Body $exchangeBody }
  Invoke-Step $report "exchangeList" { Invoke-RestMethod -Uri "$BaseUrl/api/points/exchanges/$userId" -Method Get -Headers $headers }

  Invoke-Step $report "rankingPoints" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/points?limit=5" -Method Get -Headers $headers }
  Invoke-Step $report "rankingIdentify" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/identify?limit=5" -Method Get -Headers $headers }
  Invoke-Step $report "rankingCheckin" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/checkin?limit=5" -Method Get -Headers $headers }
  Invoke-Step $report "rankingMy" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/myrank" -Method Get -Headers $headers }

  Invoke-Step $report "achievementsList" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/achievements" -Method Get -Headers $headers }
  $claimId = ($report["achievementsList"].data.data | Where-Object { $_.progress -ge 100 -and -not $_.achieved } | Select-Object -First 1).id
  if ($claimId) {
    $claimBody = @{ achievementId = $claimId } | ConvertTo-Json
    Invoke-Step $report "achievementClaim" { Invoke-RestMethod -Uri "$BaseUrl/api/ranking/achievements/claim" -Method Post -ContentType "application/json" -Headers $headers -Body $claimBody }
  } else {
    $report["achievementClaim"] = @{ ok = $true; data = @{ skipped = $true; reason = "no-claimable" } }
  }

  Invoke-Step $report "newsList" { Invoke-RestMethod -Uri "$BaseUrl/api/news?limit=3&page=1&status=1" -Method Get -Headers $headers }
  $newsId = $report["newsList"].data.data[0].id
  Invoke-Step $report "newsDetail" { Invoke-RestMethod -Uri "$BaseUrl/api/news/$newsId" -Method Get -Headers $headers }

  Invoke-Step $report "recycleAll" { Invoke-RestMethod -Uri "$BaseUrl/api/recycle?status=1" -Method Get -Headers $headers }
  $rp = $report["recycleAll"].data.data[0]
  $rpId = $rp.id; $lat = $rp.latitude; $lng = $rp.longitude
  Invoke-Step $report "recycleDetail" { Invoke-RestMethod -Uri "$BaseUrl/api/recycle/$rpId" -Method Get -Headers $headers }
  Invoke-Step $report "recycleNearby" { Invoke-RestMethod -Uri "$BaseUrl/api/recycle/nearby?lat=$lat&lng=$lng&radius=3000" -Method Get -Headers $headers }

  $fbBody = @{ userId = $userId; type = "suggestion"; content = "e2e-feedback"; trashName = ""; contact = "" } | ConvertTo-Json
  Invoke-Step $report "feedbackSubmit" { Invoke-RestMethod -Uri "$BaseUrl/api/feedback" -Method Post -ContentType "application/json" -Headers $headers -Body $fbBody }
  Invoke-Step $report "feedbackList" { Invoke-RestMethod -Uri "$BaseUrl/api/feedback/user/$userId" -Method Get -Headers $headers }

  # enterprise flow
  $eLoginBody = @{ username = "admin"; password = "123456" } | ConvertTo-Json
  $eLogin = Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/login" -Method Post -ContentType "application/json" -Body $eLoginBody
  $eToken = $eLogin.data.token
  $enterpriseId = $eLogin.data.id
  if (-not $eToken) { throw "enterprise-login-failed" }
  $eHeaders = @{ Authorization = "Bearer $eToken" }
  $report["enterpriseLogin"] = @{ ok = $true; data = @{ enterpriseId = $enterpriseId } }

  Invoke-Step $report "enterpriseInfo" { Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/$enterpriseId" -Method Get -Headers $eHeaders }
  Invoke-Step $report "enterpriseStats" { Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/$enterpriseId/stats?days=30" -Method Get -Headers $eHeaders }
  Invoke-Step $report "enterpriseRecordsBefore" { Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/$enterpriseId/records?limit=5&page=1" -Method Get -Headers $eHeaders }
  $verifyBody = @{ userId = $userId; itemName = "e2e-verify"; points = 20; verifyCode = "AUTO:$userId:20" } | ConvertTo-Json
  Invoke-Step $report "enterpriseVerify" { Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/verify" -Method Post -ContentType "application/json" -Headers $eHeaders -Body $verifyBody }
  Invoke-Step $report "enterpriseRecordsAfter" { Invoke-RestMethod -Uri "$BaseUrl/api/enterprise/$enterpriseId/records?limit=5&page=1" -Method Get -Headers $eHeaders }

  $report["summary"] = @{ ok = $true; data = @{ userId = $userId; enterpriseId = $enterpriseId } }

} catch {
  $err = $_
  $report["failure"] = @{
    ok = $false
    error = $err.Exception.Message
    errorDetails = $err.ErrorDetails.Message
    logTailOut = (Get-Content -Path $logOut -Tail 120) -join "`n"
    logTailErr = (Get-Content -Path $logErr -Tail 120) -join "`n"
  }
} finally {
  if ($proc -and -not $KeepServer) {
    Stop-Process -Id $proc.Id -Force
  }
}

if ($VerboseLog) {
  $report["logs"] = @{
    out = $logOut
    err = $logErr
  }
}

Write-Report $report

if ($report["failure"]) { exit 1 }
exit 0
