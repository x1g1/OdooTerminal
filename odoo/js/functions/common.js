// Copyright 2018-2020 Alexandre Díaz <dev@redneboa.es>
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

odoo.define("terminal.functions.Common", function(require) {
    "use strict";

    const tour = require("web_tour.tour");
    const rpc = require("web.rpc");
    const ajax = require("web.ajax");
    const session = require("web.session");
    const Terminal = require("terminal.Terminal");

    Terminal.include({
        custom_events: _.extend({}, Terminal.prototype.custom_events, {
            longpolling_notification: "_onBusNotification",
        }),

        init: function() {
            this._super.apply(this, arguments);

            // Someone said 'registerCommand' ?¿?? O_o
            this.registerCommand("create", {
                definition: "Create new record",
                callback: this._cmdCreateModelRecord,
                detail: "Open new model record in form view or directly.",
                syntaxis: '<STRING: MODEL NAME> "[DICT: VALUES]"',
                args: "s?s",
            });
            this.registerCommand("unlink", {
                definition: "Unlink record",
                callback: this._cmdUnlinkModelRecord,
                detail: "Delete a record.",
                syntaxis:
                    "<STRING: MODEL NAME> <INT: RECORD ID or LIST OF IDs>",
                args: "sli",
            });
            this.registerCommand("write", {
                definition: "Update record values",
                callback: this._cmdWriteModelRecord,
                detail: "Update record values.",
                syntaxis:
                    "<STRING: MODEL NAME> <INT: RECORD ID or LIST OF IDs> " +
                    '"<DICT: NEW VALUES>"',
                args: "slis",
            });
            this.registerCommand("search", {
                definition: "Search model record/s",
                callback: this._cmdSearchModelRecord,
                detail:
                    "Launch orm search query.<br>[FIELDS] " +
                    "are separated by commas (without spaces) and by default " +
                    "is 'display_name'. Can use '*' to show all fields of the model" +
                    "<br>[LIMIT] can be zero (no limit)" +
                    "<br>[ORDER] A list of orders separated by comma (Example: 'age DESC, email')",
                syntaxis:
                    "<STRING: MODEL NAME> [STRING: FIELDS] " +
                    '"[ARRAY: DOMAIN]" [INT: LIMIT] [INT: OFFSET] ' +
                    '"[STRING: ORDER]"',
                args: "s?ssiis",
            });
            this.registerCommand("call", {
                definition: "Call model method",
                callback: this._cmdCallModelMethod,
                detail: "Call model method.",
                syntaxis:
                    '<STRING: MODEL> <STRING: METHOD> "[ARRAY: ARGS]" ' +
                    '"[DICT: KWARGS]"',
                args: "ss?ss",
            });
            this.registerCommand("upgrade", {
                definition: "Upgrade a module",
                callback: this._cmdUpgradeModule,
                detail: "Launch upgrade module process.",
                syntaxis: "<STRING: MODULE NAME>",
                args: "s",
            });
            this.registerCommand("install", {
                definition: "Install a module",
                callback: this._cmdInstallModule,
                detail: "Launch module installation process.",
                syntaxis: "<STRING: MODULE NAME>",
                args: "s",
            });
            this.registerCommand("uninstall", {
                definition: "Uninstall a module",
                callback: this._cmdUninstallModule,
                detail: "Launch module deletion process.",
                syntaxis: "<STRING: MODULE NAME>",
                args: "s",
            });
            this.registerCommand("reload", {
                definition: "Reload current page",
                callback: this._cmdReloadPage,
                detail: "Reload current page.",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("debug", {
                definition: "Set debug mode",
                callback: this._cmdSetDebugMode,
                detail:
                    "Set debug mode:<br>- 0: Disabled<br>- 1: " +
                    "Enabled<br>- 2: Enabled with Assets",
                syntaxis: "<INT: MODE>",
                args: "i",
            });
            this.registerCommand("action", {
                definition: "Call action",
                callback: this._cmdCallAction,
                detail:
                    "Call action.<br>&lt;ACTION&gt; Can be an " +
                    "string or object.",
                syntaxis: '"<STRING|DICT: ACTION>"',
                args: "s",
            });
            this.registerCommand("post", {
                definition: "Send POST request",
                callback: this._cmdPostData,
                detail: "Send POST request to selected endpoint",
                syntaxis: '<STRING: ENDPOINT> "<DICT: DATA>"',
                args: "ss",
            });
            this.registerCommand("whoami", {
                definition: "Know current user login",
                callback: this._cmdShowWhoAmI,
                detail: "Shows current user login",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("caf", {
                definition: "Check model fields access",
                callback: this._cmdCheckFieldAccess,
                detail: "Show readable/writeable fields of the selected model",
                syntaxis: '<STRING: MODEL> "[ARRAY: FIELDS]"',
                args: "s?s",
            });
            this.registerCommand("cam", {
                definition: "Check model access",
                callback: this._cmdCheckModelAccess,
                detail:
                    "Show access rights for the selected operation on the" +
                    " selected model" +
                    "<br>&lt;OPERATION&gt; Can be 'create', 'read', 'write'" +
                    " or 'unlink'",
                syntaxis: "<STRING: MODEL> <STRING: OPERATION>",
                args: "ss",
            });
            this.registerCommand("lastseen", {
                definition: "Know user presence",
                callback: this._cmdLastSeen,
                detail: "Show users last seen",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("read", {
                definition: "Search model record",
                callback: this._cmdSearchModelRecordId,
                detail:
                    "Launch orm search query.<br>[FIELDS] " +
                    "are separated by commas (without spaces) and by default " +
                    "is 'display_name'",
                syntaxis:
                    "<STRING: MODEL NAME> <INT: RECORD ID or LIST OF IDs> " +
                    "[STRING: FIELDS]",
                args: "sli?s",
            });
            this.registerCommand("context", {
                definition: "Operations over session context dictionary",
                callback: this._cmdContextOperation,
                detail:
                    "Operations over session context dictionary." +
                    "<br>[OPERATION] can be 'read', 'write' or 'set'. " +
                    "By default is 'read'. ",
                syntaxis: '[STRING: OPERATION] "[DICT: VALUES]" ',
                args: "?ss",
            });
            this.registerCommand("version", {
                definition: "Know Odoo version",
                callback: this._cmdShowOdooVersion,
                detail: "Shows Odoo version",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("longpolling", {
                definition: "Long-Polling operations",
                callback: this._cmdLongpolling,
                detail:
                    "Operations over long-polling." +
                    "<br>[OPERATION] can be 'verbose', 'off', 'add_channel'," +
                    " 'del_channel', 'start', 'stop' or empty. " +
                    "If empty, prints current value." +
                    "<br> - verbose > Print incoming notificacions" +
                    "<br> - off > Stop verbose mode" +
                    "<br> - add_channel > Add a channel to listen" +
                    "<br> - del_channel > Delete a listening channel" +
                    "<br> - start > Start client longpolling service" +
                    "<br> - stop > Stop client longpolling service",
                syntaxis: "[STRING: OPERATION] [STRING: PARAM1]",
                args: "?ss",
            });
            this.registerCommand("login", {
                definition: "Login as...",
                callback: this._cmdLoginAs,
                detail:
                    "Login as selected user." +
                    "<br>&lt;DATABASE&gt; Can be '*' to use current database" +
                    "<br>&lt;LOGIN&gt; Can be optionally preceded by the '-'" +
                    " character and it will be used for password too",
                syntaxis:
                    "<STRING: DATABASE> <STRING: LOGIN> [STRING: PASSWORD]",
                args: "ss?s",
                secured: true,
            });
            this.registerCommand("uhg", {
                definition: "Check if user is in the selected groups",
                callback: this._cmdUserHasGroups,
                detail:
                    "Check if user is in the selected groups." +
                    "<br>&lt;GROUPS&gt; A list of groups separated by " +
                    "commas, a group can be optionally preceded by '!' to " +
                    "say 'is not in group'",
                syntaxis: "<STRING: GROUPS>",
                args: "s",
            });
            this.registerCommand("dblist", {
                definition: "Show database names",
                callback: this._cmdShowDBList,
                detail: "Show database names",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("jstest", {
                definition: "Launch JS Tests",
                callback: this._cmdJSTest,
                detail:
                    "Runs js tests in desktop or mobile mode for the selected module." +
                    "<br>&lt;MODULE&gt; Module technical name" +
                    "<br>&lt;MODE&gt; Can be 'desktop' or 'mobile' (By default is 'desktop')",
                syntaxis: "<STRING: MODULE> <STRING: MODE>",
                args: "?ss",
            });
            this.registerCommand("tour", {
                definition: "Launch Tour",
                callback: this._cmdRunTour,
                detail:
                    "Runs the selected tour. If no tour given, prints all available tours." +
                    "<br>[TOUR NAME] Tour Name",
                syntaxis: "[STRING: TOUR NAME]",
                args: "?s",
            });
            this.registerCommand("json", {
                definition: "Send POST JSON",
                callback: this._cmdPostJSONData,
                detail: "Sends HTTP POST 'application/json' request",
                syntaxis: '<STRING: ENDPOINT> "<DICT: DATA>"',
                args: "ss",
            });
            this.registerCommand("depends", {
                definition: "Know modules that depends on the given module",
                callback: this._cmdModuleDepends,
                detail:
                    "Show a list of the modules that depends on the given module",
                syntaxis: "<STRING: MODULE NAME>",
                args: "s",
            });
            this.registerCommand("ual", {
                definition: "Update apps list",
                callback: this._cmdUpdateAppList,
                detail: "Update apps list",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("logout", {
                definition: "Log out",
                callback: this._cmdLogOut,
                detail: "Session log out",
                syntaxis: "",
                args: "",
            });
            this.registerCommand("count", {
                definition:
                    "Gets number of records from the given model in the selected domain",
                callback: this._cmdCount,
                detail:
                    "Gets number of records from the given model in the selected domain",
                syntaxis: '<STRING MODEL> "[ARRAY: DOMAIN]"',
                args: "s?s",
            });
        },

        _cmdCount: function(model, domain = "[]") {
            return rpc
                .query({
                    method: "search_count",
                    model: model,
                    args: [JSON.parse(domain)],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    this.screen.print(`Result: ${result}`);
                    return result;
                });
        },

        _cmdUpdateAppList: function() {
            return rpc
                .query({
                    method: "update_list",
                    model: "ir.module.module",
                })
                .then(result => {
                    if (result) {
                        this.screen.print(
                            "The apps list has been updated successfully"
                        );
                    } else {
                        this.screen.printError("Can't update the apps list!");
                    }
                    return result;
                });
        },

        _cmdModuleDepends: function(module_name) {
            return rpc
                .query({
                    method: "onchange_module",
                    model: "res.config.settings",
                    args: [false, false, module_name],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    if (_.isEmpty(result)) {
                        this.screen.printError("The module isn't installed");
                    } else {
                        const depend_names = result.warning.message
                            .substr(result.warning.message.search("\n") + 1)
                            .split("\n");
                        this.screen.print(depend_names);
                    }
                    return result;
                });
        },

        _cmdPostJSONData: function(url, data) {
            return $.ajax(url, {
                data: data,
                contentType: "application/json",
                type: "POST",
            }).then(result => {
                this.screen.print(result);
                return result;
            });
        },

        _cmdRunTour: function(tour_name) {
            const tour_names = Object.keys(tour.tours);
            if (tour_name) {
                if (tour_names.indexOf(tour_name) === -1) {
                    this.screen.printError("The given tour doesn't exists!");
                } else {
                    odoo.__DEBUG__.services["web_tour.tour"].run(tour_name);
                    this.screen.print("Running tour...");
                }
            } else if (tour_names.length) {
                this.screen.print(tour_names);
            } else {
                this.screen.print("The tour list is empty");
            }
            return Promise.resolve();
        },

        _cmdJSTest: function(module_name, mode) {
            let mod = module_name || "";
            if (module_name === "*") {
                mod = "";
            }
            let url = `/web/tests?module=${mod}`;
            if (mode === "mobile") {
                url = `/web/tests/mobile?module=${mod}`;
            }
            window.location = url;
            return Promise.resolve();
        },

        _cmdShowDBList: function() {
            return ajax
                .rpc("/jsonrpc", {
                    service: "db",
                    method: "list",
                    args: {},
                })
                .then(databases => {
                    if (!databases) {
                        this.screen.printError("Can't get database names");
                        return;
                    }
                    for (const i in databases) {
                        if (databases[i] === session.db) {
                            databases[i] = `<strong>${databases[i]}</strong>`;
                            break;
                        }
                    }
                    this.screen.print(databases);
                    return databases;
                });
        },

        _cmdUserHasGroups: function(groups) {
            return rpc
                .query({
                    method: "user_has_groups",
                    model: "res.users",
                    args: [groups],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    if (result) {
                        this.screen.print("Nice! groups are truly evaluated");
                    } else {
                        this.screen.print("Groups are negatively evaluated");
                    }
                    return result;
                });
        },

        _cmdLoginAs: function(database, login_name, pass) {
            let db = database;
            let login = login_name;
            let passwd = pass || false;
            if (login[0] === "-" && !passwd) {
                login = login.substr(1);
                passwd = login;
            }
            if (db === "*") {
                if (!session.db) {
                    this.screen.printError(
                        "Unknown active database. Try using " +
                            "'<span class='o_terminal_click o_terminal_cmd' " +
                            "data-cmd='dblist'>dblist</span>' command."
                    );
                    return Promise.resolve();
                }
                db = session.db;
            }
            return session
                ._session_authenticate(db, login, passwd)
                .then(result => {
                    this.screen.print(`Successfully logged as '${login}'`);
                    return result;
                });
        },

        _cmdLogOut: function() {
            return session.session_logout().then(result => {
                this.screen.print("Logged out");
                return result;
            });
        },

        _longPollingAddChannel: function(name) {
            if (typeof name === "undefined") {
                this.screen.printError("Invalid channel name.");
            } else {
                this.screen.print(this._longpolling.addChannel(name));
                this.screen.print(`Joined the '${name}' channel.`);
            }
        },

        _longPollingDelChannel: function(name) {
            if (typeof name === "undefined") {
                this.screen.printError("Invalid channel name.");
            } else {
                this._longpolling.deleteChannel(name);
                this.screen.print(`Leave the '${name}' channel.`);
            }
        },

        _cmdLongpolling: function(operation, name) {
            if (!this._longpolling) {
                return Promise.reject(
                    "Can't use longpolling, 'bus' module is not installed"
                );
            }

            if (typeof operation === "undefined") {
                this.screen.print(this._longpolling.isVerbose() || "off");
            } else if (operation === "verbose") {
                this._longpolling.setVerbose(true);
                this.screen.print("Now long-polling is in verbose mode.");
            } else if (operation === "off") {
                this._longpolling.setVerbose(false);
                this.screen.print("Now long-polling verbose mode is disabled");
            } else if (operation === "add_channel") {
                this._longPollingAddChannel(name);
            } else if (operation === "del_channel") {
                this._longPollingDelChannel(name);
            } else if (operation === "start") {
                this._longpolling.startPoll();
                this.screen.print("Longpolling started");
            } else if (operation === "stop") {
                this._longpolling.stopPoll();
                this.screen.print("Longpolling stopped");
            } else {
                this.screen.printError("Invalid Operation.");
            }
            return Promise.resolve();
        },

        _cmdShowOdooVersion: function() {
            try {
                this.screen.print(
                    `${odoo.session_info.server_version_info
                        .slice(0, 3)
                        .join(
                            "."
                        )} (${odoo.session_info.server_version_info
                        .slice(3)
                        .join(" ")})`
                );
            } catch (err) {
                this.screen.print(window.term_odooVersion);
            }
            return Promise.resolve();
        },

        _cmdContextOperation: function(operation = "read", values = "false") {
            if (operation === "read") {
                this.screen.print(session.user_context);
            } else if (operation === "set") {
                session.user_context = JSON.parse(values);
                this.screen.print(session.user_context);
            } else if (operation === "write") {
                Object.assign(session.user_context, JSON.parse(values));
                this.screen.print(session.user_context);
            } else {
                this.screen.printError("Invalid operation");
            }
            return Promise.resolve();
        },

        _cmdSearchModelRecordId: function(model, id, field_names) {
            let fields = ["display_name"];
            if (field_names) {
                fields =
                    field_names === "*"
                        ? false
                        : this._parameterReader.splitAndTrim(field_names, ",");
            }
            return rpc
                .query({
                    method: "search_read",
                    domain: [["id", "in", id]],
                    fields: fields,
                    model: model,
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    this.screen.printRecords(model, result);
                    return result;
                });
        },

        _cmdLastSeen: function() {
            if (!this._longpolling) {
                return Promise.reject(
                    "Can't use lastseen, 'bus' module is not installed"
                );
            }
            return rpc
                .query({
                    method: "search_read",
                    fields: ["user_id", "last_presence"],
                    model: "bus.presence",
                    orderBy: [{name: "last_presence", asc: false}],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    let body = "";
                    const len = result.length;
                    for (let x = 0; x < len; ++x) {
                        const record = result[x];
                        body +=
                            `<tr><td>${record.user_id[1]}</td>` +
                            `<td>${record.user_id[0]}</td>` +
                            `<td>${record.last_presence}</td></tr>`;
                    }
                    this.screen.printTable(
                        ["User Name", "User ID", "Last Seen"],
                        body
                    );
                    return result;
                });
        },

        _cmdCheckModelAccess: function(model, operation) {
            return rpc
                .query({
                    method: "check_access_rights",
                    model: model,
                    args: [operation, false],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    if (result) {
                        this.screen.print(
                            `You have access rights for '${operation}' on ${model}`
                        );
                    } else {
                        this.screen.print(
                            `You can't '${operation}' on ${model}`
                        );
                    }
                    return result;
                });
        },

        _cmdCheckFieldAccess: function(model, field_names = false) {
            let fields = false;
            if (field_names) {
                fields =
                    field_names === "*"
                        ? false
                        : this._parameterReader.splitAndTrim(field_names, ",");
            }
            return rpc
                .query({
                    method: "fields_get",
                    model: model,
                    args: [fields],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    const keys = Object.keys(result).sort();
                    const fieldParams = [
                        "type",
                        "string",
                        "relation",
                        "required",
                        "readonly",
                        "searchable",
                        "depends",
                    ];
                    let body = "";
                    const len = keys.length;
                    for (let x = 0; x < len; ++x) {
                        const field = keys[x];
                        body += "<tr>";
                        body += `<td>${field}</td>`;
                        const fieldDef = result[field];
                        const l2 = fieldParams.length;
                        for (let x2 = 0; x2 < l2; ++x2) {
                            let value = fieldDef[fieldParams[x2]];
                            if (_.isUndefined(value) || _.isNull(undefined)) {
                                value = "";
                            }
                            body += `<td>${value}</td>`;
                        }
                        body += "</tr>";
                    }
                    fieldParams.unshift("field");
                    this.screen.printTable(fieldParams, body);
                    return result;
                });
        },

        _cmdShowWhoAmI: function() {
            const uid =
                window.odoo.session_info.uid ||
                window.odoo.session_info.user_id;
            return rpc
                .query({
                    method: "search_read",
                    domain: [["id", "=", uid]],
                    fields: [
                        "id",
                        "display_name",
                        "login",
                        "partner_id",
                        "company_id",
                        "company_ids",
                        "groups_id",
                    ],
                    model: "res.users",
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    if (result.length) {
                        const record = result[0];
                        this.screen.print(
                            this._templates.render("WHOAMI", {
                                login: record.login,
                                display_name: record.display_name,
                                user_id: record.id,
                                partner: record.partner_id,
                                company: record.company_id,
                                companies: record.company_ids,
                                groups: record.groups_id,
                            })
                        );
                    } else {
                        this.screen.printError("Oops! can't get the login :/");
                    }
                    return result;
                });
        },

        _cmdSetDebugMode: function(mode) {
            if (mode === 0) {
                this.screen.print(
                    "Debug mode <strong>disabled</strong>. Reloading page..."
                );
                const qs = $.deparam.querystring();
                delete qs.debug;
                window.location.search = "?" + $.param(qs);
            } else if (mode === 1) {
                this.screen.print(
                    "Debug mode <strong>enabled</strong>. Reloading page..."
                );
                window.location = $.param.querystring(
                    window.location.href,
                    "debug=1"
                );
            } else if (mode === 2) {
                this.screen.print(
                    "Debug mode with assets <strong>enabled</strong>. " +
                        "Reloading page..."
                );
                window.location = $.param.querystring(
                    window.location.href,
                    "debug=assets"
                );
            } else {
                this.screen.printError("Invalid debug mode");
            }
            return Promise.resolve();
        },

        _cmdReloadPage: function() {
            location.reload();
            return Promise.resolve();
        },

        _searchModule: function(module_name) {
            return rpc.query({
                method: "search_read",
                domain: [["name", "=", module_name]],
                fields: ["name"],
                model: "ir.module.module",
                kwargs: {context: this._getContext()},
            });
        },

        _cmdUpgradeModule: function(module_name) {
            return this._searchModule(module_name).then(result => {
                if (result.length) {
                    rpc.query({
                        method: "button_immediate_upgrade",
                        model: "ir.module.module",
                        args: [result[0].id],
                    }).then(
                        () => {
                            this.screen.print(
                                `'${module_name}' module successfully upgraded`
                            );
                        },
                        () => {
                            this.screen.printError(
                                `Can't upgrade '${module_name}' module`
                            );
                        }
                    );
                } else {
                    this.screen.printError(
                        `'${module_name}' module doesn't exists`
                    );
                }
            });
        },

        _cmdInstallModule: function(module_name) {
            return this._searchModule(module_name).then(result => {
                if (result.length) {
                    rpc.query({
                        method: "button_immediate_install",
                        model: "ir.module.module",
                        args: [result[0].id],
                    }).then(
                        () => {
                            this.screen.print(
                                `'${module_name}' module successfully installed`
                            );
                        },
                        () => {
                            this.screen.printError(
                                `Can't install '${module_name}' module`
                            );
                        }
                    );
                } else {
                    this.screen.printError(
                        `'${module_name}' module doesn't exists`
                    );
                }
            });
        },

        _cmdUninstallModule: function(module_name) {
            return this._searchModule(module_name).then(result => {
                if (result.length) {
                    rpc.query({
                        method: "button_immediate_uninstall",
                        model: "ir.module.module",
                        args: [result[0].id],
                    }).then(
                        () => {
                            this.screen.print(
                                `'${module_name}' module successfully uninstalled`
                            );
                        },
                        () => {
                            this.screen.printError(
                                `Can't uninstall '${module_name}' module`
                            );
                        }
                    );
                } else {
                    this.screen.printError(
                        `'${module_name}' module doesn't exists`
                    );
                }
            });
        },

        _cmdCallModelMethod: function(
            model,
            method,
            args = "[]",
            kwargs = "{}"
        ) {
            const pkwargs = JSON.parse(kwargs);
            if (typeof pkwargs.context === "undefined") {
                pkwargs.context = this._getContext();
            }
            return rpc
                .query({
                    method: method,
                    model: model,
                    args: JSON.parse(args),
                    kwargs: pkwargs,
                })
                .then(result => {
                    this.screen.print(result);
                    return result;
                });
        },

        /**
         * Odoo js framework works with a custom object for sort. This
         * method converts string to this object.
         *
         * @param {String} orderBy
         * @returns {Array}
         */
        _deserializeSort: function(orderBy) {
            const res = [];
            if (!orderBy) {
                return res;
            }
            const orders = this._parameterReader.splitAndTrim(orderBy, ",");
            for (const order of orders) {
                const order_s = order.split(" ");
                res.push({
                    name: order_s[0],
                    asc:
                        order_s.length < 2 ||
                        order_s[1].toLowerCase() === "asc",
                });
            }
            return res;
        },

        _cmdSearchModelRecord: function(
            model,
            field_names,
            domain = "[]",
            limit,
            offset,
            order
        ) {
            const lines_total = this.screen._max_lines - 3;
            let fields = ["display_name"];
            if (field_names) {
                fields =
                    field_names === "*"
                        ? false
                        : this._parameterReader.splitAndTrim(field_names, ",");
            }

            // Workaround: '--more' is a special model name to handle print the rest of the previous call result
            if (model === "--more") {
                const buff = this._buffer[this.__meta.name];
                if (!buff || !buff.data.length) {
                    this.screen.printError(
                        "There are no more results to print"
                    );
                    return Promise.resolve();
                }
                const sresult = buff.data.slice(0, lines_total);
                buff.data = buff.data.slice(lines_total);
                this.screen.printRecords(buff.model, sresult);
                if (buff.data.length) {
                    this.screen.print(
                        `There are still results to print (${buff.data.length}). Continue using '<strong class='o_terminal_click o_terminal_cmd' data-cmd='search --more'>--more</strong>'...`
                    );
                }
                this.screen.print(`Records count: ${sresult.length}`);
                return Promise.resolve(sresult);
            }

            return rpc
                .query({
                    method: "search_read",
                    domain: JSON.parse(domain),
                    fields: fields,
                    model: model,
                    limit: limit,
                    offset: offset,
                    orderBy: this._deserializeSort(order),
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    const need_truncate =
                        !this._mute_mode && result.length > lines_total;
                    let sresult = result;
                    if (need_truncate) {
                        this._buffer[this.__meta.name] = {
                            model: model,
                            data: sresult.slice(lines_total),
                        };
                        sresult = sresult.slice(0, lines_total);
                    }
                    this.screen.printRecords(model, sresult);
                    if (need_truncate) {
                        this.screen.printError(
                            `<strong class='text-warning'>Result truncated!</strong> The query is too big to be displayed entirely. Use '<strong class='o_terminal_click o_terminal_cmd' data-cmd='search --more'>search --more</strong>' to print the rest of the results (${
                                this._buffer[this.__meta.name].data.length
                            })...`
                        );
                    }
                    this.screen.print(`Records count: ${sresult.length}`);
                    return result;
                });
        },

        _cmdCreateModelRecord: function(model, values) {
            if (typeof values === "undefined") {
                return this.do_action({
                    type: "ir.actions.act_window",
                    res_model: model,
                    views: [[false, "form"]],
                    target: "current",
                }).then(() => {
                    this.doHide();
                });
            }
            return rpc
                .query({
                    method: "create",
                    model: model,
                    args: [JSON.parse(values)],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    this.screen.print(
                        this._templates.render("RECORD_CREATED", {
                            model: model,
                            new_id: result,
                        })
                    );
                    return result;
                });
        },

        _cmdUnlinkModelRecord: function(model, id) {
            return rpc
                .query({
                    method: "unlink",
                    model: model,
                    args: [id],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    this.screen.print(`${model} record deleted successfully`);
                    return result;
                });
        },

        _cmdWriteModelRecord: function(model, id, values) {
            return rpc
                .query({
                    method: "write",
                    model: model,
                    args: [id, JSON.parse(values)],
                    kwargs: {context: this._getContext()},
                })
                .then(result => {
                    this.screen.print(`${model} record updated successfully`);
                    return result;
                });
        },

        _cmdCallAction: function(action) {
            let paction = action;
            try {
                paction = JSON.parse(action);
            } catch (err) {
                // Do Nothing
            }
            return this.do_action(paction);
        },

        _cmdPostData: function(url, data) {
            return ajax.post(url, JSON.parse(data)).then(result => {
                this.screen.print(result);
            });
        },

        //
        _onBusNotification: function(notifications) {
            const NotifDatas = Object.values(notifications.data);
            const l = NotifDatas.length;
            for (let x = 0; x < l; ++x) {
                const notif = NotifDatas[x];
                this.screen.print(
                    "<strong>[<i class='fa fa-envelope-o'></i>] New Longpolling Notification:</stron>"
                );
                if (notif[0] !== "not") {
                    this.screen.print(
                        [
                            `From: ${notif[0][0]}`,
                            `Channel: ${notif[0][1]}`,
                            `To: ${notif[0][2]}`,
                        ],
                        true
                    );
                }
                this.screen.print(notif[1], false);
            }
        },
    });
});
