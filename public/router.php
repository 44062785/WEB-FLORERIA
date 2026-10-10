<?php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
$file=realpath(__DIR__.$path);
if($file&&str_starts_with($file,__DIR__.DIRECTORY_SEPARATOR)&&is_file($file)) return false;
if($path==='/') { require __DIR__.'/index.php'; return true; }
http_response_code(404); echo '<!doctype html><html lang="es"><meta charset="utf-8"><title>Página no encontrada</title><body><h1>Página no encontrada</h1><a href="/">Volver a la tienda</a></body></html>';
