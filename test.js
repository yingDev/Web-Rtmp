const WebRtmpPlayer = require('./WebRtmpPlayer');

var player = new WebRtmpPlayer('ws://127.0.0.1:1999', 'live', 'B011', 'rtmp://video.7uan7uan.com/live');
player.canvas.style['height'] = '100%';
document.getElementById("vidCont").appendChild(player.canvas);