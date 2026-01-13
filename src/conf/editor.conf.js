import { t } from "ttag";
import { MarBasDefaults, MarBasTraitValueTypes } from "@crafted.solutions/marbas-core";

const NAME_PRIMARY_GROUP = '_1';
const NAME_SECONDARY_GROUP = '_2';
const PATH_PRIMARY_GROUP = `root.${NAME_PRIMARY_GROUP}.`;
const PATH_SECONDARY_GROUP = `root.${NAME_SECONDARY_GROUP}.`;

export const EditorSchemaConfig = {
	NAME_PRIMARY_GROUP: NAME_PRIMARY_GROUP,
	NAME_SECONDARY_GROUP: NAME_SECONDARY_GROUP,
	PATH_PRIMARY_GROUP: PATH_PRIMARY_GROUP,
	PATH_SECONDARY_GROUP: PATH_SECONDARY_GROUP,
	PATH_DEFAULT_GROUP: PATH_PRIMARY_GROUP,
	PATH_SYS_OBJECT: `${PATH_PRIMARY_GROUP}_sys`,
	DEPTH_DATA_CARRIER: 3,
	BASIC_CORE: {
		get title() { return t`Grain Editor`; },
		headerTemplate: `{{self.${NAME_PRIMARY_GROUP}.presentation.label}}{{self.${NAME_PRIMARY_GROUP}._sys.dirty}}`,
		type: 'object',
		options: {
			disable_collapse: true
		},
		properties: {
			[NAME_PRIMARY_GROUP]: {
				get title() { return t`Basic`; },
				type: 'object',
				propertyOrder: 0,
				options: {
					disable_collapse: true,
					titleHidden: true,
					containerAttributes: {
						'class': 'mb-tab-container'
					}
				},
				properties: {
					presentation: {
						get title() { return t`Presentation`; },
						"$ref": '#/definitions/presentation',
						propertyOrder: 1000
					},
					_sys: {
						"$ref": '#/definitions/_sys'
					}
				}
			}
		},
		definitions: {
			presentation: {
				type: 'object',
				id: 'presentation',
				properties: {
					label: {
						_store: true,
						get title() { return t`Label`; },
						type: "string",
						minLength: 1
					},
					icon: {
						_store: true,
						get title() { return t`Icon`; },
						type: 'string',
						format: 'icon'
					},
					sortKey: {
						_store: true,
						get title() { return t`Sort Key`; },
						type: 'string'
					}
				}
			},
			_sys: {
				type: 'object',
				id: '_sys',
				options: {
					hidden: true,
					titleHidden: true
				},
				properties: {
					id: {
						type: 'string'
					},
					dirty: {
						type: 'string',
						default: ''
					},
					api: {
						type: 'string'
					}
				}
			}
		}
	},
	TRAIT_Memo: {
		format: 'textarea'
	},
	TRAIT_Memo_rtf: {
		format: 'jodit'
	},
	TRAIT_DateTime_dateonly: {
		format: 'date'
	},
	TRAIT_Grain: {
		format: "grain",
		options: {
			containerAttributes: {
				'data-pickeropts': 'DEFAULT'
			}
		}
	},
	TRAIT_File: {
		format: "grain",
		options: {
			containerAttributes: {
				'data-pickeropts': 'File'
			}
		}
	},
	[MarBasDefaults.ID_TYPE_TYPEDEF]: {
		properties: {
			[NAME_PRIMARY_GROUP]: {
				properties: {
					typeDef: {
						get title() { return t`Type Definition`; },
						"$ref": '#/definitions/typeDef',
						propertyOrder: 100
					}
				}
			}
		},
		definitions: {
			typeDef: {
				type: 'object',
				format: 'grid-strict',
				properties: {
					defaultInstanceId: {
						_store: true,
						get title() { return t`Default Values`; },
						type: 'string',
						format: 'button',
						required: false,
						options: {
							button: {
								action: 'showTypeDefDefaults',
								icon: 'boxes'
							},
							containerAttributes: {
								'class': 'mb-3'
							},
							grid_columns: 2
						}
					},
					_defaultInstanceIdDesc: {
						format: 'info',
						title: '',
						get description() { return t`Open Grain editor with default values for this type (create the Grain if necessary)`; },
						default: '42',
						options: {
							grid_columns: 10,
							grid_break: true
						}
					},
					impl: {
						_store: true,
						get title() { return t`Implementation`; },
						type: 'string',
						required: false,
						options: {
							grid_columns: 12
						}
					},
					mixInIds: {
						_store: true,
						get title() { return t`Type Mix-Ins`; },
						type: 'array',
						uniqueItems: true,
						minItems: 0,
						required: true,
						options: {
							grid_columns: 12,
							containerAttributes: {
								'data-pickeropts': 'TypeDef'
							}
						},
						items: {
							type: 'string',
							format: 'grain',
							options: {
								compact: true
							}
						}
					}
				}
			}
		}
	},
	[MarBasDefaults.ID_TYPE_PROPDEF]: {
		properties: {
			[NAME_PRIMARY_GROUP]: {
				properties: {
					propDef: {
						get title() { return `Property Definition`; },
						"$ref": '#/definitions/propDef',
						propertyOrder: 100
					}
				}
			}
		},
		definitions: {
			propDef: {
				type: 'object',
				format: 'grid-strict',
				properties: {
					valueType: {
						_store: true,
						get title() { return t`Value Type`; },
						type: 'string',
						enum: MarBasTraitValueTypes,
						options: {
							grid_break: true,
							grid_columns: 12
						}
					},
					cardinalityMin: {
						_store: true,
						get title() { return t`Min. Number of Values`; },
						type: 'integer',
						format: 'stepper',
						default: 1,
						step: 1,
						minimum: 0,
						options: {
							grid_columns: 6
						}
					},
					cardinalityMax: {
						_store: true,
						get title() { return t`Max. Number of Values`; },
						type: 'integer',
						format: 'stepper',
						default: 1,
						step: 1,
						minimum: -1,
						pattern: "^((-1)|([1-9][0-9]*))$",
						options: {
							grid_break: true,
							grid_columns: 6
						}
					},
					versionable: {
						_store: true,
						get title() { return t`Versionable`; },
						type: 'boolean',
						format: 'checkbox',
						options: {
							grid_columns: 6
						}
					},
					localizable: {
						_store: true,
						get title() { return t`Localizable`; },
						type: 'boolean',
						format: 'checkbox',
						options: {
							grid_break: true,
							grid_columns: 6
						}
					},
					valueConstraintId: {
						_store: true,
						get title() { return t`Value Constraint`; },
						type: 'string',
						format: 'grain',
						required: false,
						options: {
							grid_columns: 12,
							containerAttributes: {
								'data-pickeropts': 'DEFAULT'
							}
						}
					},
					constraintParams: {
						_store: true,
						get title() { return t`Value Constraint Parameters`; },
						required: false,
						type: 'string',
						format: 'contstraints',
						options: {
							grid_columns: 12
						}
					}
				}
			}
		}
	},
	[MarBasDefaults.ID_TYPE_FILE]: {
		properties: {
			[NAME_PRIMARY_GROUP]: {
				properties: {
					file: {
						get title() { return t`File`; },
						"$ref": '#/definitions/file',
						propertyOrder: 110
					}
				}
			}
		},
		definitions: {
			file: {
				id: 'file',
				type: 'object',
				properties: {
					content: {
						get title() { return t`Content`; },
						type: "string",
						format: "url",
						template: '{{apiPfx}}/File/{{id}}/Inline',
						links: [{
							href: '{{apiPfx}}/File/{{id}}/Inline',
							rel: "Open (new window)",
							download: true,
							'class': 'mb-grain-file'
						}],
						watch: {
							id: `${PATH_PRIMARY_GROUP}_sys.id`,
							apiPfx: `${PATH_PRIMARY_GROUP}_sys.api`
						},
						options: {
							upload: {
								upload_handler: 'uploadHandler'
							}
						}
					},
					mimeType: {
						get title() { return t`Content Type`; },
						type: "string",
						readonly: true
					},
					size: {
						options: {
							hidden: true
						}
					},
					_size: {
						get title() { return t`Size`; },
						type: "integer",
						template: "fileSizeFormatter",
						watch: {
							val: `${PATH_PRIMARY_GROUP}file.size`
						}
					}
				}
			}
		}
	},
	PropDef_DateTime: {
		isDateOnly: {
			type: "boolean",
			format: "checkbox",
			get title() { return t`Date Only`; }
		}
	},
	PropDef_Memo: {
		isRtf: {
			type: "boolean",
			format: "checkbox",
			get title() { return t`Rich Text`; }
		}
	}
};

EditorSchemaConfig.BASIC = structuredClone(EditorSchemaConfig.BASIC_CORE);
EditorSchemaConfig.BASIC.format = 'categories';
EditorSchemaConfig.BASIC.properties[NAME_SECONDARY_GROUP] = {
	get title() { return t`Advanced`; },
	type: 'object',
	propertyOrder: 2000,
	options: {
		disable_collapse: true,
		titleHidden: true,
		containerAttributes: {
			'class': 'mb-tab-container'
		}
	},
	properties: {
		meta: {
			get title() { return t`Metadata`; },
			"$ref": '#/definitions/meta',
			propertyOrder: 1000
		},
		stats: {
			get title() { return t`Statistics`; },
			"$ref": '#/definitions/stats',
			propertyOrder: 2000
		}
	}
};
EditorSchemaConfig.BASIC.definitions.meta = {
	type: "object",
	id: "meta",
	readonly: true,
	properties: {
		id: {
			get title() { return t`ID`; },
			type: "string"
		},
		name: {
			get title() { return t`Name`; },
			type: "string"
		},
		path: {
			get title() { return t`Path`; },
			type: "string"
		},
		typeDefId: {
			get title() { return t`Type Definition`; },
			type: "string",
			format: "grain",
			default: MarBasDefaults.ID_TYPE_TYPEDEF
		}
	}
};
EditorSchemaConfig.BASIC.definitions.stats = {
	type: 'object',
	id: "stats",
	readonly: true,
	properties: {
		revision: {
			get title() { return t`Revision`; },
			type: "integer"
		},
		cTime: {
			get title() { return t`Created`; },
			type: "string"
		},
		mTime: {
			get title() { return t`Modified`; },
			type: "string"
		},
		owner: {
			get title() { return t`Owner`; },
			type: "string"
		},
	}
};

export const EditorGrainPickerConfig = {
	DEFAULT: {
		root: MarBasDefaults.ID_ROOT
	},
	File: {
		get title() { return t`Select File`; },
		root: MarBasDefaults.ID_FILES,
		typeFilter: [MarBasDefaults.ID_TYPE_FILE, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_LINK],
		selectionFilter: [MarBasDefaults.ID_TYPE_FILE]
	},
	TypeDef: {
		get title() { return t`Select Type`; },
		root: MarBasDefaults.ID_SCHEMA,
		typeFilter: [MarBasDefaults.ID_TYPE_TYPEDEF, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_LINK],
		selectionFilter: [MarBasDefaults.ID_TYPE_TYPEDEF]
	}
};
