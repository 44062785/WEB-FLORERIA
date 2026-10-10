<?php
require __DIR__.'/../../src/bootstrap.php'; startSession();
if($_SERVER['REQUEST_METHOD']!=='GET') fail('Método no permitido.',405);
$rows=db()->query('SELECT * FROM products WHERE active=1 ORDER BY featured DESC,id')->fetchAll();
jsonResponse(['products'=>array_map('productData',$rows),'settings'=>settings(),'csrf'=>$_SESSION['csrf'],'today'=>date('Y-m-d')]);
