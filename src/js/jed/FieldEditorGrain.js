import { t } from "ttag";
import { JSONEditor } from "@json-editor/json-editor";
import { GrainXAttrs } from "../cmn/GrainXAttrs";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { GrainEditor } from "../GrainEditor";
import clipboardCopy from "clipboard-copy";
import { IconMaps } from "../../conf/icons.conf";

export class FieldEditorGrain extends JSONEditor.defaults.editors.string {
	build() {
		if (!this.jsoneditor._grainEditor) {
			throw new Error("This editor is only usable as part of GrainEditor");
		}
		if (!this.options.iconClass) {
			this.options.iconClass = 'input-group-text';
		}
		if (!this.options.defaultIcon) {
			this.options.defaultIcon = 'bi-question-diamond';
		}
		this._lblEmpty = t`Empty`;
		this._lblType = t`Type`;

		if (!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle(), this.isRequired());
		if (this.schema.description) this.description = this.theme.getFormInputDescription(this.translateProperty(this.schema.description));
		if (this.options.infoText) this.infoButton = this.theme.getInfoButton(this.translateProperty(this.options.infoText));

		this.format = this.schema.format;
		if (this.options.format) {
			this.format = this.options.format;
		}
		this.input_type = 'text';
		this.input = this.theme.getFormInputField(this.input_type);
		this.input.style.display = 'none';
		this.inputMod = this.theme.getFormInputField(this.input_type);

		// this.input.setAttribute('maxlength', 36);
		// this.input.setAttribute('pattern', this.schema.pattern);

		if (this.options.compact) {
			this.container.classList.add('compact');
		} else if (this.options.input_width) this.inputMod.style.width = this.options.input_width;

		if (this.jsoneditor.options.use_name_attributes) {
			this.inputMod.setAttribute('name', this.formname);
		}
		this.inputMod.setAttribute('data-schemaformat', this.format);
		this.inputMod.setAttribute('readonly', 'readonly');

		const buttons = [
			this.#createFieldAction('GoToGrain', t`Go To Grain`, 'bi-box-arrow-right'),
			this.#createFieldAction('PickGrain', t`Select`, 'bi-three-dots')
		];
		if (!this.isRequired() && 'array' != this.parent.schema.type) {
			buttons.push(this.#createFieldAction('DeleteGrain', t`Delete`, 'bi-x'));
		}
		buttons.push(...this.#createMenuActions());
		const group = this.theme.getInputGroup(this.inputMod, buttons);
		this.icon = document.createElement('span');
		this.icon.className = `${this.options.iconClass} ${this.options.defaultIcon}`;
		this.icon.title = this._lblEmpty;
		group.insertBefore(this.icon, this.inputMod);

		if (this.schema.readOnly || this.schema.readonly || this.schema.template) {
			this.disable(true);
		}

		// this.inputMod.addEventListener('click', this.onPickGrain.bind(this));

		if (this.label) {
			this.label.setAttribute('for', this.formname);
		}
		this.inputMod.setAttribute('id', this.formname);
		this.control = this.theme.getFormControl(this.label, group, this.description, this.infoButton, this.formname);
		// this.control.appendChild(this.input);
		this.container.appendChild(this.control);

		window.requestAnimationFrame(() => {
			if (this.inputMod.parentNode) {
				this.#execWithSuperInput(this.afterInputReady.bind(this));
			}
		});
	}

	setValue(value, initial, fromTemplate) {
		const result = super.setValue(value, initial, fromTemplate);
		if (result && result.changed) {
			this.is_dirty = true;
			this.inputMod.value = result.value;
			this.inputMod.title = '';
			this.icon.title = this._lblEmpty;
			this.icon.className = `${this.options.iconClass} ${this.options.defaultIcon}`;
			if (this.link_holder) {
				this.link_holder.replaceChildren();
			}
			this.#updateGrain(result.value);
			this.#updateValueActions();
		}
		return result;
	}

	enable() {
		if (!this.always_disabled) {
			this.inputMod.disabled = false;
			this.btnPickGrain.disabled = false;
			super.enable();
			this.#updateValueActions();
		}
	}

	disable(alwaysDisabled) {
		this.inputMod.disabled = true;
		this.btnPickGrain.disabled = true;
		if (alwaysDisabled) {
			this.btnPickGrain.remove();
		}
		super.disable(alwaysDisabled);
		this.#updateValueActions();
	}

	showValidationErrors(errors) {
		this.#execWithSuperInput(super.showValidationErrors.bind(this, errors));
	}

	onPickGrain() {
		this.jsoneditor._grainEditor._showGrainPicker((picker) => {
			if (picker.accepted) {
				this.setValue(picker.selectedGrain);
			}
		}, GrainEditor.getGrainPickerOptions('array' == this.parent.schema.type ? this.parent.container : this.container));
	}

	onDeleteGrain() {
		this.setValue("");
	}

	onGoToGrain() {
		const evt = new CustomEvent('mb-silo:navigate', { detail: this.getValue() });
		document.dispatchEvent(evt);
	}

	#execWithSuperInput(func) {
		const inputTmp = this.input;
		this.input = this.inputMod;
		func();
		this.input = inputTmp;
	}

	#updateValueActions() {
		const isValid = FieldEditorGrain.isValidId(this.value);
		this.btnGoToGrain.disabled = !isValid;
		this.mnuActions.disabled = !isValid;
		if (this.btnDeleteGrain) {
			this.btnDeleteGrain.disabled = this.disabled || this.isRequired() || !isValid;
		}
	}

	#createFieldAction(name, title, icon) {
		const icoHolder = document.createElement('span');
		icoHolder.className = icon;
		const result = this[`btn${name}`] = this.theme.getButton('', icoHolder, title || name);
		const handler = this[`on${name}`];
		if ('function' == typeof (handler)) {
			result.addEventListener('click', handler.bind(this));
		}
		result.id = `action${name}`;
		return result;
	}

	#createMenuActions() {
		const result = this.mnuActions = this.theme.getButton('', undefined, t`Other Options`);
		result.className = 'btn btn-outline-secondary dropdown-toggle';
		result.setAttribute('data-bs-toggle', 'dropdown');
		result.setAttribute('aria-expanded', 'false');

		const list = document.createElement('ul');
		list.className = 'dropdown-menu dropdown-menu-end';

		let li = document.createElement('li');
		const addActionBtn = (label, action) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'dropdown-item';
			btn.textContent = label;
			btn.addEventListener('click', action);
			li.appendChild(btn);
			list.appendChild(li);
			return btn;
		};
		addActionBtn(t`Copy ID`, () => {
			if (this.grain) {
				clipboardCopy(this.grain.id);
			}
		});
		addActionBtn(t`Copy Path`, () => {
			if (this.grain) {
				clipboardCopy(this.grain.path);
			}
		});
		addActionBtn(t`Copy URL`, () => {
			if (this.grain) {
				clipboardCopy(`${document.baseURI}?grain=${this.grain.id}`);
			}
		});

		return [result, list];
	}

	async #updateGrain(id) {
		if (!FieldEditorGrain.isValidId(id)) {
			delete this.grain;
			if (MarBasDefaults.ID_TYPE_TYPEDEF == id) {
				this.icon.className = `input-group-text ${IconMaps.ByType[id]}`;
				this.icon.title = this._lblType;
				this.inputMod.value = t`<Self>`;
			}
			return;
		}
		if (!this.grain || this.grain.id != id) {
			this.grain = await this.jsoneditor._grainEditor._apiSvc.getGrain(id);
		}
		const isInital = !this.grain;
		if (this.grain) {
			this.inputMod.value = this.grain.label || this.grain.name;
			this.inputMod.title = this.grain.path;
			this.icon.className = `input-group-text ${GrainXAttrs.getGrainIcon(this.grain)}`;
			this.icon.title = this.grain.typeName || this._lblType;

			if (await this.jsoneditor._grainEditor._apiSvc.isGrainInstanceOf(this.grain, MarBasDefaults.ID_TYPE_FILE)) {
				const link = this.getLink({
					href: `#`,
					rel: t`Open (new window)`,
					'class': 'mb-grain-file',
					download: true
				});
				link.href = `${this.jsoneditor._grainEditor._apiSvc.baseUrl}/File/${this.grain.id}/Inline`;
				this.addLink(link);
				if (!isInital) {
					this.jsoneditor._grainEditor._checkEmbeddedMedia(this);
				}
			}
		}
	}

	static isValidId(id) {
		return !!id && MarBasDefaults.ID_TYPE_TYPEDEF != id;
	}

	static install() {
		JSONEditor.defaults.editors.traitGrain = FieldEditorGrain;
		JSONEditor.defaults.resolvers.unshift(function (schema) {
			if (schema.type === 'string' && schema.format === 'grain') {
				return 'traitGrain';
			}
		});
	}
}