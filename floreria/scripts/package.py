"""Package only the PHP application, assets and installation documentation."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
output=root.parent/'floreria-php-mysql.zip'
with ZipFile(output,'w',compression=ZIP_DEFLATED,compresslevel=6,strict_timestamps=False) as archive:
    for folder in ['public','src','database','data','scripts','tests','docs']:
        for path in (root/folder).rglob('*'):
            if not path.is_file() or '__pycache__' in path.parts: continue
            archive.write(path,'floreria/'+path.relative_to(root).as_posix())
    for filename in ['README.md','.env.example','.gitignore','INICIAR.bat']:
        archive.write(root/filename,'floreria/'+filename)
print(f'{output.name}: {output.stat().st_size/1024/1024:.1f} MB')
