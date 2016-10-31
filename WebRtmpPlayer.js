var RTMP = require('./node-rtmpapi');
var SimpleWebsocket = require('simple-websocket');
var Buffer = require('buffer').Buffer;

const H264_SEP = new Buffer([0,0,0,1]);
const FRAME_Q_SIZE = 15;

class WebRtmpPlayer
{
	constructor(wsHost, app, streamName, tcUrl)
	{
		this._frameQ = [];
		this._fps = NaN;
		this._lastRenderTime = 0;

		this._decoder = new Decoder();
		this._player = new Player({ useWorker: false, webgl: true });
		this._url = {host: wsHost, app: app, tcUrl: tcUrl, stream: streamName};

		this._decoder.onPictureDecoded = this._onPictureDecoded.bind(this);

		this._rtmpTransId = 0;
		this._invokeChannel = null;
		this._videoChannel = null;
		this._rtmpSession = null;

		this._sock = new SimpleWebsocket(this._url.host);
		this._sock.setMaxListeners(100);
		this._sock.on('connect', ()=>
		{
			new RTMP.rtmpSession(this._sock, true, this._onRtmpSessionCreated.bind(this));
		})
	}

	get canvas() { return this._player.canvas; }

	_onPictureDecoded(buffer, width, height, infos)
	{
		if(this._frameQ.length === FRAME_Q_SIZE)
		{
			console.log("** drop oldest frame!");
			this._frameQ.shift(); //如果播放速度跟不上，扔掉最老那一帧
		}
		this._frameQ.push({data: Buffer.from(buffer), width: width, height: height, canvasObj: this._player.canvasObj});
	}

	_drawFrame()
	{
		var now = new Date();//如果播放速度跟不上网络速度，跳帧
		var skipFrame = Math.floor(Math.abs(now - this._lastRenderTime) / (1000 / this._fps) ) - 1;
		if(this._lastRenderTime && skipFrame > 0)
		{
			console.log("SkipFrmae = " + skipFrame);
			while(skipFrame-- > 0 && this._frameQ.length > 0) this._frameQ.shift();
		}

		var frame = this._frameQ.shift();
		if(frame)
		{
			this._player.renderFrameWebGL(frame);
		}
		this._lastRenderTime = now;
	}

	_rtmpConnect()
	{
		this._rtmpSession.Q.Q(0,() =>
		{
			console.log("sending connect");

			this._invokeChannel.sendAmf0EncCmdMsg({
				cmd: 'connect',
				transId:++this._rtmpTransId,
				cmdObj:
				{
					app: this._url.app,
					tcUrl: this._url.tcUrl,
					fpad: false,
					capabilities: 15.0, //note: 我不知道这些参数什么鬼，依据rtmpdump分析出来的
					audioCodecs: 3191,
					videoCodecs: 252,
					videoFunction: 1.0
				}
			});
			this._invokeChannel.invokedMethods[this._rtmpTransId] = 'connect';
		});
	}

	_rtmpCreateStream()
	{
		this._rtmpSession.Q.Q(0, ()=>
		{
			console.log("sending createStream");
			this._invokeChannel.sendAmf0EncCmdMsg({
				cmd: 'createStream',
				transId: ++this._rtmpTransId,
				cmdObj: null
			});
			this._invokeChannel.invokedMethods[this._rtmpTransId] = 'createStream';
		});
	}

	_rtmpSendPlay(msgStreamId)
	{
		this._rtmpSession.Q.Q(0, ()=>
		{
			this._videoChannel.chunk.msgStreamId = msgStreamId;
			//send play ??
			this._videoChannel.sendAmf0EncCmdMsg({
				cmd: 'play',
				transId: ++this._rtmpTransId,
				cmdObj:null,
				streamName: this._url.stream,
				start:-2

			},0);
			this._invokeChannel.invokedMethods[this._rtmpTransId] = "play";
		});
	}

	_onRtmpSessionCreated(session)
	{
		this._rtmpSession = session;
		console.log("rtmpSession...cb...");
		this._invokeChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:5}, {sock: this._sock, Q: session.Q, debug: false});
		this._invokeChannel.invokedMethods = {}; //用来保存invoke的次数，以便收到消息的时候确认对应结果
		this._videoChannel = new RTMP.rtmpChunk.RtmpChunkMsgClass({streamId:8}, {sock: this._sock, Q: session.Q, debug: false});

		session.Q.Q(0,this._rtmpConnect.bind(this));
		session.Q.Q(0, () =>
		{
			console.log("Begin LOOP");
			session.msg.loop(this._handleRtmpMessage.bind(this));
		});
	}

	 _handleRtmpMessage(chunkMsg)
	{
		var chunk = chunkMsg.chunk;
		var msg = chunk.msg;

		console.log("GOT MESSAGE: " + chunk.msgTypeText);
		//console.log("===========>\n" + JSON.stringify(msg));

		if(chunk.msgTypeText == "amf0cmd")
		{
			if(msg.cmd == "_result")
			{
				var lastInvoke = this._invokeChannel.invokedMethods[msg.transId];
				if(lastInvoke)
				{
					console.log("<--Got Invoke Result for: " + lastInvoke);
					delete this._invokeChannel.invokedMethods[msg.transId];
				}

				switch (lastInvoke)
				{
					case 'connect':
						return this._rtmpCreateStream();
					case 'createStream':
						return this._rtmpSendPlay(msg.info);
				}
			}
		}

		if(chunk.msgTypeText == "video")
		{
			//提取h264流
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
				this._decoder.decode(chunkData);
			}
		}

		if(chunk.msgTypeText == "amf0meta" && msg.cmd == 'onMetaData')
		{
			console.log("onmetadata");
			this._fps = chunk.msg['event']['framerate'];
			console.log("fps = "+this._fps);
			setInterval(this._drawFrame.bind(this), 1000.0/this._fps); //todo: clear
		}

		this._rtmpSession.Q.Q(0,()=>
		{
			this._rtmpSession.msg.loop(this._handleRtmpMessage.bind(this));
		});
	}
}

module.exports = WebRtmpPlayer;