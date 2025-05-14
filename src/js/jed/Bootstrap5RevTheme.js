import { JSONEditor } from "@json-editor/json-editor";

export class Bootstrap5RevTheme extends JSONEditor.defaults.themes.bootstrap5 {
	getButtonHolder() {
		const result = super.getButtonHolder();
		result.classList.replace('btn-group', 'btn-group-rev');
		return result;
	}

	getHeaderButtonHolder() {
		return super.getButtonHolder();
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