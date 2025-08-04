import merge from 'lodash.merge';
import { UILocale } from "./UILocale";

let extensions;
let jsLoadAttempt = 0;

export const ExtensionLoader = {
	getExtension: async function (name) {
		if (!jsLoadAttempt && EnvConfig.extensionPoint) {
			jsLoadAttempt = 1;
			if (!UILocale.isDefault()) {
				try {
					extensions = await import(/* webpackIgnore: true */`${EnvConfig.extensionPoint}.${UILocale.current}.js`);
				} catch (e) { }
			}
			if (!extensions) {
				try {
					extensions = await import(/* webpackIgnore: true */`${EnvConfig.extensionPoint}.js`);
				} catch (e) { }
			}
		}
		return extensions ? extensions[name] : undefined;
	},
	installExtension: async function (name, ctx) {
		const ext = await this.getExtension(name);
		if (ext) {
			if (ext.requires) {
				for (const m in ext.requires) {
					ctx = merge(ctx, await import(/* webpackInclude: /\.js$/ */ /* webpackChunkName: "[request]" */`./cmn/${ext.requires[m]}`));
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