$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$phpCommand=Get-Command php -ErrorAction SilentlyContinue
$phpPath=if($phpCommand){$phpCommand.Source}else{(Get-ChildItem 'C:\laragon\bin\php\*\php.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName}
if(-not $phpPath){throw 'PHP no está disponible. Instala PHP 8.1 o superior con pdo_mysql.'}
$envPath=Join-Path $projectRoot '.env'
if(-not(Test-Path -LiteralPath $envPath)){
 Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination $envPath
}
$environment=Get-Content -LiteralPath $envPath
$usesLocal=$environment -contains 'DB_PORT=3307'
if($usesLocal){
 $mysqlPath='C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqld.exe'
 if(-not(Test-Path -LiteralPath $mysqlPath)){throw 'Configura tu servidor MySQL en .env.'}
 $dataPath=Join-Path $projectRoot 'var\mysql'
 $logPath=Join-Path $projectRoot 'var\mysql.log'
 New-Item -ItemType Directory -Path (Join-Path $projectRoot 'var') -Force | Out-Null
 if(-not(Test-Path -LiteralPath (Join-Path $dataPath 'mysql'))){
  & $mysqlPath --no-defaults --initialize-insecure "--datadir=$dataPath" "--log-error=$logPath"
  if($LASTEXITCODE -ne 0){throw 'No se pudo inicializar MySQL. Revisa var/mysql.log.'}
 }
 $listening=Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
 if(-not $listening){
  $arguments=@('--no-defaults',('"--datadir='+$dataPath+'"'),'--port=3307','--bind-address=127.0.0.1',('--mysqlx-port=33070'),'--mysqlx-bind-address=127.0.0.1',('"--log-error='+$logPath+'"'))
  $process=Start-Process -FilePath $mysqlPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $projectRoot 'var\mysql.pid') -Value $process.Id
  for($attempt=0;$attempt -lt 40;$attempt++){
   if(Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue){break}
   Start-Sleep -Milliseconds 500
  }
 }
}
Push-Location $projectRoot
try{
 & $phpPath scripts/install.php
 if($LASTEXITCODE -ne 0){throw 'Revisa la conexión MySQL en .env.'}
 $existing=Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
 if(-not $existing){
  $arguments=@('-d','upload_max_filesize=50M','-d','post_max_size=64M','-S','127.0.0.1:8080','-t',('"'+(Join-Path $projectRoot 'public')+'"'),('"'+(Join-Path $projectRoot 'public\router.php')+'"'))
  $process=Start-Process -FilePath $phpPath -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'var\php-output.log') -RedirectStandardError (Join-Path $projectRoot 'var\php-error.log')
  Set-Content -LiteralPath (Join-Path $projectRoot 'var\php.pid') -Value $process.Id
 }
 Write-Host 'Tienda: http://127.0.0.1:8080'
 Write-Host 'Panel: http://127.0.0.1:8080/admin.php'
 Write-Host 'Credenciales: var/admin-credentials.txt'
 if(-not $env:MAGIA_NO_BROWSER){Start-Process 'http://127.0.0.1:8080'}
}finally{Pop-Location}
