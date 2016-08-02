var iconv = require( 'iconv-lite' );
var BufferHelper = require('bufferhelper'); 
var cheerio = require('cheerio'); 
var qs = require('querystring');
var async = require('async')

var Request = require('request');
var RsaEncrypt = require("./rsa").RSAKey;
var cookieColl = Request.jar()
var request = Request.defaults({jar: cookieColl});

var extend = require('./extend')

function getJsonObj(body){
    var start = body.indexOf("{");
    var end = body.lastIndexOf("}");
    var jsonStr = body.substr(start,end -start + 1);
    var responseJson = JSON.parse(jsonStr);
    return responseJson;
}

function log(str){	
	console.log(str)
}

function weibo_login(login_callback) {
    var userName = "weibo";
    var password = "weibo";

    var preLoginUrl = "http://login.sina.com.cn/sso/prelogin.php?entry=weibo&callback=sinaSSOController.preloginCallBack&su=&rsakt=mod&checkpin=1&client=ssologin.js(v1.4.11)&_=" + (new Date()).getTime();

    async.waterfall([
        function (callback) {
            request({
                "uri": preLoginUrl,
                "encoding": "utf-8"
            }, callback);
        },
        function (responseCode, body, callback) {
            var responseJson = getJsonObj(body);

            log(responseJson);
            log("Prelogin Success. ");

            var loginUrl = 'http://login.sina.com.cn/sso/login.php?client=ssologin.js(v1.4.18)';
            var loginPostData = {
                entry: "sinawap", //"weibo"
                gateway: "1",
                from: "",
                savestate: "7",
                useticket: "1",
                vsnf: "1",
                su: "",
                service: "sinawap",//"miniblog",
                servertime: "",
                nonce: "",
                pwencode: "rsa2",
                rsakv: "1330428213",
                sp: "",
                sr: "1366*768",
                encoding: "UTF-8",
                prelt: "282",
                url: "http://weibo.cn",
                returntype: "META"
            };
            /**
             * http://weibo.com/ajaxlogin.php?framelogin=1&callback=parent.sinaSSOController.feedBackUrlCallBack
             */

            loginPostData.su = new Buffer(userName).toString('base64');

            var rsaKey = new RsaEncrypt();
            rsaKey.setPublic(responseJson.pubkey, '10001');
            var pwd = rsaKey.encrypt([responseJson.servertime, responseJson.nonce].join("\t") + "\n" + password);

            log([responseJson.servertime, responseJson.nonce].join("\t") + "\n" + password);

            loginPostData.sp = pwd;

            loginPostData.servertime = responseJson.servertime;
            loginPostData.nonce = responseJson.nonce;
            loginPostData.rsakv = responseJson.rsakv;

            log("pk:" + responseJson.pubkey);
            log("su:" + loginPostData.su);
            log("pwd:" + loginPostData.sp);

            request.post({
                "uri": loginUrl,
                "encoding": null,  //GBK编码 需要额外收到处理,
                 form: loginPostData

            }, callback);
        },
        function (responseCode, body, callback) {
            body = iconv.decode(body,"GBK");

            var errReason = /reason=(.*?)\"/;
            var errorLogin = body.match(errReason);

            if (errorLogin) {
               callback("登录失败,原因:" + errorLogin[1]);
            }
            else {
                var urlReg = /location\.replace\(\'(.*?)\'\)./;
                var urlLoginAgain = body.match(urlReg);

                if (urlLoginAgain) {

                    request({
                        "uri": urlLoginAgain[1],
                        "encoding": "utf-8"
                    }, callback);
                }
                else {
                    callback("match failed");
                }
            }
        },
        function (responseCode, body, callback) {
            console.log("登录完成");
            login_callback()
            //var responseJson = getJsonObj(body);
            //console.log(responseJson);
        }
    ], function (err) {
        console.log(err)
    });
}

/*
 http://weibo.cn/search/mblog
 keyword = %E5%AE%8C%E7%BE%8E%E4%B8%96%E7%95%8C
 advancedfilter = 1
 nick = dota2
 endtime = 20160801
 sort = time
 page = 2

 转发 http://weibo.cn/repost/DC0YRc1ah?uid=3083660057
 评论 http://weibo.cn/comment/DC0YRc1ah?&uid=3083660057
*/

function request_weibo(param,callback){	

	param.page = param.page || 1
	param.type = param.type || 'repost'

	var url = 'http://weibo.cn/'+ param.type +'/' + param.vid + '?' + qs.stringify({uid:param.uid,page:param.page})

	request.get({url:url,headers: {
   	 'User-Agent': 'spider'
	}},function(err,response,body){
		if(err){
			log("微博内容查找失败:");
			log(err);
			return;
		}
		var $ = cheerio.load(body)
		
		callback($,body)
	});
}

function loop_request_weibo(len,param,callback){	
	
	var queue = []
	for(var i=1;i<=len;i++){
		var obj = extend({},param)	
		obj.page = i
		queue.push(obj)
	}
	var proess = function(arg, done){	
		request_weibo(arg, function(html){	
			var data = getItemData(html)
			done(null,data)
		})
	}
	async.map(queue, proess, function(err, data){
		var result = []
		data.forEach(function(el){
			result = result.concat(el)
		})
		callback(result)
	});

}

function getPages($){
	var pg = $('[name=mp]').val()
	if(pg){
		return pg
	}else{	
		return 1
	}
}

function getItemData($){	
	var $posts = $('.c')
	var result = []
	$posts.each(function(el){
		var $post = $(this)
		var date = $post.find('.ct')
		var hot = $post.find('.kt')
		if(date.length && !hot.lenght && $post.attr('id') != 'M_'){	
			var title = $post.html()
			var item = {	
				date: date.html(),
				title: title
			}
			result.push(item)
		}
	})
	return result
}

function getPageData($){
	var html = $('body').html()
	var m = function(str){	
		var a = html.match(str) 
		return (a && a.length) ? a[1] : 0
	}
	return {	
		topic: $('#M_').html(),
		rn: m(/>&#x8F6C;&#x53D1;\[(\d+)\]/),
		cn: m(/>&#x8BC4;&#x8BBA;\[(\d+)\]/),
		data: []
	}
}


function search_weibo(req, res, next){
	//weibo_login(function(){
		request_weibo(req.query,function(html){	
			
			var pg = getPages(html)
			var result = getPageData(html)
			if(req.query.kw){
				var j = cheerio.load('<body>'+ req.query.kw +'</body>')
				result.kw = j('body').html()
			}
			if(pg === 1){
				result.data = getItemData(html)
				res.send(result)
			}else{
				loop_request_weibo(pg,req.query,function(data){	
					result.data = data
					res.send(result)
				})
			}
		})		 
	//});
}

//weibo_login(function(){})

module.exports = {
	search_weibo: search_weibo,
	weibo_login: weibo_login
};