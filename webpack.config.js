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
      }
    ]
  }
};
