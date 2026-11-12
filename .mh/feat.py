import re, collections
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
def ln(i): return s.count('\n',0,i)+1
out=[]
w=out.append
# 1) routes
r=collections.Counter(re.findall(r"#/([A-Za-z0-9_\-]+)",s))
w('=== HASH ROUTES (count)'); w(', '.join(f'{k}:{v}' for k,v in r.most_common(80)))
# 2) route dispatch
for pat in [r'const\s+ROUTES\s*=', r'routes\s*=\s*\{', r'function\s+route\w*\s*\(', r'function\s+render\s*\(', r'TABS\s*=', r'tabs\s*=\s*\[']:
    for m in list(re.finditer(pat,s))[:3]:
        w(f'=== {pat} L{ln(m.start())}'); w(s[m.start():m.start()+1500].replace('\n','⏎'))
# 3) network
w('=== FETCH / URLS')
for m in re.finditer(r'fetch\(',s):
    w(f'L{ln(m.start())}: '+s[max(0,m.start()-150):m.start()+250].replace('\n','⏎'))
urls=collections.Counter(re.findall(r'https?://[A-Za-z0-9\.\-]+',s))
w('=== DOMAINS'); w(', '.join(f'{k}:{v}' for k,v in urls.most_common(40)))
# 4) chat keywords
for kw in ['چت','chat','Chat','gemini','openai','OpenAI','apiKey','api_key','system_instruction','systemPrompt','model:','دستیار']:
    c=len(re.findall(re.escape(kw),s)); w(f'=== KW {kw}: {c}')
open('feat.txt','w',encoding='utf-8').write('\n'.join(out))
