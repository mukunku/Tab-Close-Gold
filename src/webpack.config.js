let webpack = require('webpack');
module.exports = {
  entry: {
    'background': './background.js',
    'options': './options.js',
    'popup': './popup.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: __dirname
  },
  devtool: 'source-map',
  plugins: [
    //Need to define global jQuery/$ objects for slickgrid :(
    new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery"
    })
  ],
  resolve: {
    alias: {
        jquery: "slickgrid/node_modules/jquery/src/jquery" //Use slickgrid's jQuery version for now.
    }
  }
};