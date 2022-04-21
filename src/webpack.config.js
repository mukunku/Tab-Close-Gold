let webpack = require('webpack');
 
module.exports = (env, argv) => {
  //var isProd = argv.mode === 'production' ? true : false;
  return {
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
          jquery: "slickgrid/lib/jquery-3.1.0" //Use slickgrid's jQuery version for now.
      }
    }
  }
};