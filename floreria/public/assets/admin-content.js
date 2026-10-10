/* Structured content editor. Values and button destinations are persisted in MySQL. */
(()=>{
 'use strict';
 const panel=document.getElementById('cms-panel');
 let modules=[],entries={},cmsProducts=[],categories=[],current='',drafts={},dirty=new Set(),assets=null,mediaTarget='',mediaType='image',mediaPage=1;
 const esc=escapeHTML;
 async function request(action,data){
  const response=await fetch('/api/content.php?action='+action,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok){if(response.status===401)showLogin();throw new Error(result.error||'No se pudo completar la operación.');}return result;
 }
 const clone=value=>JSON.parse(JSON.stringify(value));
 const spec=()=>modules.find(m=>m.key===current);
 const options=(list,value)=>list.map(item=>{const [id,label]=Array.isArray(item)?item:[item,item];return `<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(label)}</option>`;}).join('');
 function actionValue(name,type,value){
  let list=null;
  if(type==='category')list=['Todos',...categories];
  if(type==='product')list=[['','Selecciona un producto'],...cmsProducts.map(p=>[p.slug,p.name])];
  if(type==='section')list=[['catalogo','Catálogo completo'],['mas-vendidos','Carrusel de productos'],['colecciones','Ocasiones'],['films','Videos'],['nosotros','Cuatro pasos'],['ayuda','Preguntas frecuentes'],['corporativos','Regalos corporativos']];
  return list?`<select name="${esc(name)}.value" aria-label="Destino" required>${options(list,value)}</select>`:`<input name="${esc(name)}.value" aria-label="${type==='search'?'Palabra a buscar':'Dirección del enlace'}" value="${esc(value)}" placeholder="${type==='search'?'Ej. girasol':'https://…'}" maxlength="500" required>`;
 }
 function field(field,value,name){
  const label=esc(field.label),id='cms-'+name.replace(/[^a-z0-9]/gi,'-'),required=field.optional?'':'required';
  let control='';
  if(field.type==='boolean')return `<label class="cms-toggle"><input type="checkbox" name="${name}" ${value?'checked':''}>${label}</label>`;
  if(field.type==='action')control=`<div class="cms-action"><select data-action-type="${name}" name="${name}.type" aria-label="Tipo de destino">${options([['category','Categoría de productos'],['product','Un producto'],['search','Resultados de una búsqueda'],['section','Sección de la página'],['url','Otro enlace']],value?.type||'category')}</select><div data-action-value="${name}">${actionValue(name,value?.type||'category',value?.value||'Todos')}</div></div>`;
  else if(field.type==='product')control=`<select id="${id}" name="${name}" required>${options([['','Selecciona un producto'],...cmsProducts.map(p=>[p.slug,p.name])],value)}</select>`;
  else if(field.type==='image'||field.type==='video')control=`<div class="cms-media-field">${value?(field.type==='image'?`<img src="${esc(value)}" alt="Vista previa" loading="lazy">`:`<video src="${esc(value)}" controls preload="none" muted></video>`):'<div class="cms-media-empty">Sin archivo seleccionado</div>'}<div><input id="${id}" name="${name}" value="${esc(value||'')}" readonly ${required} aria-label="${label}"><button type="button" class="button button-outline" data-pick-media="${name}" data-kind="${field.type}">Elegir o subir ${field.type==='image'?'imagen':'video'}</button>${field.optional?`<button type="button" class="text-link" data-clear-media="${name}">Quitar archivo</button>`:''}</div></div>`;
  else if(field.type==='textarea')control=`<textarea id="${id}" name="${name}" rows="3" maxlength="4000" ${required}>${esc(value||'')}</textarea>`;
  else if(field.type==='number')control=`<input id="${id}" name="${name}" type="number" min="${field.min}" max="${field.max}" step="1" value="${value}" required>`;
  else control=`<input id="${id}" name="${name}" value="${esc(value||'')}" maxlength="600" ${required}>`;
  return `<div class="cms-field ${['textarea','action','image','video'].includes(field.type)?'cms-wide':''}"><label for="${id}">${label}${field.optional?' <small>Opcional</small>':''}</label>${control}</div>`;
 }
 function rowTitle(row,index){return row.title||row.label||row.question||cmsProducts.find(p=>p.slug===row.product)?.name||'Elemento '+(index+1);}
 function render(){
  const module=spec(),doc=drafts[current],openIds=new Set([...panel.querySelectorAll('.cms-row[open]')].map(el=>el.dataset.id));
  document.querySelectorAll('[data-tab="content"]').forEach(b=>b.classList.toggle('active',b.dataset.module===(current==='slider'?'slider':current==='navigation'?'navigation':'header')));
  $('#tab-title').textContent=module.title;
  panel.innerHTML=`<div class="cms-topbar"><label>Editar parte de la tienda<select id="cms-module">${options(modules.map(m=>[m.key,m.title]),current)}</select></label><a href="/" class="button button-outline" target="_blank" rel="noopener">Ver tienda ↗</a><button type="button" class="text-link" id="cms-reload">Recargar sección</button></div><form id="cms-form" class="panel-card"><div class="panel-card-head"><div><h2>${esc(module.title)}</h2><p>${esc(module.description)}</p></div><span class="cms-save-status">${dirty.has(current)?'Cambios sin guardar':'Publicado en la tienda'}</span></div><fieldset class="cms-fieldset"><div class="cms-fields">${module.fields.filter(f=>!(module.required&&f.key==='enabled')).map(f=>field(f,doc.values[f.key],'v:'+f.key)).join('')}</div>${module.row_fields.length?`<div class="cms-list-head"><h3>${current==='slider'?'Diapositivas':current==='navigation'?'Enlaces del menú':'Elementos de la sección'} <small>(${doc.items.length})</small></h3><button class="button button-outline" type="button" id="cms-add">+ Agregar ${current==='slider'?'diapositiva':current==='navigation'?'enlace':'elemento'}</button></div><div class="cms-rows">${doc.items.map((row,index)=>`<details class="cms-row" data-id="${esc(row.id)}" ${openIds.has(row.id)||(!openIds.size&&index===0)?'open':''}><summary><span class="cms-row-number">${index+1}</span><span>${esc(rowTitle(row,index))}<small>${row.enabled===false?'Oculto':row.group?esc(row.group):'Visible'}</small></span><span class="cms-edit-hint">Editar ⌄</span></summary><div class="cms-row-body"><div class="cms-row-tools"><button type="button" data-move-row="${index}" data-delta="-1" ${index===0?'disabled':''}>↑ Subir</button><button type="button" data-move-row="${index}" data-delta="1" ${index===doc.items.length-1?'disabled':''}>↓ Bajar</button><button class="delete-button" type="button" data-remove-row="${index}" ${doc.items.length<=(module.min_rows||0)?'disabled':''}>Eliminar elemento</button></div><div class="cms-fields">${module.row_fields.map(f=>field(f,row[f.key],'r:'+index+':'+f.key)).join('')}</div></div></details>`).join('')}</div>`:''}<div class="cms-save-bar"><div><strong>Los cambios se publican al guardar.</strong><p>Después, actualiza la pestaña de la tienda para verlos.</p></div><button class="button" type="submit">Guardar y publicar</button></div></fieldset><p id="cms-error" class="form-error" role="alert"></p></form><div class="cms-guide"><strong>¿Dónde se administra cada botón?</strong><p>Menú y promociones: elige su destino en este editor. Productos, precios y disponibilidad: Productos. Carrito y compra: catálogo y Pedidos. WhatsApp, contacto y entrega: Mi tienda. Buscar, ordenar, favoritos y controles de video funcionan con los datos publicados.</p></div>`;
 }
 function readField(form,f,name){
  if(f.type==='action')return {type:form.elements[name+'.type'].value,value:form.elements[name+'.value'].value};
  const input=form.elements[name];if(!input)return drafts[current].values[f.key];
  if(f.type==='boolean')return input.checked;if(f.type==='number')return Number(input.value);return input.value;
 }
 function sync(){
  const form=$('#cms-form');if(!form||!current)return;
  const module=spec(),doc=drafts[current];
  module.fields.forEach(f=>doc.values[f.key]=readField(form,f,'v:'+f.key));
  doc.items.forEach((row,index)=>module.row_fields.forEach(f=>row[f.key]=readField(form,f,'r:'+index+':'+f.key)));
 }
 function changed(){dirty.add(current);const status=panel.querySelector('.cms-save-status');if(status)status.textContent='Cambios sin guardar';}
 async function openModule(key){
  sync();selectTab('content');
  try{
   const result=await request('list');modules=result.modules;entries=result.content;cmsProducts=result.products;categories=result.categories;
   current=modules.some(m=>m.key===key)?key:'slider';
   if(!dirty.has(current)||!drafts[current])drafts[current]=clone(entries[current].document);
   // Keep the revision corresponding to an unsaved draft, so concurrent updates are detected.
   if(!dirty.has(current))drafts[current]._revision=entries[current].revision;
   render();history.replaceState(null,'','#'+current);
  }catch(error){panel.innerHTML=`<div class="panel-card"><p class="form-error">${esc(error.message)}</p><button class="button" data-cms-retry>Volver a intentar</button></div>`;}
 }
 panel.addEventListener('submit',async event=>{
  if(event.target.id!=='cms-form')return;event.preventDefault();event.stopPropagation();sync();
  const form=event.target,fieldset=form.querySelector('fieldset'),error=$('#cms-error'),key=current;
  const doc=clone(drafts[key]);delete doc._revision;error.textContent='';fieldset.disabled=true;
  try{
   const result=await request('save',{key,revision:drafts[key]._revision,document:doc});
   entries[key]={document:result.document,revision:result.revision};drafts[key]=clone(result.document);drafts[key]._revision=result.revision;dirty.delete(key);
   render();toast('Cambios publicados. Actualiza la tienda para verlos.');
  }catch(err){error.textContent=err.message;}finally{fieldset.disabled=false;}
 });
 panel.addEventListener('input',event=>{if(event.target.closest('#cms-form'))changed();});
 panel.addEventListener('change',event=>{
  if(event.target.id==='cms-module'){openModule(event.target.value);return;}
  const name=event.target.dataset.actionType;
  if(name){const container=[...panel.querySelectorAll('[data-action-value]')].find(el=>el.dataset.actionValue===name);container.innerHTML=actionValue(name,event.target.value,event.target.value==='category'?'Todos':event.target.value==='section'?'catalogo':'');}
  if(event.target.closest('#cms-form'))changed();
 });
 panel.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.pickMedia){sync();showMedia(b.dataset.pickMedia,b.dataset.kind);return;}
  if(b.dataset.clearMedia){sync();setValue(b.dataset.clearMedia,'');changed();render();return;}
  if(b.hasAttribute('data-cms-retry')){openModule(current||'slider');return;}
  if(b.id==='cms-reload'){if(dirty.has(current)&&!confirm('¿Descartar los cambios sin guardar de esta sección?'))return;dirty.delete(current);openModule(current);return;}
  if(b.id==='cms-add'){
   sync();const module=spec(),doc=drafts[current];if(doc.items.length>=module.max_rows){toast('Llegaste al máximo de elementos.');return;}
   const row={id:crypto.randomUUID()};module.row_fields.forEach(f=>row[f.key]=f.type==='boolean'?true:f.type==='action'?{type:'category',value:'Todos'}:'');
   doc.items.push(row);changed();render();const detail=panel.querySelector(`details[data-id="${row.id}"]`);detail.open=true;detail.scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  if(b.hasAttribute('data-move-row')){sync();const a=Number(b.dataset.moveRow),to=a+Number(b.dataset.delta),rows=drafts[current].items;[rows[a],rows[to]]=[rows[to],rows[a]];changed();render();}
  if(b.hasAttribute('data-remove-row')){sync();drafts[current].items.splice(Number(b.dataset.removeRow),1);changed();render();}
 });
 function setValue(name,value){const parts=name.split(':');if(parts[0]==='v')drafts[current].values[parts[1]]=value;else drafts[current].items[Number(parts[1])][parts[2]]=value;}
 const media=document.createElement('dialog');media.id='cms-media-dialog';media.className='admin-dialog cms-media-dialog';
 media.innerHTML='<button type="button" class="icon-button dialog-close" id="cms-media-close" aria-label="Cerrar biblioteca">×</button><h2>Biblioteca de archivos</h2><p>Elige un archivo existente o sube uno nuevo.</p><div class="cms-media-toolbar"><input type="search" id="cms-media-search" placeholder="Buscar por nombre del archivo…" aria-label="Buscar archivo"><label class="button button-outline">Subir archivo<input type="file" id="cms-media-upload" hidden></label></div><p id="cms-upload-status" role="status"></p><div id="cms-media-grid"></div><div class="admin-pagination"><button id="cms-media-prev" type="button">← Anterior</button><span id="cms-media-page"></span><button id="cms-media-next" type="button">Siguiente →</button></div><p id="cms-media-error" class="form-error" role="alert"></p>';
 document.body.append(media);
 async function showMedia(name,type){
  mediaTarget=name;mediaType=type;mediaPage=1;$('#cms-media-search').value='';$('#cms-media-error').textContent='';$('#cms-upload-status').textContent=type==='video'?'Video MP4 · hasta 50 MB':'JPG, PNG o WebP · hasta 8 MB';$('#cms-media-upload').accept=type==='video'?'video/mp4':'image/jpeg,image/png,image/webp';
  media.showModal();$('#cms-media-grid').innerHTML='<p>Cargando archivos…</p>';
  try{if(!assets)assets=(await request('media')).assets;renderMedia();}catch(error){$('#cms-media-error').textContent=error.message;}
 }
 function renderMedia(){
  const term=$('#cms-media-search').value.toLowerCase(),list=(assets||[]).filter(a=>a.type===mediaType&&a.name.toLowerCase().includes(term));const max=Math.max(1,Math.ceil(list.length/24));mediaPage=Math.min(mediaPage,max);
  $('#cms-media-grid').innerHTML=list.length?list.slice((mediaPage-1)*24,mediaPage*24).map(a=>`<button type="button" class="cms-asset" data-asset="${esc(a.path)}" aria-label="Elegir ${esc(a.name)}">${a.type==='image'?`<img src="${esc(a.path)}" alt="" loading="lazy">`:'<span class="cms-video-icon">▶ MP4</span>'}<span>${esc(a.name)}</span><small>${(a.size/1024/1024).toFixed(1)} MB</small></button>`).join(''):'<p>No hay archivos que coincidan. Puedes subir uno nuevo.</p>';
  $('#cms-media-page').textContent=`${mediaPage} / ${max} · ${list.length} archivos`;$('#cms-media-prev').disabled=mediaPage===1;$('#cms-media-next').disabled=mediaPage===max;
 }
 $('#cms-media-close').addEventListener('click',()=>media.close());
 $('#cms-media-search').addEventListener('input',()=>{mediaPage=1;renderMedia();});
 $('#cms-media-prev').addEventListener('click',()=>{mediaPage--;renderMedia();});$('#cms-media-next').addEventListener('click',()=>{mediaPage++;renderMedia();});
 $('#cms-media-grid').addEventListener('click',event=>{const b=event.target.closest('[data-asset]');if(b){setValue(mediaTarget,b.dataset.asset);changed();media.close();render();}});
 $('#cms-media-upload').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const limit=(mediaType==='video'?50:8)*1024*1024;
  if(file.size>limit){$('#cms-media-error').textContent='El archivo excede el tamaño permitido.';event.target.value='';return;}
  event.target.disabled=true;$('#cms-media-error').textContent='';$('#cms-upload-status').textContent='Subiendo archivo…';
  try{
   const data=new FormData();data.append('file',file);const response=await fetch('/api/content.php?action=upload',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:data});const result=await response.json();
   if(!response.ok)throw new Error(result.error||'No se pudo subir el archivo.');
   if(result.type!==mediaType)throw new Error('Selecciona el tipo de archivo indicado.');
   assets=null;setValue(mediaTarget,result.path);changed();media.close();render();toast('Archivo cargado. Guarda la sección para publicarlo.');
  }catch(error){$('#cms-media-error').textContent=error.message;$('#cms-upload-status').textContent='';}
  finally{event.target.disabled=false;event.target.value='';}
 });
 document.addEventListener('click',event=>{const b=event.target.closest('[data-module]');if(b)openModule(b.dataset.module);});
 window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue='';}});
 window.addEventListener('admin:ready',()=>{const key=location.hash.slice(1);if(key)openModule(key);});
})();
