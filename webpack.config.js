const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = (env) => {
	const mode = env.WEBPACK_SERVE ? 'development' : 'production';
	// TODO configure something different for production
	const authModule = 'AuthModuleBasic';

	const resolveAlias = {
		AuthModule: path.resolve(__dirname, `src/js/${authModule}.js`),
		'@crafted.solutions/marbas-core': path.resolve(__dirname, 'packages/core/src/js/index.js')
	};
	if (env.DEBUG_JSONEDITOR) {
		resolveAlias['@json-editor/json-editor'] = path.resolve(__dirname, "node_modules/@json-editor/json-editor/dist/nonmin/jsoneditor.js");
	}

	return {
		mode: mode,
		entry: {
			index: './src/js/index.js',
			libs: './src/js/libs.js'
		},
		devServer: {
			static: './dist',
			port: 5500,
			watchFiles: ['src/**/*.hbs', 'src/**/*.js', 'src/**/*.*css', 'packages/**/src/**/*.js']
		},
		devtool: 'production' == mode ? false : "eval-cheap-source-map",
		resolve: {
			alias: resolveAlias
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
					panelClasses: 'border border-1 rounded navbar py-2 px-3 my-2 bg-light flex-shrink-0'
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