
import { JSONEditor } from "@json-editor/json-editor";
import { t } from "ttag";

import { GrainPropConstraints } from "../cmn/GrainPropConstraints";
import { MbUtils } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "../cmn/GrainXAttrs";

export class FieldEditorPropConstraints extends JSONEditor.AbstractEditor {
	build() {
		if (!this.#grainEditor) {
			throw new Error("This editor is only usable as part of GrainEditor");
		}

		this.hasPlaceholderOption = this.schema?.options?.has_placeholder_option || false;
		this.placeholderOptionText = this.schema?.options?.placeholder_option_text || ' ';

		if (!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle(), this.isRequired());
		if (this.schema.description) this.description = this.theme.getFormInputDescription(this.translateProperty(this.schema.description));
		if (this.options.infoText) this.infoButton = this.theme.getInfoButton(this.translateProperty(this.options.infoText));
		if (this.options.compact) this.container.classList.add('compact');

		const handlers = Object.keys(GrainPropConstraints.handlers);
		this.enum_options = ['', ...handlers];
		this.enum_display = [t`None`, ...handlers.map((k) => GrainPropConstraints.handlers[k].title)];

		this.input = this.theme.getSelectInput(this.enum_options, false);
		this.theme.setSelectOptions(this.input, this.enum_options, this.enum_display, this.hasPlaceholderOption, this.placeholderOptionText);

		if (this.schema.readOnly || this.schema.readonly) {
			this.disable(true);
			this.input.disabled = true;
		}

		this.input.addEventListener('change', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.onInputChange();
		})

		const group = this.theme.getInputGroup(this.input, [this.#createFieldAction('ConfigureHandler', t`Configure`, 'bi-gear')]);

		this.control = this.theme.getFormControl(this.label, group, this.description, this.infoButton, this.formname);
		this.container.appendChild(this.control);

		//this.value = this.enum_options[0];

		/* Any special formatting that needs to happen after the input is added to the dom */
		window.requestAnimationFrame(() => {
			if (this.input.parentNode) this.afterInputReady();
		})
	}

	afterInputReady() {
		this.theme.afterInputReady(this.input);
	}

	async onConfigureHandler() {
		let changed = false;
		if (this.#hasConfiguration) {
			changed = await this.handler.configure(this.#grainEditor._apiSvc);
		}
		if (changed) {
			this.is_dirty = true;
			this.onChange(true);
		}
	}

	async onInputChange() {
		/* If valid hasn't changed */
		if (this.input.value == this.value) return;

		this.is_dirty = true;

		/* Store new value and propogate change event */
		this.value = this.input.value;
		this.handler = this.value ? GrainPropConstraints.createHandler(`use=${this.value}`) : null;

		const hasConfig = this.#hasConfiguration;
		this.btnConfigureHandler.disabled = !hasConfig;
		if (hasConfig && !this.handler.isReady) {
			await this.handler.configure(this.#grainEditor._apiSvc);
		}

		this.onChange(true);
	}

	setValue(value, initial) {
		if (initial && this.handler) {
			return;
		}
		let propMod;
		if (initial) {
			// propMod XAttr compatibility, please delete after all Grains are migrated
			propMod = GrainXAttrs.getAttr(this.#grainEditor.grain, 'propMod');
			if (propMod) {
				GrainXAttrs.setAttr(this.#grainEditor.grain, 'propMod');
			}
		}
		this.handler = GrainPropConstraints.createHandler(value, propMod);
		this.value = this.input.value = this.handler ? this.handler.use : '';

		this.btnConfigureHandler.disabled = !this.#hasConfiguration;

		if (!initial) {
			this.is_dirty = true;
		}

		this.onChange(true);
	}

	getValue() {
		if (!this.dependenciesFulfilled) {
			return '';
		}
		return this.handler ? this.handler.toString() : '';
	}

	enable() {
		if (!this.always_disabled) {
			this.input.disabled = false;
			super.enable();
		}
	}

	disable(alwaysDisabled) {
		if (alwaysDisabled) this.always_disabled = true;
		this.input.disabled = true;
		super.disable(alwaysDisabled);
	}

	destroy() {
		if (this.label && this.label.parentNode) this.label.parentNode.removeChild(this.label);
		if (this.description && this.description.parentNode) this.description.parentNode.removeChild(this.description);
		if (this.input && this.input.parentNode) this.input.parentNode.removeChild(this.input);

		super.destroy();
	}

	register() {
		this.jsoneditor.validator.options.custom_validators = MbUtils.pushOrCreate(this.jsoneditor.validator.options.custom_validators, (schema, value, path) => {
			const result = [];
			if (path == this.path) {
				if (value && !this.handler) {
					result.push({ path: this.path, property: 'value', message: t`Unknown constraint handler ${this.value}` });
				} else if (this.handler) {
					if (!this.handler.isReady) {
						result.push({ path: this.path, property: 'format', message: t`Handler ${this.handler.use} requires configuration` });
					} else {
						const valTypes = this.handler.requiredValueTypes;
						if (valTypes && !valTypes.includes(this.parent.editors.valueType.getValue())) {
							result.push({ path: this.path, property: 'format', message: t`Handler ${this.handler.use} requires value type ${valTypes}` });
						}
					}
				}
			}
			return result;
		});
		super.register();
		if (!this.input) return;
		if (this.jsoneditor.options.use_name_attributes) {
			this.input.setAttribute('name', this.formname);
		}
	}

	unregister() {
		super.unregister();
		if (!this.input) return;
		this.input.removeAttribute('name');
		this.input.removeAttribute('aria-label')
	}

	showValidationErrors(errors) {
		const showErrors = this.jsoneditor.options.show_errors;
		const changeOrInteraction = showErrors === 'change' || showErrors === 'interaction';
		const never = showErrors === 'never';

		if ((never || changeOrInteraction) && !this.is_dirty) {
			return;
		}

		const addMessage = (messages, error) => {
			if (error.path === this.path) {
				messages.push(error.message);
			}
			return messages;
		}
		const messages = errors.reduce(addMessage, []);

		if (messages.length) {
			this.theme.addInputError(this.input, `${messages.join('. ')}.`);
		} else {
			this.theme.removeInputError(this.input);
		}
	}

	setOptInCheckbox() { }

	activate() { }

	deactivate() { }

	get #grainEditor() {
		return this.jsoneditor._grainEditor;
	}

	get #hasConfiguration() {
		return this.handler && 'function' == typeof this.handler.configure;
	}

	#createFieldAction(name, title, icon) {
		const icoHolder = document.createElement('span');
		icoHolder.className = icon;
		const result = this[`btn${name}`] = this.theme.getButton('', icoHolder, title || name);
		const handler = this[`on${name}`];
		if ('function' == typeof (handler)) {
			result.addEventListener('click', handler.bind(this));
		}
		result.id = `${this.path}_action${name}`;
		return result;
	}

	static install() {
		JSONEditor.defaults.editors.propConstraints = FieldEditorPropConstraints;
		JSONEditor.defaults.resolvers.unshift(function (schema) {
			if (schema.type === 'string' && schema.format === 'contstraints') {
				return 'propConstraints';
			}
		});
	}
}