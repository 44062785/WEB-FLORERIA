<?php
require __DIR__.'/../../src/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST') fail('Método no permitido.',405);
csrf(); $data=payload();
$customer=textField($data,'customer',2,120); $email=textField($data,'email',3,200); $phone=textField($data,'phone',9,30);
$recipient=textField($data,'recipient',2,120); $address=textField($data,'address',8,400); $district=textField($data,'district',2,80);
$date=textField($data,'delivery_date',10,10); $dedication=textField($data,'dedication',0,600); $key=textField($data,'request_key',20,64);
if(!filter_var($email,FILTER_VALIDATE_EMAIL)||!preg_match('/^\+?[\d\s()-]{9,25}$/',$phone)) fail('Revisa tu correo y teléfono.');
$parsedDate=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
if(!$parsedDate||$parsedDate->format('Y-m-d')!==$date||$date<date('Y-m-d')||$date>date('Y-m-d',strtotime('+90 days'))) fail('Elige una fecha entre hoy y los próximos 90 días.');
$shop=settings(); $zone=null; foreach($shop['districts'] as $entry) if($entry['name']===$district) $zone=$entry;
if(!$zone) fail('Selecciona un distrito con cobertura.');
$cart=$data['items']??null;
if(!is_array($cart)||!count($cart)||count($cart)>40) fail('Agrega productos al carrito.');
$quantities=[];
foreach($cart as $item) {
 if(!is_array($item)||!is_int($item['id']??null)||!is_int($item['quantity']??null)||$item['quantity']<1||$item['quantity']>20) fail('Las cantidades del carrito no son válidas.');
 $quantities[$item['id']]=($quantities[$item['id']]??0)+$item['quantity'];
 if($quantities[$item['id']]>20) fail('Puedes pedir hasta 20 unidades de cada producto.');
}
$pdo=db(); $existing=$pdo->prepare('SELECT reference,total,status FROM orders WHERE request_key=?'); $existing->execute([$key]);
if($found=$existing->fetch()) jsonResponse(['reference'=>$found['reference'],'total'=>(float)$found['total'],'status'=>$found['status']]);
$_SESSION['order_times']=array_filter($_SESSION['order_times']??[],fn($time)=>$time>time()-600);
if(count($_SESSION['order_times'])>=6) fail('Espera unos minutos antes de registrar otro pedido.',429);
$pdo->beginTransaction();
try {
 $items=[]; $subtotal=0; $lookup=$pdo->prepare('SELECT * FROM products WHERE id=? AND active=1 FOR SHARE');
 foreach($quantities as $id=>$quantity) {
  $lookup->execute([$id]); $product=$lookup->fetch();
  if(!$product||!$product['available']) { $pdo->rollBack(); fail('Un producto dejó de estar disponible. Actualiza el catálogo.',409); }
  $cents=(int)round((float)$product['price']*100); $subtotal+=$cents*$quantity;
  $items[]=['id'=>$id,'name'=>$product['name'],'quantity'=>$quantity,'price'=>$cents/100];
 }
 $delivery=$subtotal>=(int)round($shop['free_shipping']*100)?0:(int)round((float)$zone['price']*100);
 $total=($subtotal+$delivery)/100; $reference='MAG-'.strtoupper(bin2hex(random_bytes(4)));
 $save=$pdo->prepare('INSERT INTO orders (reference,request_key,customer,email,phone,recipient,address,district,delivery_date,dedication,subtotal,delivery,total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
 $save->execute([$reference,$key,$customer,$email,$phone,$recipient,$address,$district,$date,$dedication,$subtotal/100,$delivery/100,$total]);
 $orderId=(int)$pdo->lastInsertId(); $saveItem=$pdo->prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)');
 foreach($items as $item) $saveItem->execute([$orderId,$item['id'],$item['name'],$item['quantity'],$item['price']]);
 $pdo->commit(); $_SESSION['order_times'][]=time(); jsonResponse(['reference'=>$reference,'total'=>$total,'status'=>'pendiente'],201);
} catch(Throwable $error) {
 if($pdo->inTransaction()) $pdo->rollBack();
 if($error instanceof PDOException&&$error->getCode()==='23000') {
  $existing->execute([$key]); if($found=$existing->fetch()) jsonResponse(['reference'=>$found['reference'],'total'=>(float)$found['total'],'status'=>$found['status']]);
 }
 throw $error;
}
