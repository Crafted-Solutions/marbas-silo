let extensions;
let jsLoadAttempt = 0;
let cssLoadAttempt = 0;

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
			if ('function' == typeof ext.installAsync) {
				await ext.installAsync(ctx);
			} else {
				ext.install(ctx);
			}
		}
	}
};