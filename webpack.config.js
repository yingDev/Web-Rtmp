var webpack = require('webpack');
const WebpackShellPlugin = require('webpack-shell-plugin');

module.exports = {
    entry: "./test.js",
    output: {
        path: __dirname + "/build/",
        filename: "bundle.js"
    },
    devtool: "source-map",
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /(node_modules, build)/,
                loader: 'babel',
	            query: {
		            presets: ['es2015']
	            }
            }
        ]
    },
	plugins:[
		new webpack.optimize.DedupePlugin(),
		new WebpackShellPlugin({
			onBuildStart:['say hello'],
			onBuildEnd:[
				'sed "s/{{buildTime}}/$(date)/g" index.template.html > index.html',
				'say world; open "/Applications/Google Chrome.app"',
				'sleep 1; say chrome & osascript ./misc/reloadChrome.scpt "http://localhost:63342/web-rtmp/index.html"'
			],
			dev:false}
		)
	]
};
