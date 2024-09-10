export class LangSelector {
	#element;
	#apiSvc;
	#changeCb;
	#listeners = [];
	constructor(element, apiSvc) {
		this.#element = document.getElementById(element);
		this.#apiSvc = apiSvc;
		this.#changeCb = () => {
			this.onChange();
		};
		this.#element.addEventListener('change', this.#changeCb);
	}

	async populate() {
		const langList = await this.#apiSvc.listLanguages();
		this.#element.removeEventListener('change', this.#changeCb);
		this.#listeners.forEach(listener => this.#element.removeEventListener('change', listener));
		this.#clear();
		langList.forEach(element => {
			this.#add(element);
		});
		this.#element.addEventListener('change', this.#changeCb);
		this.#listeners.forEach(listener => this.#element.addEventListener('change', listener));
	}

	static get activeLang() {
		return sessionStorage.getItem('mbSiloLang');
	}

	addChangeListener(listener) {
		this.#listeners.push(listener);
		this.#element.addEventListener('change', listener);
	}

	onChange() {
		sessionStorage.setItem('mbSiloLang', this.#element.value);
	}

	#clear() {
		for (let i = this.#element.options.length - 1; 0 <= i; i--) {
			this.#element.remove(i);
		}
	}

	#add(lang) {
		const opt = document.createElement('option');
		opt.value = lang.isoCode;
		opt.textContent = lang.labelNative || lang.label || lang.isoCode;
		opt.selected = (lang.isoCode == LangSelector.activeLang);
		this.#element.add(opt);
	}
}