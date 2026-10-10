<?php
declare(strict_types=1);

function cmsSpecs():array {
 static $specs;
 if($specs===null){$specs=[];foreach(json_decode(file_get_contents(ROOT.'/data/cms-defaults.json'),true,512,JSON_THROW_ON_ERROR) as $spec)$specs[$spec['key']]=$spec;}
 return $specs;
}
function cmsDocuments():array {
 $docs=[];foreach(db()->query('SELECT module_key,document,revision FROM site_content') as $row)$docs[$row['module_key']]=['document'=>json_decode($row['document'],true),'revision'=>(int)$row['revision']];
 foreach(cmsSpecs() as $key=>$spec)if(!isset($docs[$key]))$docs[$key]=['document'=>$spec['defaults'],'revision'=>0];
 return $docs;
}
function cmsProducts():array {
 static $products;
 if($products===null){$products=[];foreach(db()->query('SELECT * FROM products WHERE active=1') as $p)$products[$p['slug']]=productData($p);}
 return $products;
}
function cmsAsset(string $path,string $kind,bool $optional=false):string {
 if($path===''&&$optional)return '';
 $extensions=$kind==='video'?'mp4':'png|jpe?g|webp';
 if(!preg_match('#^/(images|reference|uploads)/[^/\\\\]+\.('.$extensions.')$#ui',$path)||!is_file(ROOT.'/public'.$path))fail('Selecciona un archivo válido de la biblioteca.');
 return $path;
}
function cmsValidateAction(mixed $action):array {
 if(!is_array($action)||!is_string($action['type']??null)||!is_string($action['value']??null))fail('Selecciona el destino del botón.');
 $type=$action['type'];$value=trim($action['value']);
 if(mb_strlen($value)>500||$value==='')fail('El destino está vacío o es demasiado largo.');
 if($type==='category'){
  $categories=array_unique(array_column(cmsProducts(),'category'));
  if($value!=='Todos'&&!in_array($value,$categories,true))fail('La categoría seleccionada no existe en el catálogo.');
 }elseif($type==='product'){
  if(!isset(cmsProducts()[$value]))fail('El producto seleccionado no está activo.');
 }elseif($type==='section'){
  if(!in_array($value,['catalogo','mas-vendidos','colecciones','films','nosotros','ayuda','corporativos'],true))fail('Sección de destino inválida.');
 }elseif($type==='url'){
  if(!in_array($value,['/','/admin.php'],true)&&(!filter_var($value,FILTER_VALIDATE_URL)||!in_array(strtolower(parse_url($value,PHP_URL_SCHEME)??''),['http','https'],true)))fail('Usa una dirección http:// o https:// válida.');
 }elseif($type!=='search')fail('Tipo de destino inválido.');
 return ['type'=>$type,'value'=>$value];
}
function cmsValidateFields(array $definitions,mixed $data):array {
 if(!is_array($data))fail('Contenido inválido.');$out=[];
 foreach($definitions as $field){
  $key=$field['key'];$value=$data[$key]??null;$type=$field['type'];
  if($type==='boolean'){if(!is_bool($value))fail('Revisa '.$field['label'].'.');$out[$key]=$value;continue;}
  if($type==='number'){
   if(!is_int($value)||$value<$field['min']||$value>$field['max'])fail('Revisa '.$field['label'].'.');$out[$key]=$value;continue;
  }
  if($type==='action'){$out[$key]=cmsValidateAction($value);continue;}
  if(!is_string($value))fail('Completa '.$field['label'].'.');$value=trim($value);
  if($value===''&&empty($field['optional']))fail('Completa '.$field['label'].'.');
  if(mb_strlen($value)>($type==='textarea'?4000:600))fail('El texto de '.$field['label'].' es demasiado largo.');
  if(in_array($type,['image','video'],true))$value=cmsAsset($value,$type,!empty($field['optional']));
  if($type==='product'&&!isset(cmsProducts()[$value]))fail('Elige un producto activo.');
  $out[$key]=$value;
 }
 return $out;
}
function cmsValidateDocument(array $spec,mixed $document):array {
 if(!is_array($document))fail('Contenido inválido.');
 $values=cmsValidateFields($spec['fields'],$document['values']??null);
 if(!empty($spec['required']))$values['enabled']=true;
 $items=$document['items']??[];
 if(!is_array($items)||!array_is_list($items)||count($items)>($spec['max_rows']??0)||count($items)<($spec['min_rows']??0))fail('Revisa la cantidad de elementos de esta sección.');
 $rows=[];$ids=[];
 foreach($items as $item){
  if(!is_array($item))fail('Elemento inválido.');
  $id=$item['id']??'';
  if(!is_string($id)||!preg_match('/^[a-zA-Z0-9_-]{1,80}$/',$id)||isset($ids[$id]))fail('Identificador repetido o inválido.');
  $ids[$id]=true;$rows[]=['id'=>$id]+cmsValidateFields($spec['row_fields'],$item);
 }
 if(!empty($spec['require_enabled'])&&!array_filter($rows,fn($row)=>$row['enabled']))fail('Debe quedar al menos una diapositiva visible.');
 return ['values'=>$values,'items'=>$rows];
}
function cmsAction(array $action):string {
 $type=$action['type']??'section';$value=$action['value']??'catalogo';
 if($type==='category')return 'href="#catalogo" data-category="'.e($value).'"';
 if($type==='search')return 'href="#catalogo" data-query="'.e($value).'"';
 if($type==='product'){
  $p=cmsProducts()[$value]??null;
  return $p?'href="#catalogo" data-product="'.$p['id'].'"':'href="#catalogo" data-category="Todos"';
 }
 if($type==='url')return 'href="'.e($value).'"'.(str_starts_with($value,'http')?' target="_blank" rel="noopener"':'');
 return 'href="#'.e($value).'" data-section-target="'.e($value).'"';
}
function cmsRows(string $key,array $items):string {
 $html='';$items=array_values(array_filter($items,fn($r)=>$r['enabled']??true));
 if($key==='navigation'){
  $groups=[];foreach($items as $row)if($row['group']!=='')$groups[$row['group']][]=$row;
  $done=[];foreach($items as $row){
   $link=fn($r)=>'<a '.cmsAction($r['action']).'>'.e($r['label']).'</a>';
   if($row['group']==='')$html.=$link($row);
   elseif(!isset($done[$row['group']])){$done[$row['group']]=true;$html.='<details class="nav-dropdown"><summary>'.e($row['group']).'<svg class="icon"><use href="/assets/icons.svg#chevron"></use></svg></summary><div>'.implode('',array_map($link,$groups[$row['group']])).'</div></details>';}
  }return $html;
 }
 foreach($items as $row){
  if($key==='faq'){$html.='<details><summary>'.e($row['question']).'<svg class="icon"><use href="/assets/icons.svg#plus"></use></svg></summary><p>'.nl2br(e($row['answer'])).'</p></details>';continue;}
  $p=cmsProducts()[$row['product']]??null;if(!$p)continue;
  if($key==='bestsellers'){
   $image=$row['image']?:$p['image'];
   // Uploaded replacements from Products take precedence over the imported cover.
   if(str_starts_with($p['image'],'/uploads/'))$image=$p['image'];
   $html.='<article class="magia-product-card"><a class="magia-product-card__link" href="#catalogo" data-product="'.$p['id'].'" aria-label="'.e($p['name']).'"><div class="magia-product-card__media"><img class="magia-product-card__image magia-product-card__image--primary" src="'.e($image).'" alt="'.e($p['name']).'" loading="lazy" width="900" height="900">';
   if($row['secondary']&&!str_starts_with($p['image'],'/uploads/'))$html.='<img class="magia-product-card__image magia-product-card__image--secondary" src="'.e($row['secondary']).'" alt="" loading="lazy" width="900" height="900">';
   $html.='<div class="magia-product-card__badge">'.($p['available']?'Disponible':'No disponible').'</div></div><div class="magia-product-card__content"><h3 class="magia-product-card__title">'.e($p['name']).'</h3><div class="magia-product-card__price-row"><span class="magia-product-card__price">S/ '.number_format($p['price'],2).'</span></div></div></a></article>';
  }elseif($key==='films'){
   $html.='<article class="film-card"><video muted loop playsinline preload="none" poster="'.e($row['poster']).'" aria-label="'.e($p['name']).'"><source src="'.e($row['video']).'" type="video/mp4"></video><button class="film-play" aria-label="Reproducir video de '.e($p['name']).'">▶</button><button class="film-product" data-product="'.$p['id'].'"><img src="'.e($p['image']).'" alt="" loading="lazy"><span>'.e($p['name']).'</span><svg class="icon"><use href="/assets/icons.svg#plus"></use></svg></button></article>';
  }
 }
 return $html;
}
function cmsSlider(array $doc):string {
 $slides=array_values(array_filter($doc['items'],fn($r)=>$r['enabled']));
 $auto=$doc['values']['autoplay'];
 $html='<section class="campaign-hero" aria-label="Flores para cada momento" data-autoplay="'.($auto?'true':'false').'" data-interval="'.(int)$doc['values']['interval'].'">';
 foreach($slides as $i=>$row){
  $html.='<div class="campaign-slide '.($i===0?'is-active':'').'" data-hero-slide="'.$i.'"'.($i?' inert':'').'>';
  if($row['video'])$html.='<video class="campaign-video" '.($i===0&&$auto?'autoplay':'').' muted loop playsinline preload="'.($i===0?'auto':'none').'" poster="'.e($row['poster']).'" aria-hidden="true"><source src="'.e($row['video']).'" type="video/mp4"></video>';
  else $html.='<img class="campaign-video" src="'.e($row['poster']).'" alt="" '.($i===0?'fetchpriority="high"':'loading="lazy"').'>';
  $tag=$i===0?'h1':'h2';
  $html.='<div class="campaign-shade"></div><div class="campaign-copy"><'.$tag.'>'.e($row['title']).'</'.$tag.'><p>'.e($row['subtitle']).'</p><a class="campaign-button" '.cmsAction($row['action']).'><span class="campaign-arrow">↗</span><span>'.e($row['button_label']).'</span></a></div></div>';
 }
 $html.='<div class="hero-dots" aria-label="Banners">';
 foreach($slides as $i=>$row)$html.='<button data-hero="'.$i.'" aria-label="Ver banner '.e($row['title']).'" aria-pressed="'.($i===0?'true':'false').'"></button>';
 return $html.'</div><button class="hero-pause" id="hero-pause" aria-label="'.($auto?'Pausar banner':'Reproducir banner').'">'.($auto?'Ⅱ':'▶').'</button></section>';
}
function cmsRenderModule(string $key,array $doc):string {
 if(isset($doc['values']['enabled'])&&!$doc['values']['enabled'])return '';
 if($key==='slider')return cmsSlider($doc);
 if($key==='navigation')return cmsRows($key,$doc['items']);
 if($key==='seo')return '';
 $template=file_get_contents(ROOT.'/src/views/cms/'.$key.'.html');$replace=[];
 foreach($doc['values'] as $name=>$value){
  if(is_array($value))$replace['data-cms-action="'.$name.'"']=cmsAction($value);
  elseif(is_string($value))$replace['{{value:'.$name.'}}']=e($value);
 }
 $replace['{{rows:'.$key.'}}']=cmsRows($key,$doc['items']);
 if($key==='films')$template=str_replace('class="film-section"','class="film-section" style="background-image:url(&quot;'.e($doc['values']['background']).'&quot;)"',$template);
 return strtr($template,$replace);
}
function cmsRenderPage():string {
 $docs=cmsDocuments();$shop=settings();$replace=[];
 foreach($docs as $key=>$entry)$replace['{{module:'.$key.'}}']=cmsRenderModule($key,$entry['document']);
 $html=strtr(file_get_contents(ROOT.'/src/views/cms/page.html'),$replace);
 $replace=['{{rows:navigation}}'=>cmsRows('navigation',$docs['navigation']['document']['items'])];
 foreach(['result-count','catalog-toolbar','search-status','product-grid'] as $name)$replace['{{fragment:'.$name.'}}']=file_get_contents(ROOT.'/src/views/cms/'.$name.'.html');
 $html=strtr($html,$replace);
 $categories=array_values(array_unique(array_column(cmsProducts(),'category')));sort($categories);
 $chips='<button class="active" data-category="Todos">Todos los detalles</button>';
 foreach($categories as $category)$chips.='<button data-category="'.e($category).'">'.e($category).'</button>';
 $first=current(array_filter($docs['slider']['document']['items'],fn($r)=>$r['enabled']));
 $contact='<span>'.e($shop['address']).'</span>';
 if($shop['contact_email'])$contact.='<a href="mailto:'.e($shop['contact_email']).'">'.e($shop['contact_email']).'</a>';
 $whatsapp=$shop['whatsapp']?'<a class="whatsapp-button" href="https://wa.me/'.e($shop['whatsapp']).'" target="_blank" rel="noopener">Conversemos ↗</a>':'';
 return strtr($html,['{{categories}}'=>$chips,'{{contact}}'=>$contact,'{{copyright}}'=>'© '.date('Y').' '.e($shop['brand']).'.','{{whatsapp}}'=>$whatsapp,'{{page_title}}'=>e($shop['brand'].' · '.$docs['seo']['document']['values']['title']),'{{page_description}}'=>e($docs['seo']['document']['values']['description']),'{{hero_poster}}'=>e($first['poster']??'')]);
}
