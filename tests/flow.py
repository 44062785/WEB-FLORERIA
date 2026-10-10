"""Verify the local PHP/MySQL flow. Fixtures are removed after the checks."""
import json, re, urllib.request, urllib.error, http.cookiejar, uuid, pathlib, subprocess

root = pathlib.Path(__file__).resolve().parents[1]
base = 'http://127.0.0.1:8080'
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
csrf = ''
references = []

def request(path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token is not None: headers['X-CSRF-Token'] = token
    req = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
    try:
        with opener.open(req) as response: return response.status, json.load(response)
    except urllib.error.HTTPError as error: return error.code, json.load(error)

try:
    code, catalog = request('/api/catalog.php')
    assert code == 200 and len(catalog['products']) == 437
    assert all((root/'public'/p['image'].lstrip('/')).is_file() for p in catalog['products'])
    csrf = catalog['csrf']
    product = next(p for p in catalog['products'] if p['slug'] == 'box-loyalty-pink')
    order = {'customer':'Prueba automática','email':'prueba-api@example.test','phone':'999888777',
             'recipient':'Destinatario de prueba','address':'Dirección de prueba sin entrega real',
             'district':'Miraflores','delivery_date':catalog['today'],'dedication':'PRUEBA, no enviar.',
             'request_key':str(uuid.uuid4()),'items':[{'id':product['id'],'quantity':1,'price':0.01}], 'total':0.01}
    assert request('/api/admin.php?action=dashboard')[0] == 401
    assert request('/api/orders.php', order, 'incorrecto')[0] == 419
    invalid = dict(order, delivery_date='2020-01-01')
    assert request('/api/orders.php', invalid, csrf)[0] == 400
    invalid = dict(order, items=[{'id':product['id'],'quantity':21}])
    assert request('/api/orders.php', invalid, csrf)[0] == 400
    code, saved = request('/api/orders.php', order, csrf)
    assert code == 201 and saved['total'] == product['price'] + 15, saved
    references.append(saved['reference'])
    code, repeated = request('/api/orders.php', order, csrf)
    assert code == 200 and repeated['reference'] == saved['reference']
    order['request_key'] = str(uuid.uuid4())
    order['items'] = [{'id':product['id'],'quantity':2}]
    code, free = request('/api/orders.php', order, csrf)
    assert code == 201 and free['total'] == product['price'] * 2
    references.append(free['reference'])
    credentials = (root/'var'/'admin-credentials.txt').read_text(encoding='utf-8')
    password = re.search(r'Contraseña: (.+)',credentials).group(1)
    code, session = request('/api/admin.php?action=login', {'email':'admin@floreria.local','password':password}, csrf)
    assert code == 200, session
    csrf = session['csrf']
    code, dashboard = request('/api/admin.php?action=dashboard')
    assert code == 200 and all(any(o['reference']==ref for o in dashboard['orders']) for ref in references)
    saved_order = next(o for o in dashboard['orders'] if o['reference']==saved['reference'])
    assert len(saved_order['items']) == 1 and saved_order['items'][0]['unit_price'] == product['price']
    assert request('/api/admin.php?action=order',{'id':saved_order['id'],'status':'preparando'},csrf)[0] == 200
    assert request('/api/admin.php?action=order',{'id':saved_order['id'],'status':'incorrecto'},csrf)[0] == 400
    assert request('/api/admin.php?action=product',dict(product,price=-1),csrf)[0] == 400
    assert request('/api/admin.php?action=product',dict(product,price=product['price']),csrf)[0] == 200
    assert request('/api/admin.php?action=logout',{},csrf)[0] == 200
    assert request('/api/admin.php?action=dashboard')[0] == 401
    print('PASS: 437 imágenes, MySQL, CSRF, validación, precio del servidor, envío gratis, reintento sin duplicados, login y gestión de pedidos/productos.')
finally:
    # Only fixture orders created by this check and the UI check are removed.
    code = "require 'src/bootstrap.php'; $q=db()->prepare('DELETE FROM orders WHERE email IN (?,?)'); $q->execute(['prueba-api@example.test','prueba-ui@example.test']);"
    subprocess.run(['php','-r',code],cwd=root,check=True)
