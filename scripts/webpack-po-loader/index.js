const { xgtGetJson } = require('xgettext-helpers');

module.exports = function (source) {
	const callback = this.async();
	xgtGetJson(this.resourcePath, 'string').then(res => {
		callback(null, `export default ${res}`);
	}).catch(err => {
		callback(err);
	});
	// return `export default { "source": "${this.resourcePath}" }`;
}