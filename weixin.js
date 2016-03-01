var crypto = require('crypto');
var config = require('cloud/config/weixin.js');
var debug = require('debug')('AV:weixin');
var AVQuery = require('cloud/query.js');
var AVUpdate = require('cloud/updateData.js');

exports.exec = function(params, cb) {
  if (params.signature) {
    checkSignature(params.signature, params.timestamp, params.nonce, params.echostr, cb);
  } else {
    receiveMessage(params, cb);
  }
}

// 验证签名
var checkSignature = function(signature, timestamp, nonce, echostr, cb) {
  var oriStr = [config.token, timestamp, nonce].sort().join('');
  var code = crypto.createHash('sha1').update(oriStr).digest('hex');
  debug('code:', code)
  if (code == signature) {
    cb(null, echostr);
  } else {
    var err = new Error('Unauthorized');
    err.code = 401;
    cb(err);
  }
}

// 接收普通消息,从微信接收的JSON格式信息的值都是数组格式的
var receiveMessage = function(msg, cb) {
	if(!msg.xml){
		cb(null, "success");//对微信发来的空信息回复"success"
	}else{
		//获取用户信息
		AV.Promise.when(
			AVQuery.getUser(msg.xml.ToUserName[0]),//服务器
			AVQuery.getUser(msg.xml.FromUserName[0])//发送消息的用户
		).then(function(server,user){
			//执行发送, checkMessage返回json格式的xml数据
			checkMessage(msg,cb,server,user);
		});	
	}
}
//回复文本信息
var sendXmlText = function(msg,str){
	return {
		xml:{
			ToUserName: msg.xml.FromUserName[0],
			FromUserName: '' + msg.xml.ToUserName + '',
			CreateTime: new Date().getTime(),
			MsgType: 'text',
			Content: str
		}
	};
}
//回复图文信息
var sendXmlNews = function(msg,dict){
	var xml = {
		ToUserName: msg.xml.FromUserName[0],
		FromUserName: '' + msg.xml.ToUserName + '',
		CreateTime: new Date().getTime(),
		MsgType: 'news'
	};
	for(var key in dict){
		xml[key] = dict[key];
	}
	return {xml:xml};
}
//回复音乐信息
var sendXmlMusic = function(msg,dict){
	var xml = {
		ToUserName: msg.xml.FromUserName[0],
		FromUserName: '' + msg.xml.ToUserName + '',
		CreateTime: new Date().getTime(),
		MsgType: 'music'
	};
	for(var key in dict){
		xml[key] = dict[key];
	}
	return {xml:xml};
}
//检测匹配到的歌星名
var checkMatchSinger = function(recText, page, msg){
	var hasNextPage = false;
	for(var singer in regSpecial){
		var reg = new RegExp(regSinger[singer]);
		if(reg.test(recText)){
			var i = 0;
			var str = "#" + singer + "的专辑#\n";
			for(var special in regSpecial[singer]){
				if(i > _LIST_LEN * page){
					hasNextPage = true;
					break;
				}
				i = i + 1;
				if(i > _LIST_LEN * (page - 1)){
					str = str + "【" + special + "】\n";
				}
			}
			str = str + "                   -" + page + "-\n* 输入专辑名获取歌曲列表";
			return {xml:sendXmlText(msg,str), hasNextPage:hasNextPage};
		}
	}
	return {xml:null,hasNextPage:hasNextPage};
}
//检测匹配到的专辑
var checkMatchSpecial = function(recText, page, msg){
	var hasNextPage = false;
	for(var singer in regSpecial){
		for(var special in regSpecial[singer]){			
			var reg = new RegExp(special.toLowerCase());
			if(reg.test(recText)){
				var i = 0;
				var str = "#" + singer + "-《" + special + "》#\n";
				for(var song in regSpecial[singer][special]){
					if(i > _LIST_LEN * page){
						hasNextPage = true;
						break;
					}
					i = i + 1;
					if(i > _LIST_LEN * (page - 1)){
						str = str+"【<a href=\""+regSpecial[singer][special][song]+"\">"+song+"</a>】\n";
					}
				}
				str = str + "                 -" + page + "-\n* 点击歌名进入歌曲页面";				
				return {xml:sendXmlText(msg,str),hasNextPage:hasNextPage};
			}
		}
	}
	return {xml:null,hasNextPage:false};
}
//检测是否匹配某歌曲名,直接搜索歌曲只返回一条曲目，不存在翻页
var checkMatchSong = function(recText,msg){
	var xml = null;
	if(regSong[recText]){
		var song = recText;
		xml = sendXmlNews(msg,{ArticleCount:1,Articles:{item:[{Title:regSong[song]["title"], Description:regSong[song]["desc"], PicUrl:regSong[song]["picUrl"], Url:regSong[song]["url"]}]}});
		return {xml:xml,hasNextPage:false};
	}
	if(regSong[recText.split("_m")[0]]){
		//匹配"歌曲名_m"，返回音乐
		var song = recText.split("_m")[0];
		xml = sendXmlMusic(msg,{Music:{Title:regSong[song]["title"], Description:regSong[song]["desc"], MusicUrl:regSong[song]["songUrl"]}});
		return {xml:xml,hasNextPage:false};
	}
}
//检测是否匹配文本信息
var checkMatchText = function(recText, page, msg){
	var res;
	//检测是否匹配歌手名
	res = checkMatchSinger(recText,page,msg);
	if(res.xml != null)
		return res;
	//检测是否匹配专辑名，发送第一页歌单
	res = checkMatchSpecial(recText,page,msg);
	if(res.xml != null)
		return res;
	//检测是否匹配歌曲名	
	res = checkMatchSong(recText,msg);
	if(res.xml == null){
		res.xml = sendXmlText(msg,"啊？主页菌看不懂啦！\n【<a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">更多操作</a>】");
	}
	return res;
}
//检测接收到的信息或事件入口
var checkMessage = function(msg,cb,server,user){
	var res = {xml:null,hasNextPage:false};
	try{
		if(msg.xml.MsgType[0] == "text"){
			var recText = msg.xml.Content[0].toLowerCase();//接收到的消息
			res = checkMatchText(recText,1,msg);
			AVUpdate.markUserRecord(server,user,"text",recText,1,res.hasNextPage);
			cb(null, res.xml);
		}else if(msg.xml.MsgType[0] == "event"){
			var event = msg.xml.Event[0];
			var eventKey = msg.xml.EventKey[0];
			if(event == "CLICK" && eventKey == "LIST_NEXT"){
				//console.log("[CLICK] LIST_NEXT");
				res.xml = AVQuery.queryResRecord(server,user).then(function(record){		
					if(record.get("hasNextPage") == true){
						//上一次查询的结果有下一页
						res = checkMatchText(record.get("searchMsg"),record.get("page")+1,msg);
					}else if(record.get("msgType") == "text"){
						//第一次点击下一页时，若上一次查询的类型为	文本，则重新发送结果并提示没有下一页
						res = checkMatchText(record.get("searchMsg"),record.get("page"),msg);
						res.xml.Content = res.xml.Content + "\n* <a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">已是最后一页啦！</a>";
					}else{
						//上一次请求类型为事件CLICK或者该用户未有操作，本次将不作响应
						console.log("[CLICK] In else");
						res.xml = null;
					}	
					AVUpdate.markUserRecord(server,user,"CLICK",record.get("searchMsg"),record.get("page")+1, res.hasNextPage);	//leancloud返回的对象要用get函数获取值,js对象直接属性名获取
					console.log("[CLICK] Res:"+JSON.stringify(res));
					cb(null,res.xml);
				},function(err){
					console.log("[Error] Fail to find any record of this user" + err.status);
					cb(null,"success");
				});
			}
		}else if(msg.xml.MsgType[0] == "voice"){
			res.xml = sendXmlText(msg,"亲，我们已收到你发来的语音，会尽快收听！\n【<a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">更多操作</a>】");
		}else if(msg.xml.MsgType[0] == "image"){
			res.xml = sendXmlText(msg,"亲，我们已收到你发来的图片，会尽快查看！\n【<a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">更多操作</a>】");
		}else if(msg.xml.MsgType[0] == "shortvideo"){
			res.xml = sendXmlText(msg,"亲，我们已收到你发来的小视频，会尽快查看！\n【<a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">更多操作</a>】");
		}else{
			res.xml = sendXmlText(msg,"亲，主页菌看不懂啦！\n【<a href=\"http://ac-bsy2hmmn.clouddn.com/1650b0312131d987.jpg\">更多操作</a>】");
		}
	}catch(err){
		console.log("[Error] checkMessage() with error code " + err);
		cb(null, sendXmlText(msg,"主页菌开了个小差～马上回来！"));
	}
}


//初始化
var _LIST_LEN = 4;
var regSinger = {"TaylorSwift":"taylor","Adele":"adele","BigBang":"bigbang","Maroon5":"maroon5"}
var regSpecial ;//{"taylor":{"1989":{"style":"http:"}}}
var regSong ;		//{"style":{"songUrl":"","title":"","desc":"","picUrl":"","link":""}}

AVQuery.init().then(function(result){
  regSpecial = result.special;
	regSong = result.song;
},function(rej){
	regSpecial = {};
	regSong = {};
});
