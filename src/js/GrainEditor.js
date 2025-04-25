import { JSONEditor } from "@json-editor/json-editor";
import merge from "lodash.merge";
import { Popover } from "bootstrap";

import { EditorGrainPickerConfig, EditorSchemaConfig } from "../conf/editor.conf";
import { MarBasDefaults, MarBasGrainAccessFlag, MarBasTraitValueType } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "./cmn/GrainXAttrs";
import { GrainPicker } from "./cmn/GrainPicker";
import { MsgBox } from "./cmn/MsgBox";
import { MbDomUtils } from "./cmn/MbDomUtils";
import { ExtensionLoader } from "./ExtensionLoader";

JSONEditor.defaults.options.theme = 'bootstrap5';
JSONEditor.defaults.options.iconlib = 'bootstrap';
JSONEditor.defaults.options.disable_edit_json = true;
JSONEditor.defaults.options.no_additional_properties = true;
JSONEditor.defaults.options.remove_empty_properties = false;
JSONEditor.defaults.options.disable_properties = true;
JSONEditor.defaults.options.array_controls_top = false;
JSONEditor.defaults.options.required_by_default = true;
JSONEditor.defaults.options.display_required_only = false;
JSONEditor.defaults.options.show_opt_in = true;
JSONEditor.defaults.options.disable_array_delete_last_row = true;
JSONEditor.defaults.callbacks.upload = {
	uploadHandler: (jseditor, path, file, cbs) => {
		jseditor.jsoneditor._grainEditor.uploadHandler(jseditor, path, file, cbs);
	}
};
JSONEditor.defaults.callbacks.template = {
	fileSizeFormatter: (_, e) => {
		const baseT = Math.log(e.val) / Math.log(1024) | 0;
		return `${(e.val / Math.pow(1024, baseT)).toFixed(2)} ${(baseT ? 'KMGTPEZY'[baseT - 1] + 'iB' : 'Bytes')}`;
	}
};
JSONEditor.defaults.callbacks.button = {
	showTypeDefDefaults: (jseditor, e) => {
		jseditor.jsoneditor._grainEditor.onTypeDefDefaults(jseditor);
	}
};

const FieldIcon = 'root.presentation.icon';
const FieldValueType = 'root.propDef.valueType';
const FieldRtf = 'root.propDef.isRtf';
const FieldDateOnly = 'root.propDef.isDateOnly';
const FieldConstrParams = 'root.propDef._constraintParams';
const TraitPattern = /^root._trait_([^\.]+)\.([0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/i;

const TraitUtils = {
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

const PropValConstr = {
	create: function (prop) {
		if (prop.constraintParams) {
			const params = new URLSearchParams(prop.constraintParams);
			if (params.get('use') in PropValConstr) {
				return new PropValConstr[params.get('use')](prop.valueConstraintId, params);
			}
		}
		return null;
	},
	init: function (propDef) {
		if (propDef && 'constraintParams' in propDef) {
			propDef._constraintParams = propDef.constraintParams ? (new URLSearchParams(propDef.constraintParams)).get('use') : null;
		}
	},
	sync: function (propDef, selectedConstr) {
		if (selectedConstr in PropValConstr) {
			const inst = new PropValConstr[selectedConstr](propDef.valueConstraintId, new URLSearchParams(propDef.constraintParams));
			inst.updateParams(propDef);
		} else {
			propDef.constraintParams = null;
		}
	},

	PickerConfig: class PickerConfig {
		#setRoot = true;

		constructor(constraintId, params) {
			this.constraintId = constraintId;
			if ('false' == params.get('setRoot')) {
				this.#setRoot = false;
			}
		}

		tweakSchema(schema) {
			if (!this.constraintId) {
				return;
			}
			const tweaker = (schemaItem) => {
				if (!schemaItem.options) {
					schemaItem.options = {};
				}
				if (!schemaItem.options.containerAttributes) {
					schemaItem.options.containerAttributes = {};
				}
				schemaItem.options.containerAttributes['data-pickeropts'] = JSON.stringify({ root: this.constraintId });
			};
			tweaker(schema);
			if (schema.items) {
				tweaker(schema.items);
			}
		}

		updateParams(propDef) {
			propDef.constraintParams = "use=PickerConfig";
			if (!this.#setRoot) {
				propDef.constraintParams += "&setRoot=false";
			}
		}
	}
};

await ExtensionLoader.installExtension('GrainEditorStatic', {
	MarBasDefaults: MarBasDefaults,
	MarBasGrainAccessFlag: MarBasGrainAccessFlag,
	MarBasTraitValueType: MarBasTraitValueType,
	EditorGrainPickerConfig: EditorGrainPickerConfig,
	EditorSchemaConfig: EditorSchemaConfig,
	JSONEditor: JSONEditor,
	PropValConstr: PropValConstr
});

export class GrainEditor {
	#readyCb;
	#changeCb;
	#addRowCb;
	#watches = {};
	#dateFields;
	#ignoreChanges;
	#listeners = [];
	#labelResolvers = {};
	#grainPicker;
	_apiSvc;
	_element;
	_link;

	constructor(elementId, apiSvc) {
		this._element = document.getElementById(elementId);
		this._apiSvc = apiSvc;
		this.#changeCb = () => this.onEditorChange();
		this.#readyCb = () => this.onEditorReady();
		this.#addRowCb = (editor) => this.onEditorAddRow(editor);
		this.#ignoreChanges = false;
		window.addEventListener('beforeunload', (evt) => {
			if (this.dirty) {
				evt.preventDefault();
				evt.returnValue = "Grain was modified, really leave?";
			}
		});
		document.addEventListener('mb-silo:grain-deleted', (evt) => {
			if (this.editor && this.grain.defaultInstanceId == evt.detail) {
				delete this.grain.defaultInstanceId;
			}
		});
	}

	async buildEditor(grainBase, forceReload = false, link = undefined) {
		if (!forceReload && this.grain && grainBase && this.grain.id == grainBase.id && this.grain._ts >= grainBase._ts && this._link == link) {
			return;
		}
		this._link = link;

		await this.unloadEditor();
		this.grain = grainBase;
		if (grainBase) {
			this.grain = await this._apiSvc.resolveGrainType(grainBase);
			if (!this.grain.icon) {
				GrainXAttrs.getGrainIcon(this.grain);
			}
			delete this.grain._siloAttrsMod;
			PropValConstr.init(this.grain);
			this.customProps = {
				def: await this._apiSvc.getGrainPropDefs(this.grain)
			};
			if (this.customProps.def.length) {
				this.customProps.traits = await this._apiSvc.getGrainTraits(this.grain);
			}
			const schema = this._getSchema(this.grain, this.customProps);
			const startval = {
				_sys: {
					api: this._apiSvc.baseUrl
				}
			};
			for (const key in schema.properties) {
				if (key.startsWith('_')) {
					continue;
				}
				startval[key] = this.grain;
			}

			if (MarBasDefaults.ID_TYPE_PROPDEF == this.grain.typeDefId && EditorSchemaConfig[`PropDef_${this.grain.valueType}`]) {
				schema.definitions.propDef.properties = merge({}, schema.definitions.propDef.properties, EditorSchemaConfig[`PropDef_${this.grain.valueType}`]);
			}
			if (this.grain.valueType == MarBasTraitValueType.DateTime) {
				startval.propDef.isDateOnly = GrainXAttrs.getAttr(this.grain, 'propMod') == "dateonly";
			}
			else if (this.grain.valueType == MarBasTraitValueType.Memo) {
				startval.propDef.isRtf = GrainXAttrs.getAttr(this.grain, 'propMod') == "rtf";
			}
			if (this.customProps.def.length && this.customProps.traits) {
				this.customProps.def.forEach((prop) => {
					const secKey = `_trait_${TraitUtils.getContainerName(prop)}`;
					if (!startval[secKey]) {
						startval[secKey] = {};
					}
					const trait = this.customProps.traits[prop.name];
					if (trait && trait.length) {
						startval[secKey][prop.id] = TraitUtils.getEditableValue(prop, trait);
						if (trait[0].grainId != this.grain.id) {
							schema.properties[secKey].properties[prop.id].title += " (Default Value)";
						}
					}
				});
				// console.log('startval', startval);
			}
			this.editor = new JSONEditor(this._element, {
				schema: schema,
				startval: startval
			});
			this.editor._grainEditor = this;
			this.editor.initializing = true;
			this.editor.on('ready', this.#readyCb);
		}
	}

	async unloadEditor() {
		if (this.editor) {
			await this.verifySaved();
			this.editor.off('change', this.#changeCb);
			this.editor.off('addRow', this.#addRowCb);
			for (const key in this.#watches) {
				this.editor.unwatch(key, this.#watches[key]);
			}
			this.#watches = {};
			this.editor.destroy();
		}
		delete this.editor;
		const result = this.grain;
		delete this.grain;
		delete this.customProps;
		this.#dateFields = ['root.stats.cTime', 'root.stats.mTime'];
		return result;
	}

	async resetEditor() {
		const grainId = (this.grain || {}).id;
		if (grainId) {
			this._apiSvc.invalidateGrain(this.grain);
			await this.buildEditor(await this._apiSvc.getGrain(grainId, true), true, this._link);
			this._notify();
		}
	}

	async verifySaved(disposing = false) {
		if (this.dirty) {
			if ('yes' == await MsgBox.invoke("Grain was modified, save?", { icon: 'primary', buttons: { 'yes': true, 'no': true } })) {
				await this.save();
				return true;
			}
			if (this.grain && !disposing) {
				await this._apiSvc.invalidateGrain(this.grain);
				this.grain = await this._apiSvc.getGrain(this.grain.id);
				this._notify();
			}
			if (disposing) {
				this.editor.is_dirty = false;
			}
			return false;
		}
		return true;
	}

	async save() {
		const errors = this.editor.validate();
		if (errors.length) {
			console.warn("editor.errors", errors);
			this.editor.showValidationErrors(errors);
			MsgBox.invokeErr("Please correct input errors first");
			return this.grain;
		}
		this.#collectChanges();
		if (this.customProps && this.customProps.changes) {
			for (const k in this.customProps.changes) {
				const sub = this.editor.getEditor(k);
				if (sub && sub.is_dirty && sub.isActive()) {
					const m = TraitPattern.exec(k);
					if (m && 2 < m.length) {
						await this._apiSvc.storeTraitValues(this.grain, {
							id: m[2],
							valueType: sub.schema._origType,
							localizable: sub.schema._localizable
						}, TraitUtils.getStorableValues(sub.getValue(), sub.schema._origType));
					}
					sub.is_dirty = false;
				}
				delete this.customProps.changes[k];
			}
		}
		if (await this._apiSvc.storeGrain(this.grain)) {
			const sub = this.editor.getEditor('root.stats.mTime');
			if (sub) {
				sub.setValueToInputField((new Date()).toLocaleString());
			}
			this._setDirty(false);
		}
		return this.grain;
	}

	get dirty() {
		return this.editor && this.editor.is_dirty;
	}

	addChangeListener(listener) {
		this.#listeners.push(listener);
	}

	onEditorChange() {
		if (this.editor.initializing) {
			delete this.editor.initializing;
			return;
		}
		if (this.#ignoreChanges) return;
		this.#ignoreChanges = true;
		// this.editor.is_dirty = true;
		this.#ignoreChanges = false;
	}

	onRelevantChange(editorKey) {
		if (this.editor.initializing) {
			return;
		}
		let makeDirty = true;
		const sub = this.editor.getEditor(editorKey);
		if (sub) {
			makeDirty = !sub.uploader;
			sub.is_dirty = makeDirty;
		}
		// console.log('onRelevantChange', makeDirty, sub);
		if (makeDirty && !this.editor.is_dirty) {
			this._setDirty();
		}
		if (FieldIcon == editorKey) {
			this.updateIcon();
		} else if (sub) {
			if (FieldRtf == editorKey) {
				GrainXAttrs.setAttr(this.grain, 'propMod', sub.getValue() ? 'rtf' : null);
			} else if (FieldDateOnly == editorKey) {
				GrainXAttrs.setAttr(this.grain, 'propMod', sub.getValue() ? 'dateonly' : null);
			} else if (FieldValueType == editorKey) {
				this.#updatePropDefEditorByValueType(sub.getValue());
			} else if (FieldConstrParams == editorKey) {
				PropValConstr.sync(this.grain, sub.getValue());
			}
		}
		if (makeDirty && !this.#markTraitChange(editorKey)) {
			this.#collectChanges(sub);
		}
		this.#resolveGlobalLabels();
		this._notify();
	}

	onEditorAddRow(editor) {
		if (editor.parent && editor.parent.container.hasAttribute('data-pickeropts')) {
			let makeDirty = false;
			this._showGrainPicker(() => {
				if (this.#grainPicker.accepted) {
					editor.setValue(this.#grainPicker.selectedGrain);
					makeDirty = true;
					this.#markTraitChange(editor.path);
					this.#resolveEditorLabel(editor);
					this.#checkEmbeddedMedia(editor);
					this.#updateSessionLinks();
				} else {
					editor.parent.setValue(editor.parent.getValue().filter(val => !!val));
				}
				if (!this.editor.was_dirty) {
					this._setDirty(makeDirty);
				}
			}, this.#getGrainPickerOptions(editor.parent.container));
		}
	}

	onEditorReady() {
		try {
			this.#dateFields.forEach((key) => {
				const sub = this.editor.getEditor(key);
				if (sub && sub.getValue()) {
					sub.setValueToInputField(new Date(sub.getValue()).toLocaleString());
				}
			});
			this._createActions();

			Object.keys(this.editor.editors).forEach(key => {
				const sub = this.editor.getEditor(key);
				if (!sub) {
					return;
				}
				const pathLen = (key.match(/\./g) || []).length;
				if (2 > pathLen && sub.schema.readonly) {
					// WA for JE bug ignoring readonly on objects
					sub.disable();
				} else if (2 == pathLen && !key.startsWith('root._sys')) {
					this._addEditorListener(key);
				}
			});

			this.editor.on('change', this.#changeCb);
			this.editor.on('addRow', this.#addRowCb);

			this.updateIcon();

			this.#createFieldActions();
			this.#resolveSchemaLabels(this.editor.schema);
			this.#checkEmbeddedMedia();
			this.#resolveGlobalLabels();
			this.#renderFieldComments();

			this.#updateSessionLinks();

		} catch (e) {
			console.error(e);
			MsgBox.invokeErr(`Error setting up editor: ${e.message}`);
		}
	}

	updateIcon() {
		const sub = this.editor.getEditor(FieldIcon);
		if (sub) {
			const icon = GrainXAttrs.setGrainIcon(this.grain, sub.getValue());
			const elm = sub.container.querySelector('.mb-grain-icon');
			if (elm) {
				elm.className = `mb-grain-icon ${icon}`;
			}
		}
	}

	async uploadHandler(editor, datapath, file, callbacks) {
		let id = this.grain.id;
		const isTrait = TraitPattern.test(datapath);
		if (isTrait) {
			id = editor.getValue();
		}
		callbacks.updateProgress(10);
		await this._apiSvc.uploadFile(id, file);
		callbacks.updateProgress(100);
		callbacks.success(isTrait ? id : `${this._apiSvc.baseUrl}/File/${id}/Inline`);
		this.#checkEmbeddedMedia(editor);
		editor.preview.innerHTML = "";
		editor.fileDisplay.value = "No file selected";
		editor.input.value = '';
		// this.#apiSvc.invalidateGrain(this.grain);
		// await this.resetEditor();
	}

	onTypeDefDefaults(editor) {
		const evt = new CustomEvent('mb-silo:typdef-defaults', {
			detail: {
				typeDefId: this.grain.id,
				defaultsId: this.grain.defaultInstanceId
			}
		});
		document.dispatchEvent(evt);
	}

	_setDirty(dirty = true) {
		this.editor.was_dirty = this.editor.is_dirty;
		const sub = this.editor.getEditor('root._sys.dirty');
		if (sub) {
			sub.setValue(dirty ? '*' : '');
		}
		this.editor.is_dirty = dirty;
		this.editor.root.header.parentNode.querySelectorAll('.mb-grain-edit-save, .mb-grain-edit-reset').forEach(btn => btn.disabled = !dirty);
	}

	_notify() {
		this.#listeners.forEach((listener) => {
			listener(this.grain);
		});
	}

	_addEditorListener(editorKey) {
		this.#watches[editorKey] = () => {
			this.onRelevantChange(editorKey);
		};
		this.editor.watch(editorKey, this.#watches[editorKey]);
	}

	_removeEditorListener(editorKey) {
		if (this.#watches[editorKey]) {
			this.editor.unwatch(editorKey, this.#watches[editorKey]);
		}
		delete this.#watches[editorKey];
	}

	_showGrainPicker(closeCallback, pickerOptions) {
		if (!this.#grainPicker) {
			this.#grainPicker = new GrainPicker('grain-picker', this._apiSvc);
		}
		this.#grainPicker.addEventListener('hidden.bs.modal', closeCallback, { once: true });
		this.#grainPicker.show(pickerOptions);
	}

	async _createActions() {
		if (this.editor) {
			const btnHolder = this.editor.root.theme.getHeaderButtonHolder();

			let btn = this.editor.root.getButton('', 'arrows', 'Select in the navigation');
			btn.classList.add('btn-outline-secondary');
			btn.classList.remove('btn-secondary', 'btn-sm');
			btn.addEventListener('click', () => {
				const evt = new CustomEvent('mb-silo:navigate', { detail: this.grain.id });
				document.dispatchEvent(evt);
			});
			btnHolder.appendChild(btn);

			if (this._link) {
				btn = this.editor.root.getButton('', 'link', 'Edit link');
				btn.classList.add('btn-outline-secondary');
				btn.classList.remove('btn-secondary', 'btn-sm');
				btn.addEventListener('click', async () => {
					this.buildEditor(await this._apiSvc.getGrain(this._link));
				});
				btnHolder.appendChild(btn);
			}

			if (await this._apiSvc.getGrainPermission(this.grain, MarBasGrainAccessFlag.Write)) {
				btn = this.editor.root.getButton('Save', 'save', 'Save');
				btn.disabled = true;
				btn.classList.add('mb-grain-edit-save', 'btn-primary');
				btn.classList.remove('btn-secondary', 'btn-sm');
				btn.addEventListener('click', () => {
					this.save();
				});
				btnHolder.appendChild(btn);

				btn = this.editor.root.getButton('Reset', 'arrow-counterclockwise', 'Reset');
				btn.disabled = true;
				btn.classList.add('mb-grain-edit-reset');
				btn.classList.remove('btn-sm');
				btn.addEventListener('click', () => {
					this.resetEditor();
				});
				btnHolder.appendChild(btn);
			} else {
				this.editor.disable();
			}

			btnHolder.classList.add('me-1');

			this.editor.root.header.parentNode.insertBefore(btnHolder, this.editor.root.header);
			return btnHolder;
		}
	}

	#createFieldActions() {
		const fields = this.editor.element.querySelectorAll('[data-proptype="grain"]');
		fields.forEach(field => {
			const schemaPath = field.getAttribute('data-schemapath');
			const sub = this.editor.getEditor(schemaPath);
			if (!sub || sub.schema._fieldReadonly) {
				return;
			}
			const lbl = field.querySelector('label');
			if (lbl) {
				let btn = document.createElement('button');
				if ('array' != sub.parent.schema.type) {
					btn.title = "Delete";
					btn.innerHTML = '<span class="bi-x"></span>';
					btn.className = "btn btn-sm btn-outline-secondary me-2";
					btn.onclick = () => {
						const prev = sub.getValue();
						sub.setValue("");
						sub.onChange(true);
						if (prev) {
							this._setDirty();
							this.#markTraitChange(schemaPath);
						}
						MbDomUtils.updateSessionLinks(sub.element);
						this.#resolveEditorLabel(sub);
					};
					lbl.insertBefore(btn, lbl.firstChild);

					btn = document.createElement('button');
				}

				btn.title = "Select";
				btn.innerHTML = '<span class="bi-three-dots"></span>';
				btn.className = "btn btn-sm btn-outline-secondary me-2";
				btn.onclick = () => {
					this._showGrainPicker(() => {
						if (this.#grainPicker.accepted) {
							const prev = sub.getValue();
							sub.setValue(this.#grainPicker.selectedGrain);
							if (prev != this.#grainPicker.selectedGrain) {
								this._setDirty();
								this.#markTraitChange(schemaPath);
							}
							MbDomUtils.updateSessionLinks(sub.element);
							this.#resolveEditorLabel(sub);
							this.#checkEmbeddedMedia(sub);
						}
					}, this.#getGrainPickerOptions(field));
				};
				lbl.insertBefore(btn, lbl.firstChild);
			}
		});
	}

	#renderFieldComments() {
		if (this.customProps.def.length && this.customProps.traits) {
			this.customProps.def.forEach((prop) => {
				this._apiSvc.getTraitValues(prop, MarBasDefaults.ID_PROPDEF_COMMENT).then((comments) => {
					if (comments && comments.length && comments[0].value) {
						const lbl = this.editor.element.querySelector(
							1 == prop.cardinalityMax
								? `[data-schemapath="root._trait_${TraitUtils.getContainerName(prop)}.${prop.id}"] label`
								: `[data-schemapath="root._trait_${TraitUtils.getContainerName(prop)}.${prop.id}"] .card-title`
						);
						if (lbl) {
							const elm = this.editor.theme.getInfoButton(comments[0].value);
							// const elm = document.createElement('button');
							// elm.className = "btn btn-sm btn-outline-secondary rounded-circle align-baseline lh-1 ms-2";
							// elm.setAttribute('role', 'button');
							// elm.setAttribute('type', 'button');
							elm.title = "Field Info";
							elm.setAttribute('data-bs-content', comments[0].value);
							elm.removeAttribute('data-toggle');
							elm.setAttribute('data-bs-toggle', 'popover');
							elm.setAttribute('data-bs-trigger', 'focus');
							elm.classList.add('fs-5', 'align-top');
							// elm.innerHTML = '<small>?</small>';

							lbl.appendChild(elm);
							Popover.getOrCreateInstance(elm);
						}
					}
				}).catch(console.warn);
			});
		}
	}

	#checkEmbeddedMedia(editor) {
		const cont = editor ? editor.container : this.editor.element;
		const media = cont.querySelectorAll('.mb-grain-file');
		media.forEach((anchor) => {
			if (anchor.href && anchor.href.startsWith(this._apiSvc.baseUrl)) {
				this._apiSvc.loadBlob(anchor.href, /^(image|video|audio)\/.*/)
					.then(blob => {
						if (blob.type.startsWith('image/')) {
							const elm = document.createElement('img');
							elm.setAttribute('style', "max-width: 100%; max-height: 100px;");
							elm.onload = () => URL.revokeObjectURL(objUrl);
							anchor.setAttribute('title', anchor.textContent);
							anchor.innerHTML = '';
							anchor.appendChild(elm);
							const objUrl = URL.createObjectURL(blob);
							elm.src = objUrl;
						}
					})
					.catch(console.warn);
			}
		});
	}

	_getSchema(grain, customProps) {
		let result = EditorSchemaConfig.BASIC;
		if (!grain.typeDefId) {
			result = structuredClone(result);
			result.definitions.meta.properties._type.template = 'Type';
			delete result.definitions.meta.properties._type.links;
		}
		if (EditorSchemaConfig[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF]) {
			result = merge({}, result, EditorSchemaConfig[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF]);
		}
		result = this._extendSchemaByTraits(customProps, result);
		console.log('getSchema', result);
		return result;
	}

	_extendSchemaByTraits(customProps, baseSchema) {
		if (!customProps || !customProps.def || !customProps.def.length) {
			return baseSchema;
		}
		let result = structuredClone(baseSchema);

		const sections = {};
		let ord = 100;
		customProps.def.forEach(prop => {
			const secName = TraitUtils.getContainerName(prop);
			const secKey = `_trait_${secName}`;
			if (!sections[secKey]) {
				sections[secKey] = {
					type: 'object',
					title: secName,
					propertyOrder: ord++,
					properties: {}
				};
				this.#labelResolvers[secKey] = this._apiSvc.resolveGrainLabel(prop.parentId);
			}

			let propSchema = {
				type: 'string'
			};
			let configKey = `TRAIT_${prop.valueType}`;
			const mod = GrainXAttrs.getAttr(prop, 'propMod');
			if (mod) {
				configKey = `${configKey}_${mod}`;
			}
			switch (prop.valueType) {
				case MarBasTraitValueType.Number:
					propSchema.type = 'number';
					break;
				case MarBasTraitValueType.Boolean:
					propSchema.type = 'boolean';
					break;
				case MarBasTraitValueType.DateTime:
					propSchema.type = 'integer';
					propSchema.format = 'datetime-local';
					break;
			}
			if (EditorSchemaConfig[configKey]) {
				merge(propSchema, EditorSchemaConfig[configKey]);
			}
			if (TraitUtils.isArray(prop)) {
				propSchema = {
					type: 'array',
					options: {
						disable_collapse: true
					},
					items: propSchema
				};
				if (propSchema.items.options && propSchema.items.options.containerAttributes) {
					propSchema.options = {
						containerAttributes: {}
					};
					for (const attr in propSchema.items.options.containerAttributes) {
						if ('class' == attr) {
							propSchema.items.options.containerAttributes[attr] += ` ${EnvConfig.panelClasses}`;
						} else if ('data-proptype' != attr) {
							propSchema.options.containerAttributes[attr] = propSchema.items.options.containerAttributes[attr];
							delete propSchema.items.options.containerAttributes[attr];
						}
					}
				}
				if (0 < prop.cardinalityMin) {
					propSchema.minItems = prop.cardinalityMin;
				}
				if (0 < prop.cardinalityMax) {
					propSchema.maxItems = prop.cardinalityMax;
				}
			} else {
				propSchema._useTitle = prop.label;
				propSchema.required = 0 < prop.cardinalityMin;
				if (propSchema.required
					&& (MarBasTraitValueType.Text == prop.valueType || MarBasTraitValueType.Memo == prop.valueType
						|| MarBasTraitValueType.Grain == prop.valueType || MarBasTraitValueType.File == prop.valueType
					)) {
					propSchema.minLength = 1;
				}
			}
			propSchema._origType = prop.valueType;
			propSchema._localizable = prop.localizable;
			propSchema.title = prop.label;
			// propSchema.required = true;
			propSchema.propertyOrder = this.#makeOrderKey(prop.sortKey, prop.name);

			const valConstr = PropValConstr.create(prop);
			if (valConstr) {
				valConstr.tweakSchema(propSchema);
			}

			sections[secKey].properties[prop.id] = propSchema;
			const disableProp = () => {
				propSchema.readonly = true;
				propSchema._fieldReadonly = true;
				const sub = this.editor.getEditor(`root.${secKey}.${prop.id}`);
				if (sub) {
					sub.disable();
				}
			};
			this._apiSvc.getGrainPermission(prop, MarBasGrainAccessFlag.WriteTraits)
				.then(res => {
					if (!res) {
						disableProp();
					}
				})
				.catch((reason) => {
					console.warn(reason);
					disableProp();
				});
		});
		// console.log('sections', sections);
		result.properties = merge({}, result.properties, sections);
		this.#resolveSchemaLabels(result);

		return result;
	}

	#updatePropDefEditorByValueType(valueType) {
		const ed = this.editor.getEditor(FieldValueType).parent;
		const customProps = EditorSchemaConfig[`PropDef_${valueType}`];
		const extList = { [MarBasTraitValueType.Memo]: EditorSchemaConfig.PropDef_Memo, [MarBasTraitValueType.DateTime]: EditorSchemaConfig.PropDef_DateTime };
		if (customProps) {
			delete extList[valueType];
			if (ed) {
				this.editor.schema.definitions.propDef.additionalProperties = true;
				ed.schema.properties = merge({}, ed.schema.properties, customProps);
				for (const k in customProps) {
					ed.addObjectProperty(k);
					this._addEditorListener(`${ed.path}.${k}`);
				}
			}
		} else {
			GrainXAttrs.setAttr(this.grain, 'propMod', null);
		}
		for (const ext in extList) {
			for (const k in extList[ext]) {
				delete this.grain[k];
				if (ed) {
					this._removeEditorListener(`${ed.path}.${k}`);
					ed.removeObjectProperty(k);
					delete ed.cached_editors[k];
				}
			}
		}
	}

	#updateSessionLinks() {
		MbDomUtils.updateSessionLinks(this.editor.element);
	}

	#resolveSchemaLabels(schema) {
		for (const r in this.#labelResolvers) {
			this.#labelResolvers[r]
				.then(label => {
					let text = label;
					if (schema._useTitle) {
						text = text ? `${schema._useTitle} (${text})` : schema._useTitle;
					}
					if (text) {
						schema.properties[r].title = text;
						if (this.editor.ready) {
							const sub = this.editor.getEditor(`root.${r}`);
							if (sub) {
								//sub.schema.title = label;
								sub.header_text = text;
								sub.updateHeaderText();
								delete this.#labelResolvers[r];
							}
						}
					}
				})
				.catch(console.warn);
		}
	}

	#resolveGlobalLabels() {
		const unresolved = this.editor.element.querySelectorAll('.mb-grain-resolvelabel');
		unresolved.forEach((elm) => {
			this.#resolveEditorLabel(this.editor.getEditor(elm.getAttribute('data-schemapath')));
		});
	}

	#resolveEditorLabel(editor) {
		if (editor) {
			const val = editor.getValue();
			if (val) {
				this._apiSvc.resolveGrainLabel(val).then(label => {
					// editor.schema.title = label;
					editor.header_text = editor.schema._useTitle ? `${editor.schema._useTitle} (${label})` : label;
					editor.updateHeaderText();
				}).catch(console.warn);
			} else {
				editor.header_text = editor.schema._useTitle || editor.schema.title;
				editor.updateHeaderText();
			}
		}
	}

	#collectChanges(editor) {
		if (this.editor && this.editor.is_dirty) {
			if (!this.grain) {
				this.grain = {};
			}
			const val = (editor || this.editor).getValue();
			const valMod = (value) => {
				return 'string' == typeof (value) && 0 == value.length ? null : value;
			};
			if ('object' == typeof (val)) {
				for (const key in val) {
					if (key.startsWith('_')) {
						continue;
					}
					if (editor) {
						this.grain[key] = valMod(val[key]);
					} else {
						for (const sub in val[key]) {
							if (sub.startsWith('_')) {
								continue;
							}
							this.grain[sub] = valMod(val[key][sub]);
						}
					}
				}
			} else if (editor) {
				const pp = editor.path.split('.');
				this.grain[pp[pp.length - 1]] = valMod(val);
			}
			// console.log('collectChanges', editor, this.grain);
		}
	}

	#markTraitChange(sourceKey) {
		if (sourceKey && sourceKey.startsWith('root._trait_')) {
			const editorKey = TraitPattern.exec(sourceKey)[0];
			const sub = this.editor.getEditor(editorKey);
			if (sub) {
				sub.is_dirty = true;
			}
			this.customProps.changes = this.customProps.changes || {};
			this.customProps.changes[editorKey] = true;
			return true;
		}
		return false;
	}

	#makeOrderKey(sortKey, name) {
		if (null != sortKey && !isNaN(sortKey)) {
			return Number(sortKey);
		}
		return Array.from(sortKey || name).reduce((res, curr, i) => res + (10 ** 16) / ((257 - (curr.charCodeAt(0) % 256)) * (256 ** (i + 1))), 0);
	}

	#getGrainPickerOptions(elm) {
		const opts = elm.getAttribute('data-pickeropts');
		if (opts) {
			return opts.startsWith('{') ? JSON.parse(opts) : EditorGrainPickerConfig[opts || 'DEFAULT'];
		}
		return {};
	}
} 