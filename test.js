const WebRtmpPlayer = require('./WebRtmpPlayer');

//note: tcUrl是原始rtmp地址，不含流名称。参见rtmp spec
alert('请在test.js中设置你的 播放参数');
var player = new WebRtmpPlayer('ws://127.0.0.1:1999', '<app>', '<streamName>', 'rtmp://<rtmp_server>/<app>');
player.canvas.style['height'] = '100%';
document.getElementById("vidCont").appendChild(player.canvas);
