const { ngettext, msgid } = require('ttag');

const _ngt = ngettext;

module.exports = function (singular, plural, count) {
	const m = msgid`${singular}`;
	m._strs = singular; m._exprs = [];
	return _ngt(m, plural, count);
};