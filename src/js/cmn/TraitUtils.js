import { MarBasTraitValueType } from "@crafted.solutions/marbas-core";

export const TraitUtils = {
	isArray: function (prop) {
		return 1 < prop.cardinalityMax || -1 == prop.cardinalityMax;
	},
	getContainerName: function (prop) {
		const p = prop.path.split('/');
		return 1 < p.length ? p[p.length - 2] : 'General';
	},
	getEditableValue: function (prop, trait) {
		return this.isArray(prop) ? trait.map(val => this.convTraitValue(val.value, prop.valueType)) : this.convTraitValue(trait[0].value, prop.valueType);
	},
	convTraitValue: function (value, traitType) {
		if (MarBasTraitValueType.DateTime == traitType) {
			return (new Date(value)).getTime() / 1000;
		}
		return this.convIdentifiable(value);
	},
	convIdentifiable: function (obj) {
		return obj.id ? obj.id : obj;
	},
	getStorableValues: function (editorVal, traitType) {
		const arr = 'object' == typeof editorVal && 'function' == typeof editorVal.push ? editorVal : [editorVal];
		return arr.reduce((result, curr) => {
			const t = typeof (curr);
			if ('number' == t || 'boolean' == t || curr) {
				if (MarBasTraitValueType.DateTime == traitType) {
					curr = new Date(curr * 1000).toISOString();
				}
				result.push(curr);
			}
			return result;
		}, []);
	}
};
