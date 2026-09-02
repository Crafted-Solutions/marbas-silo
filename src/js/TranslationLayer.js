import { CustomConfig } from "./cmn/CustomConfig";

const CONFKEY_MODULE = `${CustomConfig.DEFAULT_NAME}/TranslationModule`;

export class TranslationLayer {
	#editor;
	#config;
	#attached = {};
	constructor(editor) {
		this.#editor = editor;
		this.#config = CustomConfig.get(CustomConfig.DEFAULT_NAME);
	}
	attach(schemaPath) {
		this.#attached[schemaPath] = true;
	}
	detach(schemaPath) {
		delete this.#attached[schemaPath];
	}
	detachAll() {
		this.#attached = {};
	}
	async renderControls() {
		if (!(await this.isEnabled())) {
			return;
		}
		for (const path in this.#attached) {
			const sub = this.#editor.editor.getEditor(path);
			if (sub) {
				if ('array' == sub.schema.type) {
					if (sub.rows) {
						for (const row of sub.rows) {
							this.#createButton(row.array_controls, row.array_controls.firstChild, row);
						}
					}
				} else {
					this.#createButton(sub.label.parentElement, sub.label, sub);
				}
			} else {
				console.warn(`TranslationModule: editor ${path} not found`);
			}
		}
	}
	async isEnabled() {
		return (await (await this.#config).getValue(CONFKEY_MODULE)) && (await this.#editor._apiSvc.listLanguages()).length;
	}
	async getConfig() {
		return await this.#config;
	}

	#createButton(container, refChild, editor) {
		const btn = document.createElement('button');
		btn.type = "button";
		btn.className = 'btn btn-sm btn-outline-secondary btn-translate bi bi-translate';
		if (!editor.parent || 'array' != editor.parent.schema.type) {
			btn.classList.add("me-2", "mb-1");
		}
		btn.title = `Translate Field`;
		// btn.textContent = "Tr";
		btn.onclick = this.#translateField.bind(this, editor.path);
		container.insertBefore(btn, refChild);
	}
	async #translateField(path) {
		(await this.#loadModule()).start(path);
	}
	async #loadModule() {
		if (!this._module) {
			this._module = new Promise((resolve, reject) => {
				import(/* webpackChunkName: "tool-translator" */ './TranslationModule.js').then((mod) => {
					this.#config.then(config => {
						config.getValue(CONFKEY_MODULE).then(id => {
							this.#editor._apiSvc.getGrain(id).then(grain => {
								resolve(new mod.TranslationModule(new CustomConfig(grain, this.#editor._apiSvc), this.#editor));
							}).catch(reject);
						}).catch(reject);
					}).catch(reject);
				}).catch(reject);
			});
		}
		return await this._module;
	}
}