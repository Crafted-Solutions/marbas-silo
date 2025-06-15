import { MarBasDefaults } from "@crafted.solutions/marbas-core";

export const IconMaps = {
	DEFAULT: 'bi-file',
	ById: {
		[MarBasDefaults.ID_ROOT]: 'bi-database',
		[MarBasDefaults.ID_SCHEMA]: 'bi-gear',
		[MarBasDefaults.ID_FILES]: 'bi-collection'
	},
	ByType: {
		[MarBasDefaults.ID_TYPE_CONTAINER]: 'bi-folder2',
		[MarBasDefaults.ID_TYPE_TYPEDEF]: 'bi-boxes',
		[MarBasDefaults.ID_TYPE_PROPDEF]: 'bi-box',
		[MarBasDefaults.ID_TYPE_FILE]: 'bi-file-earmark-binary',
		[MarBasDefaults.ID_TYPE_TRASH]: 'bi-trash3'
	},
	ByMimeType: {
		'image/png': 'bi-filetype-png',
		'image/jpeg': 'bi-filetype-jpg',
		'video/mp4': 'bi-filetype-mp4'
	}
};