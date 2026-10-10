"""Import the supplied offline catalogue, without executing its HTML/scripts."""
import json, re, shutil, html, hashlib
from pathlib import Path
from urllib.parse import urlparse, unquote
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(r'C:\Downloaded Web Sites\magia.pe')
PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'public' / 'images'
OUT.mkdir(parents=True, exist_ok=True)
files = {}
for path in ROOT.rglob('*'):
    if path.is_file() and path.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
        files.setdefault(path.name.lower(), path)

def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value))).strip()

def category(name):
    text = name.lower()
    if any(x in text for x in ['desayuno', 'breakfast', 'lunch', 'good day', 'coffee']): return 'Desayunos'
    if any(x in text for x in ['novia', 'boutonniere', 'botonier', 'corsage', 'reina']): return 'Novias'
    if any(x in text for x in ['tulip', 'tulipán']): return 'Tulipanes'
    if any(x in text for x in ['orqu', 'anturio', 'planta']): return 'Plantas'
    if any(x in text for x in ['ramo', 'bouquet', 'girasol', 'primaver']): return 'Ramos'
    if any(x in text for x in ['rosa', 'rose', 'box', 'florero', 'garden', 'love', 'flowers', 'floral']): return 'Rosas y arreglos'
    return 'Regalos'

products, missing = [], []
for source in sorted((ROOT / 'products').glob('*.oembed')):
    try:
        data = json.loads(source.read_text(encoding='utf-8'))
        offers = data.get('offers', [])
        if not offers or not data.get('thumbnail_url'): continue
        basename = unquote(Path(urlparse('https:' + data['thumbnail_url']).path).name).lower()
        image = files.get(basename)
        if not image:
            missing.append(source.stem)
            continue
        target = OUT / (source.stem + '.webp')
        with Image.open(image) as im:
            im.thumbnail((900, 900))
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA')
            im.save(target, 'WEBP', quality=83, method=4)
        description = clean(data.get('description', ''))
        products.append({'id':source.stem, 'name':data['title'], 'price':float(offers[0]['price']),
            'image':'/images/'+target.name, 'description':description,
            'category':category(data['title']), 'available':bool(offers[0].get('in_stock', True)),
            'source':'https://magia.pe/products/'+source.stem})
    except Exception as exc:
        missing.append(source.stem + ': ' + str(exc))

(PROJECT/'data').mkdir(exist_ok=True)
(PROJECT/'data'/'products.json').write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding='utf-8')
(PROJECT/'data'/'import-report.json').write_text(json.dumps({'source':str(ROOT), 'imported':len(products),'missing':missing}, ensure_ascii=False, indent=2), encoding='utf-8')
fonts=PROJECT/'public'/'fonts'
fonts.mkdir(exist_ok=True)
for folder,name,suffix in [('fraunces','display.ttf','ctxujDg.ttf'),('inter','body.ttf','LyfMZg.ttf'),('inter','body-medium.ttf','I6fMZg.ttf'),('inter','body-semibold.ttf','GKYMZg.ttf')]:
    available=list((ROOT/'s'/folder).rglob('*'+suffix))
    if available: shutil.copy2(available[0], fonts/name)

selected=[p for p in products if p['category'] in ('Ramos','Tulipanes','Rosas y arreglos') and p['price'] >= 100][:40]
sheet=Image.new('RGB',(1000, ((len(selected)+4)//5)*220),'#f7f2ed')
draw=ImageDraw.Draw(sheet)
for index,p in enumerate(selected):
    with Image.open(PROJECT/'public'/p['image'].lstrip('/')) as im:
        im=ImageOps.contain(im.convert('RGB'),(185,180))
        x=(index%5)*200; y=(index//5)*220
        sheet.paste(im,(x+(200-im.width)//2,y))
        draw.text((x+5,y+182),p['name'][:25],fill='#33212b')
        draw.text((x+5,y+198),p['id'][:29],fill='#33212b')
(PROJECT/'work').mkdir(exist_ok=True)
sheet.save(PROJECT/'work'/'contact-sheet.jpg')
print(json.dumps({'imported':len(products),'missing':len(missing),'categories':{c:sum(p['category']==c for p in products) for c in sorted({p['category'] for p in products})}}))
