"""One-time migration of the existing visual layout into editable CMS templates."""
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString
from urllib.request import urlopen
import json
root=Path(__file__).resolve().parents[1]
if (root/'data/cms-defaults.json').exists(): raise SystemExit('Migración ya realizada; edita el contenido desde el administrador.')
out=root/'src/views/cms';out.mkdir(parents=True,exist_ok=True)
html=urlopen('http://127.0.0.1:8080/').read().decode('utf-8')
soup=BeautifulSoup(html,'html.parser')
reference=json.loads((root/'data/reference.json').read_text(encoding='utf-8'))
modules=[]
def field(key,label,kind='text',**kwargs):return dict(key=key,label=label,type=kind,**kwargs)
def action(node):
 if node.get('data-category'):return dict(type='category',value=node['data-category'])
 if node.get('data-query'):return dict(type='search',value=node['data-query'])
 if node.get('data-slug'):return dict(type='product',value=node['data-slug'])
 href=node.get('href','#catalogo')
 return dict(type='section' if href.startswith('#') else 'url',value=href[1:] if href.startswith('#') else href)
def module(key,title,description,fields=None,values=None,row_fields=None,items=None,**extra):
 m=dict(key=key,title=title,description=description,fields=fields or [],row_fields=row_fields or [],defaults=dict(values=values or {},items=items or []),**extra)
 modules.append(m);return m
def manage(node,key,title,description):
 m=module(key,title,description,[field('enabled','Mostrar esta sección','boolean')],{'enabled':True})
 def add(label,kind,value):
  name='f'+str(len(m['fields']));m['fields'].append(field(name,label,kind));m['defaults']['values'][name]=value;return name
 for image in node.select('img'):
  name=add('Imagen: '+(image.get('alt') or title)[:80],'image',image.get('src',''));image['src']='{{value:'+name+'}}'
  for attr in ['srcset','sizes']:image.attrs.pop(attr,None)
 for a in node.select('a'):
  if a.get('href') in ['/','/admin.php'] or a.get('href','').startswith('mailto:'):continue
  name=add('Destino: '+a.get_text(' ',strip=True)[:70],'action',action(a))
  for attr in ['href','data-category','data-query','data-slug','data-product','data-original-image']:a.attrs.pop(attr,None)
  a['data-cms-action']=name
 for text in list(node.find_all(string=True)):
  value=str(text).strip();parent=text.parent
  if not value or '{{' in value or parent.name in ['script','style','svg','path'] or parent.find_parent(['script','style','svg']):continue
  if value in ['←','→','↗','×','Ⅱ','▶','♥'] or (parent.name=='button' and parent.get('aria-label')):continue
  name=add(('Título: ' if parent.name in ['h1','h2','h3'] else 'Texto: ')+value[:75],'textarea' if len(value)>110 else 'text',value)
  text.replace_with(NavigableString('{{value:'+name+'}}'))
 for inp in node.select('input[placeholder]'):
  name=add('Texto del buscador','text',inp['placeholder']);inp['placeholder']='{{value:'+name+'}}'
 (out/(key+'.html')).write_text(str(node),encoding='utf-8')
 node.replace_with(NavigableString('{{module:'+key+'}}'))
 return m

# Menu rows may be links or members of a named submenu.
nav=soup.select_one('.main-nav');items=[]
for child in nav.find_all(recursive=False):
 if child.name=='a':items.append(dict(label=child.get_text(' ',strip=True),group='',action=action(child),enabled=True))
 elif child.name=='details':
  group=child.summary.get_text(' ',strip=True)
  for a in child.select('a'):items.append(dict(label=a.get_text(' ',strip=True),group=group,action=action(a),enabled=True))
module('navigation','Menú principal','Edita el nombre, destino y orden de cada enlace. Usa el mismo grupo para reunir enlaces en un submenú.',row_fields=[field('label','Nombre del enlace'),field('group','Submenú (vacío para enlace principal)',optional=True),field('action','Al hacer clic','action'),field('enabled','Visible','boolean')],items=items,min_rows=1,max_rows=40)
nav.clear();nav.append(NavigableString('{{rows:navigation}}'))
manage(soup.select_one('#site-header'),'header','Cabecera y logotipos','Logotipos y textos de búsqueda. Los enlaces se editan en Menú principal.')['required']=True

hero=soup.select_one('.campaign-hero');hero.replace_with(NavigableString('{{module:slider}}'))
module('slider','Slider principal','Edita el banner grande del inicio: imagen o video, título, descripción y destino del botón. Puedes agregar, ocultar y ordenar diapositivas.',
 fields=[field('autoplay','Rotar automáticamente','boolean'),field('interval','Segundos entre diapositivas','number',min=3,max=30)],values=dict(autoplay=True,interval=8),
 row_fields=[field('title','Título'),field('subtitle','Descripción','textarea',optional=True),field('poster','Imagen o portada del video','image'),field('video','Video MP4 (opcional)','video',optional=True),field('button_label','Texto del botón'),field('action','Destino del botón','action'),field('enabled','Visible','boolean')],
 items=[dict(title='Girasoles para ella',subtitle='Un gesto que ilumina su día.',poster=reference['hero'][0]['poster'],video=reference['hero'][0]['video'],button_label='Enviar aquí',action=dict(type='search',value='girasol'),enabled=True),dict(title='Gesto a Gesto.',subtitle='Transforma lo que sientes en un gesto memorable.',poster=reference['hero'][1]['poster'],video=reference['hero'][1]['video'],button_label='Encuentra el gesto perfecto',action=dict(type='section',value='mas-vendidos'),enabled=True)],min_rows=1,max_rows=12,require_enabled=True)

manage(soup.select_one('[id*="__trustv2"]'),'benefits','Beneficios y entregas','Imágenes y textos de los beneficios que se muestran debajo del slider.')
best=soup.select_one('[id*="__products_carrousel"]');rows=[]
for card in best.select('.magia-product-card'):
 rows.append(dict(product=card.select_one('[data-slug]')['data-slug'],image=card.select_one('.magia-product-card__image--primary')['src'],secondary=card.select_one('.magia-product-card__image--secondary')['src'],enabled=True))
track=best.select_one('[data-mag-track]');track.clear();track.append(NavigableString('{{rows:bestsellers}}'))
m=manage(best,'bestsellers','Carrusel de productos','Elige productos y su orden. Nombres, precios y disponibilidad se toman del catálogo de Productos.')
m.update(row_fields=[field('product','Producto','product'),field('image','Foto de portada (vacío usa la del producto)','image',optional=True),field('secondary','Foto al pasar el cursor','image',optional=True),field('enabled','Visible','boolean')],min_rows=1,max_rows=40)
m['defaults']['items']=rows
manage(soup.select_one('[id*="__collection_carousel"]'),'occasions','Ocasiones: ¿qué quieres celebrar?','Fotos, títulos, textos y destinos de los botones Ver regalos.')
film=soup.select_one('.film-section');track=film.select_one('#films');track.clear();track.append(NavigableString('{{rows:films}}'))
m=manage(film,'films','Videos de productos','Videos y productos vinculados a las tarjetas. El botón de cada video abre su producto.')
m['fields'].append(field('background','Imagen de fondo','image'));m['defaults']['values']['background']='/reference/fondo_2.webp'
m.update(row_fields=[field('product','Producto vinculado','product'),field('poster','Portada','image'),field('video','Video MP4','video'),field('enabled','Visible','boolean')],min_rows=1,max_rows=20)
m['defaults']['items']=[dict(product=c['slug'],poster=c['poster'],video=c['video'],enabled=True) for c in reference['clips']]
manage(soup.select_one('[id*="__trust_cAc"]'),'experience','Tu gesto en cuatro pasos','Imagen de fondo y textos de cada paso.')
manage(soup.select_one('[id*="__1776908771"]'),'popular','Ocasiones populares','Imágenes, títulos y destinos de las categorías destacadas.')
manage(soup.select_one('[id*="__media_with_text"]'),'season','Colección de temporada','Fotografías, textos y botón de la colección de amor.')
catalog=soup.select_one('#catalogo');chips=catalog.select_one('#filter-chips');chips.clear();chips.append(NavigableString('{{categories}}'))
# Do not offer loading, sort options or system status as merchandising fields.
for selector in ['#result-count','.catalog-toolbar','#search-status','#product-grid']:
 node=catalog.select_one(selector)
 token='{{fragment:'+selector.replace('#','').replace('.','')+'}}'
 (out/(selector.replace('#','').replace('.','')+'.html')).write_text(str(node),encoding='utf-8');node.replace_with(NavigableString(token))
manage(catalog,'catalog','Catálogo y botón Ver más','Título de la sección. Los filtros se obtienen automáticamente de las categorías de los productos.')['required']=True
faq=soup.select_one('#ayuda');items=[dict(question=d.summary.get_text(' ',strip=True),answer=d.p.get_text(' ',strip=True),enabled=True) for d in faq.select('details')]
faq.select_one('.faq-list').clear();faq.select_one('.faq-list').append(NavigableString('{{rows:faq}}'))
m=manage(faq,'faq','Preguntas frecuentes','Edita las preguntas y respuestas de ayuda al cliente.');m.update(row_fields=[field('question','Pregunta'),field('answer','Respuesta','textarea'),field('enabled','Visible','boolean')],min_rows=1,max_rows=30);m['defaults']['items']=items
manage(soup.select_one('#corporativos'),'corporate','Regalos corporativos','Textos y destino del botón para regalos corporativos.')
manage(soup.select_one('.brand-marquee'),'marquee','Franja de marca','Texto de la franja horizontal antes del pie de página.')
footer=soup.select_one('.footer')
# Keep identity/contact settings dynamic, including when initially empty.
contact=footer.select('.footer-main>div')[-1]
for c in list(contact.children):
 if getattr(c,'name',None)=='span' or (getattr(c,'name',None)=='a' and c.get('href','').startswith('mailto:')):c.extract()
contact.h3.insert_after(NavigableString('{{contact}}'))
bottom=footer.select_one('.footer-bottom');bottom.select_one('span').string='{{copyright}}'
manage(footer,'footer','Pie de página y sus enlaces','Títulos, textos, logo y destinos del pie de página. Dirección y contacto se editan en Mi tienda.')
soup.select_one('title').string='{{page_title}}'
soup.select_one('meta[name="description"]')['content']='{{page_description}}'
soup.select_one('link[rel="preload"][as="image"]')['href']='{{hero_poster}}'
# Settings-driven WhatsApp is rendered on every request.
for el in soup.select('.whatsapp-button'):el.decompose()
soup.select_one('#product-dialog').insert_before(NavigableString('{{whatsapp}}'))
module('seo','Título y descripción del sitio','Información que aparece en la pestaña del navegador y en buscadores.',[field('title','Título de la página'),field('description','Descripción','textarea')],dict(title='Flores y regalos a domicilio en Lima',description='Flores, rosas, tulipanes y regalos para convertir lo que sientes en un gesto memorable. Encuentra tu detalle y programa tu entrega en Lima.'))
for m in modules:
 for i,row in enumerate(m['defaults']['items']):row['id']=m['key']+'-'+str(i+1)
(out/'page.html').write_text(str(soup),encoding='utf-8')
(root/'data/cms-defaults.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2),encoding='utf-8')
print('CMS:',len(modules),'módulos;',sum(len(m['fields']) for m in modules),'campos;',sum(len(m['defaults']['items']) for m in modules),'elementos editables.')
