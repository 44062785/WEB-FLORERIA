<?php
require __DIR__.'/../../src/bootstrap.php'; startSession();
$action=$_GET['action']??'session'; $method=$_SERVER['REQUEST_METHOD'];
if($action==='session'&&$method==='GET') jsonResponse(['admin'=>($_SESSION['admin']??null),'csrf'=>$_SESSION['csrf']]);
if($method==='POST') csrf();
if($action==='login'&&$method==='POST') {
 $data=payload(); $email=textField($data,'email',3,200); $password=textField($data,'password',1,200);
 $ip=hash('sha256',$_SERVER['REMOTE_ADDR']??'local');
 $attempts=db()->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip_hash=? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'); $attempts->execute([$ip]);
 if((int)$attempts->fetchColumn()>=8) fail('Demasiados intentos. Intenta nuevamente en 15 minutos.',429);
 $query=db()->prepare('SELECT * FROM admins WHERE email=?'); $query->execute([$email]); $admin=$query->fetch();
 if(!$admin||!password_verify($password,$admin['password_hash'])) {
  db()->prepare('INSERT INTO login_attempts(ip_hash) VALUES (?)')->execute([$ip]); fail('Correo o contraseña incorrectos.',401);
 }
 db()->prepare('DELETE FROM login_attempts WHERE ip_hash=?')->execute([$ip]);
 session_regenerate_id(true); $_SESSION['admin']=['id'=>(int)$admin['id'],'name'=>$admin['name'],'email'=>$admin['email']]; $_SESSION['admin_time']=time();
 $_SESSION['csrf']=bin2hex(random_bytes(32)); jsonResponse(['admin'=>$_SESSION['admin'],'csrf'=>$_SESSION['csrf']]);
}
$admin=requireAdmin();
if($action==='logout'&&$method==='POST') { unset($_SESSION['admin'],$_SESSION['admin_time']); session_regenerate_id(true); jsonResponse(['ok'=>true]); }
if($action==='dashboard'&&$method==='GET') {
 $orders=db()->query('SELECT * FROM orders ORDER BY created_at DESC,id DESC LIMIT 500')->fetchAll();
 $items=db()->query('SELECT i.* FROM order_items i JOIN (SELECT id FROM orders ORDER BY created_at DESC,id DESC LIMIT 500) o ON o.id=i.order_id')->fetchAll();
 $byOrder=[]; foreach($items as $item) { $item['quantity']=(int)$item['quantity']; $item['unit_price']=(float)$item['unit_price']; $byOrder[$item['order_id']][]=$item; }
 foreach($orders as &$order) { $order['id']=(int)$order['id']; foreach(['subtotal','delivery','total'] as $key) $order[$key]=(float)$order[$key]; $order['items']=$byOrder[$order['id']]??[]; } unset($order);
 jsonResponse(['orders'=>$orders,'products'=>array_map('productData',db()->query('SELECT * FROM products WHERE active=1 ORDER BY featured DESC,id')->fetchAll()),'settings'=>settings()]);
}
if($action==='order'&&$method==='POST') {
 $data=payload(); $id=filter_var($data['id']??null,FILTER_VALIDATE_INT); $status=$data['status']??'';
 if(!$id||!in_array($status,['pendiente','confirmado','preparando','en_camino','entregado','cancelado'],true)) fail('Estado o pedido inválido.');
 $query=db()->prepare('UPDATE orders SET status=? WHERE id=?'); $query->execute([$status,$id]); jsonResponse(['ok'=>true]);
}
if($action==='product'&&$method==='POST') {
 $data=payload(); $name=textField($data,'name',2,200); $description=textField($data,'description',0,15000); $category=textField($data,'category',2,80);
 $price=filter_var($data['price']??null,FILTER_VALIDATE_FLOAT); $image=textField($data,'image',5,500);
 if($price===false||$price<=0||$price>20000) fail('El precio debe estar entre S/ 0.01 y S/ 20,000.');
 if(!preg_match('#^/(images|uploads)/[^/]+\.(webp|png|jpg|jpeg)$#u',$image)||!is_file(ROOT.'/public'.$image)) fail('Selecciona una imagen válida.');
 $available=!empty($data['available'])?1:0; $featured=!empty($data['featured'])?1:0;
 if(!empty($data['id'])) {
  $id=filter_var($data['id'],FILTER_VALIDATE_INT); if(!$id) fail('Producto inválido.');
  db()->prepare('UPDATE products SET name=?,description=?,category=?,price=?,image=?,available=?,featured=? WHERE id=? AND active=1')->execute([$name,$description,$category,round($price,2),$image,$available,$featured,$id]);
 } else {
  $slug=preg_replace('/[^a-z0-9]+/','-',strtolower(iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$name))); $slug=trim(substr($slug,0,120),'-').'-'.bin2hex(random_bytes(3));
  db()->prepare('INSERT INTO products(slug,name,description,category,price,image,available,featured) VALUES (?,?,?,?,?,?,?,?)')->execute([$slug,$name,$description,$category,round($price,2),$image,$available,$featured]);
 }
 jsonResponse(['ok'=>true]);
}
if($action==='delete-product'&&$method==='POST') {
 $data=payload(); $id=filter_var($data['id']??null,FILTER_VALIDATE_INT); if(!$id) fail('Producto inválido.');
 db()->prepare('UPDATE products SET active=0,available=0 WHERE id=?')->execute([$id]); jsonResponse(['ok'=>true]);
}
if($action==='upload'&&$method==='POST') {
 $file=$_FILES['image']??null;
 if(!$file||$file['error']!==UPLOAD_ERR_OK||$file['size']>5*1024*1024) fail('Sube una imagen JPG, PNG o WebP de hasta 5 MB.');
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']); $extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
 $size=getimagesize($file['tmp_name']);
 if(!isset($extensions[$mime])||!$size||$size[0]>8000||$size[1]>8000) fail('La imagen no es válida o es demasiado grande.');
 $directory=ROOT.'/public/uploads'; if(!is_dir($directory)) mkdir($directory,0755,true);
 file_put_contents($directory.'/.htaccess',"Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar)$\">\nRequire all denied\n</FilesMatch>\n");
 $name=bin2hex(random_bytes(16)).'.'.$extensions[$mime];
 if(!move_uploaded_file($file['tmp_name'],$directory.'/'.$name)) fail('No pudimos guardar la imagen.',500);
 jsonResponse(['image'=>'/uploads/'.$name],201);
}
if($action==='settings'&&$method==='POST') {
 $data=payload(); $values=['brand'=>textField($data,'brand',2,80),'tagline'=>textField($data,'tagline',2,100),'address'=>textField($data,'address',2,250),'contact_email'=>textField($data,'contact_email',0,200),'whatsapp'=>textField($data,'whatsapp',0,20)];
 if($values['contact_email']!==''&&!filter_var($values['contact_email'],FILTER_VALIDATE_EMAIL)) fail('El correo no es válido.');
 if($values['whatsapp']!==''&&!preg_match('/^\d{9,15}$/',$values['whatsapp'])) fail('WhatsApp debe incluir el código del país y solo números.');
 $threshold=filter_var($data['free_shipping']??null,FILTER_VALIDATE_FLOAT); if($threshold===false||$threshold<1||$threshold>20000) fail('Importe de envío gratis inválido.');
 $zones=$data['districts']??[]; if(!is_array($zones)||!count($zones)||count($zones)>60) fail('Configura los distritos de entrega.');
 $districts=[]; $names=[];
 foreach($zones as $zone) {
  if(!is_array($zone)) fail('Distrito inválido.'); $name=textField($zone,'name',2,80); $fee=filter_var($zone['price']??null,FILTER_VALIDATE_FLOAT);
  if($fee===false||$fee<0||$fee>500||in_array($name,$names,true)) fail('Revisa las tarifas y los distritos repetidos.');
  $names[]=$name; $districts[]=['name'=>$name,'price'=>round($fee,2)];
 }
 $values['districts']=json_encode($districts,JSON_UNESCAPED_UNICODE); $values['free_shipping']=(string)$threshold;
 $pdo=db(); $pdo->beginTransaction(); $query=$pdo->prepare('INSERT INTO settings(setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?');
 foreach($values as $key=>$value) $query->execute([$key,$value,$value]); $pdo->commit(); jsonResponse(['ok'=>true]);
}
if($action==='password'&&$method==='POST') {
 $data=payload(); $current=textField($data,'current',1,200); $password=textField($data,'password',10,200);
 $query=db()->prepare('SELECT password_hash FROM admins WHERE id=?'); $query->execute([$admin['id']]);
 if(!password_verify($current,$query->fetchColumn())) fail('La contraseña actual no es correcta.');
 db()->prepare('UPDATE admins SET password_hash=? WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$admin['id']]);
 session_regenerate_id(true); jsonResponse(['ok'=>true]);
}
fail('Operación no encontrada.',404);
