import urllib.request, re; 
req = urllib.request.Request('https://www.google.com/finance/quote/SENSEX:INDEXBOM', headers={'User-Agent': 'Mozilla/5.0'}); 
html = urllib.request.urlopen(req).read().decode('utf-8'); 
match = re.search(r'class="YMlKec fxKbKc">([^<]+)<', html); 
print('SENSEX:', match.group(1) if match else 'Not found')
