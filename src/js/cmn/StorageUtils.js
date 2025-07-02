const staticStorage = {};

export const StorageUtils = {
	checkAccess: function () {
		try {
			sessionStorage.getItem('test');
			return true;
		} catch (e) { }
		return false;
	},
	write: function write(key, value) {
		try {
			if (null == value) {
				sessionStorage.removeItem(key);
			} else {
				sessionStorage.setItem(key, 'object' == typeof value ? JSON.stringify(value) : value);
			}
		} catch (e) {
			console.warn(e);
			if (null == value) {
				delete staticStorage[key];
			} else {
				staticStorage[key] = value;
			}
		}
	},
	read: function read(key, asJson = false, defaultVal = undefined) {
		let result;
		try {
			result = sessionStorage.getItem(key);
			if (asJson && result) {
				result = JSON.parse(result);
			}
		} catch (e) {
			console.warn(e);
			result = staticStorage[key];
		}
		return null == result ? defaultVal : result;
	}
};
