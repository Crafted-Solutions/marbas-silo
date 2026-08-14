import { JSONEditor } from "@json-editor/json-editor";
import merge from "lodash.merge";
import { Popover } from "bootstrap";
import { t } from "ttag";
import { MarBasDefaults, MarBasGrainAccessFlag, MarBasTraitValueType, MarBasGrainTier, MarBasRestrictTypeDefs } from "@crafted.solutions/marbas-core";

import { EditorGrainPickerConfig, EditorSchemaConfig } from "../conf/editor.conf";
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
import { FieldEditorPropConstraints } from "./jed/FieldEditorPropConstraints";
import { GrainPropConstraints } from "./cmn/GrainPropConstraints";
import { SiloEvtGrainModified } from "./cmn/SiloEvtGrainModified";
import { SiloEvtNavigate } from "./cmn/SiloEvtNavigate";
import { SiloEvtGrainDeleted } from "./cmn/SiloEvtGrainDeleted";
import { SiloEvtGrainRenamed } from "./cmn/SiloEvtGrainRenamed";
import { SiloEvtTypeDefDefaults } from "./cmn/SiloEvtTypeDefDefaults";

const FieldIcon = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}presentation.icon`;
const FieldLabel = `${EditorSchemaConfig.PATH_DEFAULT_GROUP}presentation.label`;
const GuidPattern = /[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/i;
const TraitPattern = new RegExp(`${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_([^\\.]+)\\.(${GuidPattern.source})`, 'i');

EditorSchemaConfig.reset();

function patchJedJoditEditor(jedEditors) {
	// BEGIN Jodit bug patch https://github.com/json-editor/json-editor/issues/1691
	// TODO remove when 1691 fixed
	jedEditors.jodit.prototype.enable = function () {
		jedEditors.string.prototype.enable.apply(this, arguments);
		this.input.readOnly = false;
		if (!this.always_disabled && this.jodit_instance) {
			this.jodit_instance.setDisabled(false);
			this.jodit_instance.setReadOnly(false);
		}
	};
	jedEditors.jodit.prototype.disable = function () {
		if (this.jodit_instance) {
			this.jodit_instance.setDisabled(true);
			this.jodit_instance.setReadOnly(true);
		}
		this.input.readOnly = true;
		jedEditors.string.prototype.disable.apply(this, arguments);
	};
	// END Jodit bug patch

	// Jodit doesn't understand 'undefined' values
	jedEditors.jodit.prototype.setValueToInputField = function (value) {
		jedEditors.string.prototype.setValueToInputField.apply(this, arguments);
		if (this.jodit_instance) {
			this.jodit_instance.setEditorValue(value || '');
		}
	};
}

function patchJedNumberEditor(jedEditors) {
	jedEditors.number.prototype.isDefaultRequired = function () {
		return !!this.jsoneditor.options.use_default_values;
	};
	jedEditors.number.prototype.getValue = function () {
		if (!this.dependenciesFulfilled) {
			return undefined;
		}
		if (this.shouldBeUnset() && !(this.input && this.input.value)) {
			return undefined;
		}
		const result = isNaN(this.value) ? this.value : parseFloat(this.value);
		return isNaN(result) ? this.value : result;
	};
}

const BASE_TITLE = document.title;

export class GrainEditor {
	#readyCb;
	#changeCb;
	#addRowCb;
	#watches = {};
	#dateFields;
	#labelResolvers = {};
	#grainPicker;
	_apiSvc;
	_element;
	_link;
	_schemaID;

	constructor(elementId, apiSvc, schemaID = 'BASIC') {
		this._element = document.getElementById(elementId);
		this._apiSvc = apiSvc;
		this._schemaID = schemaID;
		this.#changeCb = () => this.onEditorChange();
		this.#readyCb = () => this.onEditorReady();
		this.#addRowCb = (editor) => this.onEditorAddRow(editor);
		window.addEventListener('beforeunload', (evt) => {
			if (this.dirty) {
				evt.preventDefault();
				evt.returnValue = t`Grain was modified, close anyway?`;
			}
		});
		SiloEvtGrainDeleted.on(this.onGrainDeleted.bind(this));
		SiloEvtGrainRenamed.on((grainId, newName) => {
			if (this.editor && this.grain.id == grainId) {
				this.grain.name = newName;
			}
		}, false);
	}

	static setup = async function setup() {
		GrainEditor.setup = async function () { };

		const jedDefaults = JSONEditor.defaults;

		jedDefaults.options.theme = 'bootstrap5rev';
		jedDefaults.options.iconlib = 'bootstrap';
		jedDefaults.options.disable_edit_json = true;
		jedDefaults.options.no_additional_properties = true;
		jedDefaults.options.remove_empty_properties = false;
		jedDefaults.options.disable_properties = true;
		jedDefaults.options.array_controls_top = false;
		jedDefaults.options.required_by_default = true;
		jedDefaults.options.display_required_only = false;
		jedDefaults.options.show_opt_in = true;
		jedDefaults.options.disable_array_delete_last_row = true;
		jedDefaults.options.use_default_values = false;
		// jedDefaults.translateProperty = function (txt) {
		// 	if (_DEVELOPMENT_) {
		// 		return UILocale.tranlsate(txt, undefined, "JSONEditor.translateProperty");
		// 	}
		// 	return UILocale.tranlsate(txt);
		// };
		jedDefaults.translate = function (key, variables, schema) {
			let schemaMessages = {};
			if (schema && schema.options && schema.options.error_messages && schema.options.error_messages[jedDefaults.language]) {
				schemaMessages = schema.options.error_messages[jedDefaults.language];
			}
			const lang = jedDefaults.languages[jedDefaults.language] || EnvConfig.defaultLocale;
			let result = schemaMessages[key] || lang[key] || jedDefaults.languages[EnvConfig.defaultLocale][key] || key;
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
		jedDefaults.callbacks.upload = {
			uploadHandler: (jseditor, path, file, cbs) => {
				jseditor.jsoneditor._grainEditor.uploadHandler(jseditor, path, file, cbs);
			}
		};
		jedDefaults.callbacks.template = {
			fileSizeFormatter: (_, e) => {
				const baseT = Math.log(e.val) / Math.log(1024) | 0;
				return `${(e.val / Math.pow(1024, baseT)).toFixed(2)} ${(baseT ? 'KMGTPEZY'[baseT - 1] + 'iB' : 'Bytes')}`;
			}
		};
		jedDefaults.callbacks.button = {
			showTypeDefDefaults: (jseditor, e) => {
				jseditor.jsoneditor._grainEditor.onTypeDefDefaults(jseditor);
			}
		};

		FieldEditorGrain.install();
		FieldEditorIcon.install();
		FieldEditorPropConstraints.install();
		Bootstrap5RevTheme.install();

		const jedEditors = jedDefaults.editors;
		patchJedJoditEditor(jedEditors);
		patchJedNumberEditor(jedEditors);

		await ExtensionLoader.installExtension('GrainEditorStatic', {
			version: _PACKAGE_VERSION_,
			MarBasDefaults: MarBasDefaults,
			MarBasGrainAccessFlag: MarBasGrainAccessFlag,
			MarBasTraitValueType: MarBasTraitValueType,
			EditorGrainPickerConfig: EditorGrainPickerConfig,
			EditorSchemaConfig: EditorSchemaConfig,
			JSONEditor: JSONEditor
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
			const schema = await this._getSchema(this.grain, this.customProps);
			const startval = {
				[EditorSchemaConfig.NAME_PRIMARY_GROUP]: {
					_sys: {
						id: this.grain.id,
						api: this._apiSvc.baseUrl,
						dirty: ' '
					}
				},
				[EditorSchemaConfig.NAME_SECONDARY_GROUP]: {}
			};
			for (const rootkey in schema.properties) {
				for (const key in schema.properties[rootkey].properties) {
					if (key.startsWith('_')) {
						continue;
					}
					startval[rootkey][key] = this.grain;
				}
			}

			// TODO find out what this was for, currently no EditorSchemaConfig[PropDef_*] are defined
			// if (MarBasDefaults.ID_TYPE_PROPDEF == this.grain.typeDefId && EditorSchemaConfig[`PropDef_${this.grain.valueType}`]) {
			// 	schema.definitions.propDef.properties = merge({}, schema.definitions.propDef.properties, EditorSchemaConfig[`PropDef_${this.grain.valueType}`]);
			// }
			const valGroup = startval[EditorSchemaConfig.NAME_PRIMARY_GROUP];
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
			this.editor.off('ready', this.#readyCb);
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
			if ('yes' == await MsgBox.invokeYesNo(t`Grain was modified, save?`)) {
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
		try {
			if (this.customProps && this.customProps.changes) {
				for (const k in this.customProps.changes) {
					const sub = this.editor.getEditor(k);
					if (sub && sub.is_dirty) {
						const m = TraitPattern.exec(k);
						if (m && 2 < m.length) {
							await this._apiSvc.storeTraitValues(this.grain, {
								id: m[2],
								valueType: sub.schema._origType,
								localizable: sub.schema._localizable
							}, TraitUtils.getStorableValues(sub.isActive() ? sub.getValue() : undefined, sub.schema._origType));
						}
						sub.is_dirty = false;
					}
					delete this.customProps.changes[k];
				}
			}
			const storeGrain = this.#collectChanges();
			let setClean = !storeGrain;
			if (storeGrain && (await this._apiSvc.storeGrain(this.grain))) {
				const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_SECONDARY_GROUP}stats.mTime`);
				if (sub) {
					sub.setValueToInputField((new Date()).toLocaleString());
				}
				setClean = true;
			}
			if (setClean) {
				this._setDirty(false);
			}

		} catch (e) {
			console.error(e);
			MsgBox.invokeErr(e);
		}
		return this.grain;
	}

	async validate(showMessage = true, focusError = !this.isPopup) {
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

	get isPopup() {
		return !!this._element.closest('.modal');
	}

	onEditorChange() {
		if (this.editor.initializing) {
			delete this.editor.initializing;
			return;
		}
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
		} else if (FieldLabel == editorKey && !sub.getValue()) {
			sub.value = this.grain.name;
			sub.setValueToInputField(sub.value);
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
			}, this.getGrainPickerOptions(editor.parent.container));
		}
	}

	onOptInChange(editor) {
		if (editor && !editor.optInCheckbox.checked) {
			const val = editor.getValue();
			if (undefined != val && ('string' != typeof val || val.length)) {
				editor.setValue(undefined);
				if ('function' == typeof editor.setValueToInputField) {
					editor.setValueToInputField(undefined);
					editor.refreshValue();
					if (!editor.is_dirty) {
						editor.onChange(true);
					}
				}
				return true;
			}
		}
	}

	onEditorReady() {
		try {
			document.title = `${this.grain.label} - ${window.EnvConfig ? window.EnvConfig.title : BASE_TITLE}`;
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
					if (!sub.isRequired() && sub.optInAppended && sub.optInCheckbox) {
						sub.optInCheckbox.addEventListener('change', () => {
							this.onOptInChange(sub);
						});
					}
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
		SiloEvtTypeDefDefaults.trigger(this.grain.id, this.grain.defaultInstanceId);
	}

	async onGrainDeleted(grainId) {
		if (this.editor && this.grain) {
			if (this.grain.id == grainId) {
				if (!this.isPopup) {
					this.editor.is_dirty = false;
					await this.unloadEditor();
				}
			} else if (this.grain.defaultInstanceId == grainId) {
				delete this.grain.defaultInstanceId;
			} else {
				const prop = this._getCustomProperty(grainId);
				if (prop) {
					const sub = this._getTraitEditor(prop);
					if (sub) {
						if (sub.parent) {
							delete sub.parent.editors[sub.key];
						}
						sub.destroy();
					}
					this.customProps.def.splice(this.customProps.def.indexOf(prop), 1);
					delete this.customProps.traits[prop.name];
					if (this.customProps.changes) {
						delete this.customProps.changes[GrainEditor.makeTraitPath(prop)];
					}
				}
			}
		}
	}

	_setDirty(dirty = true) {
		this._ignoreChange = true;
		this.editor.was_dirty = this.editor.is_dirty;
		const sub = this.editor.getEditor(`${EditorSchemaConfig.PATH_SYS_OBJECT}.dirty`);
		if (sub) {
			sub.setValue(dirty ? '*' : ' ');
		}
		this.editor.is_dirty = dirty;
		this.editor.root.header.parentNode.querySelectorAll('.mb-grain-edit-save, .mb-grain-edit-reset').forEach(btn => btn.disabled = !dirty);
		delete this._ignoreChange;
	}

	_notify() {
		SiloEvtGrainModified.trigger(this.grain);
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
			this.#grainPicker = GrainPicker.instance(this._apiSvc);
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

	_getCustomProperty(propDefId) {
		return this.customProps.def.find((element) => element.id == propDefId)
	}

	_getTraitEditor(propDefOrId) {
		if (this.editor) {
			const prop = propDefOrId.id ? propDefOrId : this._getCustomProperty(propDefOrId);
			if (prop) {
				return this.editor.getEditor(GrainEditor.makeTraitPath(prop));
			}
		}
		return undefined;
	}

	async _createActions() {
		if (this.editor) {
			const btnHolder = this.editor.root.theme.getHeaderButtonHolder();
			// button labels are translated via GrainEditor.translate
			let btn = this.isPopup ? null : this.editor.root.getButton('', 'arrows', 'Select in the navigation');
			if (btn) {
				btn.classList.add('btn-outline-secondary');
				btn.classList.remove('btn-secondary', 'btn-sm');
				btn.addEventListener('click', () => {
					SiloEvtNavigate.trigger(this.grain.id);
				});
				btnHolder.appendChild(btn);
			}

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
							`[data-schemapath="${GrainEditor.makeTraitPath(prop)}"] ${1 == prop.cardinalityMax ? 'label' : '.card-title'}`
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
		const baseUrl = new URL(this._apiSvc.baseUrl, window.location.href).href;
		media.forEach((anchor) => {
			if (anchor.href && anchor.href.startsWith(baseUrl)) {
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

	async _getSchema(grain, customProps) {
		let result = EditorSchemaConfig[this._schemaID];
		if (EditorSchemaConfig[this.grain._tier]) {
			result = merge({}, result, EditorSchemaConfig[this.grain._tier]);
			if (MarBasGrainTier.ITypeDef == this.grain._tier && MarBasRestrictTypeDefs.includes(grain.id)) {
				delete result.definitions.typeDef.properties.mixInIds;
			}
		}
		result = await this._extendSchemaByTraits(customProps, result);
		if (_DEVELOPMENT_) {
			console.log('getSchema', result);
		}
		return result;
	}

	async _extendSchemaByTraits(customProps, baseSchema) {
		if (!customProps || !customProps.def || !customProps.def.length) {
			return baseSchema;
		}
		let result = structuredClone(baseSchema);

		const sections = {};
		let ord = 100;
		for (const prop of customProps.def) {
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
			let configKey = `TRAIT_${prop.valueType}`;
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

			const constrHandler = GrainPropConstraints.createHandler(prop.constraintParams, GrainXAttrs.getAttr(prop, 'propMod'));
			if (constrHandler) {
				await constrHandler.tweakTargetSchema(prop, propSchema);
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
		}
		// console.log('sections', sections);

		const group = GrainEditor._getTraitSchemaGroup(result);
		group.properties = merge({}, group.properties, sections);
		this.#resolveSchemaLabels(group);

		return result;
	}

	static _getTraitSchemaGroup(schema) {
		return schema.properties[EditorSchemaConfig.NAME_PRIMARY_GROUP];
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
						if (this.editor && this.editor.ready) {
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
		let result = false;
		if (this.editor && this.editor.is_dirty) {
			if (!this.grain) {
				this.grain = {};
			}
			const editors = editor ? [editor] : Object.values(this.editor.editors).filter(x => x && x.schema && x.schema._store);
			const valMod = (value) => {
				return 'string' == typeof (value) && 0 == value.length ? null : value;
			};
			for (const sub of editors) {
				if (sub.is_dirty) {
					this.grain[sub.key] = valMod(sub.getValue());
					if (!editor) {
						sub.is_dirty = false;
					}
					result = true;
				}
			}
			// console.log('collectChanges', editors, this.grain);
		}
		return result;
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

	static makeTraitPath(prop) {
		return `${EditorSchemaConfig.PATH_DEFAULT_GROUP}_trait_${TraitUtils.getContainerName(prop)}.${prop.id}`;
	}

	getGrainPickerOptions(elm) {
		let result = {};
		const opts = elm.getAttribute('data-pickeropts');
		if (opts) {
			result = opts.startsWith('{') ? JSON.parse(opts) : EditorGrainPickerConfig[opts || 'DEFAULT'];
			if (result.root && !GuidPattern.test(result.root)) {
				result.root = this._apiSvc.resolveGrainPath(result.root, this.grain);
			}
		}
		result.disableGrains = [this.grain.id];
		return result;
	}
}
