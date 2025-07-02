import { MarBasRoleEntitlement } from "@crafted.solutions/marbas-core";
import { MbDomUtils } from "./cmn/MbDomUtils";
import { MarBasDefaults } from "../../packages/core/src/conf/marbas.conf";
import { InputDialog } from "./cmn/InputDialog";
import { MsgBox } from "./cmn/MsgBox";
import { StorageUtils } from "./cmn/StorageUtils";

export class LangManager {
	#element;
	#selector;
	#apiSvc;
	#changeCb;
	#listeners = [];
	constructor(scope, apiSvc) {
		this.#element = document.getElementById(scope);
		this.#selector = this.#element.querySelector(`#${scope}-sel`);
		this.#apiSvc = apiSvc;
		this.#changeCb = () => {
			this.onChange();
		};
		this.#selector.addEventListener('change', this.#changeCb);
		this.#element.querySelector('#cmdAddLang').addEventListener('click', async () => {
			await this.#create();
		});
		this.#element.querySelector('#cmdDeleteLang').addEventListener('click', async () => {
			await this.#deleteSelected();
		});
	}

	async reload() {
		const langList = await this.#apiSvc.listLanguages();
		this.#selector.removeEventListener('change', this.#changeCb);
		this.#listeners.forEach(listener => this.#selector.removeEventListener('change', listener));
		this.#clearList();
		let hasSelection = false;
		langList.forEach(element => {
			hasSelection = this.#addToList(element)._selected || hasSelection;
		});
		if (!hasSelection) {
			LangManager.#activeLang = null;
		}
		this.#selector.addEventListener('change', this.#changeCb);
		this.#listeners.forEach(listener => this.#selector.addEventListener('change', listener));

		const canManage = await this.#apiSvc.getCurrentRoleEntitlement(MarBasRoleEntitlement.ModifySystemSettings);
		MbDomUtils.hideNode(this.#element.querySelector(`#${this.#element.id}-commands`), !canManage);
		this.#element.querySelector('#cmdDeleteLang').disabled = LangManager.isDefaultLang(LangManager.activeLang);
	}

	static get activeLang() {
		return StorageUtils.read('mbSiloLang');
	}

	static set #activeLang(value) {
		StorageUtils.write('mbSiloLang', value);
	}

	static isDefaultLang(lang) {
		return !lang || lang == MarBasDefaults.LANG;
	}

	addChangeListener(listener) {
		this.#listeners.push(listener);
		this.#selector.addEventListener('change', listener);
	}

	onChange() {
		LangManager.#activeLang = this.#selector.value;
		this.#element.querySelector('#cmdDeleteLang').disabled = LangManager.isDefaultLang(LangManager.activeLang);
	}

	async #create() {
		const isoCode = await InputDialog.requestTextFromUser({
			title: 'Create Language',
			prompt: 'ISO 639 Code',
			defaultValue: ''
		});
		if (isoCode) {
			let option = Array.prototype.find.call(this.#selector.options, elm => elm.value == isoCode);
			if (option) {
				MsgBox.invoke(`Language '${isoCode}' - ${option.textContent} exists already`);
				return;
			}
			const res = await this.#apiSvc.createLanguage(isoCode);
			if (res) {
				option = this.#addToList(res);
				if (!option.selected) {
					this.#select(option);
				}
			}
		}
	}

	async #deleteSelected() {
		if (LangManager.isDefaultLang(LangManager.activeLang)
			|| 'yes' != await MsgBox.invoke(`Deleting language '${LangManager.activeLang}' would also delete all data associated with it. Are you sure?`, {
				icon: 'primary',
				buttons: { 'yes': true, 'no': true }
			})) {
			return;
		}
		if (await this.#apiSvc.deleteLanguage(LangManager.activeLang)) {
			this.#removeFromList(LangManager.activeLang);
			this.#select(this.#selector.options[0]);
		}
	}

	#select(option) {
		option.selected = true;
		this.#selector.dispatchEvent(new InputEvent("change"));
	}

	#clearList() {
		for (let i = this.#selector.options.length - 1; 0 <= i; i--) {
			this.#selector.remove(i);
		}
	}

	#removeFromList(lang) {
		for (let i = this.#selector.options.length - 1; 0 <= i; i--) {
			if (this.#selector.options[i].value == lang) {
				this.#selector.remove(i);
				break;
			}
		}
	}

	#addToList(lang) {
		const result = document.createElement('option');
		result.value = lang.isoCode;
		result.textContent = lang.labelNative || lang.label || lang.isoCode;
		result._selected = (lang.isoCode == LangManager.activeLang);
		result.selected = result._selected;
		this.#selector.add(result);
		return result;
	}
}