import { JSONEditor } from "@json-editor/json-editor";

export class Bootstrap5RevTheme extends JSONEditor.defaults.themes.bootstrap5 {
	constructor(jsoneditor, options = { disable_theme_rules: false }) {
		super(jsoneditor, options);
		this.options.tooltip = '';
	}
	getButtonHolder() {
		const result = super.getButtonHolder();
		result.classList.replace('btn-group', 'btn-group-rev');
		return result;
	}

	getHeaderButtonHolder() {
		return super.getButtonHolder();
	}

	getHeader(text, pathDepth) {
		const result = document.createElement('span');
		result.classList.add('h4');
		result.classList.add('card-title');
		result.classList.add(`level-${pathDepth}`);

		if (typeof text === 'string') {
			result.textContent = text;
		} else {
			result.appendChild(text);
		}
		result.style.display = 'inline-block'
		return result;
	}

	getFormButtonHolder() {
		const result = super.getFormButtonHolder();
		result.classList.replace('btn-group-rev', 'btn-group');
		return result;
	}

	static install() {
		JSONEditor.defaults.themes.bootstrap5rev = Bootstrap5RevTheme;
	}
}