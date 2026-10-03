$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskRuntime = Join-Path $taskRoot '.test-cache/postgresql-17.11-runtime/pgsql/bin'
if (-not (Test-Path -LiteralPath (Join-Path $taskRuntime 'initdb.exe'))) { throw 'Official PostgreSQL 17 runtime is required in .test-cache/postgresql-17.11-runtime' }
$taskRun = Join-Path $taskRoot ('.test-cache/postgresql-runs/' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $taskRun -Force | Out-Null
$taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
$taskBytes = New-Object byte[] 32
try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
$taskPassword = [Convert]::ToBase64String($taskBytes)
$taskPasswordFile = Join-Path $taskRun 'password.txt'
[IO.File]::WriteAllText($taskPasswordFile,$taskPassword,[Text.UTF8Encoding]::new($false))
$taskOldPassword = $env:PGPASSWORD
$taskOldConnection = $env:PARTYPLUS_TEST_DATABASE_URL
$taskPort = 55432
try {
  $env:PGPASSWORD = $taskPassword
  foreach ($taskTest in @('backend.test.mjs','observed-schema.test.mjs')) {
    $taskName = $taskTest.Replace('.test.mjs','')
    $taskData = Join-Path $taskRun $taskName
    $taskLog = Join-Path $taskRun ($taskName + '.server.log')
    & (Join-Path $taskRuntime 'initdb.exe') -D $taskData -U partyplus_test -A scram-sha-256 --pwfile=$taskPasswordFile --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic initdb failed' }
    Add-Content -LiteralPath (Join-Path $taskData 'postgresql.conf') -Value "`nlisten_addresses='127.0.0.1'`nport=$taskPort`nshared_buffers='32MB'`nmax_connections=20"
    $taskStarted = $false
    try {
      $taskStart = Start-Process -FilePath (Join-Path $taskRuntime 'pg_ctl.exe') -ArgumentList @('-D', ('"' + $taskData + '"'), '-l', ('"' + $taskLog + '"'), 'start', '-w') -WindowStyle Hidden -PassThru
      $taskStart.WaitForExit()
      if ($taskStart.ExitCode -ne 0) { throw 'Synthetic PostgreSQL start failed' }
      $taskStarted = $true
      & (Join-Path $taskRuntime 'createdb.exe') -h 127.0.0.1 -p $taskPort -U partyplus_test partyplus_synthetic
      if ($LASTEXITCODE -ne 0) { throw 'Synthetic database creation failed' }
      $env:PARTYPLUS_TEST_DATABASE_URL = 'postgres://partyplus_test:' + [uri]::EscapeDataString($taskPassword) + '@127.0.0.1:' + $taskPort + '/partyplus_synthetic'
      Push-Location $taskRoot
      try {
        node --test (Join-Path 'tests' $taskTest) | Tee-Object -FilePath (Join-Path $taskRoot ('docs/staging-evidence-2026-10-02/postgresql-' + $taskName + '.txt'))
        if ($LASTEXITCODE -ne 0) { throw "PostgreSQL regression failed: $taskTest" }
        if ($taskName -eq 'observed-schema') {
          $taskArchive = Join-Path $taskRun 'observed-schema.dump'
          & (Join-Path $taskRuntime 'pg_dump.exe') -h 127.0.0.1 -p $taskPort -U partyplus_test -d partyplus_synthetic -Fc -f $taskArchive
          if ($LASTEXITCODE -ne 0) { throw 'Synthetic pg_dump failed' }
          & (Join-Path $taskRuntime 'createdb.exe') -h 127.0.0.1 -p $taskPort -U partyplus_test partyplus_restore
          if ($LASTEXITCODE -ne 0) { throw 'Blank restore database creation failed' }
          & (Join-Path $taskRuntime 'pg_restore.exe') -h 127.0.0.1 -p $taskPort -U partyplus_test -d partyplus_restore --exit-on-error $taskArchive
          if ($LASTEXITCODE -ne 0) { throw 'Synthetic pg_restore failed' }
          node scripts/verify-postgresql-restore.mjs
          if ($LASTEXITCODE -ne 0) { throw 'Restored database verification failed' }
        }
      } finally { Pop-Location }
    } finally {
      if ($taskStarted) {
        & (Join-Path $taskRuntime 'pg_ctl.exe') -D $taskData stop -m fast -w
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic PostgreSQL cleanup failed' }
      }
    }
    $taskPort++
  }
} finally {
  $env:PGPASSWORD = $taskOldPassword
  $env:PARTYPLUS_TEST_DATABASE_URL = $taskOldConnection
  Remove-Item -LiteralPath $taskPasswordFile -Force
}
