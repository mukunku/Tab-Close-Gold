chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	inspectUrl(tab, changeInfo);
});

chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
	setTimeout(function(){ 
		chrome.tabs.get(addedTabId, function (tab) {
			inspectUrl(tab, { url: tab.url });
		}); 
	}, 10);	
});

function inspectUrl (tab, changeInfo) {
	try 
	{
		if (changeInfo && changeInfo.url) {
			chrome.storage.sync.get( {'config': [
					{
						enabled: true,
						pattern: "ducksarethebest.com",
						isRegex: false,
						hitCount: 0,
						lastHit: ''
					}
				], isCompressed: false}, function(item) {
				if (!chrome.runtime.lastError) {
					var isCompressed = false;
					if (item && item.isCompressed)
						isCompressed = true;
					
					if (item && item.config) {
						var configs = null;
						if (isCompressed) {
							configs = JSON.parse(LZString.decompressFromUTF16(item.config));
						} else {
							configs = item.config;
						}
						
						if (configs.length && configs.length > 0) {
							for (var i = 0; i < configs.length; i++) {
								var config = configs[i];
								if (config) {
									if (!config.isRegex) {
										if (changeInfo.url.includes(config.pattern)) {
											config.lastHit = changeInfo.url;
											config.hitCount++;
											
											//not thread safe unfortunately :(
											chrome.storage.sync.set( {'config': LZString.compressToUTF16(JSON.stringify(configs)), 'isCompressed': true}, function() {
												if (chrome.runtime.lastError) {			
													console.log("Could not save configuration!" + chrome.runtime.error);
												}
												
												//regardless of last hit save, close tab
												chrome.tabs.remove(tab.id, function() {
													if (!chrome.runtime.lastError) {
														
													} else {
														console.log('Something went wrong when closing a tab matching pattern: ' + config.pattern);
													}
												});
											});
										}
									} else {
										var regex = new RegExp(config.pattern);
										if (regex.test(changeInfo.url)) {
											config.lastHit = changeInfo.url;
											config.hitCount++;
											
											//not thread safe unfortunately :(
											chrome.storage.sync.set( {'config': LZString.compressToUTF16(JSON.stringify(configs)), 'isCompressed': true}, function() {
												if (chrome.runtime.lastError) {			
													console.log("Could not save configuration!" + chrome.runtime.error);
												}
												
												//regardless of last hit save, close tab
												chrome.tabs.remove(tab.id, function() {
													if (!chrome.runtime.lastError) {
														
													} else {
														console.log('Something went wrong when closing a tab matching pattern: ' + config.pattern);
													}
												});
											});
										}
									}
								}
							}
						}
					}
				} else {
					console.log(chrome.runtime.error);
				}
			});
		} 
	} catch (err) {
		console.log('Ad Close Gold Error:' + err.message);
	}
}



var LZString=function(){function e(a,b){if(!d[a]){d[a]={};for(var c=0;c<a.length;c++)d[a][a.charAt(c)]=c}return d[a][b]}var a=String.fromCharCode,b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",d={},f={compressToBase64:function(a){if(null==a)return"";var c=f._compress(a,6,function(a){return b.charAt(a)});switch(c.length%4){default:case 0:return c;case 1:return c+"===";case 2:return c+"==";case 3:return c+"="}},decompressFromBase64:function(a){return null==a?"":""==a?null:f._decompress(a.length,32,function(c){return e(b,a.charAt(c))})},compressToUTF16:function(b){return null==b?"":f._compress(b,15,function(b){return a(b+32)})+" "},decompressFromUTF16:function(a){return null==a?"":""==a?null:f._decompress(a.length,16384,function(b){return a.charCodeAt(b)-32})},compressToUint8Array:function(a){for(var b=f.compress(a),c=new Uint8Array(2*b.length),d=0,e=b.length;d<e;d++){var g=b.charCodeAt(d);c[2*d]=g>>>8,c[2*d+1]=g%256}return c},decompressFromUint8Array:function(b){if(null===b||void 0===b)return f.decompress(b);for(var c=new Array(b.length/2),d=0,e=c.length;d<e;d++)c[d]=256*b[2*d]+b[2*d+1];var g=[];return c.forEach(function(b){g.push(a(b))}),f.decompress(g.join(""))},compressToEncodedURIComponent:function(a){return null==a?"":f._compress(a,6,function(a){return c.charAt(a)})},decompressFromEncodedURIComponent:function(a){return null==a?"":""==a?null:(a=a.replace(/ /g,"+"),f._decompress(a.length,32,function(b){return e(c,a.charAt(b))}))},compress:function(b){return f._compress(b,16,function(b){return a(b)})},_compress:function(a,b,c){if(null==a)return"";var d,e,q,f={},g={},h="",i="",j="",k=2,l=3,m=2,n=[],o=0,p=0;for(q=0;q<a.length;q+=1)if(h=a.charAt(q),Object.prototype.hasOwnProperty.call(f,h)||(f[h]=l++,g[h]=!0),i=j+h,Object.prototype.hasOwnProperty.call(f,i))j=i;else{if(Object.prototype.hasOwnProperty.call(g,j)){if(j.charCodeAt(0)<256){for(d=0;d<m;d++)o<<=1,p==b-1?(p=0,n.push(c(o)),o=0):p++;for(e=j.charCodeAt(0),d=0;d<8;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}else{for(e=1,d=0;d<m;d++)o=o<<1|e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e=0;for(e=j.charCodeAt(0),d=0;d<16;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}k--,0==k&&(k=Math.pow(2,m),m++),delete g[j]}else for(e=f[j],d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;k--,0==k&&(k=Math.pow(2,m),m++),f[i]=l++,j=String(h)}if(""!==j){if(Object.prototype.hasOwnProperty.call(g,j)){if(j.charCodeAt(0)<256){for(d=0;d<m;d++)o<<=1,p==b-1?(p=0,n.push(c(o)),o=0):p++;for(e=j.charCodeAt(0),d=0;d<8;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}else{for(e=1,d=0;d<m;d++)o=o<<1|e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e=0;for(e=j.charCodeAt(0),d=0;d<16;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}k--,0==k&&(k=Math.pow(2,m),m++),delete g[j]}else for(e=f[j],d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;k--,0==k&&(k=Math.pow(2,m),m++)}for(e=2,d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;for(;;){if(o<<=1,p==b-1){n.push(c(o));break}p++}return n.join("")},decompress:function(a){return null==a?"":""==a?null:f._decompress(a.length,32768,function(b){return a.charCodeAt(b)})},_decompress:function(b,c,d){var l,m,n,o,p,q,r,e=[],g=4,h=4,i=3,j="",k=[],s={val:d(0),position:c,index:1};for(l=0;l<3;l+=1)e[l]=l;for(n=0,p=Math.pow(2,2),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;switch(n){case 0:for(n=0,p=Math.pow(2,8),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;r=a(n);break;case 1:for(n=0,p=Math.pow(2,16),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;r=a(n);break;case 2:return""}for(e[3]=r,m=r,k.push(r);;){if(s.index>b)return"";for(n=0,p=Math.pow(2,i),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;switch(r=n){case 0:for(n=0,p=Math.pow(2,8),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;e[h++]=a(n),r=h-1,g--;break;case 1:for(n=0,p=Math.pow(2,16),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;e[h++]=a(n),r=h-1,g--;break;case 2:return k.join("")}if(0==g&&(g=Math.pow(2,i),i++),e[r])j=e[r];else{if(r!==h)return null;j=m+m.charAt(0)}k.push(j),e[h++]=m+j.charAt(0),g--,m=j,0==g&&(g=Math.pow(2,i),i++)}}};return f}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});