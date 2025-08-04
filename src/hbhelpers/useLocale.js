const { useLocale, addLocale } = require('ttag');

module.exports = function (options) {
	if (this.localeData) {
		addLocale(this.locale, this.localeData);
		useLocale(this.locale);
	}
	return "";
};