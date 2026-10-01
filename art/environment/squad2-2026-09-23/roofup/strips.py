import sys, numpy as np
from PIL import Image
def hls(a):
    mx=a.max(axis=2); mn=a.min(axis=2); l=(mx+mn)/2; c=mx-mn
    s=np.where(c>1e-6, c/np.maximum(1-np.abs(2*l-1),1e-6), 0)
    r,g,b=a[...,0],a[...,1],a[...,2]
    h=np.zeros_like(l); m=c>1e-6
    rm=m&(mx==r); gm=m&(mx==g)&~rm; bm=m&~rm&~gm
    h[rm]=((g-b)[rm]/c[rm])%6; h[gm]=((b-r)[gm]/c[gm])+2; h[bm]=((r-g)[bm]/c[bm])+4
    return h*60,l,s
for p in sys.argv[1:]:
    a=np.asarray(Image.open(p).convert('RGB'),dtype=np.float32)/255
    H,W=a.shape[:2]
    print(p)
    print(f"  {'rows':12s} {'mean l':>7s} {'dark<0.20':>10s} {'mist':>6s} {'leaf':>6s} {'brown':>6s}")
    for y0,y1 in [(0.00,0.08),(0.08,0.16),(0.16,0.24),(0.24,0.32),(0.32,0.40),(0.40,0.50),(0.50,0.62),(0.12,0.50)]:
        band=a[int(y0*H):int(y1*H)]
        h,l,s=hls(band)
        dark=(l<0.20).mean()*100
        mist=((l>0.5)&(s<0.22)).mean()*100
        leaf=((h>=60)&(h<=170)&(s>0.15)&(l>0.12)&(l<0.6)).mean()*100
        brown=((h>=15)&(h<=50)&(l<0.45)&(s>0.10)).mean()*100
        print(f"  {y0:.2f}-{y1:.2f}    {l.mean():7.3f} {dark:9.1f}% {mist:5.1f}% {leaf:5.1f}% {brown:5.1f}%")
