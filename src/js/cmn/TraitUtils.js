import { MarBasTraitValueType } from "@crafted.solutions/marbas-core";

export const TraitUtils = {
	DefaultMapHandler: {
		filter: (key, traitArr) => key,
		isMultiVal: (key, traitArr) => 1 < traitArr.length,
		convert: (key, trarit) => null != trarit.value && MarBasTraitValueType.DateTime == trarit.valueType ? new Date(trarit.value) : trarit.value
	},
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
	},
	mapTraitValues: function mapTraitValues(traits, target, valueHandler = this.DefaultMapHandler) {
		if (!traits) {
			return;
		}
		if (!target) {
			target = {};
		}
		for (const k in traits) {
			const trait = traits[k];
			if (trait && trait.length) {
				const mappedKey = valueHandler.filter(k, trait);
				if (!mappedKey) {
					continue;
				}
				if (!(mappedKey in target) && valueHandler.isMultiVal(k, trait)) {
					target[mappedKey] = [];
				}
				target[mappedKey] = trait.reduce((accu, tval) => {
					const v = valueHandler.convert(k, tval);
					if (Array.isArray(accu)) {
						accu.push(v);
					} else {
						accu = v;
					}
					return accu;
				}, target[mappedKey]);
			}
		}
		return target;
	}
};
