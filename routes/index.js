var express = require('express');
var router = express.Router();

var search_tieba = require('../middle/tieba');
var weibo = require('../middle/weibo');

function wblogin(cb){	
	var cb = cb || function(){}
	weibo.weibo_login(cb)
}


router.get('/',function(){	
	res.send({})
})

router.get('/search_tieba', search_tieba);
router.get('/search_weibo', weibo.search_weibo);
router.get('/weibo_login', function(req,res){
	weibo.weibo_login(function(data){	
		res.send(data)
	})	
});

module.exports = router;
