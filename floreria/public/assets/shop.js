'use strict';
const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(value);
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Browsing can continue without device persistence. */ } }
let products=[], shop={}, csrfToken='', category='Todos', query='', favoritesOnly=false, visible=16, toastTimer;
let cart=stored('magia-cart',[]), favorites=stored('magia-favorites',[]);
if(!Array.isArray(cart)) cart=[];
if(!Array.isArray(favorites)) favorites=[];
cart=cart.filter(item=>item&&Number.isInteger(item.id)&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=20);
favorites=favorites.filter(Number.isInteger);
const checkoutMarkup=$('#checkout-content').innerHTML;
let requestKey='';

function toast(message) { const element=$('#toast'); element.textContent=message; element.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>element.hidden=true,3300); }
function openDialog(id) { const element=document.getElementById(id); if(!element.open) element.showModal(); }
function closeDialog(id) { document.getElementById(id).close(); }
function updateCounts() {
 const count=cart.reduce((sum,item)=>sum+item.quantity,0);
 $('#cart-count').textContent=count; $('#cart-count').hidden=count===0;
 $('#favorite-count').textContent=favorites.length; $('#favorite-count').hidden=favorites.length===0;
 $('#favorites-toggle').setAttribute('aria-pressed',String(favoritesOnly));
}
function cartRows() { return cart.map(item=>({...item,product:products.find(p=>p.id===item.id)})).filter(item=>item.product); }
function subtotal() { return cartRows().reduce((sum,item)=>sum+Math.round(item.product.price*100)*item.quantity,0)/100; }
function addToCart(id) {
 const product=products.find(p=>p.id===id);
 if(!product?.available) return toast('Este detalle no está disponible por el momento.');
 const existing=cart.find(item=>item.id===id);
 if(existing?.quantity>=20) return toast('Puedes agregar hasta 20 unidades por producto.');
 if(!existing&&cart.length>=40) return toast('Puedes elegir hasta 40 productos diferentes.');
 if(existing) existing.quantity++; else cart.push({id,quantity:1});
 requestKey=''; save('magia-cart',cart); updateCounts(); renderCart(); toast('Añadido a tu bolsa de magia.');
}
function toggleFavorite(id) {
 favorites=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];
 save('magia-favorites',favorites); updateCounts(); renderProducts();
}
function connectReferenceProducts() {
 document.querySelectorAll('[data-slug]').forEach(element=>{
  const p=products.find(product=>product.slug===element.dataset.slug);
  if(!p){const card=element.closest('.magia-product-card,.film-card');if(card)card.hidden=true;return;}
  element.dataset.product=p.id;
  const card=element.closest('.magia-product-card');
  if(card){
   card.querySelector('.magia-product-card__title').textContent=p.name;
   card.querySelector('.magia-product-card__price').textContent=money(p.price);
   const compare=card.querySelector('.magia-product-card__compare');
   const unchangedPrice=Number(card.dataset.originalPrice)===p.price;
   if(compare)compare.hidden=!unchangedPrice;
   const sale=card.querySelector('.magia-product-card__sale');if(sale)sale.hidden=!unchangedPrice||!p.available;
   if(element.dataset.originalImage&&element.dataset.originalImage!==p.image){
    card.querySelector('.magia-product-card__image--primary').src=p.image;
    const secondary=card.querySelector('.magia-product-card__image--secondary');if(secondary)secondary.remove();
   }
   const badge=card.querySelector('.magia-product-card__badge');if(badge)badge.textContent=p.available?'Disponible':'No disponible';
   element.setAttribute('aria-label',p.name);
  }
 });
}
function filteredProducts() {
 let list=products.filter(p=>(category==='Todos'||p.category===category)&&(!favoritesOnly||favorites.includes(p.id)));
 if(query) { const term=normalize(query); list=list.filter(p=>normalize(p.name+' '+p.category+' '+p.description).includes(term)); }
 const sort=$('#sort').value;
 if(sort==='price-asc') list.sort((a,b)=>a.price-b.price);
 else if(sort==='price-desc') list.sort((a,b)=>b.price-a.price);
 else if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 else list.sort((a,b)=>Number(b.featured)-Number(a.featured)||Number(b.available)-Number(a.available)||a.id-b.id);
 return list;
}
function renderProducts() {
 const list=filteredProducts();
 $('#result-count').textContent=`${list.length} ${list.length===1?'detalle':'detalles'} para regalar`;
 const hasFilters=query||favoritesOnly||category!=='Todos';
 $('#search-status').hidden=!hasFilters;
 $('#search-status span').textContent=[favoritesOnly?'Tus favoritos':'',category!=='Todos'?category:'',query?`Búsqueda: “${query}”`:''].filter(Boolean).join(' · ');
 document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('active',button.dataset.category===category&&!favoritesOnly));
 $('#load-more').hidden=list.length<=visible;
 if(!list.length) {
  $('#product-grid').innerHTML=`<div class="empty-state">${icon(favoritesOnly?'heart':'search')}<h3>${favoritesOnly?'Guarda los detalles que te enamoran.':'No encontramos ese detalle.'}</h3><p>${favoritesOnly?'Toca el corazón de un producto para encontrarlo aquí.':'Prueba otra palabra o explora todas las colecciones.'}</p><button class="button button-outline" data-reset>Explorar el catálogo ${icon('arrow')}</button></div>`;
  return;
 }
 $('#product-grid').innerHTML=list.slice(0,visible).map(p=>`<article class="product-card"><div class="product-image"><button class="product-open" data-product="${p.id}" aria-label="Ver ${escapeHTML(p.name)}"><img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" width="900" height="900"></button>${!p.available?'<span class="product-badge">No disponible</span>':p.featured?'<span class="product-badge">Un favorito</span>':''}<button class="icon-button favorite-button ${favorites.includes(p.id)?'selected':''}" data-favorite="${p.id}" aria-label="${favorites.includes(p.id)?'Quitar de':'Añadir a'} favoritos: ${escapeHTML(p.name)}" aria-pressed="${favorites.includes(p.id)}">${icon('heart')}</button></div><div class="product-bottom"><div><div class="product-category">${escapeHTML(p.category)}</div><button class="product-name" data-product="${p.id}">${escapeHTML(p.name)}</button><span class="product-price">${money(p.price)}</span></div><button class="icon-button quick-add" data-add="${p.id}" aria-label="Añadir ${escapeHTML(p.name)} al carrito" ${p.available?'':'disabled'}>${icon('plus')}</button></div></article>`).join('');
}
function selectCategory(value,scroll=true) {
 category=value; favoritesOnly=false; query=''; $('#header-search').value=''; visible=16;
 renderProducts(); updateCounts(); document.body.classList.remove('mobile-nav-open');
 if(scroll) $('#catalogo').scrollIntoView({behavior:'smooth'});
}
function showProduct(id) {
 const p=products.find(product=>product.id===id); if(!p) return;
 $('#product-detail').innerHTML=`<div class="product-detail-grid"><img class="detail-photo" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" width="900" height="900"><div class="detail-copy"><span class="eyebrow">${escapeHTML(p.category)}</span><h2>${escapeHTML(p.name)}</h2><div class="detail-price">${money(p.price)}</div><div class="detail-description">${escapeHTML(p.description)}</div><button class="button" data-add="${p.id}" ${p.available?'':'disabled'}>${p.available?'Añadir a mi bolsa':'No disponible'} ${icon('bag')}</button><div class="detail-fineprint">${icon('gift')} Incluye tu dedicatoria al registrar el pedido.<br>Imagen referencial. Las flores y los colores pueden variar según la temporada.</div></div></div>`;
 openDialog('product-dialog');
}
function renderCart() {
 const rows=cartRows();
 if(!rows.length) {
  $('#cart-items').innerHTML=`<div class="cart-empty">${icon('bag')}<h3>Aquí empieza la sorpresa.</h3><p>Elige un detalle y prepárate para hacer su día.</p><button class="button button-outline" data-close="cart-dialog">Descubrir detalles ${icon('arrow')}</button></div>`;
  $('#cart-summary').hidden=true; return;
 }
 $('#cart-summary').hidden=false;
 $('#cart-items').innerHTML=rows.map(item=>`<article class="cart-item"><img src="${escapeHTML(item.product.image)}" alt="${escapeHTML(item.product.name)}" width="83" height="93"><div><span class="cart-item-name">${escapeHTML(item.product.name)}</span><span class="cart-item-price">${money(item.product.price)}</span><div class="cart-item-controls"><div class="quantity"><button data-quantity="${item.id}" data-delta="-1" aria-label="Reducir cantidad de ${escapeHTML(item.product.name)}">${icon('minus')}</button><span>${item.quantity}</span><button data-quantity="${item.id}" data-delta="1" aria-label="Aumentar cantidad de ${escapeHTML(item.product.name)}">${icon('plus')}</button></div><button class="remove-item" data-remove="${item.id}">Quitar</button></div></div></article>`).join('');
 const total=subtotal(), remaining=Math.max(0,shop.free_shipping-total);
 $('#cart-summary').innerHTML=`<p class="shipping-note">${remaining?`Te faltan ${money(remaining)} para el envío gratis.`:`${icon('check')} Tu pedido tiene envío gratis.`}</p><div class="shipping-progress"><span style="width:${Math.min(100,total/shop.free_shipping*100)}%"></span></div><div class="summary-line"><span>Subtotal</span><strong>${money(total)}</strong></div><p class="shipping-note">El envío se calcula al elegir tu distrito.</p><button class="button" id="begin-checkout">Preparar mi pedido ${icon('arrow')}</button>`;
}
function updateCheckoutTotal() {
 const total=subtotal(), district=shop.districts.find(d=>d.name===$('#delivery-district').value);
 const delivery=total>=shop.free_shipping?0:district?Number(district.price):null;
 $('#checkout-summary').innerHTML=`<div class="summary-line"><span>${cart.reduce((sum,i)=>sum+i.quantity,0)} detalles · Subtotal</span><strong>${money(total)}</strong></div><div class="summary-line"><span>Envío</span><strong>${delivery===null?'Selecciona distrito':delivery===0?'Gratis':money(delivery)}</strong></div><div class="summary-line total"><span>Total</span><span>${money(total+(delivery||0))}</span></div>`;
}
function startCheckout() {
 if(!cartRows().length) return;
 closeDialog('cart-dialog');
 $('#checkout-content').innerHTML=checkoutMarkup;
 $('#delivery-district').innerHTML='<option value="">Selecciona un distrito</option>'+shop.districts.map(d=>`<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)}</option>`).join('');
 $('#delivery-date').min=shop.today;
 const maxDate=new Date(shop.today+'T12:00:00Z'); maxDate.setUTCDate(maxDate.getUTCDate()+90); $('#delivery-date').max=maxDate.toISOString().slice(0,10);
 updateCheckoutTotal();
 if(!requestKey) requestKey=crypto.randomUUID();
 openDialog('checkout-dialog');
}
async function submitOrder(form) {
 const button=form.querySelector('[type="submit"]'); if(button.disabled) return;
 const data=Object.fromEntries(new FormData(form)); data.items=cart.map(({id,quantity})=>({id,quantity})); data.request_key=requestKey;
 button.disabled=true; button.textContent='Registrando tu pedido…'; $('#checkout-error').textContent='';
 try {
  const response=await fetch('/api/orders.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(data)});
  const result=await response.json(); if(!response.ok) throw new Error(result.error||'No pudimos registrar el pedido.');
  cart=[]; requestKey=''; save('magia-cart',cart); updateCounts(); renderCart();
  $('#checkout-content').innerHTML=`<div class="order-success"><div class="success-icon">${icon('check')}</div><span class="eyebrow">EL PRIMER PASO YA ESTÁ HECHO</span><h2>Un poquito de magia<br><em>está en camino.</em></h2><p>Registramos tu pedido. Nuestro equipo coordinará contigo la disponibilidad, la entrega y el pago.</p><div class="order-reference">${escapeHTML(result.reference)}</div><p>Total del pedido: <strong>${money(result.total)}</strong><br>Estado: pendiente de confirmación.<br>Guarda este código para consultar tu pedido.</p><button class="button" data-close="checkout-dialog">Seguir descubriendo ${icon('arrow')}</button></div>`;
 } catch(error) {
  $('#checkout-error').textContent=error.message||'No hay conexión. Intenta nuevamente.';
  button.disabled=false; button.innerHTML=`Registrar mi pedido ${icon('arrow')}`;
 }
}
document.addEventListener('click',event=>{
 const target=event.target.closest('button,a'); if(!target) return;
 if(target.dataset.category) { event.preventDefault(); selectCategory(target.dataset.category); }
 else if(target.dataset.query) {
  event.preventDefault();query=target.dataset.query;category='Todos';favoritesOnly=false;visible=16;
  $('#header-search').value=query;renderProducts();updateCounts();$('#catalogo').scrollIntoView({behavior:'smooth'});
 }
 else if(target.dataset.product) { event.preventDefault();showProduct(Number(target.dataset.product)); }
 else if(target.dataset.add) addToCart(Number(target.dataset.add));
 else if(target.dataset.favorite) toggleFavorite(Number(target.dataset.favorite));
 else if(target.dataset.close) closeDialog(target.dataset.close);
 else if(target.hasAttribute('data-reset')) selectCategory('Todos',false);
 else if(target.dataset.remove) { cart=cart.filter(i=>i.id!==Number(target.dataset.remove)); requestKey=''; save('magia-cart',cart); renderCart(); updateCounts(); }
 else if(target.dataset.quantity) {
  const item=cart.find(i=>i.id===Number(target.dataset.quantity)); if(!item) return;
  const value=item.quantity+Number(target.dataset.delta);
  if(value>20) return toast('Puedes agregar hasta 20 unidades por producto.');
  if(value<1) cart=cart.filter(i=>i!==item); else item.quantity=value;
  requestKey=''; save('magia-cart',cart); renderCart(); updateCounts();
 }
 else if(target.id==='begin-checkout') startCheckout();
});
document.addEventListener('submit',event=>{if(event.target.id==='checkout-form'){event.preventDefault();submitOrder(event.target);}});
document.addEventListener('change',event=>{if(event.target.id==='delivery-district') updateCheckoutTotal();});
$('#cart-toggle').addEventListener('click',()=>{renderCart();openDialog('cart-dialog');});
$('#favorites-toggle').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;category='Todos';query='';$('#header-search').value='';visible=16;renderProducts();updateCounts();$('#catalogo').scrollIntoView({behavior:'smooth'});});
$('#menu-button').addEventListener('click',()=>{const open=document.body.classList.toggle('mobile-nav-open');$('#menu-button').setAttribute('aria-expanded',String(open));});
$('#search-toggle').addEventListener('click',()=>{$('#search-strip').hidden=!$('#search-strip').hidden;if(!$('#search-strip').hidden)$('#header-search').focus();});
$('#search-close').addEventListener('click',()=>{$('#search-strip').hidden=true;$('#search-toggle').focus();});
$('#header-search').addEventListener('input',event=>{query=event.target.value.trim();category='Todos';favoritesOnly=false;visible=16;renderProducts();updateCounts();});
$('#header-search').addEventListener('keydown',event=>{if(event.key==='Enter'){$('#catalogo').scrollIntoView({behavior:'smooth'});event.target.blur();}});
$('#sort').addEventListener('change',()=>{visible=16;renderProducts();});
$('#load-more').addEventListener('click',()=>{visible+=16;renderProducts();});
$('#clear-filters').addEventListener('click',()=>selectCategory('Todos',false));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
 if(event.target!==dialog) return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom) dialog.close();
}));
async function loadCatalog() {
 try {
  const response=await fetch('/api/catalog.php'); const data=await response.json(); if(!response.ok) throw new Error(data.error);
  products=data.products; shop=data.settings; shop.today=data.today; csrfToken=data.csrf;
  const ids=new Set(products.map(p=>p.id));cart=cart.filter(i=>ids.has(i.id));favorites=favorites.filter(id=>ids.has(id));
  save('magia-cart',cart);save('magia-favorites',favorites);connectReferenceProducts();renderProducts();updateCounts();renderCart();
 } catch(error) {
  $('#product-grid').innerHTML=`<div class="empty-state">${icon('flower')}<h3>No pudimos cargar los detalles.</h3><p>${escapeHTML(error.message||'Revisa tu conexión e intenta otra vez.')}</p><button class="button button-outline" id="retry-catalog">Volver a intentar</button></div>`;
  $('#result-count').textContent='';$('#retry-catalog').addEventListener('click',loadCatalog);
 }
}
loadCatalog();
