(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=1e3,t=1001,n=1002,r=1003,i=1004,a=1005,o=1006,s=1007,c=1008,l=1009,u=1010,d=1011,f=1012,p=1013,m=1014,h=1015,g=1016,_=1017,v=1018,y=1020,b=35902,x=35899,S=1021,C=1022,w=1023,T=1026,E=1027,D=1028,O=1029,k=1030,A=1031,ee=1033,j=33776,M=33777,N=33778,te=33779,P=35840,F=35841,ne=35842,re=35843,ie=36196,ae=37492,oe=37496,se=37488,I=37489,ce=37490,le=37491,ue=37808,de=37809,fe=37810,pe=37811,me=37812,he=37813,ge=37814,_e=37815,ve=37816,ye=37817,be=37818,xe=37819,Se=37820,Ce=37821,we=36492,Te=36494,Ee=36495,De=36283,Oe=36284,ke=36285,Ae=36286,je=2300,L=2301,Me=2302,Ne=2303,Pe=2400,R=2401,Fe=2402,z=3200,Ie=`srgb`,Le=`srgb-linear`,Re=`linear`,ze=`srgb`,Be=7680,Ve=35044,He=35048,Ue=2e3;function We(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Ge(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Ke(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function qe(){let e=Ke(`canvas`);return e.style.display=`block`,e}var Je={};function Ye(...e){let t=`THREE.`+e.shift();console.log(t,...e)}function Xe(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function B(...e){e=Xe(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function V(...e){e=Xe(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Ze(...e){let t=e.join(` `);t in Je||(Je[t]=!0,B(...e))}function Qe(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var $e={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},et=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n!==void 0&&n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},tt=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),nt=Math.PI/180,rt=180/Math.PI;function it(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(tt[e&255]+tt[e>>8&255]+tt[e>>16&255]+tt[e>>24&255]+`-`+tt[t&255]+tt[t>>8&255]+`-`+tt[t>>16&15|64]+tt[t>>24&255]+`-`+tt[n&63|128]+tt[n>>8&255]+`-`+tt[n>>16&255]+tt[n>>24&255]+tt[r&255]+tt[r>>8&255]+tt[r>>16&255]+tt[r>>24&255]).toLowerCase()}function at(e,t,n){return Math.max(t,Math.min(n,e))}function ot(e,t){return(e%t+t)%t}function st(e,t,n){return(1-n)*e+n*t}function ct(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}function lt(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}var H=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(at(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},ut=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:B(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(at(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},U=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(ft.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(ft.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this.z=at(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this.z=at(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return dt.copy(this).projectOnVector(e),this.sub(dt)}reflect(e){return this.sub(dt.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(at(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},dt=new U,ft=new ut,W=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return Ze(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(pt.makeScale(e,t)),this}rotate(e){return Ze(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(pt.makeRotation(-e)),this}translate(e,t){return Ze(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(pt.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},pt=new W,mt=new W().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ht=new W().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function gt(){let e={enabled:!0,workingColorSpace:Le,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=vt(e.r),e.g=vt(e.g),e.b=vt(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=yt(e.r),e.g=yt(e.g),e.b=yt(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?Re:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return Ze(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return Ze(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[Le]:{primaries:t,whitePoint:r,transfer:Re,toXYZ:mt,fromXYZ:ht,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Ie},outputColorSpaceConfig:{drawingBufferColorSpace:Ie}},[Ie]:{primaries:t,whitePoint:r,transfer:ze,toXYZ:mt,fromXYZ:ht,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Ie}}}),e}var _t=gt();function vt(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function yt(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var bt,xt=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{bt===void 0&&(bt=Ke(`canvas`)),bt.width=e.width,bt.height=e.height;let t=bt.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=bt}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=Ke(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=vt(i[e]/255)*255;return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(vt(t[e]/255)*255):t[e]=vt(t[e]);return{data:t,width:e.width,height:e.height}}return B(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},St=0,Ct=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:St++}),this.uuid=it(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(wt(r[t].image)):e.push(wt(r[t]))}else e=wt(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function wt(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?xt.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(B(`Texture: Unable to serialize Texture.`),{})}var Tt=0,Et=new U,Dt=class r extends et{constructor(e=r.DEFAULT_IMAGE,n=r.DEFAULT_MAPPING,i=t,a=t,s=o,u=c,d=w,f=l,p=r.DEFAULT_ANISOTROPY,m=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Tt++}),this.uuid=it(),this.name=``,this.source=new Ct(e),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=a,this.magFilter=s,this.minFilter=u,this.anisotropy=p,this.format=d,this.internalFormat=null,this.type=f,this.offset=new H(0,0),this.repeat=new H(1,1),this.center=new H(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new W,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=m,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Et).x}get height(){return this.source.getSize(Et).y}get depth(){return this.source.getSize(Et).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){B(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){B(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(r){if(this.mapping!==300)return r;if(r.applyMatrix3(this.matrix),r.x<0||r.x>1)switch(this.wrapS){case e:r.x-=Math.floor(r.x);break;case t:r.x=r.x<0?0:1;break;case n:Math.abs(Math.floor(r.x)%2)===1?r.x=Math.ceil(r.x)-r.x:r.x-=Math.floor(r.x)}if(r.y<0||r.y>1)switch(this.wrapT){case e:r.y-=Math.floor(r.y);break;case t:r.y=r.y<0?0:1;break;case n:Math.abs(Math.floor(r.y)%2)===1?r.y=Math.ceil(r.y)-r.y:r.y-=Math.floor(r.y)}return this.flipY&&(r.y=1-r.y),r}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Dt.DEFAULT_IMAGE=null,Dt.DEFAULT_MAPPING=300,Dt.DEFAULT_ANISOTROPY=1;var Ot=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this.z=at(this.z,e.z,t.z),this.w=at(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this.z=at(this.z,e,t),this.w=at(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},kt=class extends et{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:o,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Ot(0,0,e,t),this.scissorTest=!1,this.viewport=new Ot(0,0,e,t),this.textures=[];let r=new Dt({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:o,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new Ct(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null){if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture}return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},At=class extends kt{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},jt=class extends Dt{constructor(e=null,n=1,i=1,a=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:n,height:i,depth:a},this.magFilter=r,this.minFilter=r,this.wrapR=t,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Mt=class extends Dt{constructor(e=null,n=1,i=1,a=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:n,height:i,depth:a},this.magFilter=r,this.minFilter=r,this.wrapR=t,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}},G=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Nt.setFromMatrixColumn(e,0).length(),i=1/Nt.setFromMatrixColumn(e,1).length(),a=1/Nt.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Ft,e,It)}lookAt(e,t,n){let r=this.elements;return zt.subVectors(e,t),zt.lengthSq()===0&&(zt.z=1),zt.normalize(),Lt.crossVectors(n,zt),Lt.lengthSq()===0&&(Math.abs(n.z)===1?zt.x+=1e-4:zt.z+=1e-4,zt.normalize(),Lt.crossVectors(n,zt)),Lt.normalize(),Rt.crossVectors(zt,Lt),r[0]=Lt.x,r[4]=Rt.x,r[8]=zt.x,r[1]=Lt.y,r[5]=Rt.y,r[9]=zt.y,r[2]=Lt.z,r[6]=Rt.z,r[10]=zt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],ee=r[10],j=r[14],M=r[3],N=r[7],te=r[11],P=r[15];return i[0]=a*x+o*T+s*k+c*M,i[4]=a*S+o*E+s*A+c*N,i[8]=a*C+o*D+s*ee+c*te,i[12]=a*w+o*O+s*j+c*P,i[1]=l*x+u*T+d*k+f*M,i[5]=l*S+u*E+d*A+f*N,i[9]=l*C+u*D+d*ee+f*te,i[13]=l*w+u*O+d*j+f*P,i[2]=p*x+m*T+h*k+g*M,i[6]=p*S+m*E+h*A+g*N,i[10]=p*C+m*D+h*ee+g*te,i[14]=p*w+m*O+h*j+g*P,i[3]=_*x+v*T+y*k+b*M,i[7]=_*S+v*E+y*A+b*N,i[11]=_*C+v*D+y*ee+b*te,i[15]=_*w+v*O+y*j+b*P,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=Nt.set(r[0],r[1],r[2]).length(),o=Nt.set(r[4],r[5],r[6]).length(),s=Nt.set(r[8],r[9],r[10]).length();i<0&&(a=-a),Pt.copy(this);let c=1/a,l=1/o,u=1/s;return Pt.elements[0]*=c,Pt.elements[1]*=c,Pt.elements[2]*=c,Pt.elements[4]*=l,Pt.elements[5]*=l,Pt.elements[6]*=l,Pt.elements[8]*=u,Pt.elements[9]*=u,Pt.elements[10]*=u,t.setFromRotationMatrix(Pt),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=Ue,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=Ue,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Nt=new U,Pt=new G,Ft=new U(0,0,0),It=new U(1,1,1),Lt=new U,Rt=new U,zt=new U,Bt=new G,Vt=new ut,Ht=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(at(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-at(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(at(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-at(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(at(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-at(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:B(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Bt.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Bt,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Vt.setFromEuler(this),this.setFromQuaternion(Vt,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Ht.DEFAULT_ORDER=`XYZ`;var Ut=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return!!(this.mask&(1<<e|0))}},Wt=0,Gt=new U,Kt=new ut,qt=new G,Jt=new U,Yt=new U,Xt=new U,Zt=new ut,Qt=new U(1,0,0),$t=new U(0,1,0),en=new U(0,0,1),tn={type:`added`},nn={type:`removed`},rn={type:`childadded`,child:null},an={type:`childremoved`,child:null},on=class e extends et{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Wt++}),this.uuid=it(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new U,n=new Ht,r=new ut,i=new U(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new G},normalMatrix:{value:new W}}),this.matrix=new G,this.matrixWorld=new G,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ut,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Kt.setFromAxisAngle(e,t),this.quaternion.multiply(Kt),this}rotateOnWorldAxis(e,t){return Kt.setFromAxisAngle(e,t),this.quaternion.premultiply(Kt),this}rotateX(e){return this.rotateOnAxis(Qt,e)}rotateY(e){return this.rotateOnAxis($t,e)}rotateZ(e){return this.rotateOnAxis(en,e)}translateOnAxis(e,t){return Gt.copy(e).applyQuaternion(this.quaternion),this.position.add(Gt.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Qt,e)}translateY(e){return this.translateOnAxis($t,e)}translateZ(e){return this.translateOnAxis(en,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(qt.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Jt.copy(e):Jt.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Yt.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?qt.lookAt(Yt,Jt,this.up):qt.lookAt(Jt,Yt,this.up),this.quaternion.setFromRotationMatrix(qt),r&&(qt.extractRotation(r.matrixWorld),Kt.setFromRotationMatrix(qt),this.quaternion.premultiply(Kt.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(V(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(tn),rn.child=e,this.dispatchEvent(rn),rn.child=null):V(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(nn),an.child=e,this.dispatchEvent(an),an.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),qt.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),qt.multiply(e.parent.matrixWorld)),e.applyMatrix4(qt),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(tn),rn.child=e,this.dispatchEvent(rn),rn.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yt,e,Xt),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yt,Zt,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0){if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material)}if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:`dispose`})}};on.DEFAULT_UP=new U(0,1,0),on.DEFAULT_MATRIX_AUTO_UPDATE=!0,on.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var sn=class extends on{constructor(){super(),this.isGroup=!0,this.type=`Group`}},cn={type:`move`},ln=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new sn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new sn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new sn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(cn)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new sn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},un={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},dn={h:0,s:0,l:0},fn={h:0,s:0,l:0};function pn(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var K=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ie){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,_t.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=_t.workingColorSpace){return this.r=e,this.g=t,this.b=n,_t.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=_t.workingColorSpace){if(e=ot(e,1),t=at(t,0,1),n=at(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=pn(i,r,e+1/3),this.g=pn(i,r,e),this.b=pn(i,r,e-1/3)}return _t.colorSpaceToWorking(this,r),this}setStyle(e,t=Ie){function n(t){t!==void 0&&parseFloat(t)<1&&B(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:B(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);B(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ie){let n=un[e.toLowerCase()];return n===void 0?B(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=vt(e.r),this.g=vt(e.g),this.b=vt(e.b),this}copyLinearToSRGB(e){return this.r=yt(e.r),this.g=yt(e.g),this.b=yt(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ie){return _t.workingToColorSpace(mn.copy(this),e),Math.round(at(mn.r*255,0,255))*65536+Math.round(at(mn.g*255,0,255))*256+Math.round(at(mn.b*255,0,255))}getHexString(e=Ie){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=_t.workingColorSpace){_t.workingToColorSpace(mn.copy(this),t);let n=mn.r,r=mn.g,i=mn.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=_t.workingColorSpace){return _t.workingToColorSpace(mn.copy(this),t),e.r=mn.r,e.g=mn.g,e.b=mn.b,e}getStyle(e=Ie){_t.workingToColorSpace(mn.copy(this),e);let t=mn.r,n=mn.g,r=mn.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(dn),this.setHSL(dn.h+e,dn.s+t,dn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(dn),e.getHSL(fn);let n=st(dn.h,fn.h,t),r=st(dn.s,fn.s,t),i=st(dn.l,fn.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},mn=new K;K.NAMES=un;var hn=class extends on{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ht,this.environmentIntensity=1,this.environmentRotation=new Ht,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},gn=new U,_n=new U,vn=new U,yn=new U,bn=new U,xn=new U,Sn=new U,Cn=new U,wn=new U,Tn=new U,En=new Ot,Dn=new Ot,On=new Ot,kn=class e{constructor(e=new U,t=new U,n=new U){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),gn.subVectors(e,t),r.cross(gn);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){gn.subVectors(r,t),_n.subVectors(n,t),vn.subVectors(e,t);let a=gn.dot(gn),o=gn.dot(_n),s=gn.dot(vn),c=_n.dot(_n),l=_n.dot(vn),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,yn)!==null&&yn.x>=0&&yn.y>=0&&yn.x+yn.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,yn)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,yn.x),s.addScaledVector(a,yn.y),s.addScaledVector(o,yn.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return En.setScalar(0),Dn.setScalar(0),On.setScalar(0),En.fromBufferAttribute(e,t),Dn.fromBufferAttribute(e,n),On.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(En,i.x),a.addScaledVector(Dn,i.y),a.addScaledVector(On,i.z),a}static isFrontFacing(e,t,n,r){return gn.subVectors(n,t),_n.subVectors(e,t),gn.cross(_n).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return gn.subVectors(this.c,this.b),_n.subVectors(this.a,this.b),gn.cross(_n).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;bn.subVectors(r,n),xn.subVectors(i,n),Cn.subVectors(e,n);let s=bn.dot(Cn),c=xn.dot(Cn);if(s<=0&&c<=0)return t.copy(n);wn.subVectors(e,r);let l=bn.dot(wn),u=xn.dot(wn);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(bn,a);Tn.subVectors(e,i);let f=bn.dot(Tn),p=xn.dot(Tn);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(xn,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return Sn.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(Sn,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(bn,a).addScaledVector(xn,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},An=class{constructor(e=new U(1/0,1/0,1/0),t=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Mn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Mn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Mn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Mn):Mn.fromBufferAttribute(r,t),Mn.applyMatrix4(e.matrixWorld),this.expandByPoint(Mn);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),Nn.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),Nn.copy(e.boundingBox)),Nn.applyMatrix4(e.matrixWorld),this.union(Nn)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Mn),Mn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Bn),Vn.subVectors(this.max,Bn),Pn.subVectors(e.a,Bn),Fn.subVectors(e.b,Bn),In.subVectors(e.c,Bn),Ln.subVectors(Fn,Pn),Rn.subVectors(In,Fn),zn.subVectors(Pn,In);let t=[0,-Ln.z,Ln.y,0,-Rn.z,Rn.y,0,-zn.z,zn.y,Ln.z,0,-Ln.x,Rn.z,0,-Rn.x,zn.z,0,-zn.x,-Ln.y,Ln.x,0,-Rn.y,Rn.x,0,-zn.y,zn.x,0];return!Wn(t,Pn,Fn,In,Vn)||(t=[1,0,0,0,1,0,0,0,1],!Wn(t,Pn,Fn,In,Vn))?!1:(Hn.crossVectors(Ln,Rn),t=[Hn.x,Hn.y,Hn.z],Wn(t,Pn,Fn,In,Vn))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Mn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Mn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(jn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},jn=[new U,new U,new U,new U,new U,new U,new U,new U],Mn=new U,Nn=new An,Pn=new U,Fn=new U,In=new U,Ln=new U,Rn=new U,zn=new U,Bn=new U,Vn=new U,Hn=new U,Un=new U;function Wn(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){Un.fromArray(e,a);let o=i.x*Math.abs(Un.x)+i.y*Math.abs(Un.y)+i.z*Math.abs(Un.z),s=t.dot(Un),c=n.dot(Un),l=r.dot(Un);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var Gn=new U,Kn=new H,qn=0,Jn=class extends et{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:qn++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=Ve,this.updateRanges=[],this.gpuType=h,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Kn.fromBufferAttribute(this,t),Kn.applyMatrix3(e),this.setXY(t,Kn.x,Kn.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Gn.fromBufferAttribute(this,t),Gn.applyMatrix3(e),this.setXYZ(t,Gn.x,Gn.y,Gn.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Gn.fromBufferAttribute(this,t),Gn.applyMatrix4(e),this.setXYZ(t,Gn.x,Gn.y,Gn.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Gn.fromBufferAttribute(this,t),Gn.applyNormalMatrix(e),this.setXYZ(t,Gn.x,Gn.y,Gn.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Gn.fromBufferAttribute(this,t),Gn.transformDirection(e),this.setXYZ(t,Gn.x,Gn.y,Gn.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=ct(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=lt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=ct(t,this.array)),t}setX(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=ct(t,this.array)),t}setY(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=ct(t,this.array)),t}setZ(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=ct(t,this.array)),t}setW(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),n=lt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),n=lt(n,this.array),r=lt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),n=lt(n,this.array),r=lt(r,this.array),i=lt(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:`dispose`})}},Yn=class extends Jn{constructor(e,t,n){super(new Uint16Array(e),t,n)}},Xn=class extends Jn{constructor(e,t,n){super(new Uint32Array(e),t,n)}},Zn=class extends Jn{constructor(e,t,n){super(new Float32Array(e),t,n)}},Qn=new An,$n=new U,er=new U,tr=class{constructor(e=new U,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?Qn.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;$n.subVectors(e,this.center);let t=$n.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector($n,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(er.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint($n.copy(e.center).add(er)),this.expandByPoint($n.copy(e.center).sub(er))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},nr=0,rr=new G,ir=new on,ar=new U,or=new An,sr=new An,cr=new U,lr=class e extends et{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:nr++}),this.uuid=it(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return this.index=Array.isArray(e)?new(We(e)?Xn:Yn)(e,1):e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new W().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return rr.makeRotationFromQuaternion(e),this.applyMatrix4(rr),this}rotateX(e){return rr.makeRotationX(e),this.applyMatrix4(rr),this}rotateY(e){return rr.makeRotationY(e),this.applyMatrix4(rr),this}rotateZ(e){return rr.makeRotationZ(e),this.applyMatrix4(rr),this}translate(e,t,n){return rr.makeTranslation(e,t,n),this.applyMatrix4(rr),this}scale(e,t,n){return rr.makeScale(e,t,n),this.applyMatrix4(rr),this}lookAt(e){return ir.lookAt(e),ir.updateMatrix(),this.applyMatrix4(ir.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ar).negate(),this.translate(ar.x,ar.y,ar.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new Zn(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&B(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new An);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){V(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];or.setFromBufferAttribute(n),this.morphTargetsRelative?(cr.addVectors(this.boundingBox.min,or.min),this.boundingBox.expandByPoint(cr),cr.addVectors(this.boundingBox.max,or.max),this.boundingBox.expandByPoint(cr)):(this.boundingBox.expandByPoint(or.min),this.boundingBox.expandByPoint(or.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&V(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new tr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){V(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new U,1/0);return}if(e){let n=this.boundingSphere.center;if(or.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];sr.setFromBufferAttribute(n),this.morphTargetsRelative?(cr.addVectors(or.min,sr.min),or.expandByPoint(cr),cr.addVectors(or.max,sr.max),or.expandByPoint(cr)):(or.expandByPoint(sr.min),or.expandByPoint(sr.max))}or.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)cr.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(cr));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)cr.fromBufferAttribute(a,t),o&&(ar.fromBufferAttribute(e,t),cr.add(ar)),r=Math.max(r,n.distanceToSquared(cr))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&V(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){V(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new Jn(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new U,s[e]=new U;let c=new U,l=new U,u=new U,d=new H,f=new H,p=new H,m=new U,h=new U;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new U,y=new U,b=new U,x=new U;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new Jn(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new U,i=new U,a=new U,o=new U,s=new U,c=new U,l=new U,u=new U;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)cr.fromBufferAttribute(e,t),cr.normalize(),e.setXYZ(t,cr.x,cr.y,cr.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new Jn(a,r,i)}if(this.index===null)return B(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},ur=new U,dr=new U,fr=new W,pr=class{constructor(e=new U(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=ur.subVectors(n,t).cross(dr.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(ur),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||fr.getNormalMatrix(e),r=this.coplanarPoint(ur).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},mr=0,hr=class extends et{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:mr++}),this.uuid=it(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new K(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Be,this.stencilZFail=Be,this.stencilZPass=Be,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){B(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){B(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(e=>e.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new K().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(e=>new pr().fromJSON(e))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(this.vertexColors=typeof e.vertexColors==`number`?e.vertexColors>0:e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new H().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new H().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},gr=new U,_r=new U,vr=new U,yr=new U,br=class{constructor(e=new U,t=new U(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,gr)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=gr.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(gr.copy(this.origin).addScaledVector(this.direction,t),gr.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){_r.copy(e).add(t).multiplyScalar(.5),vr.copy(t).sub(e).normalize(),yr.copy(this.origin).sub(_r);let i=e.distanceTo(t)*.5,a=-this.direction.dot(vr),o=yr.dot(this.direction),s=-yr.dot(vr),c=yr.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0){if(u=a*s-o,d=a*o-s,p=i*l,u>=0){if(d>=-p){if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c)}else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(_r).addScaledVector(vr,d),f}intersectSphere(e,t){if(e.radius<0)return null;gr.subVectors(e.center,this.origin);let n=gr.dot(this.direction),r=gr.dot(gr)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,gr)!==null}intersectTriangle(e,t,n,r,i){let a=this.origin,o=this.direction,s=o.x,c=o.y,l=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,m=t.y-a.y,h=t.z-a.z,g=n.x-a.x,_=n.y-a.y,v=n.z-a.z,y=Math.abs(s),b=Math.abs(c),x=Math.abs(l),S,C,w,T,E,D,O,k,A,ee,j,M;if(y>=b&&y>=x?(w=s,D=u,A=p,M=g,s>=0?(S=c,C=l,T=d,E=f,O=m,k=h,ee=_,j=v):(S=l,C=c,T=f,E=d,O=h,k=m,ee=v,j=_)):b>=x?(w=c,D=d,A=m,M=_,c>=0?(S=l,C=s,T=f,E=u,O=h,k=p,ee=v,j=g):(S=s,C=l,T=u,E=f,O=p,k=h,ee=g,j=v)):(w=l,D=f,A=h,M=v,l>=0?(S=s,C=c,T=u,E=d,O=p,k=m,ee=g,j=_):(S=c,C=s,T=d,E=u,O=m,k=p,ee=_,j=g)),w===0)return null;let N=S/w,te=C/w,P=1/w,F=T-N*D,ne=E-te*D,re=O-N*A,ie=k-te*A,ae=ee-N*M,oe=j-te*M,se=ae*ie-oe*re,I=F*oe-ne*ae,ce=re*ne-ie*F;if(r){if(se<0||I<0||ce<0)return null}else if((se<0||I<0||ce<0)&&(se>0||I>0||ce>0))return null;let le=se+I+ce;if(le===0)return null;let ue=P*(se*D+I*A+ce*M);return(le>0?ue<0:ue>0)?null:this.at(ue/le,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},xr=class extends hr{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new K(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ht,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Sr=new G,Cr=new br,wr=new tr,Tr=new U,Er=new U,Dr=new U,Or=new U,kr=new U,Ar=new U,jr=new U,Mr=new U,Nr=class extends on{constructor(e=new lr,t=new xr){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Ar.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(kr.fromBufferAttribute(s,e),a?Ar.addScaledVector(kr,r):Ar.addScaledVector(kr.sub(t),r))}t.add(Ar)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),wr.copy(n.boundingSphere),wr.applyMatrix4(i),Cr.copy(e.ray).recast(e.near),!(wr.containsPoint(Cr.origin)===!1&&(Cr.intersectSphere(wr,Tr)===null||Cr.origin.distanceToSquared(Tr)>(e.far-e.near)**2))&&(Sr.copy(i).invert(),Cr.copy(e.ray).applyMatrix4(Sr),(n.boundingBox===null||Cr.intersectsBox(n.boundingBox)!==!1)&&this._computeIntersections(e,t,Cr)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null){if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=Fr(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=Fr(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}}else if(s!==void 0){if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=Fr(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=Fr(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}}};function Pr(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;Mr.copy(s),Mr.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(Mr);return l<n.near||l>n.far?null:{distance:l,point:Mr.clone(),object:e}}function Fr(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Er),e.getVertexPosition(c,Dr),e.getVertexPosition(l,Or);let u=Pr(e,t,n,r,Er,Dr,Or,jr);if(u){let e=new U;kn.getBarycoord(jr,Er,Dr,Or,e),i&&(u.uv=kn.getInterpolatedAttribute(i,s,c,l,e,new H)),a&&(u.uv1=kn.getInterpolatedAttribute(a,s,c,l,e,new H)),o&&(u.normal=kn.getInterpolatedAttribute(o,s,c,l,e,new U),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new U,materialIndex:0};kn.getNormal(Er,Dr,Or,t.normal),u.face=t,u.barycoord=e}return u}var Ir=class extends Dt{constructor(e=null,t=1,n=1,i,a,o,s,c,l=r,u=r,d,f){super(null,o,s,c,l,u,i,a,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Lr=class extends Jn{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Rr=new G,zr=new G,Br=[],Vr=new An,Hr=new G,Ur=new Nr,Wr=new tr,Gr=class extends Nr{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Lr(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,Hr)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new An),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Rr),Vr.copy(e.boundingBox).applyMatrix4(Rr),this.boundingBox.union(Vr)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new tr),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Rr),Wr.copy(e.boundingSphere).applyMatrix4(Rr),this.boundingSphere.union(Wr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Ur.geometry=this.geometry,Ur.material=this.material,Ur.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wr.copy(this.boundingSphere),Wr.applyMatrix4(n),e.ray.intersectsSphere(Wr)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,Rr),zr.multiplyMatrices(n,Rr),Ur.matrixWorld=zr,Ur.raycast(e,Br);for(let e=0,n=Br.length;e<n;e++){let n=Br[e];n.instanceId=i,n.object=this,t.push(n)}Br.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Lr(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new Ir(new Float32Array(r*this.count),r,this.count,D,h));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Kr=new tr,qr=new H(.5,.5),Jr=new U,Yr=class{constructor(e=new pr,t=new pr,n=new pr,r=new pr,i=new pr,a=new pr){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Ue,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Kr.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Kr.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Kr)}intersectsSprite(e){return Kr.center.set(0,0,0),Kr.radius=.7071067811865476+qr.distanceTo(e.center),Kr.applyMatrix4(e.matrixWorld),this.intersectsSphere(Kr)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(Jr.x=r.normal.x>0?e.max.x:e.min.x,Jr.y=r.normal.y>0?e.max.y:e.min.y,Jr.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Jr)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},Xr=class extends hr{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new K(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Zr=new G,Qr=new br,$r=new tr,ei=new U,ti=class extends on{constructor(e=new lr,t=new Xr){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),$r.copy(n.boundingSphere),$r.applyMatrix4(r),$r.radius+=i,e.ray.intersectsSphere($r)===!1)return;Zr.copy(r).invert(),Qr.copy(e.ray).applyMatrix4(Zr);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);ei.fromBufferAttribute(l,n),ni(ei,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)ei.fromBufferAttribute(l,a),ni(ei,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function ni(e,t,n,r,i,a,o){let s=Qr.distanceSqToPoint(e);if(s<n){let n=new U;Qr.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var ri=class extends Dt{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},ii=class extends Dt{constructor(e,t,n,r,i,a,o,s,c){super(e,t,n,r,i,a,o,s,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},ai=class extends Dt{constructor(e,t,n=m,i,a,o,s=r,c=r,l,u=T,d=1){if(u!==1026&&u!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:d},i,a,o,s,c,u,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ct(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},oi=class extends ai{constructor(e,t=m,n=301,i,a,o=r,s=r,c,l=T){let u={width:e,height:e,depth:1},d=[u,u,u,u,u,u];super(e,e,t,n,i,a,o,s,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},si=class extends Dt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},ci=class e extends lr{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new Zn(c,3)),this.setAttribute(`normal`,new Zn(l,3)),this.setAttribute(`uv`,new Zn(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new U;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};function li(e,t,n=2){let r=t&&t.length,i=r?t[0]*n:e.length,a=ui(e,0,i,n,!0),o=[];if(!a||a.next===a.prev)return o;let s,c,l;if(r&&(a=_i(e,t,a,n)),e.length>80*n){s=e[0],c=e[1];let t=s,r=c;for(let a=n;a<i;a+=n){let n=e[a],i=e[a+1];n<s&&(s=n),i<c&&(c=i),n>t&&(t=n),i>r&&(r=i)}l=Math.max(t-s,r-c),l=l===0?0:32767/l}return fi(a,o,n,s,c,l,0),o}function ui(e,t,n,r,i){let a;if(i===Vi(e,t,n,r)>0)for(let i=t;i<n;i+=r)a=Ri(i/r|0,e[i],e[i+1],a);else for(let i=n-r;i>=t;i-=r)a=Ri(i/r|0,e[i],e[i+1],a);return a&&Ai(a,a.next)&&(zi(a),a=a.next),a}function di(e,t){if(!e)return e;t||=e;let n=e,r;do if(r=!1,!n.steiner&&(Ai(n,n.next)||ki(n.prev,n,n.next)===0)){if(zi(n),n=t=n.prev,n===n.next)break;r=!0}else n=n.next;while(r||n!==t);return t}function fi(e,t,n,r,i,a,o){if(!e)return;!o&&a&&Si(e,r,i,a);let s=e;for(;e.prev!==e.next;){let c=e.prev,l=e.next;if(a?mi(e,r,i,a):pi(e)){t.push(c.i,e.i,l.i),zi(e),e=l.next,s=l.next;continue}if(e=l,e===s){o?o===1?(e=hi(di(e),t),fi(e,t,n,r,i,a,2)):o===2&&gi(e,t,n,r,i,a):fi(di(e),t,n,r,i,a,1);break}}}function pi(e){let t=e.prev,n=e,r=e.next;if(ki(t,n,r)>=0)return!1;let i=t.x,a=n.x,o=r.x,s=t.y,c=n.y,l=r.y,u=Math.min(i,a,o),d=Math.min(s,c,l),f=Math.max(i,a,o),p=Math.max(s,c,l),m=r.next;for(;m!==t;){if(m.x>=u&&m.x<=f&&m.y>=d&&m.y<=p&&Di(i,s,a,c,o,l,m.x,m.y)&&ki(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function mi(e,t,n,r){let i=e.prev,a=e,o=e.next;if(ki(i,a,o)>=0)return!1;let s=i.x,c=a.x,l=o.x,u=i.y,d=a.y,f=o.y,p=Math.min(s,c,l),m=Math.min(u,d,f),h=Math.max(s,c,l),g=Math.max(u,d,f),_=wi(p,m,t,n,r),v=wi(h,g,t,n,r),y=e.prevZ,b=e.nextZ;for(;y&&y.z>=_&&b&&b.z<=v;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Di(s,u,c,d,l,f,y.x,y.y)&&ki(y.prev,y,y.next)>=0||(y=y.prevZ,b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Di(s,u,c,d,l,f,b.x,b.y)&&ki(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;y&&y.z>=_;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Di(s,u,c,d,l,f,y.x,y.y)&&ki(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;b&&b.z<=v;){if(b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Di(s,u,c,d,l,f,b.x,b.y)&&ki(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function hi(e,t){let n=e;do{let r=n.prev,i=n.next.next;!Ai(r,i)&&ji(r,n,n.next,i)&&Fi(r,i)&&Fi(i,r)&&(t.push(r.i,n.i,i.i),zi(n),zi(n.next),n=e=i),n=n.next}while(n!==e);return di(n)}function gi(e,t,n,r,i,a){let o=e;do{let e=o.next.next;for(;e!==o.prev;){if(o.i!==e.i&&Oi(o,e)){let s=Li(o,e);o=di(o,o.next),s=di(s,s.next),fi(o,t,n,r,i,a,0),fi(s,t,n,r,i,a,0);return}e=e.next}o=o.next}while(o!==e)}function _i(e,t,n,r){let i=[];for(let n=0,a=t.length;n<a;n++){let o=ui(e,t[n]*r,n<a-1?t[n+1]*r:e.length,r,!1);o===o.next&&(o.steiner=!0),i.push(Ti(o))}i.sort(vi);for(let e=0;e<i.length;e++)n=yi(i[e],n);return n}function vi(e,t){let n=e.x-t.x;return n===0&&(n=e.y-t.y,n===0&&(n=(e.next.y-e.y)/(e.next.x-e.x)-(t.next.y-t.y)/(t.next.x-t.x))),n}function yi(e,t){let n=bi(e,t);if(!n)return t;let r=Li(n,e);return di(r,r.next),di(n,n.next)}function bi(e,t){let n=t,r=e.x,i=e.y,a=-1/0,o;if(Ai(e,n))return n;do{if(Ai(e,n.next))return n.next;if(i<=n.y&&i>=n.next.y&&n.next.y!==n.y){let e=n.x+(i-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(e<=r&&e>a&&(a=e,o=n.x<n.next.x?n:n.next,e===r))return o}n=n.next}while(n!==t);if(!o)return null;let s=o,c=o.x,l=o.y,u=1/0;n=o;do{if(r>=n.x&&n.x>=c&&r!==n.x&&Ei(i<l?r:a,i,c,l,i<l?a:r,i,n.x,n.y)){let t=Math.abs(i-n.y)/(r-n.x);Fi(n,e)&&(t<u||t===u&&(n.x>o.x||n.x===o.x&&xi(o,n)))&&(o=n,u=t)}n=n.next}while(n!==s);return o}function xi(e,t){return ki(e.prev,e,t.prev)<0&&ki(t.next,e,e.next)<0}function Si(e,t,n,r){let i=e;do i.z===0&&(i.z=wi(i.x,i.y,t,n,r)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==e);i.prevZ.nextZ=null,i.prevZ=null,Ci(i)}function Ci(e){let t,n=1;do{let r=e,i;e=null;let a=null;for(t=0;r;){t++;let o=r,s=0;for(let e=0;e<n&&(s++,o=o.nextZ,o);e++);let c=n;for(;s>0||c>0&&o;)s!==0&&(c===0||!o||r.z<=o.z)?(i=r,r=r.nextZ,s--):(i=o,o=o.nextZ,c--),a?a.nextZ=i:e=i,i.prevZ=a,a=i;r=o}a.nextZ=null,n*=2}while(t>1);return e}function wi(e,t,n,r,i){return e=(e-n)*i|0,t=(t-r)*i|0,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,e|t<<1}function Ti(e){let t=e,n=e;do(t.x<n.x||t.x===n.x&&t.y<n.y)&&(n=t),t=t.next;while(t!==e);return n}function Ei(e,t,n,r,i,a,o,s){return(i-o)*(t-s)>=(e-o)*(a-s)&&(e-o)*(r-s)>=(n-o)*(t-s)&&(n-o)*(a-s)>=(i-o)*(r-s)}function Di(e,t,n,r,i,a,o,s){return(e!==o||t!==s)&&Ei(e,t,n,r,i,a,o,s)}function Oi(e,t){return e.next.i!==t.i&&e.prev.i!==t.i&&!Pi(e,t)&&(Fi(e,t)&&Fi(t,e)&&Ii(e,t)&&(ki(e.prev,e,t.prev)||ki(e,t.prev,t))||Ai(e,t)&&ki(e.prev,e,e.next)>0&&ki(t.prev,t,t.next)>0)}function ki(e,t,n){return(t.y-e.y)*(n.x-t.x)-(t.x-e.x)*(n.y-t.y)}function Ai(e,t){return e.x===t.x&&e.y===t.y}function ji(e,t,n,r){let i=Ni(ki(e,t,n)),a=Ni(ki(e,t,r)),o=Ni(ki(n,r,e)),s=Ni(ki(n,r,t));return!!(i!==a&&o!==s||i===0&&Mi(e,n,t)||a===0&&Mi(e,r,t)||o===0&&Mi(n,e,r)||s===0&&Mi(n,t,r))}function Mi(e,t,n){return t.x<=Math.max(e.x,n.x)&&t.x>=Math.min(e.x,n.x)&&t.y<=Math.max(e.y,n.y)&&t.y>=Math.min(e.y,n.y)}function Ni(e){return e>0?1:e<0?-1:0}function Pi(e,t){let n=e;do{if(n.i!==e.i&&n.next.i!==e.i&&n.i!==t.i&&n.next.i!==t.i&&ji(n,n.next,e,t))return!0;n=n.next}while(n!==e);return!1}function Fi(e,t){return ki(e.prev,e,e.next)<0?ki(e,t,e.next)>=0&&ki(e,e.prev,t)>=0:ki(e,t,e.prev)<0||ki(e,e.next,t)<0}function Ii(e,t){let n=e,r=!1,i=(e.x+t.x)/2,a=(e.y+t.y)/2;do n.y>a!=n.next.y>a&&n.next.y!==n.y&&i<(n.next.x-n.x)*(a-n.y)/(n.next.y-n.y)+n.x&&(r=!r),n=n.next;while(n!==e);return r}function Li(e,t){let n=Bi(e.i,e.x,e.y),r=Bi(t.i,t.x,t.y),i=e.next,a=t.prev;return e.next=t,t.prev=e,n.next=i,i.prev=n,r.next=n,n.prev=r,a.next=r,r.prev=a,r}function Ri(e,t,n,r){let i=Bi(e,t,n);return r?(i.next=r.next,i.prev=r,r.next.prev=i,r.next=i):(i.prev=i,i.next=i),i}function zi(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function Bi(e,t,n){return{i:e,x:t,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Vi(e,t,n,r){let i=0;for(let a=t,o=n-r;a<n;a+=r)i+=(e[o]-e[a])*(e[a+1]+e[o+1]),o=a;return i}var Hi=class{static triangulate(e,t,n=2){return li(e,t,n)}},Ui=class e{static area(e){let t=e.length,n=0;for(let r=t-1,i=0;i<t;r=i++)n+=e[r].x*e[i].y-e[i].x*e[r].y;return n*.5}static isClockWise(t){return e.area(t)<0}static triangulateShape(e,t){let n=[],r=[],i=[];Wi(e),Gi(n,e);let a=e.length;t.forEach(Wi);for(let e=0;e<t.length;e++)r.push(a),a+=t[e].length,Gi(n,t[e]);let o=Hi.triangulate(n,r);for(let e=0;e<o.length;e+=3)i.push(o.slice(e,e+3));return i}};function Wi(e){let t=e.length;t>2&&e[t-1].equals(e[0])&&e.pop()}function Gi(e,t){for(let n=0;n<t.length;n++)e.push(t[n].x),e.push(t[n].y)}var Ki=class e extends lr{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new Zn(p,3)),this.setAttribute(`normal`,new Zn(m,3)),this.setAttribute(`uv`,new Zn(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}},qi=class e extends lr{constructor(e=1,t=32,n=16,r=0,i=Math.PI*2,a=0,o=Math.PI){super(),this.type=`SphereGeometry`,this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:i,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let s=Math.min(a+o,Math.PI),c=0,l=[],u=new U,d=new U,f=[],p=[],m=[],h=[];for(let f=0;f<=n;f++){let g=[],_=f/n,v=a+_*o,y=e*Math.cos(v),b=Math.sqrt(e*e-y*y),x=0;f===0&&a===0?x=.5/t:f===n&&s===Math.PI&&(x=-.5/t);for(let e=0;e<=t;e++){let n=e/t,a=r+n*i;u.x=-b*Math.cos(a),u.y=y,u.z=b*Math.sin(a),p.push(u.x,u.y,u.z),d.copy(u).normalize(),m.push(d.x,d.y,d.z),h.push(n+x,1-_),g.push(c++)}l.push(g)}for(let e=0;e<n;e++)for(let r=0;r<t;r++){let t=l[e][r+1],i=l[e][r],o=l[e+1][r],c=l[e+1][r+1];(e!==0||a>0)&&f.push(t,i,c),(e!==n-1||s<Math.PI)&&f.push(i,o,c)}this.setIndex(f),this.setAttribute(`position`,new Zn(p,3)),this.setAttribute(`normal`,new Zn(m,3)),this.setAttribute(`uv`,new Zn(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Ji(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(Xi(i))i.isRenderTargetTexture?(B(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i)){if(Xi(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice()}else t[n][r]=i}}return t}function Yi(e){let t={};for(let n=0;n<e.length;n++){let r=Ji(e[n]);for(let e in r)t[e]=r[e]}return t}function Xi(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Zi(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function Qi(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:_t.workingColorSpace}var $i={clone:Ji,merge:Yi},ea=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ta=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,na=class extends hr{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=ea,this.fragmentShader=ta,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ji(e.uniforms),this.uniformsGroups=Zi(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new K().setHex(r.value);break;case`v2`:this.uniforms[n].value=new H().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new U().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new Ot().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new W().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new G().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},ra=class extends na{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},ia=class extends hr{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new K(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new K(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new H(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ht,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},aa=class extends ia{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:``,PHYSICAL:``},this.type=`MeshPhysicalMaterial`,this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new H(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return at(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new K(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new K(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new K(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:``,PHYSICAL:``},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},oa=class extends hr{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=z,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},sa=class extends hr{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ca(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}function la(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}var ua=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},da=class extends ua{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Pe,endingEnd:Pe}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case R:i=e,o=2*t-n;break;case Fe:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case R:a=e,s=2*n-t;break;case Fe:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},fa=class extends ua{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},pa=class extends ua{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},ma=class extends ua{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1],x=_a(n,t,g,y,r);i[p]=ha(x,o,_,b,m)}return i}};function ha(e,t,n,r,i){let a=1-e;return a*a*a*t+3*a*a*e*n+3*a*e*e*r+e*e*e*i}function ga(e,t,n,r,i){let a=1-e;return 3*a*a*(n-t)+6*a*e*(r-n)+3*e*e*(i-r)}function _a(e,t,n,r,i){let a=(e-t)/(i-t);for(let o=0;o<8;o++){let o=ha(a,t,n,r,i)-e;if(Math.abs(o)<1e-10)break;let s=ga(a,t,n,r,i);if(Math.abs(s)<1e-10)break;a=Math.max(0,Math.min(1,a-o/s))}return a}var va=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=ca(t,this.TimeBufferType),this.values=ca(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ca(e.times,Array),values:ca(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t),la(e.settings)&&(n.settings={inTangents:ca(e.settings.inTangents,Array),outTangents:ca(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new pa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new fa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new da(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ma(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case je:t=this.InterpolantFactoryMethodDiscrete;break;case L:t=this.InterpolantFactoryMethodLinear;break;case Me:t=this.InterpolantFactoryMethodSmooth;break;case Ne:t=this.InterpolantFactoryMethodBezier}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0){if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t)}return B(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return je;case this.InterpolantFactoryMethodLinear:return L;case this.InterpolantFactoryMethodSmooth:return Me;case this.InterpolantFactoryMethodBezier:return Ne}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;la(this.settings)&&(ya(this.settings.inTangents,e),ya(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(V(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(V(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){V(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){V(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&Ge(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){V(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Me,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0])){if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,la(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function ya(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]*=t}va.prototype.ValueTypeName=``,va.prototype.TimeBufferType=Float32Array,va.prototype.ValueBufferType=Float32Array,va.prototype.DefaultInterpolation=L;var ba=class extends va{constructor(e,t,n){super(e,t,n)}};ba.prototype.ValueTypeName=`bool`,ba.prototype.ValueBufferType=Array,ba.prototype.DefaultInterpolation=je,ba.prototype.InterpolantFactoryMethodLinear=void 0,ba.prototype.InterpolantFactoryMethodSmooth=void 0;var xa=class extends va{constructor(e,t,n,r){super(e,t,n,r)}};xa.prototype.ValueTypeName=`color`;var Sa=class extends va{constructor(e,t,n,r){super(e,t,n,r)}};Sa.prototype.ValueTypeName=`number`;var Ca=class extends ua{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)ut.slerpFlat(i,0,a,c-o,a,c,s);return i}},wa=class extends va{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Ca(this.times,this.values,this.getValueSize(),e)}};wa.prototype.ValueTypeName=`quaternion`,wa.prototype.InterpolantFactoryMethodSmooth=void 0;var Ta=class extends va{constructor(e,t,n){super(e,t,n)}};Ta.prototype.ValueTypeName=`string`,Ta.prototype.ValueBufferType=Array,Ta.prototype.DefaultInterpolation=je,Ta.prototype.InterpolantFactoryMethodLinear=void 0,Ta.prototype.InterpolantFactoryMethodSmooth=void 0;var Ea=class extends va{constructor(e,t,n,r){super(e,t,n,r)}};Ea.prototype.ValueTypeName=`vector`;var Da=class extends on{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new K(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Oa=class extends Da{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type=`HemisphereLight`,this.position.copy(on.DEFAULT_UP),this.updateMatrix(),this.groundColor=new K(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},ka=new G,Aa=new U,ja=new U,Ma=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new H(512,512),this.mapType=l,this.map=null,this.mapPass=null,this.matrix=new G,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Yr,this._frameExtents=new H(1,1),this._viewportCount=1,this._viewports=[new Ot(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;Aa.setFromMatrixPosition(e.matrixWorld),t.position.copy(Aa),ja.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(ja),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,r){ka.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(ka,e.coordinateSystem,e.reversedDepth);let i=this._frameExtents,a=r?r.z/i.x:1,o=r?r.w/i.y:1,s=r?r.x/i.x:0,c=r?r.y/i.y:0;e.coordinateSystem===2001||e.reversedDepth?t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(ka)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Na=new U,Pa=new ut,Fa=new U,Ia=class extends on{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new G,this.projectionMatrix=new G,this.projectionMatrixInverse=new G,this.coordinateSystem=Ue,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Na,Pa,Fa),Fa.x===1&&Fa.y===1&&Fa.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Na,Pa,Fa.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Na,Pa,Fa),Fa.x===1&&Fa.y===1&&Fa.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Na,Pa,Fa.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},La=new U,Ra=new H,za=new H,Ba=class extends Ia{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=rt*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(nt*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return rt*2*Math.atan(Math.tan(nt*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){La.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(La.x,La.y).multiplyScalar(-e/La.z),La.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(La.x,La.y).multiplyScalar(-e/La.z)}getViewSize(e,t){return this.getViewBounds(e,Ra,za),t.subVectors(za,Ra)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(nt*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Va=class extends Ma{constructor(){super(new Ba(90,1,.5,500)),this.isPointLightShadow=!0}},Ha=class extends Da{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type=`PointLight`,this.distance=n,this.decay=r,this.shadow=new Va}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Ua=class extends Ia{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Wa=class extends Ma{constructor(){super(new Ua(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ga=class extends Da{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(on.DEFAULT_UP),this.updateMatrix(),this.target=new on,this.shadow=new Wa}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},Ka=class extends Da{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type=`AmbientLight`}},qa=class extends lr{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type=`InstancedBufferGeometry`,this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}},Ja=-90,Ya=1,Xa=class extends on{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Ba(Ja,Ya,e,t);r.layers=this.layers,this.add(r);let i=new Ba(Ja,Ya,e,t);i.layers=this.layers,this.add(i);let a=new Ba(Ja,Ya,e,t);a.layers=this.layers,this.add(a);let o=new Ba(Ja,Ya,e,t);o.layers=this.layers,this.add(o);let s=new Ba(Ja,Ya,e,t);s.layers=this.layers,this.add(s);let c=new Ba(Ja,Ya,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},Za=class extends Ba{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Qa=`\\[\\]\\.:\\/`,$a=RegExp(`[\\[\\]\\.:\\/]`,`g`),eo=`[^\\[\\]\\.:\\/]`,to=`[^`+Qa.replace(`\\.`,``)+`]`,no=`((?:WC+[\\/:])*)`.replace(`WC`,eo),ro=`(WCOD+)?`.replace(`WCOD`,to),io=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,eo),ao=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,eo),oo=RegExp(`^`+no+ro+io+ao+`$`),so=[`material`,`materials`,`bones`,`map`],co=class{constructor(e,t,n){let r=n||lo.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},lo=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace($a,``)}static parseTrackName(e){let t=oo.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);so.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){B(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){V(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){V(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){V(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){V(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){V(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){V(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){V(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;V(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){V(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){V(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};lo.Composite=co,lo.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},lo.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},lo.prototype.GetterByBindingType=[lo.prototype._getValue_direct,lo.prototype._getValue_array,lo.prototype._getValue_arrayElement,lo.prototype._getValue_toArray],lo.prototype.SetterByBindingTypeAndVersioning=[[lo.prototype._setValue_direct,lo.prototype._setValue_direct_setNeedsUpdate,lo.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[lo.prototype._setValue_array,lo.prototype._setValue_array_setNeedsUpdate,lo.prototype._setValue_array_setMatrixWorldNeedsUpdate],[lo.prototype._setValue_arrayElement,lo.prototype._setValue_arrayElement_setNeedsUpdate,lo.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[lo.prototype._setValue_fromArray,lo.prototype._setValue_fromArray_setNeedsUpdate,lo.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]],class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}};function uo(e,t,n,r){let i=fo(r);switch(n){case S:return e*t;case D:return e*t/i.components*i.byteLength;case O:return e*t/i.components*i.byteLength;case k:return e*t*2/i.components*i.byteLength;case A:return e*t*2/i.components*i.byteLength;case C:return e*t*3/i.components*i.byteLength;case w:return e*t*4/i.components*i.byteLength;case ee:return e*t*4/i.components*i.byteLength;case j:case M:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case N:case te:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case F:case re:return Math.max(e,16)*Math.max(t,8)/4;case P:case ne:return Math.max(e,8)*Math.max(t,8)/2;case ie:case ae:case se:case I:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case oe:case ce:case le:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case ue:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case de:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case fe:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case pe:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case me:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case he:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case ge:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case _e:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case ve:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case ye:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case be:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case xe:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case Se:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case Ce:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case we:case Te:case Ee:return Math.ceil(e/4)*Math.ceil(t/4)*16;case De:case Oe:return Math.ceil(e/4)*Math.ceil(t/4)*8;case ke:case Ae:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function fo(e){switch(e){case l:case u:return{byteLength:1,components:1};case f:case d:case g:return{byteLength:2,components:1};case _:case v:return{byteLength:2,components:4};case m:case p:case h:return{byteLength:4,components:1};case b:case x:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`186`}})),typeof window<`u`&&(window.__THREE__?B(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`186`);function po(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function mo(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var q={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},J={common:{diffuse:{value:new K(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new W},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new W}},envmap:{envMap:{value:null},envMapRotation:{value:new W},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new W}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new W}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new W},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new W},normalScale:{value:new H(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new W},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new W}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new W}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new W}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new K(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new U},probesMax:{value:new U},probesResolution:{value:new U}},points:{diffuse:{value:new K(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0},uvTransform:{value:new W}},sprite:{diffuse:{value:new K(16777215)},opacity:{value:1},center:{value:new H(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new W},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0}}},ho={basic:{uniforms:Yi([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.fog]),vertexShader:q.meshbasic_vert,fragmentShader:q.meshbasic_frag},lambert:{uniforms:Yi([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.fog,J.lights,{emissive:{value:new K(0)},envMapIntensity:{value:1}}]),vertexShader:q.meshlambert_vert,fragmentShader:q.meshlambert_frag},phong:{uniforms:Yi([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.fog,J.lights,{emissive:{value:new K(0)},specular:{value:new K(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:q.meshphong_vert,fragmentShader:q.meshphong_frag},standard:{uniforms:Yi([J.common,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.roughnessmap,J.metalnessmap,J.fog,J.lights,{emissive:{value:new K(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:q.meshphysical_vert,fragmentShader:q.meshphysical_frag},toon:{uniforms:Yi([J.common,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.gradientmap,J.fog,J.lights,{emissive:{value:new K(0)}}]),vertexShader:q.meshtoon_vert,fragmentShader:q.meshtoon_frag},matcap:{uniforms:Yi([J.common,J.bumpmap,J.normalmap,J.displacementmap,J.fog,{matcap:{value:null}}]),vertexShader:q.meshmatcap_vert,fragmentShader:q.meshmatcap_frag},points:{uniforms:Yi([J.points,J.fog]),vertexShader:q.points_vert,fragmentShader:q.points_frag},dashed:{uniforms:Yi([J.common,J.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:q.linedashed_vert,fragmentShader:q.linedashed_frag},depth:{uniforms:Yi([J.common,J.displacementmap]),vertexShader:q.depth_vert,fragmentShader:q.depth_frag},normal:{uniforms:Yi([J.common,J.bumpmap,J.normalmap,J.displacementmap,{opacity:{value:1}}]),vertexShader:q.meshnormal_vert,fragmentShader:q.meshnormal_frag},sprite:{uniforms:Yi([J.sprite,J.fog]),vertexShader:q.sprite_vert,fragmentShader:q.sprite_frag},background:{uniforms:{uvTransform:{value:new W},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:q.background_vert,fragmentShader:q.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new W}},vertexShader:q.backgroundCube_vert,fragmentShader:q.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:q.cube_vert,fragmentShader:q.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:q.equirect_vert,fragmentShader:q.equirect_frag},distance:{uniforms:Yi([J.common,J.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:q.distance_vert,fragmentShader:q.distance_frag},shadow:{uniforms:Yi([J.lights,J.fog,{color:{value:new K(0)},opacity:{value:1}}]),vertexShader:q.shadow_vert,fragmentShader:q.shadow_frag}};ho.physical={uniforms:Yi([ho.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new W},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new W},clearcoatNormalScale:{value:new H(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new W},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new W},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new W},sheen:{value:0},sheenColor:{value:new K(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new W},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new W},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new W},transmissionSamplerSize:{value:new H},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new W},attenuationDistance:{value:0},attenuationColor:{value:new K(0)},specularColor:{value:new K(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new W},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new W},anisotropyVector:{value:new H},anisotropyMap:{value:null},anisotropyMapTransform:{value:new W}}]),vertexShader:q.meshphysical_vert,fragmentShader:q.meshphysical_frag};var go={r:0,b:0,g:0},_o=new G,vo=new W;vo.set(-1,0,0,0,1,0,0,0,1);function yo(e,t,n,r,i,a){let o=new K(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new Nr(new ci(1,1,1),new na({name:`BackgroundCubeMaterial`,uniforms:Ji(ho.backgroundCube.uniforms),vertexShader:ho.backgroundCube.vertexShader,fragmentShader:ho.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(_o.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(vo),l.material.toneMapped=_t.getTransfer(i.colorSpace)!==ze,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Nr(new Ki(2,2),new na({name:`BackgroundMaterial`,uniforms:Ji(ho.background.uniforms),vertexShader:ho.background.vertexShader,fragmentShader:ho.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=_t.getTransfer(i.colorSpace)!==ze,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(go,Qi(e)),n.buffers.color.setClear(go.r,go.g,go.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function bo(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function xo(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function So(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(B(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&B(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function Co(e){let t=this,n=null,r=0,i=!1,a=!1,o=new pr,s=new W,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var wo=4,To=6,Eo=20,Do=256,Oo=new Ua,ko=new K,Ao=null,jo=0,Mo=0,No=!1,Po=new U,Fo=new U,Io=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=Po}=i;Ao=this._renderer.getRenderTarget(),jo=this._renderer.getActiveCubeFace(),Mo=this._renderer.getActiveMipmapLevel(),No=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Uo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ho(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Ao,jo,Mo),this._renderer.xr.enabled=No,e.scissorTest=!1,zo(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ao=this._renderer.getRenderTarget(),jo=this._renderer.getActiveCubeFace(),Mo=this._renderer.getActiveMipmapLevel(),No=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:o,minFilter:o,generateMipmaps:!1,type:g,format:w,colorSpace:Le,depthBuffer:!1},r=Ro(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ro(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Lo(r)),this._blurMaterial=Vo(r,e,t),this._ggxMaterial=Bo(r,e,t)}return r}_compileMaterial(e){let t=new Nr(new lr,e);this._renderer.compile(t,Oo)}_sceneToCubeUV(e,t,n,r,i){let a=new Ba(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(ko),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Nr(new ci,new xr({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(ko),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;zo(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Uo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ho());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;zo(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,Oo)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-wo?n-d+wo:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,zo(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,Oo),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,zo(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,Oo)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];zo(t,3*l*(r>this._lodMax-wo?r-this._lodMax+wo:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,Oo)}};function Lo(e){let t=[],n=[],r=e,i=e-wo+1+To;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?Fo.set(1,r,n):e===1?Fo.set(-n,1,-r):e===2?Fo.set(-n,r,1):e===3?Fo.set(-1,r,-n):e===4?Fo.set(-n,-1,r):Fo.set(n,r,-1),Fo.toArray(l,(e*6+t)*3)}}let u=new lr;u.setAttribute(`position`,new Jn(c,3)),u.setAttribute(`outputDirection`,new Jn(l,3)),n.push(new Nr(u,null)),r>wo&&r--}return{lodMeshes:n,sizeLods:t}}function Ro(e,t,n){let r=new At(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function zo(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function Bo(e,t,n){return new na({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:Do,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Wo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Vo(e,t,n){return new na({name:`SphericalGaussianBlur`,defines:{SAMPLES:Eo,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Wo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Ho(){return new na({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Wo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Uo(){return new na({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Wo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Wo(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Go=class extends At{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new ri(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new ci(5,5,5),i=new na({name:`CubemapFromEquirect`,uniforms:Ji(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Nr(r,i),s=t.minFilter;return t.minFilter===1008&&(t.minFilter=o),new Xa(1,10,this).update(e,a),t.minFilter=s,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Ko(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new Go(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Io(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Io(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function qo(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Ze(`WebGLRenderer: `+e+` extension not supported.`),t}}}function Jo(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?Xn:Yn)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Yo(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Xo(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:V(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Zo(e,t,n){let r=new WeakMap,i=new Ot;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let g=new Float32Array(p*m*4*u),_=new jt(g,p,m,u);_.type=h,_.needsUpdate=!0;let v=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*v;e===!0&&(i.fromBufferAttribute(r,t),g[d+s+0]=i.x,g[d+s+1]=i.y,g[d+s+2]=i.z,g[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),g[d+s+4]=i.x,g[d+s+5]=i.y,g[d+s+6]=i.z,g[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),g[d+s+8]=i.x,g[d+s+9]=i.y,g[d+s+10]=i.z,g[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:_,size:new H(p,m)},r.set(o,d);function y(){_.dispose(),r.delete(o),o.removeEventListener(`dispose`,y)}o.addEventListener(`dispose`,y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Qo(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var $o={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function es(e,t,n,r,i,a){let o=new At(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new lr;l.setAttribute(`position`,new Zn([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new Zn([0,2,0,0,2,0],2));let u=new ra({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new Nr(l,u),f=new Ua(-1,1,1,-1,0,1),p=null,m=null,h=!1,_,v=null,y=[],b=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<y.length;n++){let r=y[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){y=e,b=y.length>0&&y[0].isRenderPass===!0;let t=o.width,n=o.height;y.length>0&&s===null&&(s=new At(t,n,{type:g,depthBuffer:!1,stencilBuffer:!1}),c=new At(t,n,{type:g,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<y.length;e++){let r=y[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(h||e.toneMapping===0&&y.length===0)return!1;if(v=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return b===!1&&e.setRenderTarget(o),_=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return b},this.end=function(e,t){e.toneMapping=_,h=!0;let n=o,r=s;for(let i=0;i<y.length;i++){let a=y[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||m!==e.toneMapping){p=e.outputColorSpace,m=e.toneMapping,u.defines={},_t.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=$o[m];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(v),e.render(d,f),v=null,h=!1},this.isCompositing=function(){return h},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var ts=new Dt,ns=new ai(1,1),rs=new jt,is=new Mt,as=new ri,os=[],ss=[],cs=new Float32Array(16),ls=new Float32Array(9),us=new Float32Array(4);function ds(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=os[i];if(a===void 0&&(a=new Float32Array(i),os[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function fs(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function ps(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function ms(e,t){let n=ss[t];n===void 0&&(n=new Int32Array(t),ss[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function hs(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function gs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(fs(n,t))return;e.uniform2fv(this.addr,t),ps(n,t)}}function _s(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(fs(n,t))return;e.uniform3fv(this.addr,t),ps(n,t)}}function vs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(fs(n,t))return;e.uniform4fv(this.addr,t),ps(n,t)}}function ys(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(fs(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),ps(n,t)}else{if(fs(n,r))return;us.set(r),e.uniformMatrix2fv(this.addr,!1,us),ps(n,r)}}function bs(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(fs(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),ps(n,t)}else{if(fs(n,r))return;ls.set(r),e.uniformMatrix3fv(this.addr,!1,ls),ps(n,r)}}function xs(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(fs(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),ps(n,t)}else{if(fs(n,r))return;cs.set(r),e.uniformMatrix4fv(this.addr,!1,cs),ps(n,r)}}function Ss(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function Cs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(fs(n,t))return;e.uniform2iv(this.addr,t),ps(n,t)}}function ws(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(fs(n,t))return;e.uniform3iv(this.addr,t),ps(n,t)}}function Ts(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(fs(n,t))return;e.uniform4iv(this.addr,t),ps(n,t)}}function Es(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function Ds(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(fs(n,t))return;e.uniform2uiv(this.addr,t),ps(n,t)}}function Os(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(fs(n,t))return;e.uniform3uiv(this.addr,t),ps(n,t)}}function ks(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(fs(n,t))return;e.uniform4uiv(this.addr,t),ps(n,t)}}function As(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(ns.compareFunction=n.isReversedDepthBuffer()?518:515,a=ns):a=ts,n.setTexture2D(t||a,i)}function js(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||is,i)}function Ms(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||as,i)}function Ns(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||rs,i)}function Ps(e){switch(e){case 5126:return hs;case 35664:return gs;case 35665:return _s;case 35666:return vs;case 35674:return ys;case 35675:return bs;case 35676:return xs;case 5124:case 35670:return Ss;case 35667:case 35671:return Cs;case 35668:case 35672:return ws;case 35669:case 35673:return Ts;case 5125:return Es;case 36294:return Ds;case 36295:return Os;case 36296:return ks;case 35678:case 36198:case 36298:case 36306:case 35682:return As;case 35679:case 36299:case 36307:return js;case 35680:case 36300:case 36308:case 36293:return Ms;case 36289:case 36303:case 36311:case 36292:return Ns}}function Fs(e,t){e.uniform1fv(this.addr,t)}function Is(e,t){let n=ds(t,this.size,2);e.uniform2fv(this.addr,n)}function Ls(e,t){let n=ds(t,this.size,3);e.uniform3fv(this.addr,n)}function Rs(e,t){let n=ds(t,this.size,4);e.uniform4fv(this.addr,n)}function zs(e,t){let n=ds(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Bs(e,t){let n=ds(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Vs(e,t){let n=ds(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function Hs(e,t){e.uniform1iv(this.addr,t)}function Us(e,t){e.uniform2iv(this.addr,t)}function Ws(e,t){e.uniform3iv(this.addr,t)}function Gs(e,t){e.uniform4iv(this.addr,t)}function Ks(e,t){e.uniform1uiv(this.addr,t)}function qs(e,t){e.uniform2uiv(this.addr,t)}function Js(e,t){e.uniform3uiv(this.addr,t)}function Ys(e,t){e.uniform4uiv(this.addr,t)}function Xs(e,t,n){let r=this.cache,i=t.length,a=ms(n,i);fs(r,a)||(e.uniform1iv(this.addr,a),ps(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?ns:ts;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Zs(e,t,n){let r=this.cache,i=t.length,a=ms(n,i);fs(r,a)||(e.uniform1iv(this.addr,a),ps(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||is,a[e])}function Qs(e,t,n){let r=this.cache,i=t.length,a=ms(n,i);fs(r,a)||(e.uniform1iv(this.addr,a),ps(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||as,a[e])}function $s(e,t,n){let r=this.cache,i=t.length,a=ms(n,i);fs(r,a)||(e.uniform1iv(this.addr,a),ps(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||rs,a[e])}function ec(e){switch(e){case 5126:return Fs;case 35664:return Is;case 35665:return Ls;case 35666:return Rs;case 35674:return zs;case 35675:return Bs;case 35676:return Vs;case 5124:case 35670:return Hs;case 35667:case 35671:return Us;case 35668:case 35672:return Ws;case 35669:case 35673:return Gs;case 5125:return Ks;case 36294:return qs;case 36295:return Js;case 36296:return Ys;case 35678:case 36198:case 36298:case 36306:case 35682:return Xs;case 35679:case 36299:case 36307:return Zs;case 35680:case 36300:case 36308:case 36293:return Qs;case 36289:case 36303:case 36311:case 36292:return $s}}var tc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Ps(t.type)}},nc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=ec(t.type)}},rc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},ic=/(\w+)(\])?(\[|\.)?/g;function ac(e,t){e.seq.push(t),e.map[t.id]=t}function oc(e,t,n){let r=e.name,i=r.length;for(ic.lastIndex=0;;){let a=ic.exec(r),o=ic.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){ac(n,l===void 0?new tc(s,e,t):new nc(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new rc(s),ac(n,e)),n=e}}}var sc=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);oc(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function cc(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var lc=37297,uc=0;function dc(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var fc=new W;function pc(e){_t._getMatrix(fc,_t.workingColorSpace,e);let t=`mat3( ${fc.elements.map(e=>e.toFixed(4))} )`;switch(_t.getTransfer(e)){case Re:return[t,`LinearTransferOETF`];case ze:return[t,`sRGBTransferOETF`];default:return B(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function mc(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+dc(e.getShaderSource(t),r)}return i}function hc(e,t){let n=pc(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var gc={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function _c(e,t){let n=gc[t];return n===void 0?(B(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var vc=new U;function yc(){return _t.getLuminanceCoefficients(vc),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${vc.x.toFixed(4)}, ${vc.y.toFixed(4)}, ${vc.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function bc(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(Cc).join(`
`)}function xc(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function Sc(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function Cc(e){return e!==``}function wc(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Tc(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Ec=/^[ \t]*#include +<([\w\d./]+)>/gm;function Dc(e){return e.replace(Ec,kc)}var Oc=new Map;function kc(e,t){let n=q[t];if(n===void 0){let e=Oc.get(t);if(e!==void 0)n=q[e],B(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return Dc(n)}var Ac=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function jc(e){return e.replace(Ac,Mc)}function Mc(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Nc(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var Pc={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function Fc(e){return Pc[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Ic={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function Lc(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Ic[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var Rc={302:`ENVMAP_MODE_REFRACTION`};function zc(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:Rc[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var Bc={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Vc(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:Bc[e.combine]||`ENVMAP_BLENDING_NONE`}function Hc(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Uc(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=Fc(n),l=Lc(n),u=zc(n),d=Vc(n),f=Hc(n),p=bc(n),m=xc(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Cc).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Cc).join(`
`),_.length>0&&(_+=`
`)):(g=[Nc(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(Cc).join(`
`),_=[Nc(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:q.tonemapping_pars_fragment,n.toneMapping===0?``:_c(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,q.colorspace_pars_fragment,hc(`linearToOutputTexel`,n.outputColorSpace),yc(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(Cc).join(`
`)),o=Dc(o),o=wc(o,n),o=Tc(o,n),s=Dc(s),s=wc(s,n),s=Tc(s,n),o=jc(o),s=jc(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=cc(i,i.VERTEX_SHADER,y),S=cc(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=mc(i,x,`vertex`),n=mc(i,S,`fragment`);V(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):B(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new sc(i,h),T=Sc(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,lc)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=uc++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Wc=0,Gc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Kc(e),t.set(e,n)),n}},Kc=class{constructor(e){this.id=Wc++,this.code=e,this.usedTimes=0}};function qc(e){return e===1030||e===37490||e===36285}function Jc(e,t,n,r,i,a){let o=new Ut,s=new Gc,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&B(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=ho[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let ee=e.getRenderTarget(),j=e.state.buffers.depth.getReversed(),M=h.isInstancedMesh===!0,N=h.isBatchedMesh===!0,te=!!i.map,P=!!i.matcap,F=!!x,ne=!!i.aoMap,re=!!i.lightMap,ie=!!i.bumpMap&&i.wireframe===!1,ae=!!i.normalMap,oe=!!i.displacementMap,se=!!i.emissiveMap,I=!!i.metalnessMap,ce=!!i.roughnessMap,le=i.anisotropy>0,ue=i.clearcoat>0,de=i.dispersion>0,fe=i.retroreflectivity>0,pe=i.iridescence>0,me=i.sheen>0,he=i.transmission>0,ge=le&&!!i.anisotropyMap,_e=ue&&!!i.clearcoatMap,ve=ue&&!!i.clearcoatNormalMap,ye=ue&&!!i.clearcoatRoughnessMap,be=pe&&!!i.iridescenceMap,xe=pe&&!!i.iridescenceThicknessMap,Se=me&&!!i.sheenColorMap,Ce=me&&!!i.sheenRoughnessMap,we=!!i.specularMap,Te=!!i.specularColorMap,Ee=!!i.specularIntensityMap,De=he&&!!i.transmissionMap,Oe=he&&!!i.thicknessMap,ke=!!i.gradientMap,Ae=!!i.alphaMap,je=i.alphaTest>0,L=!!i.alphaHash,Me=!!i.extensions,Ne=0;i.toneMapped&&(ee===null||ee.isXRRenderTarget===!0)&&(Ne=e.toneMapping);let Pe={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:N,batchingColor:N&&h._colorsTexture!==null,instancing:M,instancingColor:M&&h.instanceColor!==null,instancingMorph:M&&h.morphTexture!==null,outputColorSpace:ee===null?e.outputColorSpace:ee.isXRRenderTarget===!0?ee.texture.colorSpace:_t.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:te,matcap:P,envMap:F,envMapMode:F&&x.mapping,envMapCubeUVHeight:S,aoMap:ne,lightMap:re,bumpMap:ie,normalMap:ae,displacementMap:oe,emissiveMap:se,normalMapObjectSpace:ae&&i.normalMapType===1,normalMapTangentSpace:ae&&i.normalMapType===0,packedNormalMap:ae&&i.normalMapType===0&&qc(i.normalMap.format),metalnessMap:I,roughnessMap:ce,anisotropy:le,anisotropyMap:ge,clearcoat:ue,clearcoatMap:_e,clearcoatNormalMap:ve,clearcoatRoughnessMap:ye,dispersion:de,retroreflection:fe,iridescence:pe,iridescenceMap:be,iridescenceThicknessMap:xe,sheen:me,sheenColorMap:Se,sheenRoughnessMap:Ce,specularMap:we,specularColorMap:Te,specularIntensityMap:Ee,transmission:he,transmissionMap:De,thicknessMap:Oe,gradientMap:ke,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Ae,alphaTest:je,alphaHash:L,combine:i.combine,mapUv:te&&m(i.map.channel),aoMapUv:ne&&m(i.aoMap.channel),lightMapUv:re&&m(i.lightMap.channel),bumpMapUv:ie&&m(i.bumpMap.channel),normalMapUv:ae&&m(i.normalMap.channel),displacementMapUv:oe&&m(i.displacementMap.channel),emissiveMapUv:se&&m(i.emissiveMap.channel),metalnessMapUv:I&&m(i.metalnessMap.channel),roughnessMapUv:ce&&m(i.roughnessMap.channel),anisotropyMapUv:ge&&m(i.anisotropyMap.channel),clearcoatMapUv:_e&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:ve&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ye&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:be&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:xe&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:Se&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:Ce&&m(i.sheenRoughnessMap.channel),specularMapUv:we&&m(i.specularMap.channel),specularColorMapUv:Te&&m(i.specularColorMap.channel),specularIntensityMapUv:Ee&&m(i.specularIntensityMap.channel),transmissionMapUv:De&&m(i.transmissionMap.channel),thicknessMapUv:Oe&&m(i.thicknessMap.channel),alphaMapUv:Ae&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(ae||le),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(te||Ae),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&ae===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:j,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:Ne,decodeVideoTexture:te&&i.map.isVideoTexture===!0&&_t.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:se&&i.emissiveMap.isVideoTexture===!0&&_t.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:Me&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(Me&&i.extensions.multiDraw===!0||N)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Pe.vertexUv1s=c.has(1),Pe.vertexUv2s=c.has(2),Pe.vertexUv3s=c.has(3),c.clear(),Pe}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=ho[t];n=$i.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new Uc(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function Yc(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function Xc(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Zc(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Qc(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||Xc),r.length>1&&r.sort(t||Zc),i.length>1&&i.sort(t||Zc)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function $c(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Qc,e.set(t,[i])):n>=r.length?(i=new Qc,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function el(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new U,color:new K};break;case`SpotLight`:n={position:new U,direction:new U,color:new K,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new U,color:new K,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new U,skyColor:new K,groundColor:new K};break;case`RectAreaLight`:n={color:new K,position:new U,halfWidth:new U,halfHeight:new U}}return e[t.id]=n,n}}}function tl(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var nl=0;function rl(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function il(e){let t=new el,n=tl(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new U);let i=new U,a=new G,o=new G;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(rl);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=J.LTC_FLOAT_1,r.rectAreaLTC2=J.LTC_FLOAT_2):(r.rectAreaLTC1=J.LTC_HALF_1,r.rectAreaLTC2=J.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=nl++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function al(e){let t=new il(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function ol(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new al(e),t.set(n,[a])):r>=i.length?(a=new al(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var sl=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,cl=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,ll=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],ul=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],dl=new G,fl=new U,pl=new U;function ml(e,t,n){let i=new Yr,a=new H,s=new H,c=new Ot,l=new oa,u=new sa,d={},f=n.maxTextureSize,p={0:1,1:0,2:2},_=new na({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new H},radius:{value:4}},vertexShader:sl,fragmentShader:cl}),v=_.clone();v.defines.HORIZONTAL_PASS=1;let y=new lr;y.setAttribute(`position`,new Jn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new Nr(y,_),x=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let S=this.type;this.render=function(t,n,l){if(x.enabled===!1||x.autoUpdate===!1&&x.needsUpdate===!1||t.length===0)return;this.type===2&&(B(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),_=e.state;_.setBlending(0),_.buffers.depth.getReversed()===!0?_.buffers.color.setClear(0,0,0,0):_.buffers.color.setClear(1,1,1,1),_.buffers.depth.setTest(!0),_.setScissorTest(!1);let v=S!==this.type;v&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let u=0,d=t.length;u<d;u++){let d=t[u],p=d.shadow;if(p===void 0){B(`WebGLShadowMap:`,d,`has no shadow.`);continue}if(p.autoUpdate===!1&&p.needsUpdate===!1)continue;a.copy(p.mapSize);let y=p.getFrameExtents();a.multiply(y),s.copy(p.mapSize),(a.x>f||a.y>f)&&(a.x>f&&(s.x=Math.floor(f/y.x),a.x=s.x*y.x,p.mapSize.x=s.x),a.y>f&&(s.y=Math.floor(f/y.y),a.y=s.y*y.y,p.mapSize.y=s.y));let b=e.state.buffers.depth.getReversed();if(p.camera._reversedDepth=b,p.map===null||v===!0){if(p.map!==null&&(p.map.depthTexture!==null&&(p.map.depthTexture.dispose(),p.map.depthTexture=null),p.map.dispose()),this.type===3){if(d.isPointLight){B(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}p.map=new At(a.x,a.y,{format:k,type:g,minFilter:o,magFilter:o,generateMipmaps:!1}),p.map.texture.name=d.name+`.shadowMap`,p.map.depthTexture=new ai(a.x,a.y,h),p.map.depthTexture.name=d.name+`.shadowMapDepth`,p.map.depthTexture.format=T,p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=r,p.map.depthTexture.magFilter=r}else d.isPointLight?(p.map=new Go(a.x),p.map.depthTexture=new oi(a.x,m)):(p.map=new At(a.x,a.y),p.map.depthTexture=new ai(a.x,a.y,m)),p.map.depthTexture.name=d.name+`.shadowMap`,p.map.depthTexture.format=T,this.type===1?(p.map.depthTexture.compareFunction=b?518:515,p.map.depthTexture.minFilter=o,p.map.depthTexture.magFilter=o):(p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=r,p.map.depthTexture.magFilter=r);p.camera.updateProjectionMatrix()}p.map.isWebGLCubeRenderTarget!==!0&&(p.map.width!==a.x||p.map.height!==a.y)&&p.map.setSize(a.x,a.y);let x=p.map.isWebGLCubeRenderTarget?6:p.getViewportCount();d.isPointLight!==!0&&p.updateMatrices(d,l);for(let t=0;t<x;t++){let r=p.getCamera(t);if(d.isPointLight){let e=p.camera,n=p.matrix,r=d.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),fl.setFromMatrixPosition(d.matrixWorld),e.position.copy(fl),pl.copy(e.position),pl.add(ll[t]),e.up.copy(ul[t]),e.lookAt(pl),e.updateMatrixWorld(),n.makeTranslation(-fl.x,-fl.y,-fl.z),dl.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),p._frustum.setFromProjectionMatrix(dl,e.coordinateSystem,e.reversedDepth)}if(p.map.isWebGLCubeRenderTarget)e.setRenderTarget(p.map,t),e.clear();else{t===0&&(e.setRenderTarget(p.map),e.clear());let n=p.getViewport(t);c.set(s.x*n.x,s.y*n.y,s.x*n.z,s.y*n.w),_.viewport(c)}i=p.getFrustum(t),E(n,l,r,d,this.type)}p.isPointLightShadow!==!0&&this.type===3&&C(p,l),p.needsUpdate=!1}S=this.type,x.needsUpdate=!1,e.setRenderTarget(u,d,p)};function C(n,r){let i=t.update(b);_.defines.VSM_SAMPLES!==n.blurSamples&&(_.defines.VSM_SAMPLES=n.blurSamples,v.defines.VSM_SAMPLES=n.blurSamples,_.needsUpdate=!0,v.needsUpdate=!0),n.mapPass===null?n.mapPass=new At(a.x,a.y,{format:k,type:g}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),_.uniforms.shadow_pass.value=n.map.depthTexture,_.uniforms.resolution.value.set(n.map.width,n.map.height),_.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,i,_,b,null),v.uniforms.shadow_pass.value=n.mapPass.texture,v.uniforms.resolution.value.set(n.map.width,n.map.height),v.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,i,v,b,null)}function w(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?u:l,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=d[e];r===void 0&&(r={},d[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,D)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?p[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function E(n,r,a,o,s){if(n.visible===!1)return;if(n.layers.test(r.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||n.intersectsFrustum(i))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let i=t.update(n),c=n.material;if(Array.isArray(c)){let t=i.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=w(n,d,o,s);n.onBeforeShadow(e,n,r,a,i,t,u),e.renderBufferDirect(a,null,i,t,n,u),n.onAfterShadow(e,n,r,a,i,t,u)}}}else if(c.visible){let t=w(n,c,o,s);n.onBeforeShadow(e,n,r,a,i,t,null),e.renderBufferDirect(a,null,i,t,n,null),n.onAfterShadow(e,n,r,a,i,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)E(c[e],r,a,o,s)}function D(e){e.target.removeEventListener(`dispose`,D);for(let t in d){let n=d[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function hl(e,t){function n(){let t=!1,n=new Ot,r=null,i=new Ot(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?I(e.DEPTH_TEST):ce(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=$e[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?I(e.STENCIL_TEST):ce(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new K(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,ee=null,j=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),M=!1,N=0,te=e.getParameter(e.VERSION);te.indexOf(`WebGL`)===-1?te.indexOf(`OpenGL ES`)!==-1&&(N=parseFloat(/^OpenGL ES (\d)/.exec(te)[1]),M=N>=2):(N=parseFloat(/^WebGL (\d)/.exec(te)[1]),M=N>=1);let P=null,F={},ne=e.getParameter(e.SCISSOR_BOX),re=e.getParameter(e.VIEWPORT),ie=new Ot().fromArray(ne),ae=new Ot().fromArray(re);function oe(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let se={};se[e.TEXTURE_2D]=oe(e.TEXTURE_2D,e.TEXTURE_2D,1),se[e.TEXTURE_CUBE_MAP]=oe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[e.TEXTURE_2D_ARRAY]=oe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),se[e.TEXTURE_3D]=oe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),I(e.DEPTH_TEST),o.setFunc(3),ge(!1),_e(1),I(e.CULL_FACE),me(0);function I(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function ce(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function le(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function ue(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function de(t){return h!==t&&(e.useProgram(t),h=t,!0)}let fe={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};fe[103]=e.MIN,fe[104]=e.MAX;let pe={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function me(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(ce(e.BLEND),g=!1);return}if(g===!1&&(I(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:V(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:V(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:V(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:V(`WebGLState: Invalid blending: `,t)}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(fe[n],fe[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(pe[r],pe[i],pe[o],pe[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function he(t,n){t.side===2?ce(e.CULL_FACE):I(e.CULL_FACE);let r=t.side===1;n&&(r=!r),ge(r),t.blending===1&&t.transparent===!1?me(0):me(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ye(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?I(e.SAMPLE_ALPHA_TO_COVERAGE):ce(e.SAMPLE_ALPHA_TO_COVERAGE)}function ge(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function _e(t){t===0?ce(e.CULL_FACE):(I(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function ve(t){t!==k&&(M&&e.lineWidth(t),k=t)}function ye(t,n,r){t?(I(e.POLYGON_OFFSET_FILL),(A!==n||ee!==r)&&(A=n,ee=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):ce(e.POLYGON_OFFSET_FILL)}function be(t){t?I(e.SCISSOR_TEST):ce(e.SCISSOR_TEST)}function xe(t){t===void 0&&(t=e.TEXTURE0+j-1),P!==t&&(e.activeTexture(t),P=t)}function Se(t,n,r){r===void 0&&(r=P===null?e.TEXTURE0+j-1:P);let i=F[r];i===void 0&&(i={type:void 0,texture:void 0},F[r]=i),(i.type!==t||i.texture!==n)&&(P!==r&&(e.activeTexture(r),P=r),e.bindTexture(t,n||se[t]),i.type=t,i.texture=n)}function Ce(){let t=F[P];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function we(){try{e.compressedTexImage2D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Te(){try{e.compressedTexImage3D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Ee(){try{e.texSubImage2D(...arguments)}catch(e){V(`WebGLState:`,e)}}function De(){try{e.texSubImage3D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Oe(){try{e.compressedTexSubImage2D(...arguments)}catch(e){V(`WebGLState:`,e)}}function ke(){try{e.compressedTexSubImage3D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Ae(){try{e.texStorage2D(...arguments)}catch(e){V(`WebGLState:`,e)}}function je(){try{e.texStorage3D(...arguments)}catch(e){V(`WebGLState:`,e)}}function L(){try{e.texImage2D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Me(){try{e.texImage3D(...arguments)}catch(e){V(`WebGLState:`,e)}}function Ne(t){return d[t]===void 0?e.getParameter(t):d[t]}function Pe(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function R(t){ie.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ie.copy(t))}function Fe(t){ae.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),ae.copy(t))}function z(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Ie(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Le(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},P=null,F={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new K(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,ee=null,ie.set(0,0,e.canvas.width,e.canvas.height),ae.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:I,disable:ce,bindFramebuffer:le,drawBuffers:ue,useProgram:de,setBlending:me,setMaterial:he,setFlipSided:ge,setCullFace:_e,setLineWidth:ve,setPolygonOffset:ye,setScissorTest:be,activeTexture:xe,bindTexture:Se,unbindTexture:Ce,compressedTexImage2D:we,compressedTexImage3D:Te,texImage2D:L,texImage3D:Me,pixelStorei:Pe,getParameter:Ne,updateUBOMapping:z,uniformBlockBinding:Ie,texStorage2D:Ae,texStorage3D:je,texSubImage2D:Ee,texSubImage3D:De,compressedTexSubImage2D:Oe,compressedTexSubImage3D:ke,scissor:R,viewport:Fe,reset:Le}}function gl(l,u,d,f,p,m,h){let g=u.has(`WEBGL_multisampled_render_to_texture`)?u.get(`WEBGL_multisampled_render_to_texture`):null,_=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),v=new H,y=new WeakMap,b=new Set,x,S=new WeakMap,C=!1;try{C=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function w(e,t){return C?new OffscreenCanvas(e,t):Ke(`canvas`)}function T(e,t,n){let r=1,i=Ne(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);x===void 0&&(x=w(n,a));let o=t?w(n,a):x;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),B(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&B(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function D(e){return e.generateMipmaps}function O(e){l.generateMipmap(e)}function k(e){return e.isWebGLCubeRenderTarget?l.TEXTURE_CUBE_MAP:e.isWebGL3DRenderTarget?l.TEXTURE_3D:e.isWebGLArrayRenderTarget||e.isCompressedArrayTexture?l.TEXTURE_2D_ARRAY:l.TEXTURE_2D}function A(e,t,n,r,i,a=!1){if(e!==null){if(l[e]!==void 0)return l[e];B(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+e+`'`)}let o;r&&(o=u.get(`EXT_texture_norm16`),o||B(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let s=t;if(t===l.RED&&(n===l.FLOAT&&(s=l.R32F),n===l.HALF_FLOAT&&(s=l.R16F),n===l.UNSIGNED_BYTE&&(s=l.R8),n===l.UNSIGNED_SHORT&&o&&(s=o.R16_EXT),n===l.SHORT&&o&&(s=o.R16_SNORM_EXT)),t===l.RED_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.R8UI),n===l.UNSIGNED_SHORT&&(s=l.R16UI),n===l.UNSIGNED_INT&&(s=l.R32UI),n===l.BYTE&&(s=l.R8I),n===l.SHORT&&(s=l.R16I),n===l.INT&&(s=l.R32I)),t===l.RG&&(n===l.FLOAT&&(s=l.RG32F),n===l.HALF_FLOAT&&(s=l.RG16F),n===l.UNSIGNED_BYTE&&(s=l.RG8),n===l.UNSIGNED_SHORT&&o&&(s=o.RG16_EXT),n===l.SHORT&&o&&(s=o.RG16_SNORM_EXT)),t===l.RG_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RG8UI),n===l.UNSIGNED_SHORT&&(s=l.RG16UI),n===l.UNSIGNED_INT&&(s=l.RG32UI),n===l.BYTE&&(s=l.RG8I),n===l.SHORT&&(s=l.RG16I),n===l.INT&&(s=l.RG32I)),t===l.RGB_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RGB8UI),n===l.UNSIGNED_SHORT&&(s=l.RGB16UI),n===l.UNSIGNED_INT&&(s=l.RGB32UI),n===l.BYTE&&(s=l.RGB8I),n===l.SHORT&&(s=l.RGB16I),n===l.INT&&(s=l.RGB32I)),t===l.RGBA_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RGBA8UI),n===l.UNSIGNED_SHORT&&(s=l.RGBA16UI),n===l.UNSIGNED_INT&&(s=l.RGBA32UI),n===l.BYTE&&(s=l.RGBA8I),n===l.SHORT&&(s=l.RGBA16I),n===l.INT&&(s=l.RGBA32I)),t===l.RGB&&(n===l.UNSIGNED_SHORT&&o&&(s=o.RGB16_EXT),n===l.SHORT&&o&&(s=o.RGB16_SNORM_EXT),n===l.UNSIGNED_INT_5_9_9_9_REV&&(s=l.RGB9_E5),n===l.UNSIGNED_INT_10F_11F_11F_REV&&(s=l.R11F_G11F_B10F)),t===l.RGBA){let e=a?Re:_t.getTransfer(i);n===l.FLOAT&&(s=l.RGBA32F),n===l.HALF_FLOAT&&(s=l.RGBA16F),n===l.UNSIGNED_BYTE&&(s=e===`srgb`?l.SRGB8_ALPHA8:l.RGBA8),n===l.UNSIGNED_SHORT&&o&&(s=o.RGBA16_EXT),n===l.SHORT&&o&&(s=o.RGBA16_SNORM_EXT),n===l.UNSIGNED_SHORT_4_4_4_4&&(s=l.RGBA4),n===l.UNSIGNED_SHORT_5_5_5_1&&(s=l.RGB5_A1)}return(s===l.R16F||s===l.R32F||s===l.RG16F||s===l.RG32F||s===l.RGBA16F||s===l.RGBA32F)&&u.get(`EXT_color_buffer_float`),s}function ee(e,t){let n;return e?t===null||t===1014||t===1020?n=l.DEPTH24_STENCIL8:t===1015?n=l.DEPTH32F_STENCIL8:t===1012&&(n=l.DEPTH24_STENCIL8,B(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):t===null||t===1014||t===1020?n=l.DEPTH_COMPONENT24:t===1015?n=l.DEPTH_COMPONENT32F:t===1012&&(n=l.DEPTH_COMPONENT16),n}function j(e,t){return D(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function M(e){let t=e.target;t.removeEventListener(`dispose`,M),te(t),t.isVideoTexture&&y.delete(t),t.isHTMLTexture&&b.delete(t)}function N(e){let t=e.target;t.removeEventListener(`dispose`,N),F(t)}function te(e){let t=f.get(e);if(t.__webglInit===void 0)return;let n=e.source,r=S.get(n);if(r){let i=r[t.__cacheKey];i.usedTimes--,i.usedTimes===0&&P(e),Object.keys(r).length===0&&S.delete(n)}f.remove(e)}function P(e){let t=f.get(e);l.deleteTexture(t.__webglTexture);let n=e.source,r=S.get(n);delete r[t.__cacheKey],h.memory.textures--}function F(e){let t=f.get(e);if(e.depthTexture&&(e.depthTexture.dispose(),f.remove(e.depthTexture)),e.isWebGLCubeRenderTarget)for(let e=0;e<6;e++){if(Array.isArray(t.__webglFramebuffer[e]))for(let n=0;n<t.__webglFramebuffer[e].length;n++)l.deleteFramebuffer(t.__webglFramebuffer[e][n]);else l.deleteFramebuffer(t.__webglFramebuffer[e]);t.__webglDepthbuffer&&l.deleteRenderbuffer(t.__webglDepthbuffer[e])}else{if(Array.isArray(t.__webglFramebuffer))for(let e=0;e<t.__webglFramebuffer.length;e++)l.deleteFramebuffer(t.__webglFramebuffer[e]);else l.deleteFramebuffer(t.__webglFramebuffer);if(t.__webglDepthbuffer&&l.deleteRenderbuffer(t.__webglDepthbuffer),t.__webglMultisampledFramebuffer&&l.deleteFramebuffer(t.__webglMultisampledFramebuffer),t.__webglColorRenderbuffer)for(let e=0;e<t.__webglColorRenderbuffer.length;e++)t.__webglColorRenderbuffer[e]&&l.deleteRenderbuffer(t.__webglColorRenderbuffer[e]);t.__webglDepthRenderbuffer&&l.deleteRenderbuffer(t.__webglDepthRenderbuffer)}let n=e.textures;for(let e=0,t=n.length;e<t;e++){let t=f.get(n[e]);t.__webglTexture&&(l.deleteTexture(t.__webglTexture),h.memory.textures--),f.remove(n[e])}f.remove(e)}let ne=0;function re(){ne=0}function ie(){return ne}function ae(e){ne=e}function oe(){let e=ne;return e>=p.maxTextures&&B(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+p.maxTextures),ne+=1,e}function se(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function I(e,t){let n=f.get(e);if(e.isVideoTexture&&L(e),e.isRenderTargetTexture===!1&&e.isExternalTexture!==!0&&e.version>0&&n.__version!==e.version){let r=e.image;if(r===null)B(`WebGLRenderer: Texture marked for update but no image data found.`);else if(r.complete===!1)B(`WebGLRenderer: Texture marked for update but image is incomplete`);else{ve(n,e,t);return}}else e.isExternalTexture&&(n.__webglTexture=e.sourceTexture?e.sourceTexture:null);d.bindTexture(l.TEXTURE_2D,n.__webglTexture,l.TEXTURE0+t)}function ce(e,t){let n=f.get(e);if(e.isRenderTargetTexture===!1&&e.version>0&&n.__version!==e.version){ve(n,e,t);return}e.isExternalTexture&&(n.__webglTexture=e.sourceTexture?e.sourceTexture:null),d.bindTexture(l.TEXTURE_2D_ARRAY,n.__webglTexture,l.TEXTURE0+t)}function le(e,t){let n=f.get(e);if(e.isRenderTargetTexture===!1&&e.version>0&&n.__version!==e.version){ve(n,e,t);return}d.bindTexture(l.TEXTURE_3D,n.__webglTexture,l.TEXTURE0+t)}function ue(e,t){let n=f.get(e);if(e.isCubeDepthTexture!==!0&&e.version>0&&n.__version!==e.version){ye(n,e,t);return}d.bindTexture(l.TEXTURE_CUBE_MAP,n.__webglTexture,l.TEXTURE0+t)}let de={[e]:l.REPEAT,[t]:l.CLAMP_TO_EDGE,[n]:l.MIRRORED_REPEAT},fe={[r]:l.NEAREST,[i]:l.NEAREST_MIPMAP_NEAREST,[a]:l.NEAREST_MIPMAP_LINEAR,[o]:l.LINEAR,[s]:l.LINEAR_MIPMAP_NEAREST,[c]:l.LINEAR_MIPMAP_LINEAR},pe={512:l.NEVER,519:l.ALWAYS,513:l.LESS,515:l.LEQUAL,514:l.EQUAL,518:l.GEQUAL,516:l.GREATER,517:l.NOTEQUAL};function me(e,t){if(t.type===1015&&u.has(`OES_texture_float_linear`)===!1&&(t.magFilter===1006||t.magFilter===1007||t.magFilter===1005||t.magFilter===1008||t.minFilter===1006||t.minFilter===1007||t.minFilter===1005||t.minFilter===1008)&&B(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),l.texParameteri(e,l.TEXTURE_WRAP_S,de[t.wrapS]),l.texParameteri(e,l.TEXTURE_WRAP_T,de[t.wrapT]),(e===l.TEXTURE_3D||e===l.TEXTURE_2D_ARRAY)&&l.texParameteri(e,l.TEXTURE_WRAP_R,de[t.wrapR]),l.texParameteri(e,l.TEXTURE_MAG_FILTER,fe[t.magFilter]),l.texParameteri(e,l.TEXTURE_MIN_FILTER,fe[t.minFilter]),t.compareFunction&&(l.texParameteri(e,l.TEXTURE_COMPARE_MODE,l.COMPARE_REF_TO_TEXTURE),l.texParameteri(e,l.TEXTURE_COMPARE_FUNC,pe[t.compareFunction])),u.has(`EXT_texture_filter_anisotropic`)===!0){if(t.magFilter===1003||t.minFilter!==1005&&t.minFilter!==1008||t.type===1015&&u.has(`OES_texture_float_linear`)===!1)return;if(t.anisotropy>1||f.get(t).__currentAnisotropy){let n=u.get(`EXT_texture_filter_anisotropic`);l.texParameterf(e,n.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(t.anisotropy,p.getMaxAnisotropy())),f.get(t).__currentAnisotropy=t.anisotropy}}}function he(e,t){let n=!1;e.__webglInit===void 0&&(e.__webglInit=!0,t.addEventListener(`dispose`,M));let r=t.source,i=S.get(r);i===void 0&&(i={},S.set(r,i));let a=se(t);if(a!==e.__cacheKey){i[a]===void 0&&(i[a]={texture:l.createTexture(),usedTimes:0},h.memory.textures++,n=!0),i[a].usedTimes++;let r=i[e.__cacheKey];r!==void 0&&(i[e.__cacheKey].usedTimes--,r.usedTimes===0&&P(t)),e.__cacheKey=a,e.__webglTexture=i[a].texture}return n}function ge(e,t,n){return Math.floor(Math.floor(e/n)/t)}function _e(e,t,n,r){let i=e.updateRanges;if(i.length===0)d.texSubImage2D(l.TEXTURE_2D,0,0,0,t.width,t.height,n,r,t.data);else{i.sort((e,t)=>e.start-t.start);let a=0;for(let e=1;e<i.length;e++){let n=i[a],r=i[e],o=n.start+n.count,s=ge(r.start,t.width,4),c=ge(n.start,t.width,4);r.start<=o+1&&s===c&&ge(r.start+r.count-1,t.width,4)===s?n.count=Math.max(n.count,r.start+r.count-n.start):(++a,i[a]=r)}i.length=a+1;let o=d.getParameter(l.UNPACK_ROW_LENGTH),s=d.getParameter(l.UNPACK_SKIP_PIXELS),c=d.getParameter(l.UNPACK_SKIP_ROWS);d.pixelStorei(l.UNPACK_ROW_LENGTH,t.width);for(let e=0,a=i.length;e<a;e++){let a=i[e],o=Math.floor(a.start/4),s=Math.ceil(a.count/4),c=o%t.width,u=Math.floor(o/t.width),f=s;d.pixelStorei(l.UNPACK_SKIP_PIXELS,c),d.pixelStorei(l.UNPACK_SKIP_ROWS,u),d.texSubImage2D(l.TEXTURE_2D,0,c,u,f,1,n,r,t.data)}e.clearUpdateRanges(),d.pixelStorei(l.UNPACK_ROW_LENGTH,o),d.pixelStorei(l.UNPACK_SKIP_PIXELS,s),d.pixelStorei(l.UNPACK_SKIP_ROWS,c)}}function ve(e,t,n){let r=l.TEXTURE_2D;(t.isDataArrayTexture||t.isCompressedArrayTexture)&&(r=l.TEXTURE_2D_ARRAY),t.isData3DTexture&&(r=l.TEXTURE_3D);let i=he(e,t),a=t.source;d.bindTexture(r,e.__webglTexture,l.TEXTURE0+n);let o=f.get(a);if(a.version!==o.__version||i===!0){if(d.activeTexture(l.TEXTURE0+n),!(typeof ImageBitmap<`u`&&t.image instanceof ImageBitmap)){let e=_t.getPrimaries(_t.workingColorSpace),n=t.colorSpace===``?null:_t.getPrimaries(t.colorSpace),r=t.colorSpace===``||e===n?l.NONE:l.BROWSER_DEFAULT_WEBGL;d.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,t.flipY),d.pixelStorei(l.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),d.pixelStorei(l.UNPACK_COLORSPACE_CONVERSION_WEBGL,r)}d.pixelStorei(l.UNPACK_ALIGNMENT,t.unpackAlignment);let e=T(t.image,!1,p.maxTextureSize);e=Me(t,e);let s=m.convert(t.format,t.colorSpace),c=m.convert(t.type),u=A(t.internalFormat,s,c,t.normalized,t.colorSpace,t.isVideoTexture);me(r,t);let f,h=t.mipmaps,g=t.isVideoTexture!==!0,_=o.__version===void 0||i===!0,v=a.dataReady,y=j(t,e);if(t.isDepthTexture)u=ee(t.format===E,t.type),_&&(g?d.texStorage2D(l.TEXTURE_2D,1,u,e.width,e.height):d.texImage2D(l.TEXTURE_2D,0,u,e.width,e.height,0,s,c,null));else if(t.isDataTexture){if(h.length>0){g&&_&&d.texStorage2D(l.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let e=0,t=h.length;e<t;e++)f=h[e],g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,c,f.data):d.texImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,s,c,f.data);t.generateMipmaps=!1}else g?(_&&d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height),v&&_e(t,e,s,c)):d.texImage2D(l.TEXTURE_2D,0,u,e.width,e.height,0,s,c,e.data)}else if(t.isCompressedTexture){if(t.isCompressedArrayTexture){g&&_&&d.texStorage3D(l.TEXTURE_2D_ARRAY,y,u,h[0].width,h[0].height,e.depth);for(let n=0,r=h.length;n<r;n++)if(f=h[n],t.format!==1023){if(s!==null){if(g){if(v){if(t.layerUpdates.size>0){let e=uo(f.width,f.height,t.format,t.type);for(let r of t.layerUpdates){let t=f.data.subarray(r*e/f.data.BYTES_PER_ELEMENT,(r+1)*e/f.data.BYTES_PER_ELEMENT);d.compressedTexSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,r,f.width,f.height,1,s,t)}}else d.compressedTexSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,0,f.width,f.height,e.depth,s,f.data)}}else d.compressedTexImage3D(l.TEXTURE_2D_ARRAY,n,u,f.width,f.height,e.depth,0,f.data,0,0)}else B(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else g?v&&d.texSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,0,f.width,f.height,e.depth,s,c,f.data):d.texImage3D(l.TEXTURE_2D_ARRAY,n,u,f.width,f.height,e.depth,0,s,c,f.data);t.layerUpdates.size>0&&t.clearLayerUpdates()}else{g&&_&&d.texStorage2D(l.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let e=0,n=h.length;e<n;e++)f=h[e],t.format===1023?g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,c,f.data):d.texImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,s,c,f.data):s===null?B(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):g?v&&d.compressedTexSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,f.data):d.compressedTexImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,f.data)}}else if(t.isDataArrayTexture){if(g){if(_&&d.texStorage3D(l.TEXTURE_2D_ARRAY,y,u,e.width,e.height,e.depth),v){if(t.layerUpdates.size>0){let n=uo(e.width,e.height,t.format,t.type);for(let r of t.layerUpdates){let t=e.data.subarray(r*n/e.data.BYTES_PER_ELEMENT,(r+1)*n/e.data.BYTES_PER_ELEMENT);d.texSubImage3D(l.TEXTURE_2D_ARRAY,0,0,0,r,e.width,e.height,1,s,c,t)}t.clearLayerUpdates()}else d.texSubImage3D(l.TEXTURE_2D_ARRAY,0,0,0,0,e.width,e.height,e.depth,s,c,e.data)}}else d.texImage3D(l.TEXTURE_2D_ARRAY,0,u,e.width,e.height,e.depth,0,s,c,e.data)}else if(t.isData3DTexture)g?(_&&d.texStorage3D(l.TEXTURE_3D,y,u,e.width,e.height,e.depth),v&&d.texSubImage3D(l.TEXTURE_3D,0,0,0,0,e.width,e.height,e.depth,s,c,e.data)):d.texImage3D(l.TEXTURE_3D,0,u,e.width,e.height,e.depth,0,s,c,e.data);else if(t.isFramebufferTexture){if(_){if(g)d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height);else{let t=e.width,n=e.height;for(let e=0;e<y;e++)d.texImage2D(l.TEXTURE_2D,e,u,t,n,0,s,c,null),t>>=1,n>>=1}}}else if(t.isHTMLTexture){if(`texElementImage2D`in l){let n=l.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),e.parentNode!==n){n.appendChild(e),b.add(t),n.onpaint=e=>{let t=e.changedElements;for(let e of b)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(l.texElementImage2D.length===3)l.texElementImage2D(l.TEXTURE_2D,l.RGBA8,e);else{let t=l.RGBA,n=l.RGBA,r=l.UNSIGNED_BYTE;l.texElementImage2D(l.TEXTURE_2D,0,t,n,r,e)}l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MIN_FILTER,l.LINEAR),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_S,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_T,l.CLAMP_TO_EDGE)}}else if(h.length>0){if(g&&_){let e=Ne(h[0]);d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height)}for(let e=0,t=h.length;e<t;e++)f=h[e],g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,s,c,f):d.texImage2D(l.TEXTURE_2D,e,u,s,c,f);t.generateMipmaps=!1}else if(g){if(_){let t=Ne(e);d.texStorage2D(l.TEXTURE_2D,y,u,t.width,t.height)}v&&d.texSubImage2D(l.TEXTURE_2D,0,0,0,s,c,e)}else d.texImage2D(l.TEXTURE_2D,0,u,s,c,e);D(t)&&O(r),o.__version=a.version,t.onUpdate&&t.onUpdate(t)}e.__version=t.version}function ye(e,t,n){if(t.image.length!==6)return;let r=he(e,t),i=t.source;d.bindTexture(l.TEXTURE_CUBE_MAP,e.__webglTexture,l.TEXTURE0+n);let a=f.get(i);if(i.version!==a.__version||r===!0){d.activeTexture(l.TEXTURE0+n);let e=_t.getPrimaries(_t.workingColorSpace),o=t.colorSpace===``?null:_t.getPrimaries(t.colorSpace),s=t.colorSpace===``||e===o?l.NONE:l.BROWSER_DEFAULT_WEBGL;d.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,t.flipY),d.pixelStorei(l.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),d.pixelStorei(l.UNPACK_ALIGNMENT,t.unpackAlignment),d.pixelStorei(l.UNPACK_COLORSPACE_CONVERSION_WEBGL,s);let c=t.isCompressedTexture||t.image[0].isCompressedTexture,u=t.image[0]&&t.image[0].isDataTexture,f=[];for(let e=0;e<6;e++)!c&&!u?f[e]=T(t.image[e],!0,p.maxCubemapSize):f[e]=u?t.image[e].image:t.image[e],f[e]=Me(t,f[e]);let h=f[0],g=m.convert(t.format,t.colorSpace),_=m.convert(t.type),v=A(t.internalFormat,g,_,t.normalized,t.colorSpace),y=t.isVideoTexture!==!0,b=a.__version===void 0||r===!0,x=i.dataReady,S=j(t,h);me(l.TEXTURE_CUBE_MAP,t);let C;if(c){y&&b&&d.texStorage2D(l.TEXTURE_CUBE_MAP,S,v,h.width,h.height);for(let e=0;e<6;e++){C=f[e].mipmaps;for(let n=0;n<C.length;n++){let r=C[n];t.format===1023?y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,0,0,r.width,r.height,g,_,r.data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,v,r.width,r.height,0,g,_,r.data):g===null?B(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):y?x&&d.compressedTexSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,0,0,r.width,r.height,g,r.data):d.compressedTexImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,v,r.width,r.height,0,r.data)}}}else{if(C=t.mipmaps,y&&b){C.length>0&&S++;let e=Ne(f[0]);d.texStorage2D(l.TEXTURE_CUBE_MAP,S,v,e.width,e.height)}for(let e=0;e<6;e++)if(u){y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,0,0,f[e].width,f[e].height,g,_,f[e].data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,v,f[e].width,f[e].height,0,g,_,f[e].data);for(let t=0;t<C.length;t++){let n=C[t].image[e].image;y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,0,0,n.width,n.height,g,_,n.data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,v,n.width,n.height,0,g,_,n.data)}}else{y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,0,0,g,_,f[e]):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,v,g,_,f[e]);for(let t=0;t<C.length;t++){let n=C[t];y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,0,0,g,_,n.image[e]):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,v,g,_,n.image[e])}}}D(t)&&O(l.TEXTURE_CUBE_MAP),a.__version=i.version,t.onUpdate&&t.onUpdate(t)}e.__version=t.version}function be(e,t,n,r,i,a){let o=m.convert(n.format,n.colorSpace),s=m.convert(n.type),c=A(n.internalFormat,o,s,n.normalized,n.colorSpace),u=f.get(t),p=f.get(n);if(p.__renderTarget=t,!u.__hasExternalTextures){let e=Math.max(1,t.width>>a),n=Math.max(1,t.height>>a);i===l.TEXTURE_3D||i===l.TEXTURE_2D_ARRAY?d.texImage3D(i,a,c,e,n,t.depth,0,o,s,null):d.texImage2D(i,a,c,e,n,0,o,s,null)}d.bindFramebuffer(l.FRAMEBUFFER,e),je(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,r,i,p.__webglTexture,0,Ae(t)):(i===l.TEXTURE_2D||i>=l.TEXTURE_CUBE_MAP_POSITIVE_X&&i<=l.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&l.framebufferTexture2D(l.FRAMEBUFFER,r,i,p.__webglTexture,a),d.bindFramebuffer(l.FRAMEBUFFER,null)}function xe(e,t,n){if(l.bindRenderbuffer(l.RENDERBUFFER,e),t.depthBuffer){let r=t.depthTexture,i=r&&r.isDepthTexture?r.type:null,a=ee(t.stencilBuffer,i),o=t.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;je(t)?g.renderbufferStorageMultisampleEXT(l.RENDERBUFFER,Ae(t),a,t.width,t.height):n?l.renderbufferStorageMultisample(l.RENDERBUFFER,Ae(t),a,t.width,t.height):l.renderbufferStorage(l.RENDERBUFFER,a,t.width,t.height),l.framebufferRenderbuffer(l.FRAMEBUFFER,o,l.RENDERBUFFER,e)}else{let e=t.textures;for(let r=0;r<e.length;r++){let i=e[r],a=m.convert(i.format,i.colorSpace),o=m.convert(i.type),s=A(i.internalFormat,a,o,i.normalized,i.colorSpace);je(t)?g.renderbufferStorageMultisampleEXT(l.RENDERBUFFER,Ae(t),s,t.width,t.height):n?l.renderbufferStorageMultisample(l.RENDERBUFFER,Ae(t),s,t.width,t.height):l.renderbufferStorage(l.RENDERBUFFER,s,t.width,t.height)}}l.bindRenderbuffer(l.RENDERBUFFER,null)}function Se(e,t,n){let r=t.isWebGLCubeRenderTarget===!0;if(d.bindFramebuffer(l.FRAMEBUFFER,e),!(t.depthTexture&&t.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let i=f.get(t.depthTexture);if(i.__renderTarget=t,(!i.__webglTexture||t.depthTexture.image.width!==t.width||t.depthTexture.image.height!==t.height)&&(t.depthTexture.image.width=t.width,t.depthTexture.image.height=t.height,t.depthTexture.needsUpdate=!0),r){if(i.__webglInit===void 0&&(i.__webglInit=!0,t.depthTexture.addEventListener(`dispose`,M)),i.__webglTexture===void 0){i.__webglTexture=l.createTexture(),d.bindTexture(l.TEXTURE_CUBE_MAP,i.__webglTexture),me(l.TEXTURE_CUBE_MAP,t.depthTexture);let e=m.convert(t.depthTexture.format),n=m.convert(t.depthTexture.type),r;t.depthTexture.format===1026?r=l.DEPTH_COMPONENT24:t.depthTexture.format===1027&&(r=l.DEPTH24_STENCIL8);for(let i=0;i<6;i++)l.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,r,t.width,t.height,0,e,n,null)}}else I(t.depthTexture,0);let a=i.__webglTexture,o=Ae(t),s=r?l.TEXTURE_CUBE_MAP_POSITIVE_X+n:l.TEXTURE_2D,c=t.depthTexture.format===1027?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;if(t.depthTexture.format===1026)je(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,c,s,a,0,o):l.framebufferTexture2D(l.FRAMEBUFFER,c,s,a,0);else if(t.depthTexture.format===1027)je(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,c,s,a,0,o):l.framebufferTexture2D(l.FRAMEBUFFER,c,s,a,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function Ce(e){let t=f.get(e),n=e.isWebGLCubeRenderTarget===!0;if(t.__boundDepthTexture!==e.depthTexture){let n=e.depthTexture;if(t.__depthDisposeCallback&&t.__depthDisposeCallback(),n){let e=()=>{delete t.__boundDepthTexture,delete t.__depthDisposeCallback,n.removeEventListener(`dispose`,e)};n.addEventListener(`dispose`,e),t.__depthDisposeCallback=e}t.__boundDepthTexture=n}if(e.depthTexture&&!t.__autoAllocateDepthBuffer){if(n)for(let n=0;n<6;n++)Se(t.__webglFramebuffer[n],e,n);else{let n=e.texture.mipmaps;n&&n.length>0?Se(t.__webglFramebuffer[0],e,0):Se(t.__webglFramebuffer,e,0)}}else if(n){t.__webglDepthbuffer=[];for(let n=0;n<6;n++)if(d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer[n]),t.__webglDepthbuffer[n]===void 0)t.__webglDepthbuffer[n]=l.createRenderbuffer(),xe(t.__webglDepthbuffer[n],e,!1);else{let r=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,i=t.__webglDepthbuffer[n];l.bindRenderbuffer(l.RENDERBUFFER,i),l.framebufferRenderbuffer(l.FRAMEBUFFER,r,l.RENDERBUFFER,i)}}else{let n=e.texture.mipmaps;if(n&&n.length>0?d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer[0]):d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer),t.__webglDepthbuffer===void 0)t.__webglDepthbuffer=l.createRenderbuffer(),xe(t.__webglDepthbuffer,e,!1);else{let n=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,r=t.__webglDepthbuffer;l.bindRenderbuffer(l.RENDERBUFFER,r),l.framebufferRenderbuffer(l.FRAMEBUFFER,n,l.RENDERBUFFER,r)}}d.bindFramebuffer(l.FRAMEBUFFER,null)}function we(e,t,n){let r=f.get(e);t!==void 0&&be(r.__webglFramebuffer,e,e.texture,l.COLOR_ATTACHMENT0,l.TEXTURE_2D,0),n!==void 0&&Ce(e)}function Te(e){let t=e.texture,n=f.get(e),r=f.get(t);e.addEventListener(`dispose`,N);let i=e.textures,a=e.isWebGLCubeRenderTarget===!0,o=i.length>1;if(o||(r.__webglTexture===void 0&&(r.__webglTexture=l.createTexture()),r.__version=t.version,h.memory.textures++),a){n.__webglFramebuffer=[];for(let e=0;e<6;e++)if(t.mipmaps&&t.mipmaps.length>0){n.__webglFramebuffer[e]=[];for(let r=0;r<t.mipmaps.length;r++)n.__webglFramebuffer[e][r]=l.createFramebuffer()}else n.__webglFramebuffer[e]=l.createFramebuffer()}else{if(t.mipmaps&&t.mipmaps.length>0){n.__webglFramebuffer=[];for(let e=0;e<t.mipmaps.length;e++)n.__webglFramebuffer[e]=l.createFramebuffer()}else n.__webglFramebuffer=l.createFramebuffer();if(o)for(let e=0,t=i.length;e<t;e++){let t=f.get(i[e]);t.__webglTexture===void 0&&(t.__webglTexture=l.createTexture(),h.memory.textures++)}if(e.samples>0&&je(e)===!1){n.__webglMultisampledFramebuffer=l.createFramebuffer(),n.__webglColorRenderbuffer=[],d.bindFramebuffer(l.FRAMEBUFFER,n.__webglMultisampledFramebuffer);for(let t=0;t<i.length;t++){let r=i[t];n.__webglColorRenderbuffer[t]=l.createRenderbuffer(),l.bindRenderbuffer(l.RENDERBUFFER,n.__webglColorRenderbuffer[t]);let a=m.convert(r.format,r.colorSpace),o=m.convert(r.type),s=A(r.internalFormat,a,o,r.normalized,r.colorSpace,e.isXRRenderTarget===!0),c=Ae(e);l.renderbufferStorageMultisample(l.RENDERBUFFER,c,s,e.width,e.height),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+t,l.RENDERBUFFER,n.__webglColorRenderbuffer[t])}l.bindRenderbuffer(l.RENDERBUFFER,null),e.depthBuffer&&(n.__webglDepthRenderbuffer=l.createRenderbuffer(),xe(n.__webglDepthRenderbuffer,e,!0)),d.bindFramebuffer(l.FRAMEBUFFER,null)}}if(a){d.bindTexture(l.TEXTURE_CUBE_MAP,r.__webglTexture),me(l.TEXTURE_CUBE_MAP,t);for(let r=0;r<6;r++)if(t.mipmaps&&t.mipmaps.length>0)for(let i=0;i<t.mipmaps.length;i++)be(n.__webglFramebuffer[r][i],e,t,l.COLOR_ATTACHMENT0,l.TEXTURE_CUBE_MAP_POSITIVE_X+r,i);else be(n.__webglFramebuffer[r],e,t,l.COLOR_ATTACHMENT0,l.TEXTURE_CUBE_MAP_POSITIVE_X+r,0);D(t)&&O(l.TEXTURE_CUBE_MAP),d.unbindTexture()}else if(o){for(let t=0,r=i.length;t<r;t++){let r=i[t],a=f.get(r),o=l.TEXTURE_2D;(e.isWebGL3DRenderTarget||e.isWebGLArrayRenderTarget)&&(o=e.isWebGL3DRenderTarget?l.TEXTURE_3D:l.TEXTURE_2D_ARRAY),d.bindTexture(o,a.__webglTexture),me(o,r),be(n.__webglFramebuffer,e,r,l.COLOR_ATTACHMENT0+t,o,0),D(r)&&O(o)}d.unbindTexture()}else{let i=l.TEXTURE_2D;if((e.isWebGL3DRenderTarget||e.isWebGLArrayRenderTarget)&&(i=e.isWebGL3DRenderTarget?l.TEXTURE_3D:l.TEXTURE_2D_ARRAY),d.bindTexture(i,r.__webglTexture),me(i,t),t.mipmaps&&t.mipmaps.length>0)for(let r=0;r<t.mipmaps.length;r++)be(n.__webglFramebuffer[r],e,t,l.COLOR_ATTACHMENT0,i,r);else be(n.__webglFramebuffer,e,t,l.COLOR_ATTACHMENT0,i,0);D(t)&&O(i),d.unbindTexture()}e.depthBuffer&&Ce(e)}function Ee(e){let t=e.textures;for(let n=0,r=t.length;n<r;n++){let r=t[n];if(D(r)){let t=k(e),n=f.get(r).__webglTexture;d.bindTexture(t,n),O(t),d.unbindTexture()}}}let De=[],Oe=[];function ke(e){if(e.samples>0){if(je(e)===!1){let t=e.textures,n=e.width,r=e.height,i=l.COLOR_BUFFER_BIT,a=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,o=f.get(e),s=t.length>1;if(s)for(let e=0;e<t.length;e++)d.bindFramebuffer(l.FRAMEBUFFER,o.__webglMultisampledFramebuffer),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.RENDERBUFFER,null),d.bindFramebuffer(l.FRAMEBUFFER,o.__webglFramebuffer),l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.TEXTURE_2D,null,0);d.bindFramebuffer(l.READ_FRAMEBUFFER,o.__webglMultisampledFramebuffer);let c=e.texture.mipmaps;c&&c.length>0?d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglFramebuffer[0]):d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglFramebuffer);for(let c=0;c<t.length;c++){if(e.resolveDepthBuffer&&(e.depthBuffer&&(i|=l.DEPTH_BUFFER_BIT),e.stencilBuffer&&e.resolveStencilBuffer&&(i|=l.STENCIL_BUFFER_BIT)),s){l.framebufferRenderbuffer(l.READ_FRAMEBUFFER,l.COLOR_ATTACHMENT0,l.RENDERBUFFER,o.__webglColorRenderbuffer[c]);let e=f.get(t[c]).__webglTexture;l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0,l.TEXTURE_2D,e,0)}l.blitFramebuffer(0,0,n,r,0,0,n,r,i,l.NEAREST),_===!0&&(De.length=0,Oe.length=0,De.push(l.COLOR_ATTACHMENT0+c),e.depthBuffer&&e.storeMultisampledDepthBuffer===!1&&(De.push(a),Oe.push(a),l.invalidateFramebuffer(l.DRAW_FRAMEBUFFER,Oe)),l.invalidateFramebuffer(l.READ_FRAMEBUFFER,De))}if(d.bindFramebuffer(l.READ_FRAMEBUFFER,null),d.bindFramebuffer(l.DRAW_FRAMEBUFFER,null),s)for(let e=0;e<t.length;e++){d.bindFramebuffer(l.FRAMEBUFFER,o.__webglMultisampledFramebuffer),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.RENDERBUFFER,o.__webglColorRenderbuffer[e]);let n=f.get(t[e]).__webglTexture;d.bindFramebuffer(l.FRAMEBUFFER,o.__webglFramebuffer),l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.TEXTURE_2D,n,0)}d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglMultisampledFramebuffer)}else if(e.depthBuffer&&e.storeMultisampledDepthBuffer===!1&&_){let t=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;l.invalidateFramebuffer(l.DRAW_FRAMEBUFFER,[t])}}}function Ae(e){return Math.min(p.maxSamples,e.samples)}function je(e){let t=f.get(e);return e.samples>0&&u.has(`WEBGL_multisampled_render_to_texture`)===!0&&t.__useRenderToTexture!==!1}function L(e){let t=h.render.frame;y.get(e)!==t&&(y.set(e,t),e.update())}function Me(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(_t.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&B(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):V(`WebGLTextures: Unsupported texture color space:`,n)),t}function Ne(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(v.width=e.naturalWidth||e.width,v.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(v.width=e.displayWidth,v.height=e.displayHeight):(v.width=e.width,v.height=e.height),v}this.allocateTextureUnit=oe,this.resetTextureUnits=re,this.getTextureUnits=ie,this.setTextureUnits=ae,this.setTexture2D=I,this.setTexture2DArray=ce,this.setTexture3D=le,this.setTextureCube=ue,this.rebindTextures=we,this.setupRenderTarget=Te,this.updateRenderTargetMipmap=Ee,this.updateMultisampleRenderTarget=ke,this.setupDepthRenderbuffer=Ce,this.setupFrameBufferTexture=be,this.useMultisampledRTT=je,this.isReversedDepthBuffer=function(){return d.buffers.depth.getReversed()}}function _l(e,t){function n(n,r=``){let i,a=_t.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var vl=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,yl=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,bl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new si(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new na({vertexShader:vl,fragmentShader:yl,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Nr(new Ki(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},xl=class extends et{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,u=null,d=null,f=null,p=null,h=null,g=typeof XRWebGLBinding<`u`,_=new bl,v={},b=t.getContextAttributes(),x=null,S=null,C=[],D=[],O=new H,k=null,A=null,ee=new Ba;ee.viewport=new Ot;let j=new Ba;j.viewport=new Ot;let M=[ee,j],N=new Za,te=null,P=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=C[e];return t===void 0&&(t=new ln,C[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=C[e];return t===void 0&&(t=new ln,C[e]=t),t.getGripSpace()},this.getHand=function(e){let t=C[e];return t===void 0&&(t=new ln,C[e]=t),t.getHandSpace()};function F(e){let t=D.indexOf(e.inputSource);if(t===-1)return;let n=C[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ne(){r.removeEventListener(`select`,F),r.removeEventListener(`selectstart`,F),r.removeEventListener(`selectend`,F),r.removeEventListener(`squeeze`,F),r.removeEventListener(`squeezestart`,F),r.removeEventListener(`squeezeend`,F),r.removeEventListener(`end`,ne),r.removeEventListener(`inputsourceschange`,re);for(let e=0;e<C.length;e++){let t=D[e];t!==null&&(D[e]=null,C[e].disconnect(t))}te=null,P=null,_.reset();for(let e in v)delete v[e];if(e.setRenderTarget(x),p=null,f=null,d=null,r=null,S=null,ue.stop(),n.isPresenting=!1,e.setPixelRatio(k),e.setSize(O.width,O.height,!1),A!==null){let e=A.camera;e.fov=A.fov,e.zoom=A.zoom,e.updateProjectionMatrix(),A=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&B(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&B(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return f===null?p:f},this.getBinding=function(){return d===null&&g&&(d=new XRWebGLBinding(r,t)),d},this.getFrame=function(){return h},this.getSession=function(){return r},this.setSession=async function(u){if(r=u,r!==null){if(x=e.getRenderTarget(),r.addEventListener(`select`,F),r.addEventListener(`selectstart`,F),r.addEventListener(`selectend`,F),r.addEventListener(`squeeze`,F),r.addEventListener(`squeezestart`,F),r.addEventListener(`squeezeend`,F),r.addEventListener(`end`,ne),r.addEventListener(`inputsourceschange`,re),b.xrCompatible!==!0&&await t.makeXRCompatible(),k=e.getPixelRatio(),e.getSize(O),g&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;b.depth&&(o=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=b.stencil?E:T,a=b.stencil?y:m);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};d=this.getBinding(),f=d.createProjectionLayer(s),r.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new At(f.textureWidth,f.textureHeight,{format:w,type:l,depthTexture:new ai(f.textureWidth,f.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}else{let n={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:i};p=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new At(p.framebufferWidth,p.framebufferHeight,{format:w,type:l,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1,storeMultisampledDepthBuffer:p.ignoreDepthValues===!1,storeMultisampledStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),ue.setContext(r),ue.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function re(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=D.indexOf(n);r>=0&&(D[r]=null,C[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=D.indexOf(n);if(r===-1){for(let e=0;e<C.length;e++)if(e>=D.length){D.push(n),r=e;break}else if(D[e]===null){D[e]=n,r=e;break}if(r===-1)break}let i=C[r];i&&i.connect(n)}}let ie=new U,ae=new U;function oe(e,t,n){ie.setFromMatrixPosition(t.matrixWorld),ae.setFromMatrixPosition(n.matrixWorld);let r=ie.distanceTo(ae),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function se(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;_.texture!==null&&(_.depthNear>0&&(t=_.depthNear),_.depthFar>0&&(n=_.depthFar)),N.near=j.near=ee.near=t,N.far=j.far=ee.far=n,(te!==N.near||P!==N.far)&&(r.updateRenderState({depthNear:N.near,depthFar:N.far}),te=N.near,P=N.far),N.layers.mask=e.layers.mask|6,ee.layers.mask=N.layers.mask&-5,j.layers.mask=N.layers.mask&-3;let i=e.parent,a=N.cameras;se(N,i);for(let e=0;e<a.length;e++)se(a[e],i);a.length===2?oe(N,ee,j):N.projectionMatrix.copy(ee.projectionMatrix),A===null&&e.isPerspectiveCamera&&(A={camera:e,fov:e.fov,zoom:e.zoom}),I(e,N,i)};function I(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=rt*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return N},this.getFoveation=function(){if(f!==null||p!==null)return s},this.setFoveation=function(e){s=e,f!==null&&(f.fixedFoveation=e),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=e)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(N)},this.getCameraTexture=function(e){return v[e]};let ce=null;function le(t,i){if(u=i.getViewerPose(c||a),h=i,u!==null){let t=u.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let i=!1;t.length!==N.cameras.length&&(N.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(p!==null)a=p.getViewport(r);else{let t=d.getViewSubImage(f,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(S,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(S))}let o=M[n];o===void 0&&(o=new Ba,o.layers.enable(n),o.viewport=new Ot,M[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(N.matrix.copy(o.matrix),N.matrix.decompose(N.position,N.quaternion,N.scale)),i===!0&&N.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&g){d=n.getBinding();let e=d.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&_.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&g){e.state.unbindTexture(),d=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=v[n];e||(e=new si,v[n]=e);let t=d.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<C.length;e++){let t=D[e],n=C[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}ce&&ce(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),h=null}let ue=new po;ue.setAnimationLoop(le),this.setAnimationLoop=function(e){ce=e},this.dispose=function(){}}},Sl=new G,Cl=new W;Cl.set(-1,0,0,0,1,0,0,0,1);function wl(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,Qi(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(Sl.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(Cl),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Tl(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return V(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?B(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):B(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var El=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Dl=null;function Ol(){return Dl===null&&(Dl=new Ir(El,16,16,k,g),Dl.name=`DFG_LUT`,Dl.minFilter=o,Dl.magFilter=o,Dl.wrapS=t,Dl.wrapT=t,Dl.generateMipmaps=!1,Dl.needsUpdate=!0),Dl}var kl=class{constructor(e={}){let{canvas:t=qe(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:u=!1,powerPreference:d=`default`,failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:h=!1,outputBufferType:b=l}=e;this.isWebGLRenderer=!0;let x;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);x=n.getContextAttributes().alpha}else x=a;let S=b,C=new Set([ee,A,O]),w=new Set([l,m,f,y,_,v]),T=new Uint32Array(4),E=new Int32Array(4),D=new U,k=null,j=null,M=[],N=[],te=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let P=this,F=!1,ne=null,re=null,ie=null,ae=null;this._outputColorSpace=Ie;let oe=0,se=0,I=null,ce=-1,le=null,ue=new Ot,de=new Ot,fe=null,pe=new K(0),me=0,he=t.width,ge=t.height,_e=1,ve=null,ye=null,be=new Ot(0,0,he,ge),xe=new Ot(0,0,he,ge),Se=!1,Ce=new Yr,we=!1,Te=!1,Ee=new G,De=new U,Oe=new Ot,ke={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ae=!1;function je(){return I===null?_e:1}let L=n;function Me(e,n){return t.getContext(e,n)}let Ne,Pe,R,Fe,z,Le,Re,ze,Be,Ve,He,We,Ge,Ke,Je,Xe,Ze,$e,et,tt,nt,rt,it;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:u,powerPreference:d,failIfMajorPerformanceCaveat:p};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,st,!1),t.addEventListener(`webglcontextrestored`,ct,!1),t.addEventListener(`webglcontextcreationerror`,lt,!1),L===null){let t=`webgl2`;if(L=Me(t,e),L===null)throw Me(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}at()}catch(e){throw t.removeEventListener(`webglcontextlost`,st,!1),t.removeEventListener(`webglcontextrestored`,ct,!1),t.removeEventListener(`webglcontextcreationerror`,lt,!1),V(`WebGLRenderer: `+e.message),e}function at(){Ne=new qo(L),Ne.init(),nt=new _l(L,Ne),Pe=new So(L,Ne,e,nt),R=new hl(L,Ne),Pe.reversedDepthBuffer&&h&&R.buffers.depth.setReversed(!0),re=L.createFramebuffer(),ie=L.createFramebuffer(),ae=L.createFramebuffer(),Fe=new Xo(L),z=new Yc,Le=new gl(L,Ne,R,z,Pe,nt,Fe),Re=new Ko(P),ze=new mo(L),rt=new bo(L,ze),Be=new Jo(L,ze,Fe,rt),Ve=new Qo(L,Be,ze,rt,Fe),$e=new Zo(L,Pe,Le),Je=new Co(z),He=new Jc(P,Re,Ne,Pe,rt,Je),We=new wl(P,z),Ge=new $c,Ke=new ol(Ne),Ze=new yo(P,Re,R,Ve,x,s),Xe=new ml(P,Ve,Pe),it=new Tl(L,Fe,Pe,R),et=new xo(L,Ne,Fe),tt=new Yo(L,Ne,Fe),Fe.programs=He.programs,P.capabilities=Pe,P.extensions=Ne,P.properties=z,P.renderLists=Ge,P.shadowMap=Xe,P.state=R,P.info=Fe}S!==1009&&(te=new es(S,t.width,t.height,o,r,i));let ot=new xl(P,L);this.xr=ot,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let e=Ne.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Ne.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return _e},this.setPixelRatio=function(e){e!==void 0&&(_e=e,this.setSize(he,ge,!1))},this.getSize=function(e){return e.set(he,ge)},this.setSize=function(e,n,r=!0){if(ot.isPresenting){B(`WebGLRenderer: Can't change size while VR device is presenting.`);return}he=e,ge=n,t.width=Math.floor(e*_e),t.height=Math.floor(n*_e),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),te!==null&&te.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(he*_e,ge*_e).floor()},this.setDrawingBufferSize=function(e,n,r){he=e,ge=n,_e=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(S===1009){V(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){B(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}te.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(ue)},this.getViewport=function(e){return e.copy(be)},this.setViewport=function(e,t,n,r){e.isVector4?be.set(e.x,e.y,e.z,e.w):be.set(e,t,n,r),R.viewport(ue.copy(be).multiplyScalar(_e).round())},this.getScissor=function(e){return e.copy(xe)},this.setScissor=function(e,t,n,r){e.isVector4?xe.set(e.x,e.y,e.z,e.w):xe.set(e,t,n,r),R.scissor(de.copy(xe).multiplyScalar(_e).round())},this.getScissorTest=function(){return Se},this.setScissorTest=function(e){R.setScissorTest(Se=e)},this.setOpaqueSort=function(e){ve=e},this.setTransparentSort=function(e){ye=e},this.getClearColor=function(e){return e.copy(Ze.getClearColor())},this.setClearColor=function(){Ze.setClearColor(...arguments)},this.getClearAlpha=function(){return Ze.getClearAlpha()},this.setClearAlpha=function(){Ze.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(I!==null){let t=I.texture.format;e=C.has(t)}if(e){let e=I.texture.type,t=w.has(e),n=Ze.getClearColor(),r=Ze.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(T[0]=i,T[1]=a,T[2]=o,T[3]=r,L.clearBufferuiv(L.COLOR,0,T)):(E[0]=i,E[1]=a,E[2]=o,E[3]=r,L.clearBufferiv(L.COLOR,0,E))}else r|=L.COLOR_BUFFER_BIT}t&&(r|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&L.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),ne=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,st,!1),t.removeEventListener(`webglcontextrestored`,ct,!1),t.removeEventListener(`webglcontextcreationerror`,lt,!1),Ze.dispose(),Ge.dispose(),Ke.dispose(),z.dispose(),Re.dispose(),Ve.dispose(),rt.dispose(),it.dispose(),He.dispose(),ot.dispose(),ot.removeEventListener(`sessionstart`,mt),ot.removeEventListener(`sessionend`,ht),gt.stop()};function st(e){e.preventDefault(),Ye(`WebGLRenderer: Context Lost.`),F=!0}function ct(){Ye(`WebGLRenderer: Context Restored.`),F=!1;let e=Fe.autoReset,t=Xe.enabled,n=Xe.autoUpdate,r=Xe.needsUpdate,i=Xe.type;at(),Fe.autoReset=e,Xe.enabled=t,Xe.autoUpdate=n,Xe.needsUpdate=r,Xe.type=i}function lt(e){V(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function H(e){let t=e.target;t.removeEventListener(`dispose`,H),ut(t)}function ut(e){dt(e),z.remove(e)}function dt(e){let t=z.get(e).programs;t!==void 0&&(t.forEach(function(e){He.releaseProgram(e)}),e.isShaderMaterial&&He.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=ke);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=Dt(e,t,n,r,i);R.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Be.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;rt.setup(i,r,s,n,c);let h,g=et;if(c!==null&&(h=ze.get(c),g=tt,g.setIndex(h)),i.isMesh)r.wireframe===!0?(R.setLineWidth(r.wireframeLinewidth*je()),g.setMode(L.LINES)):g.setMode(L.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),R.setLineWidth(e*je()),i.isLineSegments?g.setMode(L.LINES):i.isLineLoop?g.setMode(L.LINE_LOOP):g.setMode(L.LINE_STRIP)}else i.isPoints?g.setMode(L.POINTS):i.isSprite&&g.setMode(L.TRIANGLES);if(i.isBatchedMesh){if(Ne.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?ze.get(c).bytesPerElement:1,o=z.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(L,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function ft(e,t,n,r){ne!==null&&e.isNodeMaterial&&ne.setObject(r,e),we===!0&&Je.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,Ct(e,t,r),e.side=0,e.needsUpdate=!0,Ct(e,t,r),e.side=2):Ct(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),ne!==null&&ne.renderStart(e,t,n),j=Ke.get(n),j.init(t),N.push(j),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(j.pushLight(e),e.castShadow&&j.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(j.pushLight(e),e.castShadow&&j.pushShadow(e))}),j.setupLights(),ne!==null&&ne.updateLights(j.state.lightsArray),Te=this.localClippingEnabled,we=Je.init(this.clippingPlanes,Te),we===!0&&Je.setGlobalState(this.clippingPlanes,t),ne!==null&&Xe.render(j.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];ft(o,n,t,e),r.add(o)}else ft(i,n,t,e),r.add(i)}}),j=N.pop(),ne!==null&&ne.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){let t=z.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}Ne.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let W=null;function pt(e){W&&W(e)}function mt(){gt.stop()}function ht(){gt.start()}let gt=new po;gt.setAnimationLoop(pt),typeof self<`u`&&gt.setContext(self),this.setAnimationLoop=function(e){W=e,ot.setAnimationLoop(e),e===null?gt.stop():gt.start()},ot.addEventListener(`sessionstart`,mt),ot.addEventListener(`sessionend`,ht),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){V(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(F===!0)return;ne!==null&&ne.renderStart(e,t);let n=ot.enabled===!0&&ot.isPresenting===!0,r=te!==null&&(I===null||n)&&te.begin(P,I);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),ot.enabled===!0&&ot.isPresenting===!0&&(te===null||te.isCompositing()===!1)&&(ot.cameraAutoUpdate===!0&&ot.updateCamera(t),t=ot.getCamera()),e.isScene===!0&&e.onBeforeRender(P,e,t,I),j=Ke.get(e,N.length),j.init(t),j.state.textureUnits=Le.getTextureUnits(),N.push(j),Ee.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),Ce.setFromProjectionMatrix(Ee,Ue,t.reversedDepth),Te=this.localClippingEnabled,we=Je.init(this.clippingPlanes,Te),k=Ge.get(e,M.length),k.init(),M.push(k),ot.enabled===!0&&ot.isPresenting===!0){let e=P.xr.getDepthSensingMesh();e!==null&&vt(e,t,-1/0,P.sortObjects)}vt(e,t,0,P.sortObjects),k.finish(),ne!==null&&ne.updateLights(j.state.lightsArray),P.sortObjects===!0&&k.sort(ve,ye),Ae=ot.enabled===!1||ot.isPresenting===!1||ot.hasDepthSensing()===!1,Ae&&Ze.addToRenderList(k,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),we===!0&&Je.beginShadows();let i=j.state.shadowsArray;if(Xe.render(i,e,t),we===!0&&Je.endShadows(),(r&&te.hasRenderPass())===!1){let n=k.opaque,r=k.transmissive;if(j.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];bt(n,r,e,a)}Ae&&Ze.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];yt(k,e,n,n.viewport)}}else r.length>0&&bt(n,r,e,t),Ae&&Ze.render(e),yt(k,e,t)}I!==null&&se===0&&(Le.updateMultisampleRenderTarget(I),Le.updateRenderTargetMipmap(I)),r&&te.end(P),e.isScene===!0&&e.onAfterRender(P,e,t),rt.resetDefaultState(),ce=-1,le=null,N.pop(),N.length>0?(j=N[N.length-1],Le.setTextureUnits(j.state.textureUnits),we===!0&&Je.setGlobalState(P.clippingPlanes,j.state.camera)):j=null,M.pop(),k=M.length>0?M[M.length-1]:null,ne!==null&&ne.renderEnd()};function vt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)j.pushLightProbeGrid(e);else if(e.isLight)j.pushLight(e),e.castShadow&&j.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(Ce)){r&&Oe.setFromMatrixPosition(e.matrixWorld).applyMatrix4(Ee);let i=Ve.update(e),a=e.material;a.visible&&k.push(e,i,a,n,Oe.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(Ce))){let i=Ve.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),Oe.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),Oe.copy(e.boundingSphere.center)),Oe.applyMatrix4(e.matrixWorld).applyMatrix4(Ee)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&k.push(e,i,c,n,Oe.z,s,t)}}else a.visible&&k.push(e,i,a,n,Oe.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)vt(i[e],t,n,r)}function yt(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;j.setupLightsView(n),we===!0&&Je.setGlobalState(P.clippingPlanes,n),r&&R.viewport(ue.copy(r)),i.length>0&&xt(i,t,n),a.length>0&&xt(a,t,n),o.length>0&&xt(o,t,n),R.buffers.depth.setTest(!0),R.buffers.depth.setMask(!0),R.buffers.color.setMask(!0),R.setPolygonOffset(!1)}function bt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(j.state.transmissionRenderTarget[r.id]===void 0){let e=Ne.has(`EXT_color_buffer_half_float`)||Ne.has(`EXT_color_buffer_float`);j.state.transmissionRenderTarget[r.id]=new At(1,1,{generateMipmaps:!0,type:e?g:l,minFilter:c,samples:Math.max(4,Pe.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:_t.workingColorSpace})}let a=j.state.transmissionRenderTarget[r.id],o=r.viewport||ue;a.setSize(o.z*P.transmissionResolutionScale,o.w*P.transmissionResolutionScale);let s=P.getRenderTarget(),u=P.getActiveCubeFace(),d=P.getActiveMipmapLevel();P.setRenderTarget(a),P.getClearColor(pe),me=P.getClearAlpha(),me<1&&P.setClearColor(16777215,.5),P.clear(),Ae&&Ze.render(n);let f=P.toneMapping;P.toneMapping=0;let p=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),j.setupLightsView(r),we===!0&&Je.setGlobalState(P.clippingPlanes,r),xt(e,n,r),Le.updateMultisampleRenderTarget(a),Le.updateRenderTargetMipmap(a),Ne.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,St(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(Le.updateMultisampleRenderTarget(a),Le.updateRenderTargetMipmap(a))}P.setRenderTarget(s,u,d),P.setClearColor(pe,me),p!==void 0&&(r.viewport=p),P.toneMapping=f}function xt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&St(o,t,n,s,l,c)}}function St(e,t,n,r,i,a){ne!==null&&i.isNodeMaterial&&ne.setObject(e,i),e.onBeforeRender(P,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(P,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,P.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,P.renderBufferDirect(n,t,r,i,e,a),i.side=2):P.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(P,t,n,r,i,a)}function Ct(e,t,n){t.isScene!==!0&&(t=ke);let r=z.get(e),i=j.state.lights,a=j.state.shadowsArray,o=i.state.version,s=He.getParameters(e,i.state,a,t,n,j.state.lightProbeGridArray),c=He.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Re.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,H),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return Tt(e,s),d}else s.uniforms=He.getUniforms(e),ne!==null&&e.isNodeMaterial&&ne.build(e,n,s),e.onBeforeCompile(s,P),d=He.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Je.uniform),Tt(e,s),r.needsLights=jt(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=j.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function wt(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=sc.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function Tt(e,t){let n=z.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function Et(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];D.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(D))return n}return null}function Dt(e,t,n,r,i){t.isScene!==!0&&(t=ke),Le.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=I===null?P.outputColorSpace:I.isXRRenderTarget===!0?I.texture.colorSpace:_t.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Re.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(I===null||I.isXRRenderTarget===!0)&&(h=P.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=z.get(r),y=j.state.lights;if(we===!0&&(Te===!0||e!==le)){let t=e===le&&r.id===ce;Je.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Je.numPlanes||v.numIntersection!==Je.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=j.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=Ct(r,t,i),ne&&r.isNodeMaterial&&ne.onUpdateProgram(r,x,v));let S=!1,C=!1,w=!1,T=x.getUniforms(),E=v.uniforms;if(R.useProgram(x.program)&&(S=!0,C=!0,w=!0),r.id!==ce&&(ce=r.id,C=!0),v.needsLights){let e=Et(j.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,C=!0)}if(S||le!==e){R.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),T.setValue(L,`projectionMatrix`,e.projectionMatrix),T.setValue(L,`viewMatrix`,e.matrixWorldInverse);let t=T.map.cameraPosition;t!==void 0&&t.setValue(L,De.setFromMatrixPosition(e.matrixWorld)),Pe.logarithmicDepthBuffer&&T.setValue(L,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&T.setValue(L,`isOrthographic`,e.isOrthographicCamera===!0),le!==e&&(le=e,C=!0,w=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&T.setValue(L,`sunShadowMap`,y.state.sunShadowMap,Le),y.state.directionalShadowMap.length>0&&T.setValue(L,`directionalShadowMap`,y.state.directionalShadowMap,Le),y.state.spotShadowMap.length>0&&T.setValue(L,`spotShadowMap`,y.state.spotShadowMap,Le),y.state.pointShadowMap.length>0&&T.setValue(L,`pointShadowMap`,y.state.pointShadowMap,Le)),i.isSkinnedMesh){T.setOptional(L,i,`bindMatrix`),T.setOptional(L,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),T.setValue(L,`boneTexture`,e.boneTexture,Le))}i.isBatchedMesh&&(T.setOptional(L,i,`batchingTexture`),T.setValue(L,`batchingTexture`,i._matricesTexture,Le),T.setOptional(L,i,`batchingIdTexture`),T.setValue(L,`batchingIdTexture`,i._indirectTexture,Le),T.setOptional(L,i,`batchingColorTexture`),i._colorsTexture!==null&&T.setValue(L,`batchingColorTexture`,i._colorsTexture,Le));let D=n.morphAttributes;if((D.position!==void 0||D.normal!==void 0||D.color!==void 0)&&$e.update(i,n,x),(C||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,T.setValue(L,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(E.envMapIntensity.value=t.environmentIntensity),E.dfgLUT!==void 0&&(E.dfgLUT.value=Ol()),C){if(T.setValue(L,`toneMappingExposure`,P.toneMappingExposure),v.needsLights&&kt(E,w),a&&r.fog===!0&&We.refreshFogUniforms(E,a),We.refreshMaterialUniforms(E,r,_e,ge,j.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;E.probesSH.value=e.texture,E.probesMin.value.copy(e.boundingBox.min),E.probesMax.value.copy(e.boundingBox.max),E.probesResolution.value.copy(e.resolution)}sc.upload(L,wt(v),E,Le)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(sc.upload(L,wt(v),E,Le),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&T.setValue(L,`center`,i.center),T.setValue(L,`modelViewMatrix`,i.modelViewMatrix),T.setValue(L,`normalMatrix`,i.normalMatrix),T.setValue(L,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];it.update(n,x),it.bind(n,x)}}return x}function kt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function jt(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return oe},this.getActiveMipmapLevel=function(){return se},this.getRenderTarget=function(){return I},this.setRenderTargetTextures=function(e,t,n){let r=z.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),z.get(e.texture).__webglTexture=t,z.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=z.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){I=e,oe=t,se=n;let r=null,i=!1,a=!1;if(e){let o=z.get(e);if(o.__useDefaultFramebuffer!==void 0){R.bindFramebuffer(L.FRAMEBUFFER,o.__webglFramebuffer),ue.copy(e.viewport),de.copy(e.scissor),fe=e.scissorTest,R.viewport(ue),R.scissor(de),R.setScissorTest(fe),ce=-1;return}if(o.__webglFramebuffer===void 0)Le.setupRenderTarget(e);else if(o.__hasExternalTextures)Le.rebindTextures(e,z.get(e.texture).__webglTexture,z.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&z.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);Le.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=z.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&Le.useMultisampledRTT(e)===!1?z.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,ue.copy(e.viewport),de.copy(e.scissor),fe=e.scissorTest}else ue.copy(be).multiplyScalar(_e).floor(),de.copy(xe).multiplyScalar(_e).floor(),fe=Se;if(n!==0&&(r=re),R.bindFramebuffer(L.FRAMEBUFFER,r)&&R.drawBuffers(e,r),R.viewport(ue),R.scissor(de),R.setScissorTest(fe),i){let r=z.get(e.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=z.get(e.textures[t]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=z.get(e.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,t.__webglTexture,n)}ce=-1};function Mt(e){let t=z.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=Pe.textureFormatReadable(e.format),t.__typeReadable=Pe.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){V(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=z.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){R.bindFramebuffer(L.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+s);let u=Mt(o);if(u.__formatReadable===!1){V(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){V(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&L.readPixels(t,n,r,i,nt.convert(c),nt.convert(l),a)}finally{let e=I===null?null:z.get(I).__webglFramebuffer;R.bindFramebuffer(L.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=z.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){R.bindFramebuffer(L.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+s);let d=Mt(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,f),L.bufferData(L.PIXEL_PACK_BUFFER,a.byteLength,L.STREAM_READ),L.readPixels(t,n,r,i,nt.convert(l),nt.convert(u),0),L.bindBuffer(L.PIXEL_PACK_BUFFER,null);let p=I===null?null:z.get(I).__webglFramebuffer;R.bindFramebuffer(L.FRAMEBUFFER,p);let m=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Qe(L,m,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,f),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,a),L.bindBuffer(L.PIXEL_PACK_BUFFER,null),L.deleteBuffer(f),L.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;Le.setTexture2D(e,0),L.copyTexSubImage2D(L.TEXTURE_2D,n,0,0,o,s,i,a),R.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=nt.convert(t.format),_=nt.convert(t.type),v;t.isData3DTexture?(Le.setTexture3D(t,0),v=L.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(Le.setTexture2DArray(t,0),v=L.TEXTURE_2D_ARRAY):(Le.setTexture2D(t,0),v=L.TEXTURE_2D),R.activeTexture(L.TEXTURE0),R.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,t.flipY),R.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),R.pixelStorei(L.UNPACK_ALIGNMENT,t.unpackAlignment);let y=R.getParameter(L.UNPACK_ROW_LENGTH),b=R.getParameter(L.UNPACK_IMAGE_HEIGHT),x=R.getParameter(L.UNPACK_SKIP_PIXELS),S=R.getParameter(L.UNPACK_SKIP_ROWS),C=R.getParameter(L.UNPACK_SKIP_IMAGES);R.pixelStorei(L.UNPACK_ROW_LENGTH,h.width),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,h.height),R.pixelStorei(L.UNPACK_SKIP_PIXELS,l),R.pixelStorei(L.UNPACK_SKIP_ROWS,u),R.pixelStorei(L.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=z.get(e),r=z.get(t),h=z.get(n.__renderTarget),g=z.get(r.__renderTarget);R.bindFramebuffer(L.READ_FRAMEBUFFER,h.__webglFramebuffer),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(e).__webglTexture,i,d+n),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(t).__webglTexture,a,m+n)),L.blitFramebuffer(l,u,o,s,f,p,o,s,L.DEPTH_BUFFER_BIT,L.NEAREST);R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||z.has(e)){let n=z.get(e),r=z.get(t);R.bindFramebuffer(L.READ_FRAMEBUFFER,ie),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,ae);for(let e=0;e<c;e++)w?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,n.__webglTexture,i),T?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,r.__webglTexture,a),i===0?T?L.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):L.copyTexSubImage2D(v,a,f,p,l,u,o,s):L.blitFramebuffer(l,u,o,s,f,p,o,s,L.COLOR_BUFFER_BIT,L.NEAREST);R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?L.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?L.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):L.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):L.texSubImage2D(L.TEXTURE_2D,a,f,p,o,s,g,_,h);R.pixelStorei(L.UNPACK_ROW_LENGTH,y),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,b),R.pixelStorei(L.UNPACK_SKIP_PIXELS,x),R.pixelStorei(L.UNPACK_SKIP_ROWS,S),R.pixelStorei(L.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&L.generateMipmap(v),R.unbindTexture()},this.initRenderTarget=function(e){z.get(e).__webglFramebuffer===void 0&&Le.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?Le.setTextureCube(e,0):e.isData3DTexture?Le.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?Le.setTexture2DArray(e,0):Le.setTexture2D(e,0),R.unbindTexture()},this.resetState=function(){oe=0,se=0,I=null,R.reset(),rt.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return Ue}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=_t._getDrawingBufferColorSpace(e),t.unpackColorSpace=_t._getUnpackColorSpace()}},Al=new Ua(-1,1,1,-1,0,1),jl=new class extends lr{constructor(){super(),this.setAttribute(`position`,new Zn([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new Zn([0,2,0,0,2,0],2))}},Ml=class{constructor(e){this._mesh=new Nr(jl,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Al)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},Nl={focus:40,aperture:0,exposure:1,bloom:.9,bloomThreshold:1,vignette:.35,grain:.035,ca:.9,saturation:1.08,contrast:1.06,split:.25,lift:[0,0,0],gain:[1,1,1]},Pl=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,Fl=`
vec3 down13(sampler2D t, vec2 uv, vec2 px) {
  vec3 A = texture2D(t, uv + px * vec2(-2.0, -2.0)).rgb;
  vec3 B = texture2D(t, uv + px * vec2( 0.0, -2.0)).rgb;
  vec3 C = texture2D(t, uv + px * vec2( 2.0, -2.0)).rgb;
  vec3 D = texture2D(t, uv + px * vec2(-1.0, -1.0)).rgb;
  vec3 E = texture2D(t, uv + px * vec2( 1.0, -1.0)).rgb;
  vec3 F = texture2D(t, uv + px * vec2(-2.0,  0.0)).rgb;
  vec3 G = texture2D(t, uv).rgb;
  vec3 H = texture2D(t, uv + px * vec2( 2.0,  0.0)).rgb;
  vec3 I = texture2D(t, uv + px * vec2(-1.0,  1.0)).rgb;
  vec3 J = texture2D(t, uv + px * vec2( 1.0,  1.0)).rgb;
  vec3 K = texture2D(t, uv + px * vec2(-2.0,  2.0)).rgb;
  vec3 L = texture2D(t, uv + px * vec2( 0.0,  2.0)).rgb;
  vec3 M = texture2D(t, uv + px * vec2( 2.0,  2.0)).rgb;
  vec3 o = (D + E + I + J) * 0.125;
  o += (A + B + G + F) * 0.03125;
  o += (B + C + H + G) * 0.03125;
  o += (F + G + L + K) * 0.03125;
  o += (G + H + M + L) * 0.03125;
  return o;
}`;function Il(e,t,n=0){return new na({vertexShader:Pl,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1,blending:n,transparent:n!==0})}var Ll=class{renderer;width=1;height=1;sceneRT;accumRT;mips=[];quad=new Ml;prefilter;down;up;accum;final;farCam=new Ba;samples;lastRenderMs=0;constructor(e,t){this.samples=t.samples??4,this.renderer=new kl({antialias:!1,powerPreference:`high-performance`,preserveDrawingBuffer:!0,alpha:!1,stencil:!1,reversedDepthBuffer:!0}),this.renderer.setPixelRatio(1),this.renderer.info.autoReset=!1,this.renderer.toneMapping=0,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=1,this.renderer.shadowMap.autoUpdate=!1,this.renderer.autoClear=!1,e.appendChild(this.renderer.domElement),this.prefilter=Il(`
      uniform sampler2D tSrc; uniform vec2 px; uniform float threshold; varying vec2 vUv;
      ${Fl}
      void main() {
        vec3 s = min(down13(tSrc, vUv, px), vec3(80.0));
        float br = max(s.r, max(s.g, s.b));
        float knee = threshold * 0.6 + 1e-4;
        float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
        rq = rq * rq / (4.0 * knee);
        float w = max(rq, br - threshold) / max(br, 1e-4);
        gl_FragColor = vec4(s * w, 1.0);
      }`,{tSrc:{value:null},px:{value:new H},threshold:{value:1}}),this.down=Il(`
      uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
      ${Fl}
      void main() { gl_FragColor = vec4(down13(tSrc, vUv, px), 1.0); }`,{tSrc:{value:null},px:{value:new H}}),this.up=Il(`
      uniform sampler2D tSrc; uniform vec2 px; uniform float weight; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tSrc, vUv + px * vec2(-1.0, -1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(0.0, -1.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, -1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(-1.0, 0.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv).rgb * 4.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, 0.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(-1.0, 1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(0.0, 1.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(s * (weight / 16.0), 1.0);
      }`,{tSrc:{value:null},px:{value:new H},weight:{value:1}},2),this.accum=Il(`
      uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`,{tSrc:{value:null},weight:{value:1}},2),this.final=Il(Rl,{tScene:{value:null},tDepth:{value:null},tBloom:{value:null},res:{value:new H},projInv:{value:new G},reversed:{value:1},focus:{value:40},aperture:{value:0},exposure:{value:1},bloom:{value:.8},vignette:{value:.3},grain:{value:.03},ca:{value:1},saturation:{value:1},contrast:{value:1},split:{value:0},lift:{value:[0,0,0]},gain:{value:[1,1,1]},time:{value:0}}),this.setSize(t.width,t.height)}setSize(e,t){if(e=Math.max(16,Math.floor(e)),t=Math.max(16,Math.floor(t)),e===this.width&&t===this.height&&this.sceneRT)return;this.width=e,this.height=t,this.renderer.setSize(e,t,!1),this.sceneRT?.dispose(),this.accumRT?.dispose();for(let e of this.mips)e.dispose();let n=new ai(e,t,h);this.sceneRT=new At(e,t,{type:g,format:w,samples:this.samples,depthTexture:n,depthBuffer:!0,minFilter:o,magFilter:o}),this.accumRT=new At(e,t,{type:g,format:w,depthBuffer:!1,minFilter:o,magFilter:o}),this.mips=[];let r=Math.max(1,e>>1),i=Math.max(1,t>>1);for(let e=0;e<6;e++)this.mips.push(new At(r,i,{type:g,format:w,depthBuffer:!1,minFilter:o,magFilter:o})),r=Math.max(1,r>>1),i=Math.max(1,i>>1)}sync(){let e=this.renderer.getContext(),t=new Uint8Array(4);e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,t)}renderScene(e,t,n){let r=this.renderer;r.setRenderTarget(this.sceneRT),r.setClearColor(0,1),r.clear(!0,!0,!1);let i=e.background;if(n){let i=this.farCam;i.fov=t.fov,i.aspect=t.aspect,i.near=n.near,i.far=n.far,i.filmGauge=t.filmGauge,i.filmOffset=t.filmOffset,i.updateProjectionMatrix(),t.updateMatrixWorld(),i.matrixWorld.copy(t.matrixWorld),i.matrixWorldInverse.copy(t.matrixWorldInverse),i.matrixAutoUpdate=!1,i.matrixWorldAutoUpdate=!1,i.layers.set(1),r.shadowMap.needsUpdate=!1,r.render(e,i),r.clearDepth(),e.background=null}t.layers.set(0),r.shadowMap.needsUpdate=!0,r.render(e,t),e.background=i}render(e,t,n,r={}){let i=performance.now(),a=this.renderer;a.info.reset();let o=Math.max(1,r.subframes??1),s;if(o===1)this.renderScene(e,t,r.far??null),s=this.sceneRT.texture;else{a.setRenderTarget(this.accumRT),a.setClearColor(0,1),a.clear(!0,!1,!1);let n=[],i=Math.floor(o/2);for(let e=0;e<o;e++)e!==i&&n.push(e);n.push(i);for(let i of n)r.setSub?.(i,o),this.renderScene(e,t,r.far??null),this.accum.uniforms.tSrc.value=this.sceneRT.texture,this.accum.uniforms.weight.value=1/o,this.quad.material=this.accum,a.setRenderTarget(this.accumRT),this.quad.render(a);s=this.accumRT.texture}let c=this.mips;this.prefilter.uniforms.tSrc.value=s,this.prefilter.uniforms.px.value.set(1/this.width,1/this.height),this.prefilter.uniforms.threshold.value=n.bloomThreshold,this.quad.material=this.prefilter,a.setRenderTarget(c[0]),this.quad.render(a);for(let e=1;e<c.length;e++)this.down.uniforms.tSrc.value=c[e-1].texture,this.down.uniforms.px.value.set(1/c[e-1].width,1/c[e-1].height),this.quad.material=this.down,a.setRenderTarget(c[e]),this.quad.render(a);for(let e=c.length-1;e>0;e--)this.up.uniforms.tSrc.value=c[e].texture,this.up.uniforms.px.value.set(1/c[e].width,1/c[e].height),this.up.uniforms.weight.value=1,this.quad.material=this.up,a.setRenderTarget(c[e-1]),this.quad.render(a);let l=this.final.uniforms;l.tScene.value=s,l.tDepth.value=this.sceneRT.depthTexture,l.tBloom.value=c[0].texture,l.res.value.set(this.width,this.height),l.projInv.value.copy(t.projectionMatrixInverse),l.reversed.value=+!!a.capabilities.reversedDepthBuffer,l.focus.value=n.focus,l.aperture.value=n.aperture*(this.height/804),l.exposure.value=n.exposure,l.bloom.value=n.bloom,l.vignette.value=n.vignette,l.grain.value=n.grain,l.ca.value=n.ca,l.saturation.value=n.saturation,l.contrast.value=n.contrast,l.split.value=n.split,l.lift.value=n.lift,l.gain.value=n.gain,l.time.value=r.time??0,this.quad.material=this.final,a.setRenderTarget(null),this.quad.render(a),this.lastRenderMs=performance.now()-i}},Rl=`
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform vec2 res;
uniform mat4 projInv;
uniform float reversed;
uniform float focus, aperture, exposure, bloom, vignette, grain, ca, saturation, contrast, split, time;
uniform vec3 lift, gain;
varying vec2 vUv;

float linDepth(float d) {
  // reversed-Z with a [0,1] clip range: 0 = cleared / infinitely far
  if (reversed > 0.5 ? d <= 1e-7 : d >= 0.999999) return 1e9;
  float ndcZ = reversed > 0.5 ? d : d * 2.0 - 1.0;
  vec4 p = projInv * vec4(0.0, 0.0, ndcZ, 1.0);
  return -p.z / p.w;
}
float coc(vec2 uv) {
  float z = linDepth(texture2D(tDepth, uv).x);
  return clamp(aperture * abs(1.0 - focus / z), 0.0, aperture * 1.6 + 0.001);
}
vec3 rrtOdt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = IN * color;
  color = rrtOdt(color);
  color = OUT * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / res;
  vec3 col;
  vec2 d = uv - 0.5;
  if (aperture > 0.05) {
    float c0 = coc(uv);
    vec3 acc = texture2D(tScene, uv).rgb;
    float wsum = 1.0;
    const float GA = 2.39996323;
    for (int i = 1; i < 28; i++) {
      float fi = float(i);
      float r = sqrt(fi / 28.0) * max(c0, 0.001);
      float a = fi * GA;
      vec2 o = vec2(cos(a), sin(a)) * r * px;
      float cs = coc(uv + o);
      float w = smoothstep(r - 1.0, r + 0.5, cs);
      acc += texture2D(tScene, uv + o).rgb * w;
      wsum += w;
    }
    col = acc / wsum;
  } else {
    vec2 off = d * ca * 0.0045;
    col.r = texture2D(tScene, uv - off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv + off).b;
  }
  col += texture2D(tBloom, uv).rgb * bloom * 0.09;
  col = aces(col);
  // grade
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = (col - 0.5) * contrast + 0.5;
  vec3 warm = vec3(1.05, 1.0, 0.93), cool = vec3(0.93, 1.0, 1.06);
  col *= mix(vec3(1.0), mix(cool, warm, smoothstep(0.12, 0.7, l)), split);
  col = col * gain + lift * (1.0 - col);
  col = clamp(col, 0.0, 1.0);
  // vignette
  float v = length(d * vec2(res.x / res.y, 1.0) * 0.85);
  col *= mix(1.0, smoothstep(1.05, 0.25, v), vignette);
  vec3 s = toSRGB(col);
  float g = hash(uv * res + fract(time * 13.37) * 311.7) - 0.5;
  s += g * grain * (1.0 - 0.6 * dot(s, vec3(0.333)));
  gl_FragColor = vec4(s, 1.0);
}
`,zl=2.39,Bl=`
#film-ui .sub { position: absolute; left: 0; right: 0; text-align: center; color: #fff; font-family: Inter, "Source Sans 3", Arimo, Arial, sans-serif; font-weight: 600; letter-spacing: 0.01em; text-shadow: 0 2px 3px rgba(0,0,0,0.85); white-space: nowrap; }
#film-ui .sub b { color: #f2c33a; font-weight: 600; }
#film-ui .card { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; opacity: 0; }
#film-ui .card.farfar { color: #4cc3ff; font-family: "Source Sans 3", Inter, Arimo, sans-serif; font-weight: 400; line-height: 1.35; letter-spacing: 0.01em; }
#film-ui .card.endcard { color: #f5d24a; font-family: "Source Sans 3", Inter, Arimo, sans-serif; font-weight: 700; letter-spacing: 0.18em; }
#film-ui .fade { position: absolute; background: #000; opacity: 0; }
`,Vl=class{root;sub;cardFar;cardEnd;fade;layout={width:1,height:1,top:0,left:0,pageW:1,pageH:1};constructor(e){this.root=e;let t=document.createElement(`style`);t.textContent=Bl,document.head.appendChild(t),this.fade=document.createElement(`div`),this.fade.className=`fade`,this.sub=document.createElement(`div`),this.sub.className=`sub`,this.cardFar=document.createElement(`div`),this.cardFar.className=`card farfar`,this.cardFar.innerHTML=`<div>A long time ago in a galaxy far,<br>far away....</div>`,this.cardEnd=document.createElement(`div`),this.cardEnd.className=`card endcard`,e.append(this.fade,this.sub,this.cardFar,this.cardEnd)}fit(e,t,n){let r=t,i=Math.round(t/zl);i>n&&(i=n,r=Math.round(i*zl));let a=Math.round((n-i)/2),o=Math.round((t-r)/2);Object.assign(e.style,{position:`absolute`,left:`${o}px`,top:`${a}px`,width:`${r}px`,height:`${i}px`}),this.layout={width:r,height:i,top:a,left:o,pageW:t,pageH:n};let s=Math.round(n*.034);return Object.assign(this.sub.style,{fontSize:`${s}px`,top:`${a+i+Math.round((n-a-i)/2-s*.62)}px`}),Object.assign(this.fade.style,{left:`${o}px`,top:`${a}px`,width:`${r}px`,height:`${i}px`}),this.cardFar.style.fontSize=`${Math.round(n*.042)}px`,this.cardEnd.style.fontSize=`${Math.round(n*.05)}px`,this.layout}setSubtitle(e,t,n=1){if(!t){this.sub.style.opacity=`0`;return}let r=e=>e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`),i=e?`<b>${r(e)}:</b> ${r(t)}`:r(t);this.sub.innerHTML!==i&&(this.sub.innerHTML=i),this.sub.style.opacity=String(n)}setFade(e){this.fade.style.opacity=String(Math.max(0,Math.min(1,e)))}setCards(e,t,n){this.cardFar.style.opacity=String(Math.max(0,Math.min(1,e))),this.cardEnd.style.opacity=String(Math.max(0,Math.min(1,t))),n!==void 0&&this.cardEnd.innerHTML!==n&&(this.cardEnd.innerHTML=n)}},Hl=class{pos=[];nrm=[];tri(e,t,n,r,i=r,a=r){let o=t[0]-e[0],s=t[1]-e[1],c=t[2]-e[2],l=n[0]-e[0],u=n[1]-e[1],d=n[2]-e[2],f=s*d-c*u,p=c*l-o*d,m=o*u-s*l;if(f*f+p*p+m*m<1e-16)return;let h=r[0]+i[0]+a[0],g=r[1]+i[1]+a[1],_=r[2]+i[2]+a[2];if(f*h+p*g+m*_<0){let e=t;t=n,n=e;let r=i;i=a,a=r}this.pos.push(e[0],e[1],e[2],t[0],t[1],t[2],n[0],n[1],n[2]),this.nrm.push(r[0],r[1],r[2],i[0],i[1],i[2],a[0],a[1],a[2])}quad(e,t,n,r,i,a=i,o=i,s=i){this.tri(e,t,n,i,a,o),this.tri(e,n,r,i,o,s)}append(e,t){if(!t){for(let t=0;t<e.pos.length;t++)this.pos.push(e.pos[t]);for(let t=0;t<e.nrm.length;t++)this.nrm.push(e.nrm[t]);return}let n=t.elements,r=new W().getNormalMatrix(t).elements;for(let t=0;t<e.pos.length;t+=3){let i=e.pos[t],a=e.pos[t+1],o=e.pos[t+2];this.pos.push(n[0]*i+n[4]*a+n[8]*o+n[12],n[1]*i+n[5]*a+n[9]*o+n[13],n[2]*i+n[6]*a+n[10]*o+n[14]);let s=e.nrm[t],c=e.nrm[t+1],l=e.nrm[t+2],u=r[0]*s+r[3]*c+r[6]*l,d=r[1]*s+r[4]*c+r[7]*l,f=r[2]*s+r[5]*c+r[8]*l,p=Math.hypot(u,d,f)||1;u/=p,d/=p,f/=p,this.nrm.push(u,d,f)}}done(){return{pos:new Float32Array(this.pos),nrm:new Float32Array(this.nrm)}}},Ul=new Map;function Wl(e,t){let n=Ul.get(e);return n||(n=t(),Ul.set(e,n)),n}function Gl(e,t){let n=new Hl;return n.append(e,t),n.done()}function Kl(e){let t=new Hl;for(let n of e)t.append(n);return t.done()}function ql(e){let t=0;for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t+=r[0]*i[1]-i[0]*r[1]}return t/2}function Jl(e,t,n,r={}){let i=e.map(e=>[e[0],e[1]]);ql(i)<0&&(i=i.reverse());let a=i.length,o=t/2,s=1/0;for(let e=0;e<a;e++)s=Math.min(s,Math.hypot(i[(e+1)%a][0]-i[e][0],i[(e+1)%a][1]-i[e][1]));n=Math.max(0,Math.min(n,t*.45,s*.4));let c=[];for(let e=0;e<a;e++){let t=i[e],n=i[(e+1)%a],r=n[0]-t[0],o=n[1]-t[1],s=Math.hypot(r,o)||1;c.push([o/s,-r/s])}let l=[];for(let e=0;e<a;e++){let t=c[(e-1+a)%a],r=c[e],o=Math.max(.25,1+t[0]*r[0]+t[1]*r[1]);l.push([i[e][0]-n*(t[0]+r[0])/o,i[e][1]-n*(t[1]+r[1])/o])}let u=new Hl,d=o-n,f=new Set(r.skipWalls??[]),p=r.onlyWalls?new Set(r.onlyWalls):null;for(let e=0;e<a;e++){if(f.has(e)||p&&!p.has(e))continue;let t=(e+1)%a,r=[l[e][0]+c[e][0]*n,l[e][1]+c[e][1]*n],i=[l[t][0]+c[e][0]*n,l[t][1]+c[e][1]*n],o=[c[e][0],c[e][1],0];u.quad([r[0],r[1],-d],[i[0],i[1],-d],[i[0],i[1],d],[r[0],r[1],d],o)}if(p)return u.done();if(n>0){for(let e=0;e<a;e++){let t=c[(e-1+a)%a],i=c[e],s=[l[e][0]+t[0]*n,l[e][1]+t[1]*n],f=[l[e][0]+i[0]*n,l[e][1]+i[1]*n],p=[t[0],t[1],0],m=[i[0],i[1],0];u.quad([s[0],s[1],-d],[f[0],f[1],-d],[f[0],f[1],d],[s[0],s[1],d],p,m,m,p);for(let t of[1,-1]){if(t===1&&r.noFront||t===-1&&r.noBack)continue;let n=[0,0,t];u.tri([s[0],s[1],t*d],[f[0],f[1],t*d],[l[e][0],l[e][1],t*o],p,m,n)}}for(let e=0;e<a;e++){let t=(e+1)%a,i=[l[e][0]+c[e][0]*n,l[e][1]+c[e][1]*n],s=[l[t][0]+c[e][0]*n,l[t][1]+c[e][1]*n],f=[c[e][0],c[e][1],0];for(let n of[1,-1]){if(n===1&&r.noFront||n===-1&&r.noBack)continue;let a=[0,0,n];u.quad([i[0],i[1],n*d],[s[0],s[1],n*d],[l[t][0],l[t][1],n*o],[l[e][0],l[e][1],n*o],f,f,a,a)}}}for(let e of[1,-1]){if(e===1&&r.noFront||e===-1&&r.noBack)continue;let t=[0,0,e];for(let n=1;n<a-1;n++)u.tri([l[0][0],l[0][1],e*o],[l[n][0],l[n][1],e*o],[l[n+1][0],l[n+1][1],e*o],t)}return u.done()}function Yl(e,t,n,r=.03,i={}){return Wl(`box|${e.toFixed(4)}|${t.toFixed(4)}|${n.toFixed(4)}|${r.toFixed(4)}|${JSON.stringify(i)}`,()=>{let a=[];return i.ny&&a.push(0),i.px&&a.push(1),i.py&&a.push(2),i.nx&&a.push(3),Jl([[-e/2,-t/2],[e/2,-t/2],[e/2,t/2],[-e/2,t/2]],n,r,{skipWalls:a,noFront:i.pz,noBack:i.nz})})}function Xl(e,t=35){let n=[];for(let t=0;t<e.length-1;t++){let r=e[t+1][0]-e[t][0],i=e[t+1][1]-e[t][1],a=Math.hypot(r,i)||1;n.push([-i/a,r/a])}let r=Math.cos(t*Math.PI/180),i=[];for(let t=0;t<n.length;t++){let a=n[t],o=n[t];if(t>0){let e=n[t-1];if(e[0]*a[0]+e[1]*a[1]>r){let t=[e[0]+a[0],e[1]+a[1]],n=Math.hypot(t[0],t[1])||1;a=[t[0]/n,t[1]/n]}}if(t<n.length-1){let e=n[t+1];if(e[0]*o[0]+e[1]*o[1]>r){let t=[e[0]+o[0],e[1]+o[1]],n=Math.hypot(t[0],t[1])||1;o=[t[0]/n,t[1]/n]}}let s=e[t],c=e[t+1];i.push([s[0],s[1],a[0],a[1],c[0],c[1],o[0],o[1]])}return i}function Zl(e,t,n,r={}){let i=r.top??!0,a=r.bottom??!0,o=r.y0??-t/2,s=o+t;n=Math.min(n,e*.5,t*.45);let c=[];return i&&(c.push([0,s,0,1,e-n,s,0,1]),c.push([e-n,s,0,1,e,s-n,1,0])),c.push([e,i?s-n:s,1,0,e,a?o+n:o,1,0]),a&&(c.push([e,o+n,1,0,e-n,o,0,-1]),c.push([e-n,o,0,-1,0,o,0,-1])),c}function Ql(e,t=24,n=0,r=Math.PI*2){let i=new Hl;for(let a=0;a<t;a++){let o=n+r*a/t,s=n+r*(a+1)/t,c=Math.sin(o),l=Math.cos(o),u=Math.sin(s),d=Math.cos(s);for(let t of e){let[e,n,r,a,o,s,f,p]=t,m=[e*c,n,e*l],h=[e*u,n,e*d],g=[o*c,s,o*l],_=[o*u,s,o*d],v=[r*c,a,r*l],y=[r*u,a,r*d],b=[f*c,p,f*l],x=[f*u,p,f*d];i.quad(m,h,_,g,v,y,x,b)}}return i.done()}function $l(e,t,n=.03,r=24,i={}){return Wl(`cyl|${e.toFixed(4)}|${t.toFixed(4)}|${n.toFixed(4)}|${r}|${i.top??1}|${i.bottom??1}`,()=>Ql(Zl(e,t,n,i),r))}function eu(e,t,n,r=.02,i=24){return Wl(`tube|${e}|${t}|${n}|${r}|${i}`,()=>{let a=n/2,o=-n/2;return r=Math.min(r,(e-t)*.4,n*.4),Ql([[t,a-r,-1,0,t+r,a,0,1],[t+r,a,0,1,e-r,a,0,1],[e-r,a,0,1,e,a-r,1,0],[e,a-r,1,0,e,o+r,1,0],[e,o+r,1,0,e-r,o,0,-1],[e-r,o,0,-1,t+r,o,0,-1],[t+r,o,0,-1,t,o+r,-1,0],[t,o+r,-1,0,t,a-r,-1,0]],i)})}function tu(e,t=24,n=12,r=0,i=Math.PI){return Wl(`sph|${e}|${t}|${n}|${r}|${i}`,()=>{let a=[];for(let t=0;t<n;t++){let o=r+(i-r)*t/n,s=r+(i-r)*(t+1)/n;a.push([e*Math.sin(o),e*Math.cos(o),Math.sin(o),Math.cos(o),e*Math.sin(s),e*Math.cos(s),Math.sin(s),Math.cos(s)])}return Ql(a,t)})}function nu(e,t,n=12,r={}){let i=typeof t==`number`?()=>t:t,a=new Hl,o=e.length,s=[];for(let t=0;t<o;t++){let n=new U(...e[Math.max(0,t-1)]),r=new U(...e[Math.min(o-1,t+1)]);s.push(r.sub(n).normalize())}let c=Math.abs(s[0].y)<.9?new U(0,1,0):new U(1,0,0),l=new U().crossVectors(s[0],c).normalize(),u=[];for(let e=0;e<o;e++){if(e>0){let t=new U().crossVectors(s[e-1],s[e]),n=t.length();if(n>1e-6){let e=Math.asin(Math.min(1,n));l=l.clone().applyAxisAngle(t.normalize(),e)}}let t=new U().crossVectors(s[e],l).normalize();u.push({N:l.clone(),B:t})}let d=t=>{let r=o>1?t/(o-1):0,a=i(r),s=[],c=[];for(let r=0;r<=n;r++){let i=r/n*Math.PI*2,o=u[t].N.x*Math.cos(i)+u[t].B.x*Math.sin(i),l=u[t].N.y*Math.cos(i)+u[t].B.y*Math.sin(i),d=u[t].N.z*Math.cos(i)+u[t].B.z*Math.sin(i);s.push([e[t][0]+o*a,e[t][1]+l*a,e[t][2]+d*a]),c.push([o,l,d])}return{pts:s,nrm:c}},f=d(0);for(let e=1;e<o;e++){let t=d(e);for(let e=0;e<n;e++)a.quad(f.pts[e],f.pts[e+1],t.pts[e+1],t.pts[e],f.nrm[e],f.nrm[e+1],t.nrm[e+1],t.nrm[e]);f=t}if(!r.open)for(let[t,r]of[[0,-1],[o-1,1]]){let i=d(t),o=[...e[t]],c=[s[t].x*r,s[t].y*r,s[t].z*r];for(let e=0;e<n;e++)a.tri(o,i.pts[e],i.pts[e+1],c)}return a.done()}function ru(e,t,n,r=.2){return[[0,0],[e,0],[e,t],[e-n,t],[0,r]]}new G;function iu(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var au=class e{f;constructor(e=1){this.f=iu(e)}next(){return this.f()}range(e,t){return e+(t-e)*this.f()}int(e,t){return e+Math.floor(this.f()*(t-e+1))}pick(e){return e[Math.floor(this.f()*e.length)%e.length]}chance(e){return this.f()<e}gauss(e=0,t=1){return e+t*(this.f()+this.f()+this.f()+this.f()-2)*1.2247}fork(t){return new e((Math.floor(this.f()*4294967296)^Math.imul(t+1,2654435761))>>>0)}};function ou(e){let t=Math.imul((e|0)^668265261,374761393);return t^=t>>>15,t=Math.imul(t,2246822507),t^=t>>>13,t=Math.imul(t,3266489909),t^=t>>>16,(t>>>0)/4294967296}function su(e,t){return ou(Math.imul(e|0,73856093)^Math.imul(t|0,19349663))}function cu(e,t,n){return ou(Math.imul(e|0,73856093)^Math.imul(t|0,19349663)^Math.imul(n|0,83492791))}function lu(e,t=0){let n=Math.floor(e),r=e-n,i=r*r*(3-2*r),a=su(n,t)*2-1;return a+(su(n+1,t)*2-1-a)*i}var uu={white:{hex:16053489,kind:`solid`},lbg:{hex:10725547,kind:`solid`},dbg:{hex:6448746,kind:`solid`},pearlDarkGray:{hex:5724247,kind:`metal`,rough:.42},black:{hex:1711393,kind:`solid`},red:{hex:12653835,kind:`solid`},darkRed:{hex:7474703,kind:`solid`},yellow:{hex:16237082,kind:`solid`},brightLightOrange:{hex:16296751,kind:`solid`},orange:{hex:16154387,kind:`solid`},darkOrange:{hex:10506255,kind:`solid`},blue:{hex:1265844,kind:`solid`},darkBlue:{hex:929111,kind:`solid`},mediumAzure:{hex:3583679,kind:`solid`},sandBlue:{hex:6255767,kind:`solid`},sandGreen:{hex:9416859,kind:`solid`},darkGreen:{hex:1590834,kind:`solid`},tan:{hex:14731158,kind:`solid`},darkTan:{hex:9800307,kind:`solid`},reddishBrown:{hex:5910816,kind:`solid`},darkBrown:{hex:3483159,kind:`solid`},lightNougat:{hex:16177075,kind:`solid`},hairAnakin:{hex:6173207,kind:`solid`},hairObiwan:{hex:9325084,kind:`solid`},mediumNougat:{hex:11566933,kind:`solid`},flatSilver:{hex:10263967,kind:`metal`,rough:.34},metalSilver:{hex:13159634,kind:`metal`,rough:.2},pearlGold:{hex:12883258,kind:`metal`,rough:.3},gunmetal:{hex:3882562,kind:`metal`,rough:.38},rubberBlack:{hex:1382170,kind:`rubber`,rough:.62},slopeLbg:{hex:10725547,kind:`slope`},slopeDbg:{hex:6448746,kind:`slope`},slopeWhite:{hex:16053489,kind:`slope`},slopeTan:{hex:14731158,kind:`slope`},slopeBlack:{hex:1711393,kind:`slope`},trClear:{hex:16054527,kind:`trans`,op:.16},trBlack:{hex:4078131,kind:`trans`,op:.62},trSmoke:{hex:7238004,kind:`trans`,op:.42},trLightBlue:{hex:11464944,kind:`trans`,op:.45},trBlue:{hex:1788104,kind:`trans`,op:.55},trRed:{hex:13635600,kind:`trans`,op:.6},trOrange:{hex:15763996,kind:`trans`,op:.6},trYellow:{hex:16110895,kind:`trans`,op:.55},trGreen:{hex:4506730,kind:`trans`,op:.55},glowOrange:{hex:16747066,kind:`glow`,glow:7},glowEngine:{hex:16756896,kind:`glow`,glow:9},glowBlue:{hex:5945599,kind:`glow`,glow:7},glowCyan:{hex:10483455,kind:`glow`,glow:6},glowRed:{hex:16722458,kind:`glow`,glow:7},glowWhite:{hex:16774109,kind:`glow`,glow:5},glowYellow:{hex:16766570,kind:`glow`,glow:5},glowGreen:{hex:6094714,kind:`glow`,glow:6},windowWarm:{hex:16767392,kind:`glow`,glow:2.2},windowCool:{hex:13625087,kind:`glow`,glow:2}};function du(e){return uu[e]}function fu(e){return du(e).kind===`trans`}var pu={clearcoat:!0},mu=null;function hu(){if(mu)return mu;let t=document.createElement(`canvas`);t.width=t.height=512;let n=t.getContext(`2d`),r=n.createImageData(512,512),i=new au(4242),a=Array.from({length:26},()=>({x:i.next()*512,y:i.next()*512,r:i.range(30,120),a:i.range(-.1,.12)}));for(let e=0;e<512;e++)for(let t=0;t<512;t++){let n=.66;for(let r of a){let i=Math.abs(t-r.x),a=Math.abs(e-r.y);i=Math.min(i,512-i),a=Math.min(a,512-a);let o=(i*i+a*a)/(r.r*r.r);o<4&&(n+=r.a*Math.exp(-o*1.6))}n+=(i.next()-.5)*.05;let o=(e*512+t)*4,s=Math.max(0,Math.min(255,n*255));r.data[o]=s,r.data[o+1]=s,r.data[o+2]=s,r.data[o+3]=255}n.putImageData(r,0,0),n.globalCompositeOperation=`lighter`;for(let e=0;e<90;e++){let e=i.next()*512,t=i.next()*512,r=i.next()*Math.PI,a=i.range(10,70);n.strokeStyle=`rgba(40,40,40,${i.range(.25,.6)})`,n.lineWidth=i.range(.5,1.2),n.beginPath(),n.moveTo(e,t),n.quadraticCurveTo(e+Math.cos(r)*a*.5+i.range(-6,6),t+Math.sin(r)*a*.5+i.range(-6,6),e+Math.cos(r)*a,t+Math.sin(r)*a),n.stroke()}let o=new ii(t);return o.wrapS=o.wrapT=e,o.colorSpace=``,o.anisotropy=4,o.needsUpdate=!0,mu=o,o}var gu=new Map;function _u(e,t=1){let n=du(e);return new K(n.hex).multiplyScalar((n.glow??1)*t)}function vu(e,t={}){let n=`${e}|${t.plain?`p`:`v`}|${t.doubleSide?`d`:`s`}`,r=gu.get(n);if(r)return r;let i=du(e),a=!t.plain,o=t.doubleSide?2:0,s;switch(i.kind){case`glow`:s=new xr({color:_u(e),vertexColors:a,side:o,toneMapped:!1,fog:!1});break;case`trans`:s=new aa({color:i.hex,roughness:.04,metalness:0,transparent:!0,opacity:i.op??.4,depthWrite:!1,side:2,vertexColors:a,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.6});break;case`metal`:s=new ia({color:i.hex,roughness:i.rough??.3,metalness:.92,vertexColors:a,side:o,envMapIntensity:1.25});break;case`rubber`:s=new ia({color:i.hex,roughness:i.rough??.6,metalness:0,vertexColors:a,side:o});break;case`slope`:s=new ia({color:i.hex,roughness:.62,metalness:0,vertexColors:a,side:o,roughnessMap:hu()});break;default:{let e=hu();s=pu.clearcoat?new aa({color:i.hex,roughness:.5,roughnessMap:e,metalness:0,vertexColors:a,side:o,clearcoat:.55,clearcoatRoughness:.14,envMapIntensity:1}):new ia({color:i.hex,roughness:.42,roughnessMap:e,metalness:0,vertexColors:a,side:o})}}return s.name=`lego:${e}`,gu.set(n,s),s}var yu=.4,bu=.3,xu=.012,Su={y:new G,x:new G().makeRotationZ(-Math.PI/2),z:new G().makeRotationX(Math.PI/2)},Y=class{stack=[new G];buckets=new Map;rng;tint;uvScale;studSegments;chamfer;constructor(e={}){this.rng=new au(e.seed??7),this.tint=e.tint??.035,this.uvScale=e.uvScale??.11,this.studSegments=e.studSegments??16,this.chamfer=e.chamfer??.035}get m(){return this.stack[this.stack.length-1]}push(){return this.stack.push(this.m.clone()),this}pop(){return this.stack.length>1&&this.stack.pop(),this}apply(e){return this.m.multiply(e),this}translate(e,t,n){return this.apply(new G().makeTranslation(e,t,n))}rotateX(e){return this.apply(new G().makeRotationX(e))}rotateY(e){return this.apply(new G().makeRotationY(e))}rotateZ(e){return this.apply(new G().makeRotationZ(e))}rotate(e,t,n,r=`XYZ`){return this.apply(new G().makeRotationFromEuler(new Ht(e,t,n,r)))}scale(e,t=e,n=e){return this.apply(new G().makeScale(e,t,n))}mirrorX(){return this.apply(new G().makeScale(-1,1,1))}with(e){return this.push(),e(this),this.pop()}at(e,t,n,r){return this.push(),this.translate(e,t,n),r(this),this.pop()}bucket(e){let t=this.buckets.get(e);return t||(t={pos:[],nrm:[],uv:[],col:[]},this.buckets.set(e,t)),t}add(e,t,n,r={}){let i=n?this.m.clone().multiply(n):this.m,a=i.elements,o=wu.getNormalMatrix(i).elements,s=[o[0],o[3],o[6],o[1],o[4],o[7],o[2],o[5],o[8]],c=i.determinant()<0,l=this.bucket(e),u=r.tint??this.tint,d=(r.shade??1)*(1+u*(this.rng.next()*2-1)),f=this.rng.next()*7.3,p=this.rng.next()*5.1,m=this.uvScale,h=t.pos,g=t.nrm,_=e=>{let t=h[e],n=h[e+1],r=h[e+2],i=a[0]*t+a[4]*n+a[8]*r+a[12],o=a[1]*t+a[5]*n+a[9]*r+a[13],c=a[2]*t+a[6]*n+a[10]*r+a[14],u=g[e],_=g[e+1],v=g[e+2],y=s[0]*u+s[1]*_+s[2]*v,b=s[3]*u+s[4]*_+s[5]*v,x=s[6]*u+s[7]*_+s[8]*v,S=Math.hypot(y,b,x)||1;y/=S,b/=S,x/=S,l.pos.push(i,o,c),l.nrm.push(y,b,x);let C=Math.abs(y),w=Math.abs(b),T=Math.abs(x);C>=w&&C>=T?l.uv.push(c*m+f,o*m+p):w>=T?l.uv.push(i*m+f,c*m+p):l.uv.push(i*m+f,o*m+p),l.col.push(d,d,d)};for(let e=0;e<h.length;e+=9)c?(_(e),_(e+6),_(e+3)):(_(e),_(e+3),_(e+6));return this}box(e,t,n,r,i,a,o,s={}){let c=Yl(i,a,o,s.c??this.chamfer,s.hide??{}),l=new G().makeTranslation(t,n,r);return s.rot&&l.multiply(new G().makeRotationFromEuler(new Ht(s.rot[0],s.rot[1],s.rot[2]))),this.add(e,c,l,{tint:s.tint})}brick(e,t,n,r,i,a,o=3,s={}){let c=o*yu,l=n*yu,u=s.hide??{ny:!0};return this.box(e,t+i/2,l+c/2,r+a/2,i-2*xu,c-.004,a-2*xu,{c:s.c,hide:u,tint:s.tint}),(s.studs??!0)&&this.studs(s.studKey??e,t,n+o,r,i,a),this}plate(e,t,n,r,i,a,o={}){return this.brick(e,t,n,r,i,a,1,o)}tile(e,t,n,r,i,a,o={}){return this.brick(e,t,n,r,i,a,1,{...o,studs:!1})}studMD(){return $l(bu,.19999999999999998,.04,this.studSegments,{bottom:!1})}studs(e,t,n,r,i,a){let o=this.studMD(),s=n*yu+.19999999999999998/2-.02;for(let n=0;n<i;n++)for(let i=0;i<a;i++)this.add(e,o,new G().makeTranslation(t+.5+n,s,r+.5+i),{tint:.012});return this}stud(e,t,n,r){return this.add(e,this.studMD(),new G().makeTranslation(t,n+.19999999999999998/2-.02,r),{tint:.012})}cyl(e,t,n,r,i,a,o={}){let s=$l(i,a,o.c??Math.min(.035,i*.2),o.radial??24,{top:o.top,bottom:o.bottom}),c=new G().makeTranslation(t,n,r).multiply(Su[o.axis??`y`]);return this.add(e,s,c,{tint:o.tint})}lathe(e,t,n={}){let r=()=>Ql(t,n.radial??24,n.theta0??0,n.thetaLen??Math.PI*2),i=n.cacheKey?Wl(`lathe|${n.cacheKey}|${n.radial??24}`,r):r(),a=n.at??[0,0,0],o=new G().makeTranslation(a[0],a[1],a[2]).multiply(Su[n.axis??`y`]);return this.add(e,i,o,{tint:n.tint})}prism(e,t,n,r={}){let i=Jl(t,n,r.c??this.chamfer,r),a=r.zc?new G().makeTranslation(0,0,r.zc):void 0;return this.add(e,i,a,{tint:r.tint})}shape(e,t,n,r,i={}){let a=t.map(([e,t])=>[e,-t]),o=new G().makeTranslation(0,n+r/2,0).multiply(new G().makeRotationX(-Math.PI/2));return this.add(e,Jl(a,r,i.c??this.chamfer,{noBack:i.hideBottom??!0}),o,{tint:i.tint})}slope(e,t,n,r,i,a,o=3,s=1,c={}){let l=o*yu-.004,u=ru(a-2*xu,l,Math.min(s,a-.5),c.lip??Math.min(.2,l*.3)),d=new G().makeTranslation(t+i/2,n*yu,r+xu).multiply(new G().makeRotationY(-Math.PI/2)).multiply(new G().makeScale(1,1,1)),f=c.c??this.chamfer,p=c.faceKey??Cu(e);return this.add(e,Jl(u,i-2*xu,f,{skipWalls:[3],noBack:!1}),d),this.add(p,Jl(u,i-2*xu,f,{onlyWalls:[3]}),d,{tint:.02}),(c.studs??!0)&&s>=1&&this.studs(e,t,n+o,r+a-Math.floor(s),i,Math.floor(s)),this}build(e,t={}){let n=new sn;n.name=e;let r=[],i=0;for(let[a,o]of this.buckets){if(!o.pos.length)continue;let s=new lr;s.setAttribute(`position`,new Jn(new Float32Array(o.pos),3)),s.setAttribute(`normal`,new Jn(new Float32Array(o.nrm),3)),s.setAttribute(`uv`,new Jn(new Float32Array(o.uv),2)),s.setAttribute(`color`,new Jn(new Float32Array(o.col),3)),s.computeBoundingSphere(),s.computeBoundingBox();let c=vu(a),l=new Nr(s,c);l.name=`${e}:${a}`;let u=du(a).kind;l.castShadow=(t.castShadow??!0)&&u!==`glow`&&u!==`trans`,l.receiveShadow=(t.receiveShadow??!0)&&u!==`glow`,fu(a)&&(l.renderOrder=2),u===`glow`&&(l.renderOrder=1),n.add(l),r.push({key:a,geometry:s,material:c}),i+=o.pos.length/9}return{group:n,parts:r,triangles:i}}};function Cu(e){return{lbg:`slopeLbg`,dbg:`slopeDbg`,white:`slopeWhite`,tan:`slopeTan`,black:`slopeBlack`}[e]??e}var wu=new W;new U,new ut;function Tu(){let e=new Y({seed:3});return e.plate(`dbg`,-6,-1,-6,12,12),e.brick(`red`,-5,0,-4,4,2),e.brick(`yellow`,-1,0,-4,2,2),e.brick(`white`,1,0,-4,4,2),e.brick(`lbg`,-5,3,-4,2,2),e.brick(`blue`,-3,3,-4,4,2),e.slope(`lbg`,-5,0,-1,2,2,3,1),e.slope(`red`,-3,0,-1,2,3,3,1),e.slope(`white`,0,0,-1,3,2,3,1),e.tile(`black`,3,0,-1,2,2),e.tile(`tan`,3,0,1,2,2),e.cyl(`flatSilver`,4,1.2,-3,.9,2.4,{radial:32}),e.cyl(`trBlue`,1.5,1.8,3,.9,1.2,{radial:32}),e.cyl(`glowOrange`,-2,.6,3,.5,1.2,{radial:24}),e.cyl(`trClear`,-4.5,.6,3,.8,1.2,{radial:24}),e.box(`pearlGold`,4.5,.6,3,1.4,1.2,1.4),e.shape(`darkRed`,[[-6,6],[-2,6],[-6,4.5]],0,.4),e.studs(`darkRed`,-6,1,5,1,1),e.build(`test-bricks`).group}function Eu(e,t,n=0,r=0,i=0){let a=new on;return a.name=e,a.position.set(n,r,i),t.add(a),a}function Du(e){let t=0;for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t+=r[0]*i[1]-i[0]*r[1]}return t/2}function Ou(e){let t=[];for(let n of e){let e=t[t.length-1];(!e||Math.hypot(e[0]-n[0],e[1]-n[1])>1e-5)&&t.push(n)}return t.length>1&&Math.hypot(t[0][0]-t[t.length-1][0],t[0][1]-t[t.length-1][1])<1e-5&&t.pop(),t}function ku(e,t,n,r){let i=[],a=e=>t*e[0]+n*e[1]-r;for(let t=0;t<e.length;t++){let n=e[t],r=e[(t+1)%e.length],o=a(n),s=a(r);if(o<=1e-9&&i.push(n),o<=1e-9!=s<=1e-9){let e=o/(o-s);i.push([n[0]+(r[0]-n[0])*e,n[1]+(r[1]-n[1])*e])}}return Ou(i)}function Au(e,t,n,r,i){let a=e;return a=ku(a,-1,0,-t),a=ku(a,1,0,n),a=ku(a,0,-1,-r),a=ku(a,0,1,i),a}function ju(e,t,n,r=!0){let i=n[0]-t[0],a=n[1]-t[1],o=-i;return r||(a=-a,o=-o),ku(e,a,o,a*t[0]+o*t[1])}function Mu(e,t,n,r){return[[e,t],[n,t],[n,r],[e,r]]}function Nu(e,t){let n=Du(t)<0?[...t].reverse():t,r=[];for(let t=0;t<n.length;t++){let i=e;for(let e=0;e<t&&i.length>=3;e++)i=ju(i,n[e],n[(e+1)%n.length],!0);i.length>=3&&(i=ju(i,n[t],n[(t+1)%n.length],!1)),i.length>=3&&Math.abs(Du(i))>.01&&r.push(i)}return r}function Pu(e,t){let n=e.length,r=Du(e)>0?1:-1,i=e.map((i,a)=>{let o=e[(a+1)%n],s=o[0]-i[0],c=o[1]-i[1],l=Math.hypot(s,c)||1;return{px:i[0]-c/l*r*t,pz:i[1]+s/l*r*t,dx:s,dz:c}});return i.map((e,t)=>{let r=i[(t-1+n)%n],a=e.dx*r.dz-r.dx*e.dz,o=e.px-r.px,s=e.pz-r.pz,c=Math.abs(a)<1e-9?0:(e.dx*s-o*e.dz)/a;return[r.px+r.dx*c,r.pz+r.dz*c]})}function Fu(e,t,n){return e[1]+(t[1]-e[1])*(n-e[0])/(t[0]-e[0])}function Iu(e,t=[],n=[]){let r=[e];for(let e of t)r=r.flatMap(t=>[ku(t,0,1,e),ku(t,0,-1,-e)]);for(let e of n)r=r.flatMap(t=>[ku(t,1,0,e),ku(t,-1,0,-e)]);return r.filter(e=>e.length>=3&&Math.abs(Du(e))>.02)}function Lu(e,t,n,r,i,a={}){n.length<3||Math.abs(Du(n))<.02||e.shape(t,n,r,i,a)}function Ru(e,t,n,r=0){let i=Math.sign(Du(e))||1;for(let a=0;a<e.length;a++){let o=e[a],s=e[(a+1)%e.length],c=s[0]-o[0],l=s[1]-o[1],u=Math.hypot(c,l)||1;if((c*(n-o[1])-l*(t-o[0]))/u*i<r)return!1}return!0}function zu(e,t,n,r,i={}){let a=i.gx??0,o=i.gz??.5,s=i.margin??.42,c=1/0,l=-1/0,u=1/0,d=-1/0;for(let[e,t]of n)c=Math.min(c,e),l=Math.max(l,e),u=Math.min(u,t),d=Math.max(d,t);let f=0;for(let p=Math.ceil(c-a)+a;p<=l;p+=1)for(let a=Math.ceil(u-o)+o;a<=d;a+=1)Ru(n,p,a,s)&&(i.skip?.(p,a)||(e.stud(t,p,r,a),f++));return f}var Bu=new U,Vu=new U,Hu=new U,Uu=new U,Wu=new U,Gu=new U;function Ku(e,t){t.set(0,0,0);for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t.x+=(r[1]-i[1])*(r[2]+i[2]),t.y+=(r[2]-i[2])*(r[0]+i[0]),t.z+=(r[0]-i[0])*(r[1]+i[1])}return t.normalize()}function qu(e){let t=Ku(e,new U);return[t.x,t.y,t.z]}function Ju(e,t,n,r,i={}){let a=Ku(n,Uu).clone(),o=Bu.set(...n[0]).clone(),s=Wu.set(...n[1]).sub(o).normalize().clone(),c=new U().crossVectors(a,s).normalize(),l=Jl(n.map(e=>(Vu.set(...e).sub(o),[Vu.dot(s),Vu.dot(c)])),r,i.c??.03,{}),u=i.side??1,d=new G().makeBasis(s,c,a).setPosition(o.clone().addScaledVector(a,u*r/2));e.add(t,l,d,{tint:i.tint})}function Yu(e,t,n,r,i,a,o=[0,1,0],s={}){let c=Bu.set(...n).clone(),l=Hu.set(...r).clone(),u=l.clone().sub(c),d=u.length();if(d<1e-4)return;u.divideScalar(d);let f=Gu.set(...o).clone();f.addScaledVector(u,-f.dot(u)),f.lengthSq()<1e-8&&f.set(1,0,0).addScaledVector(u,-u.x),f.normalize();let p=new U().crossVectors(f,u).normalize(),m=Yl(i,a,d+2*(s.ext??0),s.c??Math.min(.03,i*.2,a*.2),s.hide??{}),h=new G().makeBasis(p,f,u).setPosition(c.add(l).multiplyScalar(.5));e.add(t,m,h)}function Xu(e,t,n,r,i,a={}){let o=Bu.set(...n).clone(),s=Hu.set(...r).clone(),c=s.clone().sub(o),l=c.length();if(l<1e-4)return;c.divideScalar(l);let u=Math.abs(c.y)<.9?new U(0,1,0):new U(1,0,0),d=new U().crossVectors(c,u).normalize(),f=new U().crossVectors(d,c).normalize(),p=$l(i,l,a.c??Math.min(.035,i*.2),a.radial??16,{top:a.top,bottom:a.bottom}),m=new G().makeBasis(d,c,f).setPosition(o.add(s).multiplyScalar(.5));e.add(t,p,m)}function Zu(e,t,n,r,i,a={}){let o=new U(...i).normalize(),s=Math.abs(o.y)<.9?new U(0,1,0):new U(0,0,1),c=s.clone().addScaledVector(o,-s.dot(o)).normalize(),l=new U().crossVectors(o,c).normalize();if(a.spin){let e=new G().makeRotationAxis(o,a.spin);l.applyMatrix4(e),c.applyMatrix4(e)}let u=new G().makeBasis(l,o,c).setPosition(r[0],r[1],r[2]);e.add(t,n,u,{tint:a.tint})}function Qu(e,t,n={}){let r=new Hl,i=e.length,a=[...e,...t],o=a.reduce((e,t)=>[e[0]+t[0]/a.length,e[1]+t[1]/a.length,e[2]+t[2]/a.length],[0,0,0]),s=(e,t,n)=>{let i=t[0]-e[0],a=t[1]-e[1],s=t[2]-e[2],c=n[0]-e[0],l=n[1]-e[1],u=n[2]-e[2],d=a*u-s*l,f=s*c-i*u,p=i*l-a*c,m=Math.hypot(d,f,p);if(m<1e-9)return;d/=m,f/=m,p/=m;let h=(e[0]+t[0]+n[0])/3-o[0],g=(e[1]+t[1]+n[1])/3-o[1],_=(e[2]+t[2]+n[2])/3-o[2];d*h+f*g+p*_<0&&(d=-d,f=-f,p=-p),r.tri(e,t,n,[d,f,p])};for(let n=0;n<i;n++){let r=(n+1)%i;s(e[n],e[r],t[r]),s(e[n],t[r],t[n])}if(n.caps??!0)for(let n=1;n<i-1;n++)s(e[0],e[n],e[n+1]),s(t[0],t[n],t[n+1]);return r.done()}function $u(e,t,n,r=0){let i=qu(n),a=n;if(r){let e=n.reduce((e,t)=>[e[0]+t[0]/n.length,e[1]+t[1]/n.length,e[2]+t[2]/n.length],[0,0,0]);a=n.map(t=>[t[0]+(e[0]-t[0])*r,t[1]+(e[1]-t[1])*r,t[2]+(e[2]-t[2])*r])}let o=new Hl;for(let e=1;e<a.length-1;e++)o.tri(a[0],a[e],a[e+1],i);e.add(t,o.done(),void 0,{tint:0})}function ed(e,t,n,r,i,a,o=8,s=4){let c=new Hl,l=(e,t,n)=>[e*Math.sin(t)*Math.sin(n),e*Math.cos(t),e*Math.sin(t)*Math.cos(n)],u=(e,t)=>[Math.sin(e)*Math.sin(t),Math.cos(e),Math.sin(e)*Math.cos(t)];for(let e=0;e<o;e++){let d=i+(a-i)*e/o,f=i+(a-i)*(e+1)/o;for(let e=0;e<s;e++){let i=n+(r-n)*e/s,a=n+(r-n)*(e+1)/s;c.quad(l(t,i,d),l(t,i,f),l(t,a,f),l(t,a,d),u(i,d),u(i,f),u(a,f),u(a,d))}}let d=(e,t,n)=>[n*Math.cos(e)*Math.sin(t),-n*Math.sin(e),n*Math.cos(e)*Math.cos(t)],f=(e,t)=>[t*Math.cos(e),0,-t*Math.sin(e)];for(let s=0;s<o;s++){let u=i+(a-i)*s/o,f=i+(a-i)*(s+1)/o;n>1e-4&&c.quad(l(e,n,u),l(e,n,f),l(t,n,f),l(t,n,u),d(n,u,-1),d(n,f,-1),d(n,f,-1),d(n,u,-1)),c.quad(l(e,r,f),l(e,r,u),l(t,r,u),l(t,r,f),d(r,f,1),d(r,u,1),d(r,u,1),d(r,f,1))}if(a-i<Math.PI*2-1e-4)for(let o=0;o<s;o++){let u=n+(r-n)*o/s,d=n+(r-n)*(o+1)/s;c.quad(l(e,d,i),l(e,u,i),l(t,u,i),l(t,d,i),f(i,-1)),c.quad(l(e,u,a),l(e,d,a),l(t,d,a),l(t,u,a),f(a,1))}return c.done()}function td(e,t,n,r,i,a,o=6){let s=new Hl,c=(e,t,n)=>[e*Math.sin(n),t,e*Math.cos(n)],l=e=>[Math.sin(e),0,Math.cos(e)];for(let u=0;u<o;u++){let d=i+(a-i)*u/o,f=i+(a-i)*(u+1)/o;s.quad(c(t,r,d),c(t,r,f),c(t,n,f),c(t,n,d),l(d),l(f),l(f),l(d)),s.quad(c(e,r,d),c(e,r,f),c(t,r,f),c(t,r,d),[0,1,0]),s.quad(c(e,n,f),c(e,n,d),c(t,n,d),c(t,n,f),[0,-1,0])}let u=[-Math.cos(i),0,Math.sin(i)],d=[Math.cos(a),0,-Math.sin(a)];return s.quad(c(e,n,i),c(e,r,i),c(t,r,i),c(t,n,i),u),s.quad(c(e,r,a),c(e,n,a),c(t,n,a),c(t,r,a),d),s.done()}function nd(e,t,n,r=32,i={}){let a=new Hl,o=e/2,s=n/2,c=-n/2,l=i.c??.035,u=[0,1,0],d=(e,t)=>{let n=Math.sin(e),r=Math.cos(e),i=(o-t)/Math.max(Math.abs(n),Math.abs(r));return[n*i,r*i]};for(let e=0;e<r;e++){let n=e/r*Math.PI*2,o=(e+1)/r*Math.PI*2,f=[t*Math.sin(n),s,t*Math.cos(n)],p=[t*Math.sin(o),s,t*Math.cos(o)],m=d(n,l),h=d(o,l);a.quad(f,p,[h[0],s,h[1]],[m[0],s,m[1]],u);let g=[-Math.sin(n),0,-Math.cos(n)],_=[-Math.sin(o),0,-Math.cos(o)];a.quad([f[0],s,f[2]],[p[0],s,p[2]],[p[0],c,p[2]],[f[0],c,f[2]],g,_,_,g),i.floor&&a.tri([0,c+.001,0],[p[0],c+.001,p[2]],[f[0],c+.001,f[2]],u)}let f=[[o,0,1,0],[-o,0,-1,0],[0,o,0,1],[0,-o,0,-1]];for(let[e,t,n,r]of f){let i=-r,u=n,d=[e+i*o,s-l,t+u*o],f=[e-i*o,s-l,t-u*o],p=[d[0],c,d[2]],m=[f[0],c,f[2]];a.quad(d,f,m,p,[n,0,r]);let h=o-l,g=[e-n*l+i*h,s,t-r*l+u*h],_=[e-n*l-i*h,s,t-r*l-u*h];a.quad(g,_,f,d,[n*.7071,.7071,r*.7071])}return a.done()}function rd(e,t,n,r,i,a,o,s,c,l={}){let u=l.tile??2,d=l.hBody??.3,f=.012;for(let n=0;n<a-1e-6;n+=u){let l=Math.min(u,a-n);c?e.box(t,r+o/2,s+d/2,i+n+l/2,o-2*f,d,l-2*f,{c:.03,hide:{ny:!0}}):e.box(t,r+n+l/2,s+d/2,i+o/2,l-2*f,d,o-2*f,{c:.03,hide:{ny:!0}})}let p=l.bars??4*o-1,m=o*.8/(2*p-1),h=.4-d-.004;for(let t=0;t<p;t++){let l=-o*.4+m/2+t*2*m;c?e.box(n,r+o/2+l,s+d+h/2,i+a/2,m,h,a-.16,{c:.012,hide:{ny:!0}}):e.box(n,r+a/2,s+d+h/2,i+o/2+l,a-.16,h,m,{c:.012,hide:{ny:!0}})}}function id(e,t,n,r,i,a=.38,o=.4,s=16){e.cyl(t,n,r+o/2,i,a,o,{radial:s,c:.03,bottom:!1})}var ad=new Map;function od(e,t){e.traverse(e=>{let n=e;if(!n.isMesh)return;let r=n.material,i=t.find(e=>r.name===`lego:${e}`);if(!i)return;let a=ad.get(i);a||(a=r.clone(),a.name=`lego:${i}:satin`,a.metalness=.45,a.roughness=.3,ad.set(i,a)),n.material=a})}var sd=e=>[-e[0],e[1],e[2]],cd=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],ld=Math.PI/180,ud=21*ld,dd=5.5,fd=[0,.6,.6],pd=[4,1.3,1.5],md=[0,2.62,-3.62],hd=[0,0,7],gd=[1.55,.1,-12.62],_d=[2.25,-.1,13.9],vd=22*ld,yd=e=>4.856+(1.6-e)*Math.tan(vd),bd={main:`yellow`,alt:`yellow`,struct:`lbg`,struct2:`dbg`,pod:`lbg`,frame:`lbg`,rim:`dbg`,gun:`dbg`,grille:`black`,under:`dbg`,belly:`lbg`,dark:`black`,seat:`black`,metal:`flatSilver`},xd={main:`red`,alt:`darkRed`,struct:`white`,struct2:`lbg`,pod:`lbg`,frame:`lbg`,rim:`dbg`,gun:`dbg`,grille:`dbg`,under:`dbg`,belly:`lbg`,dark:`black`,seat:`black`,metal:`flatSilver`},Sd=[[1.95,-1.5],[1.95,2.3],[1.3,3.9],[-1.3,3.9],[-1.95,2.3],[-1.95,-1.5]],Cd=[[2.5,-9],[2.5,2.5],[1.6,3.9],[-1.6,3.9],[-2.5,2.5],[-2.5,-9]],wd=[[2.5,-9],[2.5,2.8],[1.6,3.9],[-1.6,3.9],[-2.5,2.8],[-2.5,-9]],Td=[[2.5,-9],[2.5,3.1],[1.6,3.9],[-1.6,3.9],[-2.5,3.1],[-2.5,-9]],Ed=e=>1.6-.3*(e-3.9),Dd=[[1.6,1.6,3.9],[Ed(yd(1.6)),1.6,yd(1.6)],[-Ed(yd(1.6)),1.6,yd(1.6)],[-1.6,1.6,3.9]],Od=[[1.6,-1.2,3.9],[Ed(yd(-1.2)),-1.2,yd(-1.2)],[-Ed(yd(-1.2)),-1.2,yd(-1.2)],[-1.6,-1.2,3.9]],kd=[[2.5,3],[5.5,3],[5.5,7],[3.3,12.4],[2.5,12.4]],Ad=[[5.5,-12],[10.5,-7.5],[10.5,.5],[5.5,6]],jd=Pu(Ad,1),Md=e=>Fu(jd[0],jd[1],e),Nd=e=>Fu(jd[3],jd[2],e),Pd=[-10.8,-6.4,-2,2.4],Fd=[-8.6,-4.2,.2,4.4],Id=2.75,Ld=(()=>{let e=Math.cos(vd),t=Math.sin(vd),n=(n,r)=>[n,3.1+r*e,4.25-r*t],r=e=>[n(1.7*e,.6*e),n(.7*e,1.45*e),n(-.7*e,1.45*e),n(-1.7*e,.6*e),n(-1.7*e,-.6*e),n(-.7*e,-1.45*e),n(.7*e,-1.45*e),n(1.7*e,-.6*e)],i=(e,t)=>[2.5-(e-1.6)/(4.05-1.6)*.25,e,t],a=[1.5,1.6,-3.3],o=[.7,3.05,-3.75];return{W:r(1),Wi:r(.3),N:[0,t,e],Mt:[1.1,4.95,2.3],Md:[2.25,4.05,2.3],Mw:i(Id,2.3),Ms:[2.5,1.6,2.3],Rt:[1.1,4.95,-.9],Rd:[2.25,4.05,-.9],Rw:i(Id,-.9),Rs:[2.5,1.6,-.9],Tt:o,Ts:a,Tw:cd(a,o,1.15/(3.05-1.6)),Sf:[.9,1.6,yd(1.6)]}})();function Rd(e){let t=e.variant===`anakin`?bd:xd,n=e.lod!==1,r=e.variant===`anakin`?7521:7513,i=`eta2-${e.variant}${n?``:`-lod1`}`,a=new sn;a.name=i;let o=e=>new Y({seed:r+e,studSegments:n?14:8}),s=o(0);Kd(s,t,n),qd(s,t,n);for(let e of[1,-1])s.push(),e<0&&s.mirrorX(),Xd(s,t,n,e>0),Jd(s,t,n),s.pop();ef(s,t,n),$d(s,t,n),Zd(s,t,n),a.add(s.build(`${i}:hull`).group);let c=zd(a,`nose`,hd),l=o(1);for(let e of[1,-1])l.push(),e<0&&l.mirrorX(),Qd(l,t,n),l.pop();c.inner.add(l.build(`${i}:nose`).group);let u=[1,-1].map(e=>Eu(e>0?`muzzlePort`:`muzzleStarboard`,c.pivot,e*_d[0]-hd[0],_d[1]-hd[1],_d[2]-hd[2])),d=zd(a,`canopy`,md),f=o(2);tf(f,t,n),d.inner.add(f.build(`${i}:canopy`).group);let p=Bd(Ad),m=[],h=[];for(let e of[1,-1])for(let r of[!0,!1]){let s=r?.8:-.8,c=new on;c.name=`foilHinge${e>0?`Port`:`Starboard`}${r?`Upper`:`Lower`}`,c.position.set(e*dd,s,0),a.add(c);let l=[e*p[0],r?.4:-.4,p[1]],u=new on;u.name=`wing${e>0?`Port`:`Starboard`}${r?`Upper`:`Lower`}`,u.position.set(l[0]-e*dd,l[1]-s,l[2]),c.add(u);let d=o(10+(e>0?0:2)+ +!r);d.push(),e<0&&d.mirrorX(),r||d.scale(1,-1,1),nf(d,t,n,r),d.pop();let f=d.build(`${i}:${u.name}`).group;f.position.set(-l[0],-l[1],-l[2]),u.add(f),m.push({pivot:c,sign:e*(r?1:-1)}),h.push(u)}let g=new Y({seed:r+30,tint:0});for(let e of[1,-1])g.push(),g.translate(e*gd[0],gd[1],0),Yd(g,n),g.pop();let _=g.build(`${i}:engineGlow`).group;_.position.z=-12.15;let v=[];_.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material.clone();t.material=n,v.push({m:n,c:n.color.clone()})}),a.add(_);let y=[1,-1].map(e=>{let t=Eu(e>0?`enginePort`:`engineStarboard`,a,e*gd[0],gd[1],gd[2]);return t.rotation.y=Math.PI,t}),b=e=>{let t=Math.max(0,Math.min(1,e))*ud;for(let e of m)e.pivot.rotation.z=t*e.sign},x=e=>{let t=Math.max(0,Math.min(1,e));_.scale.set(1,1,.3+.7*t);for(let e of v)e.m.color.copy(e.c).multiplyScalar(.04+.96*t)};return b(0),x(1),{group:a,setFoils:b,setEngine:x,cockpitAnchor:Eu(`cockpit`,a,...fd),astromechAnchor:Eu(`astromech`,a,...pd),canopy:d.pivot,muzzles:u,engines:y,breakables:[...h,c.pivot],length:_d[2]-gd[2]}}function zd(e,t,n){let r=new on;r.name=t,r.position.set(...n),e.add(r);let i=new on;return i.position.set(-n[0],-n[1],-n[2]),r.add(i),{pivot:r,inner:i}}function Bd(e){let t=0,n=0,r=0;for(let i=0;i<e.length;i++){let[a,o]=e[i],[s,c]=e[(i+1)%e.length],l=a*c-s*o;t+=l,n+=(a+s)*l,r+=(o+c)*l}return[n/(3*t),r/(3*t)]}var Vd=e=>e,Hd=(e,t)=>[(e[0]+t[0])/2,(e[1]+t[1])/2,(e[2]+t[2])/2];function X(e,t,n,r,i){Lu(e,t,n,r,i,{hideBottom:!1})}function Ud(e,t,n,r,i,a){e.push(),e.translate((r+i)/2,0,0),e.rotateY(-Math.PI/2),e.prism(t,n,Math.abs(i-r),{c:a}),e.pop()}function Wd(e,t,n,r,i,a,o,s,c){e.add(t,eu(a,o,s,.02,c),new G().makeTranslation(n,r,i).multiply(new G().makeRotationX(Math.PI/2)))}function Gd(e,t,n,r,i,a,o,s,c,l=.05){let u=o/s;for(let d=0;d<s;d++){let s=r-o/2+u*(d+.5);c===`x`?e.box(t,n,s,i,a,u*.5,l,{c:.01}):e.box(t,n,s,i,l,u*.5,a,{c:.01})}}function Kd(e,t,n){X(e,t.under,Mu(-1.9,-11,1.9,3.6),-1.6,.8);for(let n of[1,-1])e.push(),n<0&&e.mirrorX(),e.prism(t.under,[[1.9,-1.6],[2.5,-.8],[1.9,-.8]],14.6,{zc:-3.7}),e.pop();Ud(e,t.under,[[3.6,-1.6],[4.6,-1.2],[3.6,-1.2]],-1.6,1.6),Ud(e,t.under,[[-11.7,-1.4],[-11,-1.6],[-11,-.8],[-11.7,-.8]],-1.9,1.9);for(let[r,i]of[[-10.4,-6.6],[-6.2,-2.4],[-2,3.2]])for(let a of[1,-1])e.box(t.belly,a*.78,-1.63,(r+i)/2,1.3,.06,i-r,{c:n?.02:0});if(n){for(let n=-9.6;n<2.6;n+=.5)e.box(t.dark,0,-1.64,n,.14,.04,.3,{c:.01});e.cyl(t.metal,0,-1.7,-4.4,.34,.12,{radial:20}),e.cyl(t.dark,0,-1.78,-4.4,.2,.06,{radial:16})}X(e,t.under,Td,-.8,.4);for(let n of Nu(Td,Sd))for(let r of Iu(n,[-5]))X(e,t.struct,r,-.4,.8);for(let n of Nu(wd,Sd))for(let r of Iu(n,[-5]))X(e,t.main,r,.4,.8);for(let n of Nu(Cd,Sd))for(let r of Iu(n,[-5.5]))X(e,t.main,r,1.2,.4);if(n)for(let n of[1,-1]){for(let r=-8.5;r<=-3.5;r+=1)e.stud(t.main,n*2,1.6,r);Gd(e,t.grille,n*2.53,1.2,-6.4,3.2,.56,4,`z`,.06),e.box(t.struct2,n*2.51,1.2,-6.4,.04,.66,3.4,{c:.01});for(let r of[-3.9,-8.7])e.cyl(t.struct2,n*2.55,1.2,r,.2,.1,{axis:`x`,radial:12});e.box(t.struct,n*2.52,1.02,.7,.05,.12,3.4,{c:.02})}if(X(e,t.struct,Mu(-1.5,-11.4,1.5,-3),1.6,.4),X(e,t.main,Mu(-.5,-11,.5,-3.2),2,.4),Ud(e,t.struct,[[-12,1.6],[-11.4,1.6],[-11.4,2]],-1.5,1.5),Ud(e,t.main,[[-11.4,2],[-11,2],[-11,2.4]],-.5,.5),n){for(let n of[1,-1])for(let r=-10.5;r<=-4.5;r+=1)e.stud(t.struct,n*1,2,r);for(let n=-10.5;n<=-4.5;n+=1)e.stud(t.main,0,2.4,n);e.cyl(t.struct2,0,2.47,-9.5,.16,.14,{radial:12}),Xu(e,t.metal,[0,2.5,-9.5],[0,3.35,-9.8],.04,{radial:8})}if(e.box(t.struct2,0,2.43,md[2],1,.06,.5,{c:.02}),e.cyl(t.struct2,0,md[1],md[2],.18,1.3,{axis:`x`,radial:n?16:8}),X(e,t.under,Mu(-3,-12,3,-9),-1.4,.6),X(e,t.struct2,Mu(-3,-12,3,-9),-.8,1.6),X(e,t.struct,Mu(-3,-12,3,-9),.8,.4),X(e,t.main,Mu(-3,-12,3,-9),1.2,.4),n){for(let n of[1,-1]){for(let r of[-11.5,-10.5,-9.5])e.stud(t.main,n*2,1.6,r);Gd(e,t.grille,n*3.03,1.2,-10.5,2.4,.6,3,`z`,.06)}e.box(t.struct2,0,1.3,-12.03,2.6,.5,.06,{c:.01}),Gd(e,t.grille,0,1.3,-12.07,2.4,.42,3,`x`,.06);for(let n=-1.2;n<=1.21;n+=.4)e.box(t.dark,n,-1.465,-10.5,.16,.03,1.8,{c:.005})}e.box(t.belly,0,-1.43,-10.5,3.2,.06,2.2,{c:n?.02:0})}function qd(e,t,n){let r=e=>{let t=(e+1.2)/2.8;return Dd.map((n,r)=>{let i=Od[r];return[i[0]+(n[0]-i[0])*t,e,i[2]+(n[2]-i[2])*t]})},i=[[t.under,-1.2,-.4],[t.struct,-.4,.4],[t.main,.4,1.6]];for(let[t,n,a]of i)e.add(t,Qu(r(n),r(a)));e.push(),e.translate(0,0,yd(0)),e.rotateX(-vd),e.box(t.struct2,0,0,.012,1.9,.64,.03,{c:n?.01:0});for(let r of[-.2,0,.2])e.box(t.grille,0,r,.04,1.7,.1,.05,{c:n?.01:0});if(e.pop(),n){e.cyl(t.metal,0,-1.25,5.1,.34,.1,{radial:20}),e.cyl(t.dark,0,-1.32,5.1,.2,.05,{radial:16});for(let n of[1,-1])e.box(t.belly,n*.9,-1.22,4.6,.5,.04,1,{c:.01})}}function Jd(e,t,n){let[r,i]=gd,a=n?32:14;if(e.cyl(t.struct2,r,i,-12.3,1.12,.6,{axis:`z`,radial:a,bottom:!1}),Wd(e,t.metal,r,i,-12.58,1.16,.86,.1,a),n&&Wd(e,t.dark,r,i,-12.36,1.15,1.08,.08,a),e.lathe(t.dark,Xl([[.87,-12.6],[.74,-12.4],[.6,-12.16]]),{axis:`z`,at:[r,i,0],radial:a}),n)for(let n=0;n<6;n++){let a=n/6*Math.PI*2;e.box(t.struct2,r+Math.sin(a)*.72,i+Math.cos(a)*.72,-12.4,.06,.06,.4,{rot:[0,0,-a],c:.01})}}function Yd(e,t){let n=t?28:12;e.lathe(`glowEngine`,Xl([[.45,-.01],[.36,-.08],[.2,-.14],[0,-.16]]),{axis:`z`,radial:n}),e.lathe(`glowOrange`,Xl([[.6,-.005],[.45,-.005]]),{axis:`z`,radial:n})}function Xd(e,t,n,r){let i=Mu(3,-12,5.5,-9),a=Mu(2.5,-9,5.5,3);X(e,t.under,i,-.8,.4),X(e,t.under,a,-.8,.4);let o=n?5.3:5.5;if(X(e,t.struct2,Mu(3,-12,o,-9),-.4,.8),X(e,t.struct2,Mu(2.5,-9,o,3),-.4,.8),n)for(let n=-11.7;n<2.8;n+=.42)e.box(t.metal,5.4,0,n,.2,.72,.07,{c:.01});if(n?rd(e,t.grille,t.grille,3,-12,3,2.5,.4,!0,{bars:7}):X(e,t.grille,i,.4,.4),X(e,t.main,Mu(2.5,-9,5.5,-5),.4,.4),n)for(let n of[3,4,5])for(let r=-8.5;r<=-5.5;r+=1)e.stud(t.main,n,.8,r);if(X(e,t.main,Mu(2.5,-5,4.5,-2.5),.4,.4),X(e,t.alt,Mu(2.5,-2.5,4.5,0),.4,.4),X(e,t.main,Mu(4.5,-5,5.5,-4),.4,.4),n?(e.stud(t.main,5,.8,-4.5),rd(e,t.grille,t.grille,4.5,-4,4,1,.4,!0),id(e,t.struct2,3.5,.8,-3.75,.36,.08,16),e.cyl(t.metal,3.5,.9,-3.75,.16,.04,{radial:12})):X(e,t.grille,Mu(4.5,-4,5.5,0),.4,.4),!r&&(X(e,t.main,Mu(2.5,0,5.5,3),.4,.4),n)){for(let n of[3,5])for(let r of[.5,1.5,2.5])e.stud(t.main,n,.8,r);X(e,t.struct,Mu(3.55,.05,4.45,2.95),.8,.12),e.box(t.struct2,4,.93,1.5,.3,.02,1.6,{c:.005})}if(n&&(e.cyl(t.struct2,4.25,0,-12.12,.34,.24,{axis:`z`,radial:16}),e.cyl(t.dark,4.25,0,-12.25,.22,.03,{axis:`z`,radial:14}),Gd(e,t.grille,3.45,0,-12.03,.7,.5,3,`x`,.05),e.box(t.dark,4,-.865,-4.2,.06,.02,3,{c:.005}),e.box(t.dark,4,-.865,-5.75,2,.02,.06,{c:.005})),e.box(t.belly,4,-.83,-4.2,2.1,.06,3.2,{c:n?.02:0}),n)for(let n of[.8,-.8])for(let r of Pd)e.cyl(t.struct2,dd,n,r,.2,.8,{axis:`z`,radial:14})}function Zd(e,t,n){let[r,,i]=pd,a=n?44:20;if(e.add(t.struct,nd(3,1.12,.4,a),new G().makeTranslation(r,.6,i)),e.cyl(t.dark,r,.44,i,1.13,.04,{radial:a,bottom:!1}),e.add(t.struct2,eu(1.36,1.12,.2,.03,a),new G().makeTranslation(r,.9,i)),n){for(let n=0;n<8;n++){let a=n/8*Math.PI*2+Math.PI/8;e.cyl(t.metal,r+Math.sin(a)*1.24,1.03,i+Math.cos(a)*1.24,.06,.06,{radial:8})}for(let[n,a]of[[1,1],[1,-1],[-1,1],[-1,-1]])id(e,t.struct2,r+n*1.16,.8,i+a*1.16,.2,.08,12);e.add(t.dark,eu(1.12,1.02,.06,.01,a),new G().makeTranslation(r,.98,i)),Xu(e,t.dark,[2.92,.86,.35],[2.56,1.3,0],.06,{radial:8})}}function Qd(e,t,n){let r=e=>e<=7?5.5:5.5-(e-7)*2.2/5.4;if(X(e,t.under,kd,-.8,.4),n){X(e,t.struct,Au(kd,2.5,5.3,3,5.8),-.4,.8),X(e,t.struct,Au(kd,2.5,4.8,5.8,7.6),-.4,.8),X(e,t.struct,ku(kd,0,-1,-7.6),-.4,.8);for(let n=3.3;n<5.6;n+=.42)e.box(t.metal,5.4,0,n,.2,.72,.07,{c:.01})}else X(e,t.struct,kd,-.4,.8);if(e.box(t.belly,3.4,-.83,7.5,.8,.06,5,{c:n?.02:0}),X(e,t.main,Mu(2.5,3,5.5,6),.4,.4),n)for(let n of[3,4,5])for(let r of[3.5,4.5,5.5])e.stud(t.main,n,.8,r);X(e,t.main,Au(kd,2.5,3.5,6,11.4),.4,.4),n?rd(e,t.grille,t.grille,3.5,6,3,1,.4,!0):X(e,t.grille,Mu(3.5,6,4.5,9),.4,.4),X(e,t.main,Au(kd,3.5,4.5,9,11.4),.4,.4),X(e,t.struct,Au(kd,4.5,5.5,6,11.4),.4,.4),n&&e.stud(t.struct,5,.8,6.5),X(e,t.main,ku(kd,0,-1,-11.4),.4,.2),Ud(e,t.main,[[11.4,.6],[12.35,.6],[11.4,.8]],2.5,r(12.4)-.02);let[i,a,o]=_d,s=n?20:8;if(e.cyl(t.gun,i,a,6,.42,5.2,{axis:`z`,radial:s,top:!1,bottom:!1}),e.lathe(t.gun,Xl([[0,8.9],[.2,8.9],[.32,8.85],[.42,8.6]]),{axis:`z`,at:[i,a,0],radial:s}),e.lathe(t.gun,Xl([[.42,3.4],[.32,3.15],[.2,3.1],[0,3.1]]),{axis:`z`,at:[i,a,0],radial:s}),n)for(let n of[4.2,5.4,6.6,7.8])e.cyl(t.metal,i,a,n,.45,.14,{axis:`z`,radial:s});if(e.cyl(t.metal,i,a,(8.85+o-.55)/2,.14,o-.55-8.85,{axis:`z`,radial:n?14:6}),n)for(let t of[9.6,10.9,12.2])e.cyl(`black`,i,a,t,.2,.16,{axis:`z`,radial:14});if(Wd(e,`black`,i,a,o-.3,.21,.1,.6,n?16:8),e.box(t.gun,i+.25,a,8.3,.3,.3,.5,{c:.03}),e.box(t.gun,5.05,-.05,6.7,.5,.62,1.8,{c:.04}),n){e.box(t.metal,5.31,-.05,6.7,.04,.3,1.2,{c:.01});for(let n of[6.2,6.6,7])e.box(t.dark,5.32,.14,n,.03,.08,.2,{c:.005})}e.cyl(t.metal,5.05,-.05,8.6,.1,2,{axis:`z`,radial:n?12:6}),e.cyl(`black`,5.05,-.05,9.75,.14,.3,{axis:`z`,radial:n?12:6})}function $d(e,t,n){let[,r,i]=fd,a=r-.45;e.box(t.struct2,0,(-.4+a-.2)/2,i+.05,1.9,a-.2+.4,1.2,{hide:{ny:!0}}),e.box(t.seat,0,a-.1,i+.05,1.84,.2,1.16,{c:.06}),e.box(t.seat,0,a+1.05,i-.64,1.8,2.1,.3,{c:.06}),e.box(t.seat,0,r+2.2,i-.95,1.1,1,.3,{c:.08}),e.box(t.struct2,0,r+1.6,i-.95,.36,.3,.2);for(let n of[1,-1])e.box(t.struct2,n*1.06,.2,i+.1,.12,1.2,1.3);for(let r of[1,-1])e.box(t.struct2,r*1.64,.35,.4,.6,1.5,3.8,{hide:{ny:!0}}),n&&(rd(e,t.grille,t.grille,r>0?1.44:-1.84,-1.3,1.6,.4,1.1,!0,{bars:3}),[`glowRed`,`glowGreen`,`glowYellow`].forEach((t,n)=>id(e,t,r*1.64,1.1,.9+n*.4,.1,.06,10)),Xu(e,`black`,[r*1.64,1.1,.35],[r*1.64,1.55,.5],.04,{radial:8}),e.cyl(t.metal,r*1.64,1.58,.51,.08,.1,{radial:10}),Xu(e,`black`,[r*.8,1.6,1.8],[r*1.3,1.6,1.8],.09,{radial:10}),Xu(e,t.struct2,[r*1.22,1.6,1.8],[r*1.22,1.05,2.4],.07,{radial:8}),e.cyl(t.metal,r*1.34,1.6,1.8,.1,.06,{axis:`x`,radial:10}));if(Ud(e,t.struct2,[[2.25,-.4],[3.95,-.4],[3.95,1.72],[2.95,1.72],[2.25,1.1]],-1.3,1.3),n){e.push(),e.translate(0,(1.1+1.72)/2,5.2/2),e.rotateX(-Math.atan2(.62,.7)),e.box(`black`,0,.005,0,2.3,.03,.78,{c:.01}),e.box(`windowCool`,0,.03,.05,.7,.02,.36,{c:.005}),[`glowRed`,`glowGreen`,`glowBlue`,`glowYellow`,`glowRed`,`glowGreen`].forEach((t,n)=>{id(e,t,n<3?-.95+n*.2:.55+(n-3)*.2,.02,.18,.07,.04,10)});for(let n of[-.8,.8])e.box(t.metal,n,.03,-.2,.44,.02,.16,{c:.005});e.pop(),e.box(t.struct2,0,1.76,3.45,1.6,.08,.9,{c:.02})}e.box(t.struct2,0,.5,-.9,3.6,1.8,1.1,{hide:{ny:!0}}),n&&(rd(e,t.grille,t.grille,-1,-1.4,2,1,1.4,!1),id(e,`glowBlue`,1.35,1.4,-.9,.12,.06,10),id(e,t.metal,-1.35,1.4,-.9,.2,.1,12))}function ef(e,t,n){let r=Ld,i=r.W,a=sd,o=.14;for(let n of[Vd,a])Ju(e,t.pod,[n(r.Mw),n(r.Ms),n(r.Rs),n(r.Rw)],o,{side:0}),Ju(e,t.pod,[n(r.Mw),n(i[7]),n(r.Ms)],o,{side:0}),Ju(e,t.pod,[n(r.Ms),n(i[7]),n(r.Sf)],o,{side:0}),Ju(e,t.pod,[n(i[7]),n(i[6]),n(r.Sf)],o,{side:0}),Ju(e,t.pod,[n(r.Rw),n(r.Rs),n(r.Ts)],o,{side:0}),Ju(e,t.pod,[n(r.Rw),n(r.Ts),n(r.Tw)],o,{side:0});Ju(e,t.pod,[i[6],i[5],a(r.Sf),r.Sf],o,{side:0}),Ju(e,t.pod,[r.Ts,r.Tw,a(r.Tw),a(r.Ts)],o,{side:0});let s=[0,2.6,.7],c=(n,r)=>{let i=Hd(n,r);Yu(e,t.frame,n,r,.22,.2,[i[0]-s[0],i[1]-s[1],i[2]-s[2]],{ext:.11})},l=(n,r)=>Yu(e,t.frame,[n[0],1.7,n[2]],[r[0],1.7,r[2]],.32,.2,[0,1,0],{ext:.16});for(let e of[Vd,a])c(e(r.Ms),e(r.Mw)),c(e(r.Rs),e(r.Rw)),l(e(r.Sf),e(r.Ms)),l(e(r.Ms),e(r.Rs)),l(e(r.Rs),e(r.Ts));if(l(r.Sf,a(r.Sf)),n){for(let n of[1,-1])e.box(t.struct2,n*2.535,2.16,-.05,.03,.62,1.3,{c:.01}),Gd(e,t.grille,n*2.56,2.16,-.05,1.1,.5,3,`z`,.05),e.cyl(t.struct2,n*2.55,2.18,1.45,.3,.08,{axis:`x`,radial:16}),e.cyl(t.metal,n*2.6,2.18,1.45,.14,.04,{axis:`x`,radial:12});e.box(t.rim,0,1.7,yd(1.7)+.05,.5,.12,.12,{c:.03})}}function tf(e,t,n){let r=Ld,i=r.W,a=r.Wi,o=sd;$u(e,`trClear`,i),$u(e,`trClear`,[r.Mt,o(r.Mt),i[2],i[1]]),$u(e,`trClear`,[r.Mt,o(r.Mt),o(r.Rt),r.Rt]),$u(e,`trClear`,[r.Rt,o(r.Rt),o(r.Tt),r.Tt]);for(let t of[Vd,o])$u(e,`trClear`,[t(r.Mt),t(i[1]),t(i[0]),t(r.Md)]),$u(e,`trClear`,[t(r.Md),t(i[0]),t(i[7]),t(r.Mw)]),$u(e,`trClear`,[t(r.Mt),t(r.Md),t(r.Rd),t(r.Rt)]),$u(e,`trClear`,[t(r.Md),t(r.Mw),t(r.Rw),t(r.Rd)]);let s=.14;for(let n of[Vd,o])Ju(e,t.pod,[n(r.Rt),n(r.Rd),n(r.Tt)],s,{side:0}),Ju(e,t.pod,[n(r.Rd),n(r.Rw),n(r.Tw)],s,{side:0}),Ju(e,t.pod,[n(r.Rd),n(r.Tw),n(r.Tt)],s,{side:0});Ju(e,t.pod,[r.Tw,r.Tt,o(r.Tt),o(r.Tw)],s,{side:0});for(let n=0;n<8;n++)Yu(e,t.rim,i[n],i[(n+1)%8],.26,.26,r.N,{ext:.13});for(let n=0;n<8;n++)Yu(e,t.rim,a[n],a[(n+1)%8],.11,.16,r.N,{ext:.055});for(let n of[0,2,4,6])Yu(e,t.rim,Hd(a[n],a[n+1]),Hd(i[n],i[n+1]),.11,.16,r.N);let c=[0,2.6,.7],l=(n,r,i=.22,a=.2)=>{let o=Hd(n,r);Yu(e,t.frame,n,r,i,a,[o[0]-c[0],o[1]-c[1],o[2]-c[2]],{ext:i/2})};for(let e of[Vd,o])l(e(r.Mw),e(r.Md)),l(e(r.Md),e(r.Mt)),l(e(r.Rw),e(r.Rd)),l(e(r.Rd),e(r.Rt)),l(e(r.Mt),e(r.Rt),.26,.22),l(e(r.Md),e(r.Rd)),l(e(r.Mt),e(i[1])),l(e(r.Md),e(i[0])),l(e(i[7]),e(r.Mw),.26,.18),l(e(r.Mw),e(r.Rw),.26,.18),l(e(r.Rw),e(r.Tw),.26,.18),l(e(r.Rt),e(r.Tt),.26,.22),l(e(r.Tw),e(r.Tt));if(l(r.Mt,o(r.Mt)),l(r.Rt,o(r.Rt)),l(r.Tt,o(r.Tt)),n){for(let n of[1,-1])e.box(t.frame,n*.45,md[1]+.12,md[2]-.02,.2,.3,.36,{c:.03});e.cyl(t.rim,0,5.02,.7,.14,.1,{radial:12})}}function nf(e,t,n,r){let i=Nu(Ad,jd),[a,o,s,c]=i;for(let n of i)X(e,t.struct2,n,0,.4);X(e,t.dark,jd,.12,.28);for(let r=6.72;r<9.45;r+=.3){let i=Md(r)+.1,a=Nd(r)-.1;e.box(t.main,r,.075,(i+a)/2,.07,.09,a-i,{c:n?.015:0})}for(let r of[-4.8,-1.6])e.box(t.struct2,8,.08,r,2.98,.08,.14,{c:n?.02:0});let l=r?t.main:t.under;for(let n of Iu(c,[-7,-3,1]))X(e,r?t.struct:t.under,n,.4,.4);for(let n of Iu(a,[],[8]))X(e,r?t.struct2:t.under,n,.4,.4);X(e,l,o,.4,.4);for(let n of Iu(s,[],[8]))X(e,t.main,n,.4,.4);let u=ku(jd,0,1,-7),d=ku(jd,0,-1,2);for(let n of Iu(u,[],[7.5,8.5]))X(e,r?t.struct2:t.under,n,.4,.4);if(n)for(let n=0;n<3;n++)rd(e,t.grille,t.grille,6.5+n,-7,4,1,.4,!0);else X(e,t.grille,Mu(6.5,-7,9.5,-3),.4,.4);X(e,r?t.struct:t.belly,Mu(6.5,-3,9.5,-2),.4,.4);for(let t of Iu(d,[],[7.5,8.5]))X(e,l,t,.4,.4);if(r&&n){zu(e,t.struct,c,.8),zu(e,t.main,o,.8);for(let n of[7,8,9])e.stud(t.struct,n,.8,-2.5);zu(e,t.main,d,.8)}if(n)for(let n of Fd)e.cyl(t.struct2,dd,.8,n,.2,.8,{axis:`z`,radial:14})}var rf=3.08,af=.95,of=.955,sf=.07,cf=Math.PI/180,lf={body:`white`,accent:`blue`,dome:`metalSilver`,domeAccent:`blue`,trim:`lbg`,metal:`flatSilver`,eyeLight:`glowRed`,holo:`glowBlue`,logicA:`glowBlue`,logicB:`glowRed`},uf={body:`white`,accent:`red`,dome:`red`,domeAccent:`flatSilver`,trim:`lbg`,metal:`flatSilver`,eyeLight:`glowRed`,holo:`glowWhite`,logicA:`glowRed`,logicB:`glowYellow`};function df(e){let t=e.variant===`r2d2`?lf:uf,n=e.lod===1,r=n?20:44,i=e.variant===`r2d2`?22:417,a=new sn;a.name=`astromech-${e.variant}${e.socket?`-socket`:``}`;let o=new on;o.name=`droid`,o.position.y=e.socket?0:rf,a.add(o);let s=new Y({seed:i,studSegments:n?8:14});ff(s,t,!!e.socket,r,n),o.add(s.build(`${a.name}:body`).group);let c=new on;c.name=`head`,o.add(c);let l=new Y({seed:i+1,studSegments:n?8:14});e.variant===`r2d2`?gf(l,t,r,n):yf(l,t,r,n),c.add(l.build(`${a.name}:dome`).group);let u=new Y({seed:i+2,tint:0}),d=[];e.variant===`r2d2`?_f(u,t):bf(u,t);let f=u.build(`${a.name}:lights`).group;return f.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material.clone();t.material=n,d.push({m:n,c:n.color.clone()})}),c.add(f),od(o,[`metalSilver`,`flatSilver`]),{group:a,head:c,setHeadYaw:e=>c.rotation.y=e,setLights(e){let t=.12+.88*Math.max(0,Math.min(1,e));for(let e of d)e.m.color.copy(e.c).multiplyScalar(t)},zapAnchor:e.socket?Eu(`zap`,o,0,.09000000000000001,.985):Eu(`zap`,o,0,-.78,1.01)}}function ff(e,t,n,r,i){let a=af;e.lathe(t.trim,Xl([[.85,sf],[.98,sf],[.995,sf*.5],[.98,0],[.85,0]],40),{radial:r});let o=n?-.55:-1.86;if(e.lathe(t.body,Xl([[.75,0],[a,-.03],[a,o+(n?0:.04)],...n?[[0,o]]:[[.9099999999999999,o]]],40),{radial:r}),e.cyl(`dbg`,0,-.005,0,.8899999999999999,.05,{radial:r,bottom:!1}),e.lathe(t.trim,Xl([[.3,.05],[.62,.05],[.64,.035],[.64,0]],40),{radial:i?16:32}),e.cyl(t.metal,0,.03,0,.22,.06,{radial:i?12:20}),!i)for(let t=0;t<5;t++){let n=t/5*Math.PI*2+.3;e.cyl(t%2?`red`:`blue`,Math.sin(n)*.45,.04,Math.cos(n)*.45,.05,.08,{radial:8})}let s=(t,r,i,s,c,l=.016)=>{if(n&&i<o+.02)return;let u=Math.max(r,o+.01);e.add(t,td(.9299999999999999,a+l,u,i,s*cf,c*cf,Math.max(2,Math.round((c-s)/7))))};for(let e=0;e<12;e++){let n=e*30;s(e%3==0?t.accent:t.metal,-.2,-.07,n-11,n+11,.012)}if(s(t.accent,-1,-.3,-40,-16),s(t.accent,-1,-.3,16,40),s(t.metal,-.68,-.3,-11,11,.02),s(t.accent,-1.24,-1.08,-34,34),s(t.metal,-1.62,-1.34,-24,-6,.02),s(t.metal,-1.62,-1.34,6,24,.02),!i&&!n){for(let e of[-19,-15,-11,11,15,19])s(`dbg`,-1.58,-1.38,e-.9,e+.9,.028);for(let e of[-.62,-.52,-.42])s(`dbg`,e,e+.05,-8,8,.03)}if(s(t.accent,-1.3,-.35,146,170),s(t.accent,-1.3,-.35,190,214),s(t.metal,-1.62,-1.42,160,200,.02),s(t.accent,-1.5,-1.1,58,78),s(t.accent,-1.5,-1.1,282,302),!n){e.lathe(t.trim,Xl([[.9099999999999999,o],[.87,o-.05],[.72,-2.06],[0,-2.06]],40),{radial:r}),e.box(t.trim,0,-2.3,.02,.44,.5,.5,{c:.05}),e.box(t.body,0,-2.62,.08,.5,.2,.66,{c:.06}),e.box(t.accent,0,-2.3,.28,.26,.28,.02,{c:.01});for(let n of[1,-1])e.cyl(t.trim,n*1.02,-.46,0,.36,.16,{axis:`x`,radial:i?12:24}),pf(e,t,n*1.25,n,i)}}function pf(e,t,n,r,i){e.push(),e.translate(n,0,0),e.rotateY(-Math.PI/2),e.prism(t.body,[[-.33,-.18],[.33,-.18],[.37,-2.52],[-.37,-2.52]],.3,{c:.045}),e.pop();let a=n+r*.155;if(e.box(t.accent,a+r*.005,-1.35,0,.02,.9,.36,{c:.008}),e.box(t.metal,a+r*.008,-2,0,.02,.26,.4,{c:.008}),e.cyl(t.trim,a+r*.05,-.46,0,.33,.1,{axis:`x`,radial:i?12:24}),e.cyl(t.accent,a+r*.105,-.46,0,.18,.02,{axis:`x`,radial:i?10:20}),!i){for(let t of[-.1,0,.1])e.box(`dbg`,a+r*.012,-2,t,.02,.18,.035,{c:.005});e.box(t.metal,a+r*.01,-.95,0,.02,.1,.3,{c:.005})}e.cyl(t.trim,n,-2.56,.02,.2,.46,{axis:`x`,radial:i?10:18}),e.push(),e.translate(n,0,0),e.rotateY(-Math.PI/2),e.prism(t.body,[[-.72,-3.08],[.8,-3.08],[.52,-2.62],[-.46,-2.62]],.62,{c:.05}),e.pop(),e.box(t.accent,n+r*.315,-2.86,.05,.02,.18,.9,{c:.008}),e.box(t.trim,n,-3.05,.04,.58,.06,1.46,{c:.02})}function mf(e,t,n,r,i,a,o=.016,s=sf){let c=Math.max(2,Math.round((a-i)/6)),l=Math.max(2,Math.round((r-n)/6));e.push(),e.translate(0,s,0),e.add(t,ed(.9249999999999999,of+o,n*cf,r*cf,i*cf,a*cf,c,l)),e.pop()}function hf(e,t,n=0){let r=[Math.sin(e*cf)*Math.sin(t*cf),Math.cos(e*cf),Math.sin(e*cf)*Math.cos(t*cf)],i=of+n;return{p:[r[0]*i,sf+r[1]*i,r[2]*i],n:r}}function gf(e,t,n,r){e.push(),e.translate(0,sf,0),e.add(t.dome,tu(of,n,r?8:14,0,Math.PI/2)),e.pop(),vf(e,n,r);for(let n=0;n<8;n++){let r=22.5+n*45;mf(e,t.domeAccent,63,84,r-17.5,r+17.5)}for(let n of[60,180,300])mf(e,t.domeAccent,16,43,n-21,n+21);for(let n of[120,240])mf(e,t.domeAccent,30,43,n-9,n+9);if(mf(e,t.domeAccent,27,50,-15,15,.014),mf(e,t.domeAccent,52,61,-13,13,.014),mf(e,t.metal,0,9,0,360,.02),!r)for(let t=0;t<8;t++)mf(e,`dbg`,71.5,72.5,22.5+t*45-17.5,22.5+t*45+17.5,.02);let i=hf(38,0);Zu(e,`black`,xf(.2,.14,r?14:24),i.p,i.n);let a=hf(38,0,.07);r||Zu(e,`trBlack`,xf(.13,.03,20),a.p,a.n);for(let[n,i]of[[55,30],[20,180]]){let a=hf(n,i,.02);Zu(e,t.metal,xf(.105,.16,r?10:18),a.p,a.n)}let o=hf(58,-27,.005);Zu(e,t.metal,xf(.075,.06,14),o.p,o.n)}function _f(e,t){let n=(t,n,r,i,a,o=.03)=>{let s=hf(n,r,a);Zu(e,t,xf(i,o,12),s.p,s.n)};n(t.eyeLight,38,0,.035,.1),n(t.holo,55,30,.07,.11),n(t.holo,20,180,.07,.11),n(t.logicB,58,-27,.055,.045);for(let e=0;e<4;e++)n(e%2?t.logicA:`glowWhite`,55,-7+e*4.6,.028,.03,.02);for(let e=0;e<3;e++)n(t.logicB,58.5,-5+e*5,.026,.03,.02)}function vf(e,t,n){e.cyl(`dbg`,0,.082,0,.945,.024,{radial:t,top:!1}),n||e.cyl(`gunmetal`,0,.060000000000000005,0,.3,.03,{radial:16,top:!1})}function yf(e,t,n,r){let i=sf;vf(e,n,r),e.lathe(t.domeAccent,Xl([[.62,.51],[.975,.47000000000000003],[.975,.09000000000000001],[.93,i],[.7,i]],30),{radial:n}),e.lathe(t.dome,Xl([[.63,.97],[.66,.95],[.955,.5],[.975,.47000000000000003]],30),{radial:n}),e.lathe(t.domeAccent,Xl([[0,1.09],[.3,1.08],[.5,1.045],[.6,1.0050000000000001],[.645,.9650000000000001],[.62,.94]],30),{radial:n});for(let n=0;n<6;n++){let r=30+n*60;e.push(),e.add(t.dome,td(.955,.99,.15000000000000002,.39,(r-16)*cf,(r+16)*cf,4)),e.pop()}let a=(e,t,n)=>{let r=.955+(.66-.955)*t+n*.86,i=.5+.45*t+n*.51;return[r*Math.sin(e*cf),i,r*Math.cos(e*cf)]};for(let n of[55,125,235,305])Xu(e,t.domeAccent,a(n,.05,.01),a(n,.95,.01),.035,{radial:8});if(!r)for(let t of[90,270])Xu(e,`dbg`,a(t,.2,.012),a(t,.8,.012),.022,{radial:6});let o=[0,.51,.86],s=a(0,.5,.03);Zu(e,`black`,xf(.19,.12,r?14:24),s,o),r||Zu(e,`trBlack`,xf(.12,.03,20),a(0,.5,.1),o);let c=a(38,.82,.02);Zu(e,t.domeAccent,xf(.09,.14,16),c,[Math.sin(38*cf)*.86,.51,Math.cos(38*cf)*.86]),r||Zu(e,`dbg`,xf(.07,.05,12),a(-40,.3,.01),[Math.sin(-40*cf)*.86,.51,Math.cos(-40*cf)*.86])}function bf(e,t){let n=(e,t,n)=>{let r=.955+(.66-.955)*t+n*.86,i=.5+.45*t+n*.51;return[r*Math.sin(e*cf),i,r*Math.cos(e*cf)]},r=e=>[Math.sin(e*cf)*.86,.51,Math.cos(e*cf)*.86];Zu(e,t.eyeLight,xf(.035,.03,10),n(0,.5,.125),r(0)),Zu(e,t.holo,xf(.06,.03,12),n(38,.82,.1),r(38)),Zu(e,t.logicA,xf(.05,.03,12),n(-28,.62,.02),r(-28)),Zu(e,t.logicB,xf(.035,.03,10),n(-18,.72,.02),r(-18))}function xf(e,t,n){return $l(e,t,Math.min(.02,e*.2),n)}var Sf={key:`hairAnakin`,hemFront:1,hemSide:.02,hemBack:-.12,faceHalf:44,sideAt:74,flare:.13,locks:11,lockAmp:.065,lockTwist:.1,partDeg:-14,partDepth:.06,fringe:0,quiff:.03,sweepDeg:16,radius:.7,crown:1.36,seed:3,bangs:[[-48,.2,14],[-26,.09,12],[6,.13,13],[30,.2,13],[50,.26,12]]},Cf={key:`hairObiwan`,hemFront:1.04,hemSide:.48,hemBack:.26,faceHalf:46,sideAt:80,flare:.03,locks:13,lockAmp:.05,lockTwist:-.25,partDeg:38,partDepth:.05,fringe:0,quiff:.09,sweepDeg:-22,radius:.68,crown:1.36,seed:5,bangs:[[-30,.07,16],[-4,.05,14],[22,.03,12]]},wf=(e,t,n)=>{let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)};function Tf(e,t=1){let n=Math.round(144*t),r=Math.round(44*t),i=.74,a=-.03,o=e.radius,s=e.crown-i,c=.1,l=t=>{let n=Math.abs(((t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*(180/Math.PI),r=e.hemFront,i=wf(e.faceHalf,e.sideAt,n),a=wf(110,170,n),o=r+(e.hemSide-r)*i;o+=(e.hemBack-e.hemSide)*a;let s=t*180/Math.PI;for(let[t,n,r]of e.bangs)o-=n*Math.exp(-(((s-t)/r)**2));if(e.fringe>0&&n<e.faceHalf+10){let r=t*180/Math.PI+e.sweepDeg*.5,i=Math.abs(Math.sin(r/360*e.locks*Math.PI*1.4))**.8;o-=e.fringe*i*(1-wf(e.faceHalf-8,e.faceHalf+10,n))}return o},u=0;{let e=0,t=s;for(let n=1;n<=64;n++){let r=n/64*(Math.PI/2),i=o*Math.sin(r),a=s*Math.cos(r);u+=Math.hypot(i-e,a-t),e=i,t=a}}let d=e=>{let t=Math.min(1,e/u)*(Math.PI/2);return{r:o*Math.sin(t),y:i+s*Math.cos(t),nr:Math.sin(t)/o,ny:Math.cos(t)/s}},f=[],p=[],m=e.partDeg*Math.PI/180;for(let t=0;t<=r;t++)for(let h=0;h<n;h++){let g=h/n*Math.PI*2-Math.PI,_=l(g),v=Math.max(0,i-_),y=v>0?u+v:0;if(v===0){let e=Math.max(-1,Math.min(1,(_-i)/s));y=Math.acos(e)/(Math.PI/2)*u}let b=t/r*y,x,S,C,w;if(b<=u){let e=d(b);x=e.r,S=e.y;let t=Math.hypot(e.nr,e.ny);C=e.nr/t,w=e.ny/t}else{let t=(b-u)/Math.max(1e-6,v);x=o+e.flare*t**1.6,S=i-(b-u),C=1,w=e.flare*.6;let n=Math.hypot(C,w);C/=n,w/=n}let T=t/r,E=(g+Math.PI)/(Math.PI*2)*e.locks+e.lockTwist*T*e.locks*.35+Math.sin(g*3+e.seed)*.32+Math.sin(g*7+e.seed*2.1)*.16,D=Math.abs(Math.sin(Math.PI*E))**.55,O=.25+.75*wf(.05,.6,T),k=e.lockAmp*(D-.5)*O,A=Math.atan2(Math.sin(g-m),Math.cos(g-m));k-=e.partDepth*Math.exp(-((A/.09)**2))*(1-wf(.2,.7,T))*(Math.abs(g)<2.2?1:.3),k+=e.quiff*Math.exp(-((g/.8)**2))*Math.exp(-(((T-.35)/.25)**2)),k+=.02*wf(.85,1,T);let ee=x+k*C,j=S+k*w,M=Math.sin(g),N=Math.cos(g);f.push(ee*M,j,ee*N+a);let te=Math.max(.2,x-c*C),P=S-c*w;p.push(te*M,P,te*N+a)}let h=n*(r+1),g=new Float32Array(h*2*3);g.set(f,0),g.set(p,h*3);let _=[],v=(e,t)=>t*n+e%n,y=(e,t)=>h+t*n+e%n;for(let e=0;e<r;e++)for(let t=0;t<n;t++)_.push(v(t,e),v(t+1,e+1),v(t+1,e),v(t,e),v(t,e+1),v(t+1,e+1)),_.push(y(t,e),y(t+1,e),y(t+1,e+1),y(t,e),y(t+1,e+1),y(t,e+1));for(let e=0;e<n;e++)_.push(v(e,r),y(e+1,r),v(e+1,r),v(e,r),y(e,r),y(e+1,r));let b=new lr;b.setAttribute(`position`,new Jn(g,3)),b.setIndex(_),b.computeVertexNormals();let x=b.getAttribute(`normal`).count;b.setAttribute(`uv`,new Jn(new Float32Array(x*2),2));let S=new Nr(b,vu(e.key,{plain:!0}));return S.castShadow=!0,S.receiveShadow=!0,S.name=`hair`,S}var Ef=1792,Df=1.08,Of={mouth:`smile`,brows:0,lookX:0,lookY:0,blink:0,squint:0},kf=`#15110e`;function Af(e,t){return[Ef/2+e*475,(Df-t)*475]}function jf(e,t,n,r,i,a=0){let[o,s]=Af(t,n);e.beginPath(),e.ellipse(o,s,r*475,i*475,a,0,Math.PI*2)}function Mf(e,t,n=!1){e.beginPath(),t.forEach(([t,n],r)=>{let[i,a]=Af(t,n);r===0?e.moveTo(i,a):e.lineTo(i,a)}),n&&e.closePath()}function Nf(e,t,n,r,i=!0){let[a,o]=Af(...t),[s,c]=Af(...n),[l,u]=Af(...r);i&&e.moveTo(a,o),e.quadraticCurveTo(s,c,l,u)}function Pf(e,t,n){if(e.save(),e.fillStyle=t.skin,e.fillRect(0,0,Ef,512),e.lineCap=`round`,e.lineJoin=`round`,t.beard&&If(e,t,n),t.stubble&&(e.fillStyle=`rgba(120,80,60,0.10)`,Mf(e,[[-.44,.42],[-.3,.12],[0,.05],[.3,.12],[.44,.42],[.3,.3],[0,.26],[-.3,.3]],!0),e.fill()),t.cheekLines){e.strokeStyle=t.line,e.lineWidth=5.7;for(let t of[-1,1])e.beginPath(),Nf(e,[t*.27,.5],[t*.3,.42],[t*.26,.36]),e.stroke(),e.beginPath(),Nf(e,[t*.13,.52],[t*.2,.5],[t*.27,.53]),e.globalAlpha=.5,e.stroke(),e.globalAlpha=1}let r=Math.min(1,n.blink);for(let i of[-1,1]){let a=i*.2+n.lookX*.4,o=.6+n.lookY*.4,s=.085*(1-r*.92)*(1-n.squint*.3);r>.85?(e.strokeStyle=kf,e.lineWidth=10.45,e.beginPath(),Nf(e,[a-.055,o],[a,o-.025],[a+.055,o]),e.stroke()):(e.fillStyle=kf,jf(e,a,o,.058,s*1.1),e.fill(),e.fillStyle=`#ffffff`,jf(e,a-.017+n.lookX*.2,o+s*.42,.016,Math.min(.02,s*.3)),e.fill(),jf(e,a+.02+n.lookX*.2,o-s*.38,.008,Math.min(.01,s*.16)),e.fill(),n.squint>.05&&(e.fillStyle=t.skin,jf(e,a,o-s*(1.55-n.squint*.55),.07,s*.9),e.fill()),e.strokeStyle=t.line,e.lineWidth=.009*475,e.globalAlpha=.8,e.beginPath(),Nf(e,[a-i*.035-.03*i,o+s+.018],[a+i*.01,o+s+.045+n.brows*.01],[a+i*.075,o+s+.005]),e.stroke(),e.globalAlpha=1)}if(n.brows<-.4){e.strokeStyle=t.line,e.lineWidth=4.75,e.globalAlpha=Math.min(1,(-n.brows-.4)*2);for(let t of[-1,1])e.beginPath(),Nf(e,[t*.035,.82],[t*.045,.77],[t*.03,.72]),e.stroke();e.globalAlpha=1}if(n.brows>.5){e.strokeStyle=t.line,e.lineWidth=.008*475,e.globalAlpha=Math.min(.8,(n.brows-.5)*2);for(let t of[.9,.95])e.beginPath(),Nf(e,[-.13,t-.01],[0,t+.012],[.13,t-.01]),e.stroke();e.globalAlpha=1}if(n.mouth===`grin`||n.mouth===`grit`||n.mouth===`shout`||n.mouth===`open`){e.strokeStyle=t.line,e.lineWidth=4.75;for(let t of[-1,1])e.beginPath(),Nf(e,[t*.14,.45],[t*.2,.38],[t*.18,.3]),e.stroke()}e.fillStyle=t.brow;for(let t of[-1,1]){let r=.765+n.brows*.045-Math.max(0,-n.brows)*.01,i=.77-n.brows*.012,a=.8+n.brows*.012,o=t*.08,s=t*.31,[c,l]=Af(o,r),[u,d]=Af((o+s)/2,a+.012),[f,p]=Af(s,i),m=.036*475;e.beginPath(),e.moveTo(c,l-m*.55),e.quadraticCurveTo(u,d-m*.8,f,p-m*.15),e.quadraticCurveTo(u,d+m*.35,c,l+m*.55),e.closePath(),e.fill(),e.strokeStyle=kf,e.globalAlpha=.35,e.lineWidth=2,e.stroke(),e.globalAlpha=1}t.scar&&(e.strokeStyle=`#b27a64`,e.lineWidth=5.225,e.beginPath(),Nf(e,[-.215,.86],[-.2,.72],[-.225,.52]),e.stroke()),e.strokeStyle=t.line,e.lineWidth=5.225,e.beginPath(),Nf(e,[-.03,.47],[0,.445],[.035,.465]),e.stroke(),Ff(e,t,n.mouth),e.restore()}function Ff(e,t,n){let r=.33;e.strokeStyle=kf,e.lineWidth=9.5;let i=(t,n=!0,r=!1)=>{e.fillStyle=`#5a1512`,Mf(e,t,!0),e.fill(),e.save(),Mf(e,t,!0),e.clip(),e.fillStyle=`#ffffff`;let i=t.map(e=>e[0]),a=t.map(e=>e[1]),o=Math.min(...i),s=Math.max(...i),c=Math.min(...a),l=Math.max(...a);if(n){let[t,n]=Af(o,l),[r,i]=Af(s,l-(l-c)*.42);e.fillRect(t,n,r-t,i-n)}if(r){let[t,n]=Af(o,c+(l-c)*.3),[r,i]=Af(s,c);e.fillRect(t,n,r-t,i-n)}e.restore(),e.lineWidth=.016*475,Mf(e,t,!0),e.stroke()};switch(n){case`smile`:e.beginPath(),Nf(e,[-.13,.36],[0,.28],[.13,.36]),e.stroke();break;case`smirk`:e.beginPath(),Nf(e,[-.11,.335],[.02,.30000000000000004],[.14,.38]),e.stroke(),e.lineWidth=5.7,e.beginPath(),Nf(e,[.13,.4],[.155,.38],[.15,.35500000000000004]),e.stroke();break;case`flat`:e.beginPath(),Nf(e,[-.1,r],[0,.322],[.1,r]),e.stroke();break;case`frown`:e.beginPath(),Nf(e,[-.11,.30000000000000004],[0,.36],[.11,.30000000000000004]),e.stroke();break;case`grin`:i([[-.15,.37],[.15,.37],[.1,.27],[-.1,.27]],!0,!1);break;case`open`:i([[-.12,.365],[.12,.365],[.07,.25],[-.07,.25]],!0,!0);break;case`talk`:i([[-.1,.36],[.1,.36],[.06,.28500000000000003],[-.06,.28500000000000003]],!0,!1);break;case`o`:e.fillStyle=`#5a1512`,jf(e,0,.32,.045,.055),e.fill(),e.lineWidth=.016*475,e.stroke();break;case`shout`:i([[-.14,.38],[.14,.38],[.09,.22000000000000003],[-.09,.22000000000000003]],!0,!0);break;case`grit`:{i([[-.15,.365],[.15,.365],[.14,.28500000000000003],[-.14,.28500000000000003]],!0,!0),e.strokeStyle=kf,e.lineWidth=.008*475;for(let t=-3;t<=3;t++){e.beginPath();let[n,r]=Af(t*.036,.365),[i,a]=Af(t*.036,.28500000000000003);e.moveTo(n,r),e.lineTo(i,a),e.stroke()}e.beginPath();let[t,n]=Af(-.15,.325),[r,a]=Af(.15,.325);e.moveTo(t,n),e.lineTo(r,a),e.stroke();break}}}function If(e,t,n){let r=t.beard;e.fillStyle=r.color,e.beginPath();let i=[[-.56,.62],[-.5,.36],[-.38,.16],[-.2,.05],[0,.02],[.2,.05],[.38,.16],[.5,.36],[.56,.62],[.47,.6],[.4,.44],[.26,.37],[.18,.41],[.07,.43],[0,.415],[-.07,.43],[-.18,.41],[-.26,.37],[-.4,.44],[-.47,.6]];i.forEach(([t,n],r)=>{let[i,a]=Af(t,n);r===0?e.moveTo(i,a):e.lineTo(i,a)}),e.closePath(),e.fill(),e.strokeStyle=r.dark,e.lineWidth=.009*475;for(let t=0;t<26;t++){let n=-.46+t/25*.92,r=.33-Math.abs(n)*.1;e.beginPath(),Nf(e,[n,r],[n*1.05,(r+.12)/2],[n*.92,.1+Math.abs(n)*.25]),e.globalAlpha=.55,e.stroke()}e.globalAlpha=1,e.strokeStyle=r.light,e.lineWidth=2.85;for(let t=0;t<9;t++){let n=-.36+t/8*.72;e.beginPath(),Nf(e,[n,.28],[n*1.02,.2],[n*.95,.14]),e.globalAlpha=.5,e.stroke()}e.globalAlpha=1,e.fillStyle=t.skin,jf(e,0,.325,.13,.05),e.fill(),e.fillStyle=r.color,Mf(e,[[-.19,.345],[-.12,.415],[0,.4],[.12,.415],[.19,.345],[.1,.37],[0,.36],[-.1,.37]],!0),e.fill(),e.strokeStyle=r.dark,e.lineWidth=.008*475,e.stroke(),Mf(e,[[-.045,.27],[.045,.27],[.03,.22],[-.03,.22]],!0),e.fillStyle=r.color,e.fill(),e.strokeStyle=r.dark,e.lineWidth=4.75,e.beginPath(),i.slice(0,9).forEach(([t,n],r)=>{let[i,a]=Af(t,n);r===0?e.moveTo(i,a):e.lineTo(i,a)}),e.globalAlpha=.6,e.stroke(),e.globalAlpha=1}var Lf=class{style;canvas;texture;key=``;constructor(e){this.style=e,this.canvas=document.createElement(`canvas`),this.canvas.width=Ef,this.canvas.height=512,this.texture=new ii(this.canvas),this.texture.colorSpace=Ie,this.texture.anisotropy=8,this.set(Of)}set(e){let t=e=>Math.round(e*40)/40,n=`${e.mouth}|${t(e.brows)}|${t(e.lookX)}|${t(e.lookY)}|${t(e.blink)}|${t(e.squint)}`;n!==this.key&&(this.key=n,Pf(this.canvas.getContext(`2d`),this.style,e),this.texture.needsUpdate=!0)}};function Rf(e,t=!1){let n=document.createElement(`canvas`);n.width=640,n.height=500;let r=n.getContext(`2d`);r.fillStyle=e.base,r.fillRect(0,0,640,500),r.lineJoin=`round`,r.lineCap=`round`;let i=e=>e*640,a=e=>e*500,o=(e,t,n,o=3)=>{r.beginPath(),e.forEach(([e,t],n)=>n?r.lineTo(i(e),a(t)):r.moveTo(i(e),a(t))),r.closePath(),r.fillStyle=t,r.fill(),n&&(r.strokeStyle=n,r.lineWidth=o,r.stroke())};if(t){r.strokeStyle=e.line,r.globalAlpha=.5,r.lineWidth=3;for(let e of[.33,.5,.67])r.beginPath(),r.moveTo(i(e),a(.12)),r.quadraticCurveTo(i(e+.02),a(.45),i(e-.01),a(.8)),r.stroke();r.globalAlpha=1,o([[0,.8],[1,.8],[1,.93],[0,.93]],e.belt,e.line,3)}else{o([[.36,0],[.64,0],[.5,.42]],e.inner,e.line,3),o([[.42,0],[.58,0],[.5,.17]],e.skin,e.line,2.5),o([[.2,0],[.36,0],[.5,.42],[.58,.8],[.4,.8],[.24,.35]],e.robe,e.line,3),o([[.8,0],[.64,0],[.5,.42],[.43,.8],[.6,.8],[.76,.35]],e.robe,e.line,3),e.tabard&&(o([[.26,0],[.34,0],[.47,.44],[.5,.8],[.42,.8],[.3,.36]],e.tabard,e.line,2.5),o([[.74,0],[.66,0],[.53,.44],[.5,.8],[.58,.8],[.7,.36]],e.tabard,e.line,2.5)),r.strokeStyle=e.robeDark,r.lineWidth=4,r.globalAlpha=.9;for(let[e,t,n]of[[[.18,.5],[.22,.62],[.2,.76]],[[.82,.5],[.78,.62],[.8,.76]],[[.1,.25],[.14,.4],[.12,.55]],[[.9,.25],[.86,.4],[.88,.55]]])r.beginPath(),r.moveTo(i(e[0]),a(e[1])),r.quadraticCurveTo(i(t[0]),a(t[1]),i(n[0]),a(n[1])),r.stroke();r.globalAlpha=1,o([[0,.79],[1,.79],[1,.93],[0,.93]],e.belt,e.line,3),o([[.43,.775],[.57,.775],[.57,.945],[.43,.945]],e.buckle,e.line,3),o([[.465,.815],[.535,.815],[.535,.905],[.465,.905]],e.belt,e.line,2);for(let t of[.14,.72])o([[t,.82],[t+.13,.82],[t+.12,.98],[t+.01,.98]],e.belt,e.line,3);r.strokeStyle=e.line,r.lineWidth=3,r.beginPath(),r.moveTo(i(.5),a(.945)),r.lineTo(i(.5),a(1)),r.stroke()}let s=new ii(n);return s.colorSpace=Ie,s.anisotropy=8,s}function zf(e,t,n,r=.55){let i=document.createElement(`canvas`);i.width=256,i.height=320;let a=i.getContext(`2d`);a.fillStyle=e,a.fillRect(0,0,256,320),t&&(a.fillStyle=t,a.beginPath(),a.moveTo(0,320*r+12),a.quadraticCurveTo(128,320*r-14,256,320*r+12),a.lineTo(256,320),a.lineTo(0,320),a.closePath(),a.fill(),a.strokeStyle=n,a.lineWidth=4,a.stroke()),a.strokeStyle=n,a.globalAlpha=.35,a.lineWidth=3,a.beginPath(),a.moveTo(128,20),a.quadraticCurveTo(140,100,128,320*(t?r:.9)),a.stroke(),a.globalAlpha=1;let o=new ii(i);return o.colorSpace=Ie,o}var Bf=new Map;function Vf(e){let t=Bf.get(e);return t||(t=new aa({map:e,roughness:.5,roughnessMap:hu(),metalness:0,clearcoat:.55,clearcoatRoughness:.14}),Bf.set(e,t)),t}function Hf(e,t,n,r,i){let a=new lr;a.setAttribute(`position`,new Jn(e.pos,3)),a.setAttribute(`normal`,new Jn(e.nrm,3));let o=e.pos.length/3,s=new Float32Array(o*2);for(let a=0;a<o;a++)s[a*2]=(e.pos[a*3]-t)/(n-t),s[a*2+1]=(e.pos[a*3+1]-r)/(i-r);return a.setAttribute(`uv`,new Jn(s,2)),a.computeBoundingSphere(),a}function Uf(){let e=Df,t=.13,n=[[.3,-.04],[.3,0],[.47,0]];for(let e=1;e<=5;e++){let r=e/5*(Math.PI/2);n.push([.47+Math.sin(r)*t,t-Math.cos(r)*t])}n.push([.6,e-t]);for(let r=1;r<=5;r++){let i=r/5*(Math.PI/2);n.push([.47+Math.cos(i)*t,e-t+Math.sin(i)*t])}n.push([.34,e],[.3,e+.02],[.3,e+.2],[.26,e+.22],[0,e+.22]);let r=[],i=[],a=[],o=[],s=n.map((e,t)=>{let r=n[Math.max(0,t-1)],i=n[Math.min(n.length-1,t+1)],a=i[0]-r[0],o=i[1]-r[1],s=Math.hypot(a,o)||1;return[o/s,-a/s]});for(let t=0;t<=72;t++){let o=t/72*Math.PI*2-Math.PI,c=Math.sin(o),l=Math.cos(o);for(let o=0;o<n.length;o++){let[u,d]=n[o];r.push(u*c,d,u*l),i.push(s[o][0]*c,s[o][1],s[o][0]*l),a.push(t/72,Math.max(.002,Math.min(.998,d/e)))}}let c=n.length;for(let e=0;e<72;e++)for(let t=0;t<c-1;t++){let n=e*c+t,r=(e+1)*c+t,i=(e+1)*c+t+1,a=e*c+t+1;o.push(n,r,i,n,i,a)}let l=new lr;return l.setAttribute(`position`,new Jn(new Float32Array(r),3)),l.setAttribute(`normal`,new Jn(new Float32Array(i),3)),l.setAttribute(`uv`,new Jn(new Float32Array(a),2)),l.setIndex(o),l.computeBoundingSphere(),l}var Wf=[[.13,.2,0],[.2,.1,0],[.24,-.1,0],[.26,-.36,0],[.26,-.56,.07],[.25,-.7,.2],[.24,-.8,.33]],Gf=new U(.24,-.84,.39);function Kf(){return nu(Wf,e=>{let t=e<.12?Math.sqrt(Math.max(.05,1-(1-e/.12)**2)):1;return(.235-.055*e)*t},18)}function qf(){let e=[],t=.19,n=Math.PI*1.42,r=-n/2;for(let i=0;i<=28;i++){let a=r+i/28*n;e.push([0,Math.sin(a)*t,.3-Math.cos(a)*t])}let i=nu(e,e=>.085*Math.min(1,Math.sqrt(Math.min(e,1-e)/.04+.2)),14),a=$l(.1,.16,.02,14),o=new Y;o.add(`white`,i),o.add(`white`,a,new G().makeTranslation(0,0,.06).multiply(new G().makeRotationX(Math.PI/2)));let s=o.build(`tmp`).group.children[0].geometry;return{pos:s.getAttribute(`position`).array,nrm:s.getAttribute(`normal`).array}}function Jf(e,t,n=!0){let r=new Y({tint:0});r.add(e,t);let i=r.build(`p`).group.children[0];return n&&(i.material=vu(e)),i.castShadow=!0,i.receiveShadow=!0,i}function Yf(e){let t=new sn;t.name=`minifig-${e.name}`;let n=new on;n.name=`hips`,t.add(n);let r=new Y({seed:11});r.box(e.hips,0,.16,0,1.95,.32,.9,{c:.04}),r.box(e.hips,0,-.1,.12,.3,.3,.6,{c:.04}),n.add(r.build(`hips`).group);let i=zf(e.legPrint.base,e.legPrint.boot,e.legPrint.line,e.legPrint.top??.55),a=e=>{let t=new on;t.position.set(e*.49,0,0);let r=[[-.45,-.8],[.45,-.8],[.45,.02]];for(let e=0;e<=8;e++){let t=e/8*Math.PI;r.push([Math.cos(t)*.45,.02+Math.sin(t)*.2])}r.push([-.45,.02]);let a=new Nr(Hf(Gl(Kl([Jl(r.map(([e,t])=>[e,t]),.93,.035),Jl([[-.45,-1.25],[.64,-1.25],[.64,-1.04],[.5,-.8],[-.45,-.8]],.93,.035)]),new G().makeRotationY(-Math.PI/2)),-.47,.47,-1.25,.22),Vf(i));return a.castShadow=!0,a.receiveShadow=!0,t.add(a),n.add(t),t},o=a(1),s=a(-1),c=new on;c.name=`torso`,c.position.set(0,.32,0),n.add(c);let l=new Y({seed:12});l.prism(e.torso,[[-.975,0],[.975,0],[.75,1.52],[-.75,1.52]],.95,{c:.04}),l.cyl(e.torso===`black`?`black`:e.torso,0,1.58,0,.27,.14,{radial:20}),c.add(l.build(`torso`).group);let u=new lr;{let e=.036,t=[[-.9318,e],[.975-e*1.2,e],[.75-e*1.2,1.484],[-.7068,1.484]],n=new Float32Array([...t[0],0,...t[1],0,...t[2],0,...t[0],0,...t[2],0,...t[3],0]);for(let e=0;e<6;e++)n[e*3+2]=.477;u.setAttribute(`position`,new Jn(n,3));let r=new Float32Array(18);for(let e=0;e<6;e++)r[e*3+2]=1;u.setAttribute(`normal`,new Jn(r,3));let i=new Float32Array(12);for(let e=0;e<6;e++)i[e*2]=(n[e*3]+.975)/1.95,i[e*2+1]=n[e*3+1]/1.52;u.setAttribute(`uv`,new Jn(i,2))}let d=new Nr(u,Vf(Rf(e.torsoPrint)));d.receiveShadow=!0,c.add(d);let f=u.clone();f.rotateY(Math.PI);let p=new Nr(f,Vf(Rf(e.torsoPrint,!0)));p.receiveShadow=!0,c.add(p);let m=Kf(),h=qf(),g=new U(.24-.25,-.8+.7,.13).normalize(),_=(e,t,n)=>{let r=new on;r.name=e>0?`armL`:`armR`,r.position.set(e*.8,1.22,0),c.add(r);let i=Jf(t,m);e<0&&(i.scale.x=-1),r.add(i);let a=new on;a.position.set(Gf.x*e,Gf.y,Gf.z);let o=new ut().setFromUnitVectors(new U(0,0,1),new U(g.x*e,g.y,g.z));a.quaternion.copy(o),r.add(a);let s=new on;s.name=e>0?`handL`:`handR`,a.add(s);let l=Jf(n,h);s.add(l);let u=new on;return u.position.set(0,0,.3),s.add(u),{pivot:r,hand:s,grip:u}},v=_(1,e.arms,e.handL),y=_(-1,e.arms,e.handR),b=new on;b.name=`head`,b.position.set(0,1.58,0),c.add(b);let x=new Lf(e.face),S=new aa({map:x.texture,roughness:.5,roughnessMap:hu(),metalness:0,clearcoat:.6,clearcoatRoughness:.12}),C=new Nr(Uf(),S);C.position.y=0,C.castShadow=!0,C.receiveShadow=!0,b.add(C),b.add(Tf(e.hair));let w={group:t,hips:n,torso:c,head:b,armL:v.pivot,armR:y.pivot,handL:v.hand,handR:y.hand,legL:o,legR:s,gripL:v.grip,gripR:y.grip,face:x,setFace:e=>x.set(e),pose(e){o.rotation.x=-(e.legL??0),s.rotation.x=-(e.legR??0),v.pivot.rotation.set(-(e.armL??0),0,e.splayL??0),y.pivot.rotation.set(-(e.armR??0),0,-(e.splayR??0)),v.hand.rotation.z=e.wristL??0,y.hand.rotation.z=e.wristR??0,b.rotation.set(e.headPitch??0,e.headYaw??0,e.headRoll??0,`YXZ`),c.rotation.y=e.torsoYaw??0},seated(){w.pose({legL:Math.PI/2,legR:Math.PI/2,armL:.95,armR:.95,splayL:.08,splayR:.08})}};return w}var Xf=e=>({name:`anakin`,torso:`reddishBrown`,arms:`reddishBrown`,handL:`lightNougat`,handR:`black`,hips:`reddishBrown`,legs:`reddishBrown`,torsoPrint:{base:`#5c2b14`,robe:`#4a2210`,robeDark:`#2c1409`,inner:`#1f1a17`,belt:`#1a1512`,buckle:`#9fa2a6`,skin:`#f6d7b3`,line:`#140d09`,tabard:`#1e1916`},legPrint:{base:`#5c2b14`,boot:`#15110e`,line:`#0c0907`,top:.45},face:{skin:`#f6d7b3`,brow:`#4b2412`,line:`#a8745a`,scar:!0,cheekLines:!0},hair:e}),Zf=e=>({name:`obiwan`,torso:`tan`,arms:`tan`,handL:`lightNougat`,handR:`lightNougat`,hips:`tan`,legs:`tan`,torsoPrint:{base:`#e0c796`,robe:`#cdb07a`,robeDark:`#9c8358`,inner:`#f0e2c2`,belt:`#5c2b14`,buckle:`#a9abae`,skin:`#f6d7b3`,line:`#3a2a18`},legPrint:{base:`#e0c796`,boot:`#5c2b14`,line:`#2b1a0e`,top:.5},face:{skin:`#f6d7b3`,brow:`#6e3814`,line:`#b07c62`,beard:{color:`#8e4a1c`,dark:`#5c2c0e`,light:`#b8733a`},cheekLines:!1},hair:e});function Qf(){return Yf(Xf(Sf))}function $f(){return Yf(Zf(Cf))}function ep(e){let t=new sn;return e.group.position.y=1.25,e.pose({armL:.15,armR:.35,splayL:.05,splayR:.05,headYaw:.15}),t.add(e.group),t}var tp={anakin:()=>{let e=Qf();return e.setFace({mouth:`smirk`,brows:-.3,lookX:.02,lookY:0,blink:0,squint:.1}),ep(e)},obiwan:()=>{let e=$f();return e.setFace({mouth:`grin`,brows:.2,lookX:-.02,lookY:0,blink:0,squint:0}),ep(e)},"faces-anakin":()=>{let e=new sn;return[`smirk`,`grit`,`open`,`frown`].forEach((t,n)=>{let r=Qf();r.setFace({mouth:t,brows:[-.3,-1,.3,.8][n],lookX:0,lookY:0,blink:0,squint:[.1,.3,0,0][n]}),r.group.position.set((n-1.5)*2.6,1.25,0),r.pose({armL:.2,armR:.2}),e.add(r.group)}),e},"faces-obiwan":()=>{let e=new sn;return[`smile`,`frown`,`shout`,`talk`].forEach((t,n)=>{let r=$f();r.setFace({mouth:t,brows:[0,.9,-.6,.3][n],lookX:0,lookY:0,blink:0,squint:0}),r.group.position.set((n-1.5)*2.6,1.25,0),r.pose({armL:.2,armR:.2}),e.add(r.group)}),e},"anakin-head":()=>{let e=Qf();e.setFace({mouth:`smirk`,brows:-.3,lookX:0,lookY:0,blink:0,squint:.1});let t=ep(e);return t.userData.frame={center:[0,3.75,0],radius:1.1},t},"obiwan-head":()=>{let e=$f();e.setFace({mouth:`frown`,brows:.8,lookX:0,lookY:0,blink:0,squint:0});let t=ep(e);return t.userData.frame={center:[0,3.75,0],radius:1.1},t},"anakin-seated":()=>{let e=Qf();e.seated(),e.setFace({mouth:`grit`,brows:-.8,lookX:0,lookY:0,blink:0,squint:.2});let t=new sn;return t.add(e.group),t}};function np(e,t={}){let n=Rd({variant:e,lod:t.lod});if(n.setFoils(t.foils??1),n.setEngine(t.engine??1),(t.droid??!0)&&n.astromechAnchor.add(df({variant:e===`anakin`?`r2d2`:`r4p17`,socket:!0,lod:t.lod}).group),t.pilot??!0){let t=e===`anakin`?Qf():$f();t.seated(),t.setFace(e===`anakin`?{mouth:`grit`,brows:-.7,lookX:0,lookY:0,blink:0,squint:.2}:{mouth:`frown`,brows:.3,lookX:0,lookY:0,blink:0,squint:0}),n.cockpitAnchor.add(t.group)}return n}function rp(e,t,n){return e.userData.frame={center:t,radius:n},e}var ip={"eta2-anakin":()=>np(`anakin`).group,"eta2-obiwan":()=>np(`obiwan`).group,"eta2-anakin-cruise":()=>np(`anakin`,{foils:0,engine:.6}).group,"eta2-obiwan-cruise":()=>np(`obiwan`,{foils:0,engine:.6}).group,"eta2-anakin-lod1":()=>np(`anakin`,{lod:1,pilot:!1}).group,"eta2-obiwan-lod1":()=>np(`obiwan`,{lod:1,pilot:!1}).group,"eta2-anakin-bare":()=>np(`anakin`,{pilot:!1,droid:!1}).group,"eta2-anakin-cockpit":()=>rp(np(`anakin`).group,[0,3,1.2],2.4),"eta2-obiwan-cockpit":()=>rp(np(`obiwan`).group,[0,3,1.2],2.4),"eta2-anakin-socket":()=>rp(np(`anakin`).group,[3.6,1.7,1.5],2.3),"eta2-obiwan-socket":()=>rp(np(`obiwan`).group,[3.6,1.7,1.5],2.3),"eta2-anakin-nose":()=>rp(np(`anakin`).group,[0,1,7.5],4.2),"eta2-anakin-tail":()=>rp(np(`anakin`).group,[0,1.2,-8.5],4.8),"eta2-obiwan-nose":()=>rp(np(`obiwan`).group,[0,1,7.5],4.2),"eta2-anakin-canopy-open":()=>{let e=np(`anakin`);return e.canopy.rotation.x=-.9,e.group},r2d2:()=>df({variant:`r2d2`}).group,r4p17:()=>df({variant:`r4p17`}).group,"astromechs-pair":()=>{let e=new sn,t=df({variant:`r2d2`});t.group.position.x=1.6,t.setHeadYaw(.3);let n=df({variant:`r4p17`});return n.group.position.x=-1.6,n.setHeadYaw(-.3),e.add(t.group,n.group),e},"astromechs-socket":()=>{let e=new sn,t=df({variant:`r2d2`,socket:!0});t.group.position.x=1.3;let n=df({variant:`r4p17`,socket:!0});return n.group.position.x=-1.3,e.add(t.group,n.group),e}};function ap(e){let t=0;for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t+=r[0]*i[1]-i[0]*r[1]}return t/2}function op(e){return ap(e)<0?e.slice().reverse():e}function sp(e,t=1e-4){let n=[];for(let r of e){let e=n[n.length-1];(!e||Math.abs(e[0]-r[0])>t||Math.abs(e[1]-r[1])>t)&&n.push(r)}for(;n.length>1&&Math.abs(n[0][0]-n[n.length-1][0])<=t&&Math.abs(n[0][1]-n[n.length-1][1])<=t;)n.pop();return n}function cp(e){let t=0,n=0,r=0;for(let i=0;i<e.length;i++){let a=e[i],o=e[(i+1)%e.length],s=a[0]*o[1]-o[0]*a[1];t+=s,n+=(a[0]+o[0])*s,r+=(a[1]+o[1])*s}if(Math.abs(t)<1e-9){let t=0,n=0;for(let r of e)t+=r[0],n+=r[1];return[t/e.length,n/e.length]}return[n/(3*t),r/(3*t)]}function lp(e){let t=e.length,n=[];for(let r=0;r<t;r++){let i=e[r],a=e[(r+1)%t],o=a[0]-i[0],s=a[1]-i[1],c=Math.hypot(o,s)||1;n.push([s/c,-o/c])}return n}function up(e,t){let n=e;for(let e=0;e<t.length&&n.length;e++){let r=t[e],i=t[(e+1)%t.length],a=n;n=[];let o=e=>(i[0]-r[0])*(e[1]-r[1])-(i[1]-r[1])*(e[0]-r[0]);for(let e=0;e<a.length;e++){let t=a[e],r=a[(e+1)%a.length],i=o(t),s=o(r);if(i>=0&&n.push(t),i>=0!=s>=0){let e=i/(i-s);n.push([t[0]+(r[0]-t[0])*e,t[1]+(r[1]-t[1])*e])}}}return sp(n)}function dp(e,t,n,r=1e-7){for(let i=0;i<e.length;i++){let a=e[i],o=e[(i+1)%e.length];if((o[0]-a[0])*(n-a[1])-(o[1]-a[1])*(t-a[0])<-r)return!1}return!0}function fp(e,t){let n=e.length;if(n<3)return null;let r=lp(e),i=[];for(let a=0;a<n;a++){let o=r[(a-1+n)%n],s=r[a],c=1+o[0]*s[0]+o[1]*s[1];if(c<.02)return null;i.push([e[a][0]-t*(o[0]+s[0])/c,e[a][1]-t*(o[1]+s[1])/c])}for(let t=0;t<n;t++){let r=(t+1)%n,a=e[r][0]-e[t][0],o=e[r][1]-e[t][1],s=i[r][0]-i[t][0],c=i[r][1]-i[t][1];if(a*s+o*c<=0)return null}return i}function pp(e,t){let n=e.length,r=lp(e),i=[];for(let a=0;a<n;a++){let o=(a-1+n)%n,s=a,c=r[o][0],l=r[o][1],u=c*e[o][0]+l*e[o][1]-t[o],d=r[s][0],f=r[s][1],p=d*e[s][0]+f*e[s][1]-t[s],m=c*f-d*l;Math.abs(m)<1e-9?i.push([e[a][0]-r[s][0]*t[s],e[a][1]-r[s][1]*t[s]]):i.push([(u*f-p*l)/m,(c*p-d*u)/m])}return i}var mp=[0,1,0];function hp(e,t,n,r=!0){let i=new Hl,a=op(sp(e)),o=a.length;if(o<3||Math.abs(ap(a))<1e-6)return i.done();let s=lp(a);n=Math.min(n,t*.45);let c=null;for(let e=0;e<4&&n>1e-4&&(c=fp(a,n),!c);e++)n*=.5;c||(c=a,n=0);for(let e=1;e<o-1;e++)i.tri([c[0][0],t,c[0][1]],[c[e][0],t,c[e][1]],[c[e+1][0],t,c[e+1][1]],mp);let l=t-n;for(let e=0;e<o;e++){let u=(e+1)%o,d=[s[e][0],0,s[e][1]];n>0&&i.quad([c[e][0],t,c[e][1]],[c[u][0],t,c[u][1]],[a[u][0],l,a[u][1]],[a[e][0],l,a[e][1]],mp,mp,d,d),r&&l>1e-4&&i.quad([a[e][0],l,a[e][1]],[a[u][0],l,a[u][1]],[a[u][0],0,a[u][1]],[a[e][0],0,a[e][1]],d)}return i.done()}function gp(e,t){let n=new Hl,r=op(sp(e));for(let e=1;e<r.length-1;e++)n.tri([r[0][0],t,r[0][1]],[r[e][0],t,r[e][1]],[r[e+1][0],t,r[e+1][1]],mp);return n.done()}var _p=(e,t)=>[[-e/2,-t/2],[e/2,-t/2],[e/2,t/2],[-e/2,t/2]];function vp(e,t,n){return Wl(`btt|${e.toFixed(3)}|${t.toFixed(3)}|${n.toFixed(3)}`,()=>gp(_p(e,t),n))}function yp(e,t,n,r){return Wl(`bt|${e.toFixed(3)}|${t.toFixed(3)}|${n.toFixed(3)}|${r.toFixed(4)}`,()=>hp([[-e/2,-t/2],[e/2,-t/2],[e/2,t/2],[-e/2,t/2]],n,r))}function bp(e,t,n,r,i,a,o){e.quad([t,a,r],[i,a,r],[i,a,o],[t,a,o],[0,1,0]),e.quad([t,n,r],[i,n,r],[i,a,r],[t,a,r],[0,0,-1]),e.quad([t,n,o],[i,n,o],[i,a,o],[t,a,o],[0,0,1]),e.quad([t,n,r],[t,n,o],[t,a,o],[t,a,r],[-1,0,0]),e.quad([i,n,r],[i,n,o],[i,a,o],[i,a,r],[1,0,0])}function xp(e,t,n,r){return Wl(`bg|${e.toFixed(3)}|${t.toFixed(3)}|${n.toFixed(3)}|${r.toFixed(4)}`,()=>{let i=new Hl,a=e>=t,o=a?e:t,s=a?t:e,c=hp([[-e/2,-t/2],[e/2,-t/2],[e/2,t/2],[-e/2,t/2]],n*.62,r);i.append(c);let l=Math.max(2,Math.round(s*4)),u=(s-.16)/l,d=u*.55;for(let e=0;e<l;e++){let t=-s/2+.08+u*(e+.5),r=-o/2+.1,c=o/2-.1;a?bp(i,r,n*.62-.01,t-d/2,c,n,t+d/2):bp(i,t-d/2,n*.62-.01,r,t+d/2,n,c)}return i.done()})}function Sp(e,t,n){let r=new Hl,i=ap(t)<0?t.slice().reverse():t,a=i.length,o=e=>[e[0],e[1],n];for(let t=0;t<a;t++){let n=o(i[t]),s=o(i[(t+1)%a]),c=wp(e,n,s),l=cp(i),u=[(n[0]+s[0])/2-l[0],(n[1]+s[1])/2-l[1],0],d=c[0]*u[0]+c[1]*u[1]>=0?1:-1;r.tri(e,n,s,[c[0]*d,c[1]*d,c[2]*d])}let s=Ui.triangulateShape(i.map(e=>new H(e[0],e[1])),[]),c=[0,0,n<e[2]?-1:1];for(let e of s)r.tri(o(i[e[0]]),o(i[e[1]]),o(i[e[2]]),c);return r.done()}function Cp(e,t,n,r,i={}){let a=new Hl,o=e.length,s=e=>[e[0],t,e[1]],c=e=>[e[0],r,e[1]],l=cp(e);for(let t=0;t<o;t++){let r=(t+1)%o,i=s(e[t]),u=s(e[r]),d=c(n[r]),f=c(n[t]),p=wp(i,u,d),m=[(i[0]+u[0])/2-l[0],(i[2]+u[2])/2-l[1]],h=p[0]*m[0]+p[2]*m[1]>=0?1:-1,g=[p[0]*h,p[1]*h,p[2]*h];a.quad(i,u,d,f,g)}for(let t=1;t<o-1;t++)a.tri(c(n[0]),c(n[t]),c(n[t+1]),[0,1,0]),i.noBottom||a.tri(s(e[0]),s(e[t]),s(e[t+1]),[0,-1,0]);return a.done()}function wp(e,t,n){let r=t[0]-e[0],i=t[1]-e[1],a=t[2]-e[2],o=n[0]-e[0],s=n[1]-e[1],c=n[2]-e[2],l=i*c-a*s,u=a*o-r*c,d=r*s-i*o,f=Math.hypot(l,u,d)||1;return[l/f,u/f,d/f]}var Tp=e=>new U(e[0],e[1],e[2]);function Ep(e,t,n,r,i){let a=Tp(e),o=Tp(n).normalize();o.dot(Tp(r))<0&&o.negate();let s=Tp(t);s.addScaledVector(o,-s.dot(o)).normalize();let c=new U().crossVectors(s,o);return i&&c.dot(Tp(i).sub(a))<0&&c.negate(),{o:a,u:s,n:o,v:c,m:new G().makeBasis(s,o,c).setPosition(a)}}function Dp(e,t){let n=(t instanceof U?t.clone():Tp(t)).sub(e.o);return[n.dot(e.u),n.dot(e.v)]}function Op(e,t,n,r=0){return e.o.clone().addScaledVector(e.u,t).addScaledVector(e.v,n).addScaledVector(e.n,r)}function kp(e){let t=0,n=0,r=0;for(let i=0;i<e.length;i++){let a=e[i],o=e[(i+1)%e.length];t+=(a[1]-o[1])*(a[2]+o[2]),n+=(a[2]-o[2])*(a[0]+o[0]),r+=(a[0]-o[0])*(a[1]+o[1])}let i=Math.hypot(t,n,r)||1;return[t/i,n/i,r/i]}var Ap=new WeakMap;function jp(e){let t=Ap.get(e);if(!t){let n=e.pos,r=0,i=0,a=0,o=n.length/3||1;for(let e=0;e<n.length;e+=3)r+=n[e],i+=n[e+1],a+=n[e+2];t=[r/o,i/o,a/o],Ap.set(e,t)}return t}var Mp=new G,Np=new U,Pp=class extends Y{zone;pick;constructor(e,t,n){super(e),this.zone=t,this.pick=n}accepts(e,t,n){return Np.set(e,t,n).applyMatrix4(this.m),this.pick(Np.x,Np.y,Np.z)===this.zone}add(e,t,n,r={}){let i=jp(t);return Mp.copy(this.m),n&&Mp.multiply(n),Np.set(i[0],i[1],i[2]).applyMatrix4(Mp),this.pick(Np.x,Np.y,Np.z)===this.zone?super.add(e,t,n,r):this}};function Fp(e,t,n,r){return!(e instanceof Pp)||e.accepts(t,n,r)}var Ip=(e,t,n)=>new G().makeTranslation(e,t,n);function Lp(e,t,n){let r=op(sp(t));if(r.length<3)return 0;let i=1/0,a=-1/0,o=1/0,s=-1/0;for(let e of r)i=Math.min(i,e[0]),a=Math.max(a,e[0]),o=Math.min(o,e[1]),s=Math.max(s,e[1]);let c=n.gridU??0,l=n.gridV??0,u=Math.floor(i-c),d=Math.floor(o-l),f=Math.ceil(a-c)-u,p=Math.ceil(s-l)-d;if(f<=0||p<=0)return 0;let m=f*p,h=new Uint8Array(m),g=new Uint8Array(m),_=Array(m).fill(null);for(let e=0;e<p;e++){let t=d+e+l;for(let i=0;i<f;i++){let a=u+i+c,o=e*f+i,s=0,l=a+.5,d=t+.5;if(+!!dp(r,a,t)+ +!!dp(r,a+1,t)+ +!!dp(r,a+1,t+1)+ +!!dp(r,a,t+1)==4)s=2;else{let e=up([[a,t],[a+1,t],[a+1,t+1],[a,t+1]],r);if(e.length>=3&&ap(e)>.05){s=1;let t=cp(e);l=t[0],d=t[1]}}if(!s||n.mask&&n.mask(l,d))continue;let p=n.style(l,d);p&&(h[o]=s,_[o]=p)}}let v=n.module??1<<20,y=n.period??1<<20,b=n.shuffle??.5,x=n.lift??0,S=e.chamfer,C=n.minArea??.08,w=0,T=(e,t,n,r,i,a)=>{if(e+n>a||t+r>p)return!1;for(let a=t;a<t+r;a++)for(let t=e;t<e+n;t++){let e=a*f+t;if(!h[e]||g[e]||_[e]!==i)return!1}return!0},E=Math.floor((u+c)/v),D=Math.floor((u+c+f-1)/v);for(let t=E;t<=D;t++){let i=new au(Math.floor(cu((t%y+y)%y,n.seed,911)*4294967296)>>>0),a=Math.max(0,Math.ceil(t*v-c)-u),o=Math.min(f,Math.ceil((t+1)*v-c)-u);for(let t=0;t<p;t++)for(let s=a;s<o;s++){let a=t*f+s;if(!h[a]||g[a])continue;let p=_[a],m=p.sizes.map((e,t)=>({sz:e,w:t+i.next()*p.sizes.length*b})).sort((e,t)=>e.w-t.w).map(e=>e.sz),v=1,y=1;for(let[e,n]of m)if(T(s,t,e,n,p,o)){v=e,y=n;break}let E=!0;for(let e=t;e<t+y;e++)for(let t=s;t<s+v;t++){let n=e*f+t;g[n]=1,h[n]!==2&&(E=!1)}Rp(e,p,u+s+c,d+t+l,v,y,E,r,i,S,x,n.studs??!0,C,h,f,s,t)&&w++}}return w}function Rp(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h,g){let _=t.key;t.mottle&&c.chance(t.mottleP??.1)&&(_=t.mottle);let v=t.kind??`tile`,y=t.hP??(v===`raised`?2:v===`tall`?3:1),b=y*yu;if(!Fp(e,n+i/2,u+b/2,r+a/2))return!1;let x=v===`tile`||v===`plate`||v===`grille`;if(o){let o=i-2*xu,s=a-2*xu,c=t.flat?x?vp(o,s,b):yp(o,s,b,0):v===`grille`?xp(o,s,b,l):yp(o,s,b,l);return e.add(_,c,Ip(n+i/2,u,r+a/2)),v===`plate`&&d&&!t.flat&&e.studs(_,n,y+u/yu,r,i,a),!0}let S=up([[n,r],[n+i,r],[n+i,r+a],[n,r+a]],s);if(S.length<3||ap(S)<f)return!1;let C=fp(op(S),.012)??S;if(e.add(_,t.flat?x?gp(C,b):hp(C,b,0):hp(C,b,l),u?Ip(0,u,0):void 0),v===`plate`&&d&&!t.flat)for(let t=0;t<a;t++)for(let a=0;a<i;a++)p[(g+t)*m+(h+a)]===2&&e.stud(_,n+a+.5,b+u,r+t+.5);return!0}function zp(e,t,n){let r=kp(t),i=n.origin??t[0],a=n.uDir??[t[1][0]-t[0][0],t[1][1]-t[0][1],t[1][2]-t[0][2]],o=n.vToward;if(!o){let e=0,n=0,r=0;for(let i of t)e+=i[0],n+=i[1],r+=i[2];o=[e/t.length,n/t.length,r/t.length]}let s=Ep(i,a,r,n.outward,o),c=t.map(e=>Dp(s,e)),l=n.worldMask;return e.push(),e.apply(s.m),Lp(e,c,{...n,mask:l?(e,t)=>l(Op(s,e,t))||(n.mask?.(e,t)??!1):n.mask}),e.pop(),s}function Bp(e,t,n){return cu(Math.floor(e),Math.floor(t),Math.floor(n))}var Vp=8,Hp=new G().makeRotationX(Math.PI/2),Up=200,Wp=-186,Gp=[0,0,Up],Kp=[18,16],qp=[0,16],Jp=[96,2],Yp=[96,-3],Xp=[90,-3],Zp=[90,-10],Qp=[93.5,-10],$p=[93.5,-14],em=[20,-32],tm=[0,-32],nm=[Kp,Jp,Yp,Xp,Zp,Qp,$p,em],rm=(e,t=1)=>[e[0]*t,e[1],Wp],im=e=>(Up-e)/386,am=(e,t,n=1)=>{let r=im(t);return[e[0]*r*n,Gp[1]+(e[1]-Gp[1])*r,t]},om=(Kp[1]-Jp[1])/(Jp[0]-Kp[0]);function sm(e,t){let n=im(t),r=Math.abs(e);return r<=Kp[0]*n?Kp[1]*n:Kp[1]*n-(r-Kp[0]*n)*om}var cm=-50,lm=24,um=op([[lm,cm],[-24,cm],[-50,Wp],[50,Wp]]),dm=7.6,fm=25,pm=31,mm=-112,hm=op([[18,mm],[-18,mm],[-34,Wp],[34,Wp]]),gm=52,_m=[52,54.2,57.6,59.2],vm=14,ym=[[10,-184],[18,-184],[18,-146],[15.8,-140],[12.2,-140],[10,-146]],bm=op([[4.5,-180],[23.5,-180],[23.5,-158],[20.5,-150],[7.5,-150],[4.5,-158]]),xm=op([[6.5,-184],[6.5,-152],[-6.5,-152],[-6.5,-184]]),Sm=36,Cm=e=>e===`front`?18:e===`rear`?0:8,wm=e=>e===`front`?7:e===`rear`?0:3,Tm=e=>e===`front`?3:e===`rear`?0:1.2,Em=e=>e===`rear`?1.4:e===`side`?1.2:e===`front`?9:6.5,Dm=e=>e===`rear`?[]:e===`front`?[8,14,20]:[7,12],Om=e=>e===`rear`?[6,14]:[5,11,17];function km(e,t,n=0){if(t>cm-n)return!1;let r=lm+26*((t-cm)/-136)-n;return Math.abs(e)<r}var Am=[[-62,0],[-90,0],[-118,0],[-146,0]].map(([e])=>[96*im(e)-27,e]);function jm(e){let t=e===0,n=t?[[4,2],[6,2],[3,2],[8,2],[2,2],[4,1],[6,1],[4,4],[2,1],[3,1],[1,1]]:[[16,8],[12,8],[8,8],[16,4],[12,4],[8,4],[6,4],[4,4],[8,2],[4,2],[2,2],[4,1],[2,1],[1,1]],r=t?[[6,4],[8,4],[4,4],[6,2],[8,2],[4,2],[2,2],[4,1],[2,1],[1,1]]:[[16,16],[16,8],[12,8],[8,8],[16,4],[8,4],[4,4],[8,2],[4,2],[2,2],[4,1],[2,1],[1,1]],i=t?[[8,1],[6,1],[4,1],[3,1],[2,1],[1,1]]:[[16,1],[12,1],[8,1],[4,1],[2,1],[1,1]],a=t?[[8,2],[6,2],[4,2],[8,1],[6,1],[4,1],[2,2],[2,1],[1,1]]:[[16,2],[12,2],[8,2],[16,1],[8,1],[4,2],[4,1],[2,1],[1,1]],o=t?[[1,8],[1,6],[1,4],[1,3],[1,2],[1,1]]:[[1,16],[1,8],[1,4],[1,2],[1,1]],s=t?[[8,2],[6,2],[4,2],[3,2],[2,2],[8,1],[6,1],[4,1],[3,1],[2,1],[1,1]]:[[11,8],[11,4],[8,8],[8,4],[4,4],[8,2],[4,2],[2,2],[4,1],[2,1],[1,1]],c=t?[[4,2],[2,2],[6,2],[3,2],[2,1],[1,1]]:[[8,4],[4,4],[4,2],[2,2],[2,1],[1,1]],l=(e,n,r={})=>({key:e,sizes:n,flat:!t,...r});return{field:l(`white`,n,{mottle:`lbg`,mottleP:t?.07:.05}),fieldL:l(`lbg`,n,{mottle:`white`,mottleP:.05}),fieldBig:l(`lbg`,r,{mottle:`white`,mottleP:.06}),fieldBigW:l(`white`,r,{mottle:`lbg`,mottleP:.06}),panelL:l(`lbg`,n),panelW:l(`white`,n),panelD:l(`dbg`,n),raisedL:l(`lbg`,n,{kind:`raised`}),raisedW:l(`white`,n,{kind:`raised`}),raisedD:l(`dbg`,n,{kind:`raised`}),plateL:l(`lbg`,c,{kind:t?`plate`:`tile`}),plateD:l(`dbg`,c,{kind:t?`plate`:`tile`}),plateW:l(`white`,c,{kind:t?`plate`:`tile`}),grilleD:l(`dbg`,[[2,1],[1,1]],{kind:t?`grille`:`tile`}),grilleL:l(`lbg`,[[2,1],[1,1]],{kind:t?`grille`:`tile`}),grilleDv:l(`dbg`,[[1,2],[1,1]],{kind:t?`grille`:`tile`}),trim:l(`lbg`,i),trimW:l(`white`,i),trimD:l(`dbg`,i),seam:l(`lbg`,o),seamD:l(`dbg`,o),red:l(`darkRed`,a),redRaised:l(`darkRed`,a,{kind:`raised`}),rail:l(`dbg`,i,{kind:`raised`}),railTile:l(`dbg`,i),door:l(`darkRed`,s),doorRib:l(`darkRed`,o,{kind:t?`plate`:`raised`,hP:2}),black:l(`black`,a),blackF:l(`black`,n),winLit:l(`windowWarm`,[[1,1]]),winCool:l(`windowCool`,[[1,1]]),winFrame:l(`dbg`,[[1,1]]),winFrameW:l(`white`,[[1,1]]),trench:l(`dbg`,r),trenchL:l(`lbg`,a),ventral:l(`lbg`,r,{mottle:`white`,mottleP:.05}),ventralW:l(`white`,r),ventralD:l(`dbg`,r)}}function Mm(e,t,n,r,i,a){let o=Math.floor(e/r),s=Math.floor(t/i),c=(o%5+5)%5;if(Bp(c,s,n)>.5)return null;let l=3+Math.floor(Bp(c,s,n+1)*3)*3,u=2+Math.floor(Bp(c,s,n+2)*Math.max(1,i-2)),d=Math.floor(Bp(c,s,n+3)*Math.max(1,r-l+1)),f=Math.floor(Bp(c,s,n+4)*Math.max(1,i-u+1)),p=e-o*r,m=t-s*i;return p>=d&&p<d+l&&m>=f&&m<f+u?a(Bp(c,s,n+5)):null}function Nm(e,t,n,r){let i=kp(e),a=n??[e[1][0]-e[0][0],e[1][1]-e[0][1],e[1][2]-e[0][2]],o=r;if(!o){let t=0,n=0,r=0;for(let i of e)t+=i[0],n+=i[1],r+=i[2];o=[t/e.length,n/e.length,r/e.length]}return Ep(e[0],a,i,t,o)}function Pm(e,t,n){e.push(),e.apply(t.m),n(),e.pop()}var Fm=-53.2,Im=Ep(Gp,[0,qp[1]-Gp[1],-386],[0,386,qp[1]-Gp[1]],[0,1,0],[10,0,0]),Lm=Dp(Im,am(qp,Fm))[0],Rm=Kp[0]*im(Fm),zm=e=>Rm*e/Lm;function Bm(e,t,n,r){let i=t.fine,a=[...nm.map(([e,t])=>[-e,t]),...nm.slice().reverse()];e.add(`dbg`,Sp([0,-.05,196.5],pp(a,a.map(()=>.45)),-185.55)),Pm(e,Im,()=>{let r=Math.ceil(1.5*Lm/Rm);if(Lp(e,[[r,-.5],[Lm,-.5],[Lm,.5],[r,.5]],{seed:t.seed*5+3,style:()=>n.black,gridV:.5,module:8}),i)for(let t=r+3;t<Lm-2;t+=6)Fp(e,t,.4,0)&&e.add(`windowWarm`,Jm(.24,.14,12),new G().makeTranslation(t,.4,0))});for(let i of[1,-1])e.push(),i<0&&e.mirrorX(),Vm(e,t,n,i,r),e.pop();Hm(e,t,n),Um(e)}function Vm(e,t,n,r,i){let a=t.fine,o=a&&r>0,s=t.seed*97+13;i.frames[r>0?`deckP`:`deckS`]=Im,Pm(e,Im,()=>{if(Lp(e,[[0,0],[Lm,0],[Lm,Rm]],{seed:s+1,module:12,period:4,studs:a,gridV:.5,mask:(e,t)=>t<.5,style:(e,t)=>{let r=zm(e)-t,i=(e%12+12)%12;return r<1?n.rail:r<2?i<2?n.grilleD:n.railTile:i<1?n.doorRib:n.door}}),a)for(let t=36;t<Lm-3;t+=12){let n=zm(t)-2.3;Fp(e,t,.8,n)&&(e.box(`dbg`,t+.5,.4+.2,n,1,.4,1.4),e.cyl(`flatSilver`,t+.5,1.05,n+.25,.2,.9,{axis:`x`,radial:8}),e.box(`dbg`,t+.5,.9,n-.45,.8,.5,.4))}});let c=[Gp,rm(Jp),rm(Kp)],l=Nm(c,[0,1,0]);i.frames[r>0?`dorsalP`:`dorsalS`]=l;let u=new U(22,0,2);u.y=sm(u.x,u.z);let d=Dp(l,u),f=Am.map(([e,t])=>Dp(l,[e,sm(e,t),t]));Pm(e,l,()=>{let t=c.map(e=>Dp(l,e));if(Lp(e,t,{seed:s+2,module:16,period:5,studs:a,mask:(e,t)=>{let n=Op(l,e,t);if(km(n.x,n.z,.6))return!0;let r=e-d[0],i=t-d[1];return r*r+i*i<67.24},style:(e,r)=>{if(r<1)return n.trim;if(r<2&&e>40)return n.trimD;for(let t=0;t<4;t++){let i=5+t*4;if(r>=i&&r<i+2&&e>=236+t*14)return n.red}for(let[t,i]of f)if(Math.abs(e-t)<5&&Math.abs(r-i)<5)return a?n.plateD:n.panelD;if((e%32+32)%32<1&&e>24)return n.seam;let i=e*(t[2][1]/t[2][0]);return a&&r>i-3&&e>30?Math.floor(e/6)%3==0?n.grilleL:n.panelL:Mm(e,r-2,s+3,16,6,e=>e<.52?n.panelL:e<.66?n.raisedL:e<.8?n.plateL:e<.9?n.raisedW:n.panelD)??n.field}}),Fp(e,d[0],.4,d[1])){let t=d;e.add(`white`,Jm(7.6,.4,a?40:20),new G().makeTranslation(t[0],0,t[1])),e.add(`darkRed`,Jm(6.3,.8,a?40:20),new G().makeTranslation(t[0],0,t[1]));for(let n of[.35,Math.PI+.35])e.add(`yellow`,Ym(3.7,5.3,1.05,n,n+Math.PI-.7,a?20:10),new G().makeTranslation(t[0],0,t[1]));e.add(`darkRed`,Jm(2.2,1,a?20:12),new G().makeTranslation(t[0],0,t[1]))}});for(let t=0;t<Am.length;t++){let[n,o]=Am[t],s=sm(n,o)+.4;r>0?i.turretMuzzles.push([n+1.1,s+1.95,o+10.4],[n-1.1,s+1.95,o+10.4]):i.turretMuzzles.push([-n+1.1,s+1.95,o+10.4],[-n-1.1,s+1.95,o+10.4]),Fp(e,n,s,o)&&e.at(n,s,o,()=>Km(e,a,r))}let p=[Gp,rm(Jp),rm(Yp)],m=Nm(p,[1,0,0]);Pm(e,m,()=>{let t=p.map(e=>Dp(m,e)),r=t[1][0],i=Math.ceil(r*.44);Lp(e,t,{seed:s+4,module:16,period:4,style:(e,t)=>t<1?n.trimW:e<30?n.red:t<2&&e>i?n.black:n.trim}),Gm(e,i+2,r-2,1.5,o?2:4,.8,Bp(s,4,1),`windowWarm`,!a)});let h=[Gp,rm(Yp),rm(Xp)],g=Nm(h,[0,-1,0]);Pm(e,g,()=>Lp(e,h.map(e=>Dp(g,e)),{seed:s+5,module:16,style:()=>n.trench}));let _=[Gp,rm(Xp),rm(Zp)],v=Nm(_,[1,0,0]),y=Dp(v,rm(Xp))[0],b=[y-70,y-42];Pm(e,v,()=>{Lp(e,_.map(e=>Dp(v,e)),{seed:s+6,module:8,period:6,studs:a,mask:e=>e>b[0]&&e<b[1],style:(e,t)=>{let r=7*e/y;return t<1&&r>2?n.trimD:(Math.floor(e/8)+Math.floor(t/2))%5==0?n.grilleD:n.trench}}),Wm(e,t,n,r,o,y,b,s)});let x=[Gp,rm(Zp),rm(Qp)],S=Nm(x,[0,1,0]);Pm(e,S,()=>{let t=x.map(e=>Dp(S,e));Lp(e,t,{seed:s+7,module:12,style:e=>Math.floor(e/12)%2?n.trenchL:n.trench});let r=a?9:5;for(let n=0;n<r;n++){let i=110+n*(y-150)/(r-1),o=i*(t[2][1]/t[2][0]);Fp(e,i,.4,o*.5)&&e.at(i,.4,o*.5,()=>qm(e,a))}});let C=[Gp,rm(Qp),rm($p)],w=Nm(C,[1,0,0]);Pm(e,w,()=>{let t=C.map(e=>Dp(w,e)),r=t[1][0],i=Math.ceil(r*.56);Lp(e,t,{seed:s+8,module:16,period:4,style:(e,t)=>t<1?n.trimD:e<26?n.red:t<2&&e>i?n.black:n.trimW}),Gm(e,i+2,r-2,1.5,o?3:5,.6,Bp(s,8,1),`windowWarm`,!a)});let T=[Gp,rm($p),rm(em)],E=Nm(T,[.3,-1,0]);Pm(e,E,()=>{Lp(e,T.map(e=>Dp(E,e)),{seed:s+9,module:24,period:5,style:(e,t)=>t<1?n.trim:e<34?n.red:(e%48+48)%48<1?n.seamD:Mm(e,t,s+10,24,8,e=>e<.55?n.ventralW:e<.8?n.ventralD:n.raisedL)??n.ventral})});let D=Wp;[[[0,-3,D],[96,-3,D],[96,2,D],[18,16,D],[0,16,D]],[[0,-10,D],[90,-10,D],[90,-3,D],[0,-3,D]],[[0,-32,D],[20,-32,D],[93.5,-14,D],[93.5,-10,D],[0,-10,D]]].forEach((t,r)=>{zp(e,t,{seed:s+20+r,outward:[0,0,-1],uDir:[1,0,0],module:12,period:3,studs:a,worldMask:e=>Math.abs(e.x)<49.5&&e.y>7.8999999999999995||Math.abs(e.x)<5,style:(e,t)=>Mm(e,t,s+30,12,4,e=>e<.6?n.panelL:n.panelD)??(r===1?n.trench:n.fieldL)})})}function Hm(e,t,n){let r=t.fine,i=[Gp,rm(em),rm(em,-1)],a=Nm(i,[0,-1,0],[0,tm[1]-Gp[1],-386],[0,0,0]),o=[150,205];Pm(e,a,()=>{Lp(e,i.map(e=>Dp(a,e)),{seed:t.seed*31+5,module:24,period:4,studs:r,style:(e,t)=>{let r=Math.abs(t);return e<34?n.red:e>o[0]&&e<o[1]&&r<7?e<o[0]+1||e>o[1]-1||r>6?n.raisedD:r<.5?n.black:n.panelD:e>o[1]&&e<o[1]+12&&r<6?n.grilleDv:r<3?n.trimD:n.ventral}})})}function Um(e){let t=7/386,n=[...nm.map(([e,n])=>[-e*t,n*t]),...nm.slice().reverse().map(([e,n])=>[e*t,n*t])],r=pp(n,n.map(()=>-.42));e.add(`darkRed`,Sp([0,0,200.6],r,193))}function Wm(e,t,n,r,i,a,o,s){let c=t.fine,l=e=>7*e/a,u=e=>6*e/a,d=i?7:c?14:28;for(let t=70;t<a-4;t+=d){if(t+d>o[0]-1&&t<o[1]+1)continue;let n=l(t),r=u(t);if(n<2.2||!Fp(e,t+d/2,.5,n/2))continue;let a=new au(Math.floor(Bp(t,1,s)*1e9));if(e.box(`dbg`,t+.5,Math.min(r*.5,1.2)/2+.4,n/2,1,Math.min(r*.5,1.2),n-.2,{hide:{ny:!0}}),!c)continue;let f=Math.floor(Bp(t%49,3,s)*5),p=t+1.2,m=t+d-.2,h=Math.min(r*.55,2.2);if(f===0||!i){let t=n>4.5?2:1;for(let n=0;n<t;n++){let t=1.2+n*1.6;e.cyl(`gunmetal`,(p+m)/2,.7,t,.3,m-p,{axis:`x`,radial:i?10:6})}if(i)for(let t=p+1;t<m;t+=2.5)e.box(`lbg`,t,.75,1.2,.5,.7,.9)}else if(f===1){let t=p;for(;t<m-.8;){let r=Math.min(m-t,a.pick([1,2,2,3])),i=a.range(1,Math.max(1.2,n-1.4)),o=a.range(.4,h);e.box(a.pick([`lbg`,`dbg`,`dbg`,`white`,`gunmetal`]),t+r/2,.4+o/2,.8+i/2,r-.08,o,i,{hide:{ny:!0}}),t+=r}}else if(f===2){let t=n>5?2:1;for(let n=0;n<t;n++){let t=1.3+n*2;e.add(`black`,yp(m-p,1,.4,.03),new G().makeTranslation((p+m)/2,.4,t).multiply(new G().makeRotationX(0)));for(let n=p+.5;n<m-.4;n+=1.5)e.add(`windowWarm`,yp(.8,.6,.45,.02),new G().makeTranslation(n,.4,t))}}else if(f===3){for(let t=p;t<m-1;t+=2)for(let r=.8;r<n-1.2;r+=1.1)e.add(`dbg`,xp(1.9,1,.4,.03),new G().makeTranslation(t+1,.4,r+.5));e.cyl(`lbg`,(p+m)/2,.8+h*.3,n*.55,.9,h*.6,{radial:12})}else{let t=Math.min(n*.5,2.4);e.cyl(`lbg`,(p+m)/2,.4+Math.min(1,h/2),t,Math.min(1,h/2),m-p-.4,{axis:`x`,radial:12});for(let n=p+1;n<m;n+=2.2)e.box(`dbg`,n,.4+Math.min(1,h/2),t,.4,Math.min(2.2,h+.2),2.2)}}let[f,p]=o,m=l(f),h=3.5*f/a,g=(e,t,n)=>new G().makeTranslation(e,t,n);if(Fp(e,(f+p)/2,.5,m/2)){if(e.box(`dbg`,f-.6,h/2,m/2,1.2,h,m,{hide:{ny:!0}}),e.box(`dbg`,p+.6,h/2,m/2,1.2,h,m,{hide:{ny:!0}}),e.box(`lbg`,(f+p)/2,h/2,.45,p-f+2.4,h,.9,{hide:{ny:!0}}),r>0){let t=m-1.3;e.add(`lbg`,yp(p-f,t,.2,.02),g((f+p)/2,0,.9+t/2));for(let n=f+2;n<p-1;n+=3)e.box(`dbg`,n,.4,.9+t/2,.5,.4,t,{hide:{ny:!0}});for(let t=f+1;t<p-1.5;t+=1.5)e.add(`windowWarm`,yp(1,.45,.3,.02),g(t+.5,.05,1.7));for(let t=f+1.5;t<p-1;t+=3)e.box(`glowWhite`,t,h*.55,.95,1.8,.35,.1,{c:0});for(let t of[.35,.75])e.box(`yellow`,(f+p)/2,h*t,m-.45,p-f-1,.22,.08,{c:0});for(let t=f+3;t<p-2;t+=7)e.box(`dbg`,t,h*.3,m-.9,1.2,.8,.9);e.add(`trLightBlue`,yp(p-f,m-1.3,.06,0),g((f+p)/2,h-.1,.9+(m-1.3)/2))}else{for(let t=f;t<p-.1;t+=2)e.box(`dbg`,t+1,h*.45,.9+(m-1.3)/2,1.94,.5,m-1.3,{hide:{ny:!0}});e.box(`yellow`,(f+p)/2,h*.45+.27,m-1.2,p-f-.4,.06,.3,{c:0})}}if(Fp(e,150,1,l(150)/2)){e.push(),e.translate(150,.4,l(150)*.5),e.cyl(`dbg`,0,.3,0,1.2,.6,{radial:12}),e.box(`lbg`,0,1,0,2,1.2,1.6),e.box(`dbg`,-1.1,1,0,.4,.9,1.4);for(let t of[-.45,.45])e.cyl(`gunmetal`,-2.6,1,t,.16,3,{axis:`x`,radial:8});e.pop()}}function Gm(e,t,n,r,i,a,o,s=`windowWarm`,c=!1){c&&(i*=2,a*=2);let l=c?gp([[-a/2,-.21],[a/2,-.21],[a/2,.21],[-a/2,.21]],.5):yp(a,.42,.47,.02),u=Math.floor(o*1e6);for(let a=t;a<n;a+=i)Bp(a*4,r*10,u)<.2||Fp(e,a,.4,r)&&e.add(s,l,new G().makeTranslation(a,0,r))}function Km(e,t,n){let r=t?24:12;e.cyl(`dbg`,0,-1.3,0,3.4,2.6,{radial:r,bottom:!1}),e.cyl(`lbg`,0,.2,0,3.05,.4,{radial:r}),e.push(),e.rotateY(Math.PI/2),e.prism(`white`,[[-3.5,.4],[2.5,.4],[3.1,1.3],[1.9,2.9],[-2.7,2.9],[-3.5,2.1]].map(([e,t])=>[-e,t]),5.4),e.prism(`dbg`,[[-3.2,.5],[2.3,.5],[2.8,1.25],[1.8,2.5],[-2.5,2.5],[-3.2,1.9]].map(([e,t])=>[-e,t]),5.9),e.pop(),t&&(e.add(`lbg`,yp(3.2,3.6,.4,.035),new G().makeTranslation(0,2.9,-.6)),e.add(`dbg`,xp(2,1,.4,.03),new G().makeTranslation(0,2.9,-2.4)),e.cyl(`lbg`,1.6*n,3.3,.8,.45,.4,{radial:10}),e.box(`dbg`,-1.8*n,3.1,-1.4,.8,.4,1.6)),e.box(`dbg`,0,1.95,2.7,4,1.6,1);for(let n of[1.1,-1.1])e.cyl(`dbg`,n,1.95,3.9,.62,2,{axis:`z`,radial:t?12:8}),e.cyl(`gunmetal`,n,1.95,7,.32,6.6,{axis:`z`,radial:t?10:6}),t&&e.cyl(`dbg`,n,1.95,6.6,.42,.5,{axis:`z`,radial:10}),e.cyl(`flatSilver`,n,1.95,10.1,.44,.6,{axis:`z`,radial:t?10:6})}function qm(e,t){e.cyl(`dbg`,0,.2,0,.9,.4,{radial:t?12:8}),e.box(`lbg`,0,.85,0,1.4,.9,1.4),e.cyl(`gunmetal`,.32,.95,1.4,.13,2,{axis:`z`,radial:6}),e.cyl(`gunmetal`,-.32,.95,1.4,.13,2,{axis:`z`,radial:6})}function Jm(e,t,n){let r=new Hl,i=Math.min(.06,t*.3),a=Xl([[0,t],[e-i,t],[e,t-i],[e,0]],35);for(let e=0;e<n;e++){let t=e/n*Math.PI*2,i=(e+1)/n*Math.PI*2;for(let e of a){let[n,a,o,s,c,l,u,d]=e,f=(e,t,n)=>[e*Math.sin(n),t,e*Math.cos(n)],p=(e,t,n)=>[e*Math.sin(n),t,e*Math.cos(n)];r.quad(f(n,a,t),f(n,a,i),f(c,l,i),f(c,l,t),p(o,s,t),p(o,s,i),p(u,d,i),p(u,d,t))}}return r.done()}function Ym(e,t,n,r,i,a){let o=new Hl,s=(e,t,n)=>[e*Math.sin(t),n,e*Math.cos(t)];for(let c=0;c<a;c++){let l=r+(i-r)*c/a,u=r+(i-r)*(c+1)/a;o.quad(s(e,l,n),s(t,l,n),s(t,u,n),s(e,u,n),[0,1,0]);let d=[Math.sin(l),0,Math.cos(l)],f=[Math.sin(u),0,Math.cos(u)];o.quad(s(t,l,0),s(t,u,0),s(t,u,n),s(t,l,n),d,f,f,d);let p=[-d[0],0,-d[2]],m=[-f[0],0,-f[2]];o.quad(s(e,l,0),s(e,u,0),s(e,u,n),s(e,l,n),p,m,m,p)}for(let[a,c]of[[r,-1],[i,1]]){let r=[Math.cos(a)*c,0,-Math.sin(a)*c];o.quad(s(e,a,0),s(t,a,0),s(t,a,n),s(e,a,n),r)}return o.done()}var Xm=(e,t)=>[e[0],t,e[1]];function Zm(e,t,n,r){let i=op(e),a=pp(i,n),o=[];for(let e=0;e<i.length;e++){let n=(e+1)%i.length;o.push([Xm(i[e],t),Xm(i[n],t),Xm(a[n],r),Xm(a[e],r)])}return{top:a,faces:o}}function Qm(e,t){let n=0,r=0,i=0;for(let t of e)n+=t[0],r+=t[1],i+=t[2];return[n/e.length-t[0],r/e.length-t[1],i/e.length-t[2]]}function $m(e){return e.map((t,n)=>{let r=e[(n+1)%e.length],i=r[0]-t[0],a=r[1]-t[1],o=Math.hypot(i,a)||1,s=a/o,c=-i/o;return c>.95?`front`:c<-.95?`rear`:Math.abs(s)>.95?`side`:c>0?`bevel`:`side`})}function eh(e,t,n,r,i,a=.45){let o=op(t),s=o.map(()=>a);e.add(`dbg`,Cp(pp(o,s),n,pp(r,s),i-a))}function th(e,t){let n=1/0,r=-1/0;for(let i=0;i<e.length;i++){let a=e[i],o=e[(i+1)%e.length];if((a[1]-t)*(o[1]-t)>0)continue;if(Math.abs(o[1]-a[1])<1e-9){n=Math.min(n,a[0],o[0]),r=Math.max(r,a[0],o[0]);continue}let s=a[0]+(o[0]-a[0])*(t-a[1])/(o[1]-a[1]);n=Math.min(n,s),r=Math.max(r,s)}return n<r?[n,r]:null}function nh(e,t,n,r,i,a,o,s){for(let c of n){let n=th(t,c+.05),l=th(t,c+.95);n&&l&&Gm(e,Math.max(n[0],l[0])+1.2,Math.min(n[1],l[1])-1.2,c+.5,r,i,Bp(a,c,3),o,s)}}function rh(e,t,n){let r=zp(e,t,{seed:n.seed,outward:n.outward,module:n.module,period:n.period,studs:n.studs,style:n.style});if(!n.lit||!n.bands.length)return r;let i=t.map(e=>Dp(r,e));return Pm(e,r,()=>nh(e,i,n.bands,n.step,n.w,n.seed,n.winKey,!!n.flat)),r}function ih(e,t,n,r){let i=t.fine,a=t.seed*53+7,o=$m(um),s=Zm(um,dm,o.map(Cm),fm);eh(e,um,dm,s.top,fm);let c=[0,32.6/2,-118];s.faces.forEach((t,r)=>{let s=o[r],l=Dm(s),u=s===`front`?23:17;rh(e,t,{seed:a+r,outward:Qm(t,c),module:12,period:4,studs:i,bands:l,lit:!0,flat:!i,step:2,w:.8,style:(e,t)=>{if(t<1.5)return n.trimD;if(s===`rear`)return Mm(e,t,a+9,12,4,e=>e<.6?n.panelL:n.panelD)??n.fieldL;let i=Math.floor(t);return l.includes(i)?n.black:l.includes(i-1)?n.trimD:t>=u?n.trim:Mm(e,t,a+10+r,12,5,e=>e<.55?n.panelL:e<.75?n.raisedL:n.plateL)??n.field}})});let l=(e,t,n=.4)=>{if(t>mm-n)return!1;let r=(t-mm)/-74;return Math.abs(e)<18+16*r-n};zp(e,s.top.map(e=>Xm(e,fm)),{seed:a+20,outward:[0,1,0],uDir:[0,0,-1],module:12,period:3,studs:i,worldMask:e=>l(e.x,e.z),style:(e,t)=>e<1?n.trimD:e<3?n.grilleD:Mm(e,t+40,a+21,12,6,e=>e<.4?n.plateL:e<.7?n.panelD:n.grilleD)??n.fieldL});for(let[t,n]of[[20,-100],[31,-150],[36,-176]])for(let r of[1,-1])Fp(e,t*r,fm,n)&&e.at(t*r,25.4,n,()=>qm(e,i));if(i)for(let t of[1,-1])e.cyl(`dbg`,8*t,25.6,-84,2.2,.4,{radial:20}),e.lathe(`white`,Xl([[0,1.9],[1.2,1.55],[1.8,.8],[2,0]]),{at:[8*t,25.8,-84],radial:20});let u=$m(hm),d=Zm(hm,fm,u.map(wm),pm);eh(e,hm,fm,d.top,pm);let f=[0,28,-150];d.faces.forEach((t,r)=>{let o=u[r],s=o===`rear`?[]:[3];rh(e,t,{seed:a+30+r,outward:Qm(t,f),module:8,period:3,studs:i,bands:s,lit:!0,flat:!i,winKey:`windowCool`,step:1.5,w:.6,style:(e,t)=>t<1?n.trimD:s.includes(Math.floor(t))?n.black:o===`rear`?n.fieldL:Mm(e,t,a+31+r,8,3,e=>e<.6?n.panelL:n.raisedW)??n.field})});let p=(e,t)=>{let n=Math.abs(e);return n>9.7&&n<18.3&&t<-140&&t>-184.5},m=(e,t)=>Math.abs(e)<6.6&&t<-151.9&&t>-184.5;zp(e,d.top.map(e=>Xm(e,pm)),{seed:a+40,outward:[0,1,0],uDir:[0,0,-1],module:8,studs:i,worldMask:e=>p(e.x,e.z)||m(e.x,e.z),style:(e,t)=>e<1?n.trimD:Mm(e,t,a+41,8,4,e=>e<.45?n.plateL:e<.7?n.grilleL:n.panelD)??n.fieldL});let h=Sm,g=Zm(xm,pm,$m(xm).map(Tm),h);eh(e,xm,pm,g.top,h);let _=[0,33.5,-168];g.faces.forEach((t,r)=>rh(e,t,{seed:a+50+r,outward:Qm(t,_),module:6,studs:i,bands:[2],lit:!0,flat:!i,winKey:`windowCool`,step:1.5,w:.6,style:(e,t)=>t<1?n.trimD:t>=2&&t<3?n.black:n.fieldL})),zp(e,g.top.map(e=>Xm(e,h)),{seed:a+55,outward:[0,1,0],uDir:[0,0,1],studs:i,style:(e,t)=>Math.abs(t-5.3)<1?n.grilleD:Bp(Math.floor(e/3),Math.floor(t/3),a+56)<.3?n.plateL:n.fieldL}),i&&(e.cyl(`lbg`,0,39.6,-178,.28,6.4,{radial:10}),e.cyl(`flatSilver`,0,43.3,-178,.14,1,{radial:8}),e.lathe(`lbg`,Xl([[.2,.9],[1.3,.35],[1.5,0]]),{at:[0,41,-178],radial:14}),e.cyl(`dbg`,0,36.6,-160,1.9,.4,{radial:18}),e.lathe(`white`,Xl([[0,1.6],[1,1.3],[1.5,.7],[1.7,0]]),{at:[0,36.8,-160],radial:18}));for(let i of[1,-1])e.push(),i<0&&e.mirrorX(),ah(e,t,n,ym,a+100,i),e.pop(),r[i>0?`bridgeL`:`bridgeR`]=[vm*i,_m[3]+.4,-164]}function ah(e,t,n,r,i,a){let o=t.fine,s=op(r),c=$m(s),l=Zm(s,pm,c.map(Em),gm),u=[vm,83/2,-164];eh(e,s,pm,l.top,52.4),l.faces.forEach((t,r)=>{let a=c[r],s=Qm(t,u);if(a===`front`){zp(e,t,{seed:i+r,outward:s,module:4,studs:o,style:(e,t)=>t<1?n.trimD:n.grilleDv});return}let l=Om(a);rh(e,t,{seed:i+r,outward:s,module:6,period:4,studs:o,bands:l,lit:!0,flat:!o,step:a===`rear`?2.5:2,w:.6,style:(e,t)=>{if(t<1)return n.trimD;let o=Math.floor(t);return l.includes(o)?n.black:l.includes(o+1)||l.includes(o-1)?n.trim:a===`rear`?Mm(e,t,i+5,6,3,e=>e<.5?n.panelL:n.panelD)??n.fieldL:Mm(e,t,i+7+r,6,2,e=>e<.6?n.panelL:n.raisedW)??n.field}})});let[d,f,p,m]=_m,h=vm,g=bm,_=$m(g),v=pp(g,g.map(()=>3.2));zp(e,l.top.map(e=>Xm(e,gm)),{seed:i+15,outward:[0,1,0],uDir:[0,0,1],studs:o,worldMask:e=>dp(v,e.x,e.z),style:()=>n.plateL});let y=[h,(d+m)/2,-165],b=Zm(v,d,v.map(()=>-3.2),f);e.add(`dbg`,Cp(v,d,g,f)),b.faces.forEach((t,r)=>{let a=Qm(t,[y[0],f+2,y[2]]);zp(e,t,{seed:i+20+r,outward:a,module:6,style:(e,t)=>t<1?n.trimD:Math.floor(e)%6==0?n.panelD:n.panelL})});let x=Zm(g,f,g.map(()=>0),p);e.add(`dbg`,Cp(pp(g,g.map(()=>.45)),f,pp(g,g.map(()=>.45)),p)),x.faces.forEach((t,r)=>{let a=Qm(t,y),s=_[r]===`front`||_[r]===`bevel`;if(rh(e,t,{seed:i+30+r,outward:a,module:6,period:3,studs:!1,bands:s?[]:[1],lit:!0,flat:!o,winKey:`windowCool`,step:1.25,w:.55,style:(e,t)=>t<1?n.trimW:t<2.4&&(s||t<2)?n.black:n.trimW}),s){let n=Nm(t,a),r=Dp(n,t[1])[0];Pm(e,n,()=>{if(Fp(e,r/2,.3,1.7)){e.add(`windowCool`,yp(r-.6,1.1,.22,.02),new G().makeTranslation(r/2,.36,1.7));for(let t=1;t<r-.5;t+=1)e.add(`white`,yp(.16,1.2,.62,.02),new G().makeTranslation(t,.2,1.7));e.add(`trBlack`,yp(r-.4,1.4,.12,.01),new G().makeTranslation(r/2,.62,1.7))}})}});let S=Zm(g,p,g.map(()=>1.3),m);e.add(`dbg`,Cp(g,p,S.top,m-.4)),S.faces.forEach((t,r)=>zp(e,t,{seed:i+40+r,outward:Qm(t,[y[0],p-3,y[2]]),module:6,style:()=>n.fieldL})),zp(e,S.top.map(e=>Xm(e,m)),{seed:i+50,outward:[0,1,0],uDir:[0,0,1],module:6,studs:o,style:(e,t)=>Bp(Math.floor(e/3),Math.floor(t/3),i+51)<.25?n.plateL:n.fieldL}),o&&(e.cyl(`lbg`,h+3*a,m+.4+2.2,-172,.22,4.4,{radial:8}),e.cyl(`lbg`,h-2*a,m+.4+1.4,-174,.18,2.8,{radial:8}),e.box(`dbg`,h,m+.4+.3,-168,3,.6,2),e.lathe(`white`,Xl([[0,.9],[.9,.5],[1.1,0]]),{at:[h-4*a,m+.4,-160],radial:14}))}var oh=[{x:15,y:-17,r:10.5,len:14},{x:37.5,y:-14.5,r:10.5,len:14},{x:57,y:-12,r:7,len:11},{x:70,y:-8,r:4,len:8},{x:70,y:-15.5,r:4,len:8}];function sh(e,t){let n=t.fine,r=n?32:16;for(let t of[1,-1])for(let i of oh){let a=i.x*t,o=i.y,s=i.r,c=i.len;e.cyl(`dbg`,a,o,-186.3,s*.98,.8,{axis:`z`,radial:r});let l=[[s*.8,.2],[s*.8,-1.4],[s*.86,-1.8],[s*.9,-c*.4],[s*.96,-c*.75],[s,-c+.5],[s,-c],[s*.9,-c],[s*.84,-c+1.4],[s*.78,-c+3.2]];e.lathe(`pearlDarkGray`,Xl(l,30),{at:[a,o,-186.6],axis:`z`,radial:r});let u=-186.6-c,d=(t,n,i,s,c)=>e.add(t,eu(i,s,c,.04,r),new G().makeTranslation(a,o,n).multiply(Hp));if(n){for(let e of[.28,.52,.76]){let t=s*(.87+.1*e);d(`gunmetal`,-186.6-c*e,t+.2,t-.1,.6)}d(`lbg`,u+.25,s+.12,s*.9,.5)}if(e.cyl(`glowBlue`,a,o,u+3,s*.8,.3,{axis:`z`,radial:r}),e.cyl(`glowCyan`,a,o,u+2.7,s*.5,.3,{axis:`z`,radial:r}),n){d(`gunmetal`,u+2.35,s*.56,s*.5,.3);for(let t=0;t<8;t++){let n=(t+.5)/8*Math.PI*2;e.box(`gunmetal`,a+Math.cos(n)*s*.67,o+Math.sin(n)*s*.67,u+2.35,s*.05,s*.24,.3,{rot:[0,0,n-Math.PI/2]})}}}let i=4.2;if(e.box(`lbg`,0,-16,-192,i*2,26,12,{c:.1}),e.box(`dbg`,0,-16,-198.3,i*2-1.4,22,.8,{c:.08}),n){for(let t=-27;t<-5;t+=2.2)e.add(`dbg`,xp(1,2,.4,.03),new G().makeTranslation(0,t,-198.6).multiply(new G().makeRotationX(-Math.PI/2)).multiply(new G().makeRotationY(Math.PI/2)));for(let t of[-26,-6])e.box(`white`,0,t,-192,8.700000000000001,1.2,11)}e.box(`dbg`,0,-2,-191,10.4,2,10)}var ch=1e4;function Z(e,t,n,r,i,a,o,s=.4){let c=up([[r,a],[i,a],[i,o],[r,o]],t);c.length>=3&&e.add(n,gp(c,s))}function lh(e,t,n,r,i,a){let o=Nm(t,n,i,a),s=op(t.map(e=>Dp(o,e)));Pm(e,o,()=>r(s,Dp(o,t[1])[0],o))}function uh(e,t,n,r,i,a,o){for(let s=0;s*r<e;s++){let e=s%5;for(let c=0;c*i<t;c++){if(Bp(e,c,n)>.5)continue;let t=3+Math.floor(Bp(e,c,n+1)*3)*3,l=2+Math.floor(Bp(e,c,n+2)*Math.max(1,i-2)),u=Math.floor(Bp(e,c,n+3)*Math.max(1,r-t+1)),d=Math.floor(Bp(e,c,n+4)*Math.max(1,i-l+1)),f=s*r+u,p=c*i+d+a;o(f,f+t,p,p+l,Bp(e,c,n+5))}}}var dh=(e,t,n)=>{let r=Math.floor((t-1e-6)/n);return r>=1&&e<r*n+1};function fh(e,t,n){let r=t*97+13,i=[Gp,rm(Jp),rm(Kp)],a=Nm(i,[0,1,0]),o=new U(22,0,2);o.y=sm(o.x,o.z);let s=Dp(a,o),c=Am.map(([e,t])=>Dp(a,[e,sm(e,t),t])),l=(e,t)=>{let n=Op(a,e,t);return km(n.x,n.z,.6)||Math.hypot(e-s[0],t-s[1])<8.2},u=(e,t)=>{for(let n=0;n<4;n++)if(e>=235+n*14&&t>=4.5+n*4&&t<7.5+n*4)return!0;return!1};lh(e,i,[0,1,0],(t,n)=>{Z(e,t,`lbg`,0,ch,0,1),Z(e,t,`dbg`,40,ch,1,2);for(let n=0;n<4;n++)Z(e,t,`darkRed`,236+n*14,ch,5+n*4,7+n*4);for(let[n,r]of c)Z(e,t,`dbg`,n-5,n+5,r-5,r+5);for(let r=32;r<n;r+=32)Z(e,t,`lbg`,r,r+1,2,ch);uh(n,90,r+3,16,6,2,(n,r,i,a,o)=>{if(o>=.8&&o<.9)return;let s=(n+r)/2,d=(i+a)/2;if(!(i<2||l(s,d)||u(s,d)||dh(n,r,32))){for(let[e,t]of c)if(Math.abs(s-e)<7&&Math.abs(d-t)<7)return;Z(e,t,o<.8?`lbg`:`dbg`,n,r,i,a)}});let i=new G().makeTranslation(s[0],0,s[1]);e.add(`white`,Jm(7.6,.4,20),i),e.add(`darkRed`,Jm(6.3,.8,20),i);for(let t of[.35,Math.PI+.35])e.add(`yellow`,Ym(3.7,5.3,1.05,t,t+Math.PI-.7,8),i);e.add(`darkRed`,Jm(2.2,1,10),i)}),lh(e,[Gp,rm(Jp),rm(Yp)],[1,0,0],(t,n)=>{let i=Math.ceil(n*.44);Z(e,t,`darkRed`,0,30,0,ch),Z(e,t,`white`,30,ch,0,1),Z(e,t,`black`,i,ch,1,2),Gm(e,i+2,n-2,1.5,4,.8,Bp(r,4,1),`windowWarm`,!0)}),lh(e,[Gp,rm(Qp),rm($p)],[1,0,0],(t,n)=>{let i=Math.ceil(n*.56);Z(e,t,`darkRed`,0,26,0,ch),Z(e,t,`dbg`,26,ch,0,1),Z(e,t,`black`,i,ch,1,2),Gm(e,i+2,n-2,1.5,5,.6,Bp(r,8,1),`windowWarm`,!0)}),lh(e,[Gp,rm($p),rm(em)],[.3,-1,0],(t,n)=>{Z(e,t,`darkRed`,0,34,0,ch);for(let r=48;r<n;r+=48)Z(e,t,`dbg`,r,r+1,1,ch);uh(n,80,r+10,24,8,0,(n,r,i,a,o)=>{o>=.8||i<1||n<34||dh(n,r,48)||Z(e,t,o<.55?`white`:`dbg`,n,r,i,a)})}),n>0&&lh(e,[Gp,rm(Xp),rm(Zp)],[1,0,0],(t,n)=>{let r=n-70,i=n-42,a=7*r/n;Z(e,t,`lbg`,r+1,i-1,.8,a-.5),Z(e,t,`windowWarm`,r+1.5,i-1.5,a-1.2,a-.8,.6)})}function ph(e){lh(e,[Gp,rm(em),rm(em,-1)],[0,-1,0],t=>{Z(e,t,`darkRed`,0,34,-1e4,ch),Z(e,t,`dbg`,34,150,-3,3),Z(e,t,`dbg`,150,205,-7,7),Z(e,t,`black`,151,204,-.5,.5,.6),Z(e,t,`dbg`,205,217,-6,6),Z(e,t,`dbg`,217,ch,-3,3)},[0,tm[1]-Gp[1],-386],[0,0,0])}function mh(e,t,n){let r=t*53+7,i=$m(um),a=Zm(um,dm,i.map(Cm),fm);e.add(`white`,Cp(um,dm,a.top,fm));let o=[0,32.6/2,-118];a.faces.forEach((t,n)=>{let a=i[n];if(a===`rear`)return;let s=Dm(a),c=a===`front`?23:17;lh(e,t,Qm(t,o),t=>{Z(e,t,`dbg`,-1e4,ch,0,1.5);for(let n of s)Z(e,t,`black`,-1e4,ch,n,n+1),Z(e,t,`dbg`,-1e4,ch,n+1,n+2);Z(e,t,`lbg`,-1e4,ch,c,ch),nh(e,t,s,2,.8,r+n,void 0,!0)})}),lh(e,a.top.map(e=>Xm(e,fm)),[0,1,0],(t,n,i)=>{Z(e,t,`lbg`,-1e4,ch,-1e4,ch),Z(e,t,`dbg`,-1e4,3,-1e4,ch,.5),uh(140,150,r+21,12,6,-40,(n,r,a,o,s)=>{if(s<.4||n<3)return;let c=Op(i,(n+r)/2,(a+o)/2);c.z<-111&&dp(hm,c.x,c.z)||Z(e,t,`dbg`,n,r,a,o,.5)})},[0,0,-1]);let s=$m(hm),c=Zm(hm,fm,s.map(wm),pm);e.add(`white`,Cp(hm,fm,c.top,pm)),e.add(`lbg`,gp(c.top,31.4));let l=[0,28,-150];c.faces.forEach((t,n)=>{s[n]!==`rear`&&lh(e,t,Qm(t,l),t=>{Z(e,t,`dbg`,-1e4,ch,0,1),Z(e,t,`black`,-1e4,ch,3,4),nh(e,t,[3],1.5,.6,r+30+n,`windowCool`,!0)})});let u=Zm(xm,pm,$m(xm).map(Tm),Sm);e.add(`lbg`,Cp(xm,pm,u.top,Sm));let d=[0,33.5,-168];u.faces.forEach((t,n)=>lh(e,t,Qm(t,d),t=>{Z(e,t,`dbg`,-1e4,ch,0,1),Z(e,t,`black`,-1e4,ch,2,3),nh(e,t,[2],1.5,.6,r+50+n,`windowCool`,!0)}));for(let t of[1,-1])e.push(),t<0&&e.mirrorX(),hh(e,r+100),e.pop(),n[t>0?`bridgeL`:`bridgeR`]=[vm*t,_m[3]+.4,-164]}function hh(e,t){let n=op(ym),r=$m(n),i=Zm(n,pm,r.map(Em),gm);e.add(`white`,Cp(n,pm,i.top,gm));let a=[vm,83/2,-164];i.faces.forEach((n,i)=>{let o=r[i];lh(e,n,Qm(n,a),n=>{if(o===`front`)return Z(e,n,`dbg`,-1e4,ch,0,ch);let r=Om(o);Z(e,n,`dbg`,-1e4,ch,0,1);for(let t of r)Z(e,n,`lbg`,-1e4,ch,t-1,t),Z(e,n,`black`,-1e4,ch,t,t+1),Z(e,n,`lbg`,-1e4,ch,t+1,t+2);nh(e,n,r,o===`rear`?2.5:2,.6,t+i,void 0,!0)})});let[o,s,c,l]=_m,u=bm,d=$m(u),f=pp(u,u.map(()=>3.2));e.add(`lbg`,Cp(f,o,u,s)),e.add(`white`,Cp(u,s,u,c)),e.add(`lbg`,Cp(u,c,pp(u,u.map(()=>1.3)),l));let p=[vm,(o+l)/2,-165];Zm(u,s,u.map(()=>0),c).faces.forEach((n,r)=>{let i=d[r]===`front`||d[r]===`bevel`;lh(e,n,Qm(n,p),(n,a)=>{if(i){Z(e,n,`black`,-1e4,ch,1,2.4),Z(e,n,`windowCool`,.3,a-.3,1.15,2.25,.6);return}Z(e,n,`black`,-1e4,ch,1,2),nh(e,n,[1],1.25,.55,t+30+r,`windowCool`,!0)})})}function gh(e,t,n){let r=[...nm.map(([e,t])=>[-e,t]),...nm.slice().reverse()],i={},a=r.length,o=e=>{let t=r[e],n=r[(e+1)%a],i=(t[1]+n[1])/2,o=Math.abs((t[0]+n[0])/2),s=Math.abs(t[0]-n[0])<.01;return i>=15.9?`darkRed`:i>2&&o>18?`white`:s&&o>95?`lbg`:s&&Math.abs(o-Qp[0])<.01?`white`:i<-10?`lbg`:`dbg`};for(let e=0;e<a;e++){let t=o(e),n=[r[e][0],r[e][1],Wp],s=[r[(e+1)%a][0],r[(e+1)%a][1],Wp],c=i[t]??=new Hl,l=[0,-8],u=kp([Gp,n,s]),d=[(n[0]+s[0])/2-l[0],(n[1]+s[1])/2-l[1]],f=u[0]*d[0]+u[1]*d[1]>=0?1:-1;c.tri(Gp,n,s,[u[0]*f,u[1]*f,u[2]*f])}for(let[t,n]of Object.entries(i))e.add(t,n.done());e.add(`lbg`,Sp([0,0,199],pp(r,r.map(()=>.05)),Wp));for(let n of[1,-1])e.push(),n<0&&e.mirrorX(),fh(e,t,n),e.pop();ph(e),mh(e,t,n);for(let t of[1,-1])for(let[n,r]of Am){let i=n*t,a=sm(i,r);e.box(`lbg`,i,a+1.6,r,5.4,2.6,6,{c:.2}),e.box(`gunmetal`,i,a+1.9,r+6,3,.6,7,{c:0})}for(let t of[1,-1])for(let n of oh){let r=n.r>6?14:8;e.cyl(`pearlDarkGray`,n.x*t,n.y,Wp-n.len/2,n.r,n.len,{axis:`z`,radial:r,c:0}),e.cyl(`glowBlue`,n.x*t,n.y,Wp-n.len-.1,n.r*.82,.3,{axis:`z`,radial:r,c:0}),e.cyl(`glowCyan`,n.x*t,n.y,Wp-n.len-.3,n.r*.5,.3,{axis:`z`,radial:r,c:0})}e.box(`lbg`,0,-16,-192,8.4,26,12,{c:0})}function _h(e){let t=e.seed??1,n=new sn;n.name=`venator`;let r=[],i={},a=[],o=e=>e.traverse(e=>{e instanceof Nr&&/:glow(Blue|Cyan)$/.test(e.name)&&r.push(e)});if(e.lod===2){let e=new Y({seed:t,studSegments:6});e.scale(Vp),gh(e,t,i);let r=e.build(`venator-lod2`);n.add(r.group),o(r.group);for(let e of[1,-1])for(let[t,n]of Am){let r=sm(t,n)+2.35;a.push([t*e+1.1,r,n+10.4],[t*e-1.1,r,n+10.4])}}else if(e.lod===1){let e={lod:1,fine:!1,seed:t},r=jm(1),s=new Y({seed:t*7,studSegments:6});s.scale(Vp);let c={turretMuzzles:[],frames:{}};Bm(s,e,r,c),ih(s,e,r,i),sh(s,e);let l=s.build(`venator-lod1`);n.add(l.group),o(l.group),a.push(...c.turretMuzzles)}else{let e={lod:0,fine:!0,seed:t},r=jm(0),s=[110,30,-50,-120],c=(e,t,n)=>{let r=n/Vp,i=0;for(;i<s.length&&r<s[i];)i++;return i},l=null;for(let i=0;i<=s.length;i++){let a=new Pp({seed:t*7+i,studSegments:10},i,c);a.scale(Vp);let o={turretMuzzles:[],frames:{}};Bm(a,e,r,o),l??=o;let s=a.build(`venator-hull-${i}`);n.add(s.group)}a.push(...l.turretMuzzles);{let a=new Y({seed:t*7+91,studSegments:12});a.scale(Vp),ih(a,e,r,i),n.add(a.build(`venator-superstructure`).group)}{let r=new Y({seed:t*7+93,studSegments:8});r.scale(Vp),sh(r,e);let i=r.build(`venator-engines`);n.add(i.group),o(i.group)}}let s={},c=(e,t)=>s[e]=Eu(e,n,t[0]*Vp,t[1]*Vp,t[2]*Vp);c(`bridgeL`,i.bridgeL??[vm,_m[3],-164]),c(`bridgeR`,i.bridgeR??[-14,_m[3],-164]),c(`bow`,[0,.6,Up]),c(`stern`,[0,-10,-200]),c(`dorsalDoor`,[0,sm(0,60)+.8,60]),c(`portEdgeMid`,[Jp[0]*im(20),Jp[1]*im(20),20]),c(`hangarVentral`,[0,tm[1]*im(-0)-.5,20]);let l=a.map((e,t)=>Eu(`turret${t}`,n,e[0]*Vp,e[1]*Vp,e[2]*Vp));return{group:n,length:400.6*Vp,turrets:l,engineGlows:r,anchors:s}}var vh={scale:Vp,bowZ:Up,sternZ:Wp,dorsalY:sm,tz:im},yh=new G().makeRotationX(Math.PI/2),bh=(e,t,n)=>new G().makeTranslation(e,t,n),xh=class extends Y{counts=new Map;add(e,t,n,r){return this.counts.set(e,(this.counts.get(e)??0)+t.pos.length/3),super.add(e,t,n,r)}mark(){return new Map(this.counts)}};function Sh(e,t){let n=[];e.traverse(e=>{if(!(e instanceof Nr))return;let r=e.name.slice(e.name.lastIndexOf(`:`)+1),i=e.geometry.getAttribute(`position`),a=e.geometry.getAttribute(`normal`);t.forEach((t,o)=>{let s=t.from.get(r)??0,c=t.to.get(r)??0;if(c<=s)return;let l=i.array.slice(s*3,c*3),u=a.array.slice(s*3,c*3);n.push({mesh:e,P:i,N:a,i0:s,p:l,n:u,foil:o})})});let r=t.map(e=>e.outer.clone().invert()),i=t.map(()=>new G),a=new G,o=new W,s=new U,c=bh(Yh,qh,0),l=bh(-Yh,-qh,0),u=e=>t.forEach((t,n)=>i[n].copy(t.outer).multiply(c).multiply(a.makeRotationZ((e-1)*t.ang)).multiply(l).multiply(r[n]));u(0);for(let e of n){let t=e.mesh.geometry;for(let n=0;n<e.p.length;n+=3)s.fromArray(e.p,n).applyMatrix4(i[e.foil]),t.boundingBox?.expandByPoint(s),t.boundingSphere?.expandByPoint(s)}let d=1;return e=>{let t=Math.min(1,Math.max(0,e||0));if(t===d)return;d=t,u(t);let r=new Set;for(let e of n){let t=i[e.foil];o.getNormalMatrix(t);let n=e.P.array,a=e.N.array,c=e.i0*3;for(let r=0;r<e.p.length;r+=3)s.fromArray(e.p,r).applyMatrix4(t).toArray(n,c+r),s.fromArray(e.n,r).applyMatrix3(o).normalize().toArray(a,c+r);for(let t of[e.P,e.N])r.has(t)||(t.clearUpdateRanges(),r.add(t)),t.addUpdateRange(c,e.p.length),t.needsUpdate=!0}}}function Ch(e,t,n){let r=op(e),i=[r.map(([e,n])=>[e,t(n),n]),r.slice().reverse().map(([e,t])=>[e,n(t),t])];for(let e=0;e<r.length;e++){let a=r[e],o=r[(e+1)%r.length];i.push([[a[0],n(a[1]),a[1]],[o[0],n(o[1]),o[1]],[o[0],t(o[1]),o[1]],[a[0],t(a[1]),a[1]]])}let a=0,o=0;for(let e of r)a+=e[0],o+=e[1];return a/=r.length,o/=r.length,{faces:i,center:[a,(t(o)+n(o))/2,o]}}function wh(e,t,n,r){let i=new Hl,a=fp(op(e),r)??op(e),o=a.map(([e,n])=>[e,t(n)-r,n]),s=a.map(([e,t])=>[e,n(t)+r,t]);for(let e=1;e<a.length-1;e++)i.tri(o[0],o[e],o[e+1],wp(o[0],o[e],o[e+1])),i.tri(s[0],s[e+1],s[e],wp(s[0],s[e+1],s[e]));for(let e=0;e<a.length;e++){let t=(e+1)%a.length;i.quad(s[e],s[t],o[t],o[e],wp(s[e],s[t],o[t]))}return i.done()}function Th(e){let t=0,n=0,r=0;for(let i of e)t+=i[0],n+=i[1],r+=i[2];return[t/e.length,n/e.length,r/e.length]}var Eh=(e,t)=>{let n=Th(e);return[n[0]-t[0],n[1]-t[1],n[2]-t[2]]};function Dh(e){let t=(t,n,r={})=>({key:t,sizes:n,flat:!e,...r}),n=e?[[4,2],[3,2],[2,2],[6,1],[4,1],[3,1],[2,1],[1,1]]:[[8,4],[6,4],[4,4],[8,2],[4,2],[2,2],[4,1],[2,1],[1,1]],r=e?[[6,1],[4,1],[3,1],[2,1],[1,1]]:[[8,1],[4,1],[2,1],[1,1]];return{white:t(`white`,n),whiteL:t(`white`,r),whiteP:t(`white`,n,{kind:e?`plate`:`tile`}),red:t(`red`,r),redF:t(`red`,n),lbg:t(`lbg`,n),lbgL:t(`lbg`,r),dbg:t(`dbg`,n),dbgL:t(`dbg`,r),raisedD:t(`dbg`,n,{kind:`raised`}),raisedL:t(`lbg`,n,{kind:`raised`}),grille:t(`dbg`,[[2,1],[1,1]],{kind:e?`grille`:`tile`}),grilleV:t(`dbg`,[[1,2],[1,1]],{kind:e?`grille`:`tile`}),black:t(`black`,r)}}var Oh=28,kh=11,Ah=-23,jh=1.2,Mh=-2,Nh=[[Oh,.9],[27.2,1.6],[25,2.3],[20,3],[kh,3.6]],Ph=1.6,Fh=-6.5,Ih=e=>jh+(e-kh)*-1.45/17,Lh=e=>Mh+(e-kh)*1.25/17,Rh=e=>e.every(e=>Math.abs(e[2]-kh)<1e-6);function zh(e,t,n){let r=[...Nh.map(([e,t])=>[t,e]),...Nh.slice().reverse().map(([e,t])=>[-t,e])];e.add(`dbg`,wh(r,Ih,Lh,.4));let i=Ch(r,Ih,Lh);i.faces.forEach((r,a)=>{if(Rh(r))return;let o=Eh(r,i.center),s=a===0,c=a===1;zp(e,r,{seed:11+a,outward:o,uDir:s||c?[0,0,-1]:void 0,origin:s||c?[0,s?Ih(Oh):Lh(Oh),Oh]:void 0,studs:t,style:(e,t)=>s?e<3.2?n.redF:Math.abs(t)<.5&&e>6?n.whiteL:Math.abs(Math.abs(t)-2.2)<.5&&e>9?n.red:n.white:c?e<3?n.redF:Math.abs(t)<1?n.dbgL:n.lbg:n.whiteL})});let a=[[3.6,kh],[-3.6,kh],[-3.6,-21.5],[-2.6,Ah],[2.6,Ah],[3.6,-21.5]],o=()=>jh,s=()=>Mh;e.add(`dbg`,wh(a,o,s,.4));let c=Ch(a,o,s);if(c.faces.forEach((r,i)=>{let a=Eh(r,c.center),o=i===0,s=i===1;if(Rh(r))return;let l=wp(r[0],r[1],r[2]),u=!o&&!s&&Math.abs(l[2])<.05,d=!o&&!s&&!u&&Math.abs(l[0])>.3;zp(e,r,{seed:31+i,outward:a,uDir:o||s||u?[0,0,-1]:void 0,origin:o||s?[0,o?jh:Mh,kh]:u?[r[0][0],Mh,kh]:void 0,studs:t,style:(e,t)=>{let r=Math.abs(t);return o?r>2.6?e>15?n.grille:n.red:e>21&&e<29&&r<1.5?Math.floor(e)%3==0?n.dbgL:n.lbg:e>28&&r<2.4?n.whiteP:n.white:s?r<.8?n.dbgL:r>2.8?n.whiteL:e>12&&e<22?n.dbg:n.lbg:d?t<.8?n.lbgL:n.whiteL:u?e<9&&t>1&&t<2.2?n.red:t<.8?n.lbgL:n.whiteL:n.dbg}})}),t){e.box(`dbg`,0,-2.3,4,3,.6,6);for(let t of[-1,0,1])e.cyl(`lbg`,t,-2.62,6.5,.32,.1,{radial:10})}Bh(e,t)}function Bh(e,t){let n=Fh;if(e.box(`dbg`,0,1.7000000000000002,n,2.6,.2,2.6,{c:.04}),t)for(let[t,r]of[[1.05,1.05],[-1.05,1.05],[1.05,-1.05],[-1.05,-1.05]])e.cyl(`lbg`,t,1.84,n+r,.18,.1,{radial:8});let r=t?20:10;e.lathe(`white`,Xl([[.92,.75],[.92,.2],[.92,0]]),{at:[0,1.8,n],radial:r}),e.lathe(`red`,Xl([[.95,.55],[.95,.35]]),{at:[0,1.8,n],radial:r}),e.lathe(`flatSilver`,Xl([[0,1.55],[.5,1.55],[.6,1.45],[.92,.78],[.92,.75]]),{at:[0,1.8,n],radial:r}),e.box(`black`,0,2.85,-5.84,.34,.3,.2,{c:.03,rot:[-.45,0,0]}),t&&(e.box(`lbg`,.42,2.6500000000000004,-5.78,.18,.18,.12,{rot:[-.45,0,0]}),e.cyl(`dbg`,-.3,3.38,-6.6,.12,.1,{radial:8}))}function Vh(e,t){let n=16.5,r=-2.5,i=2.5,a=1.5,o=Ph,s=4.300000000000001,c=(e,t,n)=>[e,t,n],l=c(0,Ih(n)+.35,n),u=c(i,o,11),d=c(-2.5,o,11),f=c(a,s,9.5),p=c(-1.5,s,9.5),m=c(a,s,1),h=c(-1.5,s,1),g=c(i,o,r),_=c(-2.5,o,r),v=c(a*.8,3.0850000000000004,r),y=c(-1.5*.8,3.0850000000000004,r),b=[[[l,u,f],`trBlack`],[[l,f,p],`trBlack`],[[l,p,d],`trBlack`],[[u,g,v,m,f],`trBlack`],[[d,p,h,y,_],`trBlack`],[[f,m,h,p],`trBlack`],[[m,v,y,h],`trBlack`]];for(let[t,n]of b)e.add(n,Hh(t,.12));let x=[[l,f],[l,p],[f,p],[f,m],[p,h],[m,h],[m,v],[h,y],[v,y],[u,f],[d,p],[l,u],[l,d],[u,g],[d,_]];for(let e of[7,3.5])x.push([c(a,s,e),c(-1.5,s,e)],[c(a,s,e),c(i,o,e)],[c(-1.5,s,e),c(-2.5,o,e)]);let S=t?.13:.16;for(let[n,r]of x)Uh(e,`dbg`,n,r,S,t?6:4);if(e.box(`dbg`,0,1.7000000000000002,8.5/2,5.3,.2,13.8),t)for(let t of[8.3,4.6])e.box(`dbg`,0,2.5,t-1,1.8,1.8,.35),e.lathe(`white`,Xl([[0,1.05],[.55,.95],[.72,.5],[.74,0],[.6,-.25]]),{at:[0,2.85,t],radial:14}),e.box(`black`,0,3.1500000000000004,t+.62,.9,.18,.12,{c:.02}),e.box(`black`,0,2.95,t+.62,.2,.45,.12,{c:.02}),e.box(`dbg`,0,2.1,t+1.1,1.4,.5,.6)}function Hh(e,t){let n=new Hl,r=wp(e[0],e[1],e[2]),i=Th(e),a=r[1]*1+r[0]*i[0]*.2>=0?1:-1,o=[r[0]*a,r[1]*a,r[2]*a],s=e.map(e=>[e[0]+o[0]*t*.5,e[1]+o[1]*t*.5,e[2]+o[2]*t*.5]),c=e.map(e=>[e[0]-o[0]*t*.5,e[1]-o[1]*t*.5,e[2]-o[2]*t*.5]);for(let t=1;t<e.length-1;t++)n.tri(s[0],s[t],s[t+1],o),n.tri(c[0],c[t+1],c[t],[-o[0],-o[1],-o[2]]);return n.done()}function Uh(e,t,n,r,i,a){let o=r[0]-n[0],s=r[1]-n[1],c=r[2]-n[2],l=Math.hypot(o,s,c);if(l<.001)return;let u=new G,d=[o/l,s/l,c/l],f=Math.abs(d[1])<.9?[0,1,0]:[1,0,0],p=[d[1]*f[2]-d[2]*f[1],d[2]*f[0]-d[0]*f[2],d[0]*f[1]-d[1]*f[0]],m=Math.hypot(p[0],p[1],p[2]);p=p.map(e=>e/m);let h=[p[1]*d[2]-p[2]*d[1],p[2]*d[0]-p[0]*d[2],p[0]*d[1]-p[1]*d[0]];u.set(p[0],d[0],h[0],(n[0]+r[0])/2,p[1],d[1],h[1],(n[1]+r[1])/2,p[2],d[2],h[2],(n[2]+r[2])/2,0,0,0,1),e.push(),e.apply(u),e.cyl(t,0,0,0,i,l,{radial:a,c:.02}),e.pop()}var Wh=6.3,Gh=-.45,Kh=2.5,qh=-.45,Jh=8.4,Yh=7.800000000000001,Xh=27,Zh=28;function Qh(e,t){let n=t?28:12,r=[Wh,Gh,0],i=[[1.9,2.5]];for(let e=0;e<=4;e++){let t=Math.PI-e*Math.PI/4;i.push([2.2+Math.cos(t)*.3,3.1500000000000004+Math.sin(t)*.3])}e.lathe(`white`,Xl([...i,[Kh,2.7],[Kh,-16.3],[2.15,-17.9]],50),{at:r,axis:`z`,radial:n});let a=(t,r,i,a,o)=>e.add(t,eu(i,a,o,.04,n),bh(Wh,Gh,r).multiply(yh));if(a(`red`,.8000000000000003,2.62,2.3,1.4),t){for(let e of[-4.5,-9.5,-14.5])a(`dbg`,e,2.6,2.3,.5);for(let t of[-6.5,-11.5])e.box(`dbg`,8.75,Gh,t,.3,1.6,3.2)}if(a(`dbg`,2.7,1.92,1.55,.5),e.cyl(`black`,Wh,Gh,2.25,1.92,.2,{axis:`z`,radial:n}),t)for(let t=0;t<12;t++){let n=t/12*Math.PI*2;e.box(`lbg`,Wh+Math.cos(n)*1.02,Gh+Math.sin(n)*1.02,2.42,.26,.95,.14,{rot:[0,0,n+Math.PI/2+.45]})}e.lathe(`flatSilver`,Xl([[0,.8],[.45,.35],[.55,0]]),{at:[Wh,Gh,2.35],axis:`z`,radial:t?14:8}),e.lathe(`gunmetal`,Xl([[2.1,-17.7],[2.25,-18.9],[2.1,-19.7],[1.8,-19.7],[1.7,-18.3]],30),{at:r,axis:`z`,radial:n}),e.cyl(`glowOrange`,Wh,Gh,-18.8,1.75,.2,{axis:`z`,radial:n}),e.cyl(`glowEngine`,Wh,Gh,-18.9,.875,.2,{axis:`z`,radial:n}),e.box(`white`,4.6,.55,-14.8/2,2,2.4,19.2,{hide:{nx:!0}}),e.box(`lbg`,4.6,-1.55,-14.8/2,2,1.4,19.2,{hide:{nx:!0}})}function $h(e,t,n,r){let i=[[Jh,.5],[Xh,-2],[Xh,-8],[Jh,-8]],a=()=>0,o=()=>-.9;e.add(`dbg`,wh(i,a,o,.3));let s=Ch(i,a,o);s.faces.forEach((r,i)=>{let c=Eh(r,s.center),l=i===0,u=i===1;zp(e,r,{seed:51+i,outward:c,uDir:l||u?[1,0,0]:void 0,origin:l||u?[Jh,l?a():o(),-8]:void 0,studs:t,style:(e,t)=>l||u?t>8.5-e*2.5/18.6-1.2?n.lbgL:l&&e>12.5&&e<16.5&&t>.9?e>14&&e<15?n.white:n.red:l&&t<1?n.dbgL:l?e>3&&e<6?n.whiteP:n.white:n.lbg:n.dbgL})});for(let[i,a]of[[1,.245],[-1,-.245]]){let o=e.m.clone(),s=e.mark();e.push(),e.translate(Yh,qh,0),e.rotateZ(a),e.translate(-7.800000000000001,.45,0);let c=[[7.800000000000001,-8],[25,-8],[25,-13.2],[7.800000000000001,-15.4]],l=i>0?-.43:-1.07,u=()=>l+.6,d=()=>l;e.add(`dbg`,wh(c,u,d,.2));let f=Ch(c,u,d);if(f.faces.forEach((t,r)=>{let a=Eh(t,f.center),o=r===0,s=r===1;zp(e,t,{seed:61+r+(i>0?0:10),outward:a,uDir:o||s?[1,0,0]:void 0,origin:o||s?[7.800000000000001,o?u():d(),-8]:void 0,studs:!1,style:(e,t)=>{if(o||s){let r=i>0&&o||i<0&&s;return t<-4.2+e*2.2/(18.6-1.4)-1?n.dbgL:r&&e>12&&e<16&&t>-4?e>13.5&&e<14.5?n.white:n.red:e>18.6-3.2?n.lbgL:r?n.white:n.lbg}return n.dbgL}})}),t)for(let t of[-9.5,-13.5])e.cyl(`dbg`,7.800000000000001,qh+(i>0?.3:-.3),t,.35,1.2,{axis:`z`,radial:10});e.pop(),r.push({from:s,to:e.mark(),outer:o,ang:a})}}function eg(e,t){let n=Zh,r=-.55,i=t?20:10,a=t?16:8;if(e.lathe(`dbg`,Xl([[.5,3.6],[1.1,2.6],[1.2,0],[1.2,-8.5],[.75,-9.6]],32),{at:[n,r,0],axis:`z`,radial:i}),e.cyl(`white`,n,r,4.3,1,1.4,{axis:`z`,radial:i}),e.cyl(`lbg`,n,r,5.8,.78,1.6,{axis:`z`,radial:i}),e.cyl(`lbg`,n,r,12.4,.48,12,{axis:`z`,radial:a}),t)for(let t of[7.3,8,8.7,9.4])e.cyl(`dbg`,n,r,t,.62,.32,{axis:`z`,radial:a});if(e.cyl(`dbg`,n,r,19.4,.72,2.6,{axis:`z`,radial:a}),t)for(let t of[18.7,19.4,20.1])e.add(`black`,eu(.745,.55,.22,.02,a),bh(n,r,t).multiply(yh));e.cyl(`flatSilver`,n,r,21,.6,.6,{axis:`z`,radial:a}),e.add(`black`,eu(.46,.22,.2,.02,a),bh(n,r,21.32).multiply(yh)),e.cyl(`lbg`,n,.7,1.5,.38,7,{axis:`z`,radial:t?12:6}),e.cyl(`red`,n,.7,5.3,.4,.6,{axis:`z`,radial:t?12:6}),e.box(`dbg`,n,.19999999999999996,1,.5,.6,3),e.box(`white`,27.45,qh,-5,1.2,.9,6)}function tg(e,t){let n=2.05-.25,r=[[-8.5,n],[-17.8,n],[-20.4,8.2],[-17.2,8.2]];e.push(),e.translate(Wh,0,0),e.rotateY(Math.PI/2),e.prism(`white`,r.map(([e,t])=>[-e,t]),.5),e.prism(`red`,[[-15.9,7],[-19.9,7],[-20.4,8.2],[-17.2,8.2]].map(([e,t])=>[-e,t+.01]),.56),e.pop(),e.box(`dbg`,Wh,1.9499999999999997,-13.2,1.1,.5,9),t&&e.cyl(`lbg`,Wh,8.2+.6,-18.8,.1,1.2,{radial:6})}function ng(e,t){let n=Ph;e.add(`trBlack`,Hh([[1.6,n,-18.4],[-1.6,n,-18.4],[-1.2,3.2,-20.8],[1.2,3.2,-20.8]],.12)),e.add(`trBlack`,Hh([[1.2,3.2,-20.8],[-1.2,3.2,-20.8],[-1.6,n,-22.8],[1.6,n,-22.8]],.12)),e.box(`dbg`,0,1.7000000000000002,-20.6,3.4,.2,4.6),Uh(e,`dbg`,[1.2,3.2,-20.8],[-1.2,3.2,-20.8],.12,6);for(let t of[1.4,-1.4])Uh(e,`dbg`,[t*.857,3.2,-20.8],[t*1.143,n,-18.4],.1,6),Uh(e,`dbg`,[t*.857,3.2,-20.8],[t*1.143,n,-22.8],.1,6);t&&(e.lathe(`white`,Xl([[0,1.05],[.55,.95],[.72,.5],[.74,0],[.6,-.25]]),{at:[0,1.9500000000000002,-20.6],radial:14}),e.box(`black`,0,2.25,-21.22,.9,.18,.12,{c:.02}));for(let n of[.7,-.7])e.cyl(`dbg`,n,-.3,-23.5,.42,1,{axis:`z`,radial:t?12:6}),e.cyl(`gunmetal`,n,-.3,-25.2,.2,3,{axis:`z`,radial:t?10:6}),e.cyl(`flatSilver`,n,-.3,-26.8,.28,.5,{axis:`z`,radial:t?10:6})}function rg(e={}){let t=e.lod??0,n=t===0,r=Dh(n),i=new sn;i.name=`arc170`;let a=new xh({seed:170,studSegments:n?10:6});a.translate(0,0,3.5),zh(a,n,r),Vh(a,n),ng(a,n);let o=[];for(let e of[1,-1])a.push(),e<0&&a.mirrorX(),Qh(a,n),$h(a,n,r,o),eg(a,n),tg(a,n),a.pop();let s=a.build(t?`arc170-lod1`:`arc170`);i.add(s.group);let c=Sh(s.group,o);i.userData.setFoils=c;let l=[],u=[];for(let e of[1,-1])l.push(Eu(`cannon${e>0?`L`:`R`}`,i,Zh*e,-.55,24.95));for(let e of[1,-1]){let t=Eu(`tailgun${e>0?`L`:`R`}`,i,.7*e,-.3,-23.6);t.rotation.y=Math.PI,l.push(t)}for(let e of[1,-1])u.push(Eu(`engine${e>0?`L`:`R`}`,i,Wh*e,Gh,-16.3));let d=[];return i.traverse(e=>{e instanceof Nr&&/:glow(Orange|Engine)$/.test(e.name)&&d.push(e)}),i.userData.engineGlows=d,{group:i,length:55.1,muzzles:l,engines:u,setFoils:c}}var ig=vh.scale;function ag(e,t,n,r,i){let a=_h({lod:e});return a.group.userData.frame={center:[t*ig,n*ig,r*ig],radius:i*ig},a.group}var og=e=>vh.dorsalY(0,e),sg=e=>96*vh.tz(e),cg={venator:()=>_h({lod:0}).group,"venator-lod1":()=>_h({lod:1}).group,"venator-lod2":()=>_h({lod:2}).group,"venator-towers":()=>ag(0,0,44,-164,30),"venator-bridge":()=>ag(0,14,56,-164,12),"venator-supfront":()=>ag(0,0,20,-100,22),"venator-deck":()=>ag(0,0,og(-20),-20,10),"venator-deck-far":()=>ag(0,0,og(40),40,40),"venator-port":()=>ag(0,sg(-40),0,-40,20),"venator-trench":()=>ag(0,sg(-120)-4,-6,-120,14),"venator-turret":()=>ag(0,sg(-118)-27,8,-118,8),"venator-stern":()=>ag(0,0,-8,-196,100),"venator-bow":()=>ag(0,0,0,170,30),"venator-lod1-stern":()=>ag(1,0,5,-150,110),"venator-lod1-port":()=>ag(1,sg(-100),5,-100,45),"venator-lod2-port":()=>ag(2,sg(-100),5,-100,45),arc170:()=>rg().group,"arc170-lod1":()=>rg({lod:1}).group,"arc170-cockpit":()=>lg(0,3,12,9),"arc170-engine":()=>lg(6.3,0,2,8),"arc170-cannon":()=>lg(27,0,16,8),"arc170-tail":()=>lg(0,2,-18,12),"arc170-foils":()=>{let e=rg();return e.group.userData.animate=t=>e.setFoils(.5-.5*Math.cos(t*1.5)),e.group},"arc170-closed":()=>{let e=rg();return e.setFoils(0),e.group},"arc170-lod1-closed":()=>{let e=rg({lod:1});return e.setFoils(0),e.group},"arc170-foil-shut":()=>lg(16,-.5,-8,7,0)};function lg(e,t,n,r,i=1){let a=rg();return a.setFoils(i),a.group.userData.frame={center:[e,t,n],radius:r},a.group}var ug=()=>({tris:0,calls:0});function dg(e,t,n,r){let i=e.build(t);return r&&(r.tris+=i.triangles,r.calls+=i.parts.length),n?.add(i.group),i.group}function fg(e,t,n=0,r=0,i=0){let a=new on;return a.name=e,a.position.set(n,r,i),t.add(a),a}function pg(e,t,n=[0,1,0]){let r=new U(t[0],t[1],t[2]).normalize(),i=new U(n[0],n[1],n[2]),a=new U().crossVectors(i,r);a.lengthSq()<1e-9&&(i=Math.abs(r.y)<.9?new U(0,1,0):new U(1,0,0),a.crossVectors(i,r)),a.normalize();let o=new U().crossVectors(r,a),s=new G().makeBasis(a,o,r);return s.setPosition(e[0],e[1],e[2]),s}var mg=new G().makeRotationX(Math.PI/2);function hg(e,t,n,r=!0,i=!0){let a=t/2,o=-t/2,s=[];return r&&s.push([0,a,0,1,e,a,0,1]),s.push([e,a,1,0,e,o,1,0]),i&&s.push([e,o,0,-1,0,o,0,-1]),Ql(s,n)}function gg(e,t,n,r,i,a={}){let o=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],s=Math.hypot(o[0],o[1],o[2]);if(s<1e-5)return;let c=a.ch??Math.min(e.chamfer,.03,i*.25),l=c>0?$l(i,s,c,a.radial??8,{top:a.top,bottom:a.bottom}):hg(i,s,a.radial??8,a.top,a.bottom),u=pg([(n[0]+r[0])/2,(n[1]+r[1])/2,(n[2]+r[2])/2],o).multiply(mg);e.add(t,l,u,{tint:a.tint})}function _g(e,t,n,r,i,a,o,s,c={}){e.add(t,Yl(a,o,s,c.c??e.chamfer,c.hide??{}),pg(n,r,i))}function vg(e,t,n,r,i,a=8){let o=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],s=Math.hypot(o[0],o[1],o[2]);s<1e-5||e.add(t,Ql(Xl([[0,s],[i,0],[0,0]],30),a),pg(n,o).multiply(mg))}function yg(e,t,n,r,i=10,a=6){e.add(t,tu(r,i,a),new G().makeTranslation(n[0],n[1],n[2]))}function Q(e,t,n,r,i,a,o={}){let s=Math.hypot(r[0],r[1],r[2])||1,c=a/2/s;gg(e,t,[n[0]-r[0]*c,n[1]-r[1]*c,n[2]-r[2]*c],[n[0]+r[0]*c,n[1]+r[1]*c,n[2]+r[2]*c],i,o)}function bg(e,t,n){let r=0;for(let t=0;t<e.length;t++){let n=e[t],i=e[(t+1)%e.length];r+=n[0]*i[1]-i[0]*n[1]}let i=r>=0?1:-1,a=1/0;for(let r=0;r<e.length;r++){let o=e[r],s=e[(r+1)%e.length],c=s[0]-o[0],l=s[1]-o[1],u=Math.hypot(c,l)||1,d=-l/u*i,f=c/u*i;a=Math.min(a,(t-o[0])*d+(n-o[1])*f)}return a}function xg(e,t,n,r,i={}){let a=i.margin??.33,o=i.ox??.5,s=i.oz??.5,c=1/0,l=-1/0,u=1/0,d=-1/0;for(let e of n)c=Math.min(c,e[0]),l=Math.max(l,e[0]),u=Math.min(u,e[1]),d=Math.max(d,e[1]);let f=0;for(let p=o+Math.ceil(c-o);p<=l;p+=1)for(let o=s+Math.ceil(u-s);o<=d;o+=1){if(i.max!==void 0&&f>=i.max)return f;bg(n,p,o)<a||(!i.keep||i.keep(p,o))&&(e.stud(t,p,r,o),f++)}return f}function Sg(e,t=.02){let n=[];for(let r of e){let e=n[n.length-1];(!e||Math.hypot(r[0]-e[0],r[1]-e[1])>t)&&n.push(r)}for(;n.length>2&&Math.hypot(n[0][0]-n[n.length-1][0],n[0][1]-n[n.length-1][1])<=t;)n.pop();return n}function Cg(e,t){if(t<=e[0][0])return e[0].slice(1);for(let n=0;n<e.length-1;n++){let r=e[n],i=e[n+1];if(t<=i[0]){let e=(t-r[0])/(i[0]-r[0]||1);return r.slice(1).map((t,n)=>t+(i[n+1]-t)*e)}}return e[e.length-1].slice(1)}function wg(e,t={}){let n=t.buckets??1,r=Array.from({length:n},()=>new Hl),i=e.length,a=e[0].length,o=(t,n)=>e[Math.max(0,Math.min(i-1,t))][(n%a+a)%a],s=e.map(e=>e.reduce((e,t)=>[e[0]+t[0]/a,e[1]+t[1]/a,e[2]+t[2]/a],[0,0,0])),c=[];for(let e=0;e<i;e++){let t=[];for(let n=0;n<a;n++){let r=o(e+1,n),i=o(e-1,n),a=o(e,n+1),c=o(e,n-1),l=new U(r[0]-i[0],r[1]-i[1],r[2]-i[2]),u=new U(a[0]-c[0],a[1]-c[1],a[2]-c[2]),d=new U().crossVectors(u,l).normalize(),f=o(e,n),p=s[e];d.x*(f[0]-p[0])+d.y*(f[1]-p[1])+d.z*(f[2]-p[2])<0&&d.negate(),t.push([d.x,d.y,d.z])}c.push(t)}for(let e=0;e<i-1;e++)for(let n=0;n<a;n++)r[t.pick?t.pick(e,n):0].quad(o(e,n),o(e,n+1),o(e+1,n+1),o(e+1,n),c[e][n],c[e][(n+1)%a],c[e+1][(n+1)%a],c[e+1][n]);if(t.caps??!0)for(let[e,t]of[[0,1],[i-1,i-2]]){let n=s[e],i=s[t],c=new U(n[0]-i[0],n[1]-i[1],n[2]-i[2]).normalize(),l=[c.x,c.y,c.z];for(let t=0;t<a;t++)r[0].tri(n,o(e,t),o(e,t+1),l)}return r.map(e=>e.done())}function Tg(e,t,n,r,i,a=12,o=.02){let s=n/2,c=-n/2;o=Math.min(o,(e-t)*.4,n*.4);let l=[[t,s-o,-1,0,t+o,s,0,1],[t+o,s,0,1,e-o,s,0,1],[e-o,s,0,1,e,s-o,1,0],[e,s-o,1,0,e,c+o,1,0],[e,c+o,1,0,e-o,c,0,-1],[e-o,c,0,-1,t+o,c,0,-1],[t+o,c,0,-1,t,c+o,-1,0],[t,c+o,-1,0,t,s-o,-1,0]],u=new Hl;u.append(Ql(l,a,r,i));let d=[[t,s-o],[t+o,s],[e-o,s],[e,s-o],[e,c+o],[e-o,c],[t+o,c],[t,c+o]];for(let[e,t]of[[r,-1],[r+i,1]]){let n=Math.sin(e),r=Math.cos(e),i=[t*r,0,-t*n],a=d.map(([e,t])=>[e*n,t,e*r]);for(let e=1;e<a.length-1;e++)u.tri(a[0],a[e],a[e+1],i)}return u.done()}function Eg(e,t,n,r={}){e.lathe(t,Xl(n,r.crease??35),{radial:r.radial,at:r.at,axis:r.axis,theta0:r.theta0,thetaLen:r.thetaLen})}var Dg=e=>e*e*(3-2*e),Og=e=>Math.max(0,Math.min(1,e)),kg=(e,t,n)=>e+(t-e)*n,Ag=Math.PI/180,jg=22,Mg=.38,Ng=e=>(e-Mg)*jg,Pg=[[0,.5,.62],[.04,.28,1.1],[.1,.08,1.75],[.18,-.06,2.35],[.28,-.13,2.8],[.38,-.15,3],[.5,-.12,2.95],[.62,-.02,2.7],[.72,.12,2.35],[.8,.25,1.95],[.87,.36,1.58]],Fg=5.3,Ig=-.3,Lg=-1.2,Rg=5.85,zg=1.15,Bg=20*Ag,Vg=22*Ag,Hg=2.8,Ug=2*Ag,Wg=14*Ag,Gg=-13.100000000000001,Kg=[.9,0,13.85],qg=10*Ag,Jg=1.35,Yg=.9,Xg=[`tan`,`tan`,`darkRed`,`tan`,`tan`,`tan`,`tan`,`darkRed`,`tan`,`reddishBrown`],Zg=[`tan`,`tan`,`tan`,`tan`,`tan`,`darkTan`,`tan`,`darkRed`,`tan`,`darkTan`];function Qg(e,t){let n=Pg,r=(e,t,n,r)=>{let i=t-e;return[e+Math.min(n,i*.2),t-Math.min(r,i*.34)]},i=[.07,.12,.2,.28,.38,.5,.62,.72,.8,.86].map(e=>{let[t,r]=Cg(n,e),i=r-t;return[e,t+.12,Math.min(t+.12+Math.max(1.05,i*.4),r-.5)]}),a=e=>Cg(i,e/jg+Mg)[1];for(let i=0;i<n.length-1;i++){let[o,s,c]=n[i],[l,u,d]=n[i+1],f=Ng(o),p=Ng(l);e.shape(`darkTan`,Sg([[s,f],[c,f],[d,p],[u,p]]),-.2,.4,{hideBottom:!1});let[m,h]=r(s,c,.05,.26),[g,_]=r(u,d,.05,.26),v=Sg([[m,f],[h,f],[_,p],[g,p]]),y=t===1&&Xg[i]===`reddishBrown`?`darkRed`:Xg[i];e.shape(y,v,.2,.4);let[b,x]=r(s,c,.05,.55),[S,C]=r(u,d,.05,.55);e.shape(t===1?`darkTan`:Zg[i],Sg([[b,f],[x,f],[C,p],[S,p]]),-.6,.4,{hideBottom:!1}),t===0&&o>=.18&&l<=.62&&y===`tan`&&xg(e,y,v,.6,{keep:(e,t)=>e>a(t)+.36})}for(let n=0;n<i.length-1;n++){let[r,a,o]=i[n],[s,c,l]=i[n+1],u=Ng(r),d=Ng(s),f=Sg([[a,u],[o,u],[l,d],[c,d]]),p=n===6||n===7?`reddishBrown`:n===5?`darkTan`:`tan`;e.shape(t===1&&p===`reddishBrown`?`darkTan`:p,f,.6,.4),t===0&&r>=.12&&s<=.5&&xg(e,p,f,1),t===0&&n===7&&e.shape(`darkRed`,Sg([[a+.2,u+.2],[o-.2,u+.2],[l-.2,d-.2],[c+.2,d-.2]]),1,.12)}let o=[.08,.3,.58,.86];for(let r=0;r<o.length-1;r++){let[i]=Cg(n,o[r]),[a]=Cg(n,o[r+1]),s=Ng(o[r])+.03,c=Ng(o[r+1])-.03;if(e.shape(`dbg`,[[i+.04,s],[i+.95,s],[a+.95,c],[a+.04,c]],-1,.4,{hideBottom:!1}),t===0)for(let t=s+.6;t<c-.4;t+=1)Q(e,`black`,[kg(i,a,(t-s)/(c-s))+.02,-.8,t],[1,0,0],.13,.06,{radial:8})}if(Q(e,`dbg`,[-.2,-.3,0],[0,0,1],.6,2.2,{radial:t?8:14}),t===0){Q(e,`flatSilver`,[-.2,-.3,0],[0,0,1],.32,2.5,{radial:10});for(let t of[-.75,.75])Q(e,`black`,[-.2,-.3,t],[0,0,1],.64,.12,{radial:14});e.box(`dbg`,.4,-.75,-1.6,.9,.5,1.1),gg(e,`dbg`,[.45,-1.15,-2.3],[.45,-1.15,-4.2],.17,{radial:8}),gg(e,`flatSilver`,[.45,-1.15,-4.2],[.45,-1.15,-6],.09,{radial:6}),gg(e,`dbg`,[.55,-1.15,6.6],[.62,-1.15,8.6],.17,{radial:8}),gg(e,`flatSilver`,[.62,-1.15,8.6],[.7,-1.15,10.4],.09,{radial:6})}let s=.5,c=-1.35;if(e.box(`dbg`,s,-1.3,.9,.95,.6,2.4),gg(e,`dbg`,[s,c,2.1],[s,c,5.3],.2,{radial:t?6:10}),t===0){e.box(`black`,s,-1.6500000000000001,.9,.5,.12,1.6);for(let t of[2.6,3.4,4.2])Q(e,`dbg`,[s,c,t],[0,0,1],.26,.2,{radial:10});gg(e,`flatSilver`,[s,c,5.3],[s,c,6.1],.28,{radial:10}),gg(e,`black`,[s,c,6.1],[s,c,6.3],.13,{radial:8})}let l=Ng(.87),u=Ng(1);return e.shape(`dbg`,[[.34,l],[1.6,l],[1.4,l+1.5],[.5,l+1.5]],-.36,.72,{hideBottom:!1}),e.shape(`black`,[[.72,l+1.2],[1.28,l+1.2],[1.12,l+2.3],[.9,u+.25]],-.2,.4,{hideBottom:!1}),e.shape(`black`,[[1.2,l+1.1],[1.62,l+1.05],[1.75,l+1.9],[1.6,u-.35]],-.16,.32,{hideBottom:!1}),e.shape(`black`,[[.3,l+1],[.72,l+1.15],[.45,u-.6],[.2,l+1.9]],-.16,.32,{hideBottom:!1}),t===0&&(e.shape(`dbg`,[[.5,l-.9],[1.45,l-.9],[1.5,l+.2],[.45,l+.2]],.3,.3),e.shape(`dbg`,[[.55,l-.7],[1.4,l-.7],[1.45,l+.4],[.5,l+.4]],-.6,.3,{hideBottom:!1}),Q(e,`flatSilver`,[1,0,l+1.25],[0,1,0],.22,.86,{radial:10}),Q(e,`flatSilver`,[1.42,0,l+1.12],[0,1,0],.16,.7,{radial:8}),Q(e,`flatSilver`,[.5,0,l+1.1],[0,1,0],.16,.7,{radial:8}),gg(e,`dbg`,[.95,.72,Ng(.72)],[.95,.72,Ng(.8)],.16,{radial:8}),gg(e,`flatSilver`,[.95,.72,Ng(.8)],[.95,.72,l+.9],.08,{radial:6}),gg(e,`dbg`,[.95,-.8,Ng(.74)],[.95,-.8,Ng(.82)],.16,{radial:8}),gg(e,`flatSilver`,[.95,-.8,Ng(.82)],[.95,-.8,l+.9],.08,{radial:6}),e.box(`trRed`,1,.62,l+.45,.3,.1,.3)),[s,c,t?5.3:6.35]}var $g=[[0,4.3],[1,4.15],[2,3.72],[2.9,3.05],[3.7,2.25],[4.4,1.35],[4.9,.45]],e_=[[0,-2.7],[1,-2.65],[2,-2.5],[2.9,-2.3],[3.7,-2.1],[4.4,-1.9],[4.9,-1.7]];function t_(e,t){let n=$g.map(e=>e[0]),r=(e,t,r=0,i=0)=>{let a=n[e]+0,o=n[e+1];return[[a,e_[e][1]+t+i],[o-(e===n.length-2?t:0),e_[e+1][1]+t+i],[o-(e===n.length-2?t:0),$g[e+1][1]-t-r],[a,$g[e][1]-t-r]]};for(let i of[1,-1]){e.push(),i<0&&e.mirrorX();for(let i=0;i<n.length-1;i++){i<=2&&e.shape(`darkTan`,r(i,.3),-1.1,.4),e.shape(`darkTan`,r(i,.12),-.7,.4,{hideBottom:i>2}),e.shape(t?`darkTan`:`dbg`,r(i,.35),-.3,.4);let n=i===4?`darkRed`:`tan`;if(e.shape(n,r(i,0),.1,.4),i<=2){let n=r(i,.3,.25,.15);e.shape(`tan`,n,.5,.4),t===0&&i>=1&&xg(e,`tan`,n,.9,{ox:.5,oz:.5})}t===0&&i===3&&xg(e,`tan`,r(i,.25),.5,{ox:.5,oz:.5,max:4})}if(e.box(`dbg`,Fg,.75,Lg,.7,.42,6.6),e.box(`dbg`,Fg,-1.35,Lg,.7,.42,6.6),e.box(`dbg`,5.18,Ig,Lg,.42,1.7,5.2),t===0){for(let t=-4;t<=1.7;t+=1)Q(e,`black`,[5.66,.75,t],[1,0,0],.12,.04,{radial:8}),Q(e,`black`,[5.66,-1.35,t],[1,0,0],.12,.04,{radial:8});gg(e,`flatSilver`,[5.3999999999999995,.15000000000000002,-4.1],[5.3999999999999995,.15000000000000002,1.7],.1,{radial:6}),gg(e,`flatSilver`,[5.3999999999999995,-.75,-4.1],[5.3999999999999995,-.75,1.7],.1,{radial:6}),Q(e,`dbg`,[Fg,Ig,2.2],[0,0,1],.42,.5,{radial:10}),Q(e,`dbg`,[Fg,Ig,-4.6],[0,0,1],.42,.5,{radial:10}),e.box(`dbg`,1.6,-1.05,2.4,.9,.55,2),gg(e,`dbg`,[1.6,-1.05,3.3],[1.6,-1.05,4],.26,{radial:10}),gg(e,`black`,[1.6,-1.05,4],[1.6,-1.05,4.08],.16,{radial:8}),e.box(`trRed`,3.3,.3,2.62,.4,.14,.12)}e.pop()}if(e.box(`dbg`,0,1.1,1.3,1.6,.5,2.2),e.box(`dbg`,0,-.2,-3.55,2.7,1.3,1.9),e.shape(`tan`,[[-1.5,-2.6],[1.5,-2.6],[1.25,-4.1],[-1.25,-4.1]],.45,.4),e.shape(`darkTan`,[[-1.45,-2.6],[1.45,-2.6],[1.2,-4],[-1.2,-4]],-1.25,.4,{hideBottom:!1}),e.add(`dbg`,eu(.98,.74,.6,.03,t?10:18),new G().makeTranslation(0,-.2,-4.6).multiply(new G().makeRotationX(Math.PI/2))),e.cyl(`glowOrange`,0,-.2,-4.62,.76,.3,{axis:`z`,radial:t?10:18}),t===0){e.cyl(`glowYellow`,0,-.2,-4.78,.42,.06,{axis:`z`,radial:12}),e.cyl(`flatSilver`,0,1.25,-3.3,.42,2.2,{axis:`z`,radial:12});for(let t of[-2.6,-3.3,-4])e.cyl(`darkRed`,0,1.25,t,.46,.18,{axis:`z`,radial:12});for(let t of[1,-1])for(let n=0;n<5;n++)e.box(`dbg`,t*1.45,-.72+n*.26,-3.55,.36,.08,1.6,{c:.02})}}var n_=[[0,4],[.55,3.97],[.95,3.88],[1.22,3.68],[1.4,3.36],[1.5,2.9],[1.53,2.2],[1.5,1.5],[1.38,.8],[1.15,.2],[.8,-.2],[.4,-.38],[0,-.42]],r_=7,i_=1.53,a_=.45,o_=1.22,s_=.36;function c_(e){let t=n_;for(let n=0;n<t.length-1;n++){let r=t[n],i=t[n+1];if(e<=r[1]&&e>=i[1])return r[0]+(e-r[1])/(i[1]-r[1]||1)*(i[0]-r[0])}return 0}function l_(e,t){let n=c_(t);return[n*Math.sin(e),o_*(a_-n*Math.cos(e)),t]}function u_(e,t){let n=Math.PI/2-s_,r=Math.PI+2*s_,i=t?10:24;e.push(),e.scale(1,o_,1),Eg(e,`tan`,n_.slice(0,r_),{at:[0,a_,0],axis:`z`,radial:i,theta0:n,thetaLen:r,crease:60}),Eg(e,`darkTan`,n_.slice(6).map((e,t)=>t===0?[e[0]-.03,e[1]-.05]:e),{at:[0,a_,0],axis:`z`,radial:i,theta0:n,thetaLen:r,crease:60}),e.pop();let a=o_*(a_-i_*Math.sin(s_))+.03,o=[];for(let e=0;e<=8;e++){let t=4.1-e/8*4.25;o.push([Math.max(.25,c_(t)*Math.cos(s_)-.05),t])}let s=o.filter(e=>e[1]>=1.5),c=o.filter(e=>e[1]<=1.7);for(let t of[s,c])e.shape(`darkTan`,d_(t.concat(t.map(e=>[-e[0],e[1]]))),a-.36,.36,{hideBottom:!1});let l=[];for(let e=0;e<=10;e++){let t=3.3-e/10*3.55,n=c_(t)*Math.cos(s_)+.22;l.push([n,t],[-n,t])}if(e.shape(`darkTan`,d_(l),a-.1,.2,{hideBottom:t===1}),e.cyl(`dbg`,0,a-.55,.6,.5,.7,{radial:12}),t===1){for(let t of[1,-1])p_(e,t*.42,1,6);return}for(let t of[1,-1])p_(e,t*.42,0,14);for(let t=0;t<4;t++)e.box(`dbg`,0,a-.12-t*.08,3.3+t*.12,1.3-t*.14,.06,.5,{c:.015});e.box(`black`,0,a-.2,2.9,1.4,.3,.9);for(let t of[1,-1]){let n=Math.PI/2+.3,r=l_(n,2.7),i=[t*Math.sin(n),-Math.cos(n)/o_,0];r[0]*=t,Q(e,`black`,r,i,.28,.12,{radial:12}),Q(e,`trRed`,[r[0]+i[0]*.05,r[1]+i[1]*.05,r[2]],i,.16,.1,{radial:10});let a=l_(n,1);a[0]*=t,Q(e,`dbg`,a,i,.22,.14,{radial:8}),Q(e,`dbg`,[a[0],a[1],a[2]+.55],i,.22,.14,{radial:8})}Q(e,`dbg`,[0,.6990000000000001,-.38],[0,0,1],.42,.16,{radial:12}),Q(e,`black`,[0,.6990000000000001,-.48],[0,0,1],.22,.08,{radial:10});let u=l_(Math.PI,.6);e.box(`dbg`,.6,u[1]-.2,.55,.32,.3,.5),gg(e,`flatSilver`,[.6,u[1]-.05,.5],[.8,u[1]+1.5,-.7],.05,{radial:5})}function d_(e){let t=e.map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]||e[1]-t[1]),n=(e,t,n)=>(t[0]-e[0])*(n[1]-e[1])-(t[1]-e[1])*(n[0]-e[0]),r=[],i=[];for(let e of t){for(;r.length>=2&&n(r[r.length-2],r[r.length-1],e)<=0;)r.pop();r.push(e)}for(let e=t.length-1;e>=0;e--){let r=t[e];for(;i.length>=2&&n(i[i.length-2],i[i.length-1],r)<=0;)i.pop();i.push(r)}return r.slice(0,-1).concat(i.slice(0,-1))}function f_(e){let t=n_;for(let n=0;n<6;n++){let r=t[n],i=t[n+1];if(e>=r[0]&&e<=i[0])return r[1]+(e-r[0])/(i[0]-r[0]||1)*(i[1]-r[1])}return t[6][1]}function p_(e,t,n,r){let i=Math.abs(t)+.1,a=[],o=[];for(let e=0;e<=r;e++){let n=kg(1.5,i,(e/r)**.8),s=f_(n),c=Math.min(.98,Math.abs(t)/n),l=Math.sqrt(1-c*c),u=o_*(a_+n*l),d=(c_(s+.05)-c_(s-.05))/.1,f=new U(Math.sign(t)*c,l/o_,-d/o_).normalize();a.push([t,u,s]),o.push([f.x,f.y,f.z])}for(let t=0;t<r;t++){let n=a[t],r=a[t+1],i=[(o[t][0]+o[t+1][0])/2,(o[t][1]+o[t+1][1])/2,(o[t][2]+o[t+1][2])/2],s=[(n[0]+r[0])/2+i[0]*.02,(n[1]+r[1])/2+i[1]*.02,(n[2]+r[2])/2+i[2]*.02],c=Math.hypot(r[0]-n[0],r[1]-n[1],r[2]-n[2]);_g(e,`black`,[s[0]-i[0]*.03,s[1]-i[1]*.03,s[2]-i[2]*.03],[r[0]-n[0],r[1]-n[1],r[2]-n[2]],i,.42,.1,c+.04,{c:.02}),_g(e,`glowRed`,s,[r[0]-n[0],r[1]-n[1],r[2]-n[2]],i,.24,.1,c*.86,{c:.02})}}var m_=new G,h_=new U,g_=new Ht(0,0,0,`ZYX`);function __(e,t,n,r){let{side:i,lvl:a}=e,o=Dg(Og(t)),s=i*a*Bg,c=i*Rg,l=Ig+a*zg,u=Lg,d=a>0?Math.PI/2-Vg:Math.PI/2+Vg,f=i*(a>0?Ug:Wg),p=Lg+a*Hg,m=((n+e.off)/(Math.PI*2)%1+1)%1,h,g;if(m<.75)h=1-2*m/.75,g=0;else{let e=(m-.75)/.25;h=-1+2*Dg(e),g=Math.sin(Math.PI*e)}d-=h*qg,f+=i*g*9*Ag,m_.makeRotationFromEuler(g_.set(d,0,f,`ZYX`)),h_.set(i*Kg[0],a*Kg[1],Kg[2]).applyMatrix4(m_);let _=Gg-h_.y+g*1.1;r.pitch=kg(0,d,o),r.roll=kg(s,f,o),r.x=c,r.y=kg(l,_,o),r.z=kg(u,p,o)}var v_=new Map;function y_(e={}){let t=e.lod??0,n=e.seed??1,r=new sn;r.name=`vulture`;let i=ug(),a=[],o=[];if(r.userData.walkFootY=Gg,r.userData.walkStride=5.9,r.userData.span=18.1,t===1)return S_(r,n,a,o);let s=new Y({seed:n,studSegments:10});t_(s,0),dg(s,`vulture-hull`,r,i);let c=Eu(`engine`,r,0,-.2,-4.8);c.rotation.y=Math.PI,o.push(c);let l=fg(`vulture:head`,r,0,Jg,Yg),u=new Y({seed:n+3,studSegments:10});u_(u,0),dg(u,`vulture-head`,l,i);let d=new Y({seed:n+7,studSegments:10}),f=Qg(d,0),p=d.build(`vulture-wing`),m=[];for(let e of[1,-1])for(let t of[1,-1]){let n=fg(`vulture:wing${e>0?`P`:`S`}${t>0?`U`:`L`}`,r),o=m.length===0?p.group:p.group.clone();o.scale.set(e,t,1),n.add(o),i.tris+=p.triangles,i.calls+=p.parts.length;let s=Eu(`muzzle`,n,e*f[0],t*f[1],f[2]);a.push(s),m.push({pv:n,side:e,lvl:t,off:b_[`${e},${t}`]})}r.userData.triangles=i.tris,r.userData.drawCalls=i.calls;let h=0,g=0,_=0,v={pitch:0,roll:0,x:0,y:0,z:0},y=()=>{let e=Dg(Og(h));for(let t of m){__(t,h,g,v),t.pv.position.set(v.x,v.y,v.z);let n=(1-e)*Math.sin(_*1.7+t.off*1.3)*1.2*Ag;t.pv.rotation.set(v.pitch,0,v.roll+t.side*t.lvl*n,`ZYX`)}l.rotation.set(e*(20*Ag+Math.sin(g*2)*2*Ag),(1-e)*Math.sin(_*.9)*4*Ag,0),l.position.set(0,Jg-e*.35,Yg+e*.7)};return y(),{group:r,length:jg,muzzles:a,engines:o,setMode(e){h=e,y()},setGait(e){g=e,y()},animate(e){_=e,y()}}}var b_={"1,-1":0,"1,1":Math.PI/2,"-1,-1":Math.PI,"-1,1":3*Math.PI/2},x_=8;function S_(e,t,n,r){let i=`${t&3}`,a=[],o=n=>{let r=n>=0,o=r?`w${n}`:`${i}|f`,s=v_.get(o)?null:new Y({seed:r?0:t&3,studSegments:6,chamfer:0});s&&(t_(s,1),s.push(),s.translate(0,Jg-(r?.35:0),Yg+(r?.7:0)),r&&s.rotateX(20*Ag),u_(s,1),s.pop());let c={pitch:0,roll:0,x:0,y:0,z:0},l=r?n/x_*Math.PI*2:Math.PI*.4;for(let t of[1,-1])for(let n of[1,-1]){__({pv:e,side:t,lvl:n,off:b_[`${t},${n}`]},+!!r,l,c);let i=new G().makeTranslation(c.x,c.y,c.z).multiply(new G().makeRotationFromEuler(g_.set(c.pitch,0,c.roll,`ZYX`))).multiply(new G().makeScale(t,n,1)),o=[.5,-1.12,5.3];if(s&&(s.push(),s.apply(i),o=Qg(s,1),s.pop()),!r){let e=new U(...o).applyMatrix4(i);a.push([e.x,e.y,e.z])}}return s&&v_.set(o,s.build(`vulture-lod1-${r?`walk${n}`:`flight`}`).group),v_.get(o)},s=o(-1).clone();e.add(s);let c=null,l=0,u=0;s.traverse(e=>{let t=e.geometry;e.isMesh&&(u+=(t.index?t.index.count:t.attributes.position.count)/3)}),e.userData.triangles=u,e.userData.drawCalls=s.children.length;for(let t of a)n.push(Eu(`muzzle`,e,t[0],t[1],t[2]));let d=Eu(`engine`,e,0,-.2,-4.8);return d.rotation.y=Math.PI,r.push(d),{group:e,length:jg,muzzles:n,engines:r,setMode(t){let n=t>.5;if(n&&!c){for(let e=0;e<x_;e++)o(e);c=o(l).clone(),e.add(c)}s.visible=!n,c&&(c.visible=n)},setGait(e){let t=Math.floor((e/(Math.PI*2)%1+1)%1*x_)%x_;if(t===l||(l=t,!c))return;let n=o(t).children;n.length===c.children.length&&c.children.forEach((e,t)=>{e.geometry=n[t].geometry})}}}var C_=2,w_=`reddishBrown`,T_=`lbg`,E_=[90,210,330].map(e=>e*Ag),D_=[30,150].map(e=>e*Ag),O_=38*Ag,k_=[0,-1.3,1.6],A_=.8,j_={r:1.5,z:1.5,ar:5.5,az:3.1,t0:-95*Ag,t1:0},M_=[7.4,1.8],N_=[1.45,-2.25],P_=(()=>{let e=[[0,j_.t0]];for(let t=1;t<=96;t++){let n=j_.t0+(j_.t1-j_.t0)*t/96,r=e[t-1][1];e.push([e[t-1][0]+Math.hypot(j_.ar*(Math.cos(n)-Math.cos(r)),j_.az*(Math.sin(n)-Math.sin(r))),n])}return e})(),F_=P_[P_.length-1][0];function I_(e){let t=Cg(P_,e*F_)[0],n=j_.az*Math.cos(t),r=j_.ar*Math.sin(t),i=Math.hypot(n,r);return{p:[j_.r+j_.ar*Math.cos(t),j_.z+j_.az*Math.sin(t)],n:[n/i,r/i],w:.75+.25*e*e}}function L_(e,t){let{p:n,n:r}=I_(e);return[n[0]+r[0]*t,n[1]+r[1]*t]}function R_(e,t,n,r,i){let a=[];for(let o=0;o<n;o++){let s=e+(t-e)*o/n,c=e+(t-e)*(o+1)/n,l=I_(s).w,u=I_(c).w;a.push([L_(s,r(l)),L_(s,i(l)),L_(c,i(u)),L_(c,r(u))])}return a}function z_(e,t,n,r=6){let i=Math.max(1,Math.round(Math.abs(t-e)/r)),a=[];for(let r=0;r<=i;r++){let o=(e+(t-e)*r/i)*Ag;a.push([n*Math.sin(o),n*Math.cos(o)])}return a}function B_(e,t,n,r){let i=z_(e,t,C_,r),a=z_(e,t,C_+n,r);return[i[0],...a,i[i.length-1]]}function V_(e,t){let n=t?15:5,r=t?12:32,i=t?[[`gunmetal`,z_(0,50,C_,n)],[`dbg`,z_(50,88,C_,n)],[`gunmetal`,B_(88,100,.05,12)],[`dbg`,z_(100,180,C_,n)]]:[[`gunmetal`,z_(0,50,C_,n)],[`dbg`,B_(50,55,.06,2.5)],[`dbg`,z_(55,88,C_,n)],[`gunmetal`,B_(88,100,.05,4)],[`dbg`,z_(100,141,C_,n)]];for(let[t,n]of i)Eg(e,t,n,{axis:`z`,radial:r,crease:40});for(let n of D_){let r=[Math.cos(n)*Math.sin(O_),Math.sin(n)*Math.sin(O_),Math.cos(O_)];if(e.push(),e.apply(pg([r[0]*1.92,r[1]*1.92,r[2]*1.92],r)),t)yg(e,`glowRed`,[0,0,.1],.5,8,4);else{Eg(e,`gunmetal`,[[.5,.26],[.64,.26],[.72,.18],[.72,-.1]],{axis:`z`,radial:20,crease:40}),Eg(e,`black`,[[0,.12],[.5,.12],[.5,.26]],{axis:`z`,radial:20,crease:40});let t=.2984/.44,n=Math.asin(.5/t),r=[];for(let e=0;e<=5;e++)r.push([t*Math.sin(n*e/5),-.33818181818181825+t*Math.cos(n*e/5)]);Eg(e,`trRed`,r,{axis:`z`,radial:20,crease:60}),yg(e,`glowRed`,[0,0,.14],.3,12,6)}e.pop()}let[,a,o]=k_;if(e.box(`gunmetal`,0,a,o,.72,.6,1,{c:t?0:.06}),gg(e,`gunmetal`,[0,a,o+.4],[0,a,3.55],.13,{radial:t?6:10}),!t){gg(e,`flatSilver`,[0,a,3.45],[0,a,3.82],.18,{radial:12}),gg(e,`flatSilver`,[0,a,2.35],[0,a,2.5],.17,{radial:12}),gg(e,`black`,[0,a-.22,2],[0,a-.22,2.9],.06,{radial:6}),e.box(`lbg`,0,a+.36,o-.1,.5,.12,.6,{c:.03});for(let t of[30,150,270].map(e=>e*Ag)){let n=114*Ag,r=[Math.cos(t)*Math.sin(n),Math.sin(t)*Math.sin(n),Math.cos(n)];e.push(),e.apply(pg([r[0]*1.98,r[1]*1.98,r[2]*1.98],r,[0,0,1])),e.box(`gunmetal`,0,0,.04,.95,.75,.14,{c:.03});for(let t=0;t<4;t++)e.box(`black`,0,-.24+t*.16,.12,.75,.07,.04,{c:0});e.pop()}Eg(e,`gunmetal`,[[1.3,-1.52],[1.3,-2.2],[1,-2.42],[0,-2.42]],{axis:`z`,radial:24,crease:35}),e.push(),e.rotateX(-Math.PI/2);for(let t=0;t<6;t++){let n=t/6*Math.PI*2;e.stud(`dbg`,Math.cos(n)*.62,2.42,Math.sin(n)*.62)}e.pop()}}function H_(e,t){let n=t?4:8;e.push(),e.rotateY(Math.PI/2);let r=(t,n,r,i={})=>e.prism(t,n.map(([e,t])=>[-t,e]),r,i);for(let e of R_(0,1,n,e=>-e,e=>e))r(`dbg`,e,A_,{c:t?0:.1});for(let e of R_(1/n,1,n-1,e=>e-.24,e=>e+.03))r(`lbg`,e,.92,{c:t?0:.04});if(t)for(let e of R_(.24,.95,3,e=>.3-e,e=>e-.3))r(w_,e,.8300000000000001,{c:0});else{let e=R_(.24,.95,6,e=>.3-e,e=>e-.3);for(let t of[1,-1]){for(let n of e)r(w_,n,.04,{c:0,zc:t*.41500000000000004});for(let e=0;e<7;e++){let n=.26+.67*e/7,i=.26+.67*(e+1)/7,a=(n+i)/2;r(T_,[L_(n,I_(n).w-.36),L_(i,I_(i).w-.36),L_(a,.36-I_(a).w)],.02,{c:0,zc:t*.44})}}}if(e.pop(),!t){for(let t=0;t<6;t++){let n=.17+t*.055,{n:r,w:i}=I_(n),[a,o]=L_(n,-i-.08);_g(e,`black`,[0,a,o],[0,-r[0],-r[1]],[1,0,0],.13,.66,.34,{c:.02})}let t=I_(.14);_g(e,`gunmetal`,[0,t.p[0],t.p[1]],[0,-t.n[1],t.n[0]],[1,0,0],2*t.w+.2,.98,.42,{c:.05})}let[i,a]=M_;if(e.box(`gunmetal`,0,i,a,.6,.66,.9,{c:t?0:.06}),gg(e,`gunmetal`,[0,i,a+.4],[0,i,a+1.75],.11,{radial:t?6:10}),!t){gg(e,`flatSilver`,[0,i,a+1.62],[0,i,a+1.95],.16,{radial:12}),gg(e,`flatSilver`,[0,i,a+.75],[0,i,a+.88],.15,{radial:12}),e.box(`gunmetal`,0,6.55,1.53,.92,1,.1,{c:.02});for(let t of[a-.2,a+.2])e.stud(`gunmetal`,0,i+.33,t)}let[o,s]=N_;Q(e,`gunmetal`,[0,o,s],[0,0,1],.46,1.1,{radial:t?8:16}),t||Q(e,`gunmetal`,[0,o,s-.42],[0,0,1],.54,.2,{radial:16}),Q(e,`glowOrange`,[0,o,s-.57],[0,0,1],.36,.04,{radial:t?8:16})}function U_(e={}){let t=e.lod??0,n=e.seed??1,r=new sn;r.name=t?`trifighter-lod1`:`trifighter`;let i=ug(),a=new Y({seed:n,studSegments:t?6:10,chamfer:t?0:.035});V_(a,t);for(let e of E_)a.push(),a.rotateZ(e-Math.PI/2),H_(a,t),a.pop();dg(a,r.name,r,i);let o=[fg(`muzzle`,r,0,k_[1],3.9)],s=[];for(let e of E_){let t=(t,n)=>[Math.cos(e)*t,Math.sin(e)*t,n];o.push(fg(`muzzle`,r,...t(M_[0],M_[1]+2)));let n=fg(`engine`,r,...t(N_[0],N_[1]-.6));n.rotation.y=Math.PI,s.push(n)}return r.userData.triangles=i.tris,r.userData.drawCalls=i.calls,r.userData.span=2*(j_.r+j_.ar+I_(1).w),{group:r,length:6.8,muzzles:o,engines:s}}var W_=1,G_=2.1,K_=2.4,q_=1.02,J_=.05,Y_=115*Ag,X_=.28,Z_=.52,Q_=2.52,$_=6.8004/(2*q_),ev=e=>Math.max(0,Math.sqrt(Math.max(0,$_*$_-e*e))+q_-$_),tv=(e,t,n)=>[e*Math.cos(n),e*Math.sin(n),t];function nv(e,t,n){let r=[],i=[],a=[];for(let e=0;e<=14;e++){let t=K_*e/14,n=ev(t),o=(n- -2.313529411764706)/$_,s=t/$_;r.push([n,G_+t]),a.push([o,s]),i.push([Math.max(0,n-J_*o),G_+t-J_*s])}let o=new Hl,s=new Hl;for(let c=0;c<n;c++){let l=e+(t-e)*c/n,u=e+(t-e)*(c+1)/n;for(let e=0;e<14;e++){let t=(e,t)=>[a[e][0]*Math.cos(t),a[e][0]*Math.sin(t),a[e][1]],n=(e,t)=>[-a[e][0]*Math.cos(t),-a[e][0]*Math.sin(t),-a[e][1]];o.quad(tv(r[e][0],r[e][1],l),tv(r[e][0],r[e][1],u),tv(r[e+1][0],r[e+1][1],u),tv(r[e+1][0],r[e+1][1],l),t(e,l),t(e,u),t(e+1,u),t(e+1,l)),s.quad(tv(i[e][0],i[e][1],l),tv(i[e][0],i[e][1],u),tv(i[e+1][0],i[e+1][1],u),tv(i[e+1][0],i[e+1][1],l),n(e,l),n(e,u),n(e+1,u),n(e+1,l))}s.quad(tv(r[0][0],r[0][1],l),tv(r[0][0],r[0][1],u),tv(i[0][0],i[0][1],u),tv(i[0][0],i[0][1],l),[0,0,-1])}for(let[n,a]of[[e,-1],[t,1]]){let e=[-a*Math.sin(n),a*Math.cos(n),0];for(let t=0;t<14;t++)s.quad(tv(r[t][0],r[t][1],n),tv(r[t+1][0],r[t+1][1],n),tv(i[t+1][0],i[t+1][1],n),tv(i[t][0],i[t][1],n),e)}return{skin:o.done(),lining:s.done()}}var rv=[[`dbg`,[[0,2.06],[.9400000000000001,2.06]]],[`flatSilver`,[[.9400000000000001,2.06],[.9400000000000001,G_],[1.06,G_],[1.06,1.9400000000000002],[W_,1.9400000000000002]]],[`dbg`,[[W_,1.9400000000000002],[W_,1.62]]],[`darkRed`,[[W_,1.62],[1.02,1.61],[1.02,1.5],[W_,1.49]]],[`dbg`,[[W_,1.49],[W_,1.44]]],[`darkRed`,[[W_,1.44],[1.02,1.43],[1.02,1.36],[W_,1.35]]],[`dbg`,[[W_,1.35],[W_,.76],[.975,.74],[W_,.72],[W_,-.44],[.975,-.46],[W_,-.48],[W_,-.8]]],[`gunmetal`,[[W_,-.8],[.97,-.84],[.58,-1.36],[.52,-1.4]]],[`flatSilver`,[[.52,-1.4],[.36,-1.42],[.36,-1.52],[.4,-1.55],[.36,-1.58],[.36,-1.68],[.52,-1.7]]],[`dbg`,[[.52,-1.7],[.55,-1.74],[.55,-2.88],[.53,-2.9],[.55,-2.92],[.55,-3.66]]],[`darkRed`,[[.55,-3.66],[.57,-3.68],[.57,-3.86],[.55,-3.88]]],[`dbg`,[[.55,-3.88],[.55,-4.06],[.5,-4.12]]],[`gunmetal`,[[.5,-4.12],[.43,-4.16],[.49,-4.5],[.44,-4.5],[.34,-4.24]]],[`glowOrange`,[[.34,-4.24],[0,-4.24]]]];function iv(e,t=0){let n=new U(Math.cos(e),Math.sin(e),0),r=new U(0,0,1);return new G().makeBasis(n,r,n.clone().cross(r)).setPosition(0,0,t)}function av(e){for(let[t,n]of rv)Eg(e,t,n,{axis:`z`,radial:24,crease:40});e.push(),e.rotateY(Math.PI/2),e.prism(`lbg`,[[1.6,.95],[-.3,.95],[-.7,1.62],[-.45,1.62]].map(([e,t])=>[-e,t]),.1,{c:.03}),e.prism(`lbg`,[[.8,-.95],[.1,-.95],[-.45,-1.85],[-.2,-1.85]].map(([e,t])=>[-e,t]),.1,{c:.03}),e.pop();for(let t of[1,-1]){e.push(),e.rotateX(Math.PI/2),e.prism(`lbg`,[[.95,1.5],[.95,.95],[1.55,.7],[1.55,.92]].map(([e,n])=>[t*e,n]),.09,{c:.03}),e.pop(),e.box(`lbg`,t*.97,-.32,.15,.1,.34,.7,{c:.03});for(let n=0;n<4;n++)e.box(`black`,t*1.02,-.32,-.12+n*.18,.02,.24,.06,{c:0})}for(let t=0;t<4;t++){let n=Math.PI/4+t*Math.PI/2;gg(e,`flatSilver`,tv(1.02,-.7,n),tv(1.02,1.25,n),.035,{radial:6}),e.push(),e.apply(iv(n)),e.box(`gunmetal`,W_,-.45,0,.1,.4,.26,{c:.02}),e.box(`gunmetal`,W_,1.12,0,.08,.2,.18,{c:.02}),e.pop()}for(let t=0;t<12;t++){let n=t/12*Math.PI*2+Math.PI/12;vg(e,`lbg`,tv(.78,-1.05,n),tv(1.16,-1.5,n),.08,6)}for(let t=0;t<4;t++)e.push(),e.apply(iv(Math.PI/4+t*Math.PI/2)),e.prism(`lbg`,[[.5,-3.5],[.5,-2.1],[2.05,-1.58],[2.1,-1.9]],.12,{c:.04}),e.box(`gunmetal`,1.35,-2.72,0,.9,.08,.16,{c:.02,rot:[0,0,.62]}),e.pop()}function ov(e){Eg(e,`lbg`,[[0,1.3],[.65,1.13],[1.13,.65],[1.3,0],[1.13,-.65],[.65,-1.13],[0,-1.3]],{axis:`x`,radial:12,crease:50}),e.add(`lbg`,sv(1.34,.22),void 0,{shade:.45}),e.add(`lbg`,$l(.55,.36,.03,10),new G().makeTranslation(0,.05,1.12).multiply(new G().makeRotationX(Math.PI/2)),{shade:.12}),Q(e,`glowRed`,[0,.12,1.32],[0,0,1],.17,.06,{radial:8})}function sv(e,t){let n=new Hl;for(let r=0;r<14;r++){let i=r/14*Math.PI*2,a=(r+1)/14*Math.PI*2,o=(t,n)=>[n,e*Math.cos(t),e*Math.sin(t)],s=e=>[0,Math.cos(e),Math.sin(e)];n.quad(o(i,-t/2),o(a,-t/2),o(a,t/2),o(i,t/2),s(i),s(a),s(a),s(i));for(let e of[1,-1])n.quad(o(i,e*t/2),o(a,e*t/2),[e*t/2,0,0],[e*t/2,0,0],[e,0,0])}return n.done()}function cv(e={}){let t=e.seed??1,n=new sn;n.name=`discord-missile`;let r=ug(),i=new Y({seed:t,studSegments:10});av(i),dg(i,`missile-body`,n,r);let a=[];for(let e=0;e<4;e++){let i=Math.PI/4+e*Math.PI/2,o=.03,{skin:s,lining:c}=nv(i-Math.PI/4+o,i+Math.PI/4-o,7),l=tv(q_,G_,i),u=fg(`missile:petal`,n,l[0],l[1],l[2]),d=new Y({seed:t+e+1}),f=new G().makeTranslation(-l[0],-l[1],-l[2]);d.add(`dbg`,s,f),d.add(`dbg`,c,f,{shade:.62}),Q(d,`dbg`,[0,0,0],[-Math.sin(i),Math.cos(i),0],.07,.5,{radial:8}),dg(d,`missile-petal`,u,r),a.push({pv:u,axis:new U(-Math.sin(i),Math.cos(i),0)})}let o=new Y({seed:t+9,studSegments:8});ov(o);let s=o.build(`payload-dummy`),c=[],l=[];for(let e=0;e<4;e++){let t=tv(Z_,Q_,Math.PI/4+e*Math.PI/2),r=fg(`payload`,n,t[0],t[1],t[2]),i=e===0?s.group:s.group.clone();i.name=`payload-dummy`,i.scale.setScalar(X_),i.rotation.set(0,0,e*Math.PI/2),r.add(i),c.push(r),l.push(r.position.clone())}let u=s.triangles,d=s.parts.length,f=fg(`engine`,n,0,0,-4.5);f.rotation.y=Math.PI;let p=e=>{let t=Dg(Og(e));for(let{pv:e,axis:n}of a)e.quaternion.setFromAxisAngle(n,t*Y_);let n=Dg(Og((e-.35)/.65));c.forEach((t,r)=>{let i=l[r];t.position.set(i.x*(1+n*.5),i.y*(1+n*.5),i.z+n*.9),t.visible=e>.02})};return p(0),n.userData.triangles=r.tris+u*4,n.userData.drawCalls=r.calls+d*4,n.userData.payloadScale=X_,{group:n,length:9,muzzles:[],engines:[f],setOpen:p,payloadAnchors:c}}var lv=1.3,uv=1.2,dv=-1.3,fv=.38,pv=Math.PI/2-.35,mv=new U(1.72,.72,-.12),hv=63*Ag,gv=new U(.44,.52,-.12),_v=new U(1,0,0),vv=.5,yv=.68,bv=-.52,xv=-.8;function Sv(e,t,n){let r=e*Math.sin(n);return[e*Math.cos(n),-r*Math.sin(t),r*Math.cos(t)]}function Cv(e,t,n,r){let i=[];for(let a=0;a<=r;a++){let o=t+(n-t)*a/r;i.push([e*Math.sin(o),e*Math.cos(o)])}return i}function wv(e,t,n){let r={axis:`x`,theta0:fv,thetaLen:Math.PI*2-2*fv,radial:20,crease:80},i={axis:`x`,theta0:-.38,thetaLen:2*fv,radial:4,crease:80},a=n?.3:.5,o=[[0,a,`lbg`],[a,a+.13,`flatSilver`],[a+.13,.98,`lbg`],[.98,1.2,`dbg`],[1.2,1.44,`lbg`],[1.44,Math.PI/2,`flatSilver`]];for(let[t,n,a]of o)if(Eg(e,a,Cv(lv,t,n,Math.max(1,Math.round((n-t)/.14))),r),t<pv){let r=Math.min(n,pv);Eg(e,a,Cv(lv,t,r,Math.max(1,Math.round((r-t)/.14))),i)}Eg(e,`black`,[[lv,0],...Cv(uv,Math.PI/2,0,7)],{...r,crease:60}),Eg(e,`black`,[[lv*Math.sin(pv),lv*Math.cos(pv)],...Cv(uv,pv,0,6)],{...i,crease:60});let s=[];for(let e=0;e<6;e++)s.push([Math.cos(e*Math.PI/3)*.15,Math.sin(e*Math.PI/3)*.15]);for(let[t,n,r]of[[0,1,0],[.34,6,0],[.7,11,.5]])for(let i=0;i<n;i++){let a=(i+r)/n*Math.PI*2;if(t>.9&&Math.cos(a)>Math.cos(.5800000000000001))continue;let o=Sv(1,a,t),c=t===0?[0,0,1]:[-Math.sin(t),-Math.cos(t)*Math.sin(a),Math.cos(t)*Math.cos(a)];e.push(),e.apply(pg(Sv(1.188,a,t),[-o[0],-o[1],-o[2]],c)),e.prism(`dbg`,s,.03,{c:0,noBack:!0}),e.pop()}let c=new Hl;for(let e of[1,-1]){let t=e*fv,n=[0,e*Math.cos(fv),Math.sin(fv)];for(let e=0;e<3;e++){let r=pv+(Math.PI/2-pv)*e/3,i=pv+(Math.PI/2-pv)*(e+1)/3;c.quad(Sv(lv,t,r),Sv(lv,t,i),Sv(uv,t,i),Sv(uv,t,r),n)}}e.add(`black`,c.done());for(let n=0;n<13;n++){let r=fv+(n+.5)*(Math.PI*2-2*fv)/13;for(let n of[0,1]){let i=t.pick([.1,.17,.25]),a=n===0?.98-.5*i/lv:1.2+.5*i/lv,o=[-Math.sin(a),-Math.cos(a)*Math.sin(r),Math.cos(a)*Math.cos(r)];_g(e,`dbg`,Sv(1.312,r,a),o,Sv(1,r,a),.14,.03,i+.03,{c:0,hide:{ny:!0}})}}for(let n=0;n<6;n++){let n=fv+t.range(.2,Math.PI*2-2*fv-.2),r=t.range(.6,.88),i=[-Math.sin(r),-Math.cos(r)*Math.sin(n),Math.cos(r)*Math.cos(n)];_g(e,`dbg`,Sv(1.308,n,r),i,Sv(1,n,r),.08,.025,.08,{c:0,hide:{ny:!0}})}e.cyl(`dbg`,1.14,0,0,.17,.12,{axis:`x`,radial:12}),yg(e,`flatSilver`,[_v.x,0,0],.075,8,5)}var Tv=[[-.24,-.88],[.24,-.88],[.36,-.5],[.5,0],[.52,.45],[.42,.62],[-.42,.62],[-.52,.45],[-.5,0],[-.36,-.5]],Ev=[[.36,.12],[0,.2],[-.37,.12]];function Dv(e,t){e.push(),e.translate(0,0,-.05),e.prism(`dbg`,Tv,.8),e.pop(),e.push(),e.translate(0,-.03,.385),e.prism(`lbg`,Tv.map(([e,t])=>[e*.74,t*.9]),.09),e.pop();for(let[t,n]of Ev)e.cyl(`black`,0,t,.45,n+.055,.1,{axis:`z`,radial:16,bottom:!1}),e.cyl(`glowRed`,0,t,.5,n,.04,{axis:`z`,radial:16,bottom:!1}),e.cyl(`glowOrange`,0,t,.52,n*.38,.02,{axis:`z`,radial:8,bottom:!1});e.push(),e.translate(0,0,.47),e.rotateX(Math.PI/2),e.add(`flatSilver`,eu(.29,.25,.07,.015,20)),e.pop(),e.push(),e.translate(0,0,.445),e.prism(`lbg`,[[-.3,.49],[.3,.49],[.2,.6],[-.2,.6]],.06),e.prism(`dbg`,[[-.12,-.8],[.12,-.8],[.16,-.58],[-.16,-.58]],.06),e.pop();for(let n of[1,-1]){for(let r of t)Q(e,`dbg`,[n*(r.s[0]-.05),r.s[1],r.s[2]],[1,0,0],.1,.12,{radial:8});Q(e,`dbg`,[n*gv.x,gv.y,gv.z],[0,0,1],.09,.3,{radial:8}),Q(e,`flatSilver`,[n*gv.x,gv.y,gv.z],[0,0,1],.05,.36,{radial:6}),e.box(`dbg`,n*.47,.2,-.16,.08,.34,.36),Q(e,`black`,[n*.515,.2,-.16],[1,0,0],.075,.02,{radial:8});for(let t=0;t<3;t++){let r=-.2-t*.11;e.box(`lbg`,n*(.37+(r+.5)*.28),r,-.05,.05,.045,.5,{c:0,rot:[0,0,n*.27]})}}e.box(`dbg`,0,.05,-.54,.62,.8,.2);for(let t=0;t<3;t++)e.box(`lbg`,0,.28-t*.16,-.655,.46,.06,.04,{c:0,hide:{nz:!0}});e.cyl(`lbg`,0,.66,0,.34,.08,{radial:18}),e.cyl(`dbg`,0,-.9,-.02,.13,.1,{radial:12})}function Ov(e){Eg(e,`dbg`,[[0,.44],[.18,.42],[.3,.36],[.38,.26],[.42,.13],[.43,.02],[.43,-.04],[0,-.04]],{radial:20,crease:50}),e.add(`lbg`,eu(.46,.38,.07,.015,20)),e.box(`black`,0,.21,.36,.26,.07,.08,{rot:[-.55,0,0],c:.015}),e.box(`lbg`,0,.43,-.06,.14,.05,.22,{c:.012});for(let t of[1,-1])Q(e,`black`,[t*.4,.12,.08],[t,.25,.2],.06,.05,{radial:8})}function kv(e){e.cyl(`flatSilver`,0,.07,0,.055,.14,{radial:8}),gg(e,`flatSilver`,[0,.1,0],[0,1.45,0],.022,{radial:6}),e.cyl(`flatSilver`,0,.75,0,.04,.06,{radial:6}),e.box(`flatSilver`,.08,1.33,0,.16,.1,.012,{c:.004})}function Av(e){gg(e,`dbg`,[0,0,0],[0,-.32,0],.065,{radial:8}),e.cyl(`dbg`,0,-.31,0,.11,.08,{radial:10});for(let t=0;t<3;t++)e.push(),e.rotateY(t*2*Math.PI/3+Math.PI/3),_g(e,`black`,[0,-.37,.07],[0,-.55,1],[0,1,.5],.05,.05,.17,{c:.012}),_g(e,`black`,[0,-.45,.12],[0,-1,-.2],[0,.2,1],.04,.04,.12,{c:.01}),e.pop()}var jv=[{s:[.5,.34,.12],l1:.9,l2:.9,work:[42,-32,80],fold:[30,75,150],flex:[9,10,16],speed:1.1},{s:[.5,-.03,.14],l1:.9,l2:.95,work:[24,20,28],fold:[20,80,150],flex:[3,5,6],speed:3.4},{s:[.36,-.5,.02],l1:.9,l2:1,work:[98,-15,76],fold:[60,80,150],flex:[2,2,3],speed:.9}];function Mv(e,t){yg(e,`dbg`,[0,0,0],.1,8,5),e.box(`dbg`,0,0,t/2,.1,.1,t-.18),gg(e,`dbg`,[0,.085,.14],[0,.085,t-.14],.028,{radial:6}),Q(e,`dbg`,[0,0,t],[1,0,0],.075,.16,{radial:8})}function Nv(e,t){gg(e,`flatSilver`,[0,0,.05],[0,0,t-.05],.042,{radial:8}),Q(e,`flatSilver`,[0,0,.2],[0,0,1],.068,.26,{radial:8}),Q(e,`flatSilver`,[0,0,t-.04],[0,0,1],.062,.08,{radial:8})}function Pv(e,t,n,r){let i=new Y({seed:r,studSegments:8}),a={};if(e===`saw`){i.box(`dbg`,.02,0,.05,.14,.13,.12),Q(i,`dbg`,[.08,0,.14],[1,0,0],.06,.1,{radial:8}),dg(i,`buzz-saw-arm`,n,t);let e=fg(`buzz:saw`,n,.14,0,.14),o=new Y({seed:r+1,studSegments:8,chamfer:.01});o.cyl(`flatSilver`,0,0,0,.29,.035,{axis:`x`,radial:20,c:.01}),o.cyl(`dbg`,0,0,0,.08,.07,{axis:`x`,radial:10});for(let e=0;e<16;e++){let t=e/16*Math.PI*2,n=t+.7*Math.PI*2/16,r=(e,t)=>[-(t*Math.cos(e)),t*Math.sin(e)];o.push(),o.rotateY(Math.PI/2),o.prism(`flatSilver`,[r(t,.275),r(n,.275),r(n-.05,.35)],.03,{c:0}),o.pop()}dg(o,`buzz-saw`,e,t),a.spin=e,a.spinAxis=`x`}else if(e===`grip`){i.box(`dbg`,0,0,.05,.14,.12,.1),dg(i,`buzz-grip`,n,t);let e=new Y({seed:r+2,studSegments:8});e.box(`flatSilver`,0,0,.1,.035,.07,.2,{c:.01}),_g(e,`flatSilver`,[-.025,0,.24],[-.45,0,1],[0,1,0],.035,.06,.11,{c:.01});let o=e.build(`buzz-finger`);a.fingers=[];for(let e of[1,-1]){let r=fg(`buzz:finger`,n,e*.05,0,.09),i=e>0?o.group:o.group.clone();i.scale.x=e,r.add(i),t.tris+=o.triangles,t.calls+=o.parts.length,a.fingers.push(r)}}else if(e===`drill`){Q(i,`dbg`,[0,0,.07],[0,0,1],.085,.16,{radial:10}),Q(i,`dbg`,[0,0,.17],[0,0,1],.06,.05,{radial:10}),dg(i,`buzz-drill-arm`,n,t);let e=fg(`buzz:drill`,n,0,0,.19),o=new Y({seed:r+3,studSegments:8});Eg(o,`flatSilver`,[[0,.34],[.02,.3],[.045,.16],[.05,.02],[.05,0],[0,0]],{axis:`z`,radial:8,crease:40});for(let e=0;e<3;e++)_g(o,`flatSilver`,[Math.cos(e*2.1)*.045,Math.sin(e*2.1)*.045,.1+e*.07],[0,0,1],[Math.cos(e*2.1),Math.sin(e*2.1),0],.1,.02,.025,{c:0});dg(o,`buzz-drill`,e,t),a.spin=e,a.spinAxis=`z`}else{let e=fg(`buzz:foot`,n);yg(i,`dbg`,[0,0,0],.065,8,5),i.box(`dbg`,0,-.07,.01,.07,.1,.07,{c:.012}),i.box(`dbg`,0,-.13,.03,.22,.05,.3);for(let e of[-.07,0,.07])_g(i,`black`,[e,-.14,.2],[0,-.35,1],[0,1,.35],.035,.035,.12,{c:.008});dg(i,`buzz-foot`,e,t),a.foot=e}return a}new ut;var Fv=new ut,Iv=new U,Lv=new U,Rv=new U,zv=new U(0,1,0),Bv=new U(0,0,1);function Vv(e={}){let t=e.seed??1,n=new au(t*131+7),r=new sn;r.name=`buzzdroid`;let i=ug(),a=new Y({seed:t,studSegments:10});Dv(a,jv),dg(a,`buzz-body`,r,i);let o=new Y({seed:t+1,studSegments:10});wv(o,n,n.chance(.5));let s=o.build(`buzz-shell`),c=[];for(let e of[1,-1]){let t=fg(e>0?`buzz:shellP`:`buzz:shellS`,r),n=e>0?s.group:s.group.clone();n.scale.x=e,t.add(n),i.tris+=s.triangles,i.calls+=s.parts.length,c.push(t)}let l=new Y({seed:t+2,studSegments:8});gg(l,`flatSilver`,[0,0,0],[0,1,0],.035,{radial:8,ch:0});let u=l.build(`buzz-strut`),d=[];for(let e of[1,-1]){let t=fg(`buzz:strut`,r);t.add(e>0?u.group:u.group.clone()),i.tris+=u.triangles,i.calls+=u.parts.length,d.push(t)}let f=fg(`buzz:head`,r,0,yv,0),p=fg(`buzz:headLook`,f),m=new Y({seed:t+3,studSegments:10});Ov(m),dg(m,`buzz-head`,p,i);let h=fg(`buzz:antenna`,p,.14,.3,-.2);h.rotation.set(-.2,0,-.08);let g=new Y({seed:t+4,studSegments:8});kv(g),dg(g,`buzz-antenna`,h,i);let _=fg(`buzz:tail`,r,0,xv,-.02),v=new Y({seed:t+5,studSegments:8});Av(v),dg(v,`buzz-tail`,_,i);let y=fg(`buzz:arms`,r),b=new Map,x=(e,n,r)=>{let a=`${e}|${n}`,o=b.get(a),s;if(o)s=o.group.clone();else{let r=new Y({seed:t+6+b.size,studSegments:8});e===`upper`?Mv(r,n):Nv(r,n),o=r.build(`buzz-${e}`),b.set(a,o),s=o.group}r.add(s),i.tris+=o.triangles,i.calls+=o.parts.length},S=[],C=n.chance(.5)?`drill`:`grip`;for(let e of[1,-1]){let r=fg(e>0?`buzz:armsP`:`buzz:armsS`,y);r.scale.x=e,jv.forEach((a,o)=>{let s=fg(`buzz:arm${o}`,r,a.s[0],a.s[1],a.s[2]);x(`upper`,a.l1,s);let c=fg(`buzz:elbow${o}`,s,0,0,a.l1);x(`fore`,a.l2,c);let l=fg(`buzz:tool${o}`,c,0,0,a.l2),u=Pv(o===0?e>0?`grip`:C:o===1?`saw`:`foot`,i,l,t*10+o*2+(e>0?0:1));S.push({def:a,shoulder:s,elbow:c,...u,phase:n.range(0,Math.PI*2)})})}r.userData.groundY=dv,r.userData.radius=lv,r.userData.triangles=i.tris,r.userData.drawCalls=i.calls;let w=0,T=0,E=n.range(0,6),D=()=>{let e=Dg(Og(w/.55)),t=Dg(Og((w-.2)/.5)),n=Dg(Og((w-.35)/.65));c.forEach((t,n)=>{let r=n===0?1:-1;t.position.set(r*mv.x*e,mv.y*e,mv.z*e),Fv.setFromAxisAngle(Bv,r*hv),t.quaternion.identity().slerp(Fv,e),Lv.set(r*_v.x,_v.y,_v.z).applyQuaternion(t.quaternion).add(t.position),Iv.set(r*gv.x,gv.y,gv.z),Rv.subVectors(Lv,Iv);let i=Math.max(.01,Rv.length()),a=d[n];a.position.copy(Iv),a.quaternion.setFromUnitVectors(zv,Rv.divideScalar(i)),a.scale.set(1,i,1)}),f.position.set(0,kg(vv,yv,t),0),h.scale.set(1,kg(.12,1,t),1),p.rotation.set(Math.sin(T*.7+E)*.08*t,Math.sin(T*.9+E)*.35*t,0),_.position.y=kg(bv,xv,t),y.visible=w>.3;for(let e of S){let{work:t,fold:r,flex:i,speed:a}=e.def,o=(o,s)=>(kg(r[o],t[o],n)+i[o]*Math.sin(T*a*s+e.phase+o)*n)*Ag,s=o(0,1.3),c=o(1,1.7),l=o(2,2.1);if(e.shoulder.rotation.set(c,s,0,`YXZ`),e.elbow.rotation.set(l,0,0),e.spin&&e.spin.rotation.set(e.spinAxis===`x`?T*26:0,0,e.spinAxis===`z`?T*30:0),e.fingers){let t=(14+22*(.5+.5*Math.sin(T*3.1+e.phase)))*Ag*n+4*Ag;e.fingers[0].rotation.y=t,e.fingers[1].rotation.y=-t}e.foot&&e.foot.rotation.set(-(c+l),0,0)}};return D(),{group:r,head:f,setDeploy(e){w=Og(e),D()},animate(e){T=e,D()}}}var Hv={standard:null,commander:`yellow`,pilot:`blue`,security:`red`},Uv=2.1,Wv=.3,Gv=[.7,3.49,0],Kv=[0,3.8,-.06],qv=[0,4.73,-.1],Jv=[-.04,-.8,0],Yv=[[4.73,-.1,.11,.1,.1],[4.84,-.02,.2,.14,.14],[4.86,.1,.26,.17,.19],[4.79,.23,.29,.18,.2],[4.64,.33,.29,.17,.19],[4.46,.41,.26,.155,.16],[4.28,.48,.22,.135,.13],[4.12,.54,.18,.11,.1],[4,.58,.14,.09,.08]],Xv=24,Zv=3;function Qv(e){let t=Yv.length,n=Math.min(t-2,Math.max(0,Math.floor(e))),r=Math.min(1,e-n),i=Yv[Math.max(0,n-1)],a=Yv[n],o=Yv[n+1],s=Yv[Math.min(t-1,n+2)];return a.map((e,t)=>{let n=i[t],a=o[t],c=s[t];return .5*(2*e+(a-n)*r+(2*n-5*e+4*a-c)*r*r+(3*e-n-3*a+c)*r*r*r)})}function $v(e){let t=.02,n=Yv.length-1,r=Qv(Math.max(0,e-t)),i=Qv(Math.min(n,e+t)),a=i[0]-r[0],o=i[1]-r[1],s=Math.hypot(a,o)||1;return[a/s,o/s,o/s,-a/s]}function ey(e,t,n=0){let[r,i,a,o,s]=Qv(e),[,,c,l]=$v(e),u=Math.sin(t),d=Math.cos(t),f=d>=0?2.4:3.2,p=a*Math.sign(u)*Math.abs(u)**(2/f),m=(d>=0?o:s)*Math.sign(d)*Math.abs(d)**(2/f)+n;return[p,r+m*c,i+m*l]}function ty(e,t){let n=(Yv.length-1)*Zv,r=[];for(let e=0;e<=n;e++){let t=[];for(let n=0;n<Xv;n++)t.push(ey(e/Zv,n/Xv*Math.PI*2));r.push(t)}let[i,a]=wg(r,{pick:(e,n)=>{let r=(e+.5)/Zv,i=(n+.5)/Xv*Math.PI*2;return t&&r>.6&&r<3.4&&Math.cos(i)>.2?1:0},buckets:2});e.add(`tan`,i),t&&e.add(t,a);for(let t of[1,-1]){let n=4.4,r=ey(n,t*.4),[,,i,a]=$v(n);Q(e,`tan`,r,[t*.3,i,a],.036,.05,{radial:8})}let o=Qv(Yv.length-1),[s,c,l,u]=$v(Yv.length-1);_g(e,`tan`,[0,o[0]+s*.02+l*.01,o[1]+c*.02+u*.01],[0,s,c],[0,l,u],.17,.09,.05,{c:.015}),Q(e,`tan`,qv,[1,0,0],.085,.14,{radial:12});for(let t of[1,-1])Q(e,`tan`,[t*.105,qv[1],qv[2]],[1,0,0],.1,.07,{radial:12}),Q(e,`darkTan`,[t*.142,qv[1],qv[2]],[1,0,0],.035,.012,{radial:8});e.box(`tan`,0,4.2,-.075,.15,.96,.12,{c:.03})}function ny(e,t,n){let r=n===`security`?`red`:`tan`,i=n===`security`?`darkRed`:`darkTan`,a=n===`security`?`red`:t??`tan`,o=.38;e.prism(r,[[-.56,3.53],[.56,3.53],[.6,3.62],[.56,3.76],[.44,3.84],[-.44,3.84],[-.56,3.76],[-.6,3.62]],o,{c:.06});for(let t of[1,-1])e.prism(r,[[.34,3],[.46,2.92],[.57,3.08],[.57,3.56],[.36,3.56]].map(([e,n])=>[t*e,n]),o*.9),e.prism(r,[[.08,2.24],[.21,2.24],[.44,2.96],[.3,2.96]].map(([e,n])=>[t*e,n]),o*.7);e.prism(r,[[-.38,3.26],[.38,3.26],[.38,3.38],[-.38,3.38]],o*.85),e.prism(a,[[-.38,3.24],[.38,3.24],[.33,2.92],[-.33,2.92]],o*.8,{zc:.01}),e.box(i,0,3.08,.16400000000000003,.36,.035,.012,{c:0}),e.box(r,0,2.3,0,.32,.14,.26,{c:.04}),e.box(r,0,3.87,-.07,.28,.08,.22,{c:.03});for(let t of[1,-1])Q(e,r,[t*.68,Gv[1],0],[1,0,0],.075,.34,{radial:10});e.box(r,0,3.28,-.4,.8,.92,.44,{c:.1}),e.box(r,0,3.3,-.635,.56,.62,.05,{c:.02});for(let t=0;t<4;t++)e.box(i,0,3.5-t*.13,-.665,.42,.05,.015,{c:0});for(let t of[1,-1])e.box(r,t*.41,3.28,-.4,.03,.6,.26,{c:.01})}function ry(e){Q(e,`tan`,[0,Uv,0],[1,0,0],.16,.36,{radial:14})}function iy(e){let t=-2.1;Q(e,`tan`,[0,0,0],[1,0,0],.16,.2,{radial:14}),e.push(),e.rotateY(Math.PI/2);let n=(t,n)=>e.prism(`tan`,t.map(([e,t])=>[-e,t]),n);n([[-.1,-.02],[.1,-.02],[.085,-.84],[-.085,-.84]],.22),n([[-.085,-.95],[.085,-.95],[.07,-1.68],[-.07,-1.68]],.18),e.prism(`tan`,[[-.26,t],[.6,t],[.62,-2],[.52,-1.9400000000000002],[.08,-1.8],[-.2,-1.7400000000000002],[-.26,-1.8]].map(([e,t])=>[-e,t]),.5,{c:.045,zc:.04}),e.pop(),e.box(`tan`,0,-.45,.095,.13,.5,.03,{c:.01}),Q(e,`tan`,[0,-.9,0],[1,0,0],.13,.24,{radial:12}),e.box(`tan`,0,-1.3,.075,.11,.42,.04,{c:.015}),e.box(`tan`,0,-1.74,-.01,.16,.14,.17,{c:.03})}function ay(e){e.box(`tan`,0,-.02,0,.24,.6,.3,{c:.07}),Q(e,`tan`,[.125,0,0],[1,0,0],.11,.03,{radial:14}),e.box(`tan`,0,-.5,0,.13,.4,.15,{c:.035}),Q(e,`tan`,[0,-.72,0],[1,0,0],.11,.18,{radial:12})}function oy(e){e.box(`tan`,0,-.33,0,.12,.5,.13,{c:.03}),e.box(`tan`,-.01,-.58,0,.14,.1,.15,{c:.03});let t=1.5,n=new G().makeTranslation(Jv[0],Jv[1],Jv[2]).multiply(new G().makeRotationX(Math.PI/2));e.add(`tan`,Tg(.27,.15,.14,5*Math.PI/4+t/2,Math.PI*2-t,16,.03),n)}function sy(e){e.box(`black`,0,-.03,0,.1,.32,.12,{c:.02}),e.box(`black`,0,.24,.12,.2,.25,.96,{c:.03}),e.box(`dbg`,0,.11,.1,.06,.05,.26,{c:.01}),gg(e,`black`,[0,.26,.6],[0,.26,1.34],.055,{radial:8}),gg(e,`dbg`,[0,.26,1.26],[0,.26,1.42],.075,{radial:10}),gg(e,`black`,[0,.17,.6],[0,.17,1],.03,{radial:6}),gg(e,`black`,[0,.47,-.05],[0,.47,.45],.06,{radial:10});for(let t of[.03,.34])e.box(`black`,0,.41,t,.05,.06,.05,{c:.01});Q(e,`dbg`,[0,.47,.47],[0,0,1],.07,.04,{radial:10}),_g(e,`black`,[0,.17,-.62],[0,-.12,-1],[0,1,0],.13,.22,.5,{c:.03}),Q(e,`dbg`,[.12,.25,.28],[0,0,1],.065,.3,{radial:10})}function cy(e={}){let t=e.variant??`standard`,n=e.seed??1,r=Hv[t],i=new sn;i.name=`b1-${t}`;let a=ug(),o=e=>new Y({seed:n*31+e,studSegments:10}),s=(e,t,n,r,i,s)=>{let c=fg(e,t,n[0],n[1],n[2]),l=o(s);return r&&l.mirrorX(),i(l),dg(l,e,c,a),c},c=s(`b1:hips`,i,[0,0,0],!1,ry,0),l=s(`b1:legL`,i,[Wv,Uv,0],!1,iy,1),u=s(`b1:legR`,i,[-.3,Uv,0],!0,iy,2),d=s(`b1:torso`,i,[0,Uv,0],!1,e=>{e.translate(0,-2.1,0),ny(e,r,t)},3),f=s(`b1:head`,d,[Kv[0],Kv[1]-Uv,Kv[2]],!1,e=>{e.translate(-Kv[0],-Kv[1],-Kv[2]),ty(e,t===`security`?null:r)},4),p=e=>{let t=e>0?`L`:`R`,n=s(`b1:arm${t}`,d,[e*Gv[0],Gv[1]-Uv,Gv[2]],e<0,ay,6+e),r=s(`b1:forearm${t}`,n,[0,-.72,0],e<0,oy,9+e);return n.userData.elbow=r,{sh:n,el:r}},m=p(1),h=p(-1),g=s(`b1:blaster`,h.el,[-Jv[0],Jv[1],Jv[2]],!1,sy,12);g.quaternion.setFromAxisAngle(new U(1,0,0),Math.PI/2);let _=fg(`muzzle`,g,0,.26,1.44);i.userData.triangles=a.tris,i.userData.drawCalls=a.calls,i.userData.muzzle=_,i.userData.height=5;let v=e=>{let t=Og(e.aim??0),n=e.walk,r=n===void 0?0:Math.sin(n),i=n===void 0?0:Math.abs(Math.cos(n))*.05-.03;l.rotation.set(-r*.42,0,0),u.rotation.set(r*.42,0,0),c.position.y=i,l.position.y=u.position.y=d.position.y=Uv+i;let a=kg(0,-.16,t);d.rotation.set(0,a+r*.05*(1-t),0),h.sh.rotation.set(kg(-.22+r*.12,-1.22,t),-a,kg(-.06,0,t),`YXZ`),h.el.rotation.set(kg(-.62,-.35,t),0,0),m.sh.rotation.set(kg(-.06-r*.3,-.3,t),0,kg(.09,.05,t),`YXZ`),m.el.rotation.set(kg(-.18,-.55,t),0,0),f.rotation.set(kg(0,.08,t),(e.lookYaw??0)-a,e.headTilt??0,`YXZ`)};return v({}),{group:i,head:f,torso:d,armL:m.sh,armR:h.sh,legL:l,legR:u,blaster:g,pose:v,parts:[f,m.sh,h.sh,g,d,l,u,c]}}function ly(e,t){let n=0,r=0;return t.traverseVisible(e=>{let t=e;if(!t.isMesh)return;let i=t.geometry;n+=(i.index?i.index.count:i.attributes.position.count)/3,r++}),console.info(`[lab-c] ${e}: ${n} tris, ${r} meshes`),t}function uy(e,t,n){return e.userData.frame={center:t,radius:n},e}var dy={vulture:()=>{let e=y_();return e.group.userData.animate=t=>e.animate?.(t),ly(`vulture`,e.group)},"vulture-head":()=>uy(y_().group,[0,2.2,2.6],4),"vulture-walk":()=>{let e=y_();return e.setMode(1),e.group.userData.animate=t=>e.setGait(t*2.2),uy(ly(`vulture-walk`,e.group),[0,-2,.5],19)},"vulture-lod1":()=>ly(`vulture-lod1`,y_({lod:1}).group),"vulture-lod1-walk":()=>{let e=y_({lod:1});return e.setMode(1),e.group.userData.animate=t=>e.setGait(t*5),uy(ly(`vulture-lod1-walk`,e.group),[0,-2,.5],19)},trifighter:()=>uy(ly(`trifighter`,U_().group),[0,2,.5],12),"trifighter-lod1":()=>uy(ly(`trifighter-lod1`,U_({lod:1}).group),[0,2,.5],12),"trifighter-eye":()=>uy(U_().group,[0,-.1,2],3.4),missile:()=>ly(`missile`,cv().group),"missile-half":()=>{let e=cv();return e.setOpen(.5),e.group},"missile-open":()=>{let e=cv();return e.setOpen(1),ly(`missile-open`,e.group)},"missile-nose":()=>{let e=cv();return e.group.userData.animate=t=>e.setOpen(t),uy(e.group,[0,0,2.6],3.2)},buzzdroid:()=>{let e=Vv();return e.setDeploy(1),e.group.userData.animate=t=>e.animate(t),ly(`buzzdroid`,e.group)},"buzzdroid-closed":()=>ly(`buzzdroid-closed`,Vv({seed:2}).group),"buzzdroid-half":()=>{let e=Vv({seed:3});return e.setDeploy(.5),e.group.userData.animate=t=>e.animate(t),e.group},"buzzdroid-close":()=>{let e=Vv({seed:4});return e.setDeploy(1),e.group.userData.animate=t=>e.animate(t),uy(e.group,[0,.1,.4],2.6)},battledroid:()=>py(ly(`battledroid`,cy().group)),"battledroid-aim":()=>{let e=cy();return e.pose({aim:1}),py(ly(`battledroid-aim`,e.group))},"battledroid-walk":()=>{let e=cy({variant:`pilot`});return e.group.userData.animate=t=>e.pose({walk:t*4}),py(e.group)},"battledroid-head":()=>uy(cy({variant:`commander`}).group,[0,4.25,.25],2.1),"battledroid-line":()=>fy(0),"battledroid-line-aim":()=>fy(1)};function fy(e){let t=new sn;return[`standard`,`commander`,`pilot`,`security`].forEach((n,r)=>{let i=cy({variant:n,seed:r+3});i.pose({aim:e}),i.group.position.x=(1.5-r)*2.1,t.add(i.group)}),uy(ly(`battledroid-line`,t),[0,2.55,0],5.6)}function py(e){return uy(e,[0,2.55,.2],4.4)}var my=(e,t)=>Math.sign(e)*Math.abs(e)**+t;function hy(e,t){let n=Math.cos(t),r=Math.sin(t),i=n>=0,a=2/(i?e.n??2:e.nb??e.n??2),o=i?e.b:e.bb??e.b;return[(e.x0??0)+e.a*my(r,a),(e.y0??0)+o*my(n,a),e.z]}function gy(e,t,n){let r=(e,t)=>e+(t-e)*n;return{z:r(e.z,t.z),a:r(e.a,t.a),b:r(e.b,t.b),bb:r(e.bb??e.b,t.bb??t.b),x0:r(e.x0??0,t.x0??0),y0:r(e.y0??0,t.y0??0),n:r(e.n??2,t.n??2),nb:r(e.nb??e.n??2,t.nb??t.n??2)}}function _y(e,t){if(t<=e[0].z)return{...e[0],z:t};for(let n=0;n<e.length-1;n++){let r=e[n],i=e[n+1];if(t<=i.z)return gy(r,i,(t-r.z)/(i.z-r.z||1))}return{...e[e.length-1],z:t}}function vy(e,t){let n=e.map(e=>({...e}));for(let e of t)e<=n[0].z+.001||e>=n[n.length-1].z-.001||n.some(t=>Math.abs(t.z-e)<.05)||(n.push(_y(n,e)),n.sort((e,t)=>e.z-t.z));return n}function yy(e,t,n,r={}){let i=r.m??2.5,a=r.ts??[-1,-.985,-.95,-.88,-.76,-.58,-.3,0,.3,.58,.76,.88,.95,.985,1],o=(e+t)/2,s=(t-e)/2,c=[];for(let e of a){let t=e<0?r.back??i:r.front??i,a=Math.max(0,1-Math.abs(e)**+t)**(1/t),l=Math.max(a,.02);c.push({...n,z:o+e*s,a:n.a*l,b:n.b*l,bb:(n.bb??n.b)*l})}return r.cuts?vy(c,r.cuts):c}function by(e,t,n){let r=.001,i=new U(...hy(_y(e,t),n)),a=new U(...hy(_y(e,t+r),n)).sub(new U(...hy(_y(e,t-r),n))),o=new U(...hy(_y(e,t),n+r)).sub(new U(...hy(_y(e,t),n-r)));return{p:i,n:new U().crossVectors(a,o).normalize()}}function xy(e,t,n=1){let r=0,i=Math.PI;for(let n=0;n<40;n++){let n=(r+i)/2;hy(e,n)[1]>t?r=n:i=n}let a=(r+i)/2;return n>0?a:-a}function Sy(e,t,n=new U(0,0,1)){let r=n.clone().addScaledVector(t,-n.dot(t));r.lengthSq()<1e-8&&r.set(0,1,0).addScaledVector(t,-t.y),r.normalize();let i=new U().crossVectors(t,r);return new G().makeBasis(i,t,r).setPosition(e)}function Cy(e,t,n){e.push(),e.apply(t),n(),e.pop()}var wy=e=>[e.x,e.y,e.z],Ty=(e,t,n)=>new U(e.x+(t.x-e.x)*n,e.y+(t.y-e.y)*n,e.z+(t.z-e.z)*n);function Ey(e){let t=0;for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t+=r[0]*i[1]-i[0]*r[1]}return t/2}function Dy(e,t=.001){let n=[];for(let r of e){let e=n[n.length-1];(!e||Math.hypot(r[0]-e[0],r[1]-e[1])>t)&&n.push(r)}for(;n.length>1&&Math.hypot(n[0][0]-n[n.length-1][0],n[0][1]-n[n.length-1][1])<=t;)n.pop();return n}function Oy(e,t){let n=Dy(e);if(n.length<3||(Ey(n)<0&&(n=[...n].reverse()),Math.abs(Ey(n))<1e-4))return null;if(t<=0)return n;let r=n.length,i=[];for(let e=0;e<r;e++){let a=n[e],o=n[(e+1)%r],s=o[0]-a[0],c=o[1]-a[1],l=Math.hypot(s,c);if(l<1e-6)return null;i.push({p:[a[0]-c/l*t,a[1]+s/l*t],d:[s/l,c/l]})}let a=[];for(let e=0;e<r;e++){let t=i[(e-1+r)%r],n=i[e],o=t.d[0]*n.d[1]-t.d[1]*n.d[0];if(Math.abs(o)<1e-9){a.push(n.p);continue}let s=((n.p[0]-t.p[0])*n.d[1]-(n.p[1]-t.p[1])*n.d[0])/o;a.push([t.p[0]+t.d[0]*s,t.p[1]+t.d[1]*s])}if(Ey(a)<=.001)return null;for(let e=0;e<r;e++){let t=a[e],n=a[(e+1)%r];if((n[0]-t[0])*i[e].d[0]+(n[1]-t[1])*i[e].d[1]<=0)return null}return a}function ky(e,t,n,r=0){for(let i=0;i<e.length;i++){let a=e[i],o=e[(i+1)%e.length],s=o[0]-a[0],c=o[1]-a[1],l=Math.hypot(s,c)||1;if((s*(n-a[1])-c*(t-a[0]))/l<r)return!1}return!0}var Ay=class{m=new Map;get(e,t){let n=Math.min(3,Math.floor(t*4)),r=`${e}|${n}`,i=this.m.get(r);return i||(i={key:e,shade:.955+n*.03,acc:new Hl},this.m.set(r,i)),i.acc}flush(e){for(let t of this.m.values())t.acc.pos.length&&e.add(t.key,t.acc.done(),void 0,{tint:.004,shade:t.shade})}};function jy(e,t,n){let r=n.th0??0,i=n.th1??Math.PI*2,a=n.N??32,o=n.ths??Array.from({length:a+1},(e,t)=>r+(i-r)*t/a),s=o.length-1,c=Math.abs(o[s]-o[0]-Math.PI*2)<1e-6,l=t.map(e=>o.map(t=>new U(...hy(e,t)))),u=n.t??.4,d=n.gap??.03,f=n.chamfer??e.chamfer,p=n.core===void 0?`dbg`:n.core,m=p?new Hl:null,h=n.zMin??-1/0,g=n.zMax??1/0,_=new Ay,v=e=>{let n=(t[e].z+t[e+1].z)/2;return n>=h&&n<g},y=e=>(t[e].z+t[e+1].z)/2;for(let r=0;r<t.length-1;r++)if(v(r))for(let t=0;t<s;t++){if(n.cut?.(t,y(r)))continue;let i=l[r][t],a=l[r][t+1],s=l[r+1][t],c=l[r+1][t+1],p=s.clone().sub(i).add(c).sub(a),h=a.clone().sub(i).add(c).sub(s),g=new U().crossVectors(p,h);if(g.lengthSq()<1e-14)continue;g.normalize();let v=i.clone().add(a).add(c).add(s).multiplyScalar(.25);m&&!n.coreSkip?.(v,g)&&m.quad(wy(i),wy(a),wy(c),wy(s),wy(g));let b=(i.distanceTo(s)+a.distanceTo(c))/2,x=(i.distanceTo(a)+s.distanceTo(c))/2;if(b<.05||x<.05)continue;let S=typeof n.tileLen==`function`?n.tileLen(v,g):n.tileLen,C=typeof n.tileWid==`function`?n.tileWid(v,g):n.tileWid,w=Math.max(1,Math.round(b/S)),T=Math.max(1,Math.round(x/C)),E=[0];if((n.stagger??!0)&&w>=2&&t&1)for(let e=0;e<w;e++)E.push((e+.5)/w);else for(let e=1;e<w;e++)E.push(e/w);E.push(1);let D=(o[t]+o[t+1])/2;for(let o=0;o<E.length-1;o++)for(let l=0;l<T;l++){let p=l/T,m=(l+1)/T,h=E[o],g=E[o+1],v=(e,t)=>Ty(Ty(i,a,e),Ty(s,c,e),t),y=v(p,h),b=v(m,h),x=v(m,g),S=v(p,g),C=S.clone().sub(y).add(x).sub(b),w=b.clone().sub(y).add(x).sub(S),O=new U().crossVectors(C,w);if(O.lengthSq()<1e-14)continue;O.normalize();let k=y.clone().add(b).add(x).add(S).multiplyScalar(.25),A=C.clone().addScaledVector(O,-C.dot(O));if(A.lengthSq()<1e-12)continue;A.normalize();let ee=new U().crossVectors(O,A),j=new G().makeBasis(ee,O,A).setPosition(k),M=Oy([y,b,x,S].map(e=>{let t=e.clone().sub(k);return[t.dot(ee),t.dot(A)]}),d);if(!M)continue;let N=1/0,te=-1/0,P=1/0,F=-1/0;for(let e of M)N=Math.min(N,e[0]),te=Math.max(te,e[0]),P=Math.min(P,e[1]),F=Math.max(F,e[1]);let ne={k:r,j:t,row:o,col:l,rows:E.length-1,cols:T,c:k,n:O,w:te-N,l:F-P,th:D,fp:M,frame:j},re=n.spec(ne);if(re===null)continue;let ie=typeof re==`string`?{key:re}:re,ae=ie.t??u,oe=typeof n.flat==`function`?n.flat(k,O):!!n.flat;if(oe&&ie.key){let e=_.get(ie.key,ou(r*7919+t*104729+o*31+l*17|0)),n=M.map(([e,t])=>k.clone().addScaledVector(ee,e).addScaledVector(A,t)),i=n.map(e=>wy(e.clone().addScaledVector(O,ae)));for(let t=1;t<i.length-1;t++)e.tri(i[0],i[t],i[t+1],wy(O));if(ae>.4*1.5)for(let t=0;t<n.length;t++){let r=n[t],a=n[(t+1)%n.length],o=new U().crossVectors(O,a.clone().sub(r)).normalize(),s=ie.walls;if(s){let e=o.dot(ee),t=o.dot(A);if(!(e>.5&&s.px||e<-.5&&s.nx||t>.5&&s.pz||t<-.5&&s.nz))continue}e.quad(wy(r),wy(a),i[(t+1)%n.length],i[t],wy(o))}}if(e.push(),e.apply(j),ie.key&&(oe||e.shape(ie.key,M,0,ae,{c:ie.c??f}),ie.studs)){let t=ie.studs===!0?ie.key:ie.studs,n=Math.floor(te-N+.08),r=Math.floor(F-P+.08),i=(N+te)/2,a=(P+F)/2;for(let o=0;o<n;o++)for(let s=0;s<r;s++){let c=i+o-(n-1)/2,l=a+s-(r-1)/2;ky(M,c,l,.3)&&e.stud(t,c,ae,l)}}ie.fill?.(e,ne),e.pop()}}if(_.flush(e),m){let r=(n,r,i)=>{if(!r||!c)return;let a=t[n],o=a.z;if(o<h-1e-6||o>g+1e-6)return;let u=[a.x0??0,a.y0??0,a.z],d=new Hl;for(let e=0;e<s;e++)d.tri(u,wy(l[n][e]),wy(l[n][e+1]),[0,0,i]);e.add(r,d.done())};r(0,n.capStart,-1),r(t.length-1,n.capEnd,1),m.pos.length&&e.add(p,m.done())}if(n.inner){let r=n.inner.inset,i=t.map(e=>{let t={...e,a:Math.max(.01,e.a-r),b:Math.max(.01,e.b-r),bb:Math.max(.01,(e.bb??e.b)-r)};return o.map(e=>new U(...hy(t,e)))}),a=new Hl;for(let e=0;e<t.length-1;e++)if(v(e)){for(let t=0;t<s;t++){if(n.cut?.(t,y(e)))continue;let r=i[e][t],o=i[e][t+1],s=i[e+1][t],c=i[e+1][t+1],l=new U().crossVectors(s.clone().sub(r).add(c).sub(o),o.clone().sub(r).add(c).sub(s));l.lengthSq()<1e-14||(l.normalize().negate(),a.quad(wy(r),wy(o),wy(c),wy(s),wy(l)))}if(!c)for(let[r,c]of[[0,-1],[s,1]]){if(n.cut?.(Math.min(r,s-1),y(e)))continue;let u=l[e][r],d=l[e+1][r],f=i[e][r],p=i[e+1][r],m=new U(...hy(t[e],o[r]+.001*c)).sub(u).normalize();a.quad(wy(u),wy(d),wy(p),wy(f),wy(m))}}for(let[e,r]of[[0,-1],[t.length-1,1]]){let o=t[e].z;if(o<h-1e-6||o>g+1e-6)continue;let c=e===0?0:e-1;for(let t=0;t<s;t++)n.cut?.(t,y(c))||a.quad(wy(l[e][t]),wy(l[e][t+1]),wy(i[e][t+1]),wy(i[e][t]),[0,0,r])}a.pos.length&&e.add(n.inner.key,a.done())}}function My(e,t=[],n=0,r=Math.PI*2){let i=(r-n)/e,a=Array.from({length:e+1},(e,t)=>n+i*t),o=new Set([0,e]),s=[];for(let c of t){let t=c;for(;t<n;)t+=Math.PI*2;for(;t>r;)t-=Math.PI*2;let l=-1,u=1/0;for(let n=1;n<e;n++){let e=Math.abs(a[n]-t);e<u&&(u=e,l=n)}l>0&&u<i*.5&&!o.has(l)?(a[l]=t,o.add(l)):s.push(t)}return[...a,...s].sort((e,t)=>e-t).filter((e,t,n)=>t===0||e-n[t-1]>1e-5)}function Ny(e,t,n,r=0){let i=n-(e.y0??0),a=i>=0,o=(a?e.b:e.bb??e.b)-r,s=e.a-r;if(o<=0||s<=0)return!1;let c=a?e.n??2:e.nb??e.n??2;return(Math.abs(t-(e.x0??0))/s)**+c+(Math.abs(i)/o)**+c<1}function Py(e,t,n,r,i=0,a={}){e.push(),e.translate(i,0,0),e.rotateY(Math.PI/2),e.prism(t,n.map(([e,t])=>[-e,t]),r,a),e.pop()}var Fy=(()=>{let e=new Hl;return e.quad([-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,1,0]),e.done()})();function Iy(e,t,n,r,i,a,o){e.add(t,Fy,new G().makeTranslation(n,r,i).multiply(new G().makeScale(a,1,o)),{tint:.12})}function Ly(e,t,n,r,i,a={}){let o=new U(...n),s=new U(...r).sub(o),c=s.length();if(c<1e-6)return;let l=new ut().setFromUnitVectors(new U(0,1,0),s.clone().normalize()),u=new G().compose(o.clone().addScaledVector(s,.5),l,new U(1,1,1));e.add(t,$l(i,c,a.c??Math.min(.03,i*.2),a.radial??8),u)}function Ry(e,t,n,r,i=[0,0,1],a=[0,1,0]){let o=e.m,s=new U(...r).applyMatrix4(o),c=new U(...i).transformDirection(o),l=new U(...a).transformDirection(o),u=new U().crossVectors(l,c);u.lengthSq()<1e-8&&u.set(1,0,0),u.normalize();let d=new U().crossVectors(c,u).normalize(),f=new on;return f.name=t,f.position.copy(s),f.quaternion.setFromRotationMatrix(new G().makeBasis(u,d,c)),n.add(f),f}function zy(e,t,n,r,i,a,o=1){e.box(t,n,r+.1,i,o-.04,.2,a-.04,{hide:{ny:!0}});let s=Math.max(2,Math.round(a*2));for(let c=0;c<s;c++)e.box(t,n,r+.28,i-a/2+(c+.5)*(a/s),o-.12,.16,a/s*.5,{hide:{ny:!0},c:.02})}function By(e,t,n,r,i,a=.48,o=yu,s=10){e.cyl(t,n,r+o/2,i,a,o,{radial:s,bottom:!1}),e.stud(t,n,r+o,i)}function Vy(e,t,n,r,i,a={}){let o=Math.max(1,Math.floor(n))*Math.max(1,Math.floor(r)),s=Math.max(1,Math.round(o*(a.density??.35))),c=a.tall??1;for(let o=0;o<s;o++){let o=t.pick(i),s=t.next(),l=t.range(-n/2+.6,n/2-.6),u=t.range(-r/2+.6,r/2-.6);if(s<.22){let n=t.pick([1,2,2,3]);zy(e,o,l,0,u,Math.min(n,r-.4),1)}else if(s<.4)By(e,o,l,0,u,.48,yu*t.pick([1,1,3]));else if(s<.62){let n=t.pick([1,1,2]),i=t.pick([1,2,2,3,4]),s=yu*t.pick([1,1,2,3])*c;e.box(o,l,s/2,u,n-.04,s,Math.min(i,r-.3)-.04,{hide:{ny:!0}}),a.studs&&t.chance(.5)&&e.stud(o,l,s,u)}else if(s<.76){let n=t.range(1.5,Math.min(4,r-.4));e.cyl(o,l,.22,u,.16,n,{axis:`z`,radial:8})}else s<.88?(e.box(o,l,.3,u,.96,.6,1.96,{hide:{ny:!0}}),e.cyl(t.pick(i),l,.3,u,.24,1,{axis:`x`,radial:8})):e.prism(o,[[-.48,0],[.48,0],[.48,.2],[-.48,.66]],.96,{zc:0})}}var Hy=8,Uy={0:{lod:0,step:6,fN:26,aN:20,kN:20,mN:18,wid:2.6,lens:[3,4,4,6,8],flat:!1,studs:!0,greeble:!0,ribs:!0,windows:!0,radial:24,c:.06},1:{lod:1,step:9,fN:16,aN:12,kN:12,mN:10,wid:4,lens:[6,8,10],flat:!0,studs:!1,greeble:!1,ribs:!0,windows:!0,radial:14,c:0},2:{lod:2,step:14,fN:10,aN:7,kN:8,mN:6,wid:7,lens:[14],flat:!0,studs:!1,greeble:!1,ribs:!1,windows:!1,radial:8,c:0}},Wy=(e,t)=>Math.max(0,1-Math.min(1,Math.max(0,e))**+t)**(1/t),Gy=-4,Ky=30,qy=144;function Jy(e){let t=e>Ky?(e-Ky)/114:0,n=Wy(e<Ky?(Ky-e)/34:0,4);return{z:e,a:Math.max(.3,25*Wy(t,1.8)*n),b:Math.max(.3,14*Wy(t,1.5)*n),bb:Math.max(.4,7*(1-.6*t)*n),x0:6-3.4*t*t,y0:4-1.5*t,n:2.2,nb:2}}var Yy=-144,Xy=-60,Zy=-50;function Qy(e){let t=e<Xy?(Xy-e)/84:0,n=Wy(e>Xy?(e-Xy)/10:0,4);return{z:e,a:Math.max(.3,17*Wy(t,2.2)*n),b:Math.max(.3,9*Wy(t,2.5)*n),bb:Math.max(.4,5.5*(1-.5*t)*n),x0:4.5+1.2*t,y0:3.5-1.2*t,n:2.2,nb:2}}function $y(e,t,n,r,i){let a=new Set;for(let e=t;e<n-.01;e+=r)a.add(+e.toFixed(3));a.add(n);for(let e of i)e>t+.2&&e<n-.2&&a.add(e);return[...a].sort((e,t)=>e-t).map(e)}var eb=[{z:-120,a:1.2,b:.8,bb:1.2,y0:-6},{z:-112,a:4,b:2.5,bb:3.5,y0:-7},{z:-98,a:7,b:4,bb:6,y0:-8},{z:-75,a:9,b:5,bb:8,y0:-9},{z:-40,a:10,b:5.5,bb:9,y0:-9.5},{z:0,a:10,b:5.5,bb:8.5,y0:-9.5},{z:40,a:9,b:5,bb:7.5,y0:-9},{z:76,a:7,b:4.5,bb:6,y0:-8},{z:102,a:4.6,b:3.5,bb:4,y0:-7},{z:116,a:2.4,b:2.2,bb:2.4,y0:-6},{z:122,a:.9,b:.8,bb:.9,y0:-5.5}].map(e=>({n:2.4,nb:2.2,...e})),tb=[{z:-54,a:12.5,b:8.5,bb:6.5,y0:2.5},{z:-42,a:11.5,b:8,bb:6.5,y0:2.5},{z:-14,a:11.5,b:8,bb:6.5,y0:2.5},{z:-2,a:12.5,b:8.5,bb:6.5,y0:2.5}].map(e=>({n:3,nb:2.6,...e}));function nb(e,t){let n=[];for(let r=0;r<e.length-1;r++){let i=e[r],a=e[r+1],o=Math.max(1,Math.round((a.z-i.z)/t));for(let e=0;e<o;e++){let t=e/o,r=(e,n)=>e+(n-e)*t;n.push({z:r(i.z,a.z),a:r(i.a,a.a),b:r(i.b,a.b),bb:r(i.bb??i.b,a.bb??a.b),x0:0,y0:r(i.y0??0,a.y0??0),n:i.n,nb:i.nb})}}return n.push({...e[e.length-1]}),n}var rb=.07,ib=.04,ab=Math.PI*.7,ob=Math.PI*.72,sb=[[.6,.72],[1.1,1.22]],cb=[.42,.9,1.42,1.84],lb=[[.92,1.04]],ub=[.5,1.3,1.86],db=[1.2,1.36],fb=2,pb=(e,t)=>t.reduce((t,n)=>e>n?t+1:t,0),mb=(e,t)=>yu*(1+fb*(t.length-pb(e,t))),hb=e=>yu*(2+fb*e.length);function gb(e,t,n,r,i){return My(t,[rb,...r.flat(),...e.ribs?i.flatMap(e=>[e-ib,e+ib]):i],0,n)}var _b=(e,t)=>t.some(([t,n])=>e>t&&e<n),vb=(e,t)=>t.some(t=>Math.abs(e-t)<ib),yb=(e,t=0)=>cu(Math.round(e.x*4)+t*131,Math.round(e.y*4),Math.round(e.z*4)),bb=(e,t,n)=>cu(Math.floor((e+200)/14),Math.floor(t*2.6),n);function xb(e,t){return n=>e.lens[Math.floor(yb(n,t)*e.lens.length)]}function Sb(e,t,n,r,i){let a=Math.max(1,Math.floor(t.l/1.1));for(let o=0;o<a;o++){let s=-t.l/2+(o+.5)*(t.l/a);cu(Math.round(t.c.x*5),Math.round((t.c.z+s)*3),i)<r&&Iy(e,`windowWarm`,0,n,s,Math.min(.6,t.w*.55),.55)}}function Cb(e,t,n,r,i,a){let o=t=>{if(t<0||t>=a.length-1)return 0;let n=(a[t]+a[t+1])/2;return n<rb||e.ribs&&vb(n,r)?mb(n,r)+yu:mb(n,r)},s=a.slice(0,-1).map((e,t)=>o(t));return a=>{let{c:o,n:c,th:l,j:u}=a,d=yb(o,t),f=yb(o,t+3),p=s[u],m={px:a.col===a.cols-1&&p>(s[u+1]??0)+1e-4,nx:a.col===0&&p>(s[u-1]??0)+1e-4};if(l<rb)return{key:`lbg`,t:p,walls:m};if(e.ribs&&vb(l,r))return{key:`dbg`,t:p,walls:m};if(_b(l,n))return{key:d<.05?`darkRed`:`reddishBrown`,t:p,walls:m};let h=bb(o.z,l,t)<(l>i-.55?.45:.15)?`darkTan`:`tan`;d<.035&&(h=h===`tan`?`darkTan`:`tan`),f>.987&&(h=`lbg`);let g=!e.flat&&f<.05,_={key:h,t:p+(g?yu:0),walls:m};return e.studs&&c.y>.75&&f>.1&&f<.14&&(_.studs=!0),e.greeble&&c.y>.45&&d>.6&&d<.612&&a.l>1.8&&(_.fill=(e,t)=>{e.push(),e.translate(0,_.t,0),Vy(e,new au(Math.floor(d*1e6)),t.w,t.l,[`dbg`,`darkTan`,`lbg`],{density:.4}),e.pop()}),_}}function wb(e,t){return n=>{let{c:r,n:i,th:a}=n,o=a>Math.PI?Math.PI*2-a:a,s=yb(r,t+11);if(o>db[0]&&o<db[1])return e.lod===2?{key:`black`,t:.16,fill:s<.5?(e,t)=>Iy(e,`windowWarm`,0,.17,0,t.w*.3,t.l*.7):void 0}:{key:`black`,t:.16,fill:(e,n)=>Sb(e,n,.17,.55,t)};let c=bb(r.z,o,t+5),l=i.y<-.4?c<.6?`darkBrown`:c<.85?`dbg`:`darkTan`:c<.2?`dbg`:c<.6?`darkTan`:`darkBrown`;return s<.04&&(l=l===`dbg`?`darkTan`:`dbg`),i.y>-.4&&s>.97&&(l=`reddishBrown`),{key:l,t:yu}}}function Tb(e,t){return n=>{let{c:r,n:i}=n,a=yb(r,t+21),o=bb(r.z,n.th,t+7),s=o<.35?`reddishBrown`:o<.7?`darkTan`:`dbg`;a<.05&&(s=`dbg`);let c={key:s,t:!e.flat&&a>.9?yu*2:yu};return e.greeble&&i.y>.3&&a>.4&&a<.46&&(c.fill=(e,t)=>{e.push(),e.translate(0,c.t,0),Vy(e,new au(Math.floor(a*1e6)),t.w,t.l,[`dbg`,`gunmetal`,`lbg`,`darkTan`],{density:.45}),e.pop()}),c}}function Eb(e,t){let n=new Y({seed:t,studSegments:e.lod?6:8,uvScale:.11/Hy,tint:.05,chamfer:e.c});return n.scale(Hy),n}function Db(e,t,n,r,i,a,o,s,c,l={}){let u=gb(t,r,i,a,o),d=u.slice(0,-1).map((e,t)=>c.d[Math.min(c.d.length-1,pb((e+u[t+1])/2,o))]);jy(e,n,{...l,ths:u,cut:(e,t)=>(c.tip-t)*c.dir<d[e],tileLen:xb(t,s),tileWid:t.wid,spec:Cb(t,s,a,o,i,u),core:`black`,inner:{key:`darkBrown`,inset:1.1},flat:t.flat?!0:(e,t)=>t.y<-.2})}function Ob(e,t,n){jy(e,t.map(e=>({...e,x0:0,a:Math.max(.2,(e.x0??0)+e.a-4.2),b:Math.max(.2,e.b-3.6),bb:Math.max(.2,(e.bb??e.b)+1),n:2.4,nb:2.4})),{N:n,tileLen:99,tileWid:99,spec:()=>null,core:`darkBrown`,capStart:`darkBrown`,capEnd:`darkBrown`})}var kb=e=>(Jy(e).y0??0)+Jy(e).b+hb(cb),Ab=e=>(Qy(e).y0??0)+Qy(e).b+hb(ub);function jb(e,t,n,r,i,a,o,s){let c=r;for(;c<i-.5;){let r=Math.min(i-c,n.pick([6,8,10,12])),l=c+r/2,u=o(l),d=u+n.range(-2.5,1.8),f=a*2-n.pick([0,0,1.2]);e.box(n.chance(.3)?`dbg`:`lbg`,0,(s+d)/2,l,f,d-s,r-.2),e.box(`dbg`,0,d+.2,l,f-1.2,.4,r-1.2);for(let i of[-1,1]){let a=i*(f/2+.01);if(t.windows)for(let t=0;t<3;t++){let o=d-1.4-t*2.2;if(o<u-1.5)break;e.box(`black`,a-i*.05,o,l,.2,1.1,r-1.4);let s=Math.floor((r-1.4)/1.1);for(let t=0;t<s;t++)n.chance(.6)&&(e.push(),e.translate(a+i*.06,o,l-(r-1.4)/2+(t+.5)*((r-1.4)/s)),e.rotateZ(-i*Math.PI/2),Iy(e,`windowWarm`,0,0,0,.65,.6),e.pop())}else d-1.4>u-1.5&&(e.push(),e.translate(a+i*.02,d-1.4,l),e.rotateZ(-i*Math.PI/2),Iy(e,`windowWarm`,0,0,0,.8,r-2),e.pop())}t.greeble&&r>6&&n.chance(.6)?(e.push(),e.translate(0,d+.4,l),Vy(e,n,f-1.6,r-1.6,[`dbg`,`lbg`,`gunmetal`,`darkTan`],{density:.3}),e.pop()):t.lod===1&&n.chance(.5)&&e.box(`lbg`,n.range(-1.5,1.5),d+1,l,2.4,1.2,r*.4),n.chance(.3)&&Mb(e,t,n,n.range(-2,2),d+.4,l,n.range(3,8)),c+=r}}function Mb(e,t,n,r,i,a,o){Ly(e,`lbg`,[r,i,a],[r,i+o,a],.18,{radial:t.lod<2?6:4}),t.lod<2&&(Ly(e,`dbg`,[r,i+o*.45,a],[r,i+o*.75,a],.28,{radial:6}),n.chance(.5)&&Ly(e,`lbg`,[r-1.1,i+o*.7,a],[r+1.1,i+o*.7,a],.1,{radial:5})),e.cyl(`glowRed`,r,i+o+.1,a,.22,.2,{radial:6})}function Nb(e,t,n,r,i,a,o,s,c,l){let u=s/o;if(e.push(),e.translate(0,0,r),e.scale(1,1,u),e.lathe(n,[[0,i+a,0,1,o,i+a,0,1],[o,i+a,1,0,o,i,1,0],[o,i,0,-1,0,i,0,-1]],{radial:t.radial}),c){let n=i+a*.3,r=i+a*.78;e.lathe(t.windows?`black`:`windowWarm`,[[o+.08,r,1,0,o+.08,n,1,0]],{radial:t.radial})}if(e.pop(),c&&t.windows){let t=Math.round(Math.PI*(o+s)/1.3);for(let n=0;n<t;n++){if(!l.chance(.7))continue;let c=n/t*Math.PI*2;Cy(e,Sy(new U(Math.sin(c)*(o+.1),i+a*.54,r+Math.cos(c)*(s+.1*u)),new U(Math.sin(c)/o,0,Math.cos(c)/s).normalize(),new U(0,1,0)),()=>Iy(e,`windowWarm`,0,0,0,.7,a*.36))}}}function Pb(e,t,n,r,i){if(e.box(`lbg`,0,(i+24)/2,r,8,24-i,16),e.box(`dbg`,0,(i+24)/2,r-7.2,6,24-i,2),t.windows)for(let t of[-1,1]){e.box(`black`,t*4.02,22,r,.1,1.2,12);for(let i=0;i<9;i++)n.chance(.7)&&(e.push(),e.translate(t*4.1,22,r-5.4+i*1.35),e.rotateZ(-t*Math.PI/2),Iy(e,`windowWarm`,0,0,0,.7,.8),e.pop())}for(let[i,a,o,s,c]of[[24,2.2,7,10,`lbg`],[26.2,2.2,8.2,11.5,`tan`],[28.4,2.2,9.4,13,`lbg`],[30.6,1.8,10.6,14.5,`tan`]])Nb(e,t,c,r,i,a,o,s,!0,n);Nb(e,t,`dbg`,r,32.4,.8,9.8,13.6,!1,n),Nb(e,t,`lbg`,r-1,33.199999999999996,1.4,5,7,t.lod<2,n);let a=34.6;e.lathe(`dbg`,[[0,35.6,0,1,2.6,a,.5,.8],[2.6,a,1,0,2.6,34.5,1,0]],{radial:t.radial,at:[0,0,r+2]});for(let[i,o,s]of[[0,2,8],[2.2,-3,5],[-2.2,-3,5.5],[0,-5.5,4],[3.5,3.5,3]])Mb(e,t,n,i,a,r+o,s);return t.lod<2&&(e.cyl(`lbg`,4.5,35.9,r-4,1.4,.2,{axis:`z`,radial:12}),Ly(e,`dbg`,[4.5,a,r-4],[4.5,35.800000000000004,r-4],.12,{radial:5})),a}function Fb(e,t,n,r){let i=3.6;for(let[a,o]of[[9,36],[-44,-12]]){e.box(`darkTan`,0,(a+o)/2,r,i,o-a,18);for(let n=a+1.6;n<o-1;n+=t.lod===2?4.8:2.4){let t=Math.round((n-a)/2.4)%3==0?`dbg`:`tan`;e.box(t,0,n,r+.4,4.4,.8,16.4)}if(t.lod<2)for(let t of[-1,1]){e.box(`dbg`,t*2.1,(a+o)/2,r-9+1.2,.6,o-a-2,1.6),e.box(`dbg`,t*2.1,(a+o)/2,r+9-1.2,.6,o-a-2,1.6);for(let i=a+3;i<o-2;i+=3.2)n.chance(.6)&&(e.push(),e.translate(t*2.42,i,r-9+1.2),e.rotateZ(-t*Math.PI/2),Iy(e,`windowWarm`,0,0,0,.8,.9),e.pop())}}e.box(`lbg`,0,36.6,r+1,4.8,1.2,19.6),Py(e,`dbg`,[[r-9,37.2],[r+9+1.6,37.2],[r+9-2,39],[r-9,39]],i),e.box(`lbg`,0,-44.6,r,4.8,1.2,19),Mb(e,t,n,0,39,r-5,6),Mb(e,t,n,0,39,r+2,3.5),e.cyl(`glowRed`,0,-45.4,r+6,.3,.4,{radial:6})}function Ib(e,t,n,r,i){let a=t.lod===2?4:8;for(let o=0;o<a;o++){let s=o/a,c=10+52*s,l=10+52*(o+1)/a-.15,u=14-6*s,d=2.8-1.2*s,f=r+7,p=f-u/2,m=(c+l)/2,h=l-c;e.box(`darkTan`,m,i,p,h,d,u),e.box(`tan`,m,i+d/2+.2,p-.6,h-.3,.4,u-2.2),e.box(`reddishBrown`,m,i+d/2+.25,p-.6,h-.3,.42,1.4),e.box(`lbg`,m,i,f-.5,h,d*.7,1.2),t.lod<2&&e.box(`dbg`,m,i-d/2-.2,p,h-.6,.4,u-3);let g=t.lod===2?1:3;for(let t=0;t<g;t++){let n=c+h*(t+.5)/g;e.push(),e.translate(n,i,f+.11),e.rotateX(Math.PI/2),Iy(e,`glowYellow`,0,0,0,h/g*.7,d*.3),e.pop()}t.greeble&&n.chance(.7)&&(e.push(),e.translate(m,i+d/2+.4,p-u/2+1.6),Vy(e,n,h-.6,2.4,[`dbg`,`gunmetal`,`lbg`],{density:.6}),e.pop())}let o=r+7-4;e.cyl(`darkTan`,62.8,i,o,1.5,5,{radial:t.radial}),e.cyl(`dbg`,62.8,i+2.7,o,1.1,.5,{radial:t.radial}),Ly(e,`lbg`,[62.8,i+2.9,o],[62.8,i+8,o],.18,{radial:6}),Ly(e,`lbg`,[62.8,i-2.5,o],[62.8,i-6,o],.18,{radial:6}),t.lod<2&&(Ly(e,`lbg`,[62.8,i+6.5,o],[64.6,i+7.5,o+1],.12,{radial:5}),Ly(e,`lbg`,[62.8,i+6.5,o],[61,i+7.5,o+1],.12,{radial:5})),e.cyl(`glowRed`,62.8,i+8.1,o,.25,.2,{radial:6}),e.cyl(`glowRed`,64.35,i,o,.3,.3,{axis:`x`,radial:6})}function Lb(e,t){e.box(`darkTan`,12.6,3.4,t,2.6,4,3),Py(e,`dbg`,[[t-1.3,2],[t+1.3,2],[t+1.3,-6],[t-1.3,-8.5]],1.2,14.2),e.push(),e.translate(14.2,0,0),e.rotateY(-Math.PI/2),e.prism(`darkTan`,[[t-1.3,-8.5],[t+3.2,-9.6],[t+3.2,-8.2],[t+1.3,-6]],1.2),e.pop()}function Rb(e,t,n,r,i,a,o,s){let c=[];return Cy(e,Sy(i,a),()=>{e.scale(s),e.rotateY(o),t.lod<2?(e.cyl(`dbg`,0,.3,0,1.8,.6,{radial:t.radial>12?14:8}),Py(e,`darkTan`,[[1.2,.5],[2.1,.5],[1.2,1.7]],2.6),e.box(`dbg`,0,1.85,-.8,1.8,.3,1.6)):e.box(`dbg`,0,.3,0,3.2,.6,3.2),e.box(`tan`,0,1.1,-.3,2.6,1.2,3);for(let i of[-.55,.55])t.lod<2?Ly(e,`gunmetal`,[i,1.1,1.1],[i,1.1,5.2],.18,{radial:8}):e.box(`gunmetal`,i,1.1,3.15,.36,.36,4.1),c.push(Ry(e,`${r}-${i<0?`l`:`r`}`,n,[i,1.1,5.3]))}),c}function zb(e,t,n,r,i=0){let{p:a,n:o}=by(e,t,n);return a.addScaledVector(o,i),r<0&&(a.x=-a.x,o.x=-o.x),{p:a,n:o}}function Bb(e,t,n,r,i,a,o){let s=o/3,c=e=>e.map(e=>e.map((e,t)=>t===2||t===3||t===6||t===7?e:e*s));e.lathe(`gunmetal`,c([[3,0,1,0,2.7,-2.6,1,.1],[2.7,-2.6,0,-1,2.3,-2.6,0,-1],[2.3,-2.6,-1,0,2.5,0,-1,0]]),{radial:n.radial,at:[r,i,a],axis:`z`}),e.lathe(`dbg`,c([[3.3,.6,1,0,3.3,0,1,0],[3.3,0,0,-1,2.9,0,0,-1]]),{radial:n.radial,at:[r,i,a],axis:`z`}),t.lathe(`glowCyan`,c([[0,-1.2,0,-1,2.35,-1.2,0,-1]]),{radial:n.radial,at:[r,i,a],axis:`z`}),t.lathe(`glowBlue`,c([[2.3,-2.5,0,-1,2.62,-2.5,0,-1]]),{radial:n.radial,at:[r,i,a],axis:`z`})}function Vb(e){let t=Uy[e.lod],n=e.seed??1,r=new au(n*7+3),i=new sn;i.name=`munificent`;let a={},o=[],s=[],c={},l=0,u=new Map,d=t.lod===0?{fwdA:`mun-fwd-a`,fwdB:`mun-fwd-b`,aft:`mun-aft`,keel:`mun-keel`,top:`mun-top`,arms:`mun-arms`,eng:`mun-engines`,tur:`mun-turrets`}:t.lod===1?{fwdA:`mun-hull`,fwdB:`mun-hull`,aft:`mun-hull`,keel:`mun-hull`,top:`mun-details`,arms:`mun-details`,eng:`mun-details`,tur:`mun-details`}:{fwdA:`mun-lod2`,fwdB:`mun-lod2`,aft:`mun-lod2`,keel:`mun-lod2`,top:`mun-lod2`,arms:`mun-lod2`,eng:`mun-lod2`,tur:`mun-lod2`},f=e=>{let r=d[e],i=u.get(r);return i||(i=Eb(t,n*31+u.size),u.set(r,i)),i},p=t.lod===2?[.5,2,5]:t.lod===1?[.5,1.8,4,7.5]:[.4,1.2,2.5,4.5,7.5],m=t.lod===2?[2,7]:t.lod===1?[1.5,5,11]:[.8,2.5,5.5,10,16],h=$y(Jy,Gy,qy,t.step,[...m.map(e=>qy-e),...p.map(e=>Gy+e)]),g=$y(Qy,Yy,Zy,t.step,[...m.map(e=>Yy+e),...p.map(e=>Zy-e)]),_=[0,...m.slice(1)];for(let e of[1,-1]){let r=n*13+(e<0?97:0);for(let[n,i]of[[`fwdA`,{zMax:40}],[`fwdB`,{zMin:40}]]){let a=f(n);a.push(),e<0&&a.mirrorX(),Db(a,t,h,t.fN,ab,sb,cb,r,{tip:qy,dir:1,d:_},i),a.pop()}let i=f(`aft`);i.push(),e<0&&i.mirrorX(),Db(i,t,g,t.aN,ob,lb,ub,r+5,{tip:Yy,dir:-1,d:_}),i.pop()}t.lod<2&&(Ob(f(`fwdA`),h.filter(e=>e.z>-1&&e.z<124),12),Ob(f(`aft`),g.filter(e=>e.z>-130&&e.z<-53),10));{let e=f(`keel`),r=My(t.kN,[db[0],db[1],Math.PI*2-db[1],Math.PI*2-db[0]]);jy(e,nb(eb,t.step*1.2),{N:t.kN,ths:r,tileLen:xb(t,40),tileWid:t.wid,spec:wb(t,n),core:`black`,capStart:`darkBrown`,capEnd:`darkBrown`,flat:!0}),jy(e,nb(tb,t.step),{N:t.mN,tileLen:xb(t,41),tileWid:t.wid,spec:Tb(t,n),core:`black`,capStart:`darkBrown`,capEnd:`darkBrown`,flat:t.flat});for(let t of[1,-1]){e.push(),t<0&&e.mirrorX();for(let t of[-46,-37,-28,-19])Lb(e,t);e.pop()}let i=t.lod<2?10:6;for(let t of[-1,1])e.box(`darkTan`,t*8.6,-5.2,76,3.6,3.4,14),e.box(`dbg`,t*8.6,-3.3,75,2.6,.6,10),Ly(e,`gunmetal`,[t*8.6,-5.2,83],[t*8.6,-5.2,101],.6,{radial:i}),Ly(e,`dbg`,[t*8.6,-5.2,99],[t*8.6,-5.2,102],.8,{radial:i});e.box(`dbg`,0,.2,112,7,4.4,16),e.box(`darkTan`,0,2.6,110,6,.8,12),Py(e,`darkTan`,[[104,-2],[120,-2],[120,1],[104,2.4]],7.4);for(let t of[-1,1])Ly(e,`gunmetal`,[t*1.7,.4,118],[t*1.7,.4,142],.75,{radial:i+2}),Ly(e,`dbg`,[t*1.7,.4,139],[t*1.7,.4,143],1,{radial:i+2}),Ly(e,`dbg`,[t*1.7,.4,122],[t*1.7,.4,125],1,{radial:i+2})}let v=0;{let e=f(`top`);jb(e,t,r,-6,89,5.2,kb,6),jb(e,t,r,107,120,3.4,kb,5),v=Pb(e,t,r,98,kb(98)-3),jb(e,t,r,-136,-80,3.6,Ab,5),jb(e,t,r,-62,Zy,3.6,Ab,5),e.box(`darkTan`,0,11.6,-28,12,2,48),jb(e,t,r,-50,-6,4.4,()=>15.5,12.4),Fb(e,t,r,-71)}{let e=f(`arms`);for(let n of[1,-1])e.push(),n<0&&e.mirrorX(),Ib(e,t,r,-30,8),e.pop()}let y=[[-9.6,-2.4],[-3.2,-2.4],[3.2,-2.4],[9.6,-2.4],[-6.4,3.4],[0,3.4],[6.4,3.4]],b=Eb(t,n*31+99);{let e=f(`eng`);e.box(`dbg`,0,.5,-116,24,12,24,{hide:{pz:!0}}),e.box(`darkTan`,0,6.9,-116,20,.8,22);for(let[n,r]of y)Bb(e,b,t,n,r,-128,2.8)}{let e=f(`tur`),n=1.35,a=[[h,cb,14,.55,0],[h,cb,58,.55,0],[h,cb,100,.62,0],[h,cb,6,1.6,.3],[h,cb,46,1.6,.3],[h,cb,86,1.6,.2],[g,ub,-118,.7,0],[g,ub,-88,.7,0]],s=0;for(let c of[1,-1])for(let[l,u,d,f,p]of a){let{p:a,n:m}=zb(l,d,f,c,mb(f,u)),h=p*c+(r.next()-.5)*.3;o.push(...Rb(e,t,i,`turret${s++}`,a,m,h,n))}for(let r of[-48,-8])o.push(...Rb(e,t,i,`turret${s++}`,new U(0,12.6,r),new U(0,1,0),0,n))}for(let[e,t]of u){let n=t.build(e);i.add(n.group),l+=n.triangles,c[e]=n.triangles}let x=b.build(`mun-engine-glow`,{castShadow:!1});i.add(x.group),l+=x.triangles,c[`mun-engine-glow`]=x.triangles;for(let e of x.group.children){let t=e;t.material=t.material.clone(),s.push(t)}let S=Eb(t,1),C=(e,t,n)=>{a[e]=Ry(S,e,i,[t.x,t.y,t.z],[n.x,n.y,n.z])};{let e=zb(h,40,1.2,1,mb(1.2,cb)+.3);C(`hit0`,e.p,e.n);let t=zb(h,76,.75,-1,mb(.75,cb)+.3);C(`hit1`,t.p,t.n),C(`hit2`,new U(0,v-4.5,112.8),new U(0,0,1)),C(`hit3`,new U(12.6,6,-10),new U(1,0,0));let n=zb(g,-100,1,-1,mb(1,ub)+.3);C(`hit4`,n.p,n.n),C(`hit5`,new U(0,-18.6,-20),new U(0,-1,0))}return a.bridge=Ry(S,`bridge`,i,[0,v,98],[0,0,1]),a.bow=Ry(S,`bow`,i,[0,3,qy],[0,0,1]),a.stern=Ry(S,`stern`,i,[0,.5,-131],[0,0,-1]),a.cannon=Ry(S,`cannon`,i,[0,.4,143.2],[0,0,1]),a.comm=Ry(S,`comm`,i,[0,39,-71],[0,1,0],[0,0,1]),i.userData.triangles=l,i.userData.parts=c,{group:i,length:288*Hy,turrets:o,engineGlows:s,anchors:a}}function Hb(e,t,n={}){let r={time:{value:0},level:{value:1},strength:{value:n.strength??1},aspect:{value:e/t},scan:{value:n.scan??60},color:{value:new K(n.color??3112447)}},i=new na({uniforms:r,transparent:!0,depthWrite:!1,blending:2,side:2,toneMapped:!1,fog:!1,vertexShader:`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
      uniform float time, level, strength, aspect, scan;
      uniform vec3 color;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0;
        return mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
      }
      void main() {
        if (level <= 0.002) discard;
        vec2 uv = vUv;
        float ex = min(uv.x, 1.0 - uv.x) * aspect;
        float ey = min(uv.y, 1.0 - uv.y);
        float e = min(ex, ey);
        float rim = exp(-e * 40.0) * 1.6 + exp(-e * 7.0) * 0.28;
        float lines = 0.5 + 0.5 * sin(uv.y * scan * 6.2831 - time * 9.0);
        lines = pow(lines, 3.0);
        float sweep = fract(uv.y * 1.5 - time * 0.45);
        float band = smoothstep(0.0, 0.05, sweep) * (1.0 - smoothstep(0.05, 0.35, sweep));
        float sh = noise(vec2(uv.x * 7.0 * aspect + time * 0.7, uv.y * 7.0 - time * 1.9));
        float sh2 = noise(vec2(uv.x * 23.0 * aspect - time * 2.1, uv.y * 19.0 + time * 1.3));
        float body = 0.05 + 0.07 * lines + 0.08 * sh + 0.04 * sh2 + 0.18 * band;
        float f = 1.0;
        if (level < 0.998) {
          float fr = floor(time * 30.0);
          f = hash(fr + 11.0) < (0.25 + 0.75 * level) ? (0.55 + 0.45 * hash(fr + 3.0)) : 0.04;
          body += 0.12 * step(0.6, hash(floor(uv.y * 40.0) + fr));
        }
        float a = (body + rim) * level * f * strength;
        gl_FragColor = vec4(color * a * vec3(0.85, 1.0, 1.25), 1.0);
      }`}),a=new Nr(new Ki(e,t),i);return a.name=n.name??`ray-shield`,a.renderOrder=3,a.castShadow=!1,a.receiveShadow=!1,{mesh:a,set(e){r.level.value=Math.max(0,Math.min(1,e)),a.visible=r.level.value>.002},update(e){r.time.value=e}}}var Ub=8,Wb=(e,t,n)=>Array.from({length:Math.floor((t-e)/n)+1},(t,r)=>e+r*n),Gb=[{z:-186,a:14,b:12.5,bb:11.5},{z:-178,a:16.6,b:14.6,bb:13},{z:-165,a:18.3,b:15.7,bb:14},{z:-140,a:19,b:16.1,bb:14.5},{z:-100,a:19.4,b:16.2,bb:14.5},{z:-40,a:19.4,b:16,bb:14},{z:0,a:19,b:15.6,bb:13.2},{z:60,a:18.4,b:15.2,bb:12.6},{z:105,a:17.4,b:14.6,bb:12},{z:130,a:16,b:13.2,bb:11.2},{z:146,a:14.2,b:10.8,bb:9.8,y0:-.2},{z:158,a:12.4,b:8,bb:8,y0:-.5},{z:168,a:10.4,b:5.3,bb:6.2,y0:-.9},{z:176,a:8,b:3.3,bb:4.4,y0:-1.2},{z:182,a:5.4,b:2,bb:2.9,y0:-1.4},{z:186.5,a:2.2,b:.8,bb:1.3,y0:-1.5}].map(e=>({n:2.7,nb:2.4,...e})),Kb=[[4,8],[10,14],[66,70]],qb=[[72,74]],Jb=[[84,86],[128,131]],Yb=vy(Gb,[...Wb(-174,138,12),152,163,172,...[...Kb,...qb,...Jb].flat()]),Xb=(e,t)=>t.some(([t,n])=>e>t&&e<n),Zb=-75,Qb=.6,$b=12.5,ex=4.5,tx=-108,nx=-42,rx=-2.5,ix=3.7,ax=3,ox=29.200000000000003,sx=19.200000000000003,cx={a:13,b:19.5,bb:19,y0:0,n:2.3,nb:2.3},lx=[[-35,-30],[-45,-40],[-55,-50],[-68,-62],[-124,-120],[-131,-127]],ux=e=>yy(-150,-8,{...cx,x0:19*e},{m:3,cuts:[-111,tx,nx,-39,Zb-$b/2,-68.75,...Wb(-146,-12,6),...lx.flat()]}),dx=ux(1),fx=ux(-1),px=(e,t,n,r)=>Math.abs(e)>22&&t>-5.5+r&&t<6.7-r&&n>-111+r&&n<-39-r,mx=e=>e.z>-152&&e.z<-15&&Math.abs(e.x)<12.6&&e.y<20&&e.y>0,hx=(e,t)=>e.z>-150&&e.z<-8&&Ny(_y(dx,e.z),Math.abs(e.x),e.y,t),gx=(e,t)=>Ny(_y(Yb,e.z),e.x,e.y,t),_x=yy(34,138,{a:11.5,b:8,bb:10.5,y0:-17.9,n:2.3,nb:2.2},{m:2.4,cuts:Wb(40,132,8)}),vx=_y(Yb,0),yx=(e,t)=>[xy(vx,t,1),xy(vx,e,1)],bx=yx(-6.7,-4.8),xx=yx(8.3,9.3),Sx=[bx,xx],Cx=(e,t)=>{let n=(e%(Math.PI*2)+Math.PI*2)%(Math.PI*2),r=n>Math.PI?Math.PI*2-n:n;return r>t[0]&&r<t[1]},wx=(e,t=0)=>cu(Math.round(e.x*4)+t*131,Math.round(e.y*4),Math.round(e.z*4));function Tx(e,t,n=!1){let r=new Y({seed:t,studSegments:e.lod?6:n?8:6,uvScale:.11/Ub,tint:.05,chamfer:.06});return r.scale(Ub),r}function Ex(e,t,n,r,i){let a=i?1:1.6,o=Math.max(1,Math.floor(t.l/a));for(let a=0;a<o;a++){let s=-t.l/2+(a+.5)*(t.l/o);cu(Math.round(t.c.x*7),Math.round((t.c.z+s)*3),17)<r&&Iy(e,`windowWarm`,0,n,s,Math.min(i?.7:.35,t.w*.5),i?.5:.7)}}function Dx(e){return t=>e.lens[Math.floor(wx(t,5)*e.lens.length)]}var Ox=(e,t,n,r)=>{let i=(t%(Math.PI*2)+Math.PI*2)%(Math.PI*2);return cu(Math.floor((e-n)/12),Math.floor(i*2.3),r)},kx=e=>e.x>5&&e.z>-152&&e.z<2&&e.y>-19;function Ax(e){return t=>{let{c:n,n:r}=t;if(hx(n,.5)||mx(n))return null;if(Cx(t.th,bx))return{key:`black`,t:.14,fill:(e,t)=>Ex(e,t,.15,n.z>128?.25:.62,!0)};if(Cx(t.th,xx))return{key:`dbg`,t:.18,fill:(e,t)=>Ex(e,t,.19,.28,!1)};let i=wx(n),a=wx(n,3),o=Ox(n.z,t.th,-174,1),s=r.y,c=n.z,l=o<(c>126?.93:c>100?.6:c<-150?.45:s<-.3?.75:.2)?`dbg`:`lbg`;i<.04&&(l=l===`dbg`?`lbg`:`dbg`),c>150&&a>.9&&(l=`black`),c<118&&c>-150&&s>-.3&&o>.965&&(l=`darkTan`),s>.2&&Xb(c,Kb)&&(l=`sandBlue`),s>.3&&Xb(c,qb)&&(l=`white`),s>.35&&c>128&&c<131&&(l=`yellow`),s>.05&&s<.75&&c>84&&c<86&&(l=`yellow`);let u=yu;a<.06?u=yu*2:a<.075&&s>0&&(u=yu*3);let d={key:l,t:u},f=kx(n);return e.studs&&s>.82&&a>.1&&a<(f?.3:.17)&&(d.studs=!0),e.greeble&&f&&i>.52&&i<.56&&t.l>1.8&&s>-.2&&(d.fill=(e,t)=>{e.push(),e.translate(0,u,0),Vy(e,new au(Math.floor(i*1e6)),t.w,t.l,[`dbg`,`gunmetal`,`lbg`],{density:.5}),e.pop()}),d}}function jx(e){return t=>{let{c:n,n:r}=t;if(gx(n,.5)||mx(n)||px(n.x,n.y,n.z,1))return null;let i=wx(n,7),a=wx(n,9),o=Ox(n.z,t.th,-146,2),s=r.y,c=o<(s<-.45?.72:.16)?`dbg`:`lbg`;i<.04&&(c=c===`dbg`?`lbg`:`dbg`);let l=Xb(n.z,lx);l&&(n.y>7.2||n.y<-6&&n.y>-16)&&(c=`sandBlue`),!l&&s>-.3&&o>.97&&(c=`darkTan`),n.z<-140&&i>.5&&(c=`dbg`);let u=yu;a<.06&&(u=yu*2);let d={key:c,t:u};return e.studs&&s>.8&&a>.1&&a<(n.x>0?.3:.15)&&(d.studs=!0),e.greeble&&i>.4&&i<.43&&s>-.3&&(d.fill=(e,t)=>{e.push(),e.translate(0,u,0),Vy(e,new au(Math.floor(i*1e6)),t.w,t.l,[`dbg`,`gunmetal`,`lbg`],{density:.45}),e.pop()}),d}}function Mx(){return e=>{let{c:t,n}=e;if(gx(t,.4))return null;let r=wx(t,11),i=n.y<-.6?r<.35?`dbg`:`lbg`:r<.75?`dbg`:`lbg`;return Math.abs(n.y)<.35&&r>.6&&r<.66?{key:`black`,t:.2,fill:(e,t)=>Ex(e,t,.21,.5,!0)}:{key:i,t:wx(t,12)<.08?yu*2:yu}}}function Nx(e,t,n,r,i,a,o,s,c={}){let l=c.w??2,u=c.t??.4,d=c.lens??[2,3,4,4,6],f=Math.max(1,Math.round((r-n)/l)),p=(r-n)/f;for(let r=0;r<f;r++){let l=n+(r+.5)*p,f=i,m=!0;for(;f<a-.3;){let n=t.pick(d);m&&r%2&&(n=Math.max(1,Math.round(n/2))),m=!1,n=Math.min(n,a-f),a-(f+n)<.6&&(n=a-f);let i=f,h=i+n/2,g=t.pick(s),_=t.chance(.08)?u*2:u;if(e.box(g,l,o+_/2,h,p-.07,_,n-.07,{hide:{ny:!0}}),c.studs&&t.chance(c.studs)){let t=Math.max(1,Math.floor(p+.05)),r=Math.max(1,Math.floor(n+.05));for(let n=0;n<t;n++)for(let i=0;i<r;i++)e.stud(g,l+n-(t-1)/2,o+_,h+i-(r-1)/2)}else c.greeble&&t.chance(c.greeble)&&(e.push(),e.translate(l,o+_,h),Vy(e,t,p,n,[`dbg`,`gunmetal`,`lbg`,`dbg`],{density:.55}),e.pop());f=i+n}}}function Px(e,t,n,r,i,a,o,s,c=.7,l=.9){e.box(`black`,n-r*.05,o,(i+a)/2,.2,s,a-i,{hide:{nx:r>0,px:r<0}});let u=Math.floor((a-i)/l);for(let d=0;d<u;d++){if(!t.chance(c))continue;let f=i+(d+.5)*((a-i)/u);e.push(),e.translate(n+r*.06,o,f),e.rotateZ(-r*Math.PI/2),Iy(e,`windowWarm`,0,0,0,s*.62,l*.55),e.pop()}}function Fx(e,t,n,r,i=1){let a=[];return Cy(e,r,()=>{e.scale(i),e.cyl(`dbg`,0,.35,0,1.7,.7,{radial:14}),e.cyl(`lbg`,0,.85,0,1.35,.3,{radial:14}),e.box(`lbg`,0,1.55,-.2,2.4,1.1,2.6),Py(e,`slopeLbg`,[[1.1,1],[1.8,1],[1.1,2.1]],2.4),e.box(`dbg`,0,2.2,-.6,1.6,.35,1.4),e.box(`gunmetal`,0,1.35,1.3,1.8,.6,.5);for(let r of[-.5,.5])Ly(e,`gunmetal`,[r,1.5,1.2],[r,1.5,4.6],.17,{radial:8}),Ly(e,`dbg`,[r,1.5,3.9],[r,1.5,4.7],.24,{radial:8}),a.push(Ry(e,`${n}-${r<0?`l`:`r`}`,t,[r,1.5,4.75]))}),a}function Ix(e,t,n,r,i,a){e.cyl(`dbg`,n,r+.3,i,.55,.6,{radial:8}),Ly(e,`lbg`,[n,r,i],[n,r+a,i],.16,{radial:6}),Ly(e,`dbg`,[n,r+a*.5,i],[n,r+a*.8,i],.24,{radial:6}),t.chance(.5)&&Ly(e,`lbg`,[n-1,r+a*.7,i],[n+1,r+a*.7,i],.1,{radial:5}),t.chance(.25)&&e.cyl(`lbg`,n,r+a*.62,i+.3,.9,.12,{axis:`z`,radial:10}),e.cyl(`glowRed`,n,r+a+.1,i,.2,.2,{radial:6})}function Lx(e){let t=e.lod,n=t===0?{lod:t,hullN:60,blN:66,wid:2.1,lens:[2,3,3,4,4,6],studs:!0,greeble:!0}:{lod:t,hullN:32,blN:34,wid:4.2,lens:[8,12,12],studs:!1,greeble:!1},r=t?!0:e=>!kx(e),i=new sn;i.name=`invisible-hand`;let a={},o=[],s=[],c=0,l={},u=(e,t,n={})=>{let r=e.build(t,n);return i.add(r.group),c+=r.triangles,l[t]=r.triangles,r};i.userData.parts=l;let d=My(n.hullN,Sx.flatMap(([e,t])=>[e,t,Math.PI*2-e,Math.PI*2-t])),f=[-200,-118,-60,-8,60,130,200];for(let e=0;e<f.length-1;e++){let i=Tx(n,10+e,e===1||e===2),a={zMin:f[e],zMax:f[e+1]};if(jy(i,Yb,{...a,ths:d,tileLen:Dx(n),tileWid:n.wid,spec:Ax(n),core:`dbg`,coreSkip:e=>hx(e,.8)||mx(e),capStart:`dbg`,flat:r}),f[e]<-8)for(let e of[dx,fx])jy(i,e,{...a,N:n.blN,tileLen:Dx(n),tileWid:n.wid*.9,spec:jx(n),core:`dbg`,coreSkip:e=>gx(e,.8)||mx(e)||px(e.x,e.y,e.z,1),flat:r});f[e+1]>34&&f[e]<138&&jy(i,_x,{...a,N:t?20:44,tileLen:Dx(n),tileWid:n.wid*1.1,spec:Mx(),core:`dbg`,coreSkip:e=>gx(e,.6),flat:!0}),u(i,`ih-hull-${e}`)}let p=Tx(n,40),m=new au(4040);p.shape(`dbg`,[[-7.5,148],[7.5,148],[4.5,186],[0,190.5],[-4.5,186]],-3.4,.8),p.shape(`black`,[[-5,160],[5,160],[3.2,184],[0,187.5],[-3.2,184]],-3.55,.2,{hideBottom:!1});for(let e of[-1,1])p.shape(`gunmetal`,[[e*3.2,176],[e*3.8,176],[e*2.2,186],[e*1.9,186]],-2.6,.6),p.cyl(`glowRed`,e*3,-2.9,183,.25,.3,{radial:6});p.cyl(`glowRed`,0,-2.8,190.2,.3,.4,{radial:8,axis:`z`});for(let e=-130;e<30;e+=t?30:14){let n=_y(Yb,e),r=(n.y0??0)-(n.bb??n.b);p.box(`dbg`,0,r+.1,e,3,1.6,t?22:10,{hide:{py:!0}}),t||(p.push(),p.translate(0,r-.7,e),p.rotateX(Math.PI),Vy(p,m,2.6,9,[`dbg`,`gunmetal`],{density:.6}),p.pop())}let h=Tx(n,50);Py(h,`dbg`,[[-153,13],[-14,13],[-14,17.2],[-21,20.2],[-153,20.2]],26),Py(h,`dbg`,[[-147,20.2],[-33,20.2],[-37,22.6],[-147,22.6]],21),Py(h,`dbg`,[[-151,22.6],[-97,22.6],[-100,25.4],[-151,25.4]],16);let g=new au(505),_=t?{lens:[10,14],w:4.2}:{lens:[2,3,4,4,6]};Nx(h,g,-12.8,12.8,-152.5,-21.5,20.2,[`lbg`,`lbg`,`dbg`,`lbg`,`darkTan`],{..._,studs:t?0:.035,greeble:t?0:.05}),Nx(h,g,-10.3,10.3,-146.5,-37.5,22.6,[`lbg`,`dbg`,`lbg`],{..._,studs:t?0:.03,greeble:t?0:.06});for(let[e,n]of[[-7.8,-4.9],[4.9,7.8]])Nx(h,g,e,n,-150.5,-100.5,25.4,[`lbg`,`dbg`,`gunmetal`],{..._,w:1.45,greeble:t?0:.15});h.push(),h.translate(0,17.2,-14),h.rotateX(Math.atan2(3,7));for(let e=-12;e<12;e+=2)h.box(e>-5&&e<3?`sandBlue`:`lbg`,e+1,.2,-3.8,1.92,.4,7.4,{hide:{ny:!0}});h.pop();for(let e of[-1,1]){Px(h,g,e*13.02,e,-150,-24,18.9,.9,.62),Px(h,g,e*10.52,e,-145,-40,21.5,.9,.75),Px(h,g,e*8.02,e,-149,-102,24.1,.8,.7,.7);for(let t=-150;t<-24;t+=4)h.box(`gunmetal`,e*12.9,20.5,t+2,.3,.6,3.6,{hide:{ny:!0}});for(let n=-144;n<-40;n+=t?40:18)Ix(h,g,e*11.6,20.6,n,g.range(5,11))}h.lathe(`lbg`,[[0,2.6,0,1,1.4,2.3,.5,.85],[1.4,2.3,.5,.85,2.5,1.2,.85,.5],[2.5,1.2,.85,.5,2.9,0,1,0]],{radial:16,at:[0,22.6,-60]}),h.cyl(`glowCyan`,0,25.3,-60,.35,.3,{radial:8}),h.cyl(`dbg`,0,23.1,-60,3.4,.8,{radial:16}),h.cyl(`gunmetal`,-6,24.4,-85,.35,3.6,{radial:8}),h.lathe(`lbg`,[[0,.5,0,1,2.4,0,.3,.95],[2.4,0,.3,.95,2.6,.2,1,0]],{radial:14,at:[-6,26.2,-85]});let v=Tx(n,60),y=t?5:10,b=25.4,x=e=>-108+(e-25)/44*-30.5,S=e=>-150+(e-25)/44*2,C=e=>4-(e-b)/43.6*1.4;for(let e=0;e<y;e++){let n=b+43.6*e/y,r=b+43.6*(e+1)/y,i=C((n+r)/2);Py(v,`dbg`,[[S(n),n],[x(n),n],[x(r),r],[S(r),r]],2*i-.8);let a=.18;for(let o of[-1,1]){let s=(e,t,s)=>{let c=(e,t)=>[S(t)+(x(t)-S(t))*e,t];Py(v,s,[c(e,n+a),c(t,n+a),c(t,r-a),c(e,r-a)],.5,o*(i-.25))};if(s(.62,.99,e===y-2?`sandBlue`:(e*7+(o>0?3:0))%5==1?`dbg`:`lbg`),s(.02,.3,e%4==2?`dbg`:`lbg`),!t){let e=(e,t)=>[o*(i-.5),t,S(t)+(x(t)-S(t))*e];Ly(v,`gunmetal`,e(.3,n+.3),e(.62,r-.3),.22,{radial:6}),Ly(v,`gunmetal`,e(.3,r-.3),e(.62,n+.3),.22,{radial:6})}}if(e%2&&Py(v,`dbg`,[[S(r)-.3,r-.3],[x(r)+.3,r-.3],[x(r)+.3,r+.3],[S(r)-.3,r+.3]],2*i+.2),!t)for(let e=0;e<3;e++){let t=n+(r-n)*(.25+e*.25),a=x(t);v.push(),v.translate(0,t,a),v.rotateX(Math.atan2(r-n,x(n)-x(r))),Iy(v,e===1?`windowWarm`:`black`,0,.06,0,2*i-1.4,.35),v.pop()}}Py(v,`lbg`,[[-152,25.4],[-104,25.4],[-110,30],[-151,30]],9.6),jy(v,yy(-166,-126,{a:7,b:3.4,bb:5.2,y0:73.2,n:2.2,nb:2.6},{m:2.2}),{ths:My(t?24:40,[Math.PI/2-.25,Math.PI/2+.3,Math.PI*1.5-.3,Math.PI*1.5+.25]),tileLen:3,tileWid:2,core:`dbg`,flat:!0,spec:e=>{let t=e.th>Math.PI?Math.PI*2-e.th:e.th;return t>Math.PI/2-.25&&t<Math.PI/2+.3?{key:`black`,t:.15,fill:(e,t)=>Ex(e,t,.16,.8,!0)}:wx(e.c,21)<.25?`dbg`:`lbg`}}),v.cyl(`lbg`,0,76.9,-146,4.2,.8,{radial:16}),v.cyl(`dbg`,0,77.7,-148,2.6,.8,{radial:14});for(let[e,t,n]of[[0,-150,7],[2,-140,4],[-2.5,-156,3.5]])Ix(v,m,e,78.1,t,n);v.cyl(`glowRed`,0,72.9,-126.2,.3,.4,{axis:`z`,radial:8});let w=Tx(n,70);Py(w,`dbg`,[[96,12.5],[143,11],[141,15.2],[135,17.4],[100,17.4],[97,15.5]],16),Py(w,`lbg`,[[104,17.4],[133,17.4],[131,19.6],[106,19.6]],11);let T=new au(707);Nx(w,T,-7.8,7.8,100.5,134.5,17.4,[`lbg`,`dbg`,`lbg`],{greeble:t?0:.2}),Nx(w,T,-5.3,5.3,106.5,130.5,19.6,[`lbg`,`dbg`],{studs:t?0:.1});for(let e of[-1,1])Px(w,T,e*8.02,e,99,139,14.9,1.1,.8,.8),Px(w,T,e*5.52,e,106.5,130.5,18.5,.8,.9,.7),w.box(`yellow`,e*7.3,17.6,137.5,1.4,.4,3,{hide:{ny:!0}});w.push(),w.translate(0,13.85,141.78),w.rotateX(Math.atan2(4.2,2)),w.box(`trBlack`,0,0,0,13,.2,2.4);for(let e=0;e<9;e++)Iy(w,`windowWarm`,-5.6+e*1.4,-.12,0,.9,1.4);w.pop();for(let[e,t,n]of[[-3,110,6],[3.5,118,4],[0,126,8]])Ix(w,m,e,19.9,t,n);for(let[e,n,r]of[[-4,4,6],[6,-4,9],[17,7,4],[30,-7,7],[44,3,10],[58,-5,5],[70,6,8],[84,-3,4]])t&&r<7||Ix(p,m,n,Rx(_y(Yb,e),n)+.3,e,r);Py(p,`dbg`,[[-113,-12.5],[-82,-12.5],[-80,-37.5],[-100,-37.5]],2.6);for(let e of[-1,1])for(let t=0;t<4;t++){let n=-14.5-t*5.6,r=n-5.2,i=(e,t)=>{let n=-82+(e+12.5)/-25*2,r=-113+(e+12.5)/-25*13;return[r+(n-r)*t,e]};Py(p,t===1?`sandBlue`:`lbg`,[i(n,.05),i(n,.95),i(r,.95),i(r,.05)],.4,e*1.45)}jy(p,yy(-104,-76,{a:2.8,b:3,bb:3,y0:-40.4,n:2.2},{m:2.3}),{N:t?12:20,tileLen:3,tileWid:1.6,spec:e=>wx(e.c,31)<.3?`dbg`:`lbg`,core:`dbg`,flat:t===1}),p.cyl(`glowRed`,0,-40.4,-75.9,.3,.4,{axis:`z`,radial:8});let E=Tx(n,80);jy(E,[{z:-189,a:23,b:10.6,bb:10.2,y0:-1,n:4,nb:4},{z:-176,a:22,b:11.2,bb:10.8,y0:-1,n:4,nb:4},{z:-166,a:17,b:10.4,bb:9.6,y0:-1,n:3.4,nb:3.4}],{N:t?28:48,tileLen:3,tileWid:2.4,spec:e=>gx(e.c,.5)?null:wx(e.c,41)<.55?`dbg`:`lbg`,core:`dbg`,capStart:`dbg`,flat:!0}),Py(E,`dbg`,[[-195,8.6],[-165,8.6],[-165,12.2],[-191,12.2],[-195,10.4]],40),Nx(E,new au(808),-19.8,19.8,-191,-186.2,12.2,[`lbg`,`dbg`,`lbg`],{w:2.2,lens:[2,3,4.8],greeble:t?0:.15});let D=[[-17.2,-1.4,4.4],[-6.4,-.6,4.9],[6.4,-.6,4.9],[17.2,-1.4,4.4]],O=Tx(n,81);for(let[e,n,r]of D){let i=t=>new G().makeTranslation(e,n,t).multiply(new G().makeRotationX(Math.PI/2)),a=t?16:28;E.add(`dbg`,eu(r+.9,r,3.2,.12,a),i(-190.6)),E.add(`gunmetal`,eu(r+1.25,r+.85,.6,.08,a),i(-192)),E.add(`gunmetal`,eu(r,r-.5,2.4,.1,a),i(-190.3)),O.cyl(`glowCyan`,e,n,-189.25,r-.45,.3,{axis:`z`,radial:a}),O.add(`glowBlue`,eu(r-.05,r-.5,.25,.05,a),i(-191.45));let o=r+1.35;for(let[t,r,i,a]of[[0,o,2*o+1,.8],[0,-o,2*o+1,.8],[o,0,.8,2*o-.6],[-o,0,.8,2*o-.6]])E.box(`lbg`,e+t,n+r,-189.6,i,a,1.6);if(!t)for(let t=0;t<6;t++)E.box(`gunmetal`,e+(t-2.5)*1.3,n+o+.6,-190.2,.7,.5,.7)}if(!t)for(let[e,t]of[[-9.4,2.4],[7.3,2.1]])E.push(),E.translate(0,e,-189.05),E.rotateX(-Math.PI/2),Vy(E,new au(818+e),38,t,[`dbg`,`gunmetal`,`lbg`],{density:.5}),E.pop();u(E,`ih-engines`);let k=u(O,`ih-engine-glow`);for(let e of k.group.children){let t=e;t.material=t.material.clone(),s.push(t)}let A=Tx(n,90),ee=[[120,.62,1],[88,.72,1.1],[48,.7,1.1],[10,.66,1.1],[-162,.55,1.2]],j=0;for(let[e,t,n]of ee)for(let r of[1,-1]){let{p:a,n:s}=by(Yb,e,t*r);a.addScaledVector(s,.3),o.push(...Fx(A,i,`turret${j++}`,Sy(a,s),n))}for(let e of[1,-1])o.push(...Fx(A,i,`turret${j++}`,Sy(new U(e*9.5,20.6,-28),new U(0,1,0)),1)),o.push(...Fx(A,i,`turret${j++}`,Sy(new U(e*8.5,23,-128),new U(0,1,0)),.9));u(A,`ih-turrets`);let M=Tx(n,100),N=[[tx,-96.125],[-94.625,-82.75],[Zb-$b/2,-68.75],[-67.25,-55.375],[-53.875,nx]],te=[-95.375,-82,-68,-54.625],P=new au(1001);for(let e of[1,-1]){M.push(),e<0&&M.mirrorX();let n=61.400000000000006/2;M.box(`dbg`,n,5.2,-75,3,ax,72),M.box(`dbg`,n,rx-ax/2,-75,3,ax,72),M.box(`dbg`,n,Qb,tx-ax/2,3,6.2,ax),M.box(`dbg`,n,Qb,-40.5,3,6.2,ax);for(let[e,n]of[[ix,6.7],[-5.5,rx]]){let r=t?1:2;for(let i=0;i<r;i++){let a=e+(n-e)*i/r,o=e+(n-e)*(i+1)/r,s=-111;for(;s<-39.2;){let e=Math.min(-39-s,P.pick(t?[8,12]:[2,3,4,4,6])),n=P.chance(.14)?`dbg`:P.chance(.05)?`sandBlue`:`lbg`;M.box(n,32.400000000000006,(a+o)/2,s+e/2,.4,o-a-.07,e-.07,{hide:{nx:!0}}),s+=e}}}for(let e of[tx-ax/2,-40.5])M.box(`lbg`,32.400000000000006,Qb,e,.4,6.13,2.93,{hide:{nx:!0}});M.box(`lbg`,32.800000000000004,4.15,-75,.8,.9,67.8),M.box(`lbg`,32.800000000000004,-2.95,-75,.8,.9,67.8),M.box(`lbg`,32.800000000000004,Qb,-108.45,.8,6.2,.9),M.box(`lbg`,32.800000000000004,Qb,-41.55,.8,6.2,.9);for(let e=-106;e<-43;e+=4)M.box(`glowYellow`,33.220000000000006,-2.95,e,.06,.25,.5);for(let e=-106;e<-43;e+=4)M.push(),M.translate(31.300000000000004,3.68,e),M.scale(1,-1,1),Iy(M,`glowWhite`,0,0,0,.5,2.2),M.pop();for(let e=-107.5;e<nx;e+=1)M.box(Math.floor(e-tx)%2?`yellow`:`black`,31.500000000000004,-2.45,e+.5,1.2,.1,.96,{hide:{ny:!0}});for(let e of te){if(M.box(`gunmetal`,30.300000000000004,Qb,e,2.2,6.2,1.5,{hide:{nx:!0}}),!t)for(let t=-1.9;t<3.4000000000000004;t+=1.1)M.box(`dbg`,31.500000000000004,t,e,.3,.5,1.2);M.box(`glowRed`,31.46,3.2,e,.12,.3,.3)}for(let[n,r]of N){let i=e>0&&n===Zb-$b/2,a=(n+r)/2,o=r-n;if(i){for(let e of[n+.3,r-.3])M.box(`gunmetal`,29.500000000000004,Qb,e,.6,ex,.6),M.box(`glowBlue`,29.820000000000004,Qb,e,.06,4.1,.22);M.box(`gunmetal`,29.450000000000003,2.85+.2,a,.5,.4,o),M.box(`gunmetal`,29.450000000000003,Qb-ex/2-.2,a,.5,.4,o);continue}M.box(`dbg`,28.900000000000002,Qb,a,.6,6.2,o,{hide:{nx:!0}});let s=t?2:5;for(let e=0;e<s;e++){let t=rx+6.2*(e+.5)/s;M.box(e%2?`gunmetal`:`lbg`,29.300000000000004,t,a,.3,6.2/s*.62,o-.8)}if(M.box(`black`,29.500000000000004,Qb,a,.1,5.8,.14),!t){for(let e=n+.8;e<r-.6;e+=1.2)M.box(Math.round((e-n)/1.2)%2?`yellow`:`black`,29.480000000000004,-2.15,e,.08,.5,1.1);for(let e=n+1.2;e<r-1;e+=2.4)zx(M,`windowWarm`,29.500000000000004,3.25,e,.3,1.1)}}M.pop()}let F=Tx(n,110),ne=Qb-ex/2,re=48.400000000000006/2;F.box(`lbg`,re,-2.05,Zb,10,.8,22,{hide:{ny:!0}}),F.box(`dbg`,re,5.050000000000001,Zb,10,.8,22,{hide:{py:!0}}),F.box(`dbg`,18.800000000000004,3.0000000000000004/2,Zb,.8,6.300000000000001,22);for(let e of[-86.4,-63.6])F.box(`dbg`,23.85,3.0000000000000004/2,e,9.3,6.300000000000001,.8);F.box(`dbg`,28.800000000000004,7.5/2,Zb,.8,1.8000000000000003,12.7);for(let[e,t]of[[-86,Zb-$b/2],[-68.75,-64]])F.box(`dbg`,28.150000000000002,3.0000000000000004/2,(e+t)/2,.8,6.300000000000001,t-e);if(t)zx(F,`glowWhite`,19.230000000000004,3.0000000000000004/2,Zb,5.300000000000001,20);else{Nx(F,new au(1111),19.300000000000004,28.300000000000004,-85.9,-64.1,ne,[`lbg`,`lbg`,`dbg`,`lbg`],{w:1.5,lens:[2,3,4]});for(let e of[-79.5,-70.5])F.box(`yellow`,23.800000000000004,-1.23,e,8.4,.06,.3);F.cyl(`yellow`,23.200000000000003,-1.22,Zb,2.2,.05,{radial:24,top:!0}),F.cyl(`lbg`,23.200000000000003,-1.2,Zb,1.8,.05,{radial:24});for(let e=0;e<4;e++){let t=20.6+e*2.4;F.box(`gunmetal`,t,4.300000000000001,Zb,.6,.7,22);for(let e=-84;e<-65;e+=4)F.push(),F.translate(t+1.1,4.6000000000000005,e),F.scale(1,-1,1),Iy(F,`glowWhite`,0,0,0,1.3,2.6),F.pop()}for(let e=-85;e<-64;e+=3)F.box(`lbg`,19.500000000000004,3.0000000000000004/2,e,.6,6.300000000000001,.8);F.box(`gunmetal`,19.300000000000004,-.25,Zb,.3,2.8,4),zx(F,`windowWarm`,19.220000000000002,2.7500000000000004,-81,1,3.2),zx(F,`windowWarm`,19.220000000000002,2.7500000000000004,-69,1,3.2),zx(F,`glowWhite`,19.230000000000004,3.7500000000000004,Zb,.5,18);for(let e of[-85.7,-64.3]){for(let t=20.200000000000003;t<28.700000000000003;t+=2)F.box(`lbg`,t,3.0000000000000004/2,e,.5,6.300000000000001,.6);Ly(F,`gunmetal`,[sx,3.45,e],[28.6,3.45,e],.2,{radial:6})}let e=new au(1212);for(let t=0;t<10;t++){let t=e.chance(.5)?e.range(-85,-81):e.range(-69,-65),n=e.range(20.200000000000003,27.200000000000003),r=e.range(.5,.9);F.box(e.pick([`darkTan`,`dbg`,`lbg`,`reddishBrown`]),n,-1.25+r/2,t,r,r,r*1.3)}}u(F,`ih-hangar-room`),u(M,`ih-hangar-slots`),a.hangar=Ry(p,`hangar`,i,[ox,Qb,Zb],[1,0,0],[0,1,0]),a.bridge=Ry(p,`bridge`,i,[0,78.5,-146],[0,0,1]),a.commandBridge=Ry(p,`commandBridge`,i,[0,19.8,136],[0,0,1]),a.shieldGen=Ry(p,`shieldGen`,i,[0,25.3,-60],[0,0,1]),a.bow=Ry(p,`bow`,i,[0,-1.5,190.5],[0,0,1]),a.stern=Ry(p,`stern`,i,[0,-1,-192],[0,0,-1]),[[dx,-30,.5],[dx,-52,.35],[dx,-96,.45],[dx,-122,.3],[Yb,2,.5],[Yb,28,.35],[Yb,60,.55],[Yb,92,.4]].forEach(([e,t,n],r)=>{let{p:o,n:s}=by(e,t,n);o.addScaledVector(s,.45),a[`crawl${r}`]=Ry(p,`crawl${r}`,i,[o.x,o.y,o.z],[0,0,1],[s.x,s.y,s.z])}),u(p,`ih-details`),u(h,`ih-deck`),u(v,`ih-spire`),u(w,`ih-bridge`);let ie=Hb($b*Ub,ex*Ub,{name:`ih-ray-shield`,scan:26});return ie.mesh.position.set(29.250000000000004*Ub,Qb*Ub,-600),ie.mesh.rotation.y=Math.PI/2,i.add(ie.mesh),i.userData.animate=e=>ie.update(e),i.userData.triangles=c,{group:i,length:381*Ub,turrets:o,engineGlows:s,anchors:a,setShield:e=>ie.set(e)}}function Rx(e,t){let n=e.n??2;return(e.y0??0)+e.b*Math.max(0,1-Math.min(1,Math.abs(t-(e.x0??0))/e.a)**+n)**(1/n)}function zx(e,t,n,r,i,a,o){e.push(),e.translate(n,r,i),e.rotateZ(-Math.PI/2),Iy(e,t,0,0,0,a,o),e.pop()}var Bx=90,Vx=60,Hx=42,Ux=100,Wx=36,Gx=7,Kx=20,qx=8;function Jx(e){return new Y({seed:e,studSegments:10,tint:.04})}function Yx(e,t,n,r,i,a,o,s){e.push(),e.translate(r,i,a),n===`px`?e.rotateZ(-Math.PI/2):n===`nx`?e.rotateZ(Math.PI/2):n===`pz`?e.rotateX(Math.PI/2):n===`nz`?e.rotateX(-Math.PI/2):n===`ny`&&e.scale(1,-1,1),n===`px`||n===`nx`?Iy(e,t,0,0,0,s,o):Iy(e,t,0,0,0,o,s),e.pop()}var Xx=[[7.4,0],[6.2,.9],[5.1,2.2],[4.2,3.9],[3.6,5.9],[3.2,8.1],[3,10.6]],Zx=[[3,30.6],[3.3,33.2],[3.9,35.6],[4.9,37.6],[6.3,39.4],[8.2,40.9],[10.4,Hx]];function Qx(e,t){e.box(`lbg`,t,Hx/2,1.4,2.4,Hx,2.8,{hide:{nz:!0}}),e.push(),e.translate(t,0,0),e.rotateY(-Math.PI/2);for(let t of[Xx,Zx])for(let n=0;n+1<t.length;n++){let[r,i]=t[n],[a,o]=t[n+1];e.prism(`lbg`,[[2.7,i],[r,i],[a,o],[2.7,o]],2.28)}e.pop(),e.box(`dbg`,t,20.8,2.95,.9,20.4,.3),e.box(`gunmetal`,t,12.2,3.05,1.7,2.4,.5),e.box(`darkTan`,t,29.2,2.95,2.5,.8,.4),e.cyl(`glowRed`,t,32.4,3.3,.3,.3,{axis:`z`,radial:8})}function $x(e,t,n,r,i,a){let o=r-n,s=(n+r)/2;if(a.lower??!0){e.box(`dbg`,s,1.5,.35,o,3,.7,{hide:{nz:!0}}),i%2==0&&o>4&&(e.push(),e.translate(s,1.5,.7),e.rotateX(Math.PI/2),zy(e,`gunmetal`,0,0,0,1.6,Math.min(5,o*.6)),e.pop());let n=(o-.3)/2,r=[[3.1,8.3,a.accent?`darkTan`:`lbg`],[8.4,13.6,`dbg`],[13.7,19.2,`lbg`]];for(let[t,i,a]of r)for(let r of[-1,1])e.box(a,s+r*(n/2+.075),(t+i)/2,.25,n-.02,i-t,.5,{hide:{nz:!0}});o>4&&(Yx(e,t.chance(.3)?`glowGreen`:`windowWarm`,`pz`,s-n/2,11.6,.52,1.4,.5),e.box(`gunmetal`,s-n/2,10.2,.6,1.8,1.2,.2),t.chance(.5)&&e.box(`gunmetal`,s+n/2,5.6,.6,1.8,1.3,.2),t.chance(.4)&&e.box(`lbg`,s+n/2,16.2,.6,2.4,.6,.2))}if(a.sill&&e.box(`lbg`,s,19.6,.5,o,.8,1),(a.windows??!0)&&o>4){e.box(`lbg`,s,27.4,.4,o,1,.8),e.box(`lbg`,s,20.8,.3,o,1,.6);for(let t of[-1,1])e.box(`lbg`,s+t*(o/2-.5),48.2/2,.3,1,5.599999999999998,.6);e.box(`trBlack`,s,48.2/2,.3,o-2,5.599999999999998,.16),Yx(e,`windowWarm`,`pz`,s,48.2/2,.1,o-2.2,5.399999999999998),e.box(`dbg`,s,48.2/2,.42,.3,5.599999999999998,.2),e.box(`dbg`,s-o/4,21.900000000000002,.16,o/3,1,.08)}else o>3&&e.box(`lbg`,s,24,.25,o-.2,6,.5);for(let t=30;t<41;t+=2.6)e.box(`lbg`,s,t,.25,o-.2,.8,.5);e.box(`dbg`,s,29.1,.35,o,1.6,.7)}function eS(e,t){let n=6.4,r=4.2,i=n/2,a=4.6;for(let n of[-1,1])e.box(`lbg`,t+n*3.9000000000000004,6,r/2,1.4,12,r);e.lathe(`lbg`,[[i,0,0,-1,a,0,0,-1],[a,0,1,0,a,r,1,0],[a,r,0,1,i,r,0,1],[i,r,-1,0,i,0,-1,0]],{radial:16,theta0:Math.PI/2,thetaLen:Math.PI,at:[t,12,0],axis:`z`}),e.box(`dbg`,t,6,.3,n,12,.6);for(let n=1;n<11.6;n+=1.6)e.box(n<2.5?`yellow`:`gunmetal`,t,n,.72,5.6000000000000005,.8,.24);e.box(`black`,t,6,.9,.16,11.6,.1),Yx(e,`glowWhite`,`pz`,t,13.7,.12,4,.7),e.cyl(`glowRed`,t,17.3,.5,.35,1,{axis:`z`,radial:8});for(let n of[-1,1])e.box(`yellow`,t+n*3.9000000000000004,1.2,4.23,1.2,1.6,.06)}function tS(e,t,n,r){let i=4.8,a=(t+n)/2;e.box(`dbg`,a,19.7,i/2,n-t,.6,i),e.box(`yellow`,a,19.7,4.859999999999999,n-t,.46,.12);for(let r=t+1.5;r<n-1;r+=3)e.box(`gunmetal`,r,21.6,4.5,.3,3.2,.3);for(let r of[23.1,21.7])Ly(e,`gunmetal`,[t,r,4.5],[n,r,4.5],.14,{radial:6});for(let t of r)e.push(),e.translate(t,0,0),e.rotateY(-Math.PI/2),e.prism(`dbg`,[[2.9,16.6],[i,19.4],[2.9,19.4]],.8),e.pop();for(let r=t+6;r<n-2;r+=12)Yx(e,`glowWhite`,`ny`,r,19.38,2.8,3,1.4);for(let r of[t+10,n-10]){for(let t of[-1,1])e.box(`gunmetal`,r+t*.9,23.2/2,5.1499999999999995,.25,23.2,.25);for(let t=1;t<Kx;t+=1.2)e.box(`gunmetal`,r,t,5.1499999999999995,1.8,.16,.16)}}function nS(e,t,n,r,i=0,a=0){for(let o=0;o+1<n.length;o++){let s=n[o]+(o===0?i:1.2),c=n[o+1]-(o+1===n.length-1?a:1.2),l=r((s+c)/2,o);l&&$x(e,t,s,c,o,l)}}function rS(e,t){e.box(`dbg`,0,Hx/2,-1,120,Hx,2,{hide:{nz:!0}});let n=[];for(let e=-54;e<=54;e+=12)n.push(e);for(let t of n)Qx(e,t);let r=[-24,24];nS(e,t,[-60,...n,Vx],(t,n)=>{let i=r.some(e=>Math.abs(e-t)<3);return i&&eS(e,t),{lower:!i,accent:n%4==1}}),tS(e,-60,Vx,n),Ly(e,`gunmetal`,[-60,18.5,1.2],[Vx,18.5,1.2],.45,{radial:10}),Ly(e,`dbg`,[-60,17.5,1],[Vx,17.5,1],.3,{radial:8}),Ly(e,`gunmetal`,[-60,27.9,1.1],[Vx,27.9,1.1],.35,{radial:8})}function iS(e,t){e.box(`dbg`,0,Hx/2,-1,180,Hx,2,{hide:{nz:!0}});let n=[-86,-74,-62,-50,-38,-26,-14,14,26,38,50,62,74,86];for(let t of n)Qx(e,t);nS(e,t,[-90,...n.filter(e=>e<0)],(e,t)=>({lower:Math.abs(e+56)>11,accent:t%4==2,sill:!0}),0,1.2),nS(e,t,[...n.filter(e=>e>0),Bx],(e,t)=>({accent:t%4==1,sill:!0}),1.2,0),e.box(`dbg`,0,Hx/2,.3,25.6,Hx,.6);for(let t of[-1,1])e.box(`lbg`,t*9,13,1.5,3,26,3),e.box(`gunmetal`,t*9,13,3.05,1.2,24,.2),e.box(`yellow`,t*9,1.2,3.02,3.02,2.4,.1),e.cyl(`glowGreen`,t*11.3,6.5,.9,.35,.4,{axis:`z`,radial:8}),e.box(`dbg`,t*11.3,6.5,.7,1.2,2.2,.2);e.box(`lbg`,0,27.5,1.5,21,3,3),Py(e,`dbg`,[[0,29],[3.2,29],[1.2,31.4],[0,31.4]],21);for(let t of[-1,1])e.box(`dbg`,t*3.75,12,.9,7.4,24,1.2);Yx(e,`glowWhite`,`pz`,0,12,1.52,.3,23);for(let t=1;t<24;t+=2.4)for(let n of[-1,1])e.box(t<3?`yellow`:`lbg`,n*3.75,t,1.6,6.4,.5,.2);e.box(`black`,0,33.5,.9,10,2.6,.6);for(let t=0;t<5;t++)e.box(t===2?`glowGreen`:`glowYellow`,-4+t*2,33.5,1.25,1.2,1,.1);for(let t=35;t<41;t+=2.6)e.box(`lbg`,0,t,.7,24,.8,.5);for(let t of[-1,1]){let n=t*16,r=t*Bx;Ly(e,`gunmetal`,[n,18.5,1.2],[r,18.5,1.2],.45,{radial:10}),Ly(e,`gunmetal`,[n,27.9,1.1],[r,27.9,1.1],.35,{radial:8}),Ly(e,`dbg`,[n,18.5,1.2],[n,0,1.2],.45,{radial:10})}}function aS(e,t){let n=Ux/2;for(let n of[-1,1]){e.box(`dbg`,n*71.5,Hx/2,-1,37,Hx,2,{hide:{nz:!0}});let r=[59,71,83].map(e=>e*n);for(let t of r)Qx(e,t);nS(e,t,n>0?[53,...r,Bx]:[-90,...r.reverse(),-53],(e,t)=>({accent:t%3==1,sill:!0}),n>0?.8:0,n>0?0:.8),Ly(e,`gunmetal`,[n*53,18.5,1.2],[n*Bx,18.5,1.2],.45,{radial:10})}e.box(`dbg`,0,40,-1,106,6,2,{hide:{nz:!0}});for(let t of[-1,1]){e.box(`lbg`,t*51.5,19,2.5,3,38,5),e.box(`dbg`,t*53.4,19,1.6,.8,38,3.2),e.box(`gunmetal`,t*50.2,19,1.5,.6,35,1.8),Yx(e,`glowBlue`,t>0?`nx`:`px`,t*49.88,19,1.5,1.2,34);for(let n=2;n<Wx;n+=3)e.box(`yellow`,t*51.5,n,5.03,2.6,1.4,.06);e.cyl(`glowRed`,t*51.5,39.4,5.1,.45,.4,{axis:`z`,radial:10})}e.box(`lbg`,0,38,2.5,106,2,5),e.box(`gunmetal`,0,37.1,1.5,99,.6,1.8),Yx(e,`glowBlue`,`ny`,0,36.78,1.5,98,1.2),Py(e,`dbg`,[[0,39],[5,39],[2.4,41.8],[0,41.8]],106);for(let t=-46;t<n;t+=8)e.box(`lbg`,t,39.6,4.2,5,.5,1.2);for(let t of[-1,1]){e.box(`dbg`,t*50.6,19,-4,1.2,Wx,qx);for(let n=-1.6;n>-8;n-=2.6)e.box(`lbg`,t*49.9,19,n,.6,Wx,.9);Yx(e,`glowWhite`,t>0?`nx`:`px`,t*49.98,19,-5.5,.6,32)}e.box(`dbg`,0,37.5,-4,102.4,1,qx);for(let t=-1.6;t>-8;t-=2.6)e.box(`lbg`,0,36.8,t,Ux,.6,.9);Yx(e,`glowWhite`,`ny`,0,36.98,-5.5,96,.6),e.box(`dbg`,0,-.6,-4,102.4,1.2,qx);for(let t=-50;t<n;t+=2)e.box(Math.round((t+n)/2)%2?`yellow`:`black`,t+1,.06,-1.4,1.96,.12,2);for(let t=-47;t<n;t+=6)e.cyl(`glowYellow`,t,.05,-7.2,.3,.1,{radial:8});e.box(`lbg`,0,-.6,-8.6,102.4,1.6,1.2)}function oS(e,t,n){e.box(`black`,0,-1.3,0,180,2,120,{hide:{ny:!0}});let r=Math.floor(180/Gx),i=Math.floor(120/Gx);for(let a=0;a<r;a++)for(let r=0;r<i;r++){let i=-87.5+(a+.5)*Gx,o=-59.5+(r+.5)*Gx,s=a===0||a===24||r===0,c=t.next(),l=s||c<.05?`lbg`:c<.09?`sandBlue`:`dbg`;if(e.box(l,i,-.2,o,6.4,.4,6.4,{hide:{ny:!0}}),!s&&!n.some(([e,t])=>Math.hypot(i-e,o-t)<13)){let n=t.next();n<.06?By(e,`lbg`,i+1.6,0,o+1.6,1,.2,14):n<.1?zy(e,`black`,i,0,o,4,2):n<.16&&e.box(`lbg`,i,.05,o-2.4,4,.1,.6)}}for(let t of[-1,1])e.box(`gunmetal`,t*89.6,.1,0,.8,.2,120);e.box(`gunmetal`,0,.1,-59.6,180,.2,.8);for(let t=-50;t<Ux/2;t+=2)for(let n=0;n<2;n++){let r=(Math.round((t+Ux/2)/2)+n)%2?`yellow`:`black`;e.box(r,t+1,.06,56.5+n*2,1.96,.12,1.96,{hide:{ny:!0}})}for(let[t,n,r,i]of[[0,-47,24,.8],[-12,-52.5,.8,11.8],[12,-52.5,.8,11.8]])e.box(`yellow`,t,.05,n,r,.1,i);for(let t=-10;t<=10;t+=4)e.push(),e.translate(t,.07,-52.4),e.rotateY(Math.PI/4),Iy(e,`yellow`,0,0,0,.8,7),e.pop();for(let t=-44;t<54;t+=6)e.box(`white`,0,.04,t,.6,.08,3.2);for(let[r,i]of n){e.lathe(`lbg`,[[0,.06,0,1,9.2,.06,0,1]],{radial:40,at:[r,0,i]}),e.lathe(`yellow`,[[9.2,.12,0,1,10.4,.12,0,1],[10.4,.12,1,0,10.4,0,1,0]],{radial:40,at:[r,0,i]}),e.lathe(`white`,[[6.3,.1,0,1,6.9,.1,0,1]],{radial:32,at:[r,0,i]}),e.box(`yellow`,r,.1,i,7,.08,1.1),e.box(`yellow`,r,.1,i,1.1,.08,7);for(let t=0;t<8;t++){let n=t/8*Math.PI*2+Math.PI/8;e.cyl(`glowYellow`,r+Math.sin(n)*11.1,.1,i+Math.cos(n)*11.1,.32,.2,{radial:8})}for(let t=i+12;t<54;t+=4)e.box(`yellow`,r,.04,t,.8,.08,2.4);for(let n=0;n<3;n++)e.push(),e.translate(r+t.range(-4,4),.16+n*.006,i+t.range(-4,4)),e.rotateY(t.range(0,Math.PI)),e.scale(1,1,t.range(.45,.7)),e.cyl(`trSmoke`,0,0,0,t.range(2.4,3.6),.02,{radial:16,bottom:!1,c:0}),e.cyl(`trSmoke`,0,.003,.3,t.range(1.2,1.8),.02,{radial:12,bottom:!1,c:0}),e.pop()}}function sS(e,t,n){for(let t of[-1,1]){for(let r of[-50.2,-56.5])e.box(`gunmetal`,n+t*9.5,5,r,1.2,10,1.2);Ly(e,`dbg`,[n+t*9.5,1,-50.2],[n+t*9.5,9.4,-56.5],.25,{radial:6})}e.box(`dbg`,n,10.4,-54.5,23,.8,11),e.box(`yellow`,n,10.4,-48.96,23,.4,.1);for(let t of[-6,0,6])Yx(e,`glowWhite`,`ny`,n+t,9.98,-53.5,3,1.2);e.box(`lbg`,n,11.6,-49.4,23,1.6,.8);let r=Math.hypot(1.8,5.6);e.box(`trBlack`,n,15.2,-50.3,21.4,r,.24,{rot:[-Math.atan2(1.8,5.6),0,0]});for(let t=-7;t<=7;t+=7)e.box(`dbg`,n+t,15.2,-50.15,.4,r,.3,{rot:[-Math.atan2(1.8,5.6),0,0]});for(let t of[-1,1])Py(e,`lbg`,[[-60,10.8],[-49,10.8],[-49,12.4],[-50.8,18],[-60,18]],.8,n+t*11.1);e.box(`lbg`,n,18.6,-55.1,23.4,1.2,11.2),Py(e,`dbg`,[[-60,19.2],[-49.6,19.2],[-50.8,20.2],[-60,20.2]],22.4,n),Ly(e,`gunmetal`,[n+8,20.2,-57],[n+8,24,-57],.12,{radial:6}),e.cyl(`glowRed`,n+8,24.2,-57,.3,.4,{radial:8}),e.cyl(`glowRed`,n-10.6,19.6,-51,.35,.5,{radial:8}),Yx(e,`windowWarm`,`pz`,n,14.6,-59.5,21,6);for(let r=0;r<5;r++){let i=n-8+r*4;e.box(`dbg`,i,11.8,-51.6,3,1.8,1.6),Yx(e,t.chance(.3)?`glowGreen`:`windowCool`,`py`,i,12.72,-51.6,2.4,1)}for(let t=0;t<9;t++)e.box(`dbg`,n+12.6+(8-t)*1.1,(t+.5)*(10/9),-51,1.2,10/9,3.6,{hide:{ny:!0}});Ly(e,`gunmetal`,[n+12.6,13.2,-49.3],[n+22.4,4.2,-49.3],.14,{radial:6}),Ly(e,`gunmetal`,[n+22.4,0,-49.3],[n+22.4,4.2,-49.3],.14,{radial:6})}function cS(e,t,n,r){for(let t of[-1,0,1])e.box(`gunmetal`,n+t*12,9,r,.8,18,3);for(let i=0;i<3;i++){let a=1+i*6;e.box(`dbg`,n,a,r,24.8,.6,3.2),e.box(`yellow`,n,a,r+1.62,24.8,.3,.06);for(let i=0;i<7;i++){let o=n-12+1.8+i*3.4;e.box(`tan`,o,a+1.8,r+.2,1.2,2.4,1.6),e.cyl(`tan`,o,a+3.3,r+.6,.35,1.6,{axis:`z`,radial:8}),e.box(`tan`,o,a+3.5,r-.3,.6,.5,1.2),e.cyl(`tan`,o-.5,a+1.2,r+1,.18,1.6,{radial:6}),e.cyl(`tan`,o+.5,a+1.2,r+1,.18,1.6,{radial:6}),t.chance(.3)&&e.box(`reddishBrown`,o,a+2.2,r+1.05,.9,.9,.1)}}e.box(`dbg`,n,18.6,r,25.6,1.2,3.6),e.cyl(`glowRed`,n-12,19.6,r,.3,.6,{radial:8}),e.cyl(`glowRed`,n+12,19.6,r,.3,.6,{radial:8})}function lS(e,t){let n=(t,n,r,i,a,o)=>{e.push(),e.translate(t,n,r),e.rotateY(o),e.box(a,0,i/2,0,i,i,i);for(let[t,n]of[[1,1],[1,-1],[-1,1],[-1,-1]])e.box(`dbg`,t*i/2,i/2,n*i/2,.5,i+.1,.5);e.box(`dbg`,0,i+.05,0,i+.1,.3,.6),e.box(a===`dbg`?`lbg`:`dbg`,0,i*.55,i/2+.03,i*.5,i*.35,.1),e.pop()},r=(e,r,i)=>{let a=0;for(let o=0;o<i;o++){let i=t.pick([3,4,4,5]);n(e+t.range(-.5,.5),a,r+t.range(-.5,.5),i,t.pick([`darkTan`,`dbg`,`lbg`,`reddishBrown`,`darkTan`]),t.range(-.25,.25)),a+=i+.3}};for(let[e,t,n]of[[-72,-44,3],[-66,-45,2],[-71,-37,1],[72,30,2],[67,35,1],[-76,28,2],[-71,33,1],[70,-30,3],[64,-34,1],[40,50,1],[-40,51,1],[-36,50,2]])r(e,t,n);let i=(t,n,r,i)=>{e.push(),e.translate(t,0,n),e.rotateY(r),e.box(i,0,3.6,0,12,7,6);for(let t=-5;t<=5;t+=2)e.box(i,t,3.6,0,.5,7.1,6.14);e.box(`dbg`,0,7.2,0,12.2,.4,6.2),e.box(`dbg`,0,.2,0,12.2,.4,6.2);for(let t of[-1,1])e.box(`gunmetal`,t*6.05,3.6,0,.2,6.6,5.6);e.box(`yellow`,0,5.8,3.08,4,.8,.06),e.pop()};i(-77,12,Math.PI/2,`darkTan`),i(78,46,Math.PI/2,`dbg`),n(78,7.4,46,3,`lbg`,.2);let a=(t,n,r)=>{for(let i=0;i<r;i++){let r=t+i%3*3.4,a=n+Math.floor(i/3)*3.4;e.cyl(`lbg`,r,2.6,a,1.5,5.2,{radial:16}),e.cyl(`dbg`,r,1.2,a,1.55,.6,{radial:16}),e.cyl(i%2?`red`:`dbg`,r,4.1,a,1.55,.6,{radial:16}),e.cyl(`gunmetal`,r,5.4,a,.7,.5,{radial:10})}};a(-62,44,6),a(70,-48,5),a(22,-50,3);for(let[t,n]of[[-30,-49],[46,-40]])e.cyl(`dbg`,t,2.2,n,2.2,.5,{axis:`z`,radial:16}),e.cyl(`dbg`,t,2.2,n+3,2.2,.5,{axis:`z`,radial:16}),e.cyl(`black`,t,2.2,n+1.5,1.6,2.6,{axis:`z`,radial:16});for(let t of[-4,4])e.cyl(`lbg`,-78,7,-40+t,3,14,{radial:20}),e.cyl(`dbg`,-78,14.3,-40+t,3.1,.6,{radial:20}),e.cyl(`darkTan`,-78,4,-40+t,3.05,1.2,{radial:20}),e.cyl(`red`,-78,10.5,-40+t,3.05,.6,{radial:20});Ly(e,`gunmetal`,[-75,10,-44],[-75,10,-36],.4,{radial:8}),Ly(e,`gunmetal`,[-78,14.6,-44],[-78,16,-44],.3,{radial:8}),Ly(e,`gunmetal`,[-78,16,-44],[-84,16,-44],.3,{radial:8}),e.box(`dbg`,-74.8,9.5,-40,1,3,3),Yx(e,`glowOrange`,`px`,-74.28,9.5,-40,2,2),e.cyl(`glowOrange`,-78,15,-40,.7,.8,{radial:10}),e.box(`yellow`,34,1.6,-36,4,2,7),e.box(`dbg`,34,3.1,-37.6,3.6,1.2,2.4),e.box(`black`,34,1.2,-32.4,3.4,.8,.4);for(let[t,n]of[[-2,-2.5],[2,-2.5],[-2,2.5],[2,2.5]])e.add(`rubberBlack`,eu(.9,.35,.8,.1,14),new G().makeTranslation(34+t,.9,-36+n).multiply(new G().makeRotationZ(Math.PI/2)))}function uS(e,t){e.box(`dbg`,0,43,0,184,2,124,{hide:{py:!0}});for(let t=-54;t<=54;t+=12)e.box(`lbg`,0,41.2,t,180,1.6,2.4,{hide:{py:!0}});for(let t of[-86,-62,-38,-14,14,38,62,86])e.box(`lbg`,t,41.3,0,2.4,1.4,120,{hide:{py:!0}});for(let n of[-40,-20,0,20,40]){e.box(`gunmetal`,0,37.5,n,174,1.6,2),e.box(`dbg`,0,36.4,n,172,.6,3);for(let t=-80;t<=80;t+=20)Ly(e,`gunmetal`,[t,38.3,n],[t,40.4,n],.3,{radial:6});for(let r=-75;r<=75;r+=10)t.chance(.08)||Yx(e,`glowWhite`,`ny`,r,36.05,n,6.5,2.4);for(let t of[-1,1])e.cyl(`glowRed`,t*78,36.6,n,.4,.6,{radial:8})}for(let n=-75;n<=75;n+=12)for(let r=-48;r<=48;r+=12)t.chance(.4)&&Yx(e,`windowWarm`,`ny`,n,41.95,r,3,3)}function dS(){let e=new sn;e.name=`hangar`;let t={},n={},r=0,i=(t,i,a={})=>{let o=t.build(i,a);e.add(o.group),r+=o.triangles,n[i]=o.triangles},a=new au(2024),o=[-17.5,8],s=[17.5,8],c=Jx(1);oS(c,a,[o,s]),i(c,`hangar-deck`);let l=Jx(2);for(let e of[!1,!0])l.push(),e&&l.mirrorX(),l.translate(Bx,0,0),l.rotateY(-Math.PI/2),rS(l,a),l.pop();l.push(),l.translate(0,0,-60),iS(l,a),l.pop(),l.push(),l.translate(0,0,Vx),l.rotateY(Math.PI),aS(l,a),l.pop(),i(l,`hangar-walls`);let u=Jx(3);sS(u,a,-56),cS(u,a,52,-51),lS(u,a),i(u,`hangar-props`);let d=Jx(4);uS(d,a),i(d,`hangar-ceiling`,{castShadow:!1});let f=Hb(Ux,Wx,{name:`hangar-ray-shield`,scan:40});return f.mesh.position.set(0,19,60.2),e.add(f.mesh),t.landingA=Ry(c,`landingA`,e,[o[0],0,o[1]],[0,0,-1]),t.landingB=Ry(c,`landingB`,e,[s[0],0,s[1]],[0,0,-1]),t.mouth=Ry(c,`mouth`,e,[0,19,Vx],[0,0,1]),t.droidLine=Ry(c,`droidLine`,e,[0,0,-32],[0,0,1]),t.elevator=Ry(c,`elevator`,e,[0,0,-58],[0,0,1]),t.booth=Ry(c,`booth`,e,[-56,10.8,-55],[0,0,1]),e.userData.animate=e=>f.update(e),e.userData.triangles=r,e.userData.parts=n,{group:e,setShield:e=>f.set(e),anchors:t,size:[Bx,Hx,Vx]}}function fS(e,t){let n=0;t.traverse(e=>{e.isMesh&&e.visible&&n++});let r=t.userData.parts??{},i=Object.entries(r).map(([e,t])=>`${e} ${(t/1e3).toFixed(1)}k`).join(`, `);console.error(`[lab-d] ${e}: ${((t.userData.triangles??0)/1e3).toFixed(1)}k built tris, ${n} meshes | ${i}`)}function pS(e,t,n){let r=new sn;r.name=`${e.name}-focus`,r.add(e),r.userData.frame={center:t,radius:n};let i=e.userData.animate;return i&&(r.userData.animate=i),r}function mS(e,t=1){let n=Vb({lod:e,seed:t});return fS(`munificent lod${e}`,n.group),n.group}function hS(e){let t=Lx({lod:e});return fS(`invisible-hand lod${e}`,t.group),t.group}function gS(e,t){let n=Lx({lod:0});fS(`invisible-hand lod0`,n.group);let r=n.anchors.hangar.position;return pS(n.group,[r.x+t,r.y,r.z],e)}function _S(e,t,n=1){let r=dS();r.setShield(n),fS(`hangar`,r.group);let i=e?pS(r.group,e,t):(()=>{let e=new sn;return e.add(r.group),e})(),a=(e,t,n,r,a,o=160)=>{let s=new Ha(e,t,o,1.6);s.position.set(n,r,a),s.layers.enableAll(),i.add(s)};a(16773336,900,-40,34,-20),a(16773336,900,40,34,-20),a(5941503,700,0,18,58,140),a(16738874,260,-80,10,-40,90);let o=r.group.userData.animate,s=new U(.2,1,.3).normalize();return i.userData.animate=e=>{o?.(e);let n=i;for(;n.parent;)n=n.parent;n.traverse(e=>{let n=e;n.isDirectionalLight&&(n.intensity=1.2,n.color.set(16769728),n.position.copy(n.target.position).addScaledVector(s,t*4));let r=e;r.isHemisphereLight&&(r.intensity=.35,r.color=new K(7168600),r.groundColor=new K(2762274))})},i}var vS={munificent:()=>mS(0),"munificent-lod1":()=>mS(1),"munificent-lod2":()=>mS(2),"mun-bridge":()=>pS(mS(0),[0,176,704],320),"mun-aft":()=>pS(mS(0),[0,48,-800],480),"mun-bow":()=>pS(mS(0),[0,40,1e3],300),"mun-mid":()=>pS(mS(0),[0,0,-240],380),"invisible-hand":()=>hS(0),"invisible-hand-lod1":()=>hS(1),"ih-mouth":()=>gS(70,10),"ih-mouth-wide":()=>gS(260,40),hangar:()=>_S([0,12,0],70),"hangar-mouth":()=>_S([-8,8,30],28),"hangar-open":()=>_S([-8,8,30],28,0),"hangar-back":()=>_S([0,2.4,-10],12.1,0)},yS={"test-bricks":Tu,...ip,...cg,...dy,...vS,...tp};function bS(e,t){let n=new hn,r=new Nr(new qi(100,48,24),new na({side:1,depthWrite:!1,uniforms:{top:{value:new K(t.top)},horizon:{value:new K(t.horizon)},bottom:{value:new K(t.bottom).multiplyScalar(t.bottomPower??1)}},vertexShader:`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,fragmentShader:`
        uniform vec3 top, horizon, bottom; varying vec3 vDir;
        void main(){
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.6)) : mix(horizon, bottom, pow(clamp(-y,0.0,1.0), 0.45));
          gl_FragColor = vec4(c, 1.0);
        }`}));n.add(r);for(let e of t.panels){let t=new Nr(new Ki(e.w,e.h),new xr({color:new K(e.color).multiplyScalar(e.power),side:2})),r=new U(...e.dir).normalize();t.position.copy(r.clone().multiplyScalar(60)),t.lookAt(0,0,0),n.add(t)}let i=new Io(e),a=i.fromScene(n,.02,.1,200);return i.dispose(),a.texture}var xS=e=>({top:263951,horizon:1714756,bottom:5995174,bottomPower:.9,panels:[{dir:e,color:16773596,power:9,w:26,h:18},{dir:[-e[0],.25,-e[2]],color:10470655,power:1.6,w:40,h:12},{dir:[e[2],.7,-e[0]],color:14477567,power:1.3,w:70,h:5},{dir:[-e[2],.55,e[0]],color:14477567,power:1,w:60,h:4},{dir:[.2,-1,.1],color:8956120,power:1.2,w:90,h:90}]}),SS={top:2762532,horizon:4012083,bottom:1841688,panels:[{dir:[0,1,0],color:16773336,power:4,w:80,h:6},{dir:[.35,1,.3],color:16773336,power:3.5,w:80,h:5},{dir:[-.35,1,-.3],color:16773336,power:3.5,w:80,h:5},{dir:[0,.2,1],color:4892927,power:3.2,w:70,h:30},{dir:[-1,.3,-.2],color:16742970,power:1.4,w:20,h:10},{dir:[1,.2,-.4],color:16761466,power:1.2,w:30,h:14}]},CS={top:2896704,horizon:3818064,bottom:1711394,panels:[{dir:[.6,.7,.8],color:16774374,power:7,w:30,h:22},{dir:[-.9,.3,.2],color:12572415,power:2.2,w:30,h:30},{dir:[0,.5,-1],color:16777215,power:3,w:60,h:8},{dir:[0,1,0],color:16777215,power:1.5,w:60,h:60}]};function wS(e,t={}){let n=new Go(t.size??512,{type:g,generateMipmaps:!1,minFilter:o,magFilter:o}),r=new hn,i=new na({side:1,depthWrite:!1,uniforms:{seed:{value:t.seed??3},tint:{value:new K(...t.tint??[.35,.45,.9])},strength:{value:t.strength??1}},vertexShader:`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,fragmentShader:`
      uniform float seed; uniform vec3 tint; uniform float strength; varying vec3 vDir;
      float h(vec3 p){ p = fract(p * 0.3183099 + 0.1 + seed * 0.013); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y), f.z); }
      float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        // a faint galactic band + two coloured nebula lobes
        float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.85, -0.42))) * 3.2, 2.0));
        float f = fbm(d * 2.6 + seed);
        float g = fbm(d * 6.0 - seed * 1.3);
        float lobeA = smoothstep(0.35, 1.0, dot(d, normalize(vec3(-0.6, 0.45, -0.66)))) ;
        float lobeB = smoothstep(0.5, 1.0, dot(d, normalize(vec3(0.75, 0.2, 0.62))));
        vec3 c = vec3(0.0);
        c += tint * pow(f, 3.0) * band * 0.22;
        c += vec3(0.55, 0.22, 0.65) * pow(f * g, 2.0) * lobeA * 0.6;
        c += vec3(0.2, 0.5, 0.85) * pow(g, 3.0) * lobeB * 0.45;
        c += vec3(0.012, 0.016, 0.03);
        gl_FragColor = vec4(c * strength, 1.0);
      }`});return r.add(new Nr(new qi(10,64,32),i)),new Xa(1,100,n).update(e,r),i.dispose(),n.texture}function TS(e={}){let t=e.count??9e3,n=e.radius??9e5,r=new au(e.seed??11),i=new Float32Array(t*3),a=new Float32Array(t*3),o=new Float32Array(t),s=new K;for(let e=0;e<t;e++){let t=r.next()*2-1,c=r.next()*Math.PI*2,l=Math.sqrt(1-t*t);i[e*3]=l*Math.cos(c)*n,i[e*3+1]=t*n,i[e*3+2]=l*Math.sin(c)*n;let u=r.next()**5.5,d=r.next();d<.18?s.setRGB(1,.78,.55):d<.5?s.setRGB(1,.95,.88):s.setRGB(.78,.86,1);let f=.35+u*7;a[e*3]=s.r*f,a[e*3+1]=s.g*f,a[e*3+2]=s.b*f,o[e]=1.1+u*3.2+r.next()*.6}let c=new lr;c.setAttribute(`position`,new Jn(i,3)),c.setAttribute(`color`,new Jn(a,3)),c.setAttribute(`size`,new Jn(o,1));let l=new na({transparent:!0,depthWrite:!1,blending:2,uniforms:{scale:{value:1}},vertexShader:`
      attribute float size; attribute vec3 color; uniform float scale; varying vec3 vCol;
      void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * scale; }`,fragmentShader:`
      varying vec3 vCol;
      void main(){ vec2 p = gl_PointCoord - 0.5; float r2 = dot(p,p) * 4.0; float a = exp(-r2 * 4.0); if (a < 0.01) discard; gl_FragColor = vec4(vCol * a, 1.0); }`}),u=new ti(c,l);u.frustumCulled=!1,u.userData.material=l;let d=new sn;return d.name=`stars`,d.add(u),d}var ES=class{pipeline;scene=new hn;camera=new Ba(32,2.39,.02,4e3);object;sphere=new tr;key;lens={...Nl,grain:.02,vignette:.25};far=null;constructor(e,t,n){this.pipeline=e;let r=yS[t];if(!r)throw Error(`unknown asset "${t}" (have: ${Object.keys(yS).join(`, `)})`);this.object=r(),this.scene.add(this.object),this.object.updateMatrixWorld(!0),new An().setFromObject(this.object).getBoundingSphere(this.sphere);let i=this.object.userData.frame;i&&(this.sphere.center.set(...i.center),this.sphere.radius=i.radius);let a=[.55,.62,.56];n===`space`?(this.scene.background=wS(e.renderer,{size:256}),this.scene.add(TS({count:6e3})),this.scene.environment=bS(e.renderer,xS(a))):(this.scene.background=new K(1382429),this.scene.environment=bS(e.renderer,CS));let o=this.sphere.radius;this.key=new Ga(16773856,2.6),this.key.position.set(a[0],a[1],a[2]).multiplyScalar(o*4).add(this.sphere.center),this.key.target.position.copy(this.sphere.center),this.key.castShadow=!0,this.key.shadow.mapSize.set(2048,2048);let s=this.key.shadow.camera;s.left=-o*1.2,s.right=o*1.2,s.top=o*1.2,s.bottom=-o*1.2,s.near=o*.5,s.far=o*8,this.key.shadow.bias=-4e-4,this.key.shadow.normalBias=o*.004,this.key.shadow.radius=2,this.key.layers.enableAll(),this.key.target.layers.enableAll(),this.scene.add(this.key,this.key.target);let c=new Oa(9414344,2764600,n===`space`?.35:.6);c.layers.enableAll(),this.scene.add(c);let l=new Ka(16777215,.05);l.layers.enableAll(),this.scene.add(l),this.pose(35,18,1,0)}pose(e,t,n,r){let i=this.sphere.center,a=this.sphere.radius,o=e*Math.PI/180,s=t*Math.PI/180,c=this.camera.fov*Math.PI/180,l=a/Math.sin(c/2)*.62*n;this.camera.position.set(i.x+Math.sin(o)*Math.cos(s)*l,i.y+Math.sin(s)*l,i.z+Math.cos(o)*Math.cos(s)*l),this.camera.near=Math.max(.01,l-a*3)*.05,this.camera.far=Math.max(l+a*4,3e6),this.camera.lookAt(i),this.camera.updateProjectionMatrix(),this.lens.focus=l;let u=this.object.userData.animate;u?.(r)}render(e){this.camera.aspect=this.pipeline.width/this.pipeline.height,this.camera.updateProjectionMatrix(),this.pipeline.render(this.scene,this.camera,this.lens,{far:this.far,time:e})}};new U;var DS=`
float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// distance to the nearest grid line of spacing S (in the same units as x)
float gridD(vec2 x, float S){ vec2 g = abs(fract(x / S) - 0.5) * S; return min(g.x, g.y); }
`;function OS(e){let t=e.radius,n=new sn;n.name=`coruscant`,n.position.copy(e.center);let r=new na({uniforms:{sunDir:{value:e.sunDir.clone().normalize()},center:{value:e.center.clone()},R:{value:t}},vertexShader:`
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`
      uniform vec3 sunDir; uniform vec3 center; uniform float R;
      varying vec3 vWorld; varying vec3 vN;
      ${DS}
      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vWorld);
        float ndl = dot(n, sunDir);
        // tangent-plane coordinates (the fleet sits over the planet's north pole)
        vec2 p = (vWorld - center).xz;
        float px = max(length(fwidth(p)), 1e-3);
        // districts: large tone patches, each with its own street-grid orientation
        vec2 dc = floor(p / 5200.0);
        float dh = h2(dc);
        vec2 pr = rot(dh * 3.14159) * p;
        float big = fbm(p / 14000.0);
        float mid = fbm(p / 3100.0 + 9.1);
        // three street scales with pixel-footprint fades
        float f1 = 1.0 - smoothstep(0.08, 0.35, px / 900.0);
        float f2 = 1.0 - smoothstep(0.08, 0.35, px / 220.0);
        float f3 = 1.0 - smoothstep(0.08, 0.35, px / 60.0);
        float S1 = 650.0 + 700.0 * fract(dh * 7.13);
        float S2 = 170.0 + 110.0 * fract(dh * 3.71);
        float s1 = (1.0 - smoothstep(7.0, 7.0 + px * 1.5, gridD(pr + dh * 400.0, S1))) * f1;
        float s2 = (1.0 - smoothstep(2.4, 2.4 + px * 1.5, gridD(pr + 37.0, S2))) * f2;
        float s3 = (1.0 - smoothstep(0.8, 0.8 + px * 1.5, gridD(pr + 11.0, 60.0))) * f3;
        float streets = max(s1 * 0.18, max(s2 * 0.45, s3 * 0.4));
        // rooftops: per-block albedo, towers, plazas
        float roof1 = h2(floor(pr / 220.0) + 3.0);
        float roof2 = h2(floor(pr / 60.0) + 7.0);
        float roof = mix(0.5, roof1, f2 * 0.42);
        roof = mix(roof, roof * 0.7 + roof2 * 0.3, f3 * 0.8);
        roof = mix(roof, vn(pr / 90.0 + 5.0), 0.35 * f3);
        vec3 tone = dh < 0.3 ? vec3(0.95, 1.0, 1.1) : dh < 0.55 ? vec3(1.12, 1.02, 0.88) : dh < 0.8 ? vec3(0.85, 0.85, 0.88) : vec3(1.15, 0.92, 0.78);
        vec3 alb = mix(vec3(0.13, 0.14, 0.16), vec3(0.3, 0.29, 0.27), roof) * tone;
        alb = mix(alb, alb * vec3(0.78, 0.86, 1.05), smoothstep(0.4, 0.75, big));
        alb = mix(alb, alb * vec3(1.12, 0.98, 0.84), smoothstep(0.5, 0.85, mid) * 0.8);
        float dark = smoothstep(0.52, 0.7, fbm(p / 5200.0 + 2.0));
        alb *= (0.6 + 0.7 * big) * (1.0 - dark * 0.45);
        alb *= 1.0 - streets * 0.45;
        // lighting
        vec3 sun = vec3(1.0, 0.84, 0.66) * 1.9;
        vec3 col = alb * (sun * max(ndl, 0.0) + vec3(0.035, 0.05, 0.09));
        // sun glints off tower glass on the day side
        float glint = step(0.985, h2(floor(pr / 45.0) + 9.3)) * f3 * smoothstep(0.02, 0.2, ndl);
        col += vec3(1.0, 0.9, 0.75) * glint * 0.6;
        col += vec3(0.5, 0.2, 0.06) * exp(-pow(ndl * 10.0, 2.0)) * 0.35 * (alb + 0.1);
        // night: street-light networks + scattered lit towers
        float night = 1.0 - smoothstep(-0.12, 0.06, ndl);
        float cluster = smoothstep(0.35, 0.75, mid * 0.6 + big * 0.5);
        float spark = step(0.93, h2(floor(pr / 60.0) + 1.7)) * f3 + step(0.9, h2(floor(pr / 220.0) + 5.1)) * f2 * 0.6;
        float lights = (s1 * 1.4 + s2 * 0.9 + s3 * 0.45) * (0.35 + cluster) + spark * (0.4 + cluster);
        lights += (1.0 - f2) * (0.08 + cluster * 0.35) + (1.0 - f1) * 0.12 * cluster;
        col += vec3(1.0, 0.6, 0.26) * lights * night * 1.25;
        // clouds (day side bright, night side dark, they hide the lights)
        float cl = smoothstep(0.64, 0.84, fbm(p / 8000.0 + vec2(3.3, 1.1)) * 0.8 + fbm(p / 2100.0) * 0.3);
        vec3 cloudLit = vec3(1.0, 0.95, 0.9) * (max(ndl, 0.0) * 1.5 + 0.02);
        col = mix(col, cloudLit, cl * 0.55);
        // aerial haze: optical depth grows as the view grazes the surface
        float mu = max(dot(n, v), 0.02);
        float haze = 1.0 - exp(-0.05 / mu);
        vec3 hazeCol = mix(vec3(0.015, 0.022, 0.05), vec3(0.26, 0.4, 0.72), smoothstep(-0.15, 0.35, ndl));
        hazeCol += vec3(0.6, 0.25, 0.08) * exp(-pow(ndl * 6.0, 2.0)) * 0.6;
        col = mix(col, hazeCol, haze);
        gl_FragColor = vec4(col, 1.0);
      }`}),i=new Nr(new qi(t,512,256),r);i.frustumCulled=!1,n.add(i);let a=new na({transparent:!0,depthWrite:!1,blending:2,side:0,uniforms:{sunDir:{value:e.sunDir.clone().normalize()},color:{value:new K(.3,.55,1)}},vertexShader:`
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`
      uniform vec3 sunDir; uniform vec3 color; varying vec3 vWorld; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vWorld);
        float mu = clamp(dot(n, v), 0.0, 1.0);
        float rim = pow(1.0 - mu, 14.0);
        float ndl = dot(n, sunDir);
        float lit = smoothstep(-0.3, 0.25, ndl);
        vec3 c = color * rim * (0.05 + 0.9 * lit);
        c += vec3(1.0, 0.42, 0.15) * rim * exp(-pow(ndl * 5.0, 2.0)) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`}),o=new Nr(new qi(t*1.012,384,192),a);return o.frustumCulled=!1,n.add(o),{group:n,surface:r,atmo:a,setSun(e){r.uniforms.sunDir.value.copy(e).normalize(),a.uniforms.sunDir.value.copy(e).normalize()}}}var kS={red:[16722456,16756896],blue:[2784255,12575999],green:[2948938,13172688]},AS=class{group=new sn;events=[];meshes=new Map;max=900;constructor(){this.group.name=`lasers`;let e=new lr,t=Ql(Xl([[0,.5],[.35,.42],[.5,.25],[.5,-.25],[.35,-.42],[0,-.5]],60),8);e.setAttribute(`position`,new Jn(t.pos,3)),e.setAttribute(`normal`,new Jn(t.nrm,3));for(let t of[`red`,`blue`,`green`]){let[n,r]=kS[t],i=new xr({color:new K(r).multiplyScalar(9),transparent:!0,blending:2,depthWrite:!1,toneMapped:!1}),a=new xr({color:new K(n).multiplyScalar(3.2),transparent:!0,opacity:.55,blending:2,depthWrite:!1,toneMapped:!1}),o=new Gr(e,i,this.max),s=new Gr(e,a,this.max);for(let e of[o,s])e.frustumCulled=!1,e.count=0,e.instanceMatrix.setUsage(He),e.renderOrder=5,this.group.add(e);this.meshes.set(t,{core:o,glow:s})}}update(e){let t={red:0,blue:0,green:0},n=new G,r=new ut,i=new U,a=new U,o=new U(0,1,0);for(let s of this.events){let c=e-s.t0;if(c<0||c>s.life)continue;let l=this.meshes.get(s.color),u=t[s.color];if(u>=this.max)continue;t[s.color]++;let d=Math.min(1,c/.03)*Math.min(1,(s.life-c)/.05);a.copy(s.dir).multiplyScalar(s.speed*c).add(s.from),r.setFromUnitVectors(o,s.dir),i.set(s.width*d,s.length,s.width*d),n.compose(a,r,i),l.core.setMatrixAt(u,n),i.set(s.width*2.6*d,s.length*1.15,s.width*2.6*d),n.compose(a,r,i),l.glow.setMatrixAt(u,n)}for(let[e,n]of this.meshes)n.core.count=t[e],n.glow.count=t[e],n.core.instanceMatrix.needsUpdate=!0,n.glow.instanceMatrix.needsUpdate=!0}},jS=`
attribute vec3 aCenter; attribute vec3 aVel; attribute vec4 aParams; // t0, dur, size, seed
attribute float aHeat;
uniform float uTime;
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
void main(){
  float age = (uTime - aParams.x) / aParams.y;
  vAge = age; vSeed = aParams.w; vHeat = aHeat; vUv = position.xy * 2.0;
  if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float grow = 0.35 + 0.95 * (1.0 - pow(1.0 - age, 3.0));
  vec3 c = aCenter + aVel * (uTime - aParams.x);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  float ang = aParams.w * 6.2831 + age * 0.6;
  vec2 xy = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * position.xy;
  mv.xy += xy * aParams.z * grow;
  gl_Position = projectionMatrix * mv;
}`,MS=`
float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
`,NS=`
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
${MS}
void main(){
  float r = length(vUv);
  float n = fbm2(vUv * 2.2 + vSeed * 17.0 + vAge * 1.8);
  float shape = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.75);
  if (shape <= 0.001) discard;
  float temp = clamp((1.0 - vAge * 1.25) * (1.15 - r) * 1.6 + (n - 0.5) * 0.5, 0.0, 1.0) * vHeat;
  vec3 col = mix(vec3(0.5, 0.06, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.45, temp));
  col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.45, 0.8, temp));
  col = mix(col, vec3(1.0, 0.93, 0.75), smoothstep(0.85, 1.0, temp));
  float inten = mix(0.9, 5.5, temp) * pow(1.0 - vAge, 1.3);
  gl_FragColor = vec4(col * inten * shape, 1.0);
}`,PS=`
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
${MS}
void main(){
  float r = length(vUv);
  float n = fbm2(vUv * 1.8 + vSeed * 11.0 + vAge * 0.9);
  float shape = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
  float a = shape * smoothstep(0.0, 0.12, vAge) * pow(1.0 - vAge, 1.5) * 0.75;
  if (a <= 0.004) discard;
  vec3 col = mix(vec3(0.05, 0.05, 0.055), vec3(0.28, 0.26, 0.25), n);
  // embers glow inside young smoke
  col += vec3(0.9, 0.3, 0.05) * (1.0 - smoothstep(0.0, 0.35, vAge)) * (1.0 - r) * 0.8;
  gl_FragColor = vec4(col, a);
}`,FS=class{mesh;mat;constructor(e,t){let n=Math.max(1,e.length),r=new qa,i=new Ki(1,1);r.index=i.index,r.setAttribute(`position`,i.getAttribute(`position`));let a=new Float32Array(n*3),o=new Float32Array(n*3),s=new Float32Array(n*4),c=new Float32Array(n);e.forEach((e,t)=>{a.set([e.center.x,e.center.y,e.center.z],t*3),o.set([e.vel.x,e.vel.y,e.vel.z],t*3),s.set([e.t0,e.dur,e.size,e.seed],t*4),c[t]=e.heat}),e.length||s.set([-100,.001,0,0],0),r.setAttribute(`aCenter`,new Lr(a,3)),r.setAttribute(`aVel`,new Lr(o,3)),r.setAttribute(`aParams`,new Lr(s,4)),r.setAttribute(`aHeat`,new Lr(c,1)),r.instanceCount=n,this.mat=new na({vertexShader:jS,fragmentShader:t?NS:PS,uniforms:{uTime:{value:0}},transparent:!0,depthWrite:!1,blending:t?2:1}),this.mesh=new Nr(r,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=t?6:4}},IS=class{group=new sn;lasers=new AS;puffsFire=[];puffsSmoke=[];pieces=[];sparks=[];fire;smoke;debris=[];sparkPts;sparkMat;built=!1;explosions=[];constructor(){this.group.name=`fx`,this.group.add(this.lasers.group)}laser(e){this.lasers.events.push({...e,from:e.from.clone(),dir:e.dir.clone().normalize()})}explosion(e,t,n){let r=new au(n.seed??Math.floor(e*1e3+t.x*7+t.y*13)),i=n.size;this.explosions.push({t0:e,pos:t.clone(),size:i,pieces:n.pieces??40});let a=n.inherit??new U,o=n.flashes??1;for(let n=0;n<o;n++){let o=n*r.range(.06,.18),s=5+Math.floor(r.range(0,3));for(let n=0;n<s;n++){let s=new U(r.gauss(),r.gauss(),r.gauss()).multiplyScalar(i*.28);this.puffsFire.push({center:t.clone().add(s),t0:e+o+n*.025,dur:r.range(.55,1)*(i/6)**.25,size:i*r.range(.6,1.1),seed:r.next(),heat:r.range(.85,1.15),vel:s.clone().normalize().multiplyScalar(i*.6).add(a)})}}let s=n.smoke??6;for(let n=0;n<s;n++){let o=new U(r.gauss(),r.gauss(),r.gauss()).multiplyScalar(i*.35);this.puffsSmoke.push({center:t.clone().add(o),t0:e+.12+n*.04,dur:r.range(1.6,2.8)*(i/6)**.2,size:i*r.range(.9,1.5),seed:r.next(),heat:1,vel:o.clone().normalize().multiplyScalar(i*.35).add(a.clone().multiplyScalar(.9))})}let c=n.pieces??40,l=n.colors??[`lbg`,`dbg`,`white`],u=n.brickScale??1;for(let n=0;n<c;n++){let n=new U(r.gauss(),r.gauss(),r.gauss()).normalize(),o=i*r.range(1.2,4.5);this.pieces.push({t0:e,life:r.range(2.5,5),from:t.clone().add(n.clone().multiplyScalar(i*.1)),vel:n.multiplyScalar(o).add(a),axis:new U(r.gauss(),r.gauss(),r.gauss()).normalize(),spin:r.range(4,14)*(r.chance(.5)?1:-1),scale:u*r.range(.7,1.3),shape:r.int(0,3),color:new K(du(r.pick(l)).hex)})}let d=n.sparks??40;for(let n=0;n<d;n++){let n=new U(r.gauss(),r.gauss(),r.gauss()).normalize();this.sparks.push({t0:e+r.range(0,.1),life:r.range(.4,1.1),from:t.clone(),vel:n.multiplyScalar(i*r.range(3,9)).add(a),size:r.range(2,5)})}}sparkStream(e,t,n,r,i=90,a=1,o=3){let s=new au(a),c=Math.floor((t-e)*i);for(let t=0;t<c;t++){let a=e+t/i+s.range(0,1/i),c=r(a).clone().add(new U(s.gauss(),s.gauss(),s.gauss()).multiplyScalar(.45)).normalize();this.sparks.push({t0:a,life:s.range(.15,.45),from:n(a).clone(),vel:c.multiplyScalar(o*s.range(.6,1.6)),size:s.range(1.5,3.5)})}}build(){if(this.built)return;this.built=!0,this.smoke=new FS(this.puffsSmoke,!1),this.fire=new FS(this.puffsFire,!0),this.group.add(this.smoke.mesh,this.fire.mesh);let e=[Yl(.96,1.16,.96,.04),Yl(1.96,.38,.96,.04),Yl(1.96,.38,1.96,.04),$l(.48,.38,.04,12)],t=[0,0,0,0];for(let e of this.pieces)t[e.shape]++;let n=new aa({color:16777215,roughness:.45,roughnessMap:hu(),clearcoat:.5,clearcoatRoughness:.15});e.forEach((e,r)=>{let i=new Y({tint:0});i.add(`white`,e),r===0&&i.studs(`white`,-.5,1.45,-.5,1,1),r===1&&i.studs(`white`,-1,.475,-.5,2,1);let a=i.build(`debris`).group.children[0].geometry,o=new Gr(a,n,Math.max(1,t[r]));o.count=0,o.frustumCulled=!1,o.instanceMatrix.setUsage(He),o.castShadow=!0,this.debris.push(o),this.group.add(o)});let r=Math.max(1,this.sparks.length),i=new lr,a=new Float32Array(r*3),o=new Float32Array(r*3),s=new Float32Array(r*3);this.sparks.forEach((e,t)=>{a.set([e.from.x,e.from.y,e.from.z],t*3),o.set([e.vel.x,e.vel.y,e.vel.z],t*3),s.set([e.t0,e.life,e.size],t*3)}),this.sparks.length||s.set([-100,.001,0],0),i.setAttribute(`position`,new Jn(a,3)),i.setAttribute(`aVel`,new Jn(o,3)),i.setAttribute(`aPar`,new Jn(s,3)),this.sparkMat=new na({transparent:!0,depthWrite:!1,blending:2,uniforms:{uTime:{value:0},uScale:{value:1}},vertexShader:`
        attribute vec3 aVel; attribute vec3 aPar; uniform float uTime; uniform float uScale; varying float vA;
        void main(){
          float age = uTime - aPar.x;
          if (age < 0.0 || age > aPar.y) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vA = 0.0; return; }
          vA = 1.0 - age / aPar.y;
          vec3 p = position + aVel * age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aPar.z * uScale * (0.4 + vA);
        }`,fragmentShader:`
        varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d) * 14.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.72, 0.35) * a * 8.0, 1.0); }`}),this.sparkPts=new ti(i,this.sparkMat),this.sparkPts.frustumCulled=!1,this.sparkPts.renderOrder=7,this.group.add(this.sparkPts)}update(e,t=1){this.built||this.build(),this.lasers.update(e),this.fire.mat.uniforms.uTime.value=e,this.smoke.mat.uniforms.uTime.value=e,this.sparkMat.uniforms.uTime.value=e,this.sparkMat.uniforms.uScale.value=t;let n=[0,0,0,0],r=new G,i=new ut,a=new U,o=new U;for(let t of this.pieces){let s=e-t.t0;if(s<0||s>t.life)continue;let c=this.debris[t.shape],l=n[t.shape]++;a.copy(t.vel).multiplyScalar(s*(1-s*.06)).add(t.from),i.setFromAxisAngle(t.axis,t.spin*s);let u=t.scale*Math.min(1,(t.life-s)/.4);o.set(u,u,u),r.compose(a,i,o),c.setMatrixAt(l,r),c.setColorAt(l,t.color)}this.debris.forEach((e,t)=>{e.count=n[t],e.instanceMatrix.needsUpdate=!0,e.instanceColor&&(e.instanceColor.needsUpdate=!0)})}};function LS(e=`blue`,t={}){let n=t.length??4.6,r=new sn;r.name=`lightsaber`;let i=new Y({seed:9}),a=Xl([[0,.78],[.13,.78],[.15,.72],[.15,.5],[.12,.47],[.12,-.55],[.14,-.58],[.14,-.72],[.1,-.78],[0,-.78]],40);i.lathe(`flatSilver`,a,{radial:20});for(let e=0;e<6;e++)i.cyl(`black`,0,-.4+e*.13,0,.13,.06,{radial:20,c:.01});i.box(`black`,.13,.62,0,.06,.14,.08,{c:.01}),i.cyl(`glowRed`,.12,.35,0,.025,.05,{axis:`x`,radial:8,c:.005}),r.add(i.build(`hilt`).group);let o=new on;o.position.y=.78,r.add(o);let s=Ql(Xl([[0,1],[.6,.97],[.95,.9],[1,.8],[1,0],[.9,-.02],[0,-.02]],50),16),c=new lr;c.setAttribute(`position`,new Jn(s.pos,3)),c.setAttribute(`normal`,new Jn(s.nrm,3));let l=e===`blue`?new K(.25,.55,1):new K(.3,1,.35),u=new Nr(c,new xr({color:new K(1,1,1).lerp(l,.15).multiplyScalar(10),toneMapped:!1}));u.scale.set(.085,n,.085);let d=new Nr(c,new xr({color:l.clone().multiplyScalar(4),transparent:!0,opacity:.5,blending:2,depthWrite:!1,toneMapped:!1}));d.scale.set(.2,n*1.03,.2),d.renderOrder=5;let f=new Nr(c,new xr({color:l.clone().multiplyScalar(1.4),transparent:!0,opacity:.35,blending:2,depthWrite:!1,toneMapped:!1}));return f.scale.set(.42,n*1.06,.42),f.renderOrder=5,o.add(u,d,f),{group:r,blade:o,setIgnite(e,t=0){let n=Math.max(1e-4,e);o.visible=e>.001,o.scale.set(1+t*.06,n,1+t*.06)}}}function RS(e,t=!1){let n=e[0].index!==null,r=new Set(Object.keys(e[0].attributes)),i=new Set(Object.keys(e[0].morphAttributes)),a={},o={},s=e[0].morphTargetsRelative,c=new lr,l=0;for(let u=0;u<e.length;++u){let d=e[u],f=0;if(n!==(d.index!==null))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.`),null;for(let e in d.attributes){if(!r.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure "`+e+`" attribute exists among all geometries, or in none of them.`),null;a[e]===void 0&&(a[e]=[]),a[e].push(d.attributes[e]),f++}if(f!==r.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of attributes.`),null;if(s!==d.morphTargetsRelative)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. .morphTargetsRelative must be consistent throughout all geometries.`),null;for(let e in d.morphAttributes){if(!i.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`.  .morphAttributes must be consistent throughout all geometries.`),null;o[e]===void 0&&(o[e]=[]),o[e].push(d.morphAttributes[e])}if(t){let e;if(n)e=d.index.count;else if(d.attributes.position!==void 0)e=d.attributes.position.count;else return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. The geometry must have either an index or a position attribute`),null;c.addGroup(l,e,u),l+=e}}if(n){let t=0,n=[];for(let r=0;r<e.length;++r){let i=e[r].index;for(let e=0;e<i.count;++e)n.push(i.getX(e)+t);t+=e[r].attributes.position.count}c.setIndex(n)}for(let e in a){let t=zS(a[e]);if(!t)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` attribute.`),null;c.setAttribute(e,t)}for(let e in o){let t=o[e][0].length;if(t!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[e]=[];for(let n=0;n<t;++n){let t=[];for(let r=0;r<o[e].length;++r)t.push(o[e][r][n]);let r=zS(t);if(!r)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` morphAttribute.`),null;c.morphAttributes[e].push(r)}}}return c}function zS(e){let t,n,r,i=-1,a=0;for(let o=0;o<e.length;++o){let s=e[o];if(t===void 0&&(t=s.array.constructor),t!==s.array.constructor)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.`),null;if(n===void 0&&(n=s.itemSize),n!==s.itemSize)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.`),null;if(r===void 0&&(r=s.normalized),r!==s.normalized)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.`),null;if(i===-1&&(i=s.gpuType),i!==s.gpuType)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.`),null;a+=s.count*n}let o=new t(a),s=new Jn(o,n,r),c=0;for(let t=0;t<e.length;++t){let r=e[t];if(r.isInterleavedBufferAttribute){let e=c/n;for(let t=0,i=r.count;t<i;t++)for(let i=0;i<n;i++){let n=r.getComponent(t,i);s.setComponent(t+e,i,n)}}else o.set(r.array,c);c+=r.count*n}return i!==void 0&&(s.gpuType=i),s}function BS(e){e.updateMatrixWorld(!0);let t=new G().copy(e.matrixWorld).invert(),n=new Map;e.traverse(r=>{let i=r;if(!i.isMesh||!i.visible)return;let a=!0;for(let t=r;t&&t!==e;t=t.parent)t.visible||(a=!1);if(!a)return;let o=Array.isArray(i.material)?i.material[0]:i.material,s=i.geometry.index?i.geometry.toNonIndexed():i.geometry.clone();s.applyMatrix4(new G().multiplyMatrices(t,i.matrixWorld));for(let e of Object.keys(s.attributes))[`position`,`normal`,`uv`,`color`].includes(e)||s.deleteAttribute(e);if(!s.getAttribute(`color`)){let e=s.getAttribute(`position`).count,t=new Float32Array(e*3).fill(1);s.setAttribute(`color`,new(s.getAttribute(`position`)).constructor(t,3))}if(!s.getAttribute(`uv`)){let e=s.getAttribute(`position`).count;s.setAttribute(`uv`,new(s.getAttribute(`position`)).constructor(new Float32Array(e*2),2))}let c=n.get(o);c||n.set(o,c=[]),c.push(s)});let r=[];for(let[e,t]of n){let n=RS(t,!1);n&&(n.computeBoundingSphere(),r.push({material:e,geometry:n}))}return r}var VS=class{group=new sn;meshes=[];count;constructor(e,t,n){this.count=t,this.group.name=n;for(let n of BS(e)){let e=new Gr(n.geometry,n.material,t);e.frustumCulled=!1,e.castShadow=!1,e.receiveShadow=!0,this.meshes.push(e),this.group.add(e)}}set(e,t){for(let n of this.meshes)n.setMatrixAt(e,t)}commit(e=this.count){for(let t of this.meshes)t.count=e,t.instanceMatrix.needsUpdate=!0}},HS=[`Episode III`,`REVENGE OF THE SITH`],US=[`War! The Republic is crumbling under the attacks of the Separatist droid armies, led by the Sith Lord Count Dooku.`,`In a bold strike, the fiendish droid commander General Grievous has swept into the Republic capital and seized Supreme Chancellor Palpatine.`,`As the droid fleet tries to flee the besieged planet with its prisoner, two Jedi Knights lead a desperate mission to rescue the Chancellor....`],WS=class{group=new sn;plane;mat;constructor(){this.group.name=`crawl`;let e=1024,t=2200,n=document.createElement(`canvas`);n.width=e,n.height=t;let r=n.getContext(`2d`);r.fillStyle=`#000`,r.clearRect(0,0,e,t),r.fillStyle=`#f2c230`,r.textAlign=`center`,r.font=`600 64px "Source Sans 3", Inter, Arimo, sans-serif`,r.fillText(HS[0],e/2,120),r.font=`800 104px "Source Sans 3", Inter, Arimo, sans-serif`,r.fillText(HS[1],e/2,250),r.font=`600 64px "Source Sans 3", Inter, Arimo, sans-serif`;let i=400;for(let e of US){let t=e.split(` `),n=[],a=[];for(let e of t){let t=[...a,e].join(` `);r.measureText(t).width>934&&a.length?(n.push(a),a=[e]):a.push(e)}a.length&&n.push(a),n.forEach((e,t)=>{if(t===n.length-1||e.length===1)r.textAlign=`left`,r.fillText(e.join(` `),45,i);else{let t=(934-e.reduce((e,t)=>e+r.measureText(t).width,0))/(e.length-1),n=45;r.textAlign=`left`;for(let a of e)r.fillText(a,n,i),n+=r.measureText(a).width+t}i+=84}),i+=84*.9}let a=new ii(n);a.colorSpace=Ie,a.anisotropy=16,this.mat=new xr({map:a,transparent:!0,depthWrite:!1,side:2,toneMapped:!1}),this.plane=new Nr(new Ki(1,t/e),this.mat),this.plane.renderOrder=10,this.group.add(this.plane)}},GS=new U(.55,.62,-.38).normalize(),KS=new U(.62,.21,-.45).normalize(),qS=1e5,JS=new U(0,-104e3,0);function YS(e,t){e.updateMatrixWorld(!0);let n=e.matrixWorld.clone().invert();return t.updateWorldMatrix(!0,!1),new U().setFromMatrixPosition(t.matrixWorld).applyMatrix4(n)}var XS=class{scene=new hn;camera=new Ba(30,2.39,.05,3e6);sun;rim;hemi;hangarLights=new sn;envSpace;envHangar;nebula;stars;planet;fx=new IS;crawl=new WS;venator;fleet=[];hand;munis=[];anakinShip;obiwanShip;anakin;obiwan;r2;r4;sabers;vultures=[];arcs=[];vultureSwarm;arcSwarm;triSwarm;crawlers=[];missiles=[];buzz=[];hangar;droids=[];actors=[];loc={muzzlesA:[],muzzlesO:[],socketA:new U,socketO:new U,zapA:new U,cockpitA:new U,cockpitO:new U};constructor(e){let t=e.renderer,n=this.scene;this.envSpace=bS(t,xS([GS.x,GS.y,GS.z])),this.envHangar=bS(t,SS),this.nebula=wS(t,{size:512,strength:.9}),this.stars=TS({count:11e3}),n.add(this.stars),this.planet=OS({radius:qS,center:JS,sunDir:KS}),n.add(this.planet.group),this.sun=new Ga(16773600,3.1),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(2048,2048),this.sun.shadow.bias=-3e-4,this.sun.shadow.radius=2.5,this.sun.layers.enableAll(),n.add(this.sun,this.sun.target),this.rim=new Ga(10273023,.9),this.rim.position.copy(new U(-.6,.15,.75)),this.rim.layers.enableAll(),n.add(this.rim,this.rim.target),this.hemi=new Oa(1911365,6981304,.55),this.hemi.layers.enableAll(),n.add(this.hemi);let r=(e,t,n,r,i,a=160)=>{let o=new Ha(e,t,a,1.6);o.position.set(n,r,i),o.layers.enableAll(),this.hangarLights.add(o)};r(16773336,900,-40,34,-20),r(16773336,900,40,34,-20),r(5941503,700,0,18,58,140),r(16738874,260,-80,10,-40,90),n.add(this.hangarLights),this.venator=_h({lod:0,seed:1}),this.venator.group.name=`hero-venator`,n.add(this.venator.group);for(let[e,t,r,i,a]of[[`venator`,-5200,-700,7e3,.05],[`venator`,5600,400,3e3,-.08],[`venator`,2600,-1500,11500,.1],[`venator`,-7400,900,-2e3,.12],[`venator`,9e3,-1100,15e3,-.05],[`venator`,-3e3,1500,19e3,.2],[`muni`,3600,-1900,16500,3.3],[`muni`,-4200,-1300,13200,3],[`muni`,8200,400,21500,3.4],[`muni`,-8800,-400,24e3,2.9]]){let o=Math.hypot(t,i)>14e3,s=e===`muni`&&this.munis.length===0?1:o?2:1,c=e===`venator`?_h({lod:s,seed:Math.floor(t)}):Vb({lod:s,seed:Math.floor(i)});c.group.position.set(t,r,i),c.group.rotation.y=a,n.add(c.group),this.fleet.push({root:c.group,kind:e}),e===`muni`&&this.munis.push(c)}this.hand=Lx({lod:0}),n.add(this.hand.group),this.anakinShip=Rd({variant:`anakin`,lod:0}),this.obiwanShip=Rd({variant:`obiwan`,lod:0}),this.anakin=Qf(),this.obiwan=$f(),this.r2=df({variant:`r2d2`,socket:!0}),this.r4=df({variant:`r4p17`,socket:!0}),this.anakinShip.astromechAnchor.add(this.r2.group),this.obiwanShip.astromechAnchor.add(this.r4.group),n.add(this.anakinShip.group,this.obiwanShip.group),this.sabers=[LS(`blue`),LS(`blue`)],this.anakinShip.setFoils(1),this.obiwanShip.setFoils(1),this.loc.muzzlesA=this.anakinShip.muzzles.map(e=>YS(this.anakinShip.group,e)),this.loc.muzzlesO=this.obiwanShip.muzzles.map(e=>YS(this.obiwanShip.group,e)),this.loc.socketA=YS(this.anakinShip.group,this.anakinShip.astromechAnchor),this.loc.socketO=YS(this.obiwanShip.group,this.obiwanShip.astromechAnchor),this.loc.zapA=YS(this.anakinShip.group,this.r2.zapAnchor),this.loc.cockpitA=YS(this.anakinShip.group,this.anakinShip.cockpitAnchor),this.loc.cockpitO=YS(this.obiwanShip.group,this.obiwanShip.cockpitAnchor);for(let e=0;e<8;e++){let t=y_({lod:0,seed:e+1});n.add(t.group),this.vultures.push(t)}for(let e=0;e<10;e++){let t=y_({lod:1,seed:50+e});t.setMode(1),n.add(t.group),this.crawlers.push(t)}for(let e=0;e<4;e++){let e=rg({lod:0});n.add(e.group),this.arcs.push(e)}let i=y_({lod:1,seed:99});this.vultureSwarm=new VS(i.group,60,`vulture-swarm`);let a=rg({lod:1});this.arcSwarm=new VS(a.group,24,`arc-swarm`);let o=U_({lod:1});this.triSwarm=new VS(o.group,16,`tri-swarm`),n.add(this.vultureSwarm.group,this.arcSwarm.group,this.triSwarm.group);for(let e=0;e<2;e++){let e=cv();n.add(e.group),this.missiles.push(e)}for(let e=0;e<6;e++){let t=Vv({seed:e+1});n.add(t.group),this.buzz.push(t)}this.hangar=dS(),n.add(this.hangar.group);let s=[`commander`,`standard`,`standard`,`security`,`standard`,`pilot`,`standard`];for(let e=0;e<s.length;e++){let t=cy({variant:s[e],seed:e+3});n.add(t.group),this.droids.push(t)}n.add(this.crawl.group),n.add(this.fx.group),this.actors=[this.venator.group,...this.fleet.map(e=>e.root),this.hand.group,this.anakinShip.group,this.obiwanShip.group,...this.vultures.map(e=>e.group),...this.crawlers.map(e=>e.group),...this.arcs.map(e=>e.group),this.vultureSwarm.group,this.arcSwarm.group,this.triSwarm.group,...this.missiles.map(e=>e.group),...this.buzz.map(e=>e.group),this.hangar.group,...this.droids.map(e=>e.group),this.crawl.group,this.anakin.group,this.obiwan.group,...this.sabers.map(e=>e.group)],this.space()}reset(){for(let e of this.actors)e.visible=!1;this.fx.group.visible=!0}space(){this.scene.environment=this.envSpace,this.scene.background=this.nebula,this.stars.visible=!0,this.planet.group.visible=!0,this.sun.intensity=3.1,this.sun.color.set(16773600),this.rim.intensity=.9,this.hemi.intensity=.55,this.hemi.color.set(1911365),this.hemi.groundColor.set(6981304),this.hangarLights.visible=!1}interior(){this.scene.environment=this.envHangar,this.scene.background=this.nebula,this.stars.visible=!0,this.planet.group.visible=!0,this.sun.intensity=1.2,this.sun.color.set(16769728),this.rim.intensity=.25,this.hemi.intensity=.35,this.hemi.color.set(7168600),this.hemi.groundColor.set(2762274),this.hangarLights.visible=!0}aimShadow(e,t,n=GS){this.sun.position.copy(n).multiplyScalar(t*6).add(e),this.sun.target.position.copy(e);let r=this.sun.shadow.camera;r.left=-t,r.right=t,r.top=t,r.bottom=-t,r.near=t*2,r.far=t*12,r.updateProjectionMatrix(),this.sun.shadow.normalBias=t*.0015,this.sun.target.updateMatrixWorld()}seat(e,t){e.group.parent!==t.cockpitAnchor&&t.cockpitAnchor.add(e.group),e.group.position.set(0,0,0),e.group.quaternion.identity(),e.group.visible=!0,e.seated()}stand(e,t,n){e.group.parent!==this.scene&&this.scene.add(e.group),e.group.position.set(t.x,t.y+1.25,t.z),e.group.quaternion.setFromAxisAngle(new U(0,1,0),n),e.group.visible=!0}};new G,new ut,new K;var $=(e,t,n)=>new U(e,t,n),ZS=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),QS=(e,t,n)=>{let r=ZS((n-e)/(t-e));return r*r*(3-2*r)},$S=(e,t,n)=>{let r=ZS((n-e)/(t-e));return r*r*r*(r*(r*6-15)+10)},eC=(e,t,n)=>e+(t-e)*n;function tC(e,t,n=new U){let r=e.length;if(t<=e[0][0]){let r=e[0],i=e[1],a=(t-r[0])/(i[0]-r[0]);return n.set(r[1]+(i[1]-r[1])*a,r[2]+(i[2]-r[2])*a,r[3]+(i[3]-r[3])*a)}if(t>=e[r-1][0]){let i=e[r-2],a=e[r-1],o=(t-i[0])/(a[0]-i[0]);return n.set(i[1]+(a[1]-i[1])*o,i[2]+(a[2]-i[2])*o,i[3]+(a[3]-i[3])*o)}let i=0;for(;i<r-2&&t>e[i+1][0];)i++;let a=e[Math.max(0,i-1)],o=e[i],s=e[i+1],c=e[Math.min(r-1,i+2)],l=s[0]-o[0],u=(t-o[0])/l,d=u*u,f=d*u,p=2*f-3*d+1,m=f-2*d+u,h=-2*f+3*d,g=f-d,_=[0,0,0];for(let e=1;e<=3;e++){let t=o===a?s[e]-o[e]:(s[e]-a[e])/(s[0]-a[0])*l,n=c===s?s[e]-o[e]:(c[e]-o[e])/(c[0]-o[0])*l;_[e-1]=p*o[e]+m*t+h*s[e]+g*n}return n.set(_[0],_[1],_[2])}function nC(e,t,n={}){let r=n.dt??1/30,i=e(t-r),a=e(t),o=e(t+r),s=o.clone().sub(i).divideScalar(2*r),c=o.clone().add(i).sub(a.clone().multiplyScalar(2)).divideScalar(r*r),l=s.clone().normalize(),u=n.worldUp??new U(0,1,0),d=c.clone().sub(l.clone().multiplyScalar(c.dot(l))),f=u.clone().cross(l).normalize(),p=d.dot(f),m=Math.atan2(p,400)*(n.bank??1)+(n.extraRoll??0),h=l.clone().cross(f).normalize().clone().applyAxisAngle(l,-m);return{pos:a,quat:rC(l,h),vel:s,fwd:l,up:h}}function rC(e,t){let n=e.clone().normalize(),r=t.clone().cross(n).normalize(),i=n.clone().cross(r).normalize();return new ut().setFromRotationMatrix(new G().makeBasis(r,i,n))}function iC(e,t){e.position.copy(t.pos),e.quaternion.copy(t.quat)}function aC(e,t,n=1,r=0){return new U(lu(e*n*3.1,r+1)+.5*lu(e*n*7.3,r+4),lu(e*n*2.7,r+2)+.5*lu(e*n*6.1,r+5),lu(e*n*2.3,r+3)*.5).multiplyScalar(t)}function oC(e,t,n,r){return new U(t,n,r).applyQuaternion(e.quat).add(e.pos)}function sC(e,t,n,r,i=[`talk`,`open`,`talk`,`o`]){if(e<t||e>n)return r;let a=Math.floor((e-t)*9.5+lu(e*3,7)*1.5);return a%3==2?r:i[(a%i.length+i.length)%i.length]}function cC(e,t){let n=2.6+t%3*.7,r=(e+t*.37)%n;return r<.12?Math.sin(r/.12*Math.PI):0}function lC(e,t,n,r){e.setFace({mouth:`flat`,brows:0,lookX:0,lookY:0,squint:0,...t,blink:t.blink??cC(n,r)})}function uC(e,t,n,r,i=1){t.group.visible=!0,iC(t.group,n),t.setFoils(r),t.setEngine(i);let a=t===e.anakinShip?e.anakin:e.obiwan;e.seat(a,t)}function dC(e){return e.updateWorldMatrix(!0,!1),new U().setFromMatrixPosition(e.matrixWorld)}var fC=19.5,pC=e=>$(0,0,40*(e-fC));function mC(e,t,n={}){e.venator.group.visible=(n.fleet??!0)&&(n.hero??!1),e.venator.group.position.copy(pC(t)),e.venator.group.rotation.set(0,0,0);for(let t of e.fleet)t.root.visible=n.fleet??!0;if(n.swarms??!0){let n=new G;new au(77);let r=[$(900,-700,9e3),$(-1800,-300,13e3),$(2400,-1200,17e3),$(-600,-1500,21e3),$(3200,200,6e3),$(-2800,400,4e3)],i=(e,i,a,o)=>{e.group.visible=!0;let s=new au(a);for(let a=0;a<i;a++){let i=r[a%r.length],c=s.range(120,520),l=s.range(.25,.6)*(s.chance(.5)?1:-1)*o,u=s.range(0,Math.PI*2),d=s.range(-.7,.7),f=nC(e=>{let t=u+l*e;return $(i.x+Math.cos(t)*c,i.y+Math.sin(t*1.3)*c*.35+Math.sin(t)*c*d,i.z+Math.sin(t)*c+20*e)},t,{bank:1.4});n.compose(f.pos,f.quat,$(1,1,1)),e.set(a,n)}e.commit(i)};i(e.vultureSwarm,60,11,1),i(e.arcSwarm,24,12,.8),i(e.triSwarm,16,13,1.2)}}function hC(e,t,n){let r=new au(2024),i=[e.venator.group,...e.fleet.filter(e=>e.kind===`venator`).map(e=>e.root)],a=[...e.fleet.filter(e=>e.kind===`muni`).map(e=>e.root),e.hand.group],o=(t,n)=>{let r=t.position.clone();return t===e.venator.group&&r.copy(pC(n)),r};for(let s=t;s<n;s+=r.range(.02,.06)){let t=r.chance(.55),n=t?r.pick(i):r.pick(a),c=t?r.pick(a):r.pick(i),l=o(n,s).add($(r.range(-600,600),r.range(-100,250),r.range(-1200,1200))),u=o(c,s).add($(r.range(-500,500),r.range(-200,200),r.range(-900,900))).clone().sub(l),d=u.length(),f=3200;e.fx.laser({t0:s,from:l,dir:u,speed:f,life:Math.min(d/f,6),length:r.range(120,220),width:r.range(9,14),color:t?`blue`:`red`})}for(let s=t;s<n;s+=r.range(.25,.6)){let t=o(r.chance(.5)?r.pick(a):r.pick(i),s).add($(r.range(-500,500),r.range(-150,150),r.range(-1e3,1e3)));e.fx.explosion(s,t,{size:r.range(60,140),pieces:10,brickScale:7,sparks:10,smoke:3,colors:[`lbg`,`dbg`,`white`,`tan`],seed:Math.floor(s*100)})}}var gC={name:`farfar`,dur:4.5,card:!0,pose:()=>({pos:$(0,0,0),target:$(0,0,1),fov:30})},_C=$(-120,1150,-2950),vC=$(-120,1150+1e3*Math.tan(64*Math.PI/180),-1950),yC={name:`crawl`,dur:15,pose(e,t,n){mC(e,n,{swarms:!1,hero:!0}),e.crawl.group.visible=!0;let r=_C.clone(),i=vC.clone().sub(_C).normalize(),a=rC(i.clone().negate(),$(0,1,0)),o=new ut().setFromAxisAngle($(1,0,0),-70*Math.PI/180),s=e.crawl.group;s.quaternion.copy(a).multiply(o),s.scale.setScalar(30);let c=-22+t*3.1,l=r.clone().add(i.clone().multiplyScalar(48)).add($(0,-16,0)),u=$(0,1,0).applyQuaternion(s.quaternion);return s.position.copy(l).add(u.multiplyScalar(c)),e.crawl.mat.opacity=QS(0,1.2,t)*(1-QS(12.5,15,t)),{pos:r,target:vC,fov:38,lens:{bloom:.5,vignette:.3}}}},bC=[[2.5,90,1520,-3480],[3.5,20,1190,-2990],[4.5,0,700,-2200],[5.6,0,335,-1330],[6.5,0,274,-930],[7.3,0,232,-560],[8.2,0,112,-200],[9.2,0,92,200],[10.3,10,74,600],[11.2,70,64,900],[12,190,38,1090],[12.8,300,-60,1270],[13.7,380,-260,1510],[14.8,420,-520,1910],[16.5,430,-760,2700]],xC=$(-30,5,-14);function SC(e,t){return e=>{let n=e-fC,r=tC(bC,t===`anakin`?n:n-.18);return t===`obiwan`&&r.add(xC.clone().multiplyScalar(1-.35*QS(11,13,n))),r.add(pC(e))}}function CC(e,t=.35){return rC($(e.x,e.y*t,e.z).normalize(),$(0,1,0))}var wC={name:`longtake`,blur:2,dur:16,schedule(e,t){let n=new au(31);for(let r=11.8;r<16;r+=n.range(.14,.3)){let i=nC(SC(t+r,`anakin`),t+r),a=oC({pos:i.pos,quat:CC(i.fwd)},n.range(-260,260),n.range(-140,160),n.range(250,900));e.fx.explosion(t+r,a,{size:n.range(12,28),pieces:14,sparks:16,smoke:3,colors:[`dbg`,`lbg`,`black`],seed:Math.floor(r*97)})}},pose(e,t,n){mC(e,n,{hero:!0});let r=nC(SC(n,`anakin`),n,{bank:1.3}),i=nC(SC(n,`obiwan`),n,{bank:1.3});t>2.3&&(uC(e,e.anakinShip,r,0,1),uC(e,e.obiwanShip,i,0,1),lC(e.anakin,{mouth:`smirk`,brows:-.3},t,1),lC(e.obiwan,{mouth:`flat`,brows:.3},t,2));let a=pC(n),o=$S(0,4.2,t),s=$(0,120,-900).add(pC(23.7)),c=_C.clone(),l=vC.clone().lerp(s,o),u=$S(4.2,6.2,t);if(u>0){let e=n-.12,t=nC(SC(e,`anakin`),e),a=nC(SC(e,`obiwan`),e),o=oC({pos:t.pos.clone().lerp(a.pos,.5),quat:CC(t.fwd)},0,30,-104);c=c.lerp(o,u);let s=r.pos.clone().lerp(i.pos,.35).clone().add($(0,0,1).applyQuaternion(CC(r.fwd)).multiplyScalar(90));l=l.lerp(s,u)}let d=$S(11,13.4,t);if(d>0){let e=CC(r.fwd,.25),t=oC({pos:r.pos.clone().lerp(i.pos,.4),quat:e},44,34,-88);c=c.lerp(t,d);let n=r.pos.clone().add($(0,0,1).applyQuaternion(e).multiplyScalar(340)).add($(0,-30,0));l=l.lerp(n,d)}return c.add(aC(t,u*.8,1.3,3)),e.aimShadow(u>.5?r.pos:a.clone().add($(0,150,-900)),u>.5?70:1800),{pos:c,target:l,fov:eC(34,38,u)+d*4,roll:-.1*d*(1-QS(14,16,t)),lens:{exposure:1}}}},TC={start:$(640,-1080,4250),speed:330};function EC(e,t){return n=>{let r=n-t,i=TC.start.clone().add($(Math.sin(r*.9)*14,Math.sin(r*.6)*10-r*12,r*TC.speed));return e===`obiwan`&&i.add($(-22+Math.sin(r*1.1+1)*5,7,-30)),i}}var DC={name:`track`,blur:2,dur:5,schedule(e,t){e.munis[0];let n=$(3900,-1500,7600),r=new au(5);[.7,1.3,1.9,2.4,3,3.4].forEach((i,a)=>{let o=n.clone().add($(r.range(-250,250),r.range(-300,350),r.range(-700,700)));e.fx.explosion(t+i,o,{size:150+a*30,pieces:26,brickScale:7,sparks:20,smoke:5,colors:[`tan`,`darkTan`,`lbg`,`reddishBrown`],seed:300+a,flashes:2})}),e.fx.explosion(t+3.9,n.clone().add($(0,50,0)),{size:520,pieces:90,brickScale:8,sparks:60,smoke:10,colors:[`tan`,`darkTan`,`lbg`,`reddishBrown`,`dbg`],seed:399,flashes:3});for(let n=.2;n<5;n+=r.range(.18,.4)){let i=oC(nC(EC(`anakin`,t),t+n),r.range(-200,200),r.range(-120,140),r.range(-60,500));e.fx.explosion(t+n,i,{size:r.range(10,22),pieces:10,sparks:14,smoke:2,colors:[`dbg`,`black`,`lbg`],seed:Math.floor(n*131)})}for(let n=0;n<5;n+=r.range(.05,.12)){let i=oC(nC(EC(`anakin`,t),t+n),r.range(-900,900),r.range(-300,300),r.range(400,1400)),a=$(r.range(-1,1),r.range(-.3,.3),r.range(-1,.2));e.fx.laser({t0:t+n,from:i,dir:a,speed:1400,life:1.2,length:26,width:1.8,color:r.chance(.5)?`red`:`green`})}},pose(e,t,n){mC(e,n,{hero:!0});let r=n-t,i=e.munis[0];i.group.visible=t<4.05,i.group.position.set(3900,-1500,7600),i.group.rotation.set(.05,2.6,.1);let a=nC(EC(`anakin`,r),n,{bank:1}),o=nC(EC(`obiwan`,r),n,{bank:1}),s=QS(.2,1.1,t);uC(e,e.anakinShip,a,s),uC(e,e.obiwanShip,o,s),lC(e.anakin,{mouth:`grit`,brows:-.7},t,1),lC(e.obiwan,{mouth:`flat`,brows:.5},t,2);let c=a.pos.clone().lerp(o.pos,.5),l=oC({pos:c,quat:rC(a.fwd,$(0,1,0))},-34+t*2,7,14-t*3.5).add(aC(t,.8,1.1,9));return e.aimShadow(c,60),{pos:l,target:c.clone().add($(0,-2,6)),fov:30,lens:{exposure:1.05}}}};function OC(e){return{name:e.name,dur:e.dur,lines:e.lines,schedule:e.schedule,pose(t,n,r){mC(t,r);let i=e.who===`anakin`?t.anakinShip:t.obiwanShip,a=e.who===`anakin`?t.anakin:t.obiwan,o=$(e.who===`anakin`?300:200,-1400,9e3+r*30),s=e=>o.clone().add($(Math.sin(e*.7)*20,Math.sin(e*.5)*12,e*260)),c=nC(s,r,{bank:1.2});c.pos.add(aC(n,.12,3.5,e.who===`anakin`?21:22)),uC(t,i,c,1),uC(t,e.who===`anakin`?t.obiwanShip:t.anakinShip,nC(t=>s(t).add($(e.who===`anakin`?-40:40,12,-70)),r),1),lC(a,e.faceAt(n),n,e.who===`anakin`?1:2);let l=e.headAt?.(n)??{yaw:0,pitch:0};a.pose({legL:Math.PI/2,legR:Math.PI/2,armL:.95,armR:.95,splayL:.08,splayR:.08,headYaw:l.yaw,headPitch:l.pitch});let u=dC(i.cockpitAnchor).add($(0,2.5,0).applyQuaternion(c.quat)),d=e.camLocal??[1.8,3.4,7.6],f=oC(c,d[0],d[1],d[2]);t.aimShadow(u,8);let p=f.distanceTo(u);return{pos:f,target:u,fov:e.fov??24,near:.05,lens:{focus:p,aperture:9,exposure:1,bloom:1}}}}}function kC(e,t){return(n,r)=>{let i=new au(t);for(let a=0;a<5;a+=i.range(.12,.3)){let o=$(e===`anakin`?300:200,-1400,9e3+(r+a)*30).add($(0,0,(r+a)*260)).clone().add($(i.range(-300,300),i.range(-120,160),i.range(300,900)));n.fx.laser({t0:r+a,from:o,dir:$(i.range(-.5,.5),i.range(-.2,.2),-1),speed:900,life:1.5,length:22,width:1.4,color:i.chance(.6)?`red`:`green`}),i.chance(.35)&&n.fx.explosion(r+a,o.clone().add($(0,0,200)),{size:i.range(18,40),pieces:8,sparks:10,smoke:2,seed:Math.floor(a*71+t)})}}}var AC=OC({name:`anakin-cockpit`,dur:4,who:`anakin`,lines:[{t0:1,t1:3.4,who:`Anakin Skywalker`,text:`This is where the fun begins.`}],faceAt:e=>({mouth:sC(e,1.05,2.9,e<1?`grit`:`smirk`),brows:e<1?-.8:-.35,squint:e<1?.25:.1,lookX:e<.9?.02:0}),headAt:e=>({yaw:.25-QS(.6,1.3,e)*.35,pitch:-.05}),schedule:kC(`anakin`,41)}),jC={name:`vultures`,blur:2,dur:5,schedule(e,t){let n=MC(t),r=new au(55);for(let i=.9;i<2.6;i+=.11){let a=nC(n,t+i);e.loc.muzzlesA.forEach((n,o)=>{let s=oC(a,n.x,n.y,n.z+.6);e.fx.laser({t0:t+i+o*.05,from:s,dir:a.fwd.clone().add($(r.range(-.02,.02),r.range(-.02,.02),0)),speed:1500,life:.9,length:9,width:.8,color:`red`})})}for(let[n,r]of[[0,1.55],[2,2.35]]){let i=NC(n,t+r,t);e.fx.explosion(t+r,i,{size:16,pieces:45,sparks:40,smoke:5,colors:[`tan`,`darkTan`,`reddishBrown`,`dbg`,`black`],seed:500+n,inherit:$(0,0,-120)})}for(let i=.3;i<3.5;i+=r.range(.08,.16)){let a=r.int(0,5);if(a===0&&i>1.55||a===2&&i>2.35)continue;let o=NC(a,t+i,t),s=nC(n,t+i).pos.clone().add($(r.range(-30,30),r.range(-20,20),r.range(-40,40)));e.fx.laser({t0:t+i,from:o,dir:s.sub(o),speed:1300,life:1.2,length:9,width:.9,color:`red`})}},pose(e,t,n){mC(e,n);let r=n-t,i=MC(r),a=nC(i,n,{bank:1.2,extraRoll:QS(2.8,3.4,t)*(1-QS(3.6,4.4,t))*Math.PI*2*0+(t>2.8&&t<4.2?$S(2.8,4.2,t)*Math.PI*2:0)});uC(e,e.anakinShip,a,1);let o=nC(e=>i(e).add($(-38,14,-60)),n,{bank:1.2});uC(e,e.obiwanShip,o,1),lC(e.anakin,{mouth:`grit`,brows:-1},t,1);for(let i=0;i<6;i++){let a=e.vultures[i],o=i===0&&t>1.55||i===2&&t>2.35;if(a.group.visible=!o,o)continue;let s=nC(e=>NC(i,e,r),n,{bank:1.5});iC(a.group,s),a.setMode(0),a.animate?.(n)}for(let i=0;i<4;i++){let o=e.arcs[i];o.group.visible=t>2.2;let s=a.pos.clone().add($(700-i*30,60+i*18,500+i*40)),c=nC(e=>s.clone().add($(-(e-r-2.2)*520,0,(e-r)*180)),n);iC(o.group,c)}let s=oC({pos:a.pos,quat:rC(a.fwd,$(0,1,0))},-9,6.5,-36).add(aC(t,.8,1.6,12));return e.aimShadow(a.pos,40),{pos:s,target:a.pos.clone().add(a.fwd.clone().multiplyScalar(120)).add($(0,2,0)),fov:32,lens:{exposure:1.05}}}};function MC(e){let t=$(-400,-900,12e3);return n=>{let r=n-e;return t.clone().add($(Math.sin(r*.8)*25,Math.sin(r*.6)*15,r*300))}}function NC(e,t,n){let r=t-n,i=MC(n)(t),a=new au(900+e),o=a.range(-140,140),s=a.range(-70,90),c=1500-r*520+e*60;return i.clone().add($(o*(.4+r*.25)+Math.sin(r*2+e)*20,s*(.4+r*.2)+Math.cos(r*1.7+e)*14,c))}var PC=$(-900,-1700,27500);function FC(e){let t=e.hand.group;t.visible=!0,t.position.copy(PC),t.rotation.set(0,Math.PI/2+.45,0)}function IC(e,t){e.hand.group.updateMatrixWorld(!0);let n=Object.entries(e.hand.anchors).filter(([e])=>e.startsWith(`crawl`)).map(([,e])=>e),r=new ut;e.crawlers.forEach((e,i)=>{let a=n[i%Math.max(1,n.length)];if(!a)return;e.group.visible=!0,a.getWorldQuaternion(r);let o=i>=n.length?$(70,0,-55).applyQuaternion(r):$(0,0,0);e.group.position.copy(dC(a)).add(o),e.group.quaternion.copy(r).multiply(new ut().setFromAxisAngle($(0,1,0),i*2.39%(Math.PI*2))),e.group.scale.setScalar(2),e.setMode(1),e.setGait(t*5+i)})}var LC={name:`hand-reveal`,blur:2,dur:4.5,lines:[{t0:.4,t1:4.3,who:`Anakin Skywalker`,text:`The General's command ship is dead ahead — the one crawling with vulture droids.`}],pose(e,t,n){mC(e,n),FC(e),IC(e,n);let r=n-t,i=PC.clone().add($(-1250,560,-2350)),a=$(.28,-.07,1).normalize(),o=e=>i.clone().add(a.clone().multiplyScalar((e-r)*210)),s=nC(o,n,{bank:1}),c=nC(e=>o(e).add($(-30,8,-26)),n,{bank:1});uC(e,e.anakinShip,s,1),uC(e,e.obiwanShip,c,1),lC(e.anakin,{mouth:`smirk`,brows:-.3},t,1);let l=s.pos.clone().lerp(c.pos,.5),u=oC({pos:l,quat:rC(s.fwd,$(0,1,0))},24,30,-78).add(aC(t,.5,1,14)),d=PC.clone().add($(-150,120,-350)).lerp(l,.3);return e.aimShadow(l,60),{pos:u,target:d,fov:32,roll:.05,lens:{exposure:1.05}}}},RC=OC({name:`obiwan-cockpit`,dur:3.5,who:`obiwan`,lines:[{t0:.5,t1:3.2,who:`Obi-Wan Kenobi`,text:`Oh, I have a bad feeling about this.`}],faceAt:e=>({mouth:sC(e,.55,2.7,`frown`),brows:.85,lookX:e<1.8?-.015:.02,lookY:.005}),headAt:e=>({yaw:-.2+QS(1.6,2.4,e)*.35,pitch:.04}),camLocal:[-1.9,3.3,7.4],schedule:kC(`obiwan`,42)});function zC(e){let t=$(1200,-1200,22e3);return n=>{let r=n-e;return t.clone().add($(Math.sin(r*.9)*12,Math.sin(r*.7)*8,r*240))}}function BC(e,t){return n=>{let r=n-t,i=zC(t)(n),a=i.clone().add($(e?260:190,e?60:-40,900)),o=i.clone().add($(e?12:-8,e?7:3,26)),s=$S(0,1.9,r);return a.lerp(o,s)}}var VC=1.15,HC=e=>Math.abs(e)>5.5?.98+.384*(Math.abs(e)-5.5):.98,UC=[[5.8,HC(5.8)+VC,2.4],[8.2,HC(8.2)+VC,-3],[-6.2,HC(-6.2)+VC,1],[-8.6,HC(-8.6)+VC,-4],[2.2,2.75,6.2],[4.9,2.13,-7]],WC={name:`missiles`,blur:2,dur:4,lines:[{t0:2.3,t1:3.9,who:`Obi-Wan Kenobi`,text:`Buzz droids!`}],schedule(e,t){for(let n=0;n<2;n++){let r=BC(n,t)(t+1.9);e.fx.explosion(t+1.9,r,{size:5,pieces:6,sparks:30,smoke:2,colors:[`gunmetal`,`dbg`],seed:800+n})}},pose(e,t,n){mC(e,n);let r=n-t,i=nC(zC(r),n,{bank:1});uC(e,e.obiwanShip,i,1);let a=nC(e=>zC(r)(e).add($(-45,16,-80)),n);uC(e,e.anakinShip,a,1),lC(e.obiwan,{mouth:sC(t,2.35,3.5,`o`,[`shout`,`open`]),brows:.9,lookX:.02},t,2);for(let i=0;i<2;i++){let a=e.missiles[i];a.group.visible=t<2.05;let o=nC(BC(i,r),n);iC(a.group,o),a.setOpen(QS(1.55,1.95,t))}e.buzz.forEach((e,a)=>{let o=a%2,s=1.9+a*.07;if(e.group.visible=t>s,t<=s)return;let c=BC(o,r)(r+s),l=oC(i,...UC[a]),u=$S(s,s+.7,t);e.group.position.copy(c.lerp(l,u)),e.group.quaternion.copy(i.quat),e.group.scale.setScalar(1),e.setDeploy(QS(s+.4,s+.9,t)),e.animate(n+a)});let o=oC({pos:i.pos,quat:rC(i.fwd,$(0,1,0))},-16,6,-30).add(aC(t,.5,1.4,17));return e.aimShadow(i.pos,30),{pos:o,target:i.pos.clone().add(i.fwd.clone().multiplyScalar(25)),fov:30,lens:{exposure:1.05}}}},GC=2.55,KC={name:`buzz-close`,dur:4.5,schedule(e,t){for(let n=0;n<4;n++)e.fx.sparkStream(t+.1,t+4.4,r=>YC(e,n,r,t),()=>$(0,1,0),60,70+n,6);e.fx.explosion(t+GC,JC(e,t+GC,t),{size:1.6,pieces:6,sparks:50,smoke:2,colors:[`red`,`flatSilver`,`white`],seed:901})},pose(e,t,n){mC(e,n);let r=nC(qC(n-t),n,{bank:.6});r.pos.add(aC(t,.1,3,31)),uC(e,e.obiwanShip,r,1),lC(e.obiwan,{mouth:t>GC?`o`:`frown`,brows:.9,lookX:.03,lookY:-.01},t,2),e.obiwan.pose({legL:Math.PI/2,legR:Math.PI/2,armL:.95,armR:.95,splayL:.08,splayR:.08,headYaw:.45,headPitch:.1}),e.buzz.forEach((e,t)=>{e.group.visible=t===0||t===1||t===5,e.group.position.copy(oC(r,...UC[t]).add($(0,0,0))),e.group.quaternion.copy(r.quat),e.setDeploy(1),e.animate(n*1.3+t)});let i=e.r4,a=dC(e.obiwanShip.astromechAnchor),o=e.buzz[0],s=$S(.2,1.8,t);o.group.position.copy(oC(r,...UC[0]).lerp(a.clone().add($(1.6,.6,.4).applyQuaternion(r.quat)),s));let c=t-GC;c>0?(i.head.position.set(.4*c*3,1+c*6-c*c*2,-c*9),i.head.rotation.set(c*7,c*3,c*5)):(i.head.position.set(0,i.head.userData.baseY??i.head.position.y,0),i.head.userData.baseY??=i.head.position.y,i.head.rotation.set(0,Math.sin(n*6)*.4,0));let l=oC(r,12,5.5,9);return e.aimShadow(r.pos,16),{pos:l,target:a.clone().add($(-1.2,1.2,0).applyQuaternion(r.quat)),fov:28,near:.05,lens:{focus:l.distanceTo(a),aperture:7}}}};function qC(e){let t=$(1300,-1150,23500);return n=>t.clone().add($(Math.sin((n-e)*.8)*6,Math.sin((n-e)*.6)*4,(n-e)*200))}function JC(e,t,n){let r=nC(qC(n),t),i=e.loc.socketO;return oC(r,i.x,i.y+.9,i.z)}function YC(e,t,n,r){return oC(nC(qC(r),n),UC[t][0],UC[t][1]+.3,UC[t][2]+.8)}var XC=OC({name:`obiwan-cockpit-2`,dur:2.6,who:`obiwan`,lines:[{t0:.15,t1:2.5,who:`Obi-Wan Kenobi`,text:`Get out of here, Anakin! There's nothing more you can do.`}],faceAt:e=>({mouth:sC(e,.2,2.3,`frown`,[`shout`,`open`,`talk`]),brows:-.2,lookX:-.03}),headAt:()=>({yaw:-.5,pitch:.02}),camLocal:[-2.2,3.1,7.2]}),ZC=OC({name:`anakin-cockpit-2`,dur:2.6,who:`anakin`,lines:[{t0:.2,t1:2.5,who:`Anakin Skywalker`,text:`I'm not leaving without you, Master.`}],faceAt:e=>({mouth:sC(e,.25,2.2,`grit`),brows:-.9,squint:.2,lookX:.03}),headAt:()=>({yaw:.45,pitch:0}),camLocal:[2.4,3.2,7]});function QC(e){let t=$(1500,-1100,24500);return n=>t.clone().add($(Math.sin((n-e)*.7)*5,0,(n-e)*210))}var $C={name:`rescue`,blur:2,dur:4,schedule(e,t){let n=e=>QC(t)(e).add($(-30,6,-26));for(let r=.45;r<.8;r+=.1){let i=nC(n,t+r),a=oC(nC(QC(t),t+.85),...UC[3]);for(let n of e.loc.muzzlesA){let o=oC(i,n.x,n.y,n.z+.6);e.fx.laser({t0:t+r,from:o,dir:a.clone().sub(o),speed:900,life:a.distanceTo(o)/900,length:5,width:.6,color:`red`})}}let r=oC(nC(QC(t),t+.85),...UC[3]);e.fx.explosion(t+.85,r,{size:5,pieces:26,sparks:40,smoke:3,colors:[`flatSilver`,`dbg`,`lbg`],seed:1101,inherit:$(0,0,150)});let i=e.loc.zapA,a=e=>oC(nC(e=>QC(t)(e).add($(-30,6,-26)),e),i.x,i.y+.2,i.z+.3);e.fx.sparkStream(t+2,t+2.7,a,()=>$(.4,.6,.2),140,1102,4),e.fx.explosion(t+2.65,a(t+2.65).add($(1,1,0)),{size:1.4,pieces:5,sparks:30,smoke:1,colors:[`flatSilver`,`dbg`],seed:1103})},pose(e,t,n){mC(e,n);let r=n-t,i=nC(QC(r),n,{bank:.6}),a=nC(e=>QC(r)(e).add($(-30+QS(1.2,2,e-r)*12,6-QS(1.2,2,e-r)*3,-26+QS(1.2,2,e-r)*16)),n,{bank:.6});uC(e,e.obiwanShip,i,1),uC(e,e.anakinShip,a,1),e.r4.head.visible=!1,lC(e.anakin,{mouth:t<2?`grit`:`smirk`,brows:-.7},t,1),lC(e.obiwan,{mouth:`frown`,brows:.6},t,2),[1,2,3,5].forEach((r,a)=>{let o=e.buzz[r],s=r===3&&t>.85;o.group.visible=!s,o.group.position.copy(oC(i,...UC[r])),o.group.quaternion.copy(i.quat),o.setDeploy(1),o.animate(n+a)});let o=e.buzz[4];o.group.visible=!0,o.group.position.copy(oC(a,4.6,1.5,4.5)),o.group.quaternion.copy(a.quat),o.setDeploy(1),o.animate(n);let s=t-2.65;o.head.visible=!0,s>0?(o.head.position.set(s*2,.6+s*5-s*s*3,-s*8),o.head.rotation.set(s*9,s*4,0)):(o.head.position.set(0,o.head.userData.baseY??o.head.position.y,0),o.head.userData.baseY??=o.head.position.y,o.head.rotation.set(0,0,0)),e.r2.setHeadYaw(t>1.8?Math.sin(n*9)*.6:0);let c=i.pos.clone().lerp(a.pos,.5),l=oC(a,e.loc.zapA.x,e.loc.zapA.y,e.loc.zapA.z),u=c.clone().lerp(l,QS(1.4,2.2,t)*.8),d=oC({pos:c,quat:rC(i.fwd,$(0,1,0))},eC(-24,-12,QS(1.4,2.2,t)),eC(10,6,QS(1.4,2.2,t)),eC(30,16,QS(1.4,2.2,t))).add(aC(t,.35,1.2,19));return e.aimShadow(c,30),{pos:d,target:u,fov:30,lens:{exposure:1.05}}}},ew={name:`hangar-approach`,blur:2,dur:4,pose(e,t,n){mC(e,n,{swarms:!0}),FC(e),IC(e,n);let r=e.hand.anchors.hangar,i=r?dC(r):PC.clone().add($(0,0,-300)),a=r?$(0,0,1).applyQuaternion(r.getWorldQuaternion(new ut)):$(0,0,-1),o=$(0,1,0).cross(a).normalize(),s=t<2?1:t<2.45?Math.sin(t*90)>0?.7:.12:0;e.hand.setShield(s);let c=n-t,l=e=>{let t=ZS((e-c)/4,-.2,1.2);return i.clone().add(a.clone().multiplyScalar(eC(950,-70,$S(0,1,t)))).add(o.clone().multiplyScalar(eC(60,0,$S(0,.85,t)))).add($(0,eC(90,-2,$S(0,.85,t)),0))},u=nC(l,n,{bank:.8}),d=nC(e=>l(e-.3).add(o.clone().multiplyScalar(-16)).add($(0,5,0)),n,{bank:.8});uC(e,e.anakinShip,u,.3),uC(e,e.obiwanShip,d,.3),e.r4.head.visible=!1;let f=u.pos.clone().sub(i).dot(a),p=Math.max(f+58,26),m=i.clone().add(a.clone().multiplyScalar(p)).add(o.clone().multiplyScalar(eC(60,0,$S(0,.85,t/4))-10)).add($(0,u.pos.y-i.y+15,0)).add(aC(t,.35,1.2,23)),h=u.pos.clone().add(a.clone().multiplyScalar(-160)).add($(0,4,0));return e.aimShadow(u.pos,50),{pos:m,target:h,fov:36,lens:{exposure:1.05}}}};function tw(e){let t=e.hangar.group;return t.visible=!0,t.position.set(0,0,0),t.rotation.set(0,0,0),{A:e.hangar.anchors.landingA?dC(e.hangar.anchors.landingA):$(-30,0,0),B:e.hangar.anchors.landingB?dC(e.hangar.anchors.landingB):$(30,0,0),M:e.hangar.anchors.mouth?dC(e.hangar.anchors.mouth):$(0,18,70),D:e.hangar.anchors.droidLine?dC(e.hangar.anchors.droidLine):$(0,0,-40),Dq:e.hangar.anchors.droidLine?e.hangar.anchors.droidLine.getWorldQuaternion(new ut):new ut().setFromAxisAngle($(0,1,0),0)}}var nw={name:`landing`,blur:2,dur:5,schedule(e,t){let n=tw(e);new au(1301),e.fx.sparkStream(t+1,t+2.6,e=>rw(n,e-t).add($(0,.2,0)),()=>$(0,.7,.7),160,1302,7),e.fx.explosion(t+1.05,rw(n,1.05),{size:7,pieces:40,sparks:50,smoke:5,colors:[`red`,`white`,`lbg`,`dbg`],seed:1303}),e.fx.explosion(t+1.7,rw(n,1.7).add($(4,1,0)),{size:5,pieces:30,sparks:30,smoke:4,colors:[`red`,`white`,`lbg`],seed:1304})},pose(e,t,n){e.interior(),tw(e);let r=tw(e);e.hangar.setShield(0);let i=rw(r,t),a=r.A.clone().sub(r.M).setY(0).normalize(),o=Math.atan2(a.x,a.z),s=t>1?Math.max(0,Math.sin((t-1)*9)*Math.exp(-(t-1)*3))*.8:0,c=new ut().setFromEuler(new Ht(.05-s*.2,o+QS(1,2.6,t)*.5,QS(1,1.6,t)*.12-s*.1));uC(e,e.obiwanShip,{pos:i,quat:c},t<1?.2:0,t<2.6?1-QS(1.8,2.6,t):0),e.r4.head.visible=!1,e.obiwanShip.breakables.forEach((e,n)=>{e.userData.home??={pos:e.position.clone(),quat:e.quaternion.clone()};let r=e.userData.home,i=1.05+n*.18;if(t>i&&n<3){let a=t-i,o=new au(1400+n),s=o.range(-1,1),c=o.range(.2,1);e.position.set(r.pos.x+s*a*14,r.pos.y+Math.max(-r.pos.y-.5,a*6-a*a*9),r.pos.z+c*a*10),e.quaternion.copy(r.quat).multiply(new ut().setFromAxisAngle($(o.range(-1,1),1,o.range(-1,1)).normalize(),a*o.range(5,9)*Math.exp(-a*.8)))}else e.position.copy(r.pos),e.quaternion.copy(r.quat)}),lC(e.obiwan,{mouth:t<1?`shout`:`o`,brows:.9},t,2);let l=r.B.clone().sub(r.M).setY(0).normalize(),u=$S(2.2,4.4,t),d=r.M.clone().lerp(r.B.clone().add($(0,1.8,0)),u).add($(0,Math.sin(u*Math.PI)*6,0)),f=rC(l.clone().add($(0,-.15*(1-u),0)).normalize(),$(0,1,0));e.anakinShip.group.visible=t>2.1,t>2.1&&uC(e,e.anakinShip,{pos:d,quat:f},1-u,1-u*.8),lC(e.anakin,{mouth:`smirk`,brows:-.2},t,1);let p=r.A.clone().add($(-26,3.2,-30)),m=i.clone().lerp(r.A,.3).add($(0,2,0));return e.aimShadow(r.A,70,$(.2,1,.3).normalize()),{pos:p.add(aC(t,t>1&&t<2?.35:.06,3,41)),target:m,fov:34,near:.1,lens:{exposure:1.1,bloom:1.1}}}};function rw(e,t){let n=$S(0,1,t/1),r=e.M.clone().lerp(e.A.clone().add(e.A.clone().sub(e.M).setY(0).normalize().multiplyScalar(-34)),n);if(t<1)return r.add($(0,3*(1-n),0));let i=$S(0,1,(t-1)/1.6);return e.A.clone().add(e.A.clone().sub(e.M).setY(0).normalize().multiplyScalar(-34)).lerp(e.A,i).setY(e.A.y+1.5)}var iw=[gC,yC,wC,DC,AC,jC,LC,RC,WC,KC,XC,ZC,$C,ew,nw,{name:`droids`,dur:5.2,lines:[{t0:.3,t1:2.2,who:`Obi-Wan Kenobi`,text:`Flying is for droids.`},{t0:3.7,t1:5,who:`Battle Droid`,text:`Uh oh.`}],pose(e,t,n){e.interior();let r=tw(e);e.hangar.setShield(0),uC(e,e.obiwanShip,{pos:r.A.clone().setY(r.A.y+1.5),quat:rC(r.A.clone().sub(r.M).setY(0).normalize(),$(0,1,0)).multiply(new ut().setFromEuler(new Ht(.05,.5,.12)))},0,0),e.obiwanShip.breakables.forEach((e,t)=>{let n=e.userData.home;if(n&&t<3){let r=new au(1400+t);e.position.set(n.pos.x+r.range(-1,1)*14,-n.pos.y*0-1.2,n.pos.z+r.range(.2,1)*12)}}),e.r4.head.visible=!1,uC(e,e.anakinShip,{pos:r.B.clone().setY(r.B.y+1.8),quat:rC(r.B.clone().sub(r.M).setY(0).normalize(),$(0,1,0))},0,0);let i=r.A.clone().lerp(r.B,.5),a=r.D.clone().sub(i).setY(0).normalize(),o=Math.atan2(a.x,a.z),s=$(a.z,0,-a.x),c=i.clone().add(s.clone().multiplyScalar(3.5)).add(a.clone().multiplyScalar(4)),l=i.clone().add(s.clone().multiplyScalar(-3.5)).add(a.clone().multiplyScalar(4));e.stand(e.obiwan,c,o+(t<2.4?-.9:0)),e.stand(e.anakin,l,o+(t<2.4?.6:0));let u=QS(2.9,3.25,t),d=QS(2.5,3,t);e.obiwan.pose({armR:.2+d*1,armL:.1+d*.3,splayL:.1,wristR:d*Math.PI/2,headYaw:t<2.4?.3:0,headPitch:0}),e.anakin.pose({armR:.25+d*1.15,armL:.15,splayL:.1,wristR:d*Math.PI/2,headYaw:t<2.4?-.5:0}),lC(e.obiwan,{mouth:sC(t,.35,2,t<2.4?`smile`:`smirk`),brows:t<2.4?.2:-.4,lookX:t<2.4?-.03:0},t,2),lC(e.anakin,{mouth:t<2.4?`grin`:`smirk`,brows:-.4},t,1),e.sabers.forEach((r,i)=>{let a=i===0?e.obiwan:e.anakin;r.group.visible=t>2.5,r.group.parent!==a.gripR&&a.gripR.add(r.group),r.group.position.set(0,0,0),r.group.rotation.set(0,0,-Math.PI/2),r.setIgnite(i===0?u:QS(3,3.35,t),Math.sin(n*70+i)*.5)});let f=i.clone().add(a.clone().multiplyScalar(17)),p=new ut().setFromAxisAngle($(0,1,0),o+Math.PI),m=Math.ceil(e.droids.length/2);e.droids.forEach((e,n)=>{e.group.visible=!0;let r=n<m?0:1,i=((r===0?n:n-m)-(m-1)/2)*3.4+r*1.7;e.group.position.copy(f).add(s.clone().multiplyScalar(i)).add(a.clone().multiplyScalar(r*3.4)),e.group.quaternion.copy(p);let o=QS(1.2+n*.08,1.8+n*.08,t);e.pose({aim:o,headTilt:t>3.5?Math.sin(t*6+n)*.15:0,lookYaw:t>3.4&&n===0?-.4:0})});let h,g,_;if(t<2.4){let t=c.clone().add($(0,3.9,0));return h=t.clone().add(a.clone().multiplyScalar(7.5)).add(s.clone().multiplyScalar(2.2)).add($(0,-.6,0)),g=t.clone().add($(0,-.4,0)),_=26,e.aimShadow(c,20,$(.2,1,.3).normalize()),{pos:h,target:g,fov:_,near:.05,lens:{focus:h.distanceTo(t),aperture:7,exposure:1.12}}}return h=i.clone().sub(a.clone().multiplyScalar(eC(6.2,5.2,QS(2.4,5.2,t)))).add($(0,3.4,0)).add(s.clone().multiplyScalar(.8)),g=f.clone().lerp(i,.3).add($(0,2.5,0)),_=38,e.aimShadow(i,40,$(.2,1,.3).normalize()),{pos:h.add(aC(t,.05,1,43)),target:g,fov:_,near:.05,lens:{focus:h.distanceTo(f),aperture:2.5,exposure:1.12}}}},{name:`endcard`,dur:4.5,card:!0,pose:()=>({pos:$(0,0,0),target:$(0,0,1),fov:30})}],aw=0;for(let e of iw)e.start=aw,aw+=e.dur;var ow=aw;function sw(e){for(let t=0;t<iw.length;t++){let n=iw[t];if(e<n.start+n.dur||t===iw.length-1)return{shot:n,t:Math.max(0,e-n.start),index:t}}return{shot:iw[0],t:0,index:0}}var cw=class{ctx;bus;verb;verbSend;noise;rng=new au(4242);constructor(e){this.ctx=e;let t=e.createDynamicsCompressor();t.threshold.value=-14,t.knee.value=10,t.ratio.value=4,t.attack.value=.004,t.release.value=.25;let n=e.createGain();n.gain.value=.9,t.connect(n).connect(e.destination),this.bus=e.createGain(),this.bus.connect(t),this.verb=e.createConvolver(),this.verb.buffer=this.impulse(2.8,2.2),this.verbSend=e.createGain(),this.verbSend.gain.value=.35,this.verbSend.connect(this.verb).connect(t);let r=e.sampleRate*3;this.noise=e.createBuffer(1,r,e.sampleRate);let i=this.noise.getChannelData(0),a=new au(9);for(let e=0;e<r;e++)i[e]=a.next()*2-1}impulse(e,t){let n=Math.floor(this.ctx.sampleRate*e),r=this.ctx.createBuffer(2,n,this.ctx.sampleRate),i=new au(77);for(let e=0;e<2;e++){let a=r.getChannelData(e);for(let e=0;e<n;e++)a[e]=(i.next()*2-1)*(1-e/n)**t}return r}out(e,t=0,n=.2){let r=this.ctx.createGain();r.gain.value=e;let i=this.ctx.createStereoPanner();if(i.pan.value=Math.max(-1,Math.min(1,t)),r.connect(i).connect(this.bus),n>0){let e=this.ctx.createGain();e.gain.value=n,i.connect(e).connect(this.verbSend)}return r}noiseSrc(e,t){let n=this.ctx.createBufferSource();return n.buffer=this.noise,n.loop=!0,n.loopStart=this.rng.range(0,2),n.start(Math.max(0,e),this.rng.range(0,2)),n.stop(e+t+.05),n}env(e,t,n,r,i,a=3){e.setValueAtTime(1e-4,Math.max(0,t)),e.linearRampToValueAtTime(r,t+n),e.setTargetAtTime(1e-4,t+n,i/a)}pew(e,t,n=0,r=1){let i=this.ctx,a=this.out(t,n,.15),o=i.createGain();this.env(o.gain,e,.004,1,.16);let s=i.createBiquadFilter();s.type=`lowpass`,s.frequency.setValueAtTime(6e3,e),s.frequency.exponentialRampToValueAtTime(900,e+.2),o.connect(s).connect(a);for(let[t,n]of[[`sawtooth`,1],[`square`,1.5]]){let a=i.createOscillator();a.type=t,a.frequency.setValueAtTime(1900*r*n,e),a.frequency.exponentialRampToValueAtTime(210*r*n,e+.2);let s=i.createGain();s.gain.value=t===`square`?.25:.5,a.connect(s).connect(o),a.start(e),a.stop(e+.3)}}turbo(e,t,n=0){let r=this.ctx,i=this.out(t,n,.4),a=r.createGain();this.env(a.gain,e,.01,1,.5),a.connect(i);let o=r.createOscillator();o.type=`sawtooth`,o.frequency.setValueAtTime(820,e),o.frequency.exponentialRampToValueAtTime(70,e+.5);let s=r.createBiquadFilter();s.type=`lowpass`,s.frequency.value=1400,o.connect(s).connect(a),o.start(e),o.stop(e+.7)}boom(e,t,n,r=0,i=0){let a=this.ctx,o=.5+Math.min(2.8,Math.sqrt(t)*.18),s=this.out(n,r,.45),c=this.noiseSrc(e,o),l=a.createBiquadFilter();l.type=`lowpass`,l.frequency.setValueAtTime(t>50?1800:4200,e),l.frequency.exponentialRampToValueAtTime(t>50?90:180,e+o);let u=a.createGain();this.env(u.gain,e,.006,1,o),c.connect(l).connect(u).connect(s);let d=a.createOscillator();d.type=`sine`,d.frequency.setValueAtTime(t>50?60:110,e),d.frequency.exponentialRampToValueAtTime(t>50?26:40,e+o*.6);let f=a.createGain();this.env(f.gain,e,.004,t>50?1.4:.9,o*.6),d.connect(f).connect(s),d.start(e),d.stop(e+o+.1);for(let t=0;t<12;t++){let t=e+this.rng.range(.05,o*.7);this.click(t,n*this.rng.range(.05,.18),r,this.rng.range(900,3e3))}i>0&&this.clatter(e+.06,i,n*.6,r)}click(e,t,n,r,i=.018){let a=this.ctx,o=this.out(t,n,.1),s=this.noiseSrc(e,i+.02),c=a.createBiquadFilter();c.type=`bandpass`,c.frequency.value=r,c.Q.value=6;let l=a.createGain();this.env(l.gain,e,.001,1,i),s.connect(c).connect(l).connect(o)}clatter(e,t,n,r=0,i=1.1){let a=this.ctx;for(let o=0;o<t;o++){let t=e+this.rng.next()**1.6*i,o=this.rng.range(1800,5200),s=this.out(n*this.rng.range(.25,1)*(1-(t-e)/(i*1.2)),r+this.rng.range(-.3,.3),.25),c=a.createOscillator();c.type=`triangle`,c.frequency.value=o;let l=a.createGain();this.env(l.gain,t,8e-4,.6,.03),c.connect(l).connect(s),c.start(t),c.stop(t+.08),this.click(t,n*.5,r,o*.7,.01)}}engine(e,t,n,r={}){let i=this.ctx,a=this.out(1,0,.2),o=a.gain;o.setValueAtTime(1e-4,e);for(let[e,t]of n)o.linearRampToValueAtTime(Math.max(1e-4,t),e);o.linearRampToValueAtTime(1e-4,t);let s=this.noiseSrc(e,t-e),c=i.createBiquadFilter();c.type=`bandpass`,c.frequency.value=700*(r.pitch??1)*(r.bright??1),c.Q.value=.7,s.connect(c).connect(a);let l=i.createOscillator();l.type=`sawtooth`,l.frequency.value=62*(r.pitch??1);let u=i.createBiquadFilter();u.type=`lowpass`,u.frequency.value=380;let d=i.createGain();d.gain.value=.35,l.connect(u).connect(d).connect(a),l.start(e),l.stop(t+.1);let f=i.createOscillator();f.type=`sine`,f.frequency.value=1250*(r.pitch??1);let p=i.createGain();p.gain.value=.04,f.connect(p).connect(a),f.start(e),f.stop(t+.1)}whoosh(e,t,n,r=-.8,i=.8,a=2400,o=260){let s=this.ctx,c=this.ctx.createGain(),l=s.createStereoPanner();l.pan.setValueAtTime(r,e),l.pan.linearRampToValueAtTime(i,e+t),c.connect(l).connect(this.bus);let u=s.createGain();u.gain.value=.3,l.connect(u).connect(this.verbSend),c.gain.setValueAtTime(1e-4,e),c.gain.exponentialRampToValueAtTime(n,e+t*.45),c.gain.exponentialRampToValueAtTime(1e-4,e+t);let d=this.noiseSrc(e,t),f=s.createBiquadFilter();f.type=`bandpass`,f.Q.value=1.2,f.frequency.setValueAtTime(a*.6,e),f.frequency.exponentialRampToValueAtTime(a,e+t*.45),f.frequency.exponentialRampToValueAtTime(o,e+t),d.connect(f).connect(c);let p=s.createOscillator();p.type=`sawtooth`,p.frequency.setValueAtTime(a*.18,e),p.frequency.exponentialRampToValueAtTime(o*.3,e+t);let m=s.createGain();m.gain.value=.12;let h=s.createBiquadFilter();h.type=`lowpass`,h.frequency.value=900,p.connect(h).connect(m).connect(c),p.start(e),p.stop(e+t+.05)}beeps(e,t,n,r=0,i=1,a=!1){let o=this.ctx,s=new au(i),c=e;for(let e=0;e<t;e++){let e=s.range(.045,.12),t=this.out(n,r,.2),i=o.createOscillator();i.type=`sine`;let l=s.range(1400,3800),u=a?l*.5:s.range(1200,4200);i.frequency.setValueAtTime(l,c),i.frequency.exponentialRampToValueAtTime(u,c+e);let d=o.createGain();this.env(d.gain,c,.004,1,e*1.2,5),i.connect(d).connect(t),i.start(c),i.stop(c+e+.05),c+=e+s.range(.01,.05)}}scream(e,t,n=0){let r=this.ctx,i=this.out(t,n,.35),a=r.createOscillator();a.type=`sine`,a.frequency.setValueAtTime(2900,e),a.frequency.exponentialRampToValueAtTime(520,e+.9);let o=r.createOscillator();o.frequency.value=18;let s=r.createGain();s.gain.value=160,o.connect(s).connect(a.frequency);let c=r.createGain();this.env(c.gain,e,.02,1,.9,2),a.connect(c).connect(i),a.start(e),a.stop(e+1.1),o.start(e),o.stop(e+1.1)}saw(e,t,n,r=0){let i=this.ctx,a=this.out(n,r,.15),o=i.createOscillator();o.type=`sawtooth`,o.frequency.value=1900;let s=i.createOscillator();s.frequency.value=37;let c=i.createGain();c.gain.value=260,s.connect(c).connect(o.frequency);let l=i.createBiquadFilter();l.type=`bandpass`,l.frequency.value=2600,l.Q.value=2;let u=i.createGain();u.gain.setValueAtTime(1e-4,e),u.gain.linearRampToValueAtTime(1,e+.08),u.gain.setValueAtTime(1,t-.1),u.gain.linearRampToValueAtTime(1e-4,t),o.connect(l).connect(u).connect(a),o.start(e),o.stop(t+.05),s.start(e),s.stop(t+.05);let d=this.noiseSrc(e,t-e),f=i.createBiquadFilter();f.type=`highpass`,f.frequency.value=3500;let p=i.createGain();p.gain.value=.25,d.connect(f).connect(p).connect(u)}zap(e,t,n,r=0){let i=this.ctx,a=this.out(n,r,.2),o=this.noiseSrc(e,t),s=i.createBiquadFilter();s.type=`bandpass`,s.frequency.value=3200,s.Q.value=3;let c=i.createGain(),l=i.createOscillator();l.type=`square`,l.frequency.value=55;let u=i.createGain();u.gain.value=.5,c.gain.value=.5,l.connect(u).connect(c.gain),o.connect(s).connect(c).connect(a),l.start(e),l.stop(e+t);let d=i.createOscillator();d.type=`square`,d.frequency.value=120;let f=i.createGain();this.env(f.gain,e,.01,.15,t),d.connect(f).connect(a),d.start(e),d.stop(e+t+.1)}saber(e,t,n,r=0){let i=this.ctx,a=this.out(n,r,.3),o=this.noiseSrc(e,.5),s=i.createBiquadFilter();s.type=`bandpass`,s.frequency.setValueAtTime(600,e),s.frequency.exponentialRampToValueAtTime(4200,e+.25);let c=i.createGain();this.env(c.gain,e,.01,.8,.35),o.connect(s).connect(c).connect(a);let l=this.out(n*.55,r,.25),u=i.createGain();u.gain.setValueAtTime(1e-4,e),u.gain.linearRampToValueAtTime(1,e+.18),u.gain.setValueAtTime(1,t-.2),u.gain.linearRampToValueAtTime(1e-4,t);let d=i.createBiquadFilter();d.type=`lowpass`,d.frequency.value=520;for(let n of[88,90.5,176]){let r=i.createOscillator();r.type=`sawtooth`,r.frequency.setValueAtTime(n*.6,e),r.frequency.exponentialRampToValueAtTime(n,e+.2),r.connect(d),r.start(e),r.stop(t+.05)}d.connect(u).connect(l)}mumble(e,t,n,r,i=0,a=1){let o=this.ctx,s=new au(a),c=n===`obiwan`?118:n===`anakin`?138:230,l=[[800,1200],[400,2e3],[500,900],[350,2300],[650,1700],[300,800]],u=this.out(r,i,.18),d=o.createOscillator();d.type=n===`droid`?`square`:`sawtooth`,d.frequency.setValueAtTime(c,e);let f=o.createBiquadFilter();f.type=`bandpass`,f.Q.value=5;let p=o.createBiquadFilter();p.type=`bandpass`,p.Q.value=7;let m=o.createGain(),h=o.createGain();h.gain.value=.55;let g=o.createGain();g.gain.setValueAtTime(1e-4,e),d.connect(f).connect(m).connect(g),d.connect(p).connect(h).connect(g),g.connect(u);let _=e;for(;_<t-.08;){let n=s.range(.09,.2),[r,i]=l[s.int(0,l.length-1)];f.frequency.setTargetAtTime(r,_,.015),p.frequency.setTargetAtTime(i,_,.015),d.frequency.setTargetAtTime(c*s.range(.85,1.3)*(1-(_-e)/(t-e)*.15),_,.03),g.gain.setTargetAtTime(s.range(.6,1),_,.012),g.gain.setTargetAtTime(.05,_+n*.75,.02),_+=n,s.chance(.18)&&(_+=s.range(.05,.14))}if(g.gain.setTargetAtTime(1e-4,t-.05,.02),d.start(e),d.stop(t+.1),n===`droid`){let n=o.createOscillator();n.frequency.value=42;let r=o.createGain();r.gain.value=.4,n.connect(r).connect(g.gain),n.start(e),n.stop(t)}}pad(e,t,n,r){let i=this.ctx,a=(t-e)/n.length;n.forEach((t,n)=>{let o=e+n*a,s=o+a+1.5,c=this.out(r,0,.9),l=i.createGain();l.gain.setValueAtTime(1e-4,o),l.gain.linearRampToValueAtTime(1,o+Math.min(2.5,a*.6)),l.gain.setValueAtTime(1,s-1.8),l.gain.linearRampToValueAtTime(1e-4,s);let u=i.createBiquadFilter();u.type=`lowpass`,u.frequency.value=1500,u.connect(l).connect(c);for(let e of t)for(let t of[-7,6]){let n=i.createOscillator();n.type=`sawtooth`,n.frequency.value=440*2**((e-69)/12),n.detune.value=t;let r=i.createGain();r.gain.value=.08,n.connect(r).connect(u),n.start(o),n.stop(s+.1)}})}timpani(e,t,n=0){let r=this.ctx,i=n>0?Math.floor(n*14):1;for(let a=0;a<i;a++){let o=e+(n>0?a/i*n:0),s=n>0?t*(.3+a/i*.7):t,c=this.out(s,0,.6),l=r.createOscillator();l.type=`sine`,l.frequency.setValueAtTime(92,o),l.frequency.exponentialRampToValueAtTime(72,o+.5);let u=r.createGain();this.env(u.gain,o,.003,1,.9),l.connect(u).connect(c),l.start(o),l.stop(o+1.2);let d=this.noiseSrc(o,.1),f=r.createBiquadFilter();f.type=`lowpass`,f.frequency.value=600;let p=r.createGain();this.env(p.gain,o,.001,.4,.06),d.connect(f).connect(p).connect(c)}}};function lw(e){let t=e.numberOfChannels,n=e.length,r=new ArrayBuffer(44+n*t*2),i=new DataView(r),a=(e,t)=>[...t].forEach((t,n)=>i.setUint8(e+n,t.charCodeAt(0)));a(0,`RIFF`),i.setUint32(4,36+n*t*2,!0),a(8,`WAVE`),a(12,`fmt `),i.setUint32(16,16,!0),i.setUint16(20,1,!0),i.setUint16(22,t,!0),i.setUint32(24,e.sampleRate,!0),i.setUint32(28,e.sampleRate*t*2,!0),i.setUint16(32,t*2,!0),i.setUint16(34,16,!0),a(36,`data`),i.setUint32(40,n*t*2,!0);let o=[...Array(t)].map((t,n)=>e.getChannelData(n)),s=44;for(let e=0;e<n;e++)for(let n=0;n<t;n++){let t=Math.max(-1,Math.min(1,o[n][e]));i.setInt16(s,t<0?t*32768:t*32767,!0),s+=2}let c=``,l=new Uint8Array(r);for(let e=0;e<l.length;e+=32768)c+=String.fromCharCode(...l.subarray(e,e+32768));return btoa(c)}async function uw(e){let t=44100,n=new OfflineAudioContext(2,Math.ceil((e.duration+1)*t),t),r=new cw(n),i=t=>e.shots.find(e=>e.name===t).start;r.pad(i(`crawl`)+.2,i(`longtake`)+10,[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61],[50,57,62,69]],.5),r.timpani(i(`longtake`)-1.2,.5,1.2),r.timpani(i(`longtake`)+.05,.9),r.pad(i(`endcard`)+.1,i(`endcard`)+4.4,[[50,57,62,66,69]],.5),r.timpani(i(`endcard`)+.1,.8);let a=1;for(let t of e.shots)for(let e of t.lines??[]){let n=e.who.startsWith(`Anakin`)?`anakin`:e.who.startsWith(`Obi`)?`obiwan`:`droid`;r.mumble(t.start+e.t0+.05,t.start+e.t1-.25,n,n===`droid`?.28:.34,0,a++)}let o=i(`longtake`);r.whoosh(o+2.9,1.8,.9,-.2,.3,2e3,200),r.engine(o+3,o+16,[[o+3.6,.5],[o+6,.32],[o+10,.4],[o+12,.55],[o+15.8,.4]]),r.whoosh(o+10.2,2.4,.7,.2,-.6,1600,180);for(let t of[`track`,`vultures`,`hand-reveal`,`missiles`,`rescue`,`hangar-approach`]){let n=e.shots.find(e=>e.name===t);r.engine(n.start,n.start+n.dur,[[n.start+.15,.42],[n.start+n.dur-.1,.42]])}for(let t of e.shots.filter(e=>e.name.includes(`cockpit`)))r.engine(t.start,t.start+t.dur,[[t.start+.1,.3],[t.start+t.dur-.1,.3]],{pitch:.6,bright:.6}),r.beeps(t.start+.5,4,.05,.4,a++);let s=i(`vultures`);for(let e of[.9,1.6,2.2,3.1])r.whoosh(s+e,.9,.5,-.5,.6,2600,400);r.whoosh(s+2.8,1.2,.5,.6,-.6,1400,300),r.engine(i(`hand-reveal`),i(`hand-reveal`)+4.5,[[i(`hand-reveal`)+1,.25]],{pitch:.35,bright:.4});let c=i(`missiles`);r.whoosh(c+.1,1.9,.7,.7,-.2,3200,900),r.click(c+1.9,.5,0,1200,.05),r.saw(c+2.3,c+4,.12,.2);let l=i(`buzz-close`);r.saw(l,l+4.5,.2,.1),r.saw(l+.3,l+4.4,.12,-.3),r.beeps(l+.6,7,.14,.1,77),r.beeps(l+1.6,5,.15,.1,78),r.scream(l+2.55,.28,.1),r.boom(l+2.55,3,.35,.1,10);let u=i(`rescue`);r.zap(u+2,.7,.3,-.1),r.beeps(u+2.8,8,.16,-.1,91);let d=i(`hangar-approach`),f=n.createOscillator();f.type=`sawtooth`,f.frequency.setValueAtTime(110,d),f.frequency.setValueAtTime(110,d+1.9),f.frequency.exponentialRampToValueAtTime(30,d+2.4);let p=r.out(.12,0,.3),m=n.createBiquadFilter();m.type=`lowpass`,m.frequency.value=600,f.connect(m).connect(p),p.gain.setValueAtTime(1e-4,d),p.gain.linearRampToValueAtTime(.12,d+.4),p.gain.linearRampToValueAtTime(1e-4,d+2.4),f.start(d),f.stop(d+2.5),r.whoosh(d+2.6,1.4,.8,.3,-.3,1800,200);let h=i(`landing`);r.boom(h+1.02,30,.9,0,60),r.boom(h+1.7,14,.6,.2,40);let g=r.noiseSrc(h+1.05,1.6),_=n.createBiquadFilter();_.type=`bandpass`,_.frequency.setValueAtTime(2400,h+1.05),_.frequency.exponentialRampToValueAtTime(500,h+2.6),_.Q.value=3;let v=r.out(.5,0,.3);v.gain.setValueAtTime(.5,h+1.05),v.gain.linearRampToValueAtTime(1e-4,h+2.65),g.connect(_).connect(v),r.clatter(h+1.3,40,.3,.1,2.2),r.engine(h+2.1,h+5,[[h+2.6,.35],[h+4.2,.15]],{pitch:1.3});let y=i(`droids`);for(let e=0;e<10;e++)r.click(y+1.2+e*.09,.12,.3,1500+e%3*300,.02);r.saber(y+2.9,y+5.2,.5,-.2),r.saber(y+3,y+5.2,.45,.2);for(let t of e.explosions){if(t.t0>e.duration)continue;let n=e.camAt(t.t0).distanceTo(t.pos),i=Math.min(1,t.size*7/Math.max(1,n));if(i<.02)continue;let a=Math.min(.25,n/2e4);r.boom(t.t0+a,t.size,Math.min(.9,i*.9),0,t.pieces>20&&i>.15?Math.min(30,t.pieces):0)}let b=0;for(let t of e.lasers){if(t.t0>e.duration||b>900)continue;let n=e.camAt(t.t0).distanceTo(t.from),i=t.length>60,a=i?Math.min(.5,900/Math.max(1,n)):Math.min(.5,60/Math.max(1,n));a<.04||(b++,i?r.turbo(t.t0,a*.5):r.pew(t.t0,a*.45,0,t.color===`red`?1:1.25))}return lw(await n.startRendering())}async function dw(e,t){let n=new XS(e);new URLSearchParams(location.search).get(`debug`)===`1`&&(window.__LSW_WORLD__=n),hC(n,19,iw.find(e=>e.name===`hangar-approach`).start+4);for(let e of iw)e.schedule?.(n,e.start);n.fx.build();let r=[],i=e=>r.push({o:e,pos:e.position.clone(),quat:e.quaternion.clone(),vis:e.visible});i(n.r4.head),i(n.r2.head);for(let e of n.buzz)i(e.head);for(let e of n.obiwanShip.breakables)i(e);for(let e of n.anakinShip.breakables)i(e);let a=n.camera,o={...Nl};function s(t){for(let e of r)e.o.position.copy(e.pos),e.o.quaternion.copy(e.quat),e.o.visible=e.vis;n.reset(),n.space();let{shot:i,t:a}=sw(t),o=i.pose(n,a,t);return n.hand.group.visible&&n.hand.group.userData.animate?.(t),n.hangar.group.visible&&n.hangar.group.userData.animate?.(t),n.fx.update(t,e.height/804),{cam:o,card:!!i.card}}function c(t){a.position.copy(t.pos),a.up.set(0,1,0),a.lookAt(t.target),t.roll&&a.rotateZ(t.roll),a.fov=t.fov,a.near=t.near??.3,a.far=3e6,a.aspect=e.width/e.height,a.updateProjectionMatrix(),a.updateMatrixWorld()}function l(e){let{shot:n,t:r}=sw(e),i=null;for(let e of n.lines??[])r>=e.t0&&r<=e.t1&&(i={who:e.who,text:e.text,a:Math.min(1,(r-e.t0)/.08,(e.t1-r)/.08)});t.setSubtitle(i?.who??null,i?.text??null,i?.a??0);let a=0,o=0,s=0;if(n.name===`farfar`)a=1,o=Math.min(1,Math.max(0,(r-.4)/.8))*Math.min(1,Math.max(0,(4.1-r)/.7));else if(n.name===`endcard`)a=1,s=Math.min(1,Math.max(0,(r-.3)/.8))*Math.min(1,Math.max(0,(4.4-r)/.6));else{let t=n.start;n.name===`crawl`&&(a=Math.max(0,1-(e-t)/1)),n.name===`landing`&&(a=Math.max(0,1-(e-t)/.25))}t.setFade(a),t.setCards(o,s,`<div><div style="font-size:0.55em;letter-spacing:0.35em;color:#e9e3cf;margin-bottom:0.5em">EPISODE III</div>REVENGE OF THE SITH<div style="font-size:0.32em;letter-spacing:0.3em;color:#9aa3ad;margin-top:1.6em">A BRICK-BUILT BATTLE OVER CORUSCANT</div></div>`)}return{duration:ow,renderAt(t,r={}){l(t);let i=s(t);if(c(i.cam),Object.assign(o,Nl,i.cam.lens??{}),i.card){e.renderer.setRenderTarget(null),e.renderer.setClearColor(0,1),e.renderer.clear();return}let u=Math.max(1,Math.min(r.subframes??1,sw(t).shot.blur??1)),d=r.shutter??.5,f=r.fps??24;e.render(n.scene,a,o,{time:t,subframes:u,setSub:(e,n)=>{c(s(t+((e+.5)/n-.5)*(d/f)).cam)}})},shots:()=>iw.map(e=>({name:e.name,start:e.start,end:e.start+e.dur})),renderAudio:()=>uw({shots:iw,duration:ow,camAt:(()=>{let e=new Map;return t=>{let n=Math.round(t*5),r=e.get(n);return r||e.set(n,r=s(n/5).cam.pos.clone()),r}})(),lasers:n.fx.lasers.events,explosions:n.fx.explosions})}}var fw=new URLSearchParams(location.search),pw=fw.get(`capture`)===`1`,mw=fw.get(`lab`),hw=document.getElementById(`app`),gw=new Vl(document.getElementById(`film-ui`)),_w=new Ll(hw,{width:16,height:16,samples:Number(fw.get(`msaa`)??4)});function vw(){let e=gw.fit(_w.renderer.domElement,innerWidth,innerHeight);_w.setSize(e.width,e.height)}vw(),pw||addEventListener(`resize`,vw);var yw=null,bw=null;async function xw(){if(mw){if(yw=new ES(_w,mw,fw.get(`bg`)??`studio`),yw.pose(Number(fw.get(`yaw`)??35),Number(fw.get(`pitch`)??18),Number(fw.get(`dist`)??1),0),gw.setCards(0,0),!pw){let e=Number(fw.get(`yaw`)??35),t=performance.now(),n=()=>{let r=(performance.now()-t)/1e3;fw.get(`spin`)!==`0`&&(e+=.25),yw.pose(e,Number(fw.get(`pitch`)??18),Number(fw.get(`dist`)??1),r),yw.render(r),requestAnimationFrame(n)};n()}return}if(bw=await dw(_w,gw),!pw){let e=Number(fw.get(`t`)??0),t=performance.now(),n=!1;addEventListener(`keydown`,t=>{t.code===`Space`&&(n=!n),t.code===`ArrowRight`&&(e+=2),t.code===`ArrowLeft`&&(e=Math.max(0,e-2))}),addEventListener(`click`,()=>n=!n);let r=()=>{let i=performance.now();n||(e+=Math.min(.1,(i-t)/1e3)),t=i,e>bw.duration&&(e=0),bw.renderAt(e),requestAnimationFrame(r)};r()}}var Sw=xw();window.__LSW__={ready:Sw,mode:mw?`lab`:`film`,info:()=>({width:_w.width,height:_w.height,calls:_w.renderer.info.render.calls,triangles:_w.renderer.info.render.triangles,programs:_w.renderer.info.programs?.length??0,geometries:_w.renderer.info.memory.geometries,lastRenderMs:_w.lastRenderMs}),assets:()=>Object.keys(yS),labPose:(e,t,n,r)=>yw?.pose(e,t,n,r),labRender:e=>{yw?.render(e),_w.sync()},duration:()=>bw?.duration??0,shots:()=>bw?.shots()??[],renderAt:(e,t=1,n=.5,r=24)=>{let i=performance.now();return bw?.renderAt(e,{subframes:t,shutter:n,fps:r}),_w.sync(),{ms:performance.now()-i}},renderAudio:async()=>bw?bw.renderAudio():``};