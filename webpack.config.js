const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackSkipAssetsPlugin = require('html-webpack-skip-assets-plugin').HtmlWebpackSkipAssetsPlugin;
const SiftChunksPlugin = require('sift-chunks-webpack-plugin');
const { xgtHandlebarsPot, xgtMergePo, xgtGetJson, xgtUpdatePo } = require('xgettext-helpers');

const { version } = require(path.resolve(__dirname, 'package.json'));
const { config } = require(path.resolve(__dirname, 'package.json')) || {};

module.exports = async (env) => {
	const mode = env.development || env.WEBPACK_SERVE ? 'development' : 'production';
	const authModule = env.AuthModule || 'AuthModuleDynamic';

	const resolveAlias = {
		AuthModule: path.resolve(__dirname, `src/js/${authModule}.js`),
		'@crafted.solutions/marbas-core': path.resolve(__dirname, 'packages/core/src/js/index.js')
	};
	if (env.DEBUG_JSONEDITOR) {
		resolveAlias['@json-editor/json-editor'] = path.resolve(__dirname, "node_modules/@json-editor/json-editor/dist/nonmin/jsoneditor.js");
	}

	const locales = config.locales && config.locales.length ? config.locales.filter((val => val != config.defaultLocale)) : [];

	const extensionPoint = './marbas-silo.ext';
	if (env.WEBPACK_SERVE) {
		fs.mkdirSync(path.resolve(__dirname, 'dist'), { recursive: true });
		const checkXpFile = (fname) => {
			const xpfile = path.resolve(__dirname, 'dist', fname);
			if (!fs.existsSync(xpfile)) {
				fs.closeSync(fs.openSync(xpfile, 'a'));
			}
		};
		['js', 'css'].forEach(ext => {
			checkXpFile(`${extensionPoint}.${ext}`);
			if ('js' == ext && locales.length) {
				locales.forEach((loc) => {
					checkXpFile(`${extensionPoint}.${loc}.${ext}`);
				});
			}
		});
	}

	if (locales.length) {
		const srcDir = path.resolve(__dirname, 'src');
		const i18nDir = path.resolve(__dirname, 'i18n');
		if (!fs.existsSync(i18nDir)) {
			fs.mkdirSync(i18nDir);
		}

		await xgtUpdatePo(srcDir, i18nDir, locales, 'index');

		const staticPot = path.resolve(__dirname, 'i18n/static.pot');
		await xgtHandlebarsPot(srcDir, staticPot, {
			cwd: __dirname,
		});
		await xgtMergePo(staticPot, i18nDir, locales);
	}


	const chunks = {
		index: { import: './src/js/index.js', dependOn: 'shared' },
		libs: './src/js/libs.js',
		bs: './src/scss/bootstrap.scss',
		shared: 'ttag'
	};

	const pageBase = {
		chunksSortMode: 'manual',
		excludeAssets: [/bs.*.js/],
		meta: {
			viewport: 'width=device-width,initial-scale=1'
		}
	};
	const commonPageParams = {
		title: 'MarBas Silo',
		apiBaseUrl: env.WEBPACK_SERVE ? 'https://localhost:7277/api/marbas' : '/api/marbas',
		panelClasses: 'card card-body my-3 bg-light',
		mode: mode,
		extensionPoint: extensionPoint,
		locale: config.defaultLocale,
		defaultLocale: config.defaultLocale,
		locales: config.locales || []
	};
	const pageOptions = [{
		...pageBase,
		templateParameters: Object.assign({}, commonPageParams),
		...{
			filename: 'index.html',
			template: 'src/index.hbs',
			chunks: ['bs', 'shared', 'index', 'libs']
		}
	}];
	if (locales.length) {
		for (const loc of locales) {
			const poFile = path.resolve(__dirname, `i18n/static.${loc}.po`);
			if (!fs.existsSync(poFile)) {
				continue;
			}
			const data = await xgtGetJson(poFile);
			const page = {
				...pageBase,
				templateParameters: Object.assign({}, commonPageParams, {
					locale: loc,
					localeData: data
				}),
				...{
					filename: `index.${loc}.html`,
					template: 'src/index.hbs',
					chunks: ['bs', 'shared', 'index', 'libs']
				}
			};
			pageOptions.push(page);
		}
	}
	if ('AuthModuleDynamic' == authModule) {
		chunks.login = { import: './src/js/login.js', dependOn: 'shared' };
		pageOptions.push({
			...pageBase,
			templateParameters: Object.assign({}, commonPageParams),
			...{
				filename: 'login.html',
				template: 'src/login.hbs',
				chunks: ['bs', 'shared', 'login']
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
			alias: resolveAlias,
			fallback: { path: false }
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
				},
				{
					test: /\.po$/,
					loader: 'webpack-po-loader'
				}
			]
		},
		plugins: [
			new webpack.DefinePlugin({
				_PACKAGE_VERSION_: JSON.stringify(version),
				_DEVELOPMENT_: JSON.stringify('development' == mode)
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