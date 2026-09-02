import { t } from "ttag";
import { JSONEditor } from "@json-editor/json-editor";

import dialogHtml from "../partials/TranslationDialog.hbs";

import { _Dialog } from "./cmn/_Dialog";
import { MbDomUtils } from "./cmn/MbDomUtils";
import { Task } from "./cmn/Task";

const FORMATS = {
	text: 'f7f61c2f-da17-45ff-83ce-18fc5d31b51f',
	markdown: '3c7398df-6eb5-44b4-8898-129bd51de4d1',
	html: 'ab953ff1-a6cc-452e-ac4f-a685f13d79bc'
};

const FIELD_SOURCE_LANG = 'SourceLanguage';
const FILED_TARGET_LANG = 'TargetLanguage';
const FIELD_SOURCE_TEXT = 'SourceText';
const FIELD_TRANSLATION = 'Translation';

function fieldPath(field) {
	return `root.${field}`;
}

const EDITOR_CONF = {
	type: 'object',
	format: 'grid-strict',
	options: {
		compact: true,
		titleHidden: true,
		disable_collapse: true
	},
	properties: {
		[FIELD_SOURCE_LANG]: {
			get title() { return t`Source Language`; },
			type: 'string',
			enumSource: [
				{
					source: [],
					title: "{{item.title}}",
					value: "{{item.value}}"
				}
			],
			options: {
				grid_columns: 6
			}
		},
		[FILED_TARGET_LANG]: {
			get title() { return t`Target Language`; },
			type: 'string',
			enumSource: [
				{
					source: [{
						value: '',
						get title() { return t`Please Select`; }
					}],
					title: "{{item.title}}",
					value: "{{item.value}}"
				}
			],
			options: {
				grid_columns: 6
			}
		},
		[FIELD_SOURCE_TEXT]: {
			get title() { return t`Source Text`; },
			type: 'string',
			format: 'textarea',
			options: {
				grid_columns: 6
			}
		},
		[FIELD_TRANSLATION]: {
			get title() { return t`Translated Text`; },
			type: 'string',
			format: 'textarea',
			required: false,
			options: {
				grid_columns: 6
			}
		}
	}
};

class TranslationDialog extends _Dialog {
	#module;
	#editor;
	#source;
	constructor(module, scope = 'translate-dlg') {
		MbDomUtils.buildFromTemplate(scope, dialogHtml, _Dialog.getDefaultI18n({
			i18n: {
				title: t`Translate Field`,
				alertPrivacy: t`Data from this dialog may be tramsmitted to a third-party translation service, use it with caution, do not enter sensible or private information if you do not trust the provider fully.`,
				alertFormat: t`The translation service doesn't support rich text, formatting may be lost during translation.`
			}
		}));
		super(scope);
		this.#module = module;
	}
	show(path) {
		this.#source = this.#grainEditor.editor.getEditor(path);
		let title = this.#source.getTitle();
		if (this.#isArray) {
			title = `${this.#source.parent.getTitle()} / ${title}`;
		}
		this._getScoped('title span').textContent = t`Translate "${title}"`;
		this._getScoped('subtitle').textContent = `${this.#grainEditor.editor.root.header_text} (${this.#grainEditor.grain.path})`;

		if (this.#editor) {
			this.#editor.destroy();
		}
		this.#load();
		super.show();
	}
	get value() {
		return this.#editor ? this.#editor.getValue() : {};
	}
	get #grainEditor() {
		return this.#module.editor;
	}
	get #config() {
		return this.#module.config;
	}
	get #apiSvc() {
		return this.#module.editor._apiSvc;
	}
	get #isRichText() {
		return 'jodit' == this.#source.schema.format;
	}
	get #isArray() {
		return this.#source.parent && 'array' == this.#source.parent.schema.type;
	}
	get #sourceLanguageEditor() {
		return this.#editor.getEditor(fieldPath(FIELD_SOURCE_LANG));
	}
	get #targetLanguageEditor() {
		return this.#editor.getEditor(fieldPath(FILED_TARGET_LANG));
	}
	get #sourceTextEditor() {
		return this.#editor.getEditor(fieldPath(FIELD_SOURCE_TEXT));
	}
	get #targetTextEditor() {
		return this.#editor.getEditor(fieldPath(FIELD_TRANSLATION));
	}
	async #load() {
		const hasService = await this.#module.getBackendURL();
		MbDomUtils.hideNode(this._getScoped('alert-privacy')
			, !hasService || (await this.#module.serviceConfig.getValue('ProviderIsTrusted', false)));
		MbDomUtils.hideNode(this._getScoped('alert-format')
			, !hasService || !this.#isRichText || (await this.#module.backendHasFormat('html')));

		const schema = structuredClone(EDITOR_CONF);
		if (this.#isRichText) {
			schema.properties[FIELD_SOURCE_TEXT].format = schema.properties[FIELD_TRANSLATION].format = this.#source.schema.format;
		}
		this.#editor = new JSONEditor(this._getScoped('editor'), {
			schema: schema,
			startVal: {},
			show_opt_in: false,
			custom_validators: [this.#validate.bind(this)]
		});
		this.#editor.on('ready', this.#onEditorReady.bind(this));

	}
	#validate(schema, value, path) {
		const result = [];
		if (fieldPath(FILED_TARGET_LANG) == path || fieldPath(FIELD_SOURCE_LANG) == path) {
			if (value) {
				const otherVal = (fieldPath(FILED_TARGET_LANG) == path ? this.#sourceLanguageEditor : this.#targetLanguageEditor).getValue();
				if (value == otherVal) {
					result.push({
						path: path,
						message: t`Target language must be distinct from source`
					});
				}
			} else {
				result.push({
					path: path,
					message: t`Value required`
				});
			}
		}
		return result;
	}
	async #onEditorReady() {
		const langFrom = this.#sourceLanguageEditor;
		const langTo = this.#targetLanguageEditor;
		const langList = await this.#apiSvc.listLanguages();
		for (const lang of langList) {
			const item = {
				value: lang.isoCode,
				title: lang.labelNative || lang.label || lang.isoCode
			};
			langFrom.enumSource[0].source.push(item);
			langTo.enumSource[0].source.push(item);
		}
		langFrom.onWatchedFieldChange();
		langTo.onWatchedFieldChange();

		langFrom.setValue(this.#apiSvc.language);

		this.#sourceTextEditor.setValue(this.#source.getValue());

		await this.#createActions();

		this.#editor.watch(fieldPath(FIELD_SOURCE_LANG), this.#onLangChange.bind(this, FIELD_SOURCE_LANG));
		this.#editor.watch(fieldPath(FILED_TARGET_LANG), this.#onLangChange.bind(this, FILED_TARGET_LANG));
	}
	async #createActions() {
		const backend = await this.#module.getBackendURL();
		if (backend) {
			const btnHolder = this.#editor.root.theme.getHeaderButtonHolder();

			const url = new URL(backend);
			const lbl = t`Tranlate With ${url.host}`;
			const btn = this.#editor.root.getButton(lbl, 'translate', lbl);
			btn.classList.add('btn-primary');
			btn.classList.remove('btn-secondary', 'btn-sm');
			btn.addEventListener('click', this.#translate.bind(this));
			btnHolder.appendChild(btn);

			this.#editor.root.controls.appendChild(btnHolder);
		}
	}
	async #onLangChange(editorKey) {
		const lang = this.#editor.getEditor(fieldPath(editorKey)).getValue();
		let val;
		if ('label' == this.#source.key) {
			const labels = await this.#apiSvc.getGrainLabels(this.#grainEditor.grain.id, [lang]);
			if (labels && labels.length && labels[0].label) {
				val = labels[0].label;
			}
		} else {
			let propDefId = this.#source.key;
			let traitIndex = 0;
			if (this.#isArray) {
				propDefId = this.#source.parent.key;
				traitIndex = Number(this.#source.key);
			}
			const traitVals = await this.#apiSvc.getTraitValues({
				id: this.#grainEditor.grain.id,
				revision: this.#grainEditor.grain.revision
			}, propDefId, lang);
			if (traitVals && traitVals.length && traitVals[traitIndex].value) {
				val = traitVals[traitIndex].value;
			}
		}
		if (val) {
			(FIELD_SOURCE_LANG == editorKey ? this.#sourceTextEditor : this.#targetTextEditor).setValue(val);
		}
	}
	async #translate() {
		const errors = this.#editor.validate();
		if (errors.length) {
			this.#editor.showValidationErrors(errors);
			return;
		}
		await Task.nowAsync(t`Requesting translation`, async (done, error) => {
			try {
				const values = this.value;
				const req = {};
				if (this.#isRichText && !(await this.#module.backendHasFormat('html'))) {
					values[FIELD_SOURCE_TEXT] = global.Jodit.modules.Helpers.stripTags(values[FIELD_SOURCE_TEXT]);
				}
				if (!(await this.#module.backendSupportsCountryCode())) {
					values[FIELD_SOURCE_LANG] = values[FIELD_SOURCE_LANG].replace(/-.*$/, '');
					values[FILED_TARGET_LANG] = values[FILED_TARGET_LANG].replace(/-.*$/, '');
				}
				for (const k in values) {
					if (FIELD_TRANSLATION != k) {
						await this.#mapReqParam(req, k, values[k]);
					}
				}
				await this.#mapReqParam(req, 'Format', 'jodit' == this.#sourceTextEditor.schema.format ? 'html' : 'text', false);
				await this.#mapReqParam(req, 'Engine', await this.#module.getEngine(), false);

				const method = await this.#module.getBackendMethod();
				const resp = 'GET' == method.toUpperCase() ? (await this.#fetchGet(req)) : (await this.#fetchDefault(req, method));
				if (resp.ok) {
					const json = await resp.json();
					const sub = this.#targetTextEditor;
					sub.setValue(await this.#mapRespValue(json, sub.key));
				} else {
					console.error(await resp.text());
					error(t`Translation service returned error`);
				}
				done();
			} catch (e) {
				error(e);
			}

		}, Task.Flag.DEFAULT | Task.Flag.REPORT_START | Task.Flag.REPORT_STATUS);
	}
	async #fetchGet(req) {
		const wrapParam = await this.#module.parametersConfig.getValue('WrapperParameter');
		if (wrapParam) {
			req[wrapParam] = JSON.stringify(req);
		}
		const opts = {
			method: 'GET'
		};
		this.#authorizeRequest(req, opts);
		const url = new URL(await this.#module.getBackendURL());
		url.search = `?${(new URLSearchParams(req))}`;
		return await fetch(url, opts);
	}
	async #fetchDefault(req, method) {
		const wrapParam = await this.#module.parametersConfig.getValue('WrapperParameter');
		if (wrapParam) {
			req[wrapParam] = req;
		}
		const opts = {
			method: method,
			headers: {
				"Content-Type": "application/json"
			}
		};
		this.#authorizeRequest(req, opts);
		opts.body = JSON.stringify(req);
		return await fetch(await this.#module.getBackendURL(), opts);
	}
	async #authorizeRequest(req, opts) {
		const token = await this.#module.getAPIToken();
		if (token) {
			if (await this.#module.parametersConfig.getValue('APITokenIsHeader', false)) {
				if (!opts.headers) {
					opts.headers = {};
				}
				opts.headers[await this.#module.parametersConfig.getValue('APIToken', 'x-token')] = token;
			} else {
				this.#mapReqParam(req, 'APIToken', token);
			}
		}
	}
	async #mapReqParam(req, name, value, required = true) {
		const paramPath = (await this.#module.parametersConfig.getValue(name, required ? name : '')).split('.');
		let last = req;
		for (let i = 0; i < paramPath.length; i++) {
			const p = paramPath[i];
			if (!p.length) {
				continue;
			}
			if (i == paramPath.length - 1) {
				last[p] = value;
			} else if (!req[p]) {
				last[p] = {};
			}
			last = last[p];
		}
		return req;
	}
	async #mapRespValue(resp, name) {
		const valPath = (await this.#module.responseConfig.getValue(name, name)).split('.');
		let last = resp;
		for (let i = 0; i < valPath.length; i++) {
			const v = valPath[i];
			if (i == valPath.length - 1 || 'object' != typeof last[v]) {
				return last[v];
			}
			last = last[v];
		}
	}
}

export class TranslationModule {
	#editor;
	#config;
	#dialog;
	constructor(config, editor) {
		this.#config = config;
		this.#editor = editor;
	}
	get editor() {
		return this.#editor;
	}
	get config() {
		return this.#config;
	}
	get serviceConfig() {
		return this.#config.getSection('TranslationModule');
	}
	get parametersConfig() {
		return this.#config.getSection('RequestParameters');
	}
	get responseConfig() {
		return this.#config.getSection('ResponseProperties');
	}
	async backendSupportsCountryCode() {
		return await this.serviceConfig.getValue('SupportsCountryCodes', false);
	}
	async backendHasFormat(format) {
		return (await this.serviceConfig.getValue('SupportedFormats')).includes(FORMATS[format]);
	}
	async getBackendURL(defaultVal = null) {
		return await this.serviceConfig.getValue('BackendURL', defaultVal);
	}
	async getBackendMethod() {
		return await this.serviceConfig.getValue('HTTPMethod', 'POST');
	}
	async getAPIToken() {
		return await this.serviceConfig.getValue('BackendAPIToken');
	}
	async getEngine() {
		return await this.serviceConfig.getValue('BackendEngine');
	}

	async start(path) {
		if (!this.#dialog) {
			this.#dialog = new TranslationDialog(this);
		}
		if (await this.#dialog.showModal(path)) {
			await this.#apply(path, this.#dialog.value);
		}
	}
	async #apply(path, values) {
		const tranlation = values[FIELD_TRANSLATION];
		if (tranlation) {
			const lang = values[FILED_TARGET_LANG];
			const sub = this.#editor.editor.getEditor(path);
			if (lang == (this.#editor._apiSvc.language || this.#editor.grain.culture)) {
				sub.setValue(tranlation);
			} else {
				await Task.nowAsync(t`Applying translation`, async (done, error) => {
					if ('label' == sub.key) {
						await this.#editor._apiSvc.storeGrain({
							id: this.#editor.grain.id,
							revision: this.#editor.grain.revision,
							culture: lang,
							label: tranlation
						}, true, true);
					} else {
						let propDefId = sub.key;
						let traitInd = 0;
						let origVals = {};
						const isArray = sub.parent && 'array' == sub.parent.schema.type;
						if (isArray) {
							propDefId = sub.parent.key;
							traitInd = Number(sub.key);
							origVals = (await this.#editor._apiSvc.getTraitValues({
								id: this.#editor.grain.id,
								revision: this.#editor.grain.revision,
								culture: lang
							}, propDefId, lang)).reduce((accu, item) => {
								accu[item.ord] = item.value;
								return accu;
							}, origVals);

							const editorVals = sub.parent.getValue();
							for (let i = 0; i < editorVals.length; i++) {
								if (i != traitInd && !(i in origVals)) {
									origVals[i] = editorVals[i];
								}
							}
						}
						origVals[traitInd] = tranlation;

						const propDef = this.#editor._getCustomProperty(propDefId);
						await this.#editor._apiSvc.storeTraitValues({
							id: this.#editor.grain.id,
							revision: this.#editor.grain.revision,
							culture: lang
						}, propDef, Object.keys(origVals).sort().map(k => origVals[k]), lang);
					}
					done();
				}, Task.Flag.DEFAULT | Task.Flag.REPORT_START | Task.Flag.REPORT_STATUS);
			}
		}
	}
}