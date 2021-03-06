var https = require('https');

// 获取微信 Access_Token
var getAccessToken = function ( appId, appKey ) {
	var opts = {
		hostname: 'api.weixin.qq.com',
		path: '/cgi-bin/token?grant_type=client_credential&appid=' + appId + '&secret=' + appKey,
		headers: {
			'Content-Type': 'application/json'
		},
		port: 443,
		method: 'GET'
	};
	sendHttpsRequest(opts, function (chunk) { 
		// chunk 是字符串
		exports.access_token = JSON.parse(chunk).access_token;
		console.log("[INFO] Get Wechat access token: " + exports.access_token);
  },"");
	
}

// 素材管理：上传永久素材
exports.uploadNews = function ( access_token ){
	
}

// 客服接口：发送图文消息 https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=ACCESS_TOKEN
exports.sendNews = function ( open_id, access_token){
	var data = JSON.stringify({
				'touser': open_id,
				"msgtype":"news",
				"news":{
					"articles": [
						{
							"title":"Happy Day",
							"description":"Is Really A Happy Day",
							"url":"http://hwade.leanapp.cn",
							"picurl":"http://ac-bsy2hmmn.clouddn.com/b62c8fa1ef4cc22b.jpg"
						}
					]
				}
			});
	var opts = {
		hostname: 'api.weixin.qq.com',
		path: '/cgi-bin/message/custom/send?access_token=' + access_token,
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': data.length
		},
		port: 443,		
		method: 'POST'
	};
	sendHttpsRequest(opts, function (chunk) { 
		// chunk 是字符串
		console.log("call back value: " + chunk);
  },data);
}

// 获取media_id_list
//exports.getMedia

// 向微信服务器发送 HTTP 请求
var sendHttpsRequest = function ( options, func, data ) {
	options.agent = new https.Agent(options);	
	var httpsReq = https.request(options, function(res) {
		// console.log('STATUS: ' + res.statusCode);  
    // console.log('HEADERS: ' + JSON.stringify(res.headers));  
    res.setEncoding('utf8');  
    res.on('data', func);//func为接收数据后的处理函数
	})
	httpsReq.on('error', function (e) {  
		/*
		for(var s in e){
			console.log('[ERROR] '+s +': '+e[s]);
		}*/
    console.log('problem with request: ' + e.message);  
	});  
	if(options.method == 'POST'){
		httpsReq.write(data);
	}
	httpsReq.end();
}

exports.getAccessToken = getAccessToken;
