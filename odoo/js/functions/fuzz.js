/* global py */
// Copyright 2020 Alexandre Díaz <dev@redneboa.es>
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

/*
    A first attempt for fuzzing in Odoo
*/

odoo.define("terminal.functions.Fuzz", function(require) {
    "use strict";

    const Terminal = require("terminal.Terminal");
    const ParameterGenerator = require("terminal.core.ParameterGenerator");
    const Class = require("web.Class");
    const rpc = require("web.rpc");
    const field_utils = require("web.field_utils");
    const utils = require("web.utils");

    const FieldValueGenerator = Class.extend({
        _minStr: 4,
        _maxStr: 40,
        _minNumber: 4,
        _maxNumber: 999999,

        init: function() {
            this._generators = {
                char: this._generateCharValue.bind(this),
                text: this._generateTextValue.bind(this),
                float: this._generateFloatValue.bind(this),
                integer: this._generateIntValue.bind(this),
                date: this._generateDateValue.bind(this),
                datetime: this._generateDatetimeValue.bind(this),
                selection: this._generateSelectionValue.bind(this),
                many2one: this._generateMany2OneValue.bind(this),
                one2many: this._generateOne2ManyValue.bind(this),
                many2many: this._generateMany2ManyValue.bind(this),
                boolean: this._generateBooleanValue.bind(this),
                monetary: this._generateFloatValue.bind(this),

                phone: this._generatePhoneValue.bind(this),
                email: this._generateEmailValue.bind(this),
                url: this._generateUrlValue.bind(this),
            };
            this._parameterGenerator = new ParameterGenerator();
        },

        process: function(field, omitted_values) {
            const hasWidgetGenerator = field.widget in this._generators;
            const callback = this._generators[
                hasWidgetGenerator ? field.widget : field.type
            ];
            if (callback) {
                return callback(field, omitted_values);
            }
            return false;
        },

        /* CORE TYPES */
        _generateCharValue: function() {
            return this._parameterGenerator.generateString(
                this._minStr,
                this._maxStr
            );
        },

        _generateTextValue: function() {
            return this._parameterGenerator.generateString(
                this._minStr,
                this._maxStr * 10
            );
        },

        _generateFloatValue: function() {
            return this._parameterGenerator.generateFloat(
                this._minNumber,
                this._maxNumber
            );
        },

        _generateIntValue: function() {
            return this._parameterGenerator.generateInt(
                this._minNumber,
                this._maxNumber
            );
        },

        _generateDateValue: function() {
            const cur_time = new Date().getTime();
            return field_utils.parse.date(
                this._parameterGenerator.generateDate(cur_time / 2, cur_time)
            );
        },

        _generateDatetimeValue: function() {
            const cur_time = new Date().getTime();
            return field_utils.parse.datetime(
                this._parameterGenerator.generateDate(cur_time / 2, cur_time)
            );
        },

        _generateSelectionValue: function(field) {
            return _.sample(field.values);
        },

        _generateOne2ManyValue: function(field) {
            const keys = Object.keys(field.values);
            if (!keys.length) {
                return false;
            }
            const record = {};
            for (const key of keys) {
                const extra_field = field.values[key];
                record[key] = this.process(extra_field);
            }
            return {
                operation: "CREATE",
                data: record,
            };
        },

        _generateMany2OneValue: function(field, omitted_values) {
            const value = _.sample(
                _.difference(field.values, omitted_values || [])
            );
            if (value) {
                return {operation: "ADD", id: value};
            }
            return false;
        },

        _generateMany2ManyValue: function(field) {
            const num = this._parameterGenerator.generateInt(
                0,
                field.values.length - 1
            );
            const ids = _.sample(field.values, num);
            if (ids.length) {
                return {
                    operation: "ADD_M2M",
                    ids: _.map(ids, id => Object({id: id})),
                };
            }
            return false;
        },

        _generateBooleanValue: function() {
            return Boolean(this._parameterGenerator.generateInt(0, 1));
        },

        /* WIDGETS */
        _generatePhoneValue: function() {
            return this._parameterGenerator
                .generateInt(100000000, 999999999)
                .toString();
        },

        _generateEmailValue: function() {
            return this._parameterGenerator.generateEmail(
                this._minStr,
                this._maxStr
            );
        },

        _generateUrlValue: function() {
            return this._parameterGenerator.generateUrl(
                this._minStr,
                this._maxStr
            );
        },
    });

    const FuzzDialogForm = Class.extend({
        init: function(term) {
            this._term = term;
            this._fieldValueGenerator = new FieldValueGenerator();
        },

        destroy: function() {
            this._fieldValueGenerator.destroy();
        },

        processFormFields: function(controller) {
            return new Promise(async resolve => {
                const controller_state = controller.widget.renderer.state;
                const fields = controller_state.fields;
                const fields_info =
                    controller_state.fieldsInfo[controller_state.viewType];
                const processed = {};
                const ignored = [];
                let fields_ignored = [];
                const fields_view = this._getArchFields(
                    controller.widget.renderer.arch
                );
                for (const field_view_def of fields_view) {
                    const field_name = field_view_def.attrs.name;
                    if (fields_ignored.indexOf(field_name) !== -1) {
                        this._term.screen.eprint(
                            ` [i] Aborting changes for '${field_name}': Already changed by an 'onchange'`
                        );
                        ignored.push(field_name);
                        continue;
                    }
                    const field_info = fields_info[field_name];
                    const field = fields[field_name];
                    const is_invisible = utils.toBoolElse(
                        field_info.modifiersValue?.invisible
                    );
                    const is_readonly = utils.toBoolElse(
                        field_info.modifiersValue?.readonly,
                        field.readonly
                    );
                    if (!is_invisible && !is_readonly) {
                        // Create more than one 'one2many' record
                        const num_records =
                            field.type === "one2many"
                                ? this._fieldValueGenerator._parameterGenerator.generateInt(
                                      7
                                  )
                                : 1;
                        this._O2MRequiredStore = {};
                        for (let i = 0; i < num_records; ++i) {
                            const [
                                field_def,
                                affected_fields,
                            ] = await this._fillField(
                                controller,
                                field,
                                field_info
                            );
                            processed[field_name] = field_def;
                            fields_ignored = _.union(
                                fields_ignored,
                                affected_fields
                            );
                        }
                    }
                }
                return resolve([processed, ignored]);
            });
        },

        _convertData2State: function(data) {
            const res = {};
            for (const key in data) {
                const value = data[key];
                if (typeof value === "object" && !moment.isMoment(value)) {
                    res[key] = value.data?.id;
                } else {
                    res[key] = value;
                }
            }
            return res;
        },

        _fillField: function(controller, field, field_info) {
            return new Promise(async resolve => {
                const local_data =
                    controller.widget.model.localData[controller.widget.handle];
                const domain = controller.widget.model._getDomain(local_data, {
                    fieldName: field_info.name,
                });
                const state_data = controller.widget.renderer.state.data;
                this._term.screen.eprint(
                    ` [o] Getting information of '${field_info.name}' field...`
                );

                let changes = {};
                let gen_field_def = {};
                // One2many fields need be handled in a special way
                if (field.type === "one2many") {
                    gen_field_def = await this._generateFieldDef(
                        field,
                        field_info,
                        domain
                    );
                    changes = await this._generateChangesFieldO2M(
                        field_info,
                        controller.widget
                    );
                } else {
                    gen_field_def = await this._generateFieldDef(
                        field,
                        field_info,
                        domain
                    );
                    changes[
                        field_info.name
                    ] = this._fieldValueGenerator.process(gen_field_def);
                }
                // Get the raw value to human printing
                let raw_value = changes[field_info.name];
                if (typeof raw_value === "object" && "operation" in raw_value) {
                    if (raw_value.operation === "ADD") {
                        raw_value = raw_value.id;
                    } else if (raw_value.operation === "ADD_M2M") {
                        raw_value = _.map(
                            raw_value.ids,
                            item => item.id
                        ).join();
                    } else if (raw_value.operation === "CREATE") {
                        raw_value = raw_value.data;
                    }
                }
                if (typeof raw_value === "object") {
                    this._term.screen.eprint(
                        " [o] Writing the new random value:"
                    );
                    this._term.screen.print(
                        this._term.screen._prettyObjectString(raw_value)
                    );
                } else {
                    this._term.screen.eprint(
                        ` [o] Writing the new random value: ${raw_value}`
                    );
                }
                try {
                    const record_id = controller.widget.handle;
                    const model = controller.widget.model;
                    await model.trigger_up("field_changed", {
                        dataPointID: record_id,
                        changes: changes,
                        onSuccess: datas => {
                            const fields_affected = _.reject(
                                this._processFieldChanges(
                                    field_info.name,
                                    datas,
                                    state_data
                                ),
                                item => item === field_info.name
                            );
                            this._term.screen.eprint(
                                ` [i] Random value for '${field_info.name}' written`
                            );
                            if (_.some(fields_affected)) {
                                this._term.screen.eprint(
                                    `  ** 'onchange' fields detected: ${fields_affected.join()}`
                                );
                            }
                            return resolve([gen_field_def, fields_affected]);
                        },
                    });
                } catch (err) {
                    this._term.screen.eprint(
                        ` [x] Can't write the value for '${field_info.name}': ${err}`
                    );
                }
            });
        },

        _getArchFields: function(arch) {
            let fields = [];
            for (const children of arch.children) {
                if (children.tag === "field") {
                    fields.push(children);
                } else if (_.some(children.children)) {
                    fields = _.union(fields, this._getArchFields(children));
                }
            }
            return fields;
        },

        _getChangesValues: function(changes) {
            const values = {};
            for (const field_name in changes) {
                const change = changes[field_name];
                if (typeof change === "object" && "operation" in change) {
                    if (change.operation === "ADD") {
                        values[field_name] = change.id;
                    } else if (change.operation === "ADD_M2M") {
                        values[field_name] = _.map(change.ids, item => item.id);
                    } else if (change.operation === "CREATE") {
                        values[field_name] = change.data;
                    }
                } else {
                    values[field_name] = change;
                }
            }
            return values;
        },

        _processO2MRequiredField: function(
            parent_field_name,
            field_name,
            field_view,
            changes
        ) {
            if (field_view.required) {
                const s_changes = this._getChangesValues(
                    changes[parent_field_name].data
                );
                if (!(parent_field_name in this._O2MRequiredStore)) {
                    this._O2MRequiredStore[parent_field_name] = {};
                }
                if (
                    !(field_name in this._O2MRequiredStore[parent_field_name])
                ) {
                    this._O2MRequiredStore[parent_field_name][field_name] = [];
                }
                this._O2MRequiredStore[parent_field_name][field_name].push(
                    s_changes[field_name]
                );
            }
        },

        _generateChangesFieldO2M: async function(field_info, widget) {
            return new Promise(async resolve => {
                const changes = {};
                changes[field_info.name] = {
                    operation: "CREATE",
                    data: {},
                };
                if (field_info.views) {
                    const o2m_fields = this._getArchFields(
                        field_info.views[field_info.mode]?.arch
                    );
                    for (const index in o2m_fields) {
                        const field = o2m_fields[index];
                        const field_view_name = field.attrs.name;
                        const field_view_def =
                            field_info.views[field_info.mode].fields[
                                field_view_name
                            ];
                        const field_view =
                            field_info.views[field_info.mode].fields[
                                field_view_name
                            ];
                        const field_info_view =
                            field_info.views[field_info.mode].fieldsInfo[
                                field_info.mode
                            ][field_view_name];
                        if (!field_info_view) {
                            continue;
                        }
                        const is_invisible = utils.toBoolElse(
                            field_info_view.modifiers?.invisible,
                            false
                        );
                        if (
                            field_view.type === "one2many" ||
                            is_invisible ||
                            field_view_def.readonly ||
                            field_view_name.startsWith("_") ||
                            field_view_name === "id"
                        ) {
                            continue;
                        }

                        const model_data = widget.model.get(widget.handle);
                        const state = this._convertData2State(model_data.data);
                        const proc_domain =
                            (field.attrs.domain &&
                                py.eval(
                                    field.attrs.domain,
                                    _.extend(
                                        {
                                            parent: state,
                                        },
                                        this._getChangesValues(
                                            changes[field_info.name].data
                                        )
                                    )
                                )) ||
                            [];
                        const gen_field_def = await this._generateFieldDef(
                            field_view,
                            field_info_view,
                            proc_domain
                        );
                        let omitted_values = null;
                        if (field_info.name in this._O2MRequiredStore) {
                            omitted_values = this._O2MRequiredStore[
                                field_info.name
                            ][field_view_name];
                        }
                        const data = this._fieldValueGenerator.process(
                            gen_field_def,
                            omitted_values
                        );
                        if (data) {
                            changes[field_info.name].data[
                                field_view_name
                            ] = data;
                            this._processO2MRequiredField(
                                field_info.name,
                                field_view_name,
                                field_view,
                                changes
                            );
                        } else {
                            changes[field_info.name].data = [];
                            break;
                        }
                    }
                }
                // Do not apply changes if doesn't exists changes to apply
                if (!Object.keys(changes[field_info.name].data).length) {
                    changes[field_info.name] = false;
                }
                return resolve(changes);
            });
        },

        _generateFieldDef: function(field, field_info = false, domain = []) {
            return new Promise(async resolve => {
                const gen_field_def = {
                    type: field.type,
                    relation: field.relation,
                    widget: "",
                    required: field.required,
                };
                if (field_info) {
                    gen_field_def.widget = field_info.widget;
                    gen_field_def.required =
                        field_info.modifiersValue?.required;
                }

                if (gen_field_def.relation) {
                    gen_field_def.values = await rpc.query({
                        model: gen_field_def.relation,
                        method: "search",
                        args: [domain],
                    });
                } else if (field.selection) {
                    gen_field_def.values = [];
                    for (const option of field.selection) {
                        gen_field_def.values.push(option[0]);
                    }
                }

                return resolve(gen_field_def);
            });
        },

        _processFieldChanges: function(field_name, datas, state_data) {
            const fields_changed = [];
            for (const data of datas) {
                if (data.name === field_name) {
                    for (const rf_name in data.recordData) {
                        if (
                            !_.isEqual(
                                data.recordData[rf_name],
                                state_data[rf_name]
                            )
                        ) {
                            fields_changed.push(rf_name);
                        }
                    }
                    break;
                }
            }
            return fields_changed;
        },
    });

    Terminal.include({
        init: function() {
            this._super.apply(this, arguments);

            this.registerCommand("fuzz", {
                definition: "Run a 'Fuzz Test'",
                callback: this._cmdFuzz,
                detail: "Runs a 'Fuzz Test' over the selected model and view",
                syntaxis: "<STRING: MODEL NAME> [STRING: VIEW REF]",
                args: "s?s",
            });
        },

        _cmdFuzz: function(model, view_ref = false) {
            return new Promise(async (resolve, reject) => {
                this.screen.eprint(`Opening selected ${model} form...`);
                const context = _.extend({}, this._getContext(), {
                    form_view_ref: view_ref,
                });
                const action = await this.do_action({
                    type: "ir.actions.act_window",
                    name: "View Record",
                    res_model: model,
                    res_id: false,
                    views: [[false, "form"]],
                    target: "new",
                    context: context,
                });
                this.screen.eprint("Writing random values...");
                const form_controller = this._getController(
                    action.controllerID
                );
                const fuzz_dialog_form = new FuzzDialogForm(this);
                const [
                    processed_fields,
                    ignored_fields,
                ] = await fuzz_dialog_form.processFormFields(form_controller);
                const required_count = _.size(
                    _.filter(processed_fields, field => field.required)
                );
                this.screen.eprint(
                    ` - Founded ${_.size(
                        processed_fields
                    )} visible fields (${required_count} required)`
                );
                this.screen.eprint(
                    ` - Ignored ${_.size(
                        ignored_fields
                    )} fields affected by an 'onchange'`
                );
                this.screen.eprint("Saving changes...");
                form_controller.widget
                    .saveRecord()
                    .then(() => {
                        const record = form_controller.widget.model.get(
                            form_controller.widget.handle
                        );
                        this.screen.eprint(
                            `Fuzz test finished successfully: ${record.res_id}`
                        );
                        if (!form_controller.dialog.isDestroyed()) {
                            form_controller.dialog.close();
                        }
                        this.doShow();
                        return resolve(record.res_id);
                    })
                    .fail(err => {
                        return reject(err);
                    });
            });
        },

        _getController: function(controller_id) {
            return this.getParent().action_manager.controllers[controller_id];
        },
    });
});
