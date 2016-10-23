module.exports = {
    entry: "./test.js",
    output: {
        path: __dirname + "/build/",
        filename: "bundle.js"
    },
    devtool: "source-map",
    module: {
        loaders: [
        ]
    }
};