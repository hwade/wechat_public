var domain = require('domain');
var path = require('path');
var express = require('express');
var xml2js = require('xml2js');
var AV = require('leanengine');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var weixin = require('weixin-api');
var reqWx = require('./requestWeChat');
var cloud = require('./cloud');

var APP_ID = process.env.LC_APP_ID;
var APP_KEY = process.env.LC_APP_KEY;
var MASTER_KEY = process.env.LC_APP_MASTER_KEY;
var wxId = 'wxd74d9fc92f44e1c3';
var wxKey = 'd4624c36b6795d1d99dcf0547af5443d';

AV.initialize(APP_ID, APP_KEY, MASTER_KEY);

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();
AV.Promise._isPromisesAPlusCompliant = false;

// 微信配置
weixin.token = 'hwade82329170wechatleancloud';

var app = express();


// 解析微信的 xml 数据
var parseWechatData = function (req, res) {
	// 获取XML内容
  
};


// App 全局配置
app.set('views', path.join(__dirname, 'views')); // 设置模板目录
app.set('view engine', 'ejs');    // 设置 template 引擎

// 中间件的使用有顺序
app.use(cloud);
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// 加载 cookieSession 以支持 AV.User 的会话状态
app.use(AV.Cloud);
app.use(AV.Cloud.CookieSession({ secret: 'hwade123456', maxAge: 3600000, fetchUser: true }));

// app.use(xmlBodyParser());	// 解析微信请求数据 middleware

// 未处理异常捕获 middleware
app.use(function(req, res, next) {
  var d = domain.create();
  d.add(req);
  d.add(res);
  d.on('error', function(err) {
    console.error('uncaughtException url=%s, msg=%s', req.url, err.stack || err.message || err);
    if(!res.finished) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=UTF-8');
      res.end('uncaughtException');
    }
  });
  d.run(next);
});

// 使用 Express 路由 API 服务 /hello 的 HTTP GET 请求
app.get('/hello', function(req, res) {
  res.render('hello', { message: 'Congrats, you just set up your app!' });
});

app.get('/', function(req, res) {
	res.render('index',{});
});
// 微信服务器请求数据
app.get('/weixin', function(req, res) {
	// 签名成功
	console.log("[get] checkSignature");
  if (weixin.checkSignature(req)) {
  	res.send(200, req.query.echostr);
  } else {
		var err = new Error('Unauthorized');
    err.code = 401;
  	res.send(err.code || 500, err.message);
  }
}) 

// 接收到微信服务器发送的数据
app.post('/weixin', function(req, res) {	
		
	// 解析微信数据，同时处理接收到的信息
  weixin.loop(req,res);
	/*
  console.log('[App Post] weixin req:', req.body);
  weixin.exec(req.body, function(err, data) {
		try{			
		  if (err) {
		    return res.send(err.code || 500, err.message);
		  }
			if (data == null){
				console.log("[Notice] No data return! data:"+JSON.stringify(data));
				return res.send("success");
			}
		  var builder = new xml2js.Builder();
		  var xml = builder.buildObject(data);
		  console.log('res:', data);
		  res.set('Content-Type', 'text/xml');

		  return res.send(xml);
		}catch(err){
			console.log("[Error] Error when sending data to wechat");
			res.send();
		}
  });
	*/
})

// 上传文件到微信服务器
app.post('/upload',function(req, res){
	/*
	var form = new multiparty.Form(); //创建上传表单
	form.encoding = 'utf-8';	//设置编辑
	form.uploadDir = 'https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=' + 
									 reqWx.access_token;
	console.log("[UPLOAD] access_token: " + reqWx.access_token);
	form.maxFieldsSize = 2 * 1024 * 1024;   //文件大小
	form.parse(req, function(err, fields, files){
		for (var key in req) {
			console.log("[TEST] req_key: " + key);
		}
		for (var key in files) {
			console.log("[TEST] files_key: " + key);
		}
		console.log("[TEST] files: " + files + " fields: " + fields);
		var iconFile = files.iconImage[0];
		if(iconFile.size !== 0){
      fs.readFile(iconFile.path, function(err, data){
        if(err) {
          return res.send('读取文件失败');
        }
        var base64Data = data.toString('base64');
        var theFile = new AV.File(iconFile.originalFilename, {base64: base64Data});
        theFile.save().then(function(theFile){
          res.send('上传成功！');
        });
      });
    } else {
      res.send('请选择一个文件。');
    }
	});
*/
}); 
// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// error handlers
app.use(function(err, req, res, next) {
  console.log(err.stack || err.message || err)
  res.status(err.status || 500);
  res.send('error:' + err.message);
});

// 监听文本消息
weixin.textMsg(function(msg) {
	console.log("[textMsg received]");
	console.log(JSON.stringify(msg));
	var resMsg = {
		fromUserName : msg.toUserName,
		toUserName : msg.fromUserName,
		msgType : "text",
		content : "这是文本回复"
  };
	weixin.sendMsg(resMsg);
});

// 监听图片消息
weixin.imageMsg(function(msg) {
	console.log("[imageMsg received]");
	console.log(JSON.stringify(msg));
	weixin.sendMsg(msg);
});

// 监听位置消息
weixin.locationMsg(function(msg) {
	console.log("[locationMsg received]");
	console.log(JSON.stringify(msg));
	weixin.sendMsg(msg);
});

// 监听链接消息
weixin.urlMsg(function(msg) {
	console.log("[urlMsg received]");
	console.log(JSON.stringify(msg));
	weixin.sendMsg(msg);
});

// 监听事件消息
weixin.eventMsg(function(msg) {
	console.log("[eventMsg received]" + JSON.stringify(msg));
	
	// 调用客服接口发送消息
	// reqWx.sendNews('omshsweSKRDQ5jjmYmggeUlDxd-M', reqWx.access_token);
	// 回复消息
	var message = {
		"toUserName": msg.fromUserName,
		"fromUserName": msg.toUserName,
		"msgType": "confirm",
		"content": msg.msgType
	};
	weixin.sendMsg(message);
});

// 获取微信 access_token 
reqWx.getAccessToken(wxId,wxKey);
setInterval( function(){
	reqWx.getAccessToken(wxId,wxKey);
}, 3600000);

module.exports = app;
