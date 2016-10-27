var RTMP = require('./node-rtmpapi');
var SimpleWebsocket = require('simple-websocket');
var Buffer = require('buffer').Buffer;

//var Broadway = require('broadway-player');
var flvee = require('flvee');
var flvParser = new flvee.Parser();

const FLV_HEADER = new Buffer([ 'F'.charCodeAt(0), 'L'.charCodeAt(0), 'V'.charCodeAt(0), 0x01,
	0x01,				/* 0x04 == audio, 0x01 == video */
	0x00, 0x00, 0x00, 0x09,
	0x00, 0x00, 0x00, 0x00
]);

var vidCont = document.getElementById("vidCont");
var player = new Player({
 useWorker: false,
 webgl: true
});
 vidCont.appendChild(player.canvas);

flvParser.on("readable", function() {
	var e;
	while (e = flvParser.read())
	{
		console.log("VIDEO PACKET PARSED: ");
		console.log(JSON.stringify(e));
		if(e.packet)//video
		{
			console.log("FEEDING PLAYER DATA...");
			player.decode(e.packet.data);
		}
	}
});


var url = "ws://127.0.0.1:1999";

var sock = new SimpleWebsocket(url);
sock.setMaxListeners(100);

sock.on('close', function()
{
	console.log("WTF... Socket Closed ");
});

sock.on('error', function(e)
{
	console.log("WTF... Socket Error: " + e);
});

sock.on('data', function(data)
{
	console.log("Note: incoming raw data: " + data.length + " bytes");
});

sock.on('connect', function()
{
    var transId = 0;
	var stream = new RTMP.rtmpSession(sock, true, function(me)
	{
		console.log("rtmpSession...cb...");
		var invokeChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:3}, {sock: sock, Q: me.Q, debug: true});
		invokeChannel.invokedMethods = {}; //用来保存invoke的次数，以便收到消息的时候确认对应结果

		var videoChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:8}, {sock: sock, Q: me.Q, debug: true});

        var channel2 = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:2}, {sock: sock, Q: me.Q, debug: true});

		var msger = me.msg;
		me.Q.Q(0,function()
		{
			console.log("sending connect");
			//var chunk = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:3}, {sock: sock, Q: me.Q, debug: true});
			//todo: 先确定可行，再重构
			invokeChannel.sendAmf0EncCmdMsg({
				cmd: 'connect', 
				transId:++transId,
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
			invokeChannel.invokedMethods[transId] = 'connect';
		});

		me.Q.Q(0, function()
		{
			console.log("Begin LOOP");
			msger.loop(handleMessage);
		});

        function handleMessage(chunkMsg)
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
	                var lastInvoke = invokeChannel.invokedMethods[msg.transId];
	                if(lastInvoke)
	                {
		                console.log("<--Got Invoke Result for: " + lastInvoke);
		                delete invokeChannel.invokedMethods[msg.transId];
	                }

                    if(lastInvoke == "connect") //确认是connect的结果
                    {
                        console.log("sending createStream");
                        invokeChannel.sendAmf0EncCmdMsg({
                            cmd: 'createStream',
                            transId: ++transId,
                            cmdObj: null
                        });
                        invokeChannel.invokedMethods[transId] = 'createStream';
                    }
                    else if(lastInvoke == "createStream") //确认是createStream的结果
                    {
	                    videoChannel.chunk.msgStreamId = msg.info;
                        //send play ??
                        videoChannel.sendAmf0EncCmdMsg({
                            cmd: 'play',
                            transId: ++transId,
                            cmdObj:null,
                            streamName:'B012',
	                        start:-2

                        },0);
	                    invokeChannel.invokedMethods[transId] = "play";
                    }
                }
                else if(msg.cmd == 'onBWDone')
                {
                    console.log("onBWDone");
                    //send checkBW
                    invokeChannel.sendAmf0EncCmdMsg({
                        cmd: '_checkbw',
                        transId: ++transId,
                        cmdObj:null
                    },0);
	                invokeChannel.invokedMethods[transId] = "_checkbw";
                }
            }

            if(chunk.msgTypeText == "video")
            {
	            var data = chunk.data;

	            var vidHdr = new Buffer(11);
	            vidHdr.writeUInt8(0x09,0);//type video

	            vidHdr.writeUInt16BE(chunk.data.length >> 8, 1); //packet len
	            vidHdr.writeUInt8(chunk.data.length & 0xFF, 3);

	            vidHdr.writeInt32BE(0, 4); //ts
	            vidHdr.writeUInt16BE(0 >> 8, 8); //stream id
	            vidHdr.writeUInt8(0 & 0xFF, 10);

	            var prevSize = new Buffer(4);
	            prevSize.writeUInt32BE(data.length + 11);

	            flvParser.write(Buffer.concat([vidHdr, data, prevSize]));
	            //
            }

	        if(chunk.msgTypeText == "amf0meta" && msg.cmd == 'onMetaData')
	        {
		        console.log("onmetadata");
		        var chunkData = chunk.data;

		        var metaHdr = new Buffer(11);
		        metaHdr.writeUInt8(0x12,0);//type metadata

		        metaHdr.writeUInt16BE(chunkData.length >> 8, 1); //packet len
		        metaHdr.writeUInt8(chunkData.length & 0xFF, 3);

		        metaHdr.writeInt32BE(0, 4); //ts
		        metaHdr.writeUInt16BE(0 >> 8, 8); //stream id
		        metaHdr.writeUInt8(0 & 0xFF, 10);

		        var prevSize2 = new Buffer(4);
		        prevSize2.writeUInt32BE(chunkData.length + 11);

		        flvParser.write(Buffer.concat([FLV_HEADER,metaHdr, chunkData, prevSize2]));

		        //var prevSize = new Buffer(4);
			    //prevSize.writeUInt32BE(chunkData.length + 11);
			    //flvParser.write(prevSize);
	        }

            me.Q.Q(0,function(){
                msger.loop(handleMessage);
            });
        }
	});
});
