var webpack = require('webpack');

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
	plugins:[new webpack.optimize.DedupePlugin()]
};