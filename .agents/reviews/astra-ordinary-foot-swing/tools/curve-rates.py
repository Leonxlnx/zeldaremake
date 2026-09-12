import json,math,sys
r=json.load(open(sys.argv[1]));failures=[];maximum_planar=maximum_vertical=0;minimum_y=math.inf
for i,q in enumerate(r):
    T=q['duration'];R=.10*T
    peak=max(math.hypot(*[q['velocity'][x] for x in ['x','z']]),math.hypot(*[(q['to'][x]-q['from'][x]-.5*q['velocity'][x]*R)/(T-R)for x in ['x','z']]))
    segments=[(q['from']['y'],q['velocity']['y'],q['to']['y'],T)]if q['liftFraction']==0 else[(q['from']['y'],q['velocity']['y'],q['apex'],T*q['liftFraction']),(q['apex'],0,q['to']['y'],T*(1-q['liftFraction']))]
    pv=0;py=math.inf
    for p,v,d,D in segments:
        if D<=0:failures.append({'curve':i,'duration':D});continue
        cc=[p,D*v,3*(d-p)-2*D*v,2*(p-d)+D*v];rates=[0,1]
        if cc[3] and 0<-cc[2]/(3*cc[3])<1:rates.append(-cc[2]/(3*cc[3]))
        pv=max(pv,*[abs((cc[1]+2*cc[2]*u+3*cc[3]*u*u)/D) for u in rates])
        points=[0,1];a=3*cc[3];b=2*cc[2];disc=b*b-4*a*cc[1]
        if a and disc>=0:points +=[u for u in [(-b+math.sqrt(disc))/(2*a),(-b-math.sqrt(disc))/(2*a)]if 0<u<1]
        elif b:points +=[u for u in [-cc[1]/b]if 0<u<1]
        py=min(py,*[((cc[3]*u+cc[2])*u+cc[1])*u+cc[0] for u in points])
    maximum_planar=max(maximum_planar,peak);maximum_vertical=max(maximum_vertical,pv);minimum_y=min(minimum_y,py)
    if peak>8+1e-9 or pv>3+1e-9 or py<-1e-9:failures.append({'curve':i,'maximumPlanar':peak,'maximumVertical':pv,'minimumY':py,'input':q})
result={'curveCount':len(r),'maximumPlanar':maximum_planar,'maximumVertical':maximum_vertical,'minimumY':minimum_y,'failures':failures,'scope':'Analytic extrema of stored world-foot curves; numeric floating point. Rate8/3m/s unchanged. Roundoff1e-9 used only to classify arithmetic noise. Does not certify actual terrain clearance, IK or whole-body motion.'}
json.dump(result,open(sys.argv[2],'w'),indent=2)
print({k:v for k,v in result.items()if k!='failures'});print('failures',len(failures));print(json.dumps(failures[:4],indent=2))

if failures: raise SystemExit(1)
