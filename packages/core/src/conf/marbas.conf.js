export const MarBasDefaults = {
	MinSchemaVersion: '0.1.16',
	MinAPIVersion: '0.1.19',
	LANG: 'en',
	ID_DEFAULT: '00000000-0000-1000-a000-000000000000',
	ID_ROOT: '00000000-0000-1000-a000-000000000001',
	ID_CONTENT: '00000000-0000-1000-a000-000000000006',
	ID_SCHEMA: '00000000-0000-1000-a000-000000000002',
	ID_FILES: '00000000-0000-1000-a000-000000000008',
	ID_TRASH_CONTENT: '00000000-0000-1000-a000-000000000010',
	ID_TRASH_SCHEMA: '00000000-0000-1000-a000-000000000011',
	ID_TYPE_PROPDEF: '00000000-0000-1000-a000-000000000009',
	ID_TYPE_TYPEDEF: '00000000-0000-0000-0000-000000000000',
	ID_TYPE_ELEMENT: '00000000-0000-1000-a000-000000000004',
	ID_TYPE_CONTAINER: '00000000-0000-1000-a000-000000000005',
	ID_TYPE_FILE: '00000000-0000-1000-a000-00000000000a',
	ID_TYPE_TRASH: '00000000-0000-1000-a000-00000000000e',
	ID_TYPE_LINK: '00000000-0000-1000-a000-00000000000f',
	ID_PROPDEF_COMMENT: '00000000-0000-1000-a000-00000000000d',
	ID_PROPDEF_LINKTARGET: '00000000-0000-1000-a000-000000000012'
}
export const MarBasBuiltIns = [
	MarBasDefaults.ID_ROOT, MarBasDefaults.ID_CONTENT, MarBasDefaults.ID_SCHEMA, MarBasDefaults.ID_FILES, MarBasDefaults.ID_TRASH_CONTENT, MarBasDefaults.ID_TRASH_SCHEMA,
	MarBasDefaults.ID_TYPE_PROPDEF, MarBasDefaults.ID_PROPDEF_LINKTARGET, MarBasDefaults.ID_TYPE_ELEMENT, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_FILE,
	MarBasDefaults.ID_TYPE_TRASH, MarBasDefaults.ID_TYPE_LINK
];
export const MarBasGrainAccessFlag = {
	None: 0x000,
	Read: 0x001,
	Write: 0x002,
	Delete: 0x004,
	ModifyAcl: 0x008,
	CreateSubelement: 0x010,
	WriteTraits: 0x020,
	Publish: 0x100,
	TakeOwnership: 0x200,
	TransferOwnership: 0x400,
	Full: 0xffffffff
};

export const MarBasRoleEntitlement = {
	None: 0x0,
	ReadAcl: 0x001,
	WriteAcl: 0x002,
	DeleteAcl: 0x004,
	ReadRoles: 0x010,
	WriteRoles: 0x020,
	DeleteRoles: 0x040,
	ExportSchema: 0x100,
	ImportSchema: 0x200,
	ModifySystemSettings: 0x1000,
	SkipPermissionCheck: 0x2000,
	DeleteBuiltInElements: 0x3000,
	Full: 0xffffffff
};

export const MarBasTraitValueTypes = [
	'Text', 'Memo', 'Number', 'Boolean', 'DateTime', 'File', 'Grain'
];
export const MarBasTraitValueType = MarBasTraitValueTypes.reduce((accu, curr) => { accu[curr] = curr; return accu }, {});