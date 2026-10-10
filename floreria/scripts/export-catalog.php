<?php
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../src/bootstrap.php';
$sql="-- Catálogo importado de los archivos suministrados de magia.pe.\n-- MySQL 8, UTF-8. No incluye usuarios ni pedidos.\nSET NAMES utf8mb4;\n".file_get_contents(ROOT.'/database/schema.sql')."\n";
foreach(['products','settings','site_content'] as $table){
 foreach(db()->query('SELECT * FROM '.$table)->fetchAll() as $row){
  if($table==='products') unset($row['id'],$row['created_at'],$row['updated_at']);
  $columns=implode(',',array_map(fn($key)=>'`'.$key.'`',array_keys($row)));
  $values=implode(',',array_map(fn($value)=>$value===null?'NULL':db()->quote((string)$value),array_values($row)));
  $sql.='INSERT IGNORE INTO '.$table.' ('.$columns.') VALUES ('.$values.");\n";
 }
}
file_put_contents(ROOT.'/database/floreria.sql',$sql);
echo "Exportado database/floreria.sql\n";
