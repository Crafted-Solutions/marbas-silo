import { t } from "ttag";
import { InputDialog } from "./InputDialog";
import { MarBasDefaults, MarBasTraitValueType } from "@crafted.solutions/marbas-core";

class PickerConfig {
	setRoot = true;

	constructor(params) {
		if ('false' == params.setRoot) {
			this.setRoot = false;
		}
	}

	tweakTargetSchema(propDef, schema) {
		if (!propDef.valueConstraintId) {
			return;
		}
		const options = { root: propDef.valueConstraintId };
		this._setSchemaPickerOptions(schema, options);
		if (schema.items) {
			this._setSchemaPickerOptions(schema.items, options);
		}
	}

	_setSchemaPickerOptions(schemaItem, pickerOptions) {
		if (!schemaItem.options) {
			schemaItem.options = {};
		}
		if (!schemaItem.options.containerAttributes) {
			schemaItem.options.containerAttributes = {};
		}
		schemaItem.options.containerAttributes['data-pickeropts'] = JSON.stringify(pickerOptions);
		return schemaItem.options.containerAttributes['data-pickeropts'];
	}

	toString() {
		let result = `use=${this.use}`;
		if (!this.setRoot) {
			result += "&setRoot=false";
		}
		return result;
	}

	get isValid() {
		return true;
	}

	get requiredValueTypes() {
		return [MarBasTraitValueType.Grain, MarBasTraitValueType.File];
	}

	get use() {
		return this.constructor.name;
	}

	static get title() {
		return t`Configure grain picker`;
	}
}

class PickerConfigByPath extends PickerConfig {
	root;

	constructor(params) {
		super(params);
		this.root = params.root;
	}

	tweakTargetSchema(propDef, schema) {
		if (!this.root) {
			return;
		}
		const options = { root: this.root };
		if (propDef.valueConstraintId) {
			options.typeFilter = [propDef.valueConstraintId, MarBasDefaults.ID_TYPE_CONTAINER, MarBasDefaults.ID_TYPE_LINK];
			options.selectionFilter = [propDef.valueConstraintId];
		}
		this._setSchemaPickerOptions(schema, options);
		if (schema.items) {
			this._setSchemaPickerOptions(schema.items, options);
		}
	}

	toString() {
		return `${super.toString()}&root=${encodeURIComponent(this.root)}`;
	}

	get isValid() {
		return !!this.root && super.isValid;
	}

	async configure(apiSvc) {
		const prevVal = this.root;
		this.root = await InputDialog.requestTextFromUser({
			title: t`Grain Picker Root Folder`,
			prompt: t`Path relative to grain instance`,
			defaultValue: this.root
		});
		return this.root != prevVal;
	}

	static get title() {
		return t`Configure grain picker by relative path`;
	}
}

export const GrainPropConstraints = {
	createHandler: function createHandler(paramString) {
		if (paramString) {
			const params = Object.fromEntries(new URLSearchParams(paramString));
			if (params.use && params.use in GrainPropConstraints.handlers) {
				return new GrainPropConstraints.handlers[params.use](params);
			}
		}
		return null;
	},
	handlers: {
		PickerConfig: PickerConfig,
		PickerConfigByPath: PickerConfigByPath
	}
};
