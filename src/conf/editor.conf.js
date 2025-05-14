import { MarBasDefaults, MarBasTraitValueTypes } from "@crafted.solutions/marbas-core";

export const EditorSchemaConfig = {
	BASIC: {
		title: "Grain Editor",
		headerTemplate: "{{self.presentation.label}}{{self._sys.dirty}}",
		type: 'object',
		options: {
			disable_collapse: true
		},
		properties: {
			meta: {
				title: "Metadata",
				"$ref": '#/definitions/meta',
				propertyOrder: 0,
				options: {
					collapsed: true
				}
			},
			presentation: {
				title: "Presentation",
				"$ref": '#/definitions/presentation',
				propertyOrder: 1000
			},
			stats: {
				title: "Statistics",
				"$ref": '#/definitions/stats',
				propertyOrder: 2000,
				options: {
					collapsed: true
				}
			},
			_sys: {
				"$ref": '#/definitions/_sys'
			}
		},
		definitions: {
			meta: {
				type: "object",
				id: "meta",
				readonly: true,
				properties: {
					id: {
						title: "Id",
						type: "string"
					},
					name: {
						title: "Name",
						type: "string"
					},
					path: {
						title: "Path",
						type: "string"
					},
					typeDefId: {
						title: "Type Definition",
						type: "string",
						format: "grain",
						readonly: true,
						default: MarBasDefaults.ID_TYPE_TYPEDEF
					}
				}
			},
			presentation: {
				type: 'object',
				id: 'presentation',
				properties: {
					label: {
						title: "Label",
						type: "string",
						minLength: 1
					},
					icon: {
						title: 'Icon',
						type: 'string',
						description: '<span class="bi-file mb-grain-icon">&nbsp;</span>'
					},
					sortKey: {
						title: 'Sort Key',
						type: 'string'
					}
				}
			},
			stats: {
				type: 'object',
				id: "stats",
				readonly: true,
				properties: {
					revision: {
						title: "Revision",
						type: "integer"
					},
					cTime: {
						title: "Created",
						type: "string"
					},
					mTime: {
						title: "Modified",
						type: "string"
					},
					owner: {
						title: "Owner",
						type: "string"
					},
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
			typeDef: {
				title: 'Type Definition',
				"$ref": '#/definitions/typeDef',
				propertyOrder: 100
			}
		},
		definitions: {
			typeDef: {
				type: 'object',
				format: 'grid-strict',
				properties: {
					defaultInstanceId: {
						required: false,
						title: 'Default Values',
						type: 'string',
						format: 'button',
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
						description: "Open Grain editor with default values for this type (create the Grain if necessary)",
						options: {
							grid_columns: 10,
							grid_break: true
						}
					},
					impl: {
						title: 'Implementation',
						type: 'string',
						options: {
							grid_columns: 12
						}
					},
					mixInIds: {
						title: 'Type Mix-Ins',
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
			propDef: {
				title: 'Property Definition',
				"$ref": '#/definitions/propDef',
				propertyOrder: 100
			}
		},
		definitions: {
			propDef: {
				type: 'object',
				format: 'grid-strict',
				properties: {
					valueType: {
						title: 'Value Type',
						type: 'string',
						enum: MarBasTraitValueTypes,
						options: {
							grid_break: true,
							grid_columns: 12
						}
					},
					cardinalityMin: {
						title: 'Min. Number of Values',
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
						title: 'Max. Number of Values',
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
						title: 'Versionable',
						type: 'boolean',
						format: 'checkbox',
						options: {
							grid_columns: 6
						}
					},
					localizable: {
						title: 'Localizable',
						type: 'boolean',
						format: 'checkbox',
						options: {
							grid_break: true,
							grid_columns: 6
						}
					},
					valueConstraintId: {
						title: 'Value Constraint',
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
					_constraintParams: {
						title: 'Value Constraint Parameters',
						required: true,
						type: 'string',
						options: {
							grid_columns: 12
						},
						format: "select",
						enumSource: [{
							// A watched field source
							source: [
								{
									value: '',
									title: "None"
								},
								{
									value: 'PickerConfig',
									title: "Configure grain picker"
								}
							],
							title: "{{item.title}}",
							value: "{{item.value}}"
						}]
					}
				}
			}
		}
	},
	[MarBasDefaults.ID_TYPE_FILE]: {
		properties: {
			file: {
				title: "File",
				"$ref": '#/definitions/file',
				propertyOrder: 110
			}
		},
		definitions: {
			file: {
				id: 'file',
				type: 'object',
				properties: {
					content: {
						title: "Content",
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
							id: 'root.meta.id',
							apiPfx: 'root._sys.api'
						},
						options: {
							upload: {
								upload_handler: 'uploadHandler'
							}
						}
					},
					mimeType: {
						title: "Content Type",
						type: "string",
						readonly: true
					},
					size: {
						options: {
							hidden: true
						}
					},
					_size: {
						title: "Size",
						type: "integer",
						template: "fileSizeFormatter",
						watch: {
							val: 'root.file.size'
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
			title: "Date Only"
		}
	},
	PropDef_Memo: {
		isRtf: {
			type: "boolean",
			format: "checkbox",
			title: "Rich Text"
		}
	}
};

export const EditorGrainPickerConfig = {
	DEFAULT: {
		root: MarBasDefaults.ID_ROOT
	},
	File: {
		title: 'Select File',
		root: MarBasDefaults.ID_FILES,
		typeFilter: [MarBasDefaults.ID_TYPE_FILE, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_LINK],
		selectionFilter: [MarBasDefaults.ID_TYPE_FILE]
	},
	TypeDef: {
		title: 'Select Type',
		root: MarBasDefaults.ID_SCHEMA,
		typeFilter: [MarBasDefaults.ID_TYPE_TYPEDEF, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_LINK],
		selectionFilter: [MarBasDefaults.ID_TYPE_TYPEDEF]
	}
};