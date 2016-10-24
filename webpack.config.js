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
			onBuildStart:['say webpack'],
			onBuildEnd:['say done & open "/Applications/Google Chrome.app"'],
			dev:false}
		)
	]
};