<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') { http_response_code(403); exit; }
require __DIR__.'/../src/bootstrap.php';
$database=env('DB_DATABASE','floreria_magia');
if(!preg_match('/^[a-zA-Z0-9_]+$/',$database)) throw new RuntimeException('Nombre de base de datos inválido.');
$connection=new PDO('mysql:host='.env('DB_HOST','127.0.0.1').';port='.env('DB_PORT','3306').';charset=utf8mb4',env('DB_USERNAME','root'),env('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$connection->exec('CREATE DATABASE IF NOT EXISTS `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo=db(); foreach(explode(';',file_get_contents(ROOT.'/database/schema.sql')) as $sql) if(trim($sql)) $pdo->exec($sql);
$import=json_decode(file_get_contents(ROOT.'/data/products.json'),true,512,JSON_THROW_ON_ERROR);
$featured=['box-loyalty-pink','ramo-primavera-eterna','box-eres-magia','box-40-tulip','box-eternal-pink','box-alegria','ramo-inspiracion','bouquet-pack','box-golden-glow','box-de-24-rosas-magia','ramo-pastel-pink','bouquet-happy-tulip'];
$statement=$pdo->prepare('INSERT IGNORE INTO products (slug,name,description,category,price,image,available,featured,source_url) VALUES (?,?,?,?,?,?,?,?,?)');
$pdo->beginTransaction();
foreach($import as $product) $statement->execute([$product['id'],$product['name'],$product['description'],$product['category'],$product['price'],$product['image'],(int)$product['available'],(int)in_array($product['id'],$featured,true),$product['source']]);
$districts=[['name'=>'Miraflores','price'=>15],['name'=>'San Isidro','price'=>15],['name'=>'Surco','price'=>20],['name'=>'San Borja','price'=>18],['name'=>'Barranco','price'=>18],['name'=>'La Molina','price'=>25],['name'=>'Jesús María','price'=>18],['name'=>'Lince','price'=>18],['name'=>'Magdalena','price'=>18],['name'=>'Pueblo Libre','price'=>20],['name'=>'San Miguel','price'=>20],['name'=>'Lima Cercado','price'=>22],['name'=>'Callao','price'=>30],['name'=>'Los Olivos','price'=>30]];
$defaults=['brand'=>'Magia','tagline'=>'Flores y momentos','whatsapp'=>'','contact_email'=>'','address'=>'Lima, Perú','free_shipping'=>'300','districts'=>json_encode($districts,JSON_UNESCAPED_UNICODE)];
$seed=$pdo->prepare('INSERT IGNORE INTO settings (setting_key,setting_value) VALUES (?,?)'); foreach($defaults as $key=>$value) $seed->execute([$key,$value]); $pdo->commit();
if((int)$pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn()===0) {
 $password='Flores-'.bin2hex(random_bytes(6)).'!';
 $pdo->prepare('INSERT INTO admins(name,email,password_hash) VALUES (?,?,?)')->execute(['Administrador','admin@floreria.local',password_hash($password,PASSWORD_DEFAULT)]);
 if(!is_dir(ROOT.'/var')) mkdir(ROOT.'/var',0700,true);
 file_put_contents(ROOT.'/var/admin-credentials.txt',"Panel: /admin.php\nCorreo: admin@floreria.local\nContraseña: $password\nCambia la contraseña desde el panel de administración.\n");
 echo "Credenciales iniciales guardadas en var/admin-credentials.txt\n";
}
if(is_file(ROOT.'/data/cms-defaults.json')){
 $cmsSeed=$pdo->prepare('INSERT IGNORE INTO site_content(module_key,document) VALUES (?,?)');
 foreach(json_decode(file_get_contents(ROOT.'/data/cms-defaults.json'),true,512,JSON_THROW_ON_ERROR) as $module)$cmsSeed->execute([$module['key'],json_encode($module['defaults'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
}
echo 'Instalación lista. Productos: '.$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn()."\n";
