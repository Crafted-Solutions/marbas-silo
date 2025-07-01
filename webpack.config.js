const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackSkipAssetsPlugin = require('html-webpack-skip-assets-plugin').HtmlWebpackSkipAssetsPlugin;
const SiftChunksPlugin = require('sift-chunks-webpack-plugin');

const { version } = require(path.resolve(__dirname, 'package.json'));

module.exports = (env) => {
	const mode = env.development || env.WEBPACK_SERVE ? 'development' : 'production';
	const authModule = env.AuthModule || 'AuthModuleDynamic';

	const resolveAlias = {
		AuthModule: path.resolve(__dirname, `src/js/${authModule}.js`),
		'@crafted.solutions/marbas-core': path.resolve(__dirname, 'packages/core/src/js/index.js')
	};
	if (env.DEBUG_JSONEDITOR) {
		resolveAlias['@json-editor/json-editor'] = path.resolve(__dirname, "node_modules/@json-editor/json-editor/dist/nonmin/jsoneditor.js");
	}

	const extensionPoint = './marbas-silo.ext';
	if (env.WEBPACK_SERVE) {
		fs.mkdirSync(path.resolve(__dirname, 'dist'), { recursive: true });
		['js', 'css'].forEach(ext => {
			const xpfile = path.resolve(__dirname, 'dist', `${extensionPoint}.${ext}`);
			if (!fs.existsSync(xpfile)) {
				fs.closeSync(fs.openSync(xpfile, 'a'));
			}
		});
	}

	const chunks = {
		index: './src/js/index.js',
		libs: './src/js/libs.js',
		bs: './src/scss/bootstrap.scss'
	};

	const commonPageParams = {
		title: 'MarBas Silo',
		apiBaseUrl: 'https://localhost:7277/api/marbas',
		panelClasses: 'card card-body my-3 bg-light',
		mode: mode,
		extensionPoint: extensionPoint
	};
	const pageOptions = [{
		filename: 'index.html',
		template: 'src/index.hbs',
		chunks: ['bs', 'index', 'libs'],
		chunksSortMode: 'manual',
		excludeAssets: [/bs.*.js/],
		templateParameters: commonPageParams,
		meta: {
			viewport: 'width=device-width,initial-scale=1'
		}
	},];
	if ('AuthModuleDynamic' == authModule) {
		chunks.login = './src/js/login.js';
		pageOptions.push({
			filename: 'login.html',
			template: 'src/login.hbs',
			chunks: ['bs', 'login'],
			chunksSortMode: 'manual',
			excludeAssets: [/bs.*.js/],
			templateParameters: commonPageParams,
			meta: {
				viewport: 'width=device-width,initial-scale=1'
			}
		});
	}

	return {
		mode: mode,
		entry: chunks,
		devServer: {
			static: {
				directory: './dist'
			},
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
						extensions: ['.hbs'],
						helperDirs: [
							path.resolve(__dirname, 'src/hbhelpers')
						],
						partialResolver: (partial, callback) => {
							partial = partial.replace(/\/AuthModule$/, `/${authModule}`);
							callback(null, path.resolve(__dirname, `src/${partial}.hbs`));
						}
					}
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
							loader: 'sass-loader',
							options: {
								sassOptions: {
									quietDeps: true,
									silenceDeprecations: ['import']
								}
							}
						}
					]
				}
			]
		},
		plugins: [
			new webpack.DefinePlugin({
				_PACKAGE_VERSION_: JSON.stringify(version)
			}),
			...pageOptions.map((opts) => {
				return new HtmlWebpackPlugin(opts);
			}),
			new HtmlWebpackSkipAssetsPlugin(),
			new MiniCssExtractPlugin(),
			new SiftChunksPlugin({
				removeUnnamed: true,
				skip: 'bs'
			})
		],
		output: {
			filename: '[name].bundle.js',
			path: path.resolve(__dirname, 'dist'),
			clean: true
		},
		optimization: {
			removeEmptyChunks: true,
			splitChunks: {
				cacheGroups: {
					panvaVendor: {
						test: /[\\/]node_modules[\\/](oauth4webapi|jose)[\\/]/,
						name: 'libs-panva',
						chunks: 'all'
					},
					handlebarsVendor: {
						test: /[\\/]node_modules[\\/](handlebars)[\\/]/,
						name: 'libs-hb',
						chunks: 'all'
					}
				}
			},
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