import { JSONEditor } from "@json-editor/json-editor";
import merge from "lodash.merge";
import { Popover } from "bootstrap";
import { t } from "ttag";

import { EditorGrainPickerConfig, EditorSchemaConfig } from "../conf/editor.conf";
import { MarBasDefaults, MarBasGrainAccessFlag, MarBasTraitValueType } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "./cmn/GrainXAttrs";
import { GrainPicker } from "./cmn/GrainPicker";
import { MsgBox } from "./cmn/MsgBox";
import { MbDomUtils } from "./cmn/MbDomUtils";
import { ExtensionLoader } from "./ExtensionLoader";
import { FieldEditorGrain } from "./jed/FieldEditorGrain";
import { Bootstrap5RevTheme } from "./jed/Bootstrap5RevTheme";
import { TraitUtils } from "./cmn/TraitUtils";
import { FieldEditorIcon } from "./jed/FieldEditorIcon";
import { UILocale } from "./UILocale";

const FieldIcon = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}presentation.icon`;
const FieldValueType = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}propDef.valueType`;
const FieldRtf = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}propDef.isRtf`;
const FieldDateOnly = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}propDef.isDateOnly`;
const FieldConstrParams = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}propDef._constraintParams`;
const TraitPattern = new RegExp(`${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_([^\\.]+)\\.([0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})`, 'i');

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
				evt.returnValue = t`Grain was modified, close anyway?`;
			}
		});
		document.addEventListener('mb-silo:grain-deleted', (evt) => {
			if (this.editor && this.grain.defaultInstanceId == evt.detail) {
				delete this.grain.defaultInstanceId;
			}
		});
		document.addEventListener('mb-silo:grain-renamed', (evt) => {
			if (this.editor && this.grain.id == evt.detail.id) {
				this.grain.name = evt.detail.name;
			}
		});
	}

	static setup = async function setup() {
		GrainEditor.setup = async function () { };

		JSONEditor.defaults.options.theme = 'bootstrap5rev';
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
		// JSONEditor.defaults.translateProperty = function (txt) {
		// 	if (_DEVELOPMENT_) {
		// 		return UILocale.tranlsate(txt, undefined, "JSONEditor.translateProperty");
		// 	}
		// 	return UILocale.tranlsate(txt);
		// };
		JSONEditor.defaults.translate = function (key, variables, schema) {
			let schemaMessages = {};
			if (schema && schema.options && schema.options.error_messages && schema.options.error_messages[JSONEditor.defaults.language]) {
				schemaMessages = schema.options.error_messages[JSONEditor.defaults.language];
			}
			const lang = JSONEditor.defaults.languages[JSONEditor.defaults.language] || EnvConfig.defaultLocale;
			let result = schemaMessages[key] || lang[key] || JSONEditor.defaults.languages[EnvConfig.defaultLocale][key] || key;
			if (_DEVELOPMENT_) {
				result = UILocale.tranlsate(result, undefined, "JSONEditor.translate");
			} else {
				result = UILocale.tranlsate(result);
			}
			if (variables) {
				for (let i = 0; i < variables.length; i++) {
					result = result.replace(new RegExp(`\\{\\{${i}}}`, 'g'), variables[i]);
				}
			}
			return result;
		}
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

		FieldEditorGrain.install();
		FieldEditorIcon.install();
		Bootstrap5RevTheme.install();

		await ExtensionLoader.installExtension('GrainEditorStatic', {
			version: _PACKAGE_VERSION_,
			MarBasDefaults: MarBasDefaults,
			MarBasGrainAccessFlag: MarBasGrainAccessFlag,
			MarBasTraitValueType: MarBasTraitValueType,
			EditorGrainPickerConfig: EditorGrainPickerConfig,
			EditorSchemaConfig: EditorSchemaConfig,
			JSONEditor: JSONEditor,
			PropValConstr: PropValConstr
		});
	}

	static get defaults() {
		return EditorSchemaConfig;
	}

	async buildEditor(grainBase, forceReload = false, link = undefined) {
		await GrainEditor.setup();
		if (!forceReload && this.grain && grainBase && this.grain.id == grainBase.id && this.grain._ts >= grainBase._ts && this._link == link) {
			return;
		}
		this._link = link;

		await this.unloadEditor();
		this.grain = grainBase;
		if (grainBase) {
			this.grain = await this._apiSvc.resolveGrainTier(grainBase);
			const prevIcon = this.grain.icon;
			if (prevIcon != GrainXAttrs.getGrainIcon(this.grain)) {
				this._notify();
			}
			delete this.grain._siloAttrsMod;

			PropValConstr.init(this.grain);
			this.customProps = {
				def: await this._apiSvc.getGrainPropDefs(this.grain)
			};
			if (this.customProps.def.length) {
				this.customProps.traits = await this._apiSvc.getGrainTraits(this.grain);
			}
			for (const key in this.grain) {
				if (null == this.grain[key]) {
					this.grain[key] = undefined;
				}
			}
			const schema = this._getSchema(this.grain, this.customProps);
			const startval = {
				_1: {
					_sys: {
						api: this._apiSvc.baseUrl
					}
				},
				_2: {}
			};
			for (const rootkey in schema.properties) {
				for (const key in schema.properties[rootkey].properties) {
					if (key.startsWith('_')) {
						continue;
					}
					startval[rootkey][key] = this.grain;
				}
			}

			if (MarBasDefaults.ID_TYPE_PROPDEF == this.grain.typeDefId && EditorSchemaConfig[`PropDef_${this.grain.valueType}`]) {
				schema.definitions.propDef.properties = merge({}, schema.definitions.propDef.properties, EditorSchemaConfig[`PropDef_${this.grain.valueType}`]);
			}
			const valGroup = startval._1;
			if (this.grain.valueType == MarBasTraitValueType.DateTime) {
				valGroup.propDef.isDateOnly = GrainXAttrs.getAttr(this.grain, 'propMod') == "dateonly";
			}
			else if (this.grain.valueType == MarBasTraitValueType.Memo) {
				valGroup.propDef.isRtf = GrainXAttrs.getAttr(this.grain, 'propMod') == "rtf";
			}
			if (this.customProps.def.length && this.customProps.traits) {
				const schemaGroup = GrainEditor._getTraitSchemaGroup(schema);
				this.customProps.def.forEach((prop) => {
					const secKey = `_trait_${TraitUtils.getContainerName(prop)}`;
					if (!valGroup[secKey]) {
						valGroup[secKey] = {};
					}
					const trait = this.customProps.traits[prop.name];
					if (trait && trait.length) {
						valGroup[secKey][prop.id] = TraitUtils.getEditableValue(prop, trait);
						if (trait[0].grainId != this.grain.id) {
							schemaGroup.properties[secKey].properties[prop.id].title += t` (Default Value)`;
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
		this.#dateFields = [`${EditorSchemaConfig.PATH_SECONDARY_GROUP}stats.cTime`, `${EditorSchemaConfig.PATH_SECONDARY_GROUP}stats.mTime`];
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
			if ('yes' == await MsgBox.invoke(t`Grain was modified, save?`, { icon: 'primary', buttons: { 'yes': true, 'no': true } })) {
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
		const errors = await this.validate();
		if (errors.length) {
			console.warn("editor.errors", errors);
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
			const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_SECONDARY_GROUP}stats.mTime`);
			if (sub) {
				sub.setValueToInputField((new Date()).toLocaleString());
			}
			this._setDirty(false);
		}
		return this.grain;
	}

	async validate(showMessage = true, focusError = true) {
		const result = this.editor.validate();
		let actGroupPath = focusError ? this._getActiveGroup().getAttribute('data-schemapath') : undefined;
		let invalidPath;
		for (let i = result.length - 1; i >= 0; i--) {
			const sub = this.editor.getEditor(result[i].path);
			// WA for json-editor bug in Validator._validateV3Required
			if (sub && 'info' == sub.schema.format) {
				result.splice(i, 1);
			} else if (actGroupPath && !result[i].path.startsWith(actGroupPath)) {
				invalidPath = result[i].path;
				actGroupPath = undefined;
			}
		}
		if (result.length) {
			this.editor.showValidationErrors(result);
			if (showMessage) {
				await MsgBox.invokeErr(t`Please correct input errors first`);
			}
			if (invalidPath) {
				const tabId = this._getGroupByPath(invalidPath).closest('.tab-pane').id;
				const trigger = this._element.querySelector(`[data-toggle="tab"][href="#${tabId}"]`);
				//Tab.getInstance(trigger).show(); // NO AVAIL
				trigger.click();
				const label = this._element.querySelector(`[data-schemapath="${invalidPath}"] label`);
				if (label) {
					label.click();
				}
			}
		}
		return result;
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
					this._checkEmbeddedMedia(editor);
					this.#updateSessionLinks();
				} else {
					editor.parent.setValue(editor.parent.getValue().filter(val => !!val));
				}
				if (!this.editor.was_dirty) {
					this._setDirty(makeDirty);
				}
			}, GrainEditor.getGrainPickerOptions(editor.parent.container));
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

			for (const key in this.editor.editors) {
				const sub = this.editor.editors[key];
				if (!sub) {
					continue;
				}
				if (sub.schema.readonly) {
					if ('object' == sub.schema.type) {
						// WA for JE bug ignoring readonly on objects
						sub.disable();
					}
				} else if (!key.startsWith(EditorSchemaConfig.PATH_SYS_OBJECT) && EditorSchemaConfig.DEPTH_DATA_CARRIER + 1 == key.split('.').length) {
					this._addEditorListener(key);
				}
			}

			this.editor.on('change', this.#changeCb);
			this.editor.on('addRow', this.#addRowCb);

			this.updateIcon(false);

			this.#createFieldActions();
			this.#resolveSchemaLabels(GrainEditor._getTraitSchemaGroup(this.editor.schema));
			this._checkEmbeddedMedia();
			this.#resolveGlobalLabels();
			this.#renderFieldComments();

			this.#updateSessionLinks();

		} catch (e) {
			console.error(e);
			MsgBox.invokeErr(`Error setting up editor: ${e.message}`);
		}
	}

	updateIcon(modified = true) {
		const sub = this.editor.getEditor(FieldIcon);
		if (sub && modified) {
			GrainXAttrs.setGrainIcon(this.grain, sub.getValue());
		} else {
			GrainXAttrs.getGrainIcon(this.grain);
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
		this._checkEmbeddedMedia(editor);
		editor.preview.innerHTML = "";
		editor.fileDisplay.value = t`No file selected`;
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
		const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_SYS_OBJECT}.dirty`);
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
		this.#grainPicker.addEventListener('hidden.bs.modal', () => {
			closeCallback(this.#grainPicker);
		}, { once: true });
		this.#grainPicker.show(pickerOptions);
	}

	_getActiveGroup() {
		return this._element.querySelector('.tab-pane.active .mb-tab-container');
	}

	_getGroupByPath(path) {
		const groupPath = path.substring(0, EditorSchemaConfig.PATH_DEFAULT_GROUP.length - 1);
		return this._element.querySelector(`[data-schemapath="${groupPath}"]`);
	}

	async _createActions() {
		if (this.editor) {
			const btnHolder = this.editor.root.theme.getHeaderButtonHolder();
			// button labels are translated via GrainEditor.translate
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
		// nothing yet
	}

	#renderFieldComments() {
		if (this.customProps.def.length && this.customProps.traits) {
			this.customProps.def.forEach((prop) => {
				this._apiSvc.getTraitValues(prop, MarBasDefaults.ID_PROPDEF_COMMENT).then((comments) => {
					if (comments && comments.length && comments[0].value) {
						const lbl = this.editor.element.querySelector(
							1 == prop.cardinalityMax
								? `[data-schemapath="${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_${TraitUtils.getContainerName(prop)}.${prop.id}"] label`
								: `[data-schemapath="${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_${TraitUtils.getContainerName(prop)}.${prop.id}"] .card-title`
						);
						if (lbl) {
							const elm = this.editor.theme.getInfoButton(comments[0].value);
							elm.title = t`Field Info`;
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

	_checkEmbeddedMedia(editor) {
		const cont = editor ? editor.container : this.editor.element;
		const media = cont.querySelectorAll('.mb-grain-file');
		media.forEach((anchor) => {
			if (anchor.href && anchor.href.startsWith(this._apiSvc.baseUrl)) {
				this._apiSvc.loadBlob(anchor.href, /^(image|video|audio)\/.*/)
					.then(blob => {
						let elm;
						if (blob.type.startsWith('image/')) {
							elm = document.createElement('img');
						} else {
							elm = document.createElement(blob.type.startsWith('video/') ? 'video' : 'audio');
							elm.setAttribute('controls', 'controls');
							elm.classList.add('je-media');
						}
						anchor.setAttribute('title', anchor.textContent);
						anchor.innerHTML = '';
						const objUrl = URL.createObjectURL(blob);
						elm.onload = () => URL.revokeObjectURL(objUrl);
						elm.src = objUrl;
						anchor.appendChild(elm);
					})
					.catch(console.warn);
			}
		});
	}

	_getSchema(grain, customProps) {
		let result = EditorSchemaConfig.BASIC;
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
			const setRequiredProp = (itemSchema) => {
				itemSchema.required = 0 < prop.cardinalityMin;
				if (itemSchema.required
					&& (MarBasTraitValueType.Text == prop.valueType || MarBasTraitValueType.Memo == prop.valueType
						|| MarBasTraitValueType.Grain == prop.valueType || MarBasTraitValueType.File == prop.valueType
					)) {
					itemSchema.minLength = 1;
				}
			};
			if (TraitUtils.isArray(prop)) {
				propSchema = {
					type: 'array',
					options: {
						disable_collapse: true
					},
					items: propSchema
				};
				setRequiredProp(propSchema.items);
				if (!propSchema.items.options) {
					propSchema.items.options = {};
				}
				propSchema.items.options.compact = true;
				if (propSchema.items.options.containerAttributes) {
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
				setRequiredProp(propSchema);
			}
			propSchema._origType = prop.valueType;
			propSchema._localizable = prop.localizable;
			propSchema.title = prop.label;
			propSchema.propertyOrder = GrainEditor.makeOrderKey(prop.sortKey, prop.name);

			const valConstr = PropValConstr.create(prop);
			if (valConstr) {
				valConstr.tweakSchema(propSchema);
			}

			sections[secKey].properties[prop.id] = propSchema;
			const disableProp = () => {
				propSchema.readonly = true;
				propSchema._fieldReadonly = true;
				const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_DEFAULT_GROUP}${secKey}.${prop.id}`);
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

		const group = GrainEditor._getTraitSchemaGroup(result);
		group.properties = merge({}, group.properties, sections);
		this.#resolveSchemaLabels(group);

		return result;
	}

	static _getTraitSchemaGroup(schema) {
		return schema.properties._1;
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
		for (const traitKey in this.#labelResolvers) {
			this.#labelResolvers[traitKey]
				.then(label => {
					let text = label;
					if (schema._useTitle) {
						text = text ? `${schema._useTitle} (${text})` : schema._useTitle;
					}
					if (text) {
						schema.properties[traitKey].title = text;
						if (this.editor.ready) {
							const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_DEFAULT_GROUP}${traitKey}`);
							if (sub) {
								//sub.schema.title = label;
								sub.header_text = text;
								sub.updateHeaderText();
								delete this.#labelResolvers[traitKey];
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
		if (sourceKey && sourceKey.startsWith(`${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_`)) {
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

	static makeOrderKey(sortKey, name) {
		if (null != sortKey && !isNaN(sortKey)) {
			return Number(sortKey);
		}
		return Array.from(sortKey || name).reduce((res, curr, i) => res + (10 ** 16) / ((257 - (curr.charCodeAt(0) % 256)) * (256 ** (i + 1))), 0);
	}

	static getGrainPickerOptions(elm) {
		const opts = elm.getAttribute('data-pickeropts');
		if (opts) {
			return opts.startsWith('{') ? JSON.parse(opts) : EditorGrainPickerConfig[opts || 'DEFAULT'];
		}
		return {};
	}
}
