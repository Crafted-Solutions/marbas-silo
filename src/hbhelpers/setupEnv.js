const Handlebars = require('handlebars');

const knownKeys = ['mode', 'apiBaseUrl', 'panelClasses', 'extensionPoint', 'defaultLocale', 'locales'];

module.exports = function () {
	const env = {};
	for (const k of knownKeys) {
		env[k] = this[k];
	}
	return new Handlebars.SafeString(`
<script type="text/javascript">
	const EnvConfig = ${JSON.stringify(env)};
</script>`);
};