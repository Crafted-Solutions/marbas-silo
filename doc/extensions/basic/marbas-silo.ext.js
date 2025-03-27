// loaded before GrainEditor is defined and constructed
export const GrainEditorStatic = {
	install: function install(ctx) {
		if (!ctx.JSONEditor.defaults.editors.theAnswer) {
			// extend basic JSON schema with extra field in custom format
			ctx.EditorSchemaConfig.BASIC.properties.meta.title = "Metadata Extended";
			ctx.EditorSchemaConfig.BASIC.definitions.meta.properties.theQuestion = {
				title: 'The answer to life, the universe and everything',
				required: true,
				type: 'integer',
				format: 'theAnswer'
			};
			(() => {
				// define custom JSON editor class
				// details s. also https://github.com/json-editor/json-editor/blob/bb387ecf4ed50c36b051595a982135b05ecb02b6/docs/custom-editor.html
				class TheAnswerEditor extends ctx.JSONEditor.AbstractEditor {
					build() {
						super.build();
						this.control = document.createElement('div');
						this.control.style.color = "red";
						this.control.textContent = "42";

						this.label = document.createElement('label');
						this.label.textContent = this.getTitle();

						this.container.appendChild(this.label);
						this.container.appendChild(this.control);
					}
				}

				// add class to editors list
				ctx.JSONEditor.defaults.editors.theAnswer = TheAnswerEditor;
				// add resolver
				ctx.JSONEditor.defaults.resolvers.unshift(function (schema) {
					if (schema.type === 'integer' && schema.format === 'theAnswer') {
						return 'theAnswer';
					}
				})
			})();
		}
	}
}

// loaded after GrainEditor becomes available
export const GrainEditor = {
	install: function install(ctx) {
		if (!ctx.GrainEditor.prototype._createBaseActions) {
			// store reference to base function
			ctx.GrainEditor.prototype._createBaseActions = ctx.GrainEditor.prototype._createActions;
			// override GrainEditor function
			ctx.GrainEditor.prototype._createActions = async function _createActions() {
				const btnHolder = await ctx.GrainEditor.prototype._createBaseActions.apply(ctx.instance, arguments);
				if (btnHolder) {

					let btn = ctx.instance.editor.root.getButton('What is flying?');
					btn.classList.add('btn-outline-primary');
					btn.classList.remove('btn-secondary', 'btn-sm');
					btn.addEventListener('click', () => {
						alert("The same thing as falling, the trick is missing the ground");
					});
					btnHolder.appendChild(btn);
				}
				return btnHolder;
			};
		}
	}
};