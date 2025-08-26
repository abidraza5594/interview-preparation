const { ProvidePlugin } = require('webpack');

module.exports = {
  resolve: {
    fallback: {
      path: false,
      fs: false,
    }
  },
  plugins: [
    new ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      }
    ]
  }
};
