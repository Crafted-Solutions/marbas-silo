export const StorageUtils = {
	write: function write(key, value) {
		if (null == value) {
			sessionStorage.removeItem(key);
		} else {
			sessionStorage.setItem(key, 'object' == typeof value ? JSON.stringify(value) : value);
		}
	},
	read: function read(key, asJson = false, defaultVal = undefined) {
		const result = sessionStorage.getItem(key);
		return null == result ? defaultVal : asJson ? JSON.parse(result) : result;
	}
};
