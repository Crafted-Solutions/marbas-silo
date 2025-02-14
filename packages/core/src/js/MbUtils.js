export const MbUtils = {
	string2BitField: function(namedBitsStr, enumObj, defaultValue = 0, maxValueName = null) {
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

	bitField2String: function(bitField, enumObj, maxValueName = null) {
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

	pushOrCreate: function(arr, item) {
		if (arr) {
			arr.push(item);
		} else {
			arr = [item];
		}
		return arr;
	}
};