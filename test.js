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
		console.log("rtmpSession...cb...");
		var invokeChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:3}, {sock: sock, Q: me.Q, debug: true});
		invokeChannel.transId = 0;
		invokeChannel.invokedMethods = []; //用来保存invoke的次数，以便收到消息的时候确认对应结果

		var videoChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:8}, {sock: sock, Q: me.Q, debug: true});
		videoChannel.transId = 0;

		var msger = me.msg;
		me.Q.Q(0,function()
		{return;
			console.log("sending connect");
			//var chunk = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:3}, {sock: sock, Q: me.Q, debug: true});
			//todo: 先确定可行，再重构
			invokeChannel.sendAmf0EncCmdMsg({
				cmd: 'connect', 
				transId:++invokeChannel.transId,
				cmdObj:
				{
					app:"live",
					tcUrl: "rtmp://video.7uan7uan.com/live",
					fpad: false,
					capabilities: 15.0,
					audioCodecs: 3191,
					videoCodecs: 252,
					videoFunction: 1.0
				}
			});
			invokeChannel.invokedMethods.push('connect');
		});

		me.Q.Q(0, function()
		{return;
			console.log("Begin LOOP");
			msger.loop(function(chunkMsg)
			{
				var chunk = chunkMsg.chunk;
				var msg = chunk.msg;

				console.log("GOT MESSAGE: " + chunk.msgTypeText);
				console.log("===========>\n" + JSON.stringify(msg));

				//connect -> windowSize -> peerBw -> connetcResult ->
				//createStream -> onBWDown -> _checkbw -> onBWDoneResult -> createStreamResult -> play

				if(chunk.msgTypeText == "amf0cmd")
				{
					if(msg.cmd == "_result")
					{
						var invokeIdx = -1;
						if((invokeIdx = invokeChannel.invokedMethods.indexOf("connect")) >= 0) //确认是connect的结果
						{
							invokeChannel.invokedMethods.splice(invokeIdx, 1);

							console.log("sending createStream");
							invokeChannel.sendAmf0EncCmdMsg({
								cmd: 'createStream',
								transId: ++invokeChannel.transId,
								cmdObj: null
							});
							invokeChannel.invokedMethods.push('createStream');
						}
						else if((invokeIdx = invokeChannel.invokedMethods.indexOf("createStream")) >= 0) //确认是createStream的结果
						{
							invokeChannel.invokedMethods.splice(invokeIdx, 1);
							//send play ??
							videoChannel.sendAmf0EncCmdMsg({
								cmd: 'play',
								transId: ++videoChannel.transId,
								cmdObj:{},
								streamName:"B012",
								start:0,
								duration:-1,
								reset:false
							});
						}

					}
					else if(msg.cmd == 'onBWDone')
					{
						console.log("onBWDone");
						//send checkBW
					}
				}

			});
		});
	});
});
