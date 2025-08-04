const { gettext } = require('ttag');

const _gt = gettext;

module.exports = function (msgid) {
	return _gt(msgid);
};