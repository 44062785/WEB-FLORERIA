"""CMS integration: publication, validation and optimistic locking; restore original content."""
import json,re,urllib.request,urllib.error,http.cookiejar,pathlib,copy
root=pathlib.Path(__file__).resolve().parents[1]
base='http://127.0.0.1:8080'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(path,data=None,token=''):
    r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','X-CSRF-Token':token})
    try:
        with client.open(r) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
assert req('/api/content.php')[0]==401
_,session=req('/api/catalog.php')
password=re.search(r'Contraseña: (.+)',(root/'var/admin-credentials.txt').read_text(encoding='utf-8')).group(1)
status,session=req('/api/admin.php?action=login',{'email':'admin@floreria.local','password':password},session['csrf'])
assert status==200,session
token=session['csrf']
_,data=req('/api/content.php')
assert len(data['modules'])==16
for key,entry in data['content'].items():
    # Every imported section must be accepted by its own editor.
    status,result=req('/api/content.php?action=save',{'key':key,'revision':entry['revision'],'document':entry['document']},token)
    assert status==200,(key,result)
_,data=req('/api/content.php')
original=data['content']['slider'];revision=original['revision'];doc=copy.deepcopy(original['document']);saved=False
try:
    doc['items'][0]['title']='CMS integración <segura>'
    doc['items'][0]['video']=''
    doc['items'][0]['action']={'type':'category','value':'Todos'}
    body={'key':'slider','revision':revision,'document':doc}
    assert req('/api/content.php?action=save',body,'invalid')[0]==419
    status,result=req('/api/content.php?action=save',body,token)
    assert status==200,result
    saved=True;revision=result['revision']
    html=client.open(base+'/').read().decode()
    assert 'CMS integración &lt;segura&gt;' in html and '{{' not in html
    assert req('/api/content.php?action=save',body,token)[0]==409
    bad=copy.deepcopy(doc);bad['items'][0]['action']={'type':'url','value':'javascript:alert(1)'}
    assert req('/api/content.php?action=save',dict(body,revision=revision,document=bad),token)[0]==400
    bad=copy.deepcopy(doc);bad['items'][0]['poster']='/reference/../.env'
    assert req('/api/content.php?action=save',dict(body,revision=revision,document=bad),token)[0]==400
    source=next((root/'public/reference').glob('*.webp'))
    boundary='cms-upload-integration-test'
    payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.webp"\r\nContent-Type: image/webp\r\n\r\n'.encode()+source.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
    upload=urllib.request.Request(base+'/api/content.php?action=upload',data=payload,headers={'Content-Type':'multipart/form-data; boundary='+boundary,'X-CSRF-Token':token})
    with client.open(upload) as response:
        assert response.status==201
        uploaded=json.load(response)
    uploaded_path=(root/'public'/uploaded['path'].lstrip('/')).resolve()
    assert uploaded_path.parent==(root/'public/uploads').resolve()
    assert uploaded_path.read_bytes()==source.read_bytes()
    uploaded_path.unlink()  # Only the unreferenced fixture created immediately above.
    _,media=req('/api/content.php?action=media')
    assert any(a['type']=='video' for a in media['assets']) and any(a['type']=='image' for a in media['assets'])
finally:
    if saved:
        status,result=req('/api/content.php?action=save',{'key':'slider','revision':revision,'document':original['document']},token)
        assert status==200,('Restore failed',result)
print('PASS: 16 módulos, publicación MySQL→portada, imagen sin video, enlaces, escape HTML, CSRF, control de concurrencia y biblioteca.')

