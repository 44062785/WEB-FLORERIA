<?php
require __DIR__.'/../../src/bootstrap.php';
require ROOT.'/src/cms.php';
startSession();requireAdmin();
$method=$_SERVER['REQUEST_METHOD'];$action=$_GET['action']??'list';
if($method==='POST')csrf();
if($method==='GET'&&$action==='list'){
 $specs=[];foreach(cmsSpecs() as $spec){unset($spec['defaults']);$specs[]=$spec;}
 jsonResponse(['modules'=>$specs,'content'=>cmsDocuments(),'products'=>array_values(cmsProducts()),'categories'=>array_values(array_unique(array_column(cmsProducts(),'category')))]);
}
if($method==='POST'&&$action==='save'){
 if((int)($_SERVER['CONTENT_LENGTH']??0)>250000)fail('El contenido es demasiado grande.',413);
 try{$data=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);}catch(JsonException){fail('Solicitud inválida.');}
 if(!is_array($data))fail('Solicitud inválida.');
 $key=$data['key']??null;if(!is_string($key)||!isset(cmsSpecs()[$key]))fail('Sección inválida.');
 $revision=$data['revision']??null;if(!is_int($revision)||$revision<1)fail('Recarga esta sección antes de editar.');
 $doc=cmsValidateDocument(cmsSpecs()[$key],$data['document']??null);
 $query=db()->prepare('UPDATE site_content SET document=?,revision=revision+1 WHERE module_key=? AND revision=?');
 $query->execute([json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),$key,$revision]);
 if(!$query->rowCount())fail('Otra ventana modificó esta sección. Recárgala antes de guardar para no sobrescribir cambios.',409);
 jsonResponse(['ok'=>true,'revision'=>$revision+1,'document'=>$doc]);
}
if($method==='GET'&&$action==='media'){
 $assets=[];
 foreach(['reference','images','uploads'] as $folder){
  foreach(glob(ROOT.'/public/'.$folder.'/*')?:[] as $file){
   if(!is_file($file))continue;$extension=strtolower(pathinfo($file,PATHINFO_EXTENSION));
   if(!in_array($extension,['webp','jpg','jpeg','png','mp4'],true))continue;
   $assets[]=['path'=>'/'.$folder.'/'.basename($file),'name'=>basename($file),'type'=>$extension==='mp4'?'video':'image','size'=>filesize($file)];
  }
 }
 jsonResponse(['assets'=>$assets]);
}
if($method==='POST'&&$action==='upload'){
 $file=$_FILES['file']??null;
 if(!$file||$file['error']!==UPLOAD_ERR_OK||$file['size']>50*1024*1024)fail('Sube una imagen de hasta 8 MB o un video MP4 de hasta 50 MB. Comprueba también el límite de PHP.',413);
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
 $extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4'];
 if(!isset($extensions[$mime]))fail('Solo se permiten imágenes JPG, PNG, WebP y videos MP4.');
 if($mime!=='video/mp4'){
  $size=getimagesize($file['tmp_name']);
  if(!$size||$size[0]>8000||$size[1]>8000||$file['size']>8*1024*1024)fail('Usa una imagen de hasta 8 MB y 8000 × 8000 píxeles.');
 }else{
  $handle=fopen($file['tmp_name'],'rb');$head=fread($handle,12);fclose($handle);
  if(substr($head,4,4)!=='ftyp')fail('El video no tiene un formato MP4 válido.');
 }
 $directory=ROOT.'/public/uploads';if(!is_dir($directory))mkdir($directory,0755,true);
 file_put_contents($directory.'/.htaccess',"Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar)$\">\nRequire all denied\n</FilesMatch>\n");
 $name=bin2hex(random_bytes(16)).'.'.$extensions[$mime];
 if(!move_uploaded_file($file['tmp_name'],$directory.'/'.$name))fail('No pudimos guardar el archivo.',500);
 jsonResponse(['path'=>'/uploads/'.$name,'type'=>$mime==='video/mp4'?'video':'image'],201);
}
fail('Operación no encontrada.',404);
