'use strict';
const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(value);
const states={pendiente:'Pendiente',confirmado:'Confirmado',preparando:'Preparando',en_camino:'En camino',entregado:'Entregado',cancelado:'Cancelado'};
let csrfToken='',admin=null,orders=[],products=[],settings={},page=1,toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
async function api(action,data=null){
 const options=data===null?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(data)};
 const response=await fetch('/api/admin.php?action='+encodeURIComponent(action),options);
 const result=await response.json();
 if(!response.ok){if(response.status===401&&action!=='login')showLogin();throw new Error(result.error||'No se pudo completar la operación.');}
 return result;
}
function showLogin(){admin=null;$('#admin-screen').hidden=true;$('#login-screen').hidden=false;}
function showPanel(){
 $('#login-screen').hidden=true;$('#admin-screen').hidden=false;$('#admin-name').textContent=admin.name;
 window.dispatchEvent(new CustomEvent('admin:ready'));
}
function badge(status){return `<span class="status-badge ${escapeHTML(status)}">${escapeHTML(states[status]||status)}</span>`;}
async function refresh(){
 try{
  const result=await api('dashboard');orders=result.orders;products=result.products;settings=result.settings;
  renderStats();renderOrders();renderProducts();fillSettings();$('#admin-error').textContent='';
 }catch(error){$('#admin-error').textContent=error.message;}
}
function renderStats(){
 const pending=orders.filter(o=>o.status==='pendiente').length;
 const delivered=orders.filter(o=>o.status==='entregado').length;
 const cards=[['Pedidos recientes',orders.length,'Últimos 500 pedidos'],['Por confirmar',pending,'Pedidos pendientes'],['Entregados',delivered,'En la lista reciente'],['Productos activos',products.length,'En tu catálogo']];
 $('#admin-stats').innerHTML=cards.map(([label,value,description])=>`<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${description}</small></div>`).join('');
}
function renderOrders(){
 const status=$('#status-filter').value,list=orders.filter(o=>!status||o.status===status);
 $('#orders-table').innerHTML=list.length?list.map(o=>`<tr><td><strong>${escapeHTML(o.reference)}</strong><small>${escapeHTML(o.created_at)}</small></td><td>${escapeHTML(o.customer)}<small>${escapeHTML(o.phone)}</small></td><td>${escapeHTML(o.delivery_date)}<small>${escapeHTML(o.district)}</small></td><td>${money(o.total)}</td><td>${badge(o.status)}</td><td><button class="table-action" data-order="${o.id}">Ver pedido</button></td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">Aquí aparecerán tus pedidos cuando los clientes los registren en la tienda.</td></tr>';
}
function renderProducts(){
 const term=$('#product-search').value.toLowerCase(),category=$('#product-category').value;
 const list=products.filter(p=>(!category||p.category===category)&&p.name.toLowerCase().includes(term));
 const maxPage=Math.max(1,Math.ceil(list.length/20));page=Math.min(page,maxPage);
 $('#products-table').innerHTML=list.length?list.slice((page-1)*20,page*20).map(p=>`<tr><td><div class="admin-product-name"><img src="${escapeHTML(p.image)}" alt="" width="48" height="48"><span>${escapeHTML(p.name)}${p.featured?'<small>Destacado</small>':''}</span></div></td><td>${escapeHTML(p.category)}</td><td>${money(p.price)}</td><td>${p.available?'<span class="status-badge entregado">Sí</span>':'<span class="status-badge cancelado">No</span>'}</td><td><button class="table-action" data-edit="${p.id}">Editar</button></td></tr>`).join(''):'<tr><td colspan="5" class="table-empty">No hay productos que coincidan con tu búsqueda.</td></tr>';
 $('#product-page').textContent=`Página ${page} de ${maxPage} · ${list.length} productos`;
 $('#product-prev').disabled=page===1;$('#product-next').disabled=page===maxPage;
 const selected=$('#product-category').value;
 const categories=[...new Set(products.map(p=>p.category))].sort();
 $('#product-categories').innerHTML=categories.map(c=>`<option value="${escapeHTML(c)}"></option>`).join('');
 $('#product-category').innerHTML='<option value="">Todas las categorías</option>'+categories.map(c=>`<option ${selected===c?'selected':''}>${escapeHTML(c)}</option>`).join('');
}
function openOrder(id){
 const o=orders.find(order=>order.id===id);if(!o)return;
 $('#order-detail').innerHTML=`<div class="order-heading"><div><span class="eyebrow">DETALLE DEL PEDIDO</span><h2>${escapeHTML(o.reference)}</h2></div>${badge(o.status)}</div><div class="order-info-grid"><div><h3>Cliente</h3><p>${escapeHTML(o.customer)}<br>${escapeHTML(o.phone)}<br>${escapeHTML(o.email)}</p></div><div><h3>Entrega</h3><p><strong>${escapeHTML(o.recipient)}</strong><br>${escapeHTML(o.address)}<br>${escapeHTML(o.district)}</p><small>Fecha: ${escapeHTML(o.delivery_date)}</small></div></div>${o.dedication?`<div class="order-dedication">“${escapeHTML(o.dedication)}”</div>`:''}<div>${o.items.map(item=>`<div class="order-item-row"><span>${item.quantity} × ${escapeHTML(item.product_name)}</span><strong>${money(item.quantity*item.unit_price)}</strong></div>`).join('')}</div><div class="order-totals"><div class="summary-line"><span>Subtotal</span><strong>${money(o.subtotal)}</strong></div><div class="summary-line"><span>Envío</span><strong>${money(o.delivery)}</strong></div><div class="summary-line total"><span>Total</span><strong>${money(o.total)}</strong></div></div><form id="order-state-form" class="order-state-form" data-id="${o.id}"><label>Estado del pedido<select name="status">${Object.entries(states).map(([key,label])=>`<option value="${key}" ${key===o.status?'selected':''}>${label}</option>`).join('')}</select></label><button class="button" type="submit">Guardar estado</button></form><p class="form-error" id="order-error" role="alert"></p>`;
 $('#order-dialog').showModal();
}
function editProduct(id=null){
 const p=products.find(product=>product.id===id),form=$('#product-form');form.reset();
 form.elements.id.value=p?.id||'';form.elements.image.value=p?.image||'';
 form.elements.name.value=p?.name||'';form.elements.category.value=p?.category||'Ramos';form.elements.price.value=p?.price||'';
 form.elements.description.value=p?.description||'';form.elements.available.checked=p?.available??true;form.elements.featured.checked=p?.featured??false;
 $('#edit-image').src=p?.image||'/images/box-eres-magia.webp';$('#delete-product').hidden=!p;
 $('#product-error').textContent='';$('#product-dialog-title').textContent=p?'Editar producto':'Nuevo producto';$('#edit-product-dialog').showModal();
}
function districtRow(zone={name:'',price:0}){
 return `<div class="district-row"><input value="${escapeHTML(zone.name)}" aria-label="Distrito" placeholder="Distrito" required minlength="2" maxlength="80"><input type="number" value="${zone.price}" min="0" max="500" step="0.01" aria-label="Costo de envío en soles" required><button type="button" data-remove-district aria-label="Quitar distrito">×</button></div>`;
}
function fillSettings(){
 const form=$('#settings-form');for(const key of ['brand','tagline','address','contact_email','whatsapp','free_shipping']) form.elements[key].value=settings[key]??'';
 $('#district-editor').innerHTML=(settings.districts||[]).map(districtRow).join('');
}
function selectTab(tab){
 document.getElementById("admin-screen").classList.toggle("editing-content",tab==="content");
 const labels={orders:'Pedidos',products:'Productos',content:'Contenido de la web',settings:'Mi tienda',account:'Mi cuenta'};
 document.querySelectorAll('.admin-tab').forEach(section=>section.hidden=section.id!==tab+'-tab');
 document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));$('#tab-title').textContent=labels[tab];
}
async function handleSubmit(form){
 const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
 const errorElement=$({ 'login-form':'#login-error','order-state-form':'#order-error','product-form':'#product-error','settings-form':'#settings-error','password-form':'#password-error'}[form.id]);
 if(errorElement)errorElement.textContent='';
 try{
  const data=Object.fromEntries(new FormData(form));
  if(form.id==='login-form'){
   const result=await api('login',{email:data.email,password:data.password});admin=result.admin;csrfToken=result.csrf;showPanel();await refresh();form.reset();
  }else if(form.id==='order-state-form'){
   await api('order',{id:Number(form.dataset.id),status:data.status});$('#order-dialog').close();await refresh();toast('Estado del pedido actualizado.');
  }else if(form.id==='product-form'){
   const file=form.elements.upload.files[0];
   if(file){
    if(file.size>5*1024*1024)throw new Error('La imagen debe pesar menos de 5 MB.');
    const upload=new FormData();upload.append('image',file);
    const response=await fetch('/api/admin.php?action=upload',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:upload});const result=await response.json();
    if(!response.ok)throw new Error(result.error);data.image=result.image;form.elements.image.value=result.image;
   }
   if(!data.image)throw new Error('Sube una imagen para el producto.');
   await api('product',{id:data.id?Number(data.id):null,name:data.name,description:data.description,category:data.category,price:Number(data.price),image:data.image,available:form.elements.available.checked,featured:form.elements.featured.checked});
   $('#edit-product-dialog').close();await refresh();toast('Producto guardado.');
  }else if(form.id==='settings-form'){
   data.free_shipping=Number(data.free_shipping);data.districts=[...document.querySelectorAll('.district-row')].map(row=>({name:row.querySelector('input').value.trim(),price:Number(row.querySelector('input[type="number"]').value)}));
   await api('settings',data);await refresh();toast('Datos de tu tienda actualizados.');
  }else if(form.id==='password-form'){
   if(data.password!==data.confirm)throw new Error('Las nuevas contraseñas no coinciden.');
   await api('password',{current:data.current,password:data.password});form.reset();toast('Contraseña actualizada.');
  }
 }catch(error){if(errorElement)errorElement.textContent=error.message;else toast(error.message);}
 finally{button.disabled=false;}
}
document.addEventListener('submit',event=>{event.preventDefault();handleSubmit(event.target);});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.tab)selectTab(button.dataset.tab);
 else if(button.dataset.order)openOrder(Number(button.dataset.order));
 else if(button.dataset.edit)editProduct(Number(button.dataset.edit));
 else if(button.dataset.close)document.getElementById(button.dataset.close).close();
 else if(button.hasAttribute('data-remove-district'))button.closest('.district-row').remove();
});
$('#status-filter').addEventListener('change',renderOrders);
$('#product-search').addEventListener('input',()=>{page=1;renderProducts();});
$('#product-category').addEventListener('change',()=>{page=1;renderProducts();});
$('#product-prev').addEventListener('click',()=>{page--;renderProducts();});
$('#product-next').addEventListener('click',()=>{page++;renderProducts();});
$('#new-product').addEventListener('click',()=>editProduct());
$('#add-district').addEventListener('click',()=>$('#district-editor').insertAdjacentHTML('beforeend',districtRow()));
$('#delete-product').addEventListener('click',async()=>{
 if(!confirm('¿Retirar este producto del catálogo? Los pedidos anteriores conservarán sus datos.'))return;
 try{await api('delete-product',{id:Number($('#product-form').elements.id.value)});$('#edit-product-dialog').close();await refresh();toast('Producto retirado del catálogo.');}catch(error){$('#product-error').textContent=error.message;}
});
$('#logout-button').addEventListener('click',async()=>{try{await api('logout',{});showLogin();}catch(error){toast(error.message);}});
$('#product-form').elements.upload.addEventListener('change',event=>{
 const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)return toast('La imagen debe pesar menos de 5 MB.');
 const reader=new FileReader();reader.onload=()=>$('#edit-image').src=reader.result;reader.readAsDataURL(file);
});
(async()=>{try{const result=await api('session');csrfToken=result.csrf;admin=result.admin;if(admin){showPanel();await refresh();}else showLogin();}catch(error){$('#login-error').textContent=error.message;}})();
