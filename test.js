var RTMP = require('./node-rtmpapi');
var SimpleWebsocket = require('simple-websocket');
var Buffer = require('buffer').Buffer;

const H264_SEP = new Buffer([0,0,0,1]);
const FRAME_Q_SIZE = 15;

var frameQ = [];
var fps = 1000.0/20;
var lastRenderTime = 0;
var vidCont = document.getElementById("vidCont");
var player = new Player({
    useWorker: false,
    webgl: true
});
player.canvas.style['height'] = '100%';
vidCont.appendChild(player.canvas);

var decoder = new Decoder();
decoder.onPictureDecoded = function(buffer, width, height, infos)
{
    if(frameQ.length === FRAME_Q_SIZE)
    {
        console.log("** drop oldest frame!");
        frameQ.shift(); //如果播放速度跟不上，扔掉最老那一帧
    }
    frameQ.push({data: Buffer.from(buffer), width: width, height: height, canvasObj: player.canvasObj});
};
function drawFrame()
{
    var now = new Date();//如果播放速度跟不上网络速度，跳帧
    var dur = Math.abs(now - lastRenderTime);
    var frameInterval = 1000 / fps;
    var skipFrame = Math.floor(dur / frameInterval) - 1;
    if(lastRenderTime && skipFrame > 0)
    {
        console.log("SkipFrmae = " + skipFrame);
        while(skipFrame-- > 0 && frameQ.length > 0) frameQ.shift();
    }

    var frame = frameQ.shift();
    if(frame)
    {
        player.renderFrameWebGL(frame);
    }
    lastRenderTime = now;
}


var url = "ws://127.0.0.1:1999";

var sock = new SimpleWebsocket(url);
sock.setMaxListeners(100);

sock.on('connect', function()
{
    var transId = 0;
	var stream = new RTMP.rtmpSession(sock, true, function(me)
	{
		console.log("rtmpSession...cb...");
		var invokeChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:5}, {sock: sock, Q: me.Q, debug: false});
		invokeChannel.invokedMethods = {}; //用来保存invoke的次数，以便收到消息的时候确认对应结果

		var videoChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:8}, {sock: sock, Q: me.Q, debug: false});

        var channel2 = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:2}, {sock: sock, Q: me.Q, debug: false});

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
                            streamName:'B011',
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
                var chunkData = chunk.data;
                if (chunkData.length > 4)
                {
                    if (chunkData[1] === 1)
                    {
                        chunkData = Buffer.concat([H264_SEP, chunkData.slice(9)]);
                    }
                    else if (chunkData[1] === 0)
                    {
                        var spsSize = (chunkData[11] << 8) | chunkData[12];
                        var spsEnd = 13 + spsSize;
                        chunkData = Buffer.concat([H264_SEP, chunkData.slice(13, spsEnd), H264_SEP, chunkData.slice(spsEnd + 3)]);
                    }
                    decoder.decode(chunkData);
                    //player.decode(chunkData);
                }
            }

	        if(chunk.msgTypeText == "amf0meta" && msg.cmd == 'onMetaData')
	        {
		        console.log("onmetadata");
                fps = chunk.msg['event']['framerate'];
                console.log("fps = "+fps);
                setInterval(drawFrame, 1000.0/fps);
	        }

            me.Q.Q(0,function()
            {
                msger.loop(handleMessage);
            });
        }
	});
});
