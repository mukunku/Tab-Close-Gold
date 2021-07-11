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

var MAX_PARTITION_COUNT = chrome.storage.sync.MAX_ITEMS - 10; //-10 is to reserve some item capacity for settings.

function generatePartitionedOptionsForCloudStorage(data) {
	function splitArrayIntoChunksOfLen(arr, len) {
		var chunks = [], i = 0, n = arr.length;
		while (i < n) {
			chunks.push(arr.slice(i, i += len));
		}
		return chunks;
	};
		
	//We split our data into multiple arrays so we can maximize our usage of the cloud storage.	
	var rowCountPerItem = Math.ceil(data.length / MAX_PARTITION_COUNT);
	var splitData = splitArrayIntoChunksOfLen(data, rowCountPerItem);
	
	var config = {};
	for (var i = 0; i < MAX_PARTITION_COUNT; i++) {
		if (i < splitData.length)
			config['config-' + (i + 1).toString()] = LZString.compressToUTF16(JSON.stringify(splitData[i]));
		else
			config['config-' + (i + 1).toString()] = null;
	}
	return config;
}

//TODO: Add caching so we don't keep reading the configs every time
function inspectUrl (tab, changeInfo) {
	try 
	{
		var useCloudStorage = true; //All users will be using cloud storage by default
		if (changeInfo && changeInfo.url && changeInfo.url !== 'chrome://newtab/') {
			var callback = function(item) {
				if (!chrome.runtime.lastError) {
					var configs = [];
					var isPartitionedData = !!(item['config-2']);
					if (isPartitionedData) { //partitioned data means cloud storage
						var isDone = false;
						var i = 1;
						while(!isDone) {
							var partition = item['config-' + i.toString()];
							i++;
							if (partition) {
								configs = configs.concat(JSON.parse(LZString.decompressFromUTF16(partition)));
							} else {
								isDone = true;
							}
						}
					} else if (item['config-1'] || item['config']) { //TODO: Remove old 'config' key after some time
						//Single row of data detected (Usually means we're using Local storage)
						configs = JSON.parse(LZString.decompressFromUTF16(item['config-1'] || item['config']));
					} else {
						//no items exist. use default demo data
						configs = [{
							enabled: true,
							pattern: "findtheinvisiblecow.com",
							isRegex: false,
							hitCount: 0,
							lastHit: ''
						}]
					}

					for (var i = 0; i < configs.length; i++) {
						var config = configs[i];
						if (config && config.enabled && config.pattern && config.pattern.trim()) { //make sure user didn't save empty string
							
							//handle wild cards if necessary
							var isRegex = config.isRegex;
							var pattern = config.pattern.trim();
							if (!isRegex && pattern.includes('*')) {
								pattern = pattern.replaceAll('*', '.*');
								isRegex = true;
							}
							
							var isHit = false;
							if (!isRegex) {
								if (changeInfo.url.includes(pattern)) {
									isHit = true;
								}
							} else {
								var regex = new RegExp(pattern);
								if (regex.test(changeInfo.url)) {
									isHit = true;
								}
							}
							
							if (isHit) {
								config.lastHit = changeInfo.url;
								config.hitCount++;
								
								var closeTabCallback = function() {
									chrome.tabs.remove(tab.id, function() {
										if (chrome.runtime.lastError) {
											console.log('Something went wrong when closing a tab with pattern: ' + pattern);
										}
									});
								};
								
								if (useCloudStorage) {
									var options = generatePartitionedOptionsForCloudStorage(configs);
									chrome.storage.sync.set(options, closeTabCallback);
								} else {
									var options = {'config-1': LZString.compressToUTF16(JSON.stringify(slickgrid.getData()))};
									chrome.storage.local.set(options, saveFinishedCallback);
								}
							}
						}
					}
				} else {
					console.log(chrome.runtime.error);
				}
			};
			
			chrome.storage.sync.get({
				'useCloudStorage': true //All users will be using cloud storage by default
			}, function(item) {
				if (!chrome.runtime.lastError) {
					useCloudStorage = !!(item && item.useCloudStorage);
					
					if (useCloudStorage)
						chrome.storage.sync.get(null, callback);
					else 
						chrome.storage.local.get(null, callback);
				}
			});
		} 
	} catch (err) {
		console.log('Ad Close Gold Error:' + err.message);
	}
}

var LZString=function(){function e(a,b){if(!d[a]){d[a]={};for(var c=0;c<a.length;c++)d[a][a.charAt(c)]=c}return d[a][b]}var a=String.fromCharCode,b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",d={},f={compressToBase64:function(a){if(null==a)return"";var c=f._compress(a,6,function(a){return b.charAt(a)});switch(c.length%4){default:case 0:return c;case 1:return c+"===";case 2:return c+"==";case 3:return c+"="}},decompressFromBase64:function(a){return null==a?"":""==a?null:f._decompress(a.length,32,function(c){return e(b,a.charAt(c))})},compressToUTF16:function(b){return null==b?"":f._compress(b,15,function(b){return a(b+32)})+" "},decompressFromUTF16:function(a){return null==a?"":""==a?null:f._decompress(a.length,16384,function(b){return a.charCodeAt(b)-32})},compressToUint8Array:function(a){for(var b=f.compress(a),c=new Uint8Array(2*b.length),d=0,e=b.length;d<e;d++){var g=b.charCodeAt(d);c[2*d]=g>>>8,c[2*d+1]=g%256}return c},decompressFromUint8Array:function(b){if(null===b||void 0===b)return f.decompress(b);for(var c=new Array(b.length/2),d=0,e=c.length;d<e;d++)c[d]=256*b[2*d]+b[2*d+1];var g=[];return c.forEach(function(b){g.push(a(b))}),f.decompress(g.join(""))},compressToEncodedURIComponent:function(a){return null==a?"":f._compress(a,6,function(a){return c.charAt(a)})},decompressFromEncodedURIComponent:function(a){return null==a?"":""==a?null:(a=a.replace(/ /g,"+"),f._decompress(a.length,32,function(b){return e(c,a.charAt(b))}))},compress:function(b){return f._compress(b,16,function(b){return a(b)})},_compress:function(a,b,c){if(null==a)return"";var d,e,q,f={},g={},h="",i="",j="",k=2,l=3,m=2,n=[],o=0,p=0;for(q=0;q<a.length;q+=1)if(h=a.charAt(q),Object.prototype.hasOwnProperty.call(f,h)||(f[h]=l++,g[h]=!0),i=j+h,Object.prototype.hasOwnProperty.call(f,i))j=i;else{if(Object.prototype.hasOwnProperty.call(g,j)){if(j.charCodeAt(0)<256){for(d=0;d<m;d++)o<<=1,p==b-1?(p=0,n.push(c(o)),o=0):p++;for(e=j.charCodeAt(0),d=0;d<8;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}else{for(e=1,d=0;d<m;d++)o=o<<1|e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e=0;for(e=j.charCodeAt(0),d=0;d<16;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}k--,0==k&&(k=Math.pow(2,m),m++),delete g[j]}else for(e=f[j],d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;k--,0==k&&(k=Math.pow(2,m),m++),f[i]=l++,j=String(h)}if(""!==j){if(Object.prototype.hasOwnProperty.call(g,j)){if(j.charCodeAt(0)<256){for(d=0;d<m;d++)o<<=1,p==b-1?(p=0,n.push(c(o)),o=0):p++;for(e=j.charCodeAt(0),d=0;d<8;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}else{for(e=1,d=0;d<m;d++)o=o<<1|e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e=0;for(e=j.charCodeAt(0),d=0;d<16;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1}k--,0==k&&(k=Math.pow(2,m),m++),delete g[j]}else for(e=f[j],d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;k--,0==k&&(k=Math.pow(2,m),m++)}for(e=2,d=0;d<m;d++)o=o<<1|1&e,p==b-1?(p=0,n.push(c(o)),o=0):p++,e>>=1;for(;;){if(o<<=1,p==b-1){n.push(c(o));break}p++}return n.join("")},decompress:function(a){return null==a?"":""==a?null:f._decompress(a.length,32768,function(b){return a.charCodeAt(b)})},_decompress:function(b,c,d){var l,m,n,o,p,q,r,e=[],g=4,h=4,i=3,j="",k=[],s={val:d(0),position:c,index:1};for(l=0;l<3;l+=1)e[l]=l;for(n=0,p=Math.pow(2,2),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;switch(n){case 0:for(n=0,p=Math.pow(2,8),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;r=a(n);break;case 1:for(n=0,p=Math.pow(2,16),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;r=a(n);break;case 2:return""}for(e[3]=r,m=r,k.push(r);;){if(s.index>b)return"";for(n=0,p=Math.pow(2,i),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;switch(r=n){case 0:for(n=0,p=Math.pow(2,8),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;e[h++]=a(n),r=h-1,g--;break;case 1:for(n=0,p=Math.pow(2,16),q=1;q!=p;)o=s.val&s.position,s.position>>=1,0==s.position&&(s.position=c,s.val=d(s.index++)),n|=(o>0?1:0)*q,q<<=1;e[h++]=a(n),r=h-1,g--;break;case 2:return k.join("")}if(0==g&&(g=Math.pow(2,i),i++),e[r])j=e[r];else{if(r!==h)return null;j=m+m.charAt(0)}k.push(j),e[h++]=m+j.charAt(0),g--,m=j,0==g&&(g=Math.pow(2,i),i++)}}};return f}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});