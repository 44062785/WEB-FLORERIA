"""Copy visual assets and static sections from the user's offline reference.

No original JavaScript, trackers, forms or remote shop actions are included.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup
from PIL import Image
import hashlib, json, re, shutil

root = Path(__file__).resolve().parents[1]
source = Path(r'C:\Downloaded Web Sites\magia.pe')
soup = BeautifulSoup((source/'index.htm').read_text(encoding='utf-8'), 'html.parser')
assets = root/'public/reference'
views = root/'src/views'
assets.mkdir(exist_ok=True)
views.mkdir(exist_ok=True)
copied = {}
missing = set()

def asset(url):
    path = unquote(urlsplit(url).path).lstrip('/')
    if path in copied: return copied[path]
    file = source/path
    if not file.is_file():
        missing.add(path)
        return ''
    name = file.name
    if file.suffix.lower() in ['.png','.jpg','.jpeg']:
        name = file.stem+'.webp'
        with Image.open(file) as image:
            image.thumbnail((2200,2200))
            image.save(assets/name,'WEBP',quality=88)
    else:
        shutil.copy2(file, assets/name)
    copied[path] = '/reference/'+name
    return copied[path]

def rewrite_css(css):
    css=re.sub(r'@import\s*(?:url\([^)]*\)|["\'][^"\']*["\'])\s*;', '', css)
    def replace(match):
        url=match.group(1).strip(' "\'')
        if 'cdn/fonts/' in url:
            return 'url("'+asset(url)+'")'
        if url.startswith('../../../files/'):
            return 'url("'+asset('cdn/shop/files/'+url.split('/')[-1])+'")'
        return match.group(0)
    return re.sub(r'url\(([^)]+)\)', replace, css)

styles=[]
for name in ['base.css','component.css','theme.css','collection-carousel.css','media-with-text.css','cinematic-slider-portable.css']:
    styles.append(rewrite_css((source/'cdn/shop/t/41/assets'/name).read_text(encoding='utf-8')))
for style in soup.head.select('style'):
    if '--heading-font-family' in style.text or '@font-face' in style.text:
        styles.append(rewrite_css(style.text))

category_map={'tulipanes':'Tulipanes','desayunos':'Desayunos','rosas':'Rosas y arreglos','amor':'Rosas y arreglos','para-el':'Regalos','cumpleanos':'Regalos','aniversario':'Ramos'}
catalog={p['id']:p for p in json.loads((root/'data/products.json').read_text(encoding='utf-8'))}
for key in ['trustv2','products_carrousel','collection_carousel','trust_cAc','media_with_text','1776908771e7784e2d']:
    section=soup.select_one('[id*="__'+key+'"]')
    for style in section.select('style'):
        styles.append(rewrite_css(style.text)); style.decompose()
    for tag in section.select('script,link,form,iframe'):tag.decompose()
    for tag in section.find_all(True):
        for attr in list(tag.attrs):
            if attr.startswith('on') or attr in ['srcset','sizes']: del tag[attr]
        for attr in ['src','poster']:
            if tag.get(attr): tag[attr]=asset(tag[attr])
        if tag.name=='a':
            href=tag.get('href','')
            if 'products/' in href:
                slug=unquote(urlsplit(href).path.split('/')[-1]).removesuffix('.html')
                tag['data-slug']=slug
                if slug in catalog: tag['data-original-image']=catalog[slug]['image']
            else:
                tag['data-category']=next((value for term,value in category_map.items() if term in href),'Todos')
            tag['href']='#catalogo'
        if tag.name=='svg' and tag.get('viewbox'):
            tag['viewBox']=tag['viewbox'];del tag['viewbox']
    for card in section.select('.magia-product-card'):
        link=card.select_one('[data-slug]')
        if link and link['data-slug'] in catalog: card['data-original-price']=str(catalog[link['data-slug']]['price'])
    (views/(key+'.html')).write_text(str(section),encoding='utf-8')

# The original campaign videos and logos are reused as files, with local URLs.
hero=soup.select_one('[id*="__banner_slider"]')
campaign=[]
for slide in hero.select('[data-banner-slide-item]'):
    video=slide.select_one('template video')
    campaign.append({'video':asset(video.select_one('source')['src']), 'poster':asset(slide.select_one('img')['src'])})
logos={}
for key,name in [('dark','GESTO_A_GESTO_Mesa_de_trabajo_1.png'),('white','GESTO_A_GESTO-02.png')]:
    logos[key]=asset('cdn/shop/files/'+name)

cinema=soup.select_one('cinematic-slider-portable')
clips=[]
for item in cinema.select('[data-cinematic-item]'):
    video=item.select_one('video')
    link=item.select_one('a[href*="products/"]')
    slug=unquote(urlsplit(link['href']).path.split('/')[-1]).removesuffix('.html') if link else ''
    photo=item.select_one('.cinematic-slider__thumb-img')
    clips.append({'video':asset(video.select_one('source')['src']),'poster':asset(video['poster']),'slug':slug,'name':photo['alt'],'image':asset(photo['src'])})
styles.extend(style.text for style in cinema.select('style'))
(root/'data/reference.json').write_text(json.dumps({'hero':campaign,'logos':logos,'clips':clips},ensure_ascii=False,indent=2),encoding='utf-8')
(root/'public/assets/reference.css').write_text('\n'.join(styles),encoding='utf-8')
(root/'data/reference-assets.json').write_text(json.dumps(copied,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Copied {len(copied)} local assets, {len(clips)} clips, {len(campaign)} banners.')
if missing: print('Missing:', sorted(missing))
