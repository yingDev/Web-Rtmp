var RTMP = require('./node-rtmpapi');
var SimpleWebsocket = require('simple-websocket');

var url = "ws://127.0.0.1:1999";

var sock = new SimpleWebsocket(url);

sock.on('close', function()
{
	console.log("WTF... Socket Closed ");
});

sock.on('error', function(e)
{
	console.log("WTF... Socket Error: " + e);
});

sock.on('connect', function()
{
	var stream = new RTMP.rtmpSession(sock, true, function(me)
	{
		console.log("rtmpSession...cb..ss.");
		return;
		var msger = me.msg;
		me.Q.Q(0,function()
		{
			console.log("sending connect");
			var chunk = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:3}, {sock: sock, Q: me.Q});
			chunk.sendAmf0EncCmdMsg({
				cmd: 'connect', 
				transId:1, 
				cmdObj:
				{
					app:"live",
					tcUrl: "rtmp://0.0.0.0/live",
					fpad: false,
					capabilities: 15.0,
					audioCodecs: 3191,
					videoCodecs: 252,
					videoFunction: 1.0
				} 
				/*args:''*/});

			//read---
			//msger.loop();
		});
	});
});
