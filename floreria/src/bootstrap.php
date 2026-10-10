<?php
declare(strict_types=1);
const ROOT = __DIR__ . '/..';
date_default_timezone_set('America/Lima');
foreach (is_file(ROOT . '/.env') ? file(ROOT . '/.env', FILE_IGNORE_NEW_LINES) : [] as $line) {
 $line=trim($line);
 if($line===''||str_starts_with($line,'#')||!str_contains($line,'=')) continue;
 [$key,$value]=explode('=',$line,2);
 if(getenv(trim($key))===false) putenv(trim($key).'='.trim($value," \t\n\r\0\x0B\"'"));
}
function env(string $key,string $default=''):string { return getenv($key)!==false?(string)getenv($key):$default; }
function db():PDO {
 static $pdo;
 if(!$pdo) {
  $pdo=new PDO('mysql:host='.env('DB_HOST','127.0.0.1').';port='.env('DB_PORT','3306').';dbname='.env('DB_DATABASE','floreria_magia').';charset=utf8mb4',env('DB_USERNAME','root'),env('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
  $pdo->exec("SET time_zone = '-05:00'");
 }
 return $pdo;
}
function startSession():void {
 if(session_status()===PHP_SESSION_ACTIVE) return;
 $folder=ROOT.'/var/sessions'; if(!is_dir($folder)) mkdir($folder,0700,true);
 session_save_path($folder); session_name('magia_session');
 session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','samesite'=>'Lax','path'=>'/']);
 ini_set('session.use_strict_mode','1'); session_start(); $_SESSION['csrf']??=bin2hex(random_bytes(32));
}
function jsonResponse(array $data,int $status=200):never {
 http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
 echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); exit;
}
function fail(string $message,int $status=400):never { jsonResponse(['error'=>$message],$status); }
function payload():array {
 if((int)($_SERVER['CONTENT_LENGTH']??0)>25000) fail('La solicitud es demasiado grande.',413);
 try { $value=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR); }
 catch(JsonException) { fail('Solicitud inválida.'); }
 if(!is_array($value)) fail('Solicitud inválida.'); return $value;
}
function csrf():void {
 startSession();
 if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??$_POST['csrf']??'')) fail('La sesión expiró. Recarga la página e intenta otra vez.',419);
}
function requireAdmin():array {
 startSession();
 if(empty($_SESSION['admin'])||time()-($_SESSION['admin_time']??0)>28800) { unset($_SESSION['admin']); fail('Inicia sesión para acceder a la administración.',401); }
 return $_SESSION['admin'];
}
function e(string $value):string { return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function textField(array $data,string $key,int $min,int $max):string {
 if(!is_string($data[$key]??null)) fail('Completa el campo '.$key.'.');
 $value=trim($data[$key]); if(mb_strlen($value)<$min||mb_strlen($value)>$max) fail('Revisa el campo '.$key.'.'); return $value;
}
function settings():array {
 $result=[];
 foreach(db()->query('SELECT setting_key,setting_value FROM settings')->fetchAll() as $row) $result[$row['setting_key']]=$row['setting_value'];
 $result['districts']=json_decode($result['districts']??'[]',true); $result['free_shipping']=(float)($result['free_shipping']??300); return $result;
}
function productData(array $row):array {
 return ['id'=>(int)$row['id'],'slug'=>$row['slug'],'name'=>$row['name'],'description'=>$row['description'],'category'=>$row['category'],'price'=>(float)$row['price'],'image'=>$row['image'],'available'=>(bool)$row['available'],'featured'=>(bool)$row['featured']];
}
set_exception_handler(function(Throwable $error):void {
 error_log((string)$error);
 if(str_contains($_SERVER['REQUEST_URI']??'','/api/')) fail('El servicio no está disponible. Intenta nuevamente en unos momentos.',503);
 http_response_code(503);
 echo '<!doctype html><html lang="es"><meta charset="utf-8"><title>Magia</title><body style="font-family:system-ui;padding:60px;max-width:700px;margin:auto"><h1>Estamos preparando la tienda.</h1><p>Configura MySQL y ejecuta <code>php scripts/install.php</code>. Encontrarás las instrucciones en README.md.</p></body></html>';
});
