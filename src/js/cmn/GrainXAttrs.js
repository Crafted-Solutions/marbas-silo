import merge from "lodash.merge";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { IconMaps } from "../../conf/icons.conf";

export const GrainXAttrs = {
	getAttr: function (grain, attrName) {
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
	setAttr: function (grain, attrName, attrVal) {
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
	getGrainIcon: function (grain) {
		const icon = this.getAttr(grain, 'icon')
			|| IconMaps.ById[grain.id] || IconMaps.ByMimeType[GrainXAttrs.getGrainMimeType(grain)] || IconMaps.ByType[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF];
		grain.icon = icon || IconMaps.DEFAULT;
		return grain.icon;
	},
	setGrainIcon(grain, icon) {
		this.setAttr(grain, 'icon', icon);
		return this.getGrainIcon(grain);
	},
	isDefaultGrainIcon(grain) {
		return !grain.icon || IconMaps.ById[grain.id] == grain.icon || IconMaps.ByMimeType[GrainXAttrs.getGrainMimeType(grain)] == grain.icon
			|| IconMaps.ByType[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF] == grain.icon || IconMaps.DEFAULT == grain.icon;
	},
	getGrainMimeType(grain) {
		if (grain.mimeType) {
			return grain.mimeType;
		}
		if (MarBasDefaults.ID_TYPE_FILE == grain.typeDefId) {
			const name = grain.name.toLowerCase();
			if (name.endsWith('.mp4')) {
				grain.mimeType = 'video/mp4';
			} else if (name.endsWith('.mov')) {
				grain.mimeType = 'video/quicktime';
			} else if (name.endsWith('.aac')) {
				grain.mimeType = 'audio/aac';
			} else if (name.endsWith('.mp3')) {
				grain.mimeType = 'audio/mpeg3';
			} else if (name.endsWith('.txt')) {
				grain.mimeType = 'text/plain';
			} else if (name.endsWith('.pdf')) {
				grain.mimeType = 'application/pdf';
			} else if (name.endsWith('.png')) {
				grain.mimeType = 'image/png';
			} else if (name.endsWith('.gif')) {
				grain.mimeType = 'image/gif';
			} else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
				grain.mimeType = 'image/jpeg';
			} else if (name.endsWith('.bmp') || name.endsWith('.xbm')) {
				grain.mimeType = 'image/bmp';
			}
		}
		return grain.mimeType;
	}
};