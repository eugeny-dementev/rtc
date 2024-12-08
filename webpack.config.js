module.exports = {
  mode: 'development',
  entry: './main.js',
  output: {
    filename: 'bundle.js',
  },
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
  },
};
