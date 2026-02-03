import { t } from "ttag";
import { InputDialog } from "./InputDialog";
import { MarBasDefaults, MarBasTraitValueType } from "@crafted.solutions/marbas-core";


class AbstractConstraintHandler {
	tweakTargetSchema(propDef, schema) { }

	toString() {
		return `use=${this.use}`;
	}

	get isReady() {
		return true;
	}

	get requiredValueTypes() {
		return [];
	}

	get use() {
		return this.constructor.name;
	}

	static get title() {
		return this.use;
	}
}

class PickerConfig extends AbstractConstraintHandler {
	setRoot = true;

	constructor(params) {
		super();
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
		let result = super.toString();
		if (!this.setRoot) {
			result += "&setRoot=false";
		}
		return result;
	}

	get requiredValueTypes() {
		return [MarBasTraitValueType.Grain, MarBasTraitValueType.File];
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

	get isReady() {
		return !!this.root && super.isReady;
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

class FormatRichText extends AbstractConstraintHandler {

	tweakTargetSchema(propDef, schema) {
		schema.format = 'jodit';
		console.log("tweakTargetSchema", schema);
	}

	get requiredValueTypes() {
		return [MarBasTraitValueType.Text, MarBasTraitValueType.Memo];
	}

	static get title() {
		return t`Format: rich text`;
	}
}

class FormatDateOnly extends AbstractConstraintHandler {

	tweakTargetSchema(propDef, schema) {
		schema.format = 'date';
	}

	get requiredValueTypes() {
		return [MarBasTraitValueType.DateTime];
	}

	static get title() {
		return t`Format: date only`;
	}
}

export const GrainPropConstraints = {
	createHandler: function createHandler(paramString, modXAttr) {
		if (!paramString && modXAttr) {
			console.warn(`xAttr '${modXAttr}' should be migrated to constraintParams`);
			// propMod XAttr compatibility, please delete after all Grains are migrated
			switch (modXAttr) {
				case 'rtf':
					paramString = 'use=FormatRichText'
					break;
				case 'dateonly':
					paramString = 'use=FormatDateOnly'
			}
		}
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
		PickerConfigByPath: PickerConfigByPath,
		FormatRichText: FormatRichText,
		FormatDateOnly: FormatDateOnly
	}
};
