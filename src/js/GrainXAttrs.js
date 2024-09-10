import merge from "lodash.merge";
import { MarBasDefaults } from "../conf/marbas.conf";
import { IconMaps } from "../conf/icons.conf";

export const GrainXAttrs = {
	getAttr: function(grain, attrName) {
		if (!grain._siloAttrs) {
			grain._siloAttrs = {};
			if (grain.typeXAttrs) {
				grain._siloAttrs = JSON.parse(`{${grain.typeXAttrs}}`).silo;
			}
			if (grain.xAttrs) {
				grain._siloAttrs = merge({}, grain._siloAttrs, JSON.parse(`{${grain.xAttrs}}`).silo);
			}
		}
		return grain._siloAttrs[attrName];
	},
	setAttr: function(grain, attrName, attrVal) {
		if (!grain._siloAttrs) {
			grain._siloAttrs = {};
		}
		grain._siloAttrsMod = attrVal != grain._siloAttrs[attrName];
		if (undefined == attrVal) {
			delete grain._siloAttrs[attrName];
		} else {
			grain._siloAttrs[attrName] = attrVal;
		}
		return attrVal;
	},
	getGrainIcon: function(grain) {
		const icon = this.getAttr(grain, 'icon') || IconMaps.ById[grain.id] || IconMaps.ByType[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF];
		grain.icon = icon || 'bi-file';	
		return grain.icon;
	},
	setGrainIcon(grain, icon) {
		this.setAttr(grain, 'icon', icon);
		return this.getGrainIcon(grain);
	}
};