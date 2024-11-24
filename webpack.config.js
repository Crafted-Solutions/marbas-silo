const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = (env) => {
	const mode = env.WEBPACK_SERVE ? 'development' : 'production';
	// TODO configure something different for production
	const authModule = 'AuthModuleBasic';
	
	return {
		mode: mode,
		entry: {
			index: './src/js/index.js',
			libs: './src/js/libs.js'
		},
		devServer: {
			static: './dist',
			port: 5500,
			watchFiles: ['src/**/*.hbs', 'src/**/*.js', 'src/**/*.*css']
		},
		devtool: "eval-cheap-source-map",
		resolve: {
			alias: {
				AuthModule: path.resolve(__dirname, `src/js/${authModule}.js`)
			}
		},
		module: {
			rules: [
				{
					test: /\.hbs$/,
					loader: 'handlebars-loader',
					options: {
						partialResolver: (partial, callback) => {
							partial = partial.replace(/\/AuthModule$/, `/${authModule}`);
							callback(null, path.resolve(__dirname, `src/${partial}.hbs`));
						}
					}
				},
				{
					test: /\.json$/,
					loader: 'json-loader'
				},
				{
					test: /\.css$/,
					use: [MiniCssExtractPlugin.loader, 'css-loader']
				},
				{
					test: /\.(scss)$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader
						},
						{
							loader: 'css-loader'
						},
						{
							loader: 'postcss-loader',
							options: {
								postcssOptions: {
									plugins: () => [
										require('autoprefixer')
									]
								}
							}
						},
						{
							loader: 'sass-loader'
						}
					]
				}
			]
		},
		plugins: [
			new HtmlWebpackPlugin({
				title: 'MarBas Silo',
				template: 'src/index.hbs',
				templateParameters: {
					apiBaseUrl: 'https://localhost:7277/api/marbas',
					panelClasses: 'card card-body my-3 bg-light'
				},
				meta: {
					viewport: 'width=device-width,initial-scale=1'
				}
			}),
			new MiniCssExtractPlugin()
		],
		output: {
			filename: '[name].bundle.js',
			path: path.resolve(__dirname, 'dist')
		},
		optimization: {
			minimizer: [
			  // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
				`...`,
				new CssMinimizerPlugin({
					parallel: true,
					minimizerOptions: {
						preset: [
						  "default",
						  {
							discardComments: { removeAll: true }
						  }
						]
					}
				})
			]
		}
	};
};