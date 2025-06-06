import { JSONEditor } from "@json-editor/json-editor";
import { BsIconPicker } from "../BsIconPicker";
import { GrainXAttrs } from "../cmn/GrainXAttrs";

export class FieldEditorIcon extends JSONEditor.defaults.editors.string {
	build() {
		if (!this.jsoneditor._grainEditor) {
			throw new Error("This editor is only usable as part of GrainEditor");
		}
		if (!this.options.iconClass) {
			this.options.iconClass = 'input-group-text mb-jf-icon';
		}
		if (!this.options.defaultIcon) {
			this.options.defaultIcon = 'bi-question-diamond';
		}

		if (!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle(), this.isRequired());
		if (this.schema.description) this.description = this.theme.getFormInputDescription(this.translateProperty(this.schema.description));
		if (this.options.infoText) this.infoButton = this.theme.getInfoButton(this.translateProperty(this.options.infoText));

		this.format = this.schema.format;
		if (this.options.format) {
			this.format = this.options.format;
		}
		this.input = this.theme.getFormInputField(this.input_type);
		this.input.classList.add('rounded-end');

		if (this.options.compact) {
			this.container.classList.add('compact');
		} else if (this.options.input_width) this.input.style.width = this.options.input_width;

		if (this.schema.readOnly || this.schema.readonly || this.schema.template) {
			this.disable(true);
			this.input.setAttribute('readonly', 'true');
		}

		this.input.addEventListener('change', e => {
			e.preventDefault();
			e.stopPropagation();

			const val = e.currentTarget.value;

			/* sanitize value */
			const sanitized = this.sanitize(val);
			if (val !== sanitized) {
				e.currentTarget.value = sanitized;
			}

			this.is_dirty = true;

			this.refreshValue();
			if (this.iconPicker) {
				this.iconPicker.displayIcon();
			}
			this.onChange(true);
		});
		this.#subclassInput();

		if (this.jsoneditor.options.use_name_attributes) {
			this.input.setAttribute('name', this.formname);
		}
		this.input.setAttribute('data-schemaformat', this.format);
		// this.input.setAttribute('readonly', 'readonly');

		const group = this.theme.getInputGroup(this.input, []);
		this.icon = document.createElement('span');
		this.icon.className = this.options.iconClass;
		group.insertBefore(this.icon, this.input);

		if (this.label) {
			this.label.setAttribute('for', this.formname);
		}
		this.input.setAttribute('id', this.formname);
		this.control = this.theme.getFormControl(this.label, group, this.description, this.infoButton, this.formname);
		this.container.appendChild(this.control);

		window.requestAnimationFrame(() => {
			if (this.input.parentNode) {
				this.afterInputReady();
			}
		});
	}

	afterInputReady() {
		super.afterInputReady();
		this.iconPicker = new BsIconPicker(this.input, this.icon, undefined,
			GrainXAttrs.getGrainIcon(this.jsoneditor._grainEditor.grain) || this.options.defaultIcon);
	}

	destroy() {
		if (this.iconPicker) {
			this.iconPicker.destroy();
		}
		super.destroy();
	}

	#subclassInput() {
		const { get, set } = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
		Object.defineProperty(this.input, 'value', {
			get() {
				return get.call(this);
			},
			set(newVal) {
				const disp = newVal != this.value;
				const result = set.call(this, newVal);
				if (disp) {
					this.dispatchEvent(new Event('change', { bubbles: true }));
				}
				return result;
			}
		});
	}

	static install() {
		JSONEditor.defaults.editors.grainIcon = FieldEditorIcon;
		JSONEditor.defaults.resolvers.unshift(function (schema) {
			if (schema.type === 'string' && schema.format === 'icon') {
				return 'grainIcon';
			}
		});
	}

}

import(/* webpackChunkName: "bi-conf" */'bootstrap-icons/font/bootstrap-icons.json').then(iconConfig => {
	BsIconPicker.getDrowpdown({ bi: iconConfig });
});