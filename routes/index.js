var express = require('express');
var router = express.Router();

var http = require('http')
var iconv = require( 'iconv-lite' );
var BufferHelper = require('bufferhelper'); 
var cheerio = require('cheerio'); 
var qs = require('querystring');
var async = require('async')
var fs = require('fs')

function extend() {
        var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options;
        if (target.constructor == Boolean) { deep = target; target = arguments[1] || {}; i = 2; }
        if (typeof target != "object" && typeof target != "function") { target = {} };
        if (length == i) { target = this; --i; }
        for (; i < length; i++) {
            if ((options = arguments[i]) != null) {
                for (var name in options) {
                    var src = target[name], copy = options[name];
                    if (target === copy) { continue; }
                    if (deep && copy && typeof copy == "object" && !copy.nodeType) {
                        target[name] = extend(deep, src || (copy.length != null ? [] : {}), copy);
                    } else if (copy !== undefined) { target[name] = copy; }
                }
            }
        }
        return target;
  };

function request_tieba(param,callback){	
  /*	
  	http://tieba.baidu.com/f/search/res
	isnew =1
	kw = csgo
	qw = %CD%EA%C3%C0%CA%C0%BD%E7
	rn = 10
	only_thread = 0|1
	pn = 1
	
	http://tieba.baidu.com/f/search/res?isnew=1&kw=csgo&qw=%CD%EA%C3%C0%CA%C0%BD%E7&rn=100&un=&only_thread=0&sm=1&sd=&ed=&pn=1

  */
	param.ie = 'utf-8'
  	param.isnew = 1
  	param.rn = param.rn || 50
	param.only_thread = param.only_thread || 0
	param.pn = param.pn || 1
	var url = 'http://tieba.baidu.com/f/search/res?' + qs.stringify(param)
	console.log(url)
	http.get(url, function(http_res) {
		var data = new BufferHelper(); 
		http_res.on('data', function (chunk) {
			data.concat(chunk);
		});
		http_res.on('end', function() {
			var html = data.toBuffer();
			html = iconv.decode( html, 'GBK' );
			var $ = cheerio.load(html)	
			callback($)
		});
	})
	.on('error', function(){	
		//错误处理
	});
}

function getPages($){
	var has_pages = $('.pager .last').length
	if(has_pages){
		var q = qs.parse($('.last').attr('href'))
		return q.pn
	}else{	
		return 1
	}
}

function getPageData($){	
	var $posts = $('.s_post')
	var result = []
	$posts.each(function(el){
		var $post = $(this)
		var title = $post.find('.p_title').html()
		var is_thread = title.indexOf('&#x56DE;&#x590D;:') >= 0 ? false : true
		var item = {	
			date: $post.find('.p_date').html(),
			title: title,
			is_thread: is_thread
		}
		result.push(item)
	})
	return result
}

function loop_request_tieba(len,param,callback){	
	
	var queue = []
	for(var i=1;i<=len;i++){
		var obj = extend({},param)	
		obj.pn = i
		queue.push(obj)
	}
	var proess = function(arg, done){	
		request_tieba(arg, function(html){	
			var data = getPageData(html)
			done(null,data)
		})
	}
	async.map(queue, proess, function(err, data){
		var result = []
		data.forEach(function(el){
			result = result.concat(el)
		})
		console.log('完成')
		callback(result)
	});

}

router.get('/',function(){	
	res.send({})
})

router.get('/search_tieba', function(req, res, next) {
  request_tieba(req.query,function(html){	
  	var pn = getPages(html)

	if(pn === 1){
		res.send({data:getPageData(html)})
	}else{
		loop_request_tieba(pn,req.query,function(data){	
			res.send({data:data})
		})
	}
  })
});

module.exports = router;
