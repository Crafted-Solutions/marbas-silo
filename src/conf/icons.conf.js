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
		'image/bmp': 'bi-filetype-bmp',
		'image/xbm': 'bi-filetype-bmp',
		'image/gif': 'bi-filetype-gif',
		'image/svg+xml': 'bi-filetype-svg',
		'audio/aac': 'bi-filetype-aac',
		'audio/mpeg3': 'bi-filetype-mp3',
		'audio/wav': 'bi-filetype-wav',
		'video/mp4': 'bi-filetype-mp4',
		'video/quicktime': 'bi-filetype-mov',
		'text/plain': 'bi-filetype-txt',
		'text/markdown': 'bi-filetype-md',
		'text/csv': 'bi-filetype-csv',
		'application/pdf': 'bi-filetype-pdf',
		'application/msword': 'bi-filetype-doc',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'bi-filetype-docx',
		'application/mspowerpoint': 'bi-filetype-ppt',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'bi-filetype-pptx',
		'application/excel': 'bi-filetype-xls',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'bi-filetype-xlsx'
	}
};