const PLUGIN_NAME = 'SiftChunksPlugin';

class SiftChunksPlugin {

	constructor(options) {
		this.options = options || {};
		if (!this.options.skip) {
			this.options.skip = [];
		}
		if (!this.options.removeUnnamed && !this.options.skip.length) {
			throw new Error(`${PLUGIN_NAME} missing options`);
		}
	}

	apply(compiler) {
		const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
		compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
			compilation.hooks.chunkAsset.tap(PLUGIN_NAME, (chunk, filename) => {
				if ((this.options.removeUnnamed && !chunk.name) || -1 < this.options.skip.indexOf(chunk.name)) {
					chunk.files.forEach((file) => {
						if (file.match(/.*\.js$/)) {
							logger.info(`removing ${file}`);
							delete compilation.assets[file];
							chunk.files.delete(file);
						}
					});
				}
			});
		});
	}
}

module.exports = SiftChunksPlugin;