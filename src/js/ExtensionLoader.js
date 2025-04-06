import merge from 'lodash.merge';

let extensions;
let jsLoadAttempt = 0;

export const ExtensionLoader = {
	getExtension: async function (name) {
		if (!jsLoadAttempt && EnvConfig.extensionPoint) {
			try {
				extensions = await import(/* webpackIgnore: true */`${EnvConfig.extensionPoint}.js`);
			} catch (e) {
			} finally {
				jsLoadAttempt = 1;
			}
		}
		return extensions ? extensions[name] : undefined;
	},
	installExtension: async function (name, ctx) {
		const ext = await this.getExtension(name);
		if (ext) {
			if (ext.requires) {
				for (const m in ext.requires) {
					ctx = merge(ctx, await import(/* webpackInclude: /\.js$/ */ /* webpackExclude: /^_.*\.js$/ */`./cmn/${ext.requires[m]}`));
				}
			}

			if ('function' == typeof ext.installAsync) {
				await ext.installAsync(ctx);
			} else {
				ext.install(ctx);
			}
		}
	}
};