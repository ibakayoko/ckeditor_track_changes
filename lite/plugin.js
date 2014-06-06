/*
 Copyright 2013 LoopIndex, This file is part of the Track Changes plugin for CKEditor.
 
 The track changes plugin is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License, version 2, as published by the Free Software Foundation.
 This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 You should have received a copy of the GNU Lesser General Public License along with this program as the file lgpl.txt. If not, see http://www.gnu.org/licenses/lgpl.html.
 
 Written by (David *)Frenkiel - https://github.com/imdfl
 */
(function() {

    /**
     * @class LITE
     * @singleton
     * The LITE namespace
     */
    var LITE = {
        /**
         * @class LITE.Events
         */
        Events: {
            /**
             * @member LITE.Events
             * @event INIT
             * string value: "lite:init"
             * @param {LITE.LITEPlugin} an instance of a lite object associated with a ckeditor instance
             */
            INIT: "lite:init",
            /**
             * @member LITE.Events
             * @event ACCEPT
             * string value: "lite:accept"
             * @param {Object} An object with the <code>options</code> passed to the accept method
             */
            ACCEPT: "lite:accept",
            /**
             * @member LITE.Events
             * @event REJECT
             * string value: "lite:reject"
             * @param {Object} An object with the <code>options</code> passed to the reject method
             */
            REJECT: "lite:reject",
            /**
             * @member LITE.Events
             * @event SHOW_HIDE
             * string value: "lite:showHide"
             * @param {Object} An object with the field <code>show</code> indicating the new change tracking show stats
             */
            SHOW_HIDE: "lite:showHide",
            /**
             * @member LITE.Events
             * @event TRACKING
             * string value: "lite:tracking"
             * @param {Object} An object with the field <code>tracking</code> indicating the new tracking status
             */
            TRACKING: "lite:tracking"
        },
        Commands: {
            TOGGLE_TRACKING: "lite.ToggleTracking",
            TOGGLE_SHOW: "lite.ToggleShow",
            ACCEPT_ALL: "lite.AcceptAll",
            REJECT_ALL: "lite.RejectAll",
            ACCEPT_ONE: "lite.AcceptOne",
            REJECT_ONE: "lite.RejectOne",
            TOGGLE_TOOLTIPS: "lite.ToggleTooltips"
        }
    },
    tooltipDefaults = {
        show: true,
        path: "js/opentip-adapter.js",
        classPath: "OpentipAdapter",
        cssPath: "css/opentip.css",
        delay: 500
    },
    defaultTooltipTemplate = "Changed by %u %t",
            _emptyRegex = /^[\s\r\n]*$/, // for getting the clean text
            _cleanRE = [{regex: /[\s]*title=\"[^\"]+\"/g, replace: ""},
        {regex: /[\s]*data-selected=\"[^\"]+\"/g, replace: ""}
    ],
            _pluginMap = [];

    function _findPluginIndex(editor) {
        for (var i = _pluginMap.length; i--; ) {
            var rec = _pluginMap[i];
            if (rec.editor == editor) {
                return i;
            }
        }
        return -1;
    }

    function _findPluginRec(editor) {
        var ind = _findPluginIndex(editor);
        return ind >= 0 ? _pluginMap[ind] : null;
    }

    function _findPlugin(editor) {
        var rec = _findPluginRec(editor);
        return rec && rec.plugin;
    }

    function addPlugin(editor, plugin) {
        _pluginMap.push({
            plugin: plugin,
            editor: editor
        });
    }

    function padString(s, length, padWith, bSuffix) {
        if (null === s || (typeof(s) == "undefined")) {
            s = "";
        }
        else {
            s = String(s);
        }
        padWith = String(padWith);
        var padLength = padWith.length;
        for (var i = s.length; i < length; i += padLength) {
            if (bSuffix) {
                s += padWidth;
            }
            else {
                s = padWith + s;
            }
        }
        return s;
    }

    function padNumber(s, length) {
        return padString(s, length, '0');
    }

    function relativeDateFormat(date) {
        var now = new Date();
        var today = now.getDate();
        var month = now.getMonth();
        var year = now.getFullYear();

        var t = typeof(date);
        if (t == "string" || t == "number") {
            date = new Date(date);
        }

        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        if (today == date.getDate() && month == date.getMonth() && year == date.getFullYear()) {
            var minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
            if (minutes < 1) {
                return "now";
            }
            else if (minutes < 2) {
                return "1 minute ago";
            }
            else if (minutes < 60) {
                return (minutes + " minutes ago");
            }
            else {
                var hours = date.getHours();
                var minutes = date.getMinutes();
                return "on " + padNumber(hours, 2) + ":" + padNumber(minutes, 2, "0");
            }
        }
        else if (year == date.getFullYear()) {
            return "on " + months[date.getMonth()] + " " + date.getDate();
        }
        else {
            return "on " + months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
        }
    }


    /**
     * @class LITE.lite
     * The plugin object created by CKEditor. Since only one plugin is created per web page which may contain multiple instances of CKEditor, this object only handles
     * the lifecycle of {@link LITE.LITEPlugin} the real plugin object.
     * 
     */
    CKEDITOR.plugins.add('lite',
            {
                props: {
                    deleteTag: 'span',
                    insertTag: 'span',
                    deleteClass: 'ice-del',
                    insertClass: 'ice-ins',
                    attributes: {
                        changeId: 'data-cid',
                        userId: 'data-userid',
                        userName: 'data-username',
                        changeData: 'data-changedata',
                        time: 'data-time'
                    },
                    stylePrefix: 'ice-cts',
                    preserveOnPaste: 'p',
                    css: 'css/lite.css'
                },
                _scriptsLoaded: null, // not false, which means we're loading

                /**
                 * Called by CKEditor to init the plugin
                 * Creates an instance of a {@link LITE.LITEPlugin} if one is not already associated with the given editor. 
                 * @param ed an instance of CKEditor
                 */
                init: function(ed) {
                    var rec = _findPluginRec(ed);
                    if (rec) { // should not happen
                        return;
                    }
                    // (CKEDITOR.ELEMENT_MODE_INLINE == ed.elementMode) {
                    if (!this._inited) {
                        _ieFix();
                        this._inited = true;
                    }
                    var path = this.path,
                            plugin = new LITEPlugin(this.props, path),
                            liteConfig = jQuery.extend({}, ed.config.lite || {}),
                            ttConfig = liteConfig.tooltips;

                    if (undefined == ttConfig) {
                        ttConfig = true;
                    }

                    if (ttConfig === true) {
                        ttConfig = tooltipDefaults;
                    }
                    liteConfig.tooltips = ttConfig;

                    addPlugin(ed, plugin);

                    plugin.init(ed, liteConfig);


                    ed.on("destroy", (function(editor) {
                        var ind = _findPluginIndex(editor);
                        if (ind >= 0) {
                            _pluginMap.splice(ind, 1);
                        }
                    }).bind(this));

                    if (this._scriptsLoaded) {
                        plugin._onScriptsLoaded();
                        return;
                    }
                    else if (this._scriptsLoaded === false) { // still loading, initial value was null
                        return;
                    }

                    this._scriptsLoaded = false;
                    var jQueryLoaded = (typeof(jQuery) == "function"),
                            self = this,
                            jQueryPath = liteConfig.jQueryPath || "js/jquery.min.js",
                            scripts = (liteConfig.includeType ? liteConfig["includes_" + liteConfig.includeType] : liteConfig.includes) || ["lite-includes.js"];

                    scripts = scripts.slice(); // create a copy not referenced by the config

                    for (var i = 0, len = scripts.length; i < len; ++i) {
                        scripts[i] = path + scripts[i];
                    }
                    if (!jQueryLoaded) {
                        scripts.splice(0, 0, this.path + jQueryPath);
                    }
                    if (ttConfig.path) {
                        scripts.push(this.path + ttConfig.path);
                    }

                    var load1 = function() {
                        if (scripts.length < 1) {
                            self._scriptsLoaded = true;
                            if (!jQueryLoaded) {
                                jQuery.noConflict();
                            }
                            jQuery.each(_pluginMap, (function(i, rec) {
                                rec.plugin._onScriptsLoaded();
                            }));
                        }
                        else {
                            var script = scripts.shift();
                            CKEDITOR.scriptLoader.load(script, function() {
                                load1();
                            }, self);
                        }
                    };

                    load1(scripts);
                },
                /**
                 * returns the plugin instance associated with an editor
                 * @param editor
                 * @returns {Object} A LITE plugin instance
                 */
                findPlugin: function(editor) {
                    return _findPlugin(editor);
                }

            });

    /**
     * @class LITE.LITEPlugin
     * The LITEPlugin is created per instance of a CKEditor. This object handles all the events and commands associated with change tracking in a specific editor.
     */
    LITEPlugin = function(props, path) {
        this.props = {};
        this.path = path;
        for (var key in props) {
            if (props.hasOwnProperty(key)) {
                this.props[key] = props[key];
            }
        }
    };

    LITEPlugin.prototype = {
        /**
         * Called by CKEditor to init the plugin
         * @param ed an instance of CKEditor
         * @param {Object} config a configuration object, not null, ready to be used as a local copy
         */
        init: function(ed, config) {
            this._editor = ed;
            this._domLoaded = false;
            this._editor = null;
            this._tracker = null;
            this._isVisible = true; // changes are visible
            this._liteCommandNames = [];
            this._canAcceptReject = true; // enable state for accept reject overriding editor readonly
            this._removeBindings = [];

            ed.ui.addToolbarGroup('lite');
            this._setPluginFeatures(ed, this.props);
            this._changeTimeout = null;
            this._boundNotifyChange = this._notifyChange.bind(this);

            this._config = config;

            var allow = config.acceptRejectInReadOnly === true;
            var commandsMap = [
                {command: LITE.Commands.TOGGLE_TRACKING,
                    exec: this._onToggleTracking,
                    title: "Toggle Tracking Changes",
                    icon: "track_changes_on_off.png",
                    trackingOnly: false
                },
                {
                    command: LITE.Commands.TOGGLE_SHOW,
                    exec: this._onToggleShow,
                    title: "Toggle Tracking Changes",
                    icon: "show_hide.png",
                    readOnly: true
                },
                {
                    command: LITE.Commands.ACCEPT_ALL,
                    exec: this._onAcceptAll,
                    title: "Accept all changes",
                    icon: "accept_all.png",
                    readOnly: allow
                },
                {
                    command: LITE.Commands.REJECT_ALL,
                    exec: this._onRejectAll,
                    title: "Reject all changes",
                    icon: "reject_all.png",
                    readOnly: allow
                },
                {
                    command: LITE.Commands.ACCEPT_ONE,
                    exec: this._onAcceptOne,
                    title: "Accept Change",
                    icon: "accept_one.png",
                    readOnly: allow
                },
                {
                    command: LITE.Commands.REJECT_ONE,
                    exec: this._onRejectOne,
                    title: "Reject Change",
                    icon: "reject_one.png",
                    readOnly: allow
                },
                {
                    command: LITE.Commands.TOGGLE_TOOLTIPS,
                    exec: this._onToggleTooltips,
                    readOnly: true
                }
            ];

            this._isTracking = config.isTracking !== false;
            this._eventsBounds = false;

            ed.on("contentDom", (function(dom) {
                this._onDomLoaded(dom);
            }).bind(this));
            var path = this.path;

            var commands = config.commands || [LITE.Commands.TOGGLE_TRACKING, LITE.Commands.TOGGLE_SHOW, LITE.Commands.ACCEPT_ALL, LITE.Commands.REJECT_ALL, LITE.Commands.ACCEPT_ONE, LITE.Commands.REJECT_ONE];

            var self = this;

            function add1(rec) {
                ed.addCommand(rec.command, {
                    exec: rec.exec.bind(self),
                    readOnly: rec.readOnly || false
                });

                if (rec.icon && rec.title && commands.indexOf(rec.command) >= 0) { // configuration doens't include this command
                    var name = self._commandNameToUIName(rec.command);
                    ed.ui.addButton(name, {
                        label: rec.title,
                        command: rec.command,
                        icon: path + "icons/" + rec.icon,
                        toolbar: "lite"
                    });
                    if (rec.trackingOnly !== false) {
                        self._liteCommandNames.push(rec.command);
                    }

                }
            }


            for (var i = 0, len = commandsMap.length; i < len; ++i) {
                add1(commandsMap[i]);
            }


            if (ed.addMenuItems) {
                ed.addMenuGroup('lite', 50);
                var params = {};
                params[LITE.Commands.ACCEPT_ONE] = {
                    label: 'Accept Change',
                    command: LITE.Commands.ACCEPT_ONE,
                    group: 'lite',
                    order: 1,
                    icon: path + 'icons/accept_one.png'
                };
                params[LITE.Commands.REJECT_ONE] = {
                    label: 'Reject Change',
                    command: LITE.Commands.REJECT_ONE,
                    group: 'lite',
                    order: 2,
                    icon: path + 'icons/reject_one.png'
                };

                ed.addMenuItems(params);
            }

            if (ed.contextMenu) {
                ed.contextMenu.addListener((function(element, selection) {
                    if (element && this._tracker && this._tracker.currentChangeNode(element)) {
                        var ret = {};
                        ret[LITE.Commands.ACCEPT_ONE] = CKEDITOR.TRISTATE_OFF;
                        ret[LITE.Commands.REJECT_ONE] = CKEDITOR.TRISTATE_OFF;
                        return ret;
                    }
                    else {
                        return null;
                    }
                }).bind(this));
            }
        },
        /**
         * Change the state of change tracking for the change editor associated with this plugin.
         * Toggles tracking visibility in accordance with the tracking state. 
         * @param {Boolean} track if undefined - toggle the state, otherwise set the tracking state to this value, 
         * @param {Boolean} bNotify if not false, dispatch the TRACKING event
         */
        toggleTracking: function(track, bNotify) {
            var tracking = (undefined === track) ? !this._isTracking : track,
                    e = this._editor;
            this._isTracking = tracking;
            this._setCommandsState(this._liteCommandNames, tracking ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED);
            /*			for (var i = this._liteCommandNames.length - 1; i >= 0; --i) {
             var cmd = e.getCommand(this._liteCommandNames[i]);
             if (cmd) {
             if (tracking) {
             cmd.enable();
             }
             else {
             cmd.disable();
             }
             }
             } */

            this._updateTrackingState();
            this.toggleShow(tracking, false);

            this._setCommandsState(LITE.Commands.TOGGLE_TRACKING, tracking ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF);
            var ui = e.ui.get(this._commandNameToUIName(LITE.Commands.TOGGLE_TRACKING));
            if (ui) {
                this._setButtonTitle(ui, tracking ? 'Stop tracking changes' : 'Start tracking changes');
            }
            if (bNotify !== false) {
                e.fire(LITE.Events.TRACKING, {tracking: tracking});
            }
        },
        /**
         * Change the visibility of tracked changes for the change editor associated with this plugin
         * @param show if bool, set the visibility state to this value, otherwise toggle the state
         * @param bNotify if not false, dispatch the TOGGLE_SHOW event
         */
        toggleShow: function(show, bNotify) {
            var vis = (typeof(show) == "undefined") ? (!this._isVisible) : show;
            this._isVisible = vis;
            if (this._isTracking) {
                this._setCommandsState(LITE.Commands.TOGGLE_SHOW, vis ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF);
            }
            this._tracker.setShowChanges(vis && this._isTracking);

            var ui = this._editor.ui.get(this._commandNameToUIName(LITE.Commands.TOGGLE_SHOW));
            if (ui) {
                this._setButtonTitle(ui, vis ? 'Hide tracked changes' : 'Show tracked changes');
            }
            if (bNotify !== false) {
                this._editor.fire(LITE.Events.SHOW_HIDE, {show: vis});
            }
        },
        /**
         * Are tracked changes visible?
         * @returns {Boolean} true if tracked changes are visible
         */
        isVisible: function() {
            return this._isVisible;
        },
        /**
         * Are changes tracked?
         * @returns {Boolean} true if changes are tracked
         */
        isTracking: function() {
            return this._isTracking;
        },
        /**
         * Accept all tracked changes
         */
        acceptAll: function(options) {
            this._tracker.acceptAll(options);
            this._cleanup();
            this._editor.fire(LITE.Events.ACCEPT, {options: options});
        },
        /**
         * Reject all tracked changes
         */
        rejectAll: function(options) {
            this._tracker.rejectAll(options);
            this._cleanup();
            this._editor.fire(LITE.Events.REJECT, {options: options});
        },
        /**
         * Set the name & id of the current user
         * @param info an object with the fields name, id
         */
        setUserInfo: function(info) {
            info = info || {};
            this._config.userId = String(info.id);
            this._config.userName = info.name || "";
            if (this._tracker) {
                this._tracker.setCurrentUser({id: this._config.userId, name: this._config.userName});
            }
            /*			if (this._editor) {
             var lite = this._editor.config.lite || {};
             this._editor.config.lite = lite;
             }; */
        },
        /**
         * Return the count of pending changes
         * @param options optional list of user ids whose changes we include or exclude (only one of the two should be provided,
         * exclude has precdence).
         */
        countChanges: function(options) {
            return ((this._tracker && this._tracker.countChanges(options)) || 0);
        },
        enableAcceptReject: function(bEnable) {
            this._canAcceptReject = !!bEnable;
            this._onIceChange();
        },
        /**
         * For the CKEditor content filtering system, not operational yet
         */
        filterIceElement: function(e) {
            if (!e) {
                return true;
            }
            try {
                if (e.hasClass(this.props.insertClass) || e.hasClass(this.props.deleteClass)) {
                    return false;
                }
            }
            catch (e) {
            }
            return true;
        },
        getCleanMarkup: function(text) {
            if (null === text || undefined === text) {
                text = (this._editor && this._editor.getData()) || "";
            }
            for (var i = _cleanRE.length - 1; i >= 0; --i) {
                text = text.replace(_cleanRE[i].regex, _cleanRE[i].replace);
            }
            return text;
        },
        getCleanText: function() {
            var root = this._getBody();
            if (!root) {
                return "";
            }
            var textFragments = new Array();
            textFragments.push("");
            var deleteClass = this._tracker.getDeleteClass();
            this._getCleanText(root, textFragments, deleteClass);
            var str = textFragments.join("\n");
            str = str.replace(/&nbsp(;)?/ig, ' ');
            return str;
        },
        _getCleanText: function(e, textFragments, deleteClass) { // assumed never to be called with a text node
            var cls = e.getAttribute("class");
            if (cls && cls.indexOf(deleteClass) >= 0) {
                return;
            }

            var isBlock;
            if (isBlock = ((e.nodeName && e.nodeName.toUpperCase() == "BR") || ("block" == jQuery(e).css("display")))) {
                if (_emptyRegex.test(textFragments[textFragments.length - 1])) {
                    textFragments[textFragments.length - 1] = "";
                }
                else {
                    textFragments.push("");
                }
            }
            for (var child = e.firstChild; child; child = child.nextSibling) {
                var nodeType = child.nodeType;
                if (3 == nodeType) {
                    textFragments[textFragments.length - 1] += String(child.nodeValue);
                }
                else if (1 == nodeType || 9 == nodeType || 11 == nodeType) {
                    this._getCleanText(child, textFragments, deleteClass);
                }
            }
            if (isBlock) {
                textFragments.push("");
            }
        },
        _onDomLoaded: function(dom) {
            this._domLoaded = true;
            this._editor = dom.editor;
            this._onReady();
        },
        _onScriptsLoaded: function(completed, failed) {
            this._scriptsLoaded = true;
            this._onReady();
        },
        _loadCSS: function(doc) {
            var head = doc.getElementsByTagName("head")[0];
            function load(path, id) {
                var style = jQuery(head).find('#' + id);
                if (!style.length) {
                    style = doc.createElement("link");
                    style.setAttribute("rel", "stylesheet");
                    style.setAttribute("type", "text/css");
                    style.setAttribute("id", id);
                    style.setAttribute("href", path);
                    head.appendChild(style);
                }
            }
            load(this.path + "css/lite.css", "__lite__css__");

            if (this._config.tooltips.cssPath) {
                load(this.path + this._config.tooltips.cssPath, "__lite_tt_css__");
            }
        },
        _onReady: function() {
            if (!this._scriptsLoaded || !this._domLoaded) {
                return;
            }
            // leave some time for initing, seems to help...
            setTimeout(this._afterReady.bind(this), 5);
        },
        _getBody: function() {
            try {
                return this._editor.editable().$;
            }
            catch (e) {
                return null;
            }
        },
        _afterReady: function() {
            var e = this._editor,
                    doc = e.document.$,
                    body = this._getBody(),
                    config = this._config;

            this._loadCSS(doc);

            if (!this._eventsBounds) {
                this._eventsBounds = true;
                var paste = this._onPaste.bind(this);
                e.on("afterCommandExec", this._onAfterCommand.bind(this));
                /*				e.on("beforeCommandExec", (function(event) {
                 var name = this._tracker && event.data && event.data.name;
                 }).bind(this)); */
                if (this._config.handlePaste) {
                    e.on("paste", paste, null, null, 1);
                }
                e.on("insertHtml", paste, null, null, 1);
                e.on("insertText", paste, null, null, 1);
                e.on("insertElement", paste, null, null, 1);
                e.on("mode", this._onModeChange.bind(this), null, null, 1);
                e.on("readOnly", this._onReadOnly.bind(this));
            }

            if (this._tracker) {
                if (body != this._tracker.getContentElement()) {
                    this._tracker.stopTracking(true);
                    jQuery(this._tracker).unbind();
                    this._tracker = null;
                }
            }

            if (null == this._tracker) {
                var iceprops = {
                    element: body,
                    isTracking: true,
                    handleEvents: true,
                    mergeBlocks: true,
                    currentUser: {
                        id: Drupal.settings.trackChanges.id || "",
                        name: Drupal.settings.trackChanges.name || ""
                    },
                    userStyles: config.userStyles,
                    changeTypes: {
                        insertType: {tag: this.props.insertTag, alias: this.props.insertClass, action: "Inserted"},
                        deleteType: {tag: this.props.deleteTag, alias: this.props.deleteClass, action: "Deleted"}
                    },
                    hostMethods: {
                        getHostRange: this._getHostRange.bind(this),
                        makeHostElement: function(node) {
                            return new CKEDITOR.dom.element(node);
                        },
                        setHostRange: this._setHostRange.bind(this)
                    },
                    tooltips: config.tooltips.show,
                    tooltipsDelay: config.tooltips.delay
                };
                if (config.tooltips.classPath) {
                    this._tooltipsHandler = new window[config.tooltips.classPath]();
                    if (!this._tooltipsHandler) {
                        this._logError("Unable to create tooltip handler", config.tooltips.classPath);
                    }
                    else {
                        this._tooltipsHandler.init(config.tooltips);
                        iceprops.hostMethods.showTooltip = this._showTooltip.bind(this);
                        iceprops.hostMethods.hideTooltip = this._hideTooltip.bind(this);
                    }
                }

                jQuery.extend(iceprops, this.props);
                this._tracker = new ice.InlineChangeEditor(iceprops);
                try {
                    this._tracker.startTracking();
                    this.toggleTracking(this._isTracking, false);
                    this._updateTrackingState();
                    jQuery(this._tracker).on("change", this._onIceChange.bind(this)).on("textChange", this._onIceTextChanged.bind(this));
                    e.fire(LITE.Events.INIT, {lite: this});
                    this._onSelectionChanged(null);
                    this._onIceChange(null);
                }
                catch (e) {
                    this._logError("ICE plugin init:", e);
                }
            }
        },
        _onToggleShow: function(event) {
            this.toggleShow();
        },
        _onToggleTracking: function(event) {
            this.toggleTracking();
        },
        _onRejectAll: function(event) {
            this.rejectAll();
        },
        _onAcceptAll: function(event) {
            this.acceptAll();
        },
        _onAcceptOne: function(event) {
            var node = this._tracker.currentChangeNode();
            if (node) {
                this._tracker.acceptChange(node);
                this._cleanup();
                this._editor.fire(LITE.Events.ACCEPT);
                this._onSelectionChanged(null);
            }
        },
        _onRejectOne: function(event) {
            var node = this._tracker.currentChangeNode();
            if (node) {
                this._tracker.rejectChange(node);
                this._cleanup();
                this._editor.fire(LITE.Events.REJECT);
                this._onSelectionChanged(null);
            }
        },
        _onToggleTooltips: function(event) {
            this._tracker && this._tracker.toggleTooltips();
        },
        /**
         * Clean up empty ICE elements
         * @private
         */
        _cleanup: function() {
            var body = this._getBody();
            empty = jQuery(body).find(self.insertSelector + ':empty,' + self.deleteSelector + ':empty');
            empty.remove();
            this._onSelectionChanged(null);
        },
        /**
         * Sets the title of a button
         * @private
         * @param button
         * @param title
         */
        _setButtonTitle: function(button, title) {
            var e = jQuery('#' + button._.id);
            e.attr('title', title);
        },
        /**
         * Called after the execution of a CKEDITOR command
         * @private
         * @param event
         */
        _onAfterCommand: function(event) {
            var name = this._tracker && this._isTracking && event.data && event.data.name;
            if ("undo" == name || "redo" == name) {
                this._tracker.reload();
            }
        },
        /**
         * Called after the mode of the editor (wysiwyg/source) changes
         * @private
         * @param evt
         */
        _onModeChange: function(evt) {
            this._updateTrackingState();
            setTimeout(this._onIceChange.bind(this), 0);
        },
        /**
         * Called after the readonly state of the editor changes
         * @private
         * @param evt
         */
        _onReadOnly: function(evt) {
            this._updateTrackingState();
        },
        /**
         * Recalculates the tracking state according to the tracking flag, editor mode and editor readonly
         * @private
         */
        _updateTrackingState: function() {
            if (this._tracker) {
                var track = this._isTracking && this._editor.mode == "wysiwyg" && !this._editor.readOnly;
                this._tracker.toggleChangeTracking(track);
                for (var i = this._removeBindings.length - 1; i >= 0; --i) {
                    this._removeBindings[i].removeListener();
                }
                this._removeBindings = [];
                if (track) {
                    this._removeBindings.push(this._editor.on("selectionChange", this._onSelectionChanged.bind(this)));
                }
            }
        },
        /**
         * Paste the content of the clipboard through ICE
         * @private
         */
        _onPaste: function(evt) {
            if (!this._tracker || !this._isTracking || !evt) {
                return true;
            }
            var data = evt.data || {},
                    ignore = false,
                    toInsert = null,
                    node = (evt.name == "insertElement") && data.$;
            if (!data) {
                return;
            }
            if (node) {
                ignore = node.getAttribute("data-track-changes-ignore");
            }
            else if (data.dataValue && "html" == (data.type || data.mode)) {
                try {
                    node = jQuery(data.dataValue);
                    ignore = node && node.attr("data-track-changes-ignore");
                }
                catch (e) {
                }
            }

            if (ignore) {
                return true;
            }
            //TODO check if we can just clean datavalue, call insert() and proceed
            if ("string" == typeof data.dataValue) {
                try {
                    var doc = this._editor.document.$,
                            container = doc.createElement("div");
                    container.innerHTML = String(data.dataValue);
                    container = this._tracker.getCleanDOM(container);
                    if (!container.innerHTML) {
                        return true;
                    }
                    toInsert = jQuery.makeArray(container.childNodes);
                }
                catch (e) {
                    this._logError("ice plugin paste:", e);
                }
            }
            else if (node) {
                toInsert = node;
            }
            else {
                return true;
            }
            if (toInsert) {
                this._beforeInsert();
                this._tracker.insert(toInsert);
                this._afterInsert();
            }
            evt.cancel();
            this._onIceTextChanged();
            return false;
        },
        /**
         * Set the state of multiple commands
         * @param commands An array of command names or a comma separated string
         * @private
         */
        _setCommandsState: function(commands, state) {
            if (typeof(commands) == "string") {
                commands = commands.split(",");
            }
            for (var i = commands.length - 1; i >= 0; --i) {
                var cmd = this._editor.getCommand(commands[i]);
                if (cmd) {
                    cmd.setState(state);
                }
            }
        },
        /**
         * Handler for selection change events (caret moved or text marked/unmarked)
         * @param event
         * @private
         */
        _onSelectionChanged: function(event) {
            var inChange = this._isTracking && this._tracker && this._tracker.isInsideChange();
            var state = inChange && this._canAcceptReject ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED;
            this._setCommandsState([LITE.Commands.ACCEPT_ONE, LITE.Commands.REJECT_ONE], state);
        },
        /**
         * called when ice fires a change event
         * @param e jquery event
         * @private
         */
        _onIceChange: function(e) {
            var hasChanges = this._isTracking && this._tracker && this._tracker.hasChanges();
            var state = hasChanges && this._canAcceptReject ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED;
            this._setCommandsState([LITE.Commands.ACCEPT_ALL, LITE.Commands.REJECT_ALL], state);
            this._onSelectionChanged();
            if (e) { //otherwise it's just a ui update
                this._triggerChange();
            }
        },
        /**
         * @ignore
         * @param e
         */
        _onIceTextChanged: function(e) {
            this._triggerChange();
        },
        /**
         * @ignore
         */
        _triggerChange: function() {
            if (!this._changeTimeout) {
                this._changeTimeout = setTimeout(this._boundNotifyChange, 1);
            }
        },
        /**
         * @ignore
         */
        _notifyChange: function() {
            this._changeTimeout = null;
            this._editor.fire('change');
        },
        /**
         * @ignore
         * @param command
         * @returns
         */
        _commandNameToUIName: function(command) {
            return command.replace(".", "_");
        },
        /**
         * @ignore
         * @param editor
         * @param props
         */

        _setPluginFeatures: function(editor, props) {
            if (!editor || !editor.filter || !editor.filter.addFeature) {
                return;
            }

            try {
                function makeClasses(tag) {
                    var classes = [props.deleteClass, props.insertClass];
                    for (var i = 0; i < 10; ++i) {
                        classes.push(props.stylePrefix + "-" + i);
                    }
                    return /*tag + */'(' + classes.join(',') + ')';
                }

                function makeAttributes(tag) {
                    //			allowedContent:'span[data-cid,data-time,data-userdata,data-userid,data-username,title]'
                    var attrs = ['title'];
                    for (var key in props.attributes) {
                        if (props.attributes.hasOwnProperty(key)) {
                            var value = props.attributes[key];
                            if ((typeof value == "string") && value.indexOf("data-") == 0) {
                                attrs.push(value);
                            }
                            ;
                        }
                        ;
                    }
                    ;
                    return /*tag + */'[' + attrs.join(',') + ']';
                }

                var features = [];

                if (props.insertTag) {
                    features.push(makeClasses(props.insertTag));
                    features.push(makeAttributes(props.insertTag));
                    editor.filter.addFeature({
                        name: "lite1",
                        allowedContent: props.insertTag + features.join("")
                    });
                }
                if (props.deleteTag && props.deleteTag != props.insertTag) {
                    features.push(makeClasses(props.deleteTag));
                    features.push(makeAttributes(props.deleteTag));
                    editor.filter.addFeature({
                        name: "lite2",
                        allowedContent: props.insertTag + features.join("")
                    });
                }

            }
            catch (e) {
                this._logError(e);
            }
        },
        /**
         * @ignore
         * @param range
         */
        _setHostRange: function(range) {
            var selection = this._editor && this._editor.getSelection();
            if (selection) {
                selection.selectRanges([range]);
            }
        },
        /**
         * @ignore
         * @returns {Boolean}
         */
        _getHostRange: function() {
            var selection = this._editor && this._editor.getSelection(),
                    ranges = selection && selection.getRanges(),
                    range = ranges && ranges[0];
            return range || null;
        },
        /**
         * @ignore
         * @param node
         * @param change
         */
        _showTooltip: function(node, change) {
            var config = this._config.tooltips;
            if (config.show && this._tooltipsHandler) {
                var title = this._makeTooltipTitle(change);
                this._tooltipsHandler.showTooltip(node, title);
            }
        },
        /**
         * @ignore
         * @param node
         */
        _hideTooltip: function(node) {
            if (this._tooltipsHandler) {
                this._tooltipsHandler.hideTooltip(node);
            }
        },
        /**
         * Copied from ckeditor
         * @ignore
         */
        _beforeInsert: function() {
            this._editor.fire('saveSnapshot');
        },
        /**
         * Copied from ckeditor
         * @ignore
         */
        _afterInsert: function( ) {
            var editor = this._editor;

            editor.getSelection().scrollIntoView();
            /*			setTimeout( function() {
             editor.fire( 'saveSnapshot' );
             }, 0 ); */
        },
        /**
         * @ignore
         */
        _logError: function() {
            var t = typeof console;
            if (t != "undefined" && console.error) {
                var args = Array.prototype.slice.apply(arguments);
                console.error(args.join(' '));
            }
        },
        /**
         * @ignore
         * @param change
         * @returns {Boolean}
         */		_makeTooltipTitle: function(change) {
            var title = this._config.tooltipTemplate || defaultTooltipTemplate;
            var time = new Date(change.time);
            title = title.replace(/%t/g, relativeDateFormat(time));
            title = title.replace(/%u/g, change.username);
            title = title.replace(/%dd/g, padNumber(time.getDate(), 2));
            title = title.replace(/%d/g, time.getDate());
            title = title.replace(/%mm/g, padNumber(time.getMonth() + 1, 2));
            title = title.replace(/%m/g, time.getMonth() + 1);
            title = title.replace(/%yy/g, padNumber(time.getYear() - 100, 2));
            title = title.replace(/%y/g, time.getFullYear());
            title = title.replace(/%nn/g, padNumber(time.getMinutes(), 2));
            title = title.replace(/%n/g, time.getMinutes());
            title = title.replace(/%hh/g, padNumber(time.getHours(), 2));
            title = title.replace(/%h/g, time.getHours());

            return title;
        }



    };

    function _ieFix() {
        /* Begin fixes for IE */
        Function.prototype.bind = Function.prototype.bind || function() {
            "use strict";
            var fn = this, args = Array.prototype.slice.call(arguments),
                    object = args.shift();
            return function() {
                return fn.apply(object,
                        args.concat(Array.prototype.slice.call(arguments)));
            };
        };

        /* Mozilla fix for MSIE indexOf */
        Array.prototype.indexOf = Array.prototype.indexOf || function(searchElement /*, fromIndex */) {
            "use strict";
            if (this == null) {
                throw new TypeError();
            }
            var t = Object(this);
            var len = t.length >>> 0;
            if (len === 0) {
                return -1;
            }
            var n = 0;
            if (arguments.length > 1) {
                n = Number(arguments[1]);
                if (n != n) { // shortcut for verifying if it's NaN
                    n = 0;
                } else if (n != 0 && n != Infinity && n != -Infinity) {
                    n = (n > 0 || -1) * Math.floo1r(Math.abs(n));
                }
            }
            if (n >= len) {
                return -1;
            }
            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
            for (; k < len; k++) {
                if (k in t && t[k] === searchElement) {
                    return k;
                }
            }
            return -1;
        };

        Array.prototype.lastIndexOf = Array.prototype.indexOf || function(searchElement) {
            "use strict";
            if (this == null) {
                throw new TypeError();
            }
            var t = Object(this);
            var len = t.length >>> 0;
            while (--len >= 0) {
                if (len in t && t[len] === searchElement) {
                    return len;
                }
            }
            return -1;
        };
    }
})();