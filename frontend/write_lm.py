import base64,pathlib  
code = base64.b64decode(open('lm_b64.txt').read())  
pathlib.Path('src/components/LiveMapView.tsx').write_bytes(code)  
print('done') 
