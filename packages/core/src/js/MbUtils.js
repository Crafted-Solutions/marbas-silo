export const MbUtils = {
	string2BitField: function (namedBitsStr, enumObj, defaultValue = 0, maxValueName = null) {
		let result = defaultValue;
		const items = namedBitsStr.split(/\s*,\s*/);
		items.some(name => {
			if (maxValueName == name) {
				result = enumObj[name];
				return true;
			}
			result |= enumObj[name];
			return false;
		});
		return result;
	},

	bitField2String: function (bitField, enumObj, maxValueName = null) {
		let result = '';
		for (const name in enumObj) {
			if (maxValueName == name) {
				result = name;
				break;
			}
			if (enumObj[name] == ((enumObj[name] & bitField) >>> 0)) {
				if (result.length) {
					result += ", ";
				}
				result += name;
			}
		}
		return result;
	},

	pushOrCreate: function (arr, item) {
		if (arr) {
			arr.push(item);
		} else {
			arr = [item];
		}
		return arr;
	},

	execAsyncWithPromise: async function (func) {
		const cb = {};
		const result = new Promise((resolve, reject) => {
			cb.resolve = resolve;
			cb.reject = reject;
		});
		try {
			await func(cb.resolve, cb.reject);
		} catch (e) {
			cb.reject(e);
		}
		return await result;

	},

	compareVersion: function (version1, version2) {
		if (version1 == version2) {
			return 0;
		}
		if (!version1) {
			return -1;
		}
		return version1.localeCompare(version2, undefined, { numeric: true, sensitivity: 'base' });
	}
};