/*!
 * jsxc v2.0.1 - 2015-05-23
 * 
 * Copyright (c) 2015 Klaus Herberth <klaus@jsxc.org> <br>
 * Released under the MIT license
 * 
 * Please see http://www.jsxc.org/
 * 
 * @author Klaus Herberth <klaus@jsxc.org>
 * @version 2.0.1
 * @license MIT
 */

/*! This file is concatenated for the browser. */

var jsxc = null, RTC = null, RTCPeerconnection = null;

(function($) {
   "use strict";

/**
 * JavaScript Xmpp Chat namespace
 * 
 * @namespace jsxc
 */
jsxc = {
   /** Version of jsxc */
   version: '2.0.1',

   /** True if i'm the master */
   master: false,

   /** True if the role allocation is finished */
   role_allocation: false,

   /** Timeout for keepalive */
   to: null,

   /** Timeout after normal keepalive starts */
   toBusy: null,

   /** Timeout for notification */
   toNotification: null,

   /** Timeout delay for notification */
   toNotificationDelay: 500,

   /** Interval for keep-alive */
   keepalive: null,

   /** True if last activity was 10 min ago */
   restore: false,

   /** True if restore is complete */
   restoreCompleted: false,

   /** True if login through box */
   triggeredFromBox: false,

   /** True if logout through element click */
   triggeredFromElement: false,

   /** True if logout through logout click */
   triggeredFromLogout: false,

   /** last values which we wrote into localstorage (IE workaround) */
   ls: [],

   /**
    * storage event is even fired if I write something into storage (IE
    * workaround) 0: conform, 1: not conform, 2: not shure
    */
   storageNotConform: null,

   /** Timeout for storageNotConform test */
   toSNC: null,

   /** My bar id */
   bid: null,

   /** Some constants */
   CONST: {
      NOTIFICATION_DEFAULT: 'default',
      NOTIFICATION_GRANTED: 'granted',
      NOTIFICATION_DENIED: 'denied',
      STATUS: [ 'offline', 'dnd', 'xa', 'away', 'chat', 'online' ],
      SOUNDS: {
         MSG: 'incomingMessage.wav',
         CALL: 'Rotary-Phone6.mp3',
         NOTICE: 'Ping1.mp3'
      },
      REGEX: {
         JID: new RegExp('\\b[^"&\'\\/:<>@\\s]+@[\\w-_.]+\\b', 'ig'),
         URL: new RegExp(/((?:https?:\/\/|www\.|([\w\-]+\.[a-zA-Z]{2,3})(?=\b))(?:(?:[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*\([\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*\)([\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|])?)|(?:[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|]))?)/gi)
      },
      NS: {
         CARBONS: 'urn:xmpp:carbons:2',
         FORWARD: 'urn:xmpp:forward:0'
      }
   },

   /**
    * Parse a unix timestamp and return a formatted time string
    * 
    * @memberOf jsxc
    * @param {Object} unixtime
    * @returns time of day and/or date
    */
   getFormattedTime: function(unixtime) {
      var msgDate = new Date(parseInt(unixtime));
      var date = ('0' + msgDate.getDate()).slice(-2);
      var month = ('0' + (msgDate.getMonth() + 1)).slice(-2);
      var year = msgDate.getFullYear();
      var hours = ('0' + msgDate.getHours()).slice(-2);
      var minutes = ('0' + msgDate.getMinutes()).slice(-2);
      var dateNow = new Date(), time = hours + ':' + minutes;

      // compare dates only
      dateNow.setHours(0, 0, 0, 0);
      msgDate.setHours(0, 0, 0, 0);

      if (dateNow.getTime() !== msgDate.getTime()) {
         return date + '.' + month + '.' + year + ' ' + time;
      }
      return time;
   },

   /**
    * Write debug message to console and to log.
    * 
    * @memberOf jsxc
    * @param {String} msg Debug message
    * @param {Object} data
    * @param {String} Could be warn|error|null
    */
   debug: function(msg, data, level) {
      if (level) {
         msg = '[' + level + '] ' + msg;
      }

      if (data) {
         if (jsxc.storage.getItem('debug') === true) {
            console.log(msg, data);
         }

         // try to convert data to string
         var d;
         try {
            // clone html snippet
            d = $("<span>").prepend($(data).clone()).html();
         } catch (err) {
            try {
               d = JSON.stringify(data);
            } catch (err2) {
               d = 'see js console';
            }
         }

         jsxc.log = jsxc.log + msg + ': ' + d + '\n';
      } else {
         console.log(msg);
         jsxc.log = jsxc.log + msg + '\n';
      }
   },

   /**
    * Write warn message.
    * 
    * @memberOf jsxc
    * @param {String} msg Warn message
    * @param {Object} data
    */
   warn: function(msg, data) {
      jsxc.debug(msg, data, 'WARN');
   },

   /**
    * Write error message.
    * 
    * @memberOf jsxc
    * @param {String} msg Error message
    * @param {Object} data
    */
   error: function(msg, data) {
      jsxc.debug(msg, data, 'ERROR');
   },

   /** debug log */
   log: '',

   /**
    * Starts the action
    * 
    * @memberOf jsxc
    * @param {object} options
    */
   init: function(options) {

      if (options) {
         // override default options
         $.extend(true, jsxc.options, options);
      }

      // Check localStorage
      if (typeof (localStorage) === 'undefined') {
         jsxc.warn("Browser doesn't support localStorage.");
         return;
      }

      /**
       * Getter method for options. Saved options will override default one.
       * 
       * @param {string} key option key
       * @returns default or saved option value
       */
      jsxc.options.get = function(key) {
         var local = jsxc.storage.getUserItem('options') || {};

         return local[key] || jsxc.options[key];
      };

      /**
       * Setter method for options. Will write into localstorage.
       * 
       * @param {string} key option key
       * @param {object} value option value
       */
      jsxc.options.set = function(key, value) {
         jsxc.storage.updateItem('options', key, value, true);
      };

      jsxc.storageNotConform = jsxc.storage.getItem('storageNotConform');
      if (jsxc.storageNotConform === null) {
         jsxc.storageNotConform = 2;
      }

      // detect language
      var lang;
      if (jsxc.storage.getItem('lang') !== null) {
         lang = jsxc.storage.getItem('lang');
      } else if (jsxc.options.autoLang && navigator.language) {
         lang = navigator.language.substr(0, 2);
      } else {
         lang = jsxc.options.defaultLang;
      }

      // initialize i18n translator
      $.i18n.init({
         lng: lang,
         fallbackLng: 'en',
         resStore: I18next,
         // use localStorage and set expiration to a day
         useLocalStorage: true,
         localStorageExpirationTime: 60 * 60 * 24 * 1000,
      });

      if (jsxc.storage.getItem('debug') === true) {
         jsxc.options.otr.debug = true;
      }

      // Register event listener for the storage event
      window.addEventListener('storage', jsxc.storage.onStorage, false);

      var lastActivity = jsxc.storage.getItem('lastActivity') || 0;

      if ((new Date()).getTime() - lastActivity < jsxc.options.loginTimeout) {
         jsxc.restore = true;
      }

      $(document).on('connectionReady.jsxc', function() {
         // Looking for logout element
          if (jsxc.options.logoutElement !== null && jsxc.options.logoutElement.length > 0) {
             var logout = function() {
                jsxc.options.logoutElement = $(this);
                jsxc.triggeredFromLogout = true;
                return jsxc.xmpp.logout();
             };

             jsxc.options.logoutElement.off('click', null, logout).one('click', logout);
          }
      });

      // Check if we have to establish a new connection
      if (!jsxc.storage.getItem('rid') || !jsxc.storage.getItem('sid') || !jsxc.restore) {

         // clean up rid and sid
         jsxc.storage.removeItem('rid');
         jsxc.storage.removeItem('sid');

         // Looking for a login form
         if (!jsxc.options.loginForm.form || !(jsxc.el_exists(jsxc.options.loginForm.form) && jsxc.el_exists(jsxc.options.loginForm.jid) && jsxc.el_exists(jsxc.options.loginForm.pass))) {

            if (jsxc.options.displayRosterMinimized()) {
               // Show minimized roster
               jsxc.storage.setUserItem('roster', 'hidden');
               jsxc.gui.roster.init();
               jsxc.gui.roster.noConnection();
            }

            return;
         }

         if (typeof jsxc.options.formFound === 'function') {
            jsxc.options.formFound.call();
         }

         // create jquery object
         var form = jsxc.options.loginForm.form = $(jsxc.options.loginForm.form);
         var events = form.data('events') || {
            submit: []
         };
         var submits = [];

         // save attached submit events and remove them. Will be reattached
         // in jsxc.submitLoginForm
         $.each(events.submit, function(index, val) {
            submits.push(val.handler);
         });

         form.data('submits', submits);
         form.off('submit');

         // Add jsxc login action to form
         form.submit(function() {

            var settings = jsxc.prepareLogin();

            if (settings !== false && (settings.xmpp.onlogin === "true" || settings.xmpp.onlogin === true)) {
               jsxc.options.loginForm.triggered = true;

               jsxc.xmpp.login();

               // Trigger submit in jsxc.xmpp.connected()
               return false;
            }

            return true;
         });

      } else {

         // Restore old connection

         jsxc.bid = jsxc.jidToBid(jsxc.storage.getItem('jid'));

         jsxc.gui.init();

         if (typeof (jsxc.storage.getItem('alive')) === 'undefined' || !jsxc.restore) {
            jsxc.onMaster();
         } else {
            jsxc.checkMaster();
         }
      }
   },

   /**
    * Load settings and prepare jid.
    * 
    * @memberOf jsxc
    * @returns Loaded settings
    */
   prepareLogin: function() {
      var username = $(jsxc.options.loginForm.jid).val();
      var password = $(jsxc.options.loginForm.pass).val();

      if (typeof jsxc.options.loadSettings !== 'function') {
         jsxc.error('No loadSettings function given. Abort.');
         return;
      }

      if (!jsxc.triggeredFromBox && (jsxc.options.loginForm.onConnecting === 'dialog' || typeof jsxc.options.loginForm.onConnecting === 'undefined')) {
        jsxc.gui.showWaitAlert($.t('Logging_in'));
      }

      var settings = jsxc.options.loadSettings.call(this, username, password);

      if (settings === false || settings === null || typeof settings === 'undefined') {
         jsxc.warn('No settings provided');

         return false;
      }

      // prevent to modify the original object
      settings = $.extend(true, {}, settings);

      if (typeof settings.xmpp.username === 'string') {
         username = settings.xmpp.username;
      }

      var resource = (settings.xmpp.resource) ? '/' + settings.xmpp.resource : '';
      var domain = settings.xmpp.domain;
      var jid;

      if (username.match(/@(.*)$/)) {
         jid = (username.match(/\/(.*)$/)) ? username : username + resource;
      } else {
         jid = username + '@' + domain + resource;
      }

      if (typeof jsxc.options.loginForm.preJid === 'function') {
         jid = jsxc.options.loginForm.preJid(jid);
      }

      jsxc.bid = jsxc.jidToBid(jid);

      settings.xmpp.username = jid.split('@')[0];
      settings.xmpp.domain = jid.split('@')[1].split('/')[0];
      settings.xmpp.resource = jid.split('@')[1].split('/')[1] || "";

      $.each(settings, function(key, val) {
         jsxc.options.set(key, val);
      });

      jsxc.options.xmpp.jid = jid;
      jsxc.options.xmpp.password = password;

      return settings;
   },

   /**
    * Called if the script is a slave
    */
   onSlave: function() {
      jsxc.debug('I am the slave.');

      jsxc.role_allocation = true;

      jsxc.restoreRoster();
      jsxc.restoreWindows();
      jsxc.restoreCompleted = true;

      $(document).trigger('restoreCompleted.jsxc');
   },

   /**
    * Called if the script is the master
    */
   onMaster: function() {
      jsxc.debug('I am master.');

      jsxc.master = true;

      // Init local storage
      jsxc.storage.setItem('alive', 0);
      jsxc.storage.setItem('alive_busy', 0);
      if (!jsxc.storage.getUserItem('windowlist')) {
         jsxc.storage.setUserItem('windowlist', []);
      }

      // Sending keepalive signal
      jsxc.startKeepAlive();

      if (jsxc.options.get('otr').enable) {
         // create or load DSA key and call _onMaster
         jsxc.otr.createDSA();
      } else {
         jsxc._onMaster();
      }
   },

   /**
    * Second half of the onMaster routine
    */
   _onMaster: function() {

      // create otr objects, if we lost the master
      if (jsxc.role_allocation) {
         $.each(jsxc.storage.getUserItem('windowlist'), function(index, val) {
            jsxc.otr.create(val);
         });
      }

      jsxc.role_allocation = true;

      if (jsxc.restore && !jsxc.restoreCompleted) {
         jsxc.restoreRoster();
         jsxc.restoreWindows();
         jsxc.restoreCompleted = true;

         $(document).trigger('restoreCompleted.jsxc');
      }

      // Prepare notifications
      if (jsxc.restore) {
         var noti = jsxc.storage.getUserItem('notification');
         noti = (typeof noti === 'number')? noti : 2;
         if (jsxc.options.notification && noti > 0 && jsxc.notification.hasSupport()) {
            if (jsxc.notification.hasPermission()) {
               jsxc.notification.init();
            } else {
               jsxc.notification.prepareRequest();
            }
         } else {
            // No support => disable
            jsxc.options.notification = false;
         }
      }

      $(document).on('connectionReady.jsxc', function() {
         jsxc.gui.updateAvatar($('#jsxc_avatar'), jsxc.jidToBid(jsxc.storage.getItem('jid')), 'own');
      });

      jsxc.xmpp.login();
   },

   /**
    * Checks if there is a master
    */
   checkMaster: function() {
      jsxc.debug('check master');

      jsxc.to = window.setTimeout(jsxc.onMaster, 1000);
      jsxc.storage.ink('alive');
   },

   /**
    * Start sending keep-alive signal
    */
   startKeepAlive: function() {
      jsxc.keepalive = window.setInterval(jsxc.keepAlive, jsxc.options.timeout - 1000);
   },

   /**
    * Sends the keep-alive signal to signal that the master is still there.
    */
   keepAlive: function() {
      jsxc.storage.ink('alive');

      if (jsxc.role_allocation) {
         jsxc.storage.setItem('lastActivity', (new Date()).getTime());
      }
   },

   /**
    * Send one keep-alive signal with higher timeout, and than resume with
    * normal signal
    */
   keepBusyAlive: function() {
      if (jsxc.toBusy) {
         window.clearTimeout(jsxc.toBusy);
      }

      if (jsxc.keepalive) {
         window.clearInterval(jsxc.keepalive);
      }

      jsxc.storage.ink('alive_busy');
      jsxc.toBusy = window.setTimeout(jsxc.startKeepAlive, jsxc.options.busyTimeout - 1000);
   },

   /**
    * Generates a random integer number between 0 and max
    * 
    * @param {Integer} max
    * @return {Integer} random integer between 0 and max
    */
   random: function(max) {
      return Math.floor(Math.random() * max);
   },

   /**
    * Checks if there is a element with the given selector
    * 
    * @param {String} selector jQuery selector
    * @return {Boolean}
    */
   el_exists: function(selector) {
      return $(selector).length > 0;
   },

   /**
    * Creates a CSS compatible string from a JID
    * 
    * @param {type} jid Valid Jabber ID
    * @returns {String} css Compatible string
    */
   jidToCid: function(jid) {
      jsxc.warn('jsxc.jidToCid is deprecated!');

      var cid = Strophe.getBareJidFromJid(jid).replace('@', '-').replace(/\./g, '-').toLowerCase();

      return cid;
   },

   /**
    * Create comparable bar jid.
    * 
    * @memberOf jsxc
    * @param jid
    * @returns comparable bar jid
    */
   jidToBid: function(jid) {
      return Strophe.getBareJidFromJid(jid).toLowerCase();
   },

   /**
    * Restore roster
    */
   restoreRoster: function() {
      var buddies = jsxc.storage.getUserItem('buddylist');

      if (!buddies || buddies.length === 0) {
         jsxc.debug('No saved buddylist.');

         jsxc.gui.roster.empty();

         return;
      }

      $.each(buddies, function(index, value) {
         jsxc.gui.roster.add(value);
      });

      jsxc.gui.roster.loaded = true;
      $(document).trigger('cloaded.roster.jsxc');
   },

   /**
    * Restore all windows
    */
   restoreWindows: function() {
      var windows = jsxc.storage.getUserItem('windowlist');

      if (windows === null) {
         return;
      }

      $.each(windows, function(index, bid) {
         var window = jsxc.storage.getUserItem('window', bid);

         if (!window) {
            jsxc.debug('Associated window-element is missing: ' + bid);
            return true;
         }

         jsxc.gui.window.init(bid);

         if (!window.minimize) {
            jsxc.gui.window.show(bid);
         } else {
            jsxc.gui.window.hide(bid);
         }

         jsxc.gui.window.setText(bid, window.text);
      });
   },

   /**
    * This method submits the specified login form.
    */
   submitLoginForm: function() {
      var form = jsxc.options.loginForm.form.off('submit');

      // Attach original events
      var submits = form.data('submits') || [];
      $.each(submits, function(index, val) {
         form.submit(val);
      });

      if (form.find('#submit').length > 0) {
         form.find('#submit').click();
      } else {
         form.submit();
      }
   },

   /**
    * Escapes some characters to HTML character
    */
   escapeHTML: function(text) {
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
   },

   /**
    * Removes all html tags.
    * 
    * @memberOf jsxc
    * @param text
    * @returns stripped text
    */
   removeHTML: function(text) {
      return $('<span>').html(text).text();
   },

   /**
    * Executes only one of the given events
    * 
    * @param {string} obj.key event name
    * @param {function} obj.value function to execute
    * @returns {string} namespace of all events
    */
   switchEvents: function(obj) {
      var ns = Math.random().toString(36).substr(2, 12);
      var self = this;

      $.each(obj, function(key, val) {
         $(document).one(key + '.' + ns, function() {
            $(document).off('.' + ns);

            val.apply(self, arguments);
         });
      });

      return ns;
   },

   /**
    * Checks if tab is hidden.
    * 
    * @returns {boolean} True if tab is hidden
    */
   isHidden: function() {
      var hidden = false;

      if (typeof document.hidden !== 'undefined') {
         hidden = document.hidden;
      } else if (typeof document.webkitHidden !== 'undefined') {
         hidden = document.webkitHidden;
      } else if (typeof document.mozHidden !== 'undefined') {
         hidden = document.mozHidden;
      } else if (typeof document.msHidden !== 'undefined') {
         hidden = document.msHidden;
      }

      // handle multiple tabs
      if (hidden && jsxc.master) {
         jsxc.storage.ink('hidden', 0);
      } else if (!hidden && !jsxc.master) {
         jsxc.storage.ink('hidden');
      }

      return hidden;
   },

   /**
    * Checks if tab has focus.
    *
    * @returns {boolean} True if tabs has focus
    */
   hasFocus: function() {
      var focus = true;

      if (typeof document.hasFocus === 'function') {
         focus = document.hasFocus();
      }

      if (!focus && jsxc.master) {
         jsxc.storage.ink('focus', 0);
      } else if (focus && !jsxc.master) {
         jsxc.storage.ink('focus');
      }

      return focus;
   },

   /**
    * Executes the given function in jsxc namespace.
    * 
    * @memberOf jsxc
    * @param {string} fnName Function name
    * @param {array} fnParams Function parameters
    * @returns Function return value
    */
   exec: function(fnName, fnParams) {
      var fnList = fnName.split('.');
      var fn = jsxc[fnList[0]];
      var i;
      for (i = 1; i < fnList.length; i++) {
         fn = fn[fnList[i]];
      }

      if (typeof fn === 'function') {
         return fn.apply(null, fnParams);
      }
   },
   
   /**
    * Hash string into 32-bit signed integer.
    * 
    * @memberOf jsxc
    * @param {string} str input string
    * @returns {integer} 32-bit signed integer
    */
   hashStr: function(str) {
      var hash = 0, i;

      if (str.length === 0) {
         return hash;
      }
      
      for (i = 0; i < str.length; i++) {
         hash  = ((hash << 5) - hash) + str.charCodeAt(i);
         hash |= 0; // Convert to 32bit integer
      }

      return hash;
   }
};

/**
 * Handle functions for chat window's and buddylist
 * 
 * @namespace jsxc.gui
 */
jsxc.gui = {
   /** Smilie token to file mapping */
   emotions: [ [ 'O:-) O:)', 'angel' ], [ '>:-( >:( &gt;:-( &gt;:(', 'angry' ], [ ':-) :)', 'smile' ], [ ':-D :D', 'grin' ], [ ':-( :(', 'sad' ], [ ';-) ;)', 'wink' ], [ ':-P :P', 'tonguesmile' ], [ '=-O', 'surprised' ], [ ':kiss: :-*', 'kiss' ], [ '8-) :cool:', 'sunglassess' ], [ ':\'-( :\'( :&amp;apos;-(', 'crysad' ], [ ':-/', 'doubt' ], [ ':-X :X', 'zip' ], [ ':yes:', 'thumbsup' ], [ ':no:', 'thumbsdown' ], [ ':beer:', 'beer' ], [ ':devil:', 'devil' ], [ ':kiss: :kissing:', 'kissing' ], [ '@->-- :rose: @-&gt;--', 'rose' ], [ ':music:', 'music' ], [ ':love:', 'love' ], [ ':zzz:', 'tired' ] ],

   /**
    * Different uri query actions as defined in XEP-0147.
    * 
    * @namespace jsxc.gui.queryActions
    */
   queryActions: {
      /** xmpp:JID?message[;body=TEXT] */
      message: function(jid, params) {
         var win = jsxc.gui.window.open(jsxc.jidToBid(jid));

         if (params && typeof params.body === 'string') {
            win.find('.jsxc_textinput').val(params.body);
         }
      },

      /** xmpp:JID?remove */
      remove: function(jid) {
         jsxc.gui.showRemoveDialog(jsxc.jidToBid(jid));
      },

      /** xmpp:JID?subscribe[;name=NAME] */
      subscribe: function(jid, params) {
         jsxc.gui.showContactDialog(jid);

         if (params && typeof params.name) {
            $('#jsxc_alias').val(params.name);
         }
      },

      /** xmpp:JID?vcard */
      vcard: function(jid) {
         jsxc.gui.showVcard(jid);
      }
   },

   /**
    * Creates application skeleton.
    * 
    * @memberOf jsxc.gui
    */
   init: function() {
      // Prevent duplicate windowList
      if ($('#jsxc_windowList').length > 0) {
         return;
      }

      $('body').append($(jsxc.gui.template.get('windowList')));

      $(window).resize(jsxc.gui.updateWindowListSB);
      $('#jsxc_windowList').resize(jsxc.gui.updateWindowListSB);

      $('#jsxc_windowListSB .jsxc_scrollLeft').click(function() {
         jsxc.gui.scrollWindowListBy(-200);
      });
      $('#jsxc_windowListSB .jsxc_scrollRight').click(function() {
         jsxc.gui.scrollWindowListBy(200);
      });
      $('#jsxc_windowList').on('wheel', function(ev) {
         if ($('#jsxc_windowList').data('isOver')) {
            jsxc.gui.scrollWindowListBy((ev.originalEvent.wheelDelta > 0) ? 200 : -200);
         }
      });

      jsxc.gui.tooltip('#jsxc_windowList');

      if (!jsxc.el_exists('#jsxc_roster')) {
         jsxc.gui.roster.init();
      }

      // prepare regexp for emotions
      $.each(jsxc.gui.emotions, function(i, val) {
         // escape characters
         var reg = val[0].replace(/(\/|\||\*|\.|\+|\?|\^|\$|\(|\)|\[|\]|\{|\})/g, '\\$1');
         reg = '(' + reg.split(' ').join('|') + ')';
         jsxc.gui.emotions[i][2] = new RegExp(reg, 'g');
      });

      // We need this often, so we creates some template jquery objects
      jsxc.gui.windowTemplate = $(jsxc.gui.template.get('chatWindow'));
      jsxc.gui.buddyTemplate = $(jsxc.gui.template.get('rosterBuddy'));
   },

   /**
    * Init tooltip plugin for given jQuery selector.
    * 
    * @param {String} selector jQuery selector
    * @memberOf jsxc.gui
    */
   tooltip: function(selector) {
      $(selector).tooltip({
         show: {
            delay: 600
         },
         content: function() {
            return $(this).attr('title').replace(/\n/g, '<br />');
         }
      });
   },

   /**
    * Updates Information in roster and chatbar
    * 
    * @param {String} bid bar jid
    */
   update: function(bid) {
      var data = jsxc.storage.getUserItem('buddy', bid);

      if (!data) {
         jsxc.debug('No data for ' + bid);
         return;
      }

      var ri = jsxc.gui.roster.getItem(bid); // roster item from user
      var we = jsxc.gui.window.get(bid); // window element from user
      var ue = ri.add(we); // both
      var spot = $('.jsxc_spot[data-bid="' + bid + '"]');

      // Attach data to corresponding roster item
      ri.data(data);

      // Add online status
      ue.add(spot).removeClass('jsxc_' + jsxc.CONST.STATUS.join(' jsxc_')).addClass('jsxc_' + jsxc.CONST.STATUS[data.status]);

      // Change name and add title
      ue.find('.jsxc_name:first').add(spot).text(data.name).attr('title', $.t('is') + ' ' + jsxc.CONST.STATUS[data.status]);

      // Update gui according to encryption state
      switch (data.msgstate) {
         case 0:
            we.find('.jsxc_transfer').removeClass('jsxc_enc jsxc_fin').attr('title', $.t('your_connection_is_unencrypted'));
            we.find('.jsxc_settings .jsxc_verification').addClass('jsxc_disabled');
            we.find('.jsxc_settings .jsxc_transfer').text($.t('start_private'));
            break;
         case 1:
            we.find('.jsxc_transfer').addClass('jsxc_enc').attr('title', $.t('your_connection_is_encrypted'));
            we.find('.jsxc_settings .jsxc_verification').removeClass('jsxc_disabled');
            we.find('.jsxc_settings .jsxc_transfer').text($.t('close_private'));
            break;
         case 2:
            we.find('.jsxc_settings .jsxc_verification').addClass('jsxc_disabled');
            we.find('.jsxc_transfer').removeClass('jsxc_enc').addClass('jsxc_fin').attr('title', $.t('your_buddy_closed_the_private_connection'));
            we.find('.jsxc_settings .jsxc_transfer').text($.t('close_private'));
            break;
      }

      // update gui according to verification state
      if (data.trust) {
         we.find('.jsxc_transfer').addClass('jsxc_trust').attr('title', $.t('your_buddy_is_verificated'));
      } else {
         we.find('.jsxc_transfer').removeClass('jsxc_trust');
      }

      // update gui according to subscription state
      if (data.sub && data.sub !== 'both') {
         ue.addClass('jsxc_oneway');
      } else {
         ue.removeClass('jsxc_oneway');
      }

      var info = '<b>' + Strophe.getBareJidFromJid(data.jid) + '</b>\n';
      info += $.t('Subscription') + ': ' + $.t(data.sub) + '\n';
      info += $.t('Status') + ': ' + $.t(jsxc.CONST.STATUS[data.status]);

      ri.find('.jsxc_name').attr('title', info);

      jsxc.gui.updateAvatar(ri.add(we.find('.jsxc_bar')), data.jid, data.avatar);
   },

   /**
    * Update avatar on all given elements.
    * 
    * @memberOf jsxc.gui
    * @param {jQuery} el Elements with subelement .jsxc_avatar
    * @param {string} jid Jid
    * @param {string} aid Avatar id (sha1 hash of image)
    */
   updateAvatar: function(el, jid, aid) {

      var setAvatar = function(src) {
         if (src === 0 || src === '0') {
            if (typeof jsxc.options.defaultAvatar === 'function') {
                jsxc.options.defaultAvatar.call(el, jid);
                return;
            }
            jsxc.gui.avatarPlaceholder(el.find('.jsxc_avatar'), jid);
            return;
         }

         el.find('.jsxc_avatar').removeAttr('style');

         el.find('.jsxc_avatar').css({
            'background-image': 'url(' + src + ')',
            'text-indent': '999px'
         });
      };
      
      if (typeof aid === 'undefined') {
         setAvatar(0);
         return;
      }
      
      var avatarSrc = jsxc.storage.getUserItem('avatar', aid);

      if (avatarSrc !== null) {
         setAvatar(avatarSrc);
      } else {
         jsxc.xmpp.conn.vcard.get(function(stanza) {
            jsxc.debug('vCard', stanza);

            var vCard = $(stanza).find("vCard > PHOTO");
            var src;

            if (vCard.length === 0) {
               jsxc.debug('No photo provided');
               src = '0';
            } else if (vCard.find('EXTVAL').length > 0) {
               src = vCard.find('EXTVAL').text();
            } else {
               var img = vCard.find('BINVAL').text();
               var type = vCard.find('TYPE').text();
               src = 'data:' + type + ';base64,' + img;
            }

            // concat chunks
            src = src.replace(/[\t\r\n\f]/gi, '');

            jsxc.storage.setUserItem('avatar', aid, src);
            setAvatar(src);
         }, Strophe.getBareJidFromJid(jid), function(msg) {
            jsxc.warn('Could not load vcard.', msg);

            jsxc.storage.setUserItem('avatar', aid, 0);
            setAvatar(0);
         });
      }
   },

   /**
    * Updates scrollbar handlers.
    * 
    * @memberOf jsxc.gui
    */
   updateWindowListSB: function() {

      if ($('#jsxc_windowList>ul').width() > $('#jsxc_windowList').width()) {
         $('#jsxc_windowListSB > div').removeClass('jsxc_disabled');
      } else {
         $('#jsxc_windowListSB > div').addClass('jsxc_disabled');
         $('#jsxc_windowList>ul').css('right', '0px');
      }
   },

   /**
    * Scroll window list by offset.
    * 
    * @memberOf jsxc.gui
    * @param offset
    */
   scrollWindowListBy: function(offset) {

      var scrollWidth = $('#jsxc_windowList>ul').width();
      var width = $('#jsxc_windowList').width();
      var el = $('#jsxc_windowList>ul');
      var right = parseInt(el.css('right')) - offset;
      var padding = $("#jsxc_windowListSB").width();

      if (scrollWidth < width) {
         return;
      }

      if (right > 0) {
         right = 0;
      }

      if (right < width - scrollWidth - padding) {
         right = width - scrollWidth - padding;
      }

      el.css('right', right + 'px');
   },

   /**
    * Returns the window element
    * 
    * @param {String} bid
    * @returns {jquery} jQuery object of the window element
    */
   getWindow: function(bid) {
      jsxc.warn('jsxc.gui.getWindow is deprecated!');

      return jsxc.gui.window.get(bid);
   },

   /**
    * Toggle list with timeout, like menu or settings
    * 
    * @memberof jsxc.gui
    */
   toggleList: function() {
      var self = $(this);

      self.disableSelection();

      var ul = self.find('ul');
      var slideUp = null;

      slideUp = function() {
         ul.slideUp({
            complete: function() {
               self.removeClass('jsxc_opened');
            }
         });

         $('body').off('click', null, slideUp);
      };

      $(this).click(function() {

         if (ul.is(":hidden")) {
            // hide other lists
            $('body').click();
            $('body').one('click', slideUp);
         } else {
            $('body').off('click', null, slideUp);
         }

         ul.slideToggle();

         window.clearTimeout(ul.data('timer'));

         self.toggleClass('jsxc_opened');

         return false;
      }).mouseleave(function() {
         ul.data('timer', window.setTimeout(slideUp, 2000));
      }).mouseenter(function() {
         window.clearTimeout(ul.data('timer'));
      });
   },

   /**
    * Creates and show loginbox
    */
   showLoginBox: function() {
      // Set focus to password field
      $(document).on("complete.dialog.jsxc", function() {
         $('#jsxc_password').focus();
      });

      jsxc.gui.dialog.open(jsxc.gui.template.get('loginBox'));

      var alert = $('#jsxc_dialog').find('.jsxc_alert');
      alert.hide();

      $('#jsxc_dialog').find('form').submit(function(ev) {

         ev.preventDefault();

         $(this).find('button[data-jsxc-loading-text]').trigger('btnloading.jsxc');

         jsxc.options.loginForm.form = $(this);
         jsxc.options.loginForm.jid = $(this).find('#jsxc_username');
         jsxc.options.loginForm.pass = $(this).find('#jsxc_password');

         jsxc.triggeredFromBox = true;
         jsxc.options.loginForm.triggered = false;

         var settings = jsxc.prepareLogin();

         if (settings === false) {
            onAuthFail();
         } else {
            $(document).on('authfail.jsxc', onAuthFail);

            jsxc.xmpp.login();
         }
      });

      function onAuthFail() {
        alert.show();
        jsxc.gui.dialog.resize();

        $('#jsxc_dialog').find('button').trigger('btnfinished.jsxc');

        $('#jsxc_dialog').find('input').one('keypress', function() {
            alert.hide();
            jsxc.gui.dialog.resize();
        });
      }
   },

   /**
    * Creates and show the fingerprint dialog
    * 
    * @param {String} bid
    */
   showFingerprints: function(bid) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('fingerprintsDialog', bid));
   },

   /**
    * Creates and show the verification dialog
    * 
    * @param {String} bid
    */
   showVerification: function(bid) {

      // Check if there is a open dialog
      if ($('#jsxc_dialog').length > 0) {
         setTimeout(function() {
            jsxc.gui.showVerification(bid);
         }, 3000);
         return;
      }

      // verification only possible if the connection is encrypted
      if (jsxc.storage.getUserItem('buddy', bid).msgstate !== OTR.CONST.MSGSTATE_ENCRYPTED) {
         jsxc.warn('Connection not encrypted');
         return;
      }

      jsxc.gui.dialog.open(jsxc.gui.template.get('authenticationDialog', bid));

      // Add handler

      $('#jsxc_dialog > div:gt(0)').hide();
      $('#jsxc_dialog select').change(function() {
         $('#jsxc_dialog > div:gt(0)').hide();
         $('#jsxc_dialog > div:eq(' + $(this).prop('selectedIndex') + ')').slideDown({
            complete: function() {
               jsxc.gui.dialog.resize();
            }
         });
      });

      // Manual
      $('#jsxc_dialog > div:eq(1) a.creation').click(function() {
         if (jsxc.master) {
            jsxc.otr.objects[bid].trust = true;
         }

         jsxc.storage.updateUserItem('buddy', bid, 'trust', true);

         jsxc.gui.dialog.close();

         jsxc.storage.updateUserItem('buddy', bid, 'trust', true);
         jsxc.gui.window.postMessage(bid, 'sys', $.t('conversation_is_now_verified'));
         jsxc.gui.update(bid);
      });

      // Question
      $('#jsxc_dialog > div:eq(2) a.creation').click(function() {
         var div = $('#jsxc_dialog > div:eq(2)');
         var sec = div.find('#jsxc_secret2').val();
         var quest = div.find('#jsxc_quest').val();

         if (sec === '' || quest === '') {
            // Add information for the user which form is missing
            div.find('input[value=""]').addClass('jsxc_invalid').keyup(function() {
               if ($(this).val().match(/.*/)) {
                  $(this).removeClass('jsxc_invalid');
               }
            });
            return;
         }

         if (jsxc.master) {
            jsxc.otr.sendSmpReq(bid, sec, quest);
         } else {
            jsxc.storage.setUserItem('smp_' + bid, {
               sec: sec,
               quest: quest
            });
         }

         jsxc.gui.dialog.close();

         jsxc.gui.window.postMessage(bid, 'sys', $.t('authentication_query_sent'));
      });

      // Secret
      $('#jsxc_dialog > div:eq(3) .creation').click(function() {
         var div = $('#jsxc_dialog > div:eq(3)');
         var sec = div.find('#jsxc_secret').val();

         if (sec === '') {
            // Add information for the user which form is missing
            div.find('#jsxc_secret').addClass('jsxc_invalid').keyup(function() {
               if ($(this).val().match(/.*/)) {
                  $(this).removeClass('jsxc_invalid');
               }
            });
            return;
         }

         if (jsxc.master) {
            jsxc.otr.sendSmpReq(bid, sec);
         } else {
            jsxc.storage.setUserItem('smp_' + bid, {
               sec: sec,
               quest: null
            });
         }

         jsxc.gui.dialog.close();

         jsxc.gui.window.postMessage(bid, 'sys', $.t('authentication_query_sent'));
      });
   },

   /**
    * Create and show approve dialog
    * 
    * @param {type} from valid jid
    */
   showApproveDialog: function(from) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('approveDialog'), {
         'noClose': true
      });

      $('#jsxc_dialog .jsxc_their_jid').text(Strophe.getBareJidFromJid(from));

      $('#jsxc_dialog .jsxc_deny').click(function(ev) {
         ev.stopPropagation();

         jsxc.xmpp.resFriendReq(from, false);

         jsxc.gui.dialog.close();
      });

      $('#jsxc_dialog .jsxc_approve').click(function(ev) {
         ev.stopPropagation();

         var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(from));

         jsxc.xmpp.resFriendReq(from, true);

         // If friendship is not mutual show contact dialog
         if (!data || data.sub === 'from') {
            $(document).one('close.dialog.jsxc', function() {
               jsxc.gui.showContactDialog(from);
            });
         }

         jsxc.gui.dialog.close();
      });
   },

   /**
    * Create and show dialog to add a buddy
    * 
    * @param {string} [username] jabber id
    */
   showContactDialog: function(username) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('contactDialog'));

      // If we got a friendship request, we would display the username in our
      // response
      if (username) {
         $('#jsxc_username').val(username);
      }

      $('#jsxc_username').keyup(function() {
         if (typeof jsxc.options.getUsers === 'function') {
            var val = $(this).val();
            $('#jsxc_userlist').empty();

            if (val !== '') {
                jsxc.options.getUsers.call(this, val, function(list) {
                    $.each(list || {}, function(uid, displayname) {
                        var option = $('<option>');
                        option.attr('data-username', uid);
                        option.attr('data-alias', displayname);

                        option.attr('value', uid).appendTo('#jsxc_userlist');

                        if (uid !== displayname) {
                            option.clone().attr('value', displayname).appendTo('#jsxc_userlist');
                        }
                    });
                });
            }
         }
      });

      $('#jsxc_username').on('input', function() {
         var val = $(this).val();
         var option = $('#jsxc_userlist').find('option[data-username="' + val + '"], option[data-alias="' + val + '"]');

         if (option.length > 0) {
            $('#jsxc_username').val(option.attr('data-username'));
            $('#jsxc_alias').val(option.attr('data-alias'));
         }
      });

      $('#jsxc_dialog form').submit(function() {
         var username = $('#jsxc_username').val();
         var alias = $('#jsxc_alias').val();

         if (!username.match(/@(.*)$/)) {
            username += '@' + Strophe.getDomainFromJid(jsxc.storage.getItem('jid'));
         }

         // Check if the username is valid
         if (!username || !username.match(jsxc.CONST.REGEX.JID)) {
            // Add notification
            $('#jsxc_username').addClass('jsxc_invalid').keyup(function() {
               if ($(this).val().match(jsxc.CONST.REGEX.JID)) {
                  $(this).removeClass('jsxc_invalid');
               }
            });
            return false;
         }
         jsxc.xmpp.addBuddy(username, alias);

         jsxc.gui.dialog.close();

         return false;
      });
   },

   /**
    * Create and show dialog to remove a buddy
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   showRemoveDialog: function(bid) {

      jsxc.gui.dialog.open(jsxc.gui.template.get('removeDialog', bid));

      var data = jsxc.storage.getUserItem('buddy', bid);

      $('#jsxc_dialog .creation').click(function(ev) {
         ev.stopPropagation();

         if (jsxc.master) {
            jsxc.xmpp.removeBuddy(data.jid);
         } else {
            // inform master
            jsxc.storage.setUserItem('deletebuddy', bid, {
               jid: data.jid
            });
         }

         jsxc.gui.dialog.close();
      });
   },

   /**
    * Create and show a wait dialog
    * 
    * @param {type} msg message to display to the user
    * @returns {undefined}
    */
   showWaitAlert: function(msg) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('waitAlert', null, msg), {
         'noClose': true
      });
   },

   /**
    * Create and show a wait dialog
    * 
    * @param {type} msg message to display to the user
    * @returns {undefined}
    */
   showAlert: function(msg) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('alert', null, msg));
   },

   /**
    * Create and show a auth fail dialog
    * 
    * @returns {undefined}
    */
   showAuthFail: function() {
      jsxc.gui.dialog.open(jsxc.gui.template.get('authFailDialog'));

      if (jsxc.options.loginForm.triggered !== false) {
         $('#jsxc_dialog .jsxc_cancel').hide();
      }

      $('#jsxc_dialog .creation').click(function() {
         jsxc.gui.dialog.close();
      });

      $('#jsxc_dialog .jsxc_cancel').click(function() {
         jsxc.submitLoginForm();
      });
   },

   /**
    * Create and show a confirm dialog
    * 
    * @param {String} msg Message
    * @param {function} confirm
    * @param {function} dismiss
    * @returns {undefined}
    */
   showConfirmDialog: function(msg, confirm, dismiss) {
      jsxc.gui.dialog.open(jsxc.gui.template.get('confirmDialog', null, msg), {
         noClose: true
      });

      if (confirm) {
         $('#jsxc_dialog .creation').click(confirm);
      }

      if (dismiss) {
         $('#jsxc_dialog .jsxc_cancel').click(dismiss);
      }
   },

   /**
    * Show about dialog.
    * 
    * @memberOf jsxc.gui
    */
   showAboutDialog: function() {
      jsxc.gui.dialog.open(jsxc.gui.template.get('aboutDialog'));

      $('#jsxc_dialog .jsxc_debuglog').click(function() {
         jsxc.gui.showDebugLog();
      });
   },

   /**
    * Show debug log.
    * 
    * @memberOf jsxc.gui
    */
   showDebugLog: function() {
      var userInfo = '<h3>User information</h3>';

      if (navigator) {
         var key;
         for (key in navigator) {
            if (navigator.hasOwnProperty(key) && typeof navigator[key] === 'string') {
               userInfo += '<b>' + key + ':</b> ' + navigator[key] + '<br />';
            }
         }
      }

      if (window.screen) {
         userInfo += '<b>Height:</b> ' + window.screen.height + '<br />';
         userInfo += '<b>Width:</b> ' + window.screen.width + '<br />';
      }

      userInfo += '<b>jsxc version:</b> ' + jsxc.version + '<br />';

      jsxc.gui.dialog.open('<div class="jsxc_log">' + userInfo + '<h3>Log</h3><pre>' + jsxc.escapeHTML(jsxc.log) + '</pre></div>');
   },

   /**
    * Show vCard of user with the given bar jid.
    * 
    * @memberOf jsxc.gui
    * @param {String} jid
    */
   showVcard: function(jid) {
      var bid = jsxc.jidToBid(jid);
      jsxc.gui.dialog.open(jsxc.gui.template.get('vCard', bid));

      var data = jsxc.storage.getUserItem('buddy', bid);

      if (data) {
         // Display resources and corresponding information
         var i, j, res, identities, identity = null, cap, client;
         for (i = 0; i < data.res.length; i++) {
            res = data.res[i];

            identities = [];
            cap = jsxc.xmpp.getCapabilitiesByJid(bid + '/' + res);

            if (cap !== null && cap.identities !== null) {
               identities = cap.identities;
            }

            client = '';
            for (j = 0; j < identities.length; j++) {
               identity = identities[j];
               if (identity.category === 'client') {
                  if (client !== '') {
                     client += ',\n';
                  }

                  client += identity.name + ' (' + identity.type + ')';
               }
            }

            var status = jsxc.storage.getUserItem('res', bid)[res];

            $('#jsxc_dialog ul.jsxc_vCard').append('<li class="jsxc_sep"><strong>' + $.t('Resource') + ':</strong> ' + res + '</li>');
            $('#jsxc_dialog ul.jsxc_vCard').append('<li><strong>' + $.t('Client') + ':</strong> ' + client + '</li>');
            $('#jsxc_dialog ul.jsxc_vCard').append('<li><strong>' + $.t('Status') + ':</strong> ' + $.t(jsxc.CONST.STATUS[status]) + '</li>');
         }
      }

      var printProp = function(el, depth) {
         var content = '';

         el.each(function() {
            var item = $(this);
            var children = $(this).children();

            content += '<li>';

            var prop = $.t(item[0].tagName);

            if (prop !== ' ') {
               content += '<strong>' + prop + ':</strong> ';
            }

            if (item[0].tagName === 'PHOTO') {

            } else if (children.length > 0) {
               content += '<ul>';
               content += printProp(children, depth + 1);
               content += '</ul>';
            } else if (item.text() !== '') {
               content += jsxc.escapeHTML(item.text());
            }

            content += '</li>';

            if (depth === 0 && $('#jsxc_dialog ul.jsxc_vCard').length > 0) {
               if ($('#jsxc_dialog ul.jsxc_vCard li.jsxc_sep:first').length > 0) {
                  $('#jsxc_dialog ul.jsxc_vCard li.jsxc_sep:first').before(content);
               } else {
                  $('#jsxc_dialog ul.jsxc_vCard').append(content);
               }
               content = '';
            }
         });

         if (depth > 0) {
            return content;
         }
      };

      var failedToLoad = function() {
         if ($('#jsxc_dialog ul.jsxc_vCard').length === 0) {
            return;
         }

         $('#jsxc_dialog p').remove();

         var content = '<p>';
         content += $.t('Sorry_your_buddy_doesnt_provide_any_information');
         content += '</p>';

         $('#jsxc_dialog').append(content);
      };

      jsxc.xmpp.loadVcard(bid, function(stanza) {

         if ($('#jsxc_dialog ul.jsxc_vCard').length === 0) {
            return;
         }

         $('#jsxc_dialog p').remove();

         var photo = $(stanza).find("vCard > PHOTO");

         if (photo.length > 0) {
            var img = photo.find('BINVAL').text();
            var type = photo.find('TYPE').text();
            var src = 'data:' + type + ';base64,' + img;

            if (photo.find('EXTVAL').length > 0) {
               src = photo.find('EXTVAL').text();
            }

            // concat chunks
            src = src.replace(/[\t\r\n\f]/gi, '');

            var img_el = $('<img class="jsxc_vCard" alt="avatar" />');
            img_el.attr('src', src);

            $('#jsxc_dialog h3').before(img_el);
         }

         if ($(stanza).find('vCard').length === 0 || ($(stanza).find('vcard > *').length === 1 && photo.length === 1)) {
            failedToLoad();
            return;
         }

         printProp($(stanza).find('vcard > *'), 0);

      }, failedToLoad);
   },

   showSettings: function() {
      jsxc.gui.dialog.open(jsxc.gui.template.get('settings'));

      if (jsxc.options.get('xmpp').overwrite === 'false' || jsxc.options.get('xmpp').overwrite === false) {
         $('.jsxc_fieldsetXmpp').hide();
      }

      $('#jsxc_dialog form').each(function() {
         var self = $(this);

         self.find('input[type!="submit"]').each(function() {
            var id = this.id.split("-");
            var prop = id[0];
            var key = id[1];
            var type = this.type;

            var data = jsxc.options.get(prop);

            if (data && typeof data[key] !== 'undefined') {
               if (type === 'checkbox') {
                  if (data[key] !== 'false' && data[key] !== false) {
                     this.checked = 'checked';
                  }
               } else {
                  $(this).val(data[key]);
               }
            }
         });
      });

      $('#jsxc_dialog form').submit(function() {

         var self = $(this);
         var data = {};

         self.find('input[type!="submit"]').each(function() {
            var id = this.id.split("-");
            var prop = id[0];
            var key = id[1];
            var val;
            var type = this.type;

            if (type === 'checkbox') {
               val = this.checked;
            } else {
               val = $(this).val();
            }

            if (!data[prop]) {
               data[prop] = {};
            }

            data[prop][key] = val;
         });

         $.each(data, function(key, val) {
            jsxc.options.set(key, val);
         });

         var err = jsxc.options.saveSettinsPermanent.call(this, data);

         if (typeof self.attr('data-onsubmit') === 'string') {
            jsxc.exec(self.attr('data-onsubmit'), [ err ]);
         }

         setTimeout(function() {
            self.find('input[type="submit"]').effect('highlight', {
               color: (err) ? 'green' : 'red'
            }, 4000);
         }, 200);

         return false;
      });
   },

   /**
    * Show prompt for notification permission.
    * 
    * @memberOf jsxc.gui
    */
   showRequestNotification: function() {

      jsxc.switchEvents({
         'notificationready.jsxc': function() {
            jsxc.gui.dialog.close();
            jsxc.notification.init();
            jsxc.storage.setUserItem('notification', 1);
         },
         'notificationfailure.jsxc': function() {
            jsxc.gui.dialog.close();
            jsxc.options.notification = false;
            jsxc.storage.setUserItem('notification', 0);
         }
      });

      jsxc.gui.showConfirmDialog($.t('Should_we_notify_you_'), function() {
         jsxc.gui.dialog.open(jsxc.gui.template.get('pleaseAccept'), {
            noClose: true
         });

         jsxc.notification.requestPermission();
      }, function() {
         $(document).trigger('notificationfailure.jsxc');
      });
   },

   showUnknownSender: function(bid) {
      var confirmationText = $.t('You_received_a_message_from_an_unknown_sender') + ' (' + bid + '). ' + $.t('Do_you_want_to_display_them');
      jsxc.gui.showConfirmDialog(confirmationText, function() {

         jsxc.gui.dialog.close();

         jsxc.storage.saveBuddy(bid, {
            jid: bid,
            name: bid,
            status: 0,
            sub: 'none',
            res: []
         });

         jsxc.gui.window.open(bid);

      }, function() {
         // reset state
         jsxc.storage.removeUserItem('chat', bid);
      });
   },

   /**
    * Change own presence to pres.
    * 
    * @memberOf jsxc.gui
    * @param pres {CONST.STATUS} New presence state
    * @param external {boolean} True if triggered from other tab.
    */
   changePresence: function(pres, external) {

      if (external !== true) {
         jsxc.storage.setUserItem('presence', pres);
      }

      if (jsxc.master) {
         jsxc.xmpp.sendPres();
      }

      $('#jsxc_presence > span').text($('#jsxc_presence > ul .jsxc_' + pres).text());

      jsxc.gui.updatePresence('own', pres);
   },

   /**
    * Update all presence objects for given user.
    * 
    * @memberOf jsxc.gui
    * @param bid bar jid of user.
    * @param {CONST.STATUS} pres New presence state.
    */
   updatePresence: function(bid, pres) {

      if (bid === 'own') {
         if (pres === 'dnd') {
            $('#jsxc_menu .jsxc_muteNotification').addClass('jsxc_disabled');
            jsxc.notification.muteSound(true);
         } else {
            $('#jsxc_menu .jsxc_muteNotification').removeClass('jsxc_disabled');

            if (!jsxc.options.get('muteNotification')) {
               jsxc.notification.unmuteSound(true);
            }
         }
      }

      $('.jsxc_presence[data-bid="' + bid + '"]').removeClass('jsxc_' + jsxc.CONST.STATUS.join(' jsxc_')).addClass('jsxc_' + pres);
   },

   /**
    * Switch read state to UNread.
    * 
    * @memberOf jsxc.gui
    * @param bid
    */
   unreadMsg: function(bid) {
      var win = jsxc.gui.window.get(bid);

      jsxc.gui.roster.getItem(bid).add(win).addClass('jsxc_unreadMsg');
      jsxc.storage.updateUserItem('window', bid, 'unread', true);
   },

   /**
    * Switch read state to read.
    * 
    * @memberOf jsxc.gui
    * @param bid
    */
   readMsg: function(bid) {
      var win = jsxc.gui.window.get(bid);

      if (win.hasClass('jsxc_unreadMsg')) {
         jsxc.gui.roster.getItem(bid).add(win).removeClass('jsxc_unreadMsg');
         jsxc.storage.updateUserItem('window', bid, 'unread', false);
      }
   },

   /**
    * This function searches for URI scheme according to XEP-0147.
    * 
    * @memberOf jsxc.gui
    * @param container In which element should we search?
    */
   detectUriScheme: function(container) {
      container = (container) ? $(container) : $('body');

      container.find("a[href^='xmpp:']").each(function() {

         var element = $(this);
         var href = element.attr('href').replace(/^xmpp:/, '');
         var jid = href.split('?')[0];
         var action, params = {};

         if (href.indexOf('?') < 0) {
            action = 'message';
         } else {
            var pairs = href.substring(href.indexOf('?') + 1).split(';');
            action = pairs[0];

            var i, key, value;
            for (i = 1; i < pairs.length; i++) {
               key = pairs[i].split('=')[0];
               value = (pairs[i].indexOf('=') > 0) ? pairs[i].substring(pairs[i].indexOf('=') + 1) : null;

               params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
         }

         if (typeof jsxc.gui.queryActions[action] === 'function') {
            element.addClass('jsxc_uriScheme jsxc_uriScheme_' + action);

            element.off('click').click(function(ev) {
               ev.stopPropagation();

               jsxc.gui.queryActions[action].call(jsxc, jid, params);

               return false;
            });
         }
      });
   },

   detectEmail: function(container) {
      container = (container) ? $(container) : $('body');

      container.find('a[href^="mailto:"]').each(function() {
         var spot = $("<span>X</span>").addClass("jsxc_spot");
         var href = $(this).attr("href").replace(/^ *mailto:/, "").trim();

         if (href !== '' && href !== Strophe.getBareJidFromJid(jsxc.storage.getItem("jid"))) {
            var bid = jsxc.jidToBid(href);
            var self = $(this);
            var s = self.prev();

            if (!s.hasClass('jsxc_spot')) {
               s = spot.clone().attr('data-bid', bid);

               self.before(s);
            }

            s.off('click');

            if (jsxc.storage.getUserItem('buddy', bid)) {
               jsxc.gui.update(bid);
               s.click(function() {
                  jsxc.gui.window.open(bid);

                  return false;
               });
            } else {
               s.click(function() {
                  jsxc.gui.showContactDialog(href);

                  return false;
               });
            }
         }
      });
   },
   
   avatarPlaceholder: function(el, seed, text) {
      text = text || seed;
      
      var options = jsxc.options.get('avatarplaceholder') || {};
      var hash = jsxc.hashStr(seed);

      var hue = Math.abs(hash) % 360;
      var saturation = options.saturation || 90;
      var lightness = options.lightness || 65;

      el.css({
        'background-color': 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)',
        'color': '#fff',
        'font-weight': 'bold',
        'text-align': 'center',
        'line-height': el.height() + 'px',
        'font-size': el.height() * 0.6 + 'px'
      });
      
      if (typeof text === 'string' && text.length > 0) {
        el.text(text[0].toUpperCase());
      }
   }
};

/**
 * Handle functions related to the gui of the roster
 * 
 * @namespace jsxc.gui.roster
 */
jsxc.gui.roster = {

   /** True if roster is initialised */ 
   ready: false,

   /** True if all items are loaded */
   loaded: false,

   /**
    * Init the roster skeleton
    * 
    * @memberOf jsxc.gui.roster
    * @returns {undefined}
    */
   init: function() {
      $(jsxc.options.rosterAppend + ':first').append($(jsxc.gui.template.get('roster')));

      if (jsxc.options.get('hideOffline')) {
         $('#jsxc_menu .jsxc_hideOffline').text($.t('Show_offline'));
         $('#jsxc_buddylist').addClass('jsxc_hideOffline');
      }

      $('#jsxc_menu .jsxc_settings').click(function() {
         jsxc.gui.showSettings();
      });

      $('#jsxc_menu .jsxc_hideOffline').click(function() {
         var hideOffline = !jsxc.options.get('hideOffline');

         if (hideOffline) {
            $('#jsxc_buddylist').addClass('jsxc_hideOffline');
         } else {
            $('#jsxc_buddylist').removeClass('jsxc_hideOffline');
         }

         $(this).text(hideOffline ? $.t('Show_offline') : $.t('Hide_offline'));

         jsxc.options.set('hideOffline', hideOffline);
      });

      if (jsxc.options.get('muteNotification')) {
         jsxc.notification.muteSound();
      }

      $('#jsxc_menu .jsxc_muteNotification').click(function() {

         if (jsxc.storage.getUserItem('presence') === 'dnd') {
            return;
         }

         // invert current choice
         var mute = !jsxc.options.get('muteNotification');

         if (mute) {
            jsxc.notification.muteSound();
         } else {
            jsxc.notification.unmuteSound();
         }
      });

      $('#jsxc_roster .jsxc_addBuddy').click(function() {
         jsxc.gui.showContactDialog();
      });

      $('#jsxc_roster .jsxc_onlineHelp').click(function() {
         window.open("http://www.jsxc.org/manual.html", "onlineHelp");
      });

      $('#jsxc_roster .jsxc_about').click(function() {
         jsxc.gui.showAboutDialog();
      });

      $('#jsxc_toggleRoster').click(function() {
         jsxc.gui.roster.toggle();
      });

      $('#jsxc_presence > ul > li').click(function() {
         var self = $(this);
         var pres = self.data('pres');

         if (pres === 'offline') {
            jsxc.xmpp.logout(false);
         } else {
            jsxc.gui.changePresence(pres);
         }
      });

      $('#jsxc_buddylist').slimScroll({
         distance: '3px',
         height: ($('#jsxc_roster').height() - 31) + 'px',
         width: $('#jsxc_buddylist').width() + 'px',
         color: '#fff',
         opacity: '0.5'
      });

      $('#jsxc_roster > .jsxc_bottom > div').each(function() {
         jsxc.gui.toggleList.call($(this));
      });

      if (jsxc.storage.getUserItem('roster') === 'hidden') {
         $('#jsxc_roster').css('right', '-200px');
         $('#jsxc_windowList > ul').css('paddingRight', '10px');
      }

      var pres = jsxc.storage.getUserItem('presence') || 'online';
      $('#jsxc_presence > span').text($('#jsxc_presence > ul .jsxc_' + pres).text());
      jsxc.gui.updatePresence('own', pres);

      jsxc.gui.tooltip('#jsxc_roster');

      jsxc.notice.load();

      jsxc.gui.roster.ready = true;
      $(document).trigger('ready.roster.jsxc');
   },

   /**
    * Create roster item and add it to the roster
    * 
    * @param {String} bid bar jid
    */
   add: function(bid) {
      var data = jsxc.storage.getUserItem('buddy', bid);
      var bud = jsxc.gui.buddyTemplate.clone().attr('data-bid', bid).attr('data-type', data.type || 'chat');

      jsxc.gui.roster.insert(bid, bud);

      bud.click(function() {
         jsxc.gui.window.open(bid);
      });

      bud.find('.jsxc_chaticon').click(function() {
         jsxc.gui.window.open(bid);
      });

      bud.find('.jsxc_rename').click(function() {
         jsxc.gui.roster.rename(bid);
         return false;
      });

      bud.find('.jsxc_delete').click(function() {
         jsxc.gui.showRemoveDialog(bid);
         return false;
      });

      var expandClick = function() {
         bud.trigger('extra.jsxc');

         bud.toggleClass('jsxc_expand');

         jsxc.gui.updateAvatar(bud, data.jid, data.avatar);
         return false;
      };

      bud.find('.jsxc_control').click(expandClick);
      bud.dblclick(expandClick);

      bud.find('.jsxc_vcardicon').click(function() {
         jsxc.gui.showVcard(data.jid);
         return false;
      });

      jsxc.gui.update(bid);

      // update scrollbar
      $('#jsxc_buddylist').slimScroll({
         scrollTo: '0px'
      });

      $(document).trigger('add.roster.jsxc', [ bid, data, bud ]);
   },

   getItem: function(bid) {
      return $("#jsxc_buddylist > li[data-bid='" + bid + "']");
   },

   /**
    * Insert roster item. First order: online > away > offline. Second order:
    * alphabetical of the name
    * 
    * @param {type} bid
    * @param {jquery} li roster item which should be insert
    * @returns {undefined}
    */
   insert: function(bid, li) {

      var data = jsxc.storage.getUserItem('buddy', bid);
      var listElements = $('#jsxc_buddylist > li');
      var insert = false;

      // Insert buddy with no mutual friendship to the end
      var status = (data.sub === 'both') ? data.status : -1;

      listElements.each(function() {

         var thisStatus = ($(this).data('sub') === 'both') ? $(this).data('status') : -1;

         if (($(this).data('name').toLowerCase() > data.name.toLowerCase() && thisStatus === status) || thisStatus < status) {

            $(this).before(li);
            insert = true;

            return false;
         }
      });

      if (!insert) {
         li.appendTo('#jsxc_buddylist');
      }
   },

   /**
    * Initiate reorder of roster item
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   reorder: function(bid) {
      jsxc.gui.roster.insert(bid, jsxc.gui.roster.remove(bid));
   },

   /**
    * Removes buddy from roster
    * 
    * @param {String} bid bar jid
    * @return {JQueryObject} Roster list element
    */
   remove: function(bid) {
      return jsxc.gui.roster.getItem(bid).detach();
   },

   /**
    * Removes buddy from roster and clean up
    * 
    * @param {String} bid bar compatible jid
    */
   purge: function(bid) {
      if (jsxc.master) {
         jsxc.storage.removeUserItem('buddy', bid);
         jsxc.storage.removeUserItem('otr', bid);
         jsxc.storage.removeUserItem('otr_version_' + bid);
         jsxc.storage.removeUserItem('chat', bid);
         jsxc.storage.removeUserItem('window', bid);
         jsxc.storage.removeUserElement('buddylist', bid);
         jsxc.storage.removeUserElement('windowlist', bid);
      }

      jsxc.gui.window._close(bid);
      jsxc.gui.roster.remove(bid);
   },

   /**
    * Create input element for rename action
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   rename: function(bid) {
      var name = jsxc.gui.roster.getItem(bid).find('.jsxc_name');
      var options = jsxc.gui.roster.getItem(bid).find('.jsxc_options, .jsxc_control');
      var input = $('<input type="text" name="name"/>');

      options.hide();
      name = name.replaceWith(input);

      input.val(name.text());
      input.keypress(function(ev) {
         if (ev.which !== 13) {
            return;
         }

         options.show();
         input.replaceWith(name);
         jsxc.gui.roster._rename(bid, $(this).val());

         $('html').off('click');
      });

      // Disable html click event, if click on input
      input.click(function() {
         return false;
      });

      $('html').one('click', function() {
         options.show();
         input.replaceWith(name);
         jsxc.gui.roster._rename(bid, input.val());
      });
   },

   /**
    * Rename buddy
    * 
    * @param {type} bid
    * @param {type} newname new name of buddy
    * @returns {undefined}
    */
   _rename: function(bid, newname) {
      if (jsxc.master) {
         var d = jsxc.storage.getUserItem('buddy', bid);
         
         if (d.type === 'chat') {
             var iq = $iq({
                type: 'set'
             }).c('query', {
                xmlns: 'jabber:iq:roster'
             }).c('item', {
                jid: Strophe.getBareJidFromJid(d.jid),
                name: newname
             });
             jsxc.xmpp.conn.sendIQ(iq);
         }
      }

      jsxc.storage.updateUserItem('buddy', bid, 'name', newname);
      jsxc.gui.update(bid);
   },

   /**
    * Toogle complete roster
    * 
    * @param {Integer} d Duration in ms
    */
   toggle: function(d) {
      var duration = d || 500;

      var roster = $('#jsxc_roster');
      var wl = $('#jsxc_windowList');

      var roster_width = roster.innerWidth();
      var roster_right = parseFloat($('#jsxc_roster').css('right'));
      var state = (roster_right < 0) ? 'shown' : 'hidden';

      jsxc.storage.setUserItem('roster', state);

      roster.animate({
         right: ((roster_width + roster_right) * -1) + 'px'
      }, duration);
      wl.animate({
         right: (10 - roster_right) + 'px'
      }, duration);

      $(document).trigger('toggle.roster.jsxc', [ state, duration ]);
   },

   /**
    * Shows a text with link to a login box that no connection exists.
    */
   noConnection: function() {
      $('#jsxc_roster').addClass('jsxc_noConnection');

      $('#jsxc_buddylist').empty();

      $('#jsxc_roster').append($('<p>' + $.t('no_connection') + '</p>').append(' <a>' + $.t('relogin') + '</a>').click(function() {
         jsxc.gui.showLoginBox();
      }));
   },

   /**
    * Shows a text with link to add a new buddy.
    * 
    * @memberOf jsxc.gui.roster
    */
   empty: function() {
      var text = $('<p>' + $.t('Your_roster_is_empty_add_a') + '</p>');
      var link = $('<a>' + $.t('new_buddy') + '</a>');

      link.click(function() {
         jsxc.gui.showContactDialog();
      });
      text.append(link);
      text.append('.');

      $('#jsxc_roster').prepend(text);
   }
};

/**
 * Wrapper for dialog
 * 
 * @namespace jsxc.gui.dialog
 */
jsxc.gui.dialog = {
   /**
    * Open a Dialog.
    * 
    * @memberOf jsxc.gui.dialog
    * @param {String} data Data of the dialog
    * @param {Object} [o] Options for the dialog
    * @param {Boolean} [o.noClose] If true, hide all default close options
    * @returns {jQuery} Dialog object
    */
   open: function(data, o) {

      var opt = o || {};

      // default options
      var options = {};
      options = {
         onComplete: function() {
            $('#jsxc_dialog .jsxc_close').click(function(ev) {
               ev.preventDefault();

               jsxc.gui.dialog.close();
            });

            // workaround for old colorbox version (used by firstrunwizard)
            if (options.closeButton === false) {
               $('#cboxClose').hide();
            }

            $('#jsxc_dialog form').each(function() {
                var form = $(this);

                form.find('button[data-jsxc-loading-text]').each(function(){
                    var btn = $(this);

                    btn.on('btnloading.jsxc', function(){
                        if(!btn.prop('disabled')) {
                            btn.prop('disabled', true);

                            btn.data('jsxc_value', btn.text());

                            btn.text(btn.attr('data-jsxc-loading-text'));
                        }
                    });

                    btn.on('btnfinished.jsxc', function() {
                        if(btn.prop('disabled')) {
                            btn.prop('disabled', false);

                            btn.text(btn.data('jsxc_value'));
                        }
                    });
                });
            });

            jsxc.gui.dialog.resize();

            $(document).trigger('complete.dialog.jsxc');
         },
         onClosed: function() {
            $(document).trigger('close.dialog.jsxc');
         },
         onCleanup: function() {
            $(document).trigger('cleanup.dialog.jsxc');
         },
         opacity: 0.5
      };

      if (opt.noClose) {
         options.overlayClose = false;
         options.escKey = false;
         options.closeButton = false;
         delete opt.noClose;
      }

      $.extend(options, opt);

      options.html = '<div id="jsxc_dialog">' + data + '</div>';

      $.colorbox(options);

      return $('#jsxc_dialog');
   },

   /**
    * Close current dialog.
    */
   close: function() {
      jsxc.debug('close dialog');
      $.colorbox.close();
   },

   /**
    * Resizes current dialog.
    * 
    * @param {Object} options e.g. width and height
    */
   resize: function(options) {
      options = $.extend({
        innerWidth: $('#jsxc_dialog').outerWidth(),
        innerHeight: $('#jsxc_dialog').outerHeight()
      }, options || {});
      
      $('#cboxLoadedContent').css('overflow', 'hidden');
      
      $.colorbox.resize(options);
   }
};

/**
 * Handle functions related to the gui of the window
 * 
 * @namespace jsxc.gui.window
 */
jsxc.gui.window = {
   /**
    * Init a window skeleton
    * 
    * @memberOf jsxc.gui.window
    * @param {String} bid
    * @returns {jQuery} Window object
    */
   init: function(bid) {
      if (jsxc.gui.window.get(bid).length > 0) {
         return jsxc.gui.window.get(bid);
      }

      var win = jsxc.gui.windowTemplate.clone().attr('data-bid', bid).hide().appendTo('#jsxc_windowList > ul').show('slow');
      var data = jsxc.storage.getUserItem('buddy', bid);

      // Attach jid to window
      win.data('jid', data.jid);

      // Add handler

      jsxc.gui.toggleList.call(win.find('.jsxc_settings'));

      win.find('.jsxc_verification').click(function() {
         jsxc.gui.showVerification(bid);
      });

      win.find('.jsxc_fingerprints').click(function() {
         jsxc.gui.showFingerprints(bid);
      });

      win.find('.jsxc_transfer').click(function() {
         jsxc.otr.toggleTransfer(bid);
      });

      win.find('.jsxc_bar').click(function() {
         jsxc.gui.window.toggle(bid);
      });

      win.find('.jsxc_close').click(function() {
         jsxc.gui.window.close(bid);
      });

      win.find('.jsxc_clear').click(function() {
         jsxc.gui.window.clear(bid);
      });

      win.find('.jsxc_tools').click(function() {
         return false;
      });

      win.find('.jsxc_textinput').keyup(function(ev) {
         var body = $(this).val();

         if (ev.which === 13) {
            body = '';
         }

         jsxc.storage.updateUserItem('window', bid, 'text', body);

         if (ev.which === 27) {
            jsxc.gui.window.close(bid);
         }
      }).keypress(function(ev) {
         if (ev.which !== 13 || !$(this).val()) {
            return;
         }

         jsxc.gui.window.postMessage(bid, 'out', $(this).val());

         $(this).val('');
      }).focus(function() {
         // remove unread flag
         jsxc.gui.readMsg(bid);
      }).mouseenter(function() {
         $('#jsxc_windowList').data('isOver', true);
      }).mouseleave(function() {
         $('#jsxc_windowList').data('isOver', false);
      });

      win.find('.jsxc_textarea').click(function() {
         // check if user clicks element or selects text
         if (typeof getSelection === 'function' && !getSelection().toString()) {
            win.find('.jsxc_textinput').focus();
         }
      });

      win.find('.jsxc_textarea').slimScroll({
         height: '234px',
         distance: '3px'
      });

      win.find('.jsxc_fade').hide();

      win.find('.jsxc_name').disableSelection();

      win.find('.slimScrollDiv').resizable({
         handles: 'w, nw, n',
         minHeight: 234,
         minWidth: 250,
         resize: function(event, ui) {
            win.width(ui.size.width);
            win.find('.jsxc_textarea').slimScroll({
               height: ui.size.height
            });
            var offset = win.find('.slimScrollDiv').position().top;
            win.find('.jsxc_emoticons').css('top', (ui.size.height + offset + 6) + 'px');

            $(document).trigger('resize.window.jsxc', [ win, bid, ui.size ]);
         }
      });

      if ($.inArray(bid, jsxc.storage.getUserItem('windowlist')) < 0) {

         // add window to windowlist
         var wl = jsxc.storage.getUserItem('windowlist');
         wl.push(bid);
         jsxc.storage.setUserItem('windowlist', wl);

         // init window element in storage
         jsxc.storage.setUserItem('window', bid, {
            minimize: true,
            text: '',
            unread: false
         });
      } else {

         if (jsxc.storage.getUserItem('window', bid).unread) {
            jsxc.gui.unreadMsg(bid);
         }
      }

      $.each(jsxc.gui.emotions, function(i, val) {
         var ins = val[0].split(' ')[0];
         var li = $('<li><div title="' + ins + '" class="jsxc_' + val[1] + '"/></li>');
         li.click(function() {
            win.find('input').val(win.find('input').val() + ins);
            win.find('input').focus();
         });
         win.find('.jsxc_emoticons ul').append(li);
      });

      jsxc.gui.toggleList.call(win.find('.jsxc_emoticons'));

      jsxc.gui.window.restoreChat(bid);

      jsxc.gui.update(bid);

      jsxc.gui.updateWindowListSB();

      // create related otr object
      if (jsxc.master && !jsxc.otr.objects[bid]) {
         jsxc.otr.create(bid);
      } else {
         jsxc.otr.enable(bid);
      }

      $(document).trigger('init.window.jsxc', [ win ]);

      return win;
   },

   /**
    * Returns the window element
    * 
    * @param {String} bid
    * @returns {jquery} jQuery object of the window element
    */
   get: function(id) {
      return $("li.jsxc_windowItem[data-bid='" + jsxc.jidToBid(id) + "']");
   },

   /**
    * Open a window, related to the bid. If the window doesn't exist, it will be
    * created.
    * 
    * @param {String} bid
    * @returns {jQuery} Window object
    */
   open: function(bid) {
      var win = jsxc.gui.window.init(bid);
      jsxc.gui.window.show(bid);
      jsxc.gui.window.highlight(bid);

      var padding = $("#jsxc_windowListSB").width();
      var innerWidth = $('#jsxc_windowList>ul').width();
      var outerWidth = $('#jsxc_windowList').width() - padding;

      if (innerWidth > outerWidth) {
         var offset = parseInt($('#jsxc_windowList>ul').css('right'));
         var width = win.outerWidth(true);

         var right = innerWidth - win.position().left - width + offset;
         var left = outerWidth - (innerWidth - win.position().left) - offset;

         if (left < 0) {
            jsxc.gui.scrollWindowListBy(left * -1);
         }

         if (right < 0) {
            jsxc.gui.scrollWindowListBy(right);
         }
      }

      return win;
   },

   /**
    * Close chatwindow and clean up
    * 
    * @param {String} bid bar jid
    */
   close: function(bid) {

      if (jsxc.gui.window.get(bid).length === 0) {
         jsxc.warn('Want to close a window, that is not open.');
         return;
      }

      jsxc.storage.removeUserElement('windowlist', bid);
      jsxc.storage.removeUserItem('window', bid);

      if (jsxc.storage.getUserItem('buddylist').indexOf(bid) < 0) {
         // delete data from unknown sender

         jsxc.storage.removeUserItem('buddy', bid);
         jsxc.storage.removeUserItem('chat', bid);
      }

      jsxc.gui.window._close(bid);
   },

   /**
    * Close chatwindow
    * 
    * @param {String} bid
    */
   _close: function(bid) {
      jsxc.gui.window.get(bid).hide('slow', function() {
         $(this).remove();

         jsxc.gui.updateWindowListSB();
      });
   },

   /**
    * Toggle between minimize and maximize of the text area
    * 
    * @param {String} bid bar jid
    */
   toggle: function(bid) {

      var win = jsxc.gui.window.get(bid);

      if (win.parents("#jsxc_windowList").length === 0) {
         return;
      }

      if (win.find('.jsxc_fade').is(':hidden')) {
         jsxc.gui.window.show(bid);
      } else {
         jsxc.gui.window.hide(bid);
      }

      jsxc.gui.updateWindowListSB();
   },

   /**
    * Maximize text area and save
    * 
    * @param {String} bid
    */
   show: function(bid) {

      jsxc.storage.updateUserItem('window', bid, 'minimize', false);

      jsxc.gui.window._show(bid);
   },

   /**
    * Maximize text area
    * 
    * @param {String} bid
    * @returns {undefined}
    */
   _show: function(bid) {
      var win = jsxc.gui.window.get(bid);
      jsxc.gui.window.get(bid).find('.jsxc_fade').slideDown();
      win.removeClass('jsxc_min');

      // If the area is hidden, the scrolldown function doesn't work. So we
      // call it here.
      jsxc.gui.window.scrollDown(bid);

      if (jsxc.restoreCompleted) {
         win.find('.jsxc_textinput').focus();
      }

      win.trigger('show.window.jsxc');
   },

   /**
    * Minimize text area and save
    * 
    * @param {String} bid
    */
   hide: function(bid) {
      jsxc.storage.updateUserItem('window', bid, 'minimize', true);

      jsxc.gui.window._hide(bid);
   },

   /**
    * Minimize text area
    * 
    * @param {String} bid
    */
   _hide: function(bid) {
      jsxc.gui.window.get(bid).addClass('jsxc_min').find(' .jsxc_fade').slideUp();

      jsxc.gui.window.get(bid).trigger('hidden.window.jsxc');
   },

   /**
    * Highlight window
    * 
    * @param {type} bid
    */
   highlight: function(bid) {
      var el = jsxc.gui.window.get(bid).find(' .jsxc_bar');

      if (!el.is(':animated')) {
         el.effect('highlight', {
            color: 'orange'
         }, 2000);
      }
   },

   /**
    * Scroll chat area to the bottom
    * 
    * @param {String} bid bar jid
    */
   scrollDown: function(bid) {
      var chat = jsxc.gui.window.get(bid).find('.jsxc_textarea');

      // check if chat exist
      if (chat.length === 0) {
         return;
      }

      chat.slimScroll({
         scrollTo: (chat.get(0).scrollHeight + 'px')
      });
   },

   /**
    * Write Message to chat area and save
    * 
    * @param {String} bid bar jid
    * @param {String} direction 'in' message is received or 'out' message is
    *        send
    * @param {String} msg Message to display
    * @param {boolean} encrypted Was this message encrypted? Default: false
    * @param {boolean} forwarded Was this message forwarded? Default: false
    * @param {integer} stamp Timestamp
    * @param {object} sender Information about sender
    * @property {string} sender.jid Sender Jid
    * @property {string} sender.name Sender name or nickname
    */
   postMessage: function(bid, direction, msg, encrypted, forwarded, stamp, sender) {
      var data = jsxc.storage.getUserItem('buddy', bid);
      var html_msg = msg;

      // remove html tags and reencode html tags
      msg = jsxc.removeHTML(msg);
      msg = jsxc.escapeHTML(msg);

      // exceptions:

      if (direction === 'out' && data.msgstate === OTR.CONST.MSGSTATE_FINISHED && forwarded !== true) {
         direction = 'sys';
         msg = $.t('your_message_wasnt_send_please_end_your_private_conversation');
      }

      if (direction === 'in' && data.msgstate === OTR.CONST.MSGSTATE_FINISHED) {
         direction = 'sys';
         msg = $.t('unencrypted_message_received') + ' ' + msg;
      }

      if (direction === 'out' && data.sub === 'from') {
         direction = 'sys';
         msg = $.t('your_message_wasnt_send_because_you_have_no_valid_subscription');
      }

      encrypted = encrypted || data.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED;
      var post = jsxc.storage.saveMessage(bid, direction, msg, encrypted, forwarded, stamp, sender);

      if (direction === 'in') {
         $(document).trigger('postmessagein.jsxc', [ bid, html_msg ]);
      }

      if (direction === 'out' && jsxc.master && forwarded !== true) {
         jsxc.xmpp.sendMessage(bid, html_msg, post.uid);
      }

      jsxc.gui.window._postMessage(bid, post);

      if (direction === 'out' && msg === '?') {
         jsxc.gui.window.postMessage(bid, 'sys', '42');
      }
   },

   /**
    * Write Message to chat area
    * 
    * @param {String} bid bar jid
    * @param {Object} post Post object with direction, msg, uid, received
    * @param {Bool} restore If true no highlights are used and so unread flag
    *        set
    */
   _postMessage: function(bid, post, restore) {
      var win = jsxc.gui.window.get(bid);
      var msg = post.msg;
      var direction = post.direction;
      var uid = post.uid;

      if (win.find('.jsxc_textinput').is(':not(:focus)') && jsxc.restoreCompleted && direction === 'in' && !restore) {
         jsxc.gui.window.highlight(bid);
      }

      msg = msg.replace(jsxc.CONST.REGEX.URL, function(url) {

         var href = (url.match(/^https?:\/\//i)) ? url : 'http://' + url;

         return '<a href="' + href + '" target="_blank">' + url + '</a>';
      });

      msg = msg.replace(new RegExp('(xmpp:)?(' + jsxc.CONST.REGEX.JID.source + ')(\\?[^\\s]+\\b)?', 'i'), function(match, protocol, jid, action) {
         if (protocol === 'xmpp:') {
            if (typeof action === 'string') {
               jid += action;
            }

            return '<a href="xmpp:' + jid + '">' + jid + '</a>';
         }

         return '<a href="mailto:' + jid + '" target="_blank">' + jid + '</a>';
      });

      $.each(jsxc.gui.emotions, function(i, val) {
         msg = msg.replace(val[2], function(match, p1) {

            // escape value for alt and title, this prevents double
            // replacement
            var esc = '', i;
            for (i = 0; i < p1.length; i++) {
               esc += '&#' + p1.charCodeAt(i) + ';';
            }

            return '<div title="' + esc + '" class="jsxc_emoticon jsxc_' + val[1] + '"/>';
         });
      });

      var msgDiv = $("<div>"), msgTsDiv = $("<div>");
      msgDiv.addClass('jsxc_chatmessage jsxc_' + direction);
      msgDiv.attr('id', uid);
      msgDiv.html('<div>' + msg + '</div>');
      msgTsDiv.addClass('jsxc_timestamp');
      msgTsDiv.text(jsxc.getFormattedTime(post.stamp));

      if (post.received || false) {
         msgDiv.addClass('jsxc_received');
      }

      if (post.forwarded) {
         msgDiv.addClass('jsxc_forwarded');
      }

      if (post.encrypted) {
         msgDiv.addClass('jsxc_encrypted');
      }

      if (direction === 'sys') {
         jsxc.gui.window.get(bid).find('.jsxc_textarea').append('<div style="clear:both"/>');
      } else if (typeof post.stamp !== 'undefined') {
         msgDiv.append(msgTsDiv);
      }
      
      win.find('.jsxc_textarea').append(msgDiv);
      
      if (typeof post.sender === 'object' && post.sender !== null) {
         var title = '';
         var avatarDiv = $('<div>');
         avatarDiv.addClass('jsxc_avatar').prependTo(msgDiv);

         if (typeof post.sender.jid === 'string') {
            msgDiv.attr('data-bid', jsxc.jidToBid(post.sender.jid));
            
            var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(post.sender.jid)) || {};
            jsxc.gui.updateAvatar(msgDiv, jsxc.jidToBid(post.sender.jid), data.avatar);

            title = jsxc.jidToBid(post.sender.jid);
         }
         
         if (typeof post.sender.name === 'string') {
            msgDiv.attr('data-name', post.sender.name);
            
            if (typeof post.sender.jid !== 'string') {
                jsxc.gui.avatarPlaceholder(avatarDiv, post.sender.name);
            }
            
            if (title !== '') {
                title = '\n' + title;
            }
            
            title = post.sender.name + title;
            
            msgTsDiv.text(msgTsDiv.text() + ' ' + post.sender.name);
         }
         
         avatarDiv.attr('title', jsxc.escapeHTML(title));
      }

      jsxc.gui.detectUriScheme(win);
      jsxc.gui.detectEmail(win);

      jsxc.gui.window.scrollDown(bid);

      // if window has no focus set unread flag
      if (!win.find('.jsxc_textinput').is(':focus') && jsxc.restoreCompleted && !restore) {
         jsxc.gui.unreadMsg(bid);
      }
   },

   /**
    * Set text into input area
    * 
    * @param {type} bid
    * @param {type} text
    * @returns {undefined}
    */
   setText: function(bid, text) {
      jsxc.gui.window.get(bid).find('.jsxc_textinput').val(text);
   },

   /**
    * Load old log into chat area
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   restoreChat: function(bid) {
      var chat = jsxc.storage.getUserItem('chat', bid);

      while (chat !== null && chat.length > 0) {
         var c = chat.pop();
         jsxc.gui.window._postMessage(bid, c, true);
      }
   },

   /**
    * Clear chat history
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   clear: function(bid) {
      jsxc.storage.setUserItem('chat', bid, []);
      jsxc.gui.window.get(bid).find('.jsxc_textarea').empty();
   }
};

/**
 * Hold all HTML templates.
 * 
 * @namespace jsxc.gui.template
 */
jsxc.gui.template = {
   /**
    * Return requested template and replace all placeholder
    * 
    * @memberOf jsxc.gui.template;
    * @param {type} name template name
    * @param {type} bid
    * @param {type} msg
    * @returns {String} HTML Template
    */
   get: function(name, bid, msg) {

      // common placeholder
      var ph = {
         my_priv_fingerprint: jsxc.storage.getUserItem('priv_fingerprint') ? jsxc.storage.getUserItem('priv_fingerprint').replace(/(.{8})/g, '$1 ') : $.t('not_available'),
         my_jid: jsxc.storage.getItem('jid') || '',
         my_node: Strophe.getNodeFromJid(jsxc.storage.getItem('jid') || '') || '',
         root: jsxc.options.root,
         app_name: jsxc.options.app_name
      };

      // placeholder depending on bid
      if (bid) {
         var data = jsxc.storage.getUserItem('buddy', bid);

         $.extend(ph, {
            bid_priv_fingerprint: (data && data.fingerprint) ? data.fingerprint.replace(/(.{8})/g, '$1 ') : $.t('not_available'),
            bid_jid: bid,
            bid_name: (data && data.name) ? data.name : bid
         });
      }

      // placeholder depending on msg
      if (msg) {
         $.extend(ph, {
            msg: msg
         });
      }

      var ret = jsxc.gui.template[name];

      if (typeof (ret) === 'string') {
         // prevent 404
         ret = ret.replace(/\{\{root\}\}/g, ph.root);

         // convert to string
         ret = $('<div>').append($(ret).i18n()).html();

         // replace placeholders
         ret = ret.replace(/\{\{([a-zA-Z0-9_\-]+)\}\}/g, function(s, key) {
            return (typeof ph[key] === 'string') ? ph[key] : s;
         });

         return ret;
      }

      jsxc.debug('Template not available: ' + name);
      return name;
   },
   authenticationDialog: '<h3>Verification</h3>\
            <p data-i18n="Authenticating_a_buddy_helps_"></p>\
            <div>\
              <p data-i18n="[html]How_do_you_want_to_authenticate_your_buddy" style="margin:0px;"></p>\
              <select size="1">\
                <option data-i18n="Select_method"></option>\
                <option data-i18n="Manual"></option>\
                <option data-i18n="Question"></option>\
                <option data-i18n="Secret"></option>\
              </select>\
            </div>\
            <div style="display:none">\
              <p data-i18n="To_verify_the_fingerprint_" class=".jsxc_explanation"></p>\
              <p><strong data-i18n="Your_fingerprint"></strong><br />\
              <span style="text-transform:uppercase">{{my_priv_fingerprint}}</span></p>\
              <p><strong data-i18n="Buddy_fingerprint"></strong><br />\
              <span style="text-transform:uppercase">{{bid_priv_fingerprint}}</span></p><br />\
              <p class="jsxc_right"><a href="#" data-i18n="Close" class="jsxc_close button"></a> <a href="#" data-i18n="Compared" class="button creation"></a></p>\
            </div>\
            <div style="display:none">\
              <p data-i18n="To_authenticate_using_a_question_" class=".jsxc_explanation"></p>\
              <p><label for="jsxc_quest" data-i18n="Question"></label><input type="text" name="quest" id="jsxc_quest" /></p>\
              <p><label for="jsxc_secret2" data-i18n="Secret"></label><input type="text" name="secret2" id="jsxc_secret2" /></p>\
              <p class="jsxc_right"><a href="#" class="button jsxc_close" data-i18n="Close"></a> <a href="#" class="button creation" data-i18n="Ask"></a></p>\
            </div>\
            <div style="display:none">\
              <p class=".jsxc_explanation" data-i18n="To_authenticate_pick_a_secret_"></p>\
              <p><label for="jsxc_secret" data-i18n="Secret"></label><input type="text" name="secret" id="jsxc_secret" /></p>\
              <p class="jsxc_right"><a href="#" class="button jsxc_close" data-i18n="Close"></a> <a href="#" class="button creation" data-i18n="Compare"></a></p>\
            </div>',
   fingerprintsDialog: '<div>\
          <p class="jsxc_maxWidth" data-i18n="A_fingerprint_"></p>\
          <p><strong data-i18n="Your_fingerprint"></strong><br />\
          <span style="text-transform:uppercase">{{my_priv_fingerprint}}</span></p>\
          <p><strong data-i18n="Buddy_fingerprint"></strong><br />\
          <span style="text-transform:uppercase">{{bid_priv_fingerprint}}</span></p><br />\
          <p class="jsxc_right"><a href="#" class="button jsxc_close" data-i18n="Close"></a></p>\
        </div>',
   chatWindow: '<li class="jsxc_min jsxc_windowItem">\
            <div class="jsxc_window">\
                <div class="jsxc_bar">\
                     <div class="jsxc_avatar">☺</div>\
                     <div class="jsxc_tools">\
                           <div class="jsxc_settings">\
                               <ul>\
                                   <li class="jsxc_fingerprints jsxc_otr jsxc_disabled" data-i18n="Fingerprints"></li>\
                                   <li class="jsxc_verification" data-i18n="Authentication"></li>\
                                   <li class="jsxc_transfer jsxc_otr jsxc_disabled" data-i18n="start_private"></li>\
                                   <li class="jsxc_clear" data-i18n="clear_history"></li>\
                               </ul>\
                           </div>\
                           <div class="jsxc_transfer jsxc_otr jsxc_disabled"/>\
                           <div class="jsxc_close">×</div>\
                     </div>\
                     <div class="jsxc_name"/>\
                     <div class="jsxc_cycle"/>\
                </div>\
                <div class="jsxc_fade">\
                   <div class="jsxc_gradient"/>\
                   <div class="jsxc_textarea"/>\
                   <div class="jsxc_emoticons"><ul/></div>\
                   <input type="text" class="jsxc_textinput" data-i18n="[placeholder]Message"/>\
                </div>\
            </div>\
        </li>',
   roster: '<div id="jsxc_roster">\
           <ul id="jsxc_buddylist"></ul>\
           <div class="jsxc_bottom jsxc_presence" data-bid="own">\
              <div id="jsxc_avatar">\
                 <div class="jsxc_avatar">☺</div>\
              </div>\
              <div id="jsxc_menu">\
                 <span></span>\
                 <ul>\
                     <li class="jsxc_settings" data-i18n="Settings"></li>\
                     <li class="jsxc_muteNotification" data-i18n="Mute"></li>\
                     <li class="jsxc_addBuddy" data-i18n="Add_buddy"></li>\
                     <li class="jsxc_hideOffline" data-i18n="Hide_offline"></li>\
                     <li class="jsxc_onlineHelp" data-i18n="Online_help"></li>\
                     <li class="jsxc_about" data-i18n="About"></li>\
                 </ul>\
              </div>\
              <div id="jsxc_notice">\
                 <span></span>\
                 <ul></ul>\
              </div>\
              <div id="jsxc_presence">\
                 <span data-i18n="Online"></span>\
                 <ul>\
                     <li data-pres="online" class="jsxc_online" data-i18n="Online"></li>\
                     <li data-pres="chat" class="jsxc_chat" data-i18n="Chatty"></li>\
                     <li data-pres="away" class="jsxc_away" data-i18n="Away"></li>\
                     <li data-pres="xa" class="jsxc_xa" data-i18n="Extended_away"></li>\
                     <li data-pres="dnd" class="jsxc_dnd" data-i18n="dnd"></li>\
                     <li data-pres="offline" class="jsxc_offline" data-i18n="Offline"></li>\
                 </ul>\
              </div>\
           </div>\
           <div id="jsxc_toggleRoster"></div>\
       </div>',
   windowList: '<div id="jsxc_windowList">\
               <ul></ul>\
            </div>\
            <div id="jsxc_windowListSB">\
               <div class="jsxc_scrollLeft jsxc_disabled">&lt;</div>\
               <div class="jsxc_scrollRight jsxc_disabled">&gt;</div>\
            </div>',
   rosterBuddy: '<li>\
            <div class="jsxc_avatar">☺</div>\
            <div class="jsxc_control"></div>\
            <div class="jsxc_name"/>\
            <div class="jsxc_options jsxc_right">\
                <div class="jsxc_rename" data-i18n="[title]rename_buddy">✎</div>\
                <div class="jsxc_delete" data-i18n="[title]delete_buddy">✘</div>\
            </div>\
            <div class="jsxc_options jsxc_left">\
                <div class="jsxc_chaticon" data-i18n="[title]send_message"/>\
                <div class="jsxc_vcardicon" data-i18n="[title]get_info">i</div>\
            </div>\
        </li>',
   loginBox: '<h3 data-i18n="Login"></h3>\
        <form>\
            <p><label for="jsxc_username" data-i18n="Username"></label>\
               <input type="text" name="username" id="jsxc_username" required="required" value="{{my_node}}"/></p>\
            <p><label for="jsxc_password" data-i18n="Password"></label>\
               <input type="password" name="password" required="required" id="jsxc_password" /></p>\
            <div class="jsxc_alert jsxc_alert-warning" data-i18n="Sorry_we_cant_authentikate_"></div>\
            <div class="bottom_submit_section">\
                <button type="reset" class="jsxc_btn jsxc_close" name="clear" data-i18n="Cancel"/>\
                <button type="submit" class="jsxc_btn jsxc_btn-primary" name="commit" data-i18n="[data-jsxc-loading-text]Connecting...;Connect"/>\
            </div>\
        </form>',
   contactDialog: '<h3 data-i18n="Add_buddy"></h3>\
         <p class=".jsxc_explanation" data-i18n="Type_in_the_full_username_"></p>\
         <form>\
         <p><label for="jsxc_username" data-i18n="Username"></label>\
            <input type="text" name="username" id="jsxc_username" list="jsxc_userlist" pattern="^[^\\x22&\'\\/:<>@\\s]+(@[.\\-_\\w]+)?" required="required" /></p>\
         <datalist id="jsxc_userlist"></datalist>\
         <p><label for="jsxc_alias" data-i18n="Alias"></label>\
            <input type="text" name="alias" id="jsxc_alias" /></p>\
         <p class="jsxc_right">\
            <input class="button" type="submit" data-i18n="[value]Add" />\
         </p>\
         <form>',
   approveDialog: '<h3 data-i18n="Subscription_request"></h3>\
        <p><span data-i18n="You_have_a_request_from"></span><b class="jsxc_their_jid"></b>.</p>\
        <p class="jsxc_right"><a href="#" class="button jsxc_deny" data-i18n="Deny"></a> <a href="#" class="button creation jsxc_approve" data-i18n="Approve"></a></p>',
   removeDialog: '<h3 data-i18n="Remove_buddy"></h3>\
        <p class="jsxc_maxWidth" data-i18n="[html]You_are_about_to_remove_"></p>\
        <p class="jsxc_right"><a href="#" class="button jsxc_cancel jsxc_close" data-i18n="Cancel"></a> <a href="#" class="button creation" data-i18n="Remove"></a></p>',
   waitAlert: '<h3>{{msg}}</h3>\
        <p data-i18n="Please_wait"></p>\
        <p class="jsxc_center"><img src="{{root}}/img/loading.gif" alt="wait" width="32px" height="32px" /></p>',
   alert: '<h3 data-i18n="Alert"></h3>\
        <p>{{msg}}</p>\
        <p class="jsxc_right"><a href="#" data-i18n="Ok" class="button jsxc_close jsxc_cancel"></a></p>',
   authFailDialog: '<h3 data-i18n="Login_failed"></h3>\
        <p data-i18n="Sorry_we_cant_authentikate_"></p>\
        <p class="jsxc_right">\
            <a class="button jsxc_cancel" data-i18n="Continue_without_chat"></a>\
            <a class="button creation" data-i18n="Retry"></a>\
        </p>',
   confirmDialog: '<p>{{msg}}</p>\
        <p class="jsxc_right">\
            <a class="button jsxc_cancel jsxc_close" data-i18n="Dismiss"></a>\
            <a class="button creation" data-i18n="Confirm"></a>\
        </p>',
   pleaseAccept: '<p data-i18n="Please_accept_"></p>',
   aboutDialog: '<h3>JavaScript XMPP Chat</h3>\
         <p><b>Version: </b>' + jsxc.version + '<br />\
         <a href="http://jsxc.org/" target="_blank">www.jsxc.org</a></p>\
         <p><i>Released under the MIT license</i></p>\
         <p>Real-time chat app for {{app_name}} and more.<br />\
         Requires an external <a href="https://xmpp.org/xmpp-software/servers/" target="_blank">XMPP server</a>.</p>\
         <p><b>Credits: </b> <a href="http://www.beepzoid.com/old-phones/" target="_blank">David English (Ringtone)</a>,\
         <a href="https://soundcloud.com/freefilmandgamemusic/ping-1?in=freefilmandgamemusic/sets/free-notification-sounds-and" target="_blank">CameronMusic (Ping)</a></p>\
         <p class="jsxc_libraries"><b>Libraries: </b><a href="http://strophe.im/strophejs/">strophe.js</a> (multiple), <a href="https://github.com/strophe/strophejs-plugins">strophe.js/muc</a> (MIT), <a href="https://github.com/strophe/strophejs-plugins">strophe.js/disco</a> (MIT), <a href="https://github.com/strophe/strophejs-plugins">strophe.js/caps</a> (MIT), <a href="https://github.com/strophe/strophejs-plugins">strophe.js/vcard</a> (MIT), <a href="https://github.com/ESTOS/strophe.jingle">strophe.jingle</a> (MIT), <a href="https://github.com/neoatlantis/node-salsa20">Salsa20</a> (AGPL3), <a href="www.leemon.com">bigint</a> (public domain), <a href="code.google.com/p/crypto-js">cryptojs</a> (code.google.com/p/crypto-js/wiki/license), <a href="http://git.io/ee">eventemitter</a> (MIT), <a href="https://arlolra.github.io/otr/">otr.js</a> (MPL v2.0), <a href="http://i18next.com/">i18next</a> (MIT)</p>\
         <p class="jsxc_right"><a class="button jsxc_debuglog" href="#">Show debug log</a></p>',
   vCard: '<h3><span data-i18n="Info_about"></span> <span>{{bid_name}}</span></h3>\
         <ul class="jsxc_vCard"></ul>\
         <p><img src="{{root}}/img/loading.gif" alt="wait" width="32px" height="32px" /> <span data-i18n="Please_wait"></span>...</p>',
   settings: '<h3 data-i18n="User_settings"></h3>\
         <p></p>\
         <form>\
            <fieldset class="jsxc_fieldsetXmpp jsxc_fieldset">\
               <legend data-i18n="Login_options"></legend>\
               <label for="xmpp-url" data-i18n="BOSH_url"></label><input type="text" id="xmpp-url" readonly="readonly"/><br />\
               <label for="xmpp-username" data-i18n="Username"></label><input type="text" id="xmpp-username"/><br />\
               <label for="xmpp-domain" data-i18n="Domain"></label><input type="text" id="xmpp-domain"/><br />\
               <label for="xmpp-resource" data-i18n="Resource"></label><input type="text" id="xmpp-resource"/><br />\
               <label for="xmpp-onlogin" data-i18n="On_login"></label><input type="checkbox" id="xmpp-onlogin" /><br />\
               <input type="submit" data-i18n="[value]Save"/>\
            </fieldset>\
         </form>\
         <p></p>\
         <form>\
            <fieldset class="jsxc_fieldsetPriority jsxc_fieldset">\
               <legend data-i18n="Priority"></legend>\
               <label for="priority-online" data-i18n="Online"></label><input type="number" value="0" id="priority-online" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-chat" data-i18n="Chatty"></label><input type="number" value="0" id="priority-chat" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-away" data-i18n="Away"></label><input type="number" value="0" id="priority-away" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-xa" data-i18n="Extended_away"></label><input type="number" value="0" id="priority-xa" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-dnd" data-i18n="dnd"></label><input type="number" value="0" id="priority-dnd" min="-128" max="127" step="1" required="required"/><br />\
               <input type="submit" data-i18n="[value]Save"/>\
            </fieldset>\
         </form>\
         <p></p>\
         <form data-onsubmit="xmpp.carbons.refresh">\
            <fieldset class="jsxc_fieldsetCarbons jsxc_fieldset">\
               <legend data-i18n="Carbon_copy"></legend>\
               <label for="carbons-enable" data-i18n="Enable"></label><input type="checkbox" id="carbons-enable" /><br />\
               <input type="submit" data-i18n="[value]Save"/>\
            </fieldset>\
         </form>'
};

jsxc.gui.template.joinChat = '<h3 data-i18n="Join_chat"></h3>\
         <p class=".jsxc_explanation" data-i18n="muc_explanation"></p>\
         <p><label for="jsxc_server" data-i18n="Server"></label>\
            <input type="text" name="server" id="jsxc_server" required="required" readonly="readonly" /></p>\
         <p><label for="jsxc_room" data-i18n="Room"></label>\
            <input type="text" name="room" id="jsxc_room" autocomplete="off" list="jsxc_roomlist" required="required" pattern="^[^\\x22&\'\\/:<>@\\s]+" /></p>\
         <p class="jsxc_inputinfo jsxc_waiting jsxc_room" data-i18n="Rooms_are_loaded"></p>\
         <datalist id="jsxc_roomlist">\
            <p><label for="jsxc_roomlist_select"></label><select id="jsxc_roomlist_select"><option></option><option>workaround</option></select></p>\
         </datalist>\
         <p><label for="jsxc_nickname" data-i18n="Nickname"></label>\
            <input type="text" name="nickname" id="jsxc_nickname" /></p>\
         <p><label for="jsxc_password" data-i18n="Password"></label>\
            <input type="text" name="password" id="jsxc_password" /></p>\
         <div class="jsxc_msg"></div>\
         <p class="jsxc_right">\
            <span class="jsxc_warning"></span> <a href="#" class="button jsxc_close" data-i18n="Close"></a> <a href="#" class="button jsxc_continue" data-i18n="Continue"> <a href="#" class="button jsxc_join" data-i18n="Join"></a>\
         </p>';

/**
 * Implements Multi-User Chat (XEP-0045).
 * 
 * @namespace jsxc.muc
 */
jsxc.muc = {
   /** strophe connection */
   conn: null,

   /** some constants */
   CONST: {
      AFFILIATION: {
         ADMIN: 'admin',
         MEMBER: 'member',
         OUTCAST: 'outcast',
         OWNER: 'owner',
         NONE: 'none'
      },
      ROLE: {
         MODERATOR: 'moderator',
         PARTICIPANT: 'participant',
         VISITOR: 'visitor',
         NONE: 'none'
      },
      ROOMSTATE: {
         INIT: 0,
         ENTERED: 1,
         EXITED: 2,
         AWAIT_DESTRUCTION: 3,
         DESTROYED: 4
      }
   },

   /**
    * Initialize muc plugin.
    * 
    * @private
    * @memberof jsxc.muc
    * @param {object} o Options
    */
   init: function(o) {
      var self = jsxc.muc;
      self.conn = jsxc.xmpp.conn;

      var options = o || jsxc.options.get('muc');

      if (!options || typeof options.server !== 'string') {
         jsxc.debug('Discover muc service');

         // prosody does not response, if we send query before initial presence was send
         setTimeout(function() {
            self.conn.disco.items(Strophe.getDomainFromJid(self.conn.jid), null, function(items) {
               $(items).find('item').each(function() {
                  var jid = $(this).attr('jid');
                  var discovered = false;

                  self.conn.disco.info(jid, null, function(info) {
                     var mucFeature = $(info).find('feature[var="' + Strophe.NS.MUC + '"]');
                     var mucIdentity = $(info).find('identity[category="conference"][type="text"]');

                     if (mucFeature.length > 0 && mucIdentity.length > 0) {
                        jsxc.debug('muc service found', jid);

                        jsxc.options.set('muc', {
                           server: jid,
                           name: $(info).find('identity').attr('name')
                        });

                        discovered = true;

                        self.init();
                     }
                  });

                  return !discovered;
               });
            });
         }, 1000);

         return;
      }

      if (jsxc.gui.roster.ready) {
         self.initMenu();
      } else {
         $(document).one('ready.roster.jsxc', jsxc.muc.initMenu);
      }

      $(document).on('presence.jsxc', jsxc.muc.onPresence);
      $(document).on('error.presence.jsxc', jsxc.muc.onPresenceError);

      self.conn.addHandler(self.onGroupchatMessage, null, 'message', 'groupchat');
      self.conn.addHandler(self.onErrorMessage, null, 'message', 'error');
      self.conn.muc.roomNames = jsxc.storage.getUserItem('roomNames') || [];
   },

   /**
    * Add entry to menu.
    * 
    * @memberOf jsxc.muc
    */
   initMenu: function() {
      var li = $('<li>').attr('class', 'jsxc_joinChat').text($.t('Join_chat'));

      li.click(jsxc.muc.showJoinChat);

      $('#jsxc_menu ul').append(li);
   },

   /**
    * Open join dialog.
    * 
    * @memberOf jsxc.muc
    */
   showJoinChat: function() {
      var self = jsxc.muc;
      var dialog = jsxc.gui.dialog.open(jsxc.gui.template.get('joinChat'));

      // hide second step button
      dialog.find('.jsxc_join').hide();

      // display conference server
      dialog.find('#jsxc_server').val(jsxc.options.get('muc').server);

      // handle error response
      var error_handler = function(event, condition, room) {
         var msg;

         switch (condition) {
            case 'not-authorized':
               // password-protected room
               msg = $.t('A_password_is_required');
               break;
            case 'registration-required':
               // members-only room
               msg = $.t('You_are_not_on_the_member_list');
               break;
            case 'forbidden':
               // banned users
               msg = $.t('You_are_banned_from_this_room');
               break;
            case 'conflict':
               // nickname conflict
               msg = $.t('Your_desired_nickname_');
               break;
            case 'service-unavailable':
               // max users
               msg = $.t('The_maximum_number_');
               break;
            case 'item-not-found':
               // locked or non-existing room
               msg = $.t('This_room_is_locked_');
               break;
            case 'not-allowed':
               // room creation is restricted
               msg = $.t('You_are_not_allowed_to_create_');
               break;
            default:
               jsxc.warn('Unknown muc error condition: ' + condition);
               msg = $.t('Error') + ': ' + condition;
         }

         // clean up strophe.muc rooms
         var roomIndex = self.conn.muc.roomNames.indexOf(room);

         if (roomIndex > -1) {
            self.conn.muc.roomNames.splice(roomIndex, 1);
            delete self.conn.muc.rooms[room];
         }

         dialog.find('.jsxc_warning').text(msg);
      };

      $(document).on('error.muc.jsxc', error_handler);

      $(document).on('close.dialog.jsxc', function() {
         $(document).off('error.muc.jsxc', error_handler);
      });

      // load room list
      self.conn.muc.listRooms(jsxc.options.get('muc').server, function(stanza) {
         // workaround: chrome does not display dropdown arrow for dynamically filled datalists
         $('#jsxc_roomlist option:last').remove();

         $(stanza).find('item').each(function() {
            var r = $('<option>');
            var rjid = $(this).attr('jid').toLowerCase();
            var rnode = Strophe.getNodeFromJid(rjid);
            var rname = $(this).attr('name') || rnode;

            r.text(rname);
            r.attr('data-jid', rjid);
            r.attr('value', rnode);

            $('#jsxc_roomlist select').append(r);
         });

         var set = $(stanza).find('set[xmlns="http://jabber.org/protocol/rsm"]');

         if (set.length > 0) {
            var count = set.find('count').text() || '?';

            dialog.find('.jsxc_inputinfo').removeClass('jsxc_waiting').text($.t('Could_load_only', {
               count: count
            }));
         } else {
            dialog.find('.jsxc_inputinfo').hide();
         }
      }, function() {
         jsxc.warn('Could not load rooms');

         // room autocompletion is a comfort feature, so it is not necessary to inform the user
         dialog.find('.jsxc_inputinfo').hide();
      });

      dialog.find('#jsxc_nickname').attr('placeholder', Strophe.getNodeFromJid(self.conn.jid));

      dialog.find('.jsxc_continue').click(function(ev) {
         ev.preventDefault();

         var room = ($('#jsxc_room').val()) ? jsxc.jidToBid($('#jsxc_room').val()) : null;
         var nickname = $('#jsxc_nickname').val() || Strophe.getNodeFromJid(self.conn.jid);
         var password = $('#jsxc_password').val() || null;

         if (!room || !room.match(/^[^"&\'\/:<>@\s]+$/i)) {
            $('#jsxc_room').addClass('jsxc_invalid').keyup(function() {
               if ($(this).val()) {
                  $(this).removeClass('jsxc_invalid');
               }
            });
            return false;
         }

         if (!room.match(/@(.*)$/)) {
            room += '@' + jsxc.options.get('muc').server;
         }

         if (jsxc.xmpp.conn.muc.roomNames.indexOf(room) < 0) {
            // not already joined

            var discoReceived = function(roomName, subject) {
               // we received the room information

               jsxc.gui.dialog.resize();

               dialog.find('.jsxc_continue').hide();

               dialog.find('.jsxc_join').show().effect('highlight', {
                  color: 'green'
               }, 4000);

               dialog.find('.jsxc_join').click(function(ev) {
                  ev.preventDefault();

                  self.join(room, nickname, password, roomName, subject);

                  return false;
               });
            };

            dialog.find('.jsxc_msg').append($('<p>').text($.t('Loading_room_information')).addClass('jsxc_waiting'));
            jsxc.gui.dialog.resize();

            self.conn.disco.info(room, null, function(stanza) {
               dialog.find('.jsxc_msg').html('<p>' + $.t('This_room_is') + '</p>');

               var table = $('<table>');

               $(stanza).find('feature').each(function() {
                  var feature = $(this).attr('var');

                  if (feature !== '' && i18n.exists(feature)) {
                     var tr = $('<tr>');
                     $('<td>').text($.t(feature + '.keyword')).appendTo(tr);
                     $('<td>').text($.t(feature + '.description')).appendTo(tr);
                     tr.appendTo(table);
                  }
               });

               dialog.find('.jsxc_msg').append(table);

               var roomName = $(stanza).find('identity').attr('name');
               var subject = $(stanza).find('field[var="muc#roominfo_subject"]').attr('label');

               //@TODO display subject, number of occupants, etc.

               discoReceived(roomName, subject);
            }, function() {
               dialog.find('.jsxc_msg').empty();
               $('<p>').text($.t('Room_not_found_')).appendTo(dialog.find('.jsxc_msg'));

               discoReceived();
            });
         } else {
            dialog.find('.jsxc_warning').text($.t('You_already_joined_this_room'));
         }

         return false;
      });

      dialog.find('input').keydown(function(ev) {

         if (ev.which !== 13) {
            // reset messages and room information

            dialog.find('.jsxc_warning').empty();

            if (dialog.find('.jsxc_continue').is(":hidden")) {
               dialog.find('.jsxc_continue').show();
               dialog.find('.jsxc_join').hide().off('click');
               dialog.find('.jsxc_msg').empty();
               jsxc.gui.dialog.resize();
            }

            return;
         }

         if (!dialog.find('.jsxc_continue').is(":hidden")) {
            dialog.find('.jsxc_continue').click();
         } else {
            dialog.find('.jsxc_join').click();
         }
      });
   },

   /**
    * Join the given room.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {string} nickname Desired nickname
    * @param {string} [password] Password
    * @param {string} [roomName] Room alias
    * @param {string} [subject] Current subject
    */
   join: function(room, nickname, password, roomName, subject) {
      var self = jsxc.muc;

      jsxc.storage.setUserItem('buddy', room, {
         jid: room,
         name: roomName || room,
         sub: 'both',
         type: 'groupchat',
         state: self.CONST.ROOMSTATE.INIT,
         subject: subject
      });

      jsxc.xmpp.conn.muc.join(room, nickname, null, null, null, password);
   },

   /**
    * Leave given room.
    * 
    * @memberOf jsxc.muc 
    * @param {string} room Room jid
    */
   leave: function(room) {
      var self = jsxc.muc;
      var own = jsxc.storage.getUserItem('ownNicknames') || {};
      var data = jsxc.storage.getUserItem('buddy', room) || {};

      if (data.state === self.CONST.ROOMSTATE.ENTERED) {
         self.conn.muc.leave(room, own[room], function() {
            self.onExited(room);
         });
      } else {
         self.onExited(room);
      }
   },

   /**
    * Clean up after we exited a room.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    */
   onExited: function(room) {
      var self = jsxc.muc;
      var own = jsxc.storage.getUserItem('ownNicknames') || {};

      jsxc.storage.setUserItem('roomNames', self.conn.muc.roomNames);

      delete own[room];
      jsxc.storage.setUserItem('ownNicknames', own);
      jsxc.storage.removeUserItem('member', room);
      jsxc.storage.removeUserItem('chat', room);

      jsxc.gui.window.close(room);
      jsxc.gui.roster.purge(room);
   },

   /**
    * Destroy the given room.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {function} handler_cb Function to handle the successful destruction
    * @param {function} error_cb Function to handle an error
    */
   destroy: function(room, handler_cb, error_cb) {
      var self = jsxc.muc;

      jsxc.storage.updateUserItem('buddy', room, 'state', self.CONST.ROOMSTATE.AWAIT_DESTRUCTION);
      jsxc.gui.window.postMessage(room, 'sys', $.t('This_room_will_be_closed'));

      var iq = $iq({
         to: room,
         type: "set"
      }).c("query", {
         xmlns: Strophe.NS.MUC_OWNER
      }).c("destroy");

      jsxc.muc.conn.sendIQ(iq.tree(), handler_cb, error_cb);
   },

   /**
    * Close the given room. 
    * 
    * @memberOf jsxc.muc
    * @param room Room jid
    */
   close: function(room) {
      var self = jsxc.muc;
      var roomdata = jsxc.storage.getUserItem('buddy', room) || {};

      self.emptyMembers(room);

      var roomIndex = self.conn.muc.roomNames.indexOf(room);

      if (roomIndex > -1) {
         self.conn.muc.roomNames.splice(roomIndex, 1);
         delete self.conn.muc.rooms[room];
      }

      jsxc.storage.setUserItem('roomNames', self.conn.muc.roomNames);

      if (roomdata.state === self.CONST.ROOMSTATE.AWAIT_DESTRUCTION) {
         self.onExited(room);
      }

      roomdata.state = self.CONST.ROOMSTATE.DESTROYED;

      jsxc.storage.setUserItem('buddy', room, roomdata);
   },

   /**
    * Init group chat window.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param event Event
    * @param {jQuery} win Window object
    */
   initWindow: function(event, win) {
      var self = jsxc.muc;
      var data = win.data();
      var bid = jsxc.jidToBid(data.jid);
      var roomdata = jsxc.storage.getUserItem('buddy', bid);

      if (!jsxc.xmpp.conn) {
         $(document).one('connectionReady.jsxc', function() {
            self.initWindow(null, win);
         });
         return;
      }

      if (self.conn.muc.roomNames.indexOf(data.jid) < 0) {
         return;
      }

      win.addClass('jsxc_groupchat');

      var own = jsxc.storage.getUserItem('ownNicknames') || {};
      var ownNickname = own[bid];
      var mlIcon = $('<div class="jsxc_members"></div>');

      win.find('.jsxc_tools > .jsxc_transfer').after(mlIcon);

      var ml = $('<div class="jsxc_memberlist"><ul></ul></div>');
      win.find('.jsxc_fade').prepend(ml);

      ml.on('wheel', function(ev) {
         jsxc.muc.scrollMemberListBy(bid, (ev.originalEvent.wheelDelta > 0) ? 50 : -50);
      });

      // toggle member list
      var toggleMl = function(ev) {
         if (ev) {
            ev.preventDefault();
         }

         var slimOptions = {};
         var ul = ml.find('ul:first');
         var slimHeight = null;

         ml.toggleClass('jsxc_expand');

         if (ml.hasClass('jsxc_expand')) {
            $('body').click();
            $('body').one('click', toggleMl);

            ul.mouseleave(function() {
               ul.data('timer', window.setTimeout(toggleMl, 2000));
            }).mouseenter(function() {
               window.clearTimeout(ul.data('timer'));
            }).css('left', '0px');

            var maxHeight = win.find(".jsxc_textarea").height() * 0.8;
            var innerHeight = ml.find('ul').height() + 3;
            slimHeight = (innerHeight > maxHeight) ? maxHeight : innerHeight;

            slimOptions = {
               distance: '3px',
               height: slimHeight + 'px',
               width: '100%',
               color: '#fff',
               opacity: '0.5'
            };

            ml.css('height', slimHeight + 'px');
         } else {
            slimOptions = {
               destroy: true
            };

            ul.attr('style', '');
            ml.css('height', '');

            window.clearTimeout(ul.data('timer'));
            $('body').off('click', null, toggleMl);
            ul.off('mouseleave mouseenter');
         }

         ul.slimscroll(slimOptions);

         return false;
      };

      mlIcon.click(toggleMl);

      win.on('resize', function() {
         // update member list position
         jsxc.muc.scrollMemberListBy(bid, 0);
      });

      // update emoticon button
      setTimeout(function() {
         var top = win.find('.jsxc_emoticons').position().top + win.find('.slimScrollDiv').position().top;
         win.find('.jsxc_emoticons').css('top', top + 'px');
      }, 400);

      var destroy = $('<li>');
      destroy.text($.t('Destroy'));
      destroy.addClass('jsxc_destroy');
      destroy.hide();
      destroy.click(function() {
         self.destroy(bid);
      });

      win.find('.jsxc_settings ul').append(destroy);

      if (roomdata.state > self.CONST.ROOMSTATE.INIT) {
         var member = jsxc.storage.getUserItem('member', bid) || {};

         $.each(member, function(nickname, val) {
            self.insertMember(bid, nickname, val);

            if (nickname === ownNickname && val.affiliation === self.CONST.AFFILIATION.OWNER) {
               destroy.show();
            }
         });
      }

      var leave = $('<li>');
      leave.text($.t('Leave'));
      leave.addClass('jsxc_leave');
      leave.click(function() {
         self.leave(bid);
      });

      win.find('.jsxc_settings ul').append(leave);
   },

   /**
    * Triggered on incoming presence stanzas.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param event
    * @param {string} from Jid
    * @param {integer} status Online status between 0 and 5
    * @param {string} presence Presence stanza
    */
   onPresence: function(event, from, status, presence) {
      var self = jsxc.muc;
      var room = jsxc.jidToBid(from);
      var xdata = $(presence).find('x[xmlns^="' + Strophe.NS.MUC + '"]');

      if (self.conn.muc.roomNames.indexOf(room) < 0 || xdata.length === 0) {
         return true;
      }

      var res = Strophe.getResourceFromJid(from) || '';
      var nickname = Strophe.unescapeNode(res);
      var own = jsxc.storage.getUserItem('ownNicknames') || {};
      var member = jsxc.storage.getUserItem('member', room) || {};
      var codes = [];

      xdata.find('status').each(function() {
         var code = $(this).attr('code');

         jsxc.debug('[muc][code]', code);

         codes.push(code);
      });

      if (jsxc.gui.roster.getItem(room).length === 0) {
         // successfully joined

         jsxc.storage.setUserItem('roomNames', jsxc.xmpp.conn.muc.roomNames);

         // clean up
         jsxc.storage.removeUserItem('chat', room);
         member = {};

         var bl = jsxc.storage.getUserItem('buddylist');
         bl.push(room);
         jsxc.storage.setUserItem('buddylist', bl);

         jsxc.gui.roster.add(room);

         jsxc.gui.window.open(room);
         jsxc.gui.dialog.close();
      }

      var jid = xdata.find('item').attr('jid') || null;

      if (status === 0) {
         if (xdata.find('destroy').length > 0) {
            // room has been destroyed
            member = {};

            jsxc.gui.window.postMessage(room, 'sys', $.t('This_room_has_been_closed'));

            self.close(room);
         } else {
            delete member[nickname];

            self.removeMember(room, nickname);

            var newNickname = xdata.find('item').attr('nick');

            if (codes.indexOf('303') > -1 && newNickname) {
               // user changed his nickname

               newNickname = Strophe.unescapeNode(newNickname);

               // prevent to display enter message
               member[newNickname] = {};

               jsxc.gui.window.postMessage(room, 'sys', $.t('is_now_known_as', {
                  oldNickname: nickname,
                  newNickname: newNickname,
                  escapeInterpolation: true
               }));
            } else if (codes.length === 0 || (codes.length === 1 && codes.indexOf('110') > -1)) {
               // normal user exit
               jsxc.gui.window.postMessage(room, 'sys', $.t('left_the_building', {
                  nickname: nickname,
                  escapeInterpolation: true
               }));
            }
         }
      } else {
         // new member joined

         if (!member[nickname] && own[room]) {
            jsxc.gui.window.postMessage(room, 'sys', $.t('entered_the_room', {
               nickname: nickname,
               escapeInterpolation: true
            }));
         }

         member[nickname] = {
            jid: jid,
            status: status,
            roomJid: from,
            affiliation: xdata.find('item').attr('affiliation'),
            role: xdata.find('item').attr('role')
         };

         self.insertMember(room, nickname, member[nickname]);
      }

      jsxc.storage.setUserItem('member', room, member);

      $.each(codes, function(index, code) {
         // call code functions and trigger event

         if (typeof self.onStatus[code] === 'function') {
            self.onStatus[code].call(this, room, nickname, member[nickname] || {}, xdata);
         }

         $(document).trigger('status.muc.jsxc', [code, room, nickname, member[nickname] || {}, presence]);
      });

      return true;
   },

   /**
    * Handle group chat presence errors.
    * 
    * @memberOf jsxc.muc
    * @param event
    * @param {string} from Jid
    * @param {string} presence Presence stanza
    * @returns {Boolean} Returns true on success
    */
   onPresenceError: function(event, from, presence) {
      var self = jsxc.muc;
      var xdata = $(presence).find('x[xmlns="' + Strophe.NS.MUC + '"]');
      var room = jsxc.jidToBid(from);

      if (xdata.length === 0 || self.conn.muc.roomNames.indexOf(room) < 0) {
         return true;
      }

      var error = $(presence).find('error');
      var condition = error.children()[0].tagName;

      jsxc.debug('[muc][error]', condition);

      $(document).trigger('error.muc.jsxc', [condition, room]);

      return true;
   },

   /**
    * Handle status codes. Every function gets room jid, nickname, member data and xdata.
    * 
    * @memberOf jsxc.muc
    */
   onStatus: {
      /** Inform user that presence refers to itself */
      110: function(room, nickname, data) {
         var self = jsxc.muc;
         var own = jsxc.storage.getUserItem('ownNicknames') || {};

         own[room] = nickname;
         jsxc.storage.setUserItem('ownNicknames', own);

         if (data.affiliation === self.CONST.AFFILIATION.OWNER) {
            jsxc.gui.window.get(room).find('.jsxc_destroy').show();
         }

         var roomdata = jsxc.storage.getUserItem('buddy', room);

         if (roomdata.state === self.CONST.ROOMSTATE.INIT) {
            roomdata.state = self.CONST.ROOMSTATE.ENTERED;

            jsxc.storage.setUserItem('buddy', room, roomdata);
         }
      },
      /** Inform occupants that room logging is now enabled */
      170: function(room) {
         jsxc.gui.window.postMessage(room, 'sys', $.t('Room_logging_is_enabled'));
      },
      /** Inform user that a new room has been created */
      201: function(room) {
         var self = jsxc.muc;
         //@TODO let user choose between instant and reserved room

         self.conn.muc.createInstantRoom(room);
      },
      /** Inform user that he or she has been banned */
      301: function(room, nickname, data, xdata) {
         var own = jsxc.storage.getUserItem('ownNicknames') || {};

         if (own[room] === nickname) {
            jsxc.muc.close(room);
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_banned'));

            jsxc.muc.postReason(room, xdata);
         } else {
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_info_banned', {
               nickname: nickname,
               escapeInterpolation: true
            }));
         }
      },
      /** Inform user that he or she has been kicked */
      307: function(room, nickname, data, xdata) {
         var own = jsxc.storage.getUserItem('ownNicknames') || {};

         if (own[room] === nickname) {
            jsxc.muc.close(room);
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_kicked'));

            jsxc.muc.postReason(room, xdata);
         } else {
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_info_kicked', {
               nickname: nickname,
               escapeInterpolation: true
            }));
         }
      },
      /** Inform user that he or she is beeing removed from the room because of an affiliation change */
      321: function(room, nickname) {
         var own = jsxc.storage.getUserItem('ownNicknames') || {};

         if (own[room] === nickname) {
            jsxc.muc.close(room);
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_affiliation'));
         } else {
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_info_affiliation', {
               nickname: nickname,
               escapeInterpolation: true
            }));
         }
      },
      /** 
       * Inform user that he or she is beeing removed from the room because the room has been 
       * changed to members-only and the user is not a member
       */
      322: function(room, nickname) {
         var own = jsxc.storage.getUserItem('ownNicknames') || {};

         if (own[room] === nickname) {
            jsxc.muc.close(room);
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_membersonly'));
         } else {
            jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_info_membersonly', {
               nickname: nickname,
               escapeInterpolation: true
            }));
         }
      },
      /**
       * Inform user that he or she is beeing removed from the room because the MUC service
       * is being shut down 
       */
      332: function(room) {
         jsxc.muc.close(room);
         jsxc.gui.window.postMessage(room, 'sys', $.t('muc_removed_shutdown'));
      }
   },

   /**
    * Extract reason from xdata and if available post it to room.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {jQuery} xdata Xdata
    */
   postReason: function(room, xdata) {
      var actor = {
         name: xdata.find('actor').attr('nick'),
         jid: xdata.find('actor').attr('jid')
      };
      var reason = xdata.find('reason').text();

      if (reason !== '') {
         reason = $.t('Reason') + ': ' + reason;

         if (typeof actor.name === 'string' || typeof actor.jid === 'string') {
            jsxc.gui.window.postMessage(room, 'in', reason, false, false, null, actor);
         } else {
            jsxc.gui.window.postMessage(room, 'sys', reason);
         }
      }
   },

   /**
    * Insert member to room member list.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {string} nickname Nickname
    * @param {string} memberdata Member data
    */
   insertMember: function(room, nickname, memberdata) {
      var self = jsxc.muc;
      var win = jsxc.gui.window.get(room);
      var jid = memberdata.jid;
      var m = win.find('.jsxc_memberlist li[data-nickname="' + nickname + '"]');

      if (m.length === 0) {
         var title = jsxc.escapeHTML(nickname);

         m = $('<li><div class="jsxc_avatar"></div><div class="jsxc_name"/></li>');
         m.attr('data-nickname', nickname);

         win.find('.jsxc_memberlist ul').append(m);

         if (typeof jid === 'string') {
            m.find('.jsxc_name').text(jsxc.jidToBid(jid));
            m.attr('data-bid', jsxc.jidToBid(jid));
            title = title + '\n' + jsxc.jidToBid(jid);

            var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(jid));

            if (data !== null && typeof data === 'object') {
               jsxc.gui.updateAvatar(m, jsxc.jidToBid(jid), data.avatar);
            } else if (jsxc.jidToBid(jid) === jsxc.jidToBid(self.conn.jid)) {
               jsxc.gui.updateAvatar(m, jsxc.jidToBid(jid), 'own');
            }
         } else {
            m.find('.jsxc_name').text(nickname);

            jsxc.gui.avatarPlaceholder(m.find('.jsxc_avatar'), nickname);
         }

         m.attr('title', title);
      }
   },

   /**
    * Remove member from room member list.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {string} nickname Nickname
    */
   removeMember: function(room, nickname) {
      var win = jsxc.gui.window.get(room);
      var m = win.find('.jsxc_memberlist li[data-nickname="' + nickname + '"]');

      if (m.length > 0) {
         m.remove();
      }
   },

   /**
    * Scroll or update member list position.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    * @param {integer} offset =0: update position; >0: Scroll to left; <0: Scroll to right
    */
   scrollMemberListBy: function(room, offset) {
      var win = jsxc.gui.window.get(room);

      if (win.find('.jsxc_memberlist').hasClass('jsxc_expand')) {
         return;
      }

      var el = win.find('.jsxc_memberlist ul:first');
      var scrollWidth = el.width();
      var width = win.find('.jsxc_memberlist').width();
      var left = parseInt(el.css('left'));

      left = (isNaN(left)) ? 0 - offset : left - offset;

      if (scrollWidth < width || left > 0) {
         left = 0;
      } else if (left < width - scrollWidth) {
         left = width - scrollWidth;
      }

      el.css('left', left + 'px');
   },

   /**
    * Empty member list.
    * 
    * @memberOf jsxc.muc
    * @param {string} room Room jid
    */
   emptyMembers: function(room) {
      var win = jsxc.gui.window.get(room);

      win.find('.jsxc_memberlist').empty();

      jsxc.storage.setUserItem('member', room, {});
   },

   /**
    * Handle incoming group chat message.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param {string} message Message stanza
    * @returns {boolean} True on success
    */
   onGroupchatMessage: function(message) {
      var id = $(message).attr('id');

      if (jsxc.el_exists($('#' + id))) {
         // ignore own incoming messages
         return true;
      }

      var from = $(message).attr('from');
      var body = $(message).find('body:first').text();
      var room = jsxc.jidToBid(from);
      var nickname = Strophe.unescapeNode(Strophe.getResourceFromJid(from));

      if (body !== '') {
         var delay = $(message).find('delay[xmlns="urn:xmpp:delay"]');
         var stamp = (delay.length > 0) ? new Date(delay.attr('stamp')) : new Date();
         stamp = stamp.getTime();

         var member = jsxc.storage.getUserItem('member', room) || {};

         var sender = {};
         sender.name = nickname;

         if (member[nickname] && typeof member[nickname].jid === 'string') {
            sender.jid = member[nickname].jid;
         }

         jsxc.gui.window.postMessage(room, 'in', body, false, false, stamp, sender);
      }

      var subject = $(message).find('subject');

      if (subject.length > 0) {
         var roomdata = jsxc.storage.getUserItem('buddy', room);

         roomdata.subject = subject.text();

         jsxc.storage.setUserItem('buddy', room, roomdata);

         jsxc.gui.window.postMessage(room, 'sys', $.t('changed_subject_to', {
            nickname: nickname,
            subject: subject.text()
         }));
      }

      return true;
   },

   /**
    * Handle group chat error message.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param {string} message Message stanza
    */
   onErrorMessage: function(message) {
      var room = jsxc.jidToBid($(message).attr('from'));

      if (jsxc.gui.window.get(room).length === 0) {
         return true;
      }

      if ($(message).find('item-not-found').length > 0) {
         jsxc.gui.window.postMessage(room, 'sys', $.t('message_not_send_item-not-found'));
      } else if ($(message).find('forbidden').length > 0) {
         jsxc.gui.window.postMessage(room, 'sys', $.t('message_not_send_forbidden'));
      } else if ($(message).find('not-acceptable').length > 0) {
         jsxc.gui.window.postMessage(room, 'sys', $.t('message_not_send_not-acceptable'));
      } else {
         jsxc.gui.window.postMessage(room, 'sys', $.t('message_not_send'));
      }

      jsxc.debug('[muc] error message for ' + room, $(message).find('error')[0]);

      return true;
   },

   /**
    * Prepare group chat roster item.
    * 
    * @private
    * @memberOf jsxc.muc
    * @param event
    * @param {string} room Room jid
    * @param {object} data Room data
    * @param {jQuery} bud Roster item
    */
   onAddRoster: function(event, room, data, bud) {
      var self = jsxc.muc;

      if (data.type !== 'groupchat') {
         return;
      }

      bud.find('.jsxc_delete').off('click').click(function() {
         self.leave(room);
         return false;
      });
   }
};

$(document).on('init.window.jsxc', jsxc.muc.initWindow);
$(document).on('add.roster.jsxc', jsxc.muc.onAddRoster);

$(document).one('attached.jsxc', function() {
   jsxc.muc.init();
});

$(document).one('connected.jsxc', function() {
   jsxc.storage.removeUserItem('roomNames');
   jsxc.storage.removeUserItem('ownNicknames');
});

/**
 * This namespace handle the notice system.
 * 
 * @namspace jsxc.notice
 * @memberOf jsxc
 */
jsxc.notice = {
   /** Number of notices. */
   _num: 0,

   /**
    * Loads the saved notices.
    * 
    * @memberOf jsxc.notice
    */
   load: function() {
      // reset list
      $('#jsxc_notice ul li').remove();
      $('#jsxc_notice > span').text('');
      jsxc.notice._num = 0;

      var saved = jsxc.storage.getUserItem('notices') || [];
      var key = null;

      for (key in saved) {
         if (saved.hasOwnProperty(key)) {
            var val = saved[key];

            jsxc.notice.add(val.msg, val.description, val.fnName, val.fnParams, key);
         }
      }
   },

   /**
    * Add a new notice to the stack;
    * 
    * @memberOf jsxc.notice
    * @param msg Header message
    * @param description Notice description
    * @param fnName Function name to be called if you open the notice
    * @param fnParams Array of params for function
    * @param id Notice id
    */
   add: function(msg, description, fnName, fnParams, id) {
      var nid = id || Date.now();
      var list = $('#jsxc_notice ul');
      var notice = $('<li/>');

      notice.click(function() {
         jsxc.notice.remove(nid);

         jsxc.exec(fnName, fnParams);

         return false;
      });

      notice.text(msg);
      notice.attr('title', description || '');
      notice.attr('data-nid', nid);
      list.append(notice);

      $('#jsxc_notice > span').text(++jsxc.notice._num);

      if (!id) {
         var saved = jsxc.storage.getUserItem('notices') || {};
         saved[nid] = {
            msg: msg,
            description: description,
            fnName: fnName,
            fnParams: fnParams
         };
         jsxc.storage.setUserItem('notices', saved);

         jsxc.notification.notify(msg, description || '', null, true, jsxc.CONST.SOUNDS.NOTICE);
      }
   },

   /**
    * Removes notice from stack
    * 
    * @memberOf jsxc.notice
    * @param nid The notice id
    */
   remove: function(nid) {
      var el = $('#jsxc_notice li[data-nid=' + nid + ']');

      el.remove();
      $('#jsxc_notice > span').text(--jsxc.notice._num || '');

      var s = jsxc.storage.getUserItem('notices');
      delete s[nid];
      jsxc.storage.setUserItem('notices', s);
   },

   /**
    * Check if there is already a notice for the given function name.
    * 
    * @memberOf jsxc.notice
    * @param {string} fnName Function name
    * @returns {boolean} True if there is >0 functions with the given name
    */
   has: function(fnName) {
      var saved = jsxc.storage.getUserItem('notices') || [];
      var has = false;

      $.each(saved, function(index, val){
         if (val.fnName === fnName) {
            has = true;

            return false;
         }
      });

      return has;
   }
};

/**
 * This namespace handles the Notification API.
 * 
 * @namespace jsxc.notification
 */
jsxc.notification = {

   /** Current audio file. */
   audio: null,

   /**
    * Register notification on incoming messages.
    * 
    * @memberOf jsxc.notification
    */
   init: function() {
      $(document).on('postmessagein.jsxc', function(event, bid, msg) {
         msg = (msg.match(/^\?OTR/)) ? $.t('Encrypted_message') : msg;
         var data = jsxc.storage.getUserItem('buddy', bid);

         jsxc.notification.notify({
            title: $.t('New_message_from') + ' ' + data.name,
            msg: msg,
            soundFile: jsxc.CONST.SOUNDS.MSG,
            source: bid
         });
      });

      $(document).on('callincoming.jingle', function() {
         jsxc.notification.playSound(jsxc.CONST.SOUNDS.CALL, true, true);
      });

      $(document).on('accept.call.jsxc reject.call.jsxc', function() {
         jsxc.notification.stopSound();
      });
   },

   /**
    * Shows a pop up notification and optional play sound.
    * 
    * @param title Title
    * @param msg Message
    * @param d Duration
    * @param force Should message also shown, if tab is visible?
    * @param soundFile Playing given sound file
    * @param loop Loop sound file?
    * @param source Bid which triggered this notification
    */
   notify: function(title, msg, d, force, soundFile, loop, source) {
      if (!jsxc.options.notification || !jsxc.notification.hasPermission()) {
         return; // notifications disabled
      }

      var o;

      if (title !== null && typeof title === 'object') {
         o = title;
      } else {
         o = {
            title: title,
            msg: msg,
            duration: d,
            force: force,
            soundFile: soundFile,
            loop: loop,
            source: source
         };
      }

      if (jsxc.hasFocus() && !o.force) {
         return; // Tab is visible
      }

      var icon = o.icon || jsxc.options.root + '/img/XMPP_logo.png';

      if (typeof o.source === 'string') {
         var data = jsxc.storage.getUserItem('buddy', o.source);
         var src = jsxc.storage.getUserItem('avatar', data.avatar);

         if (typeof src === 'string' && src !== '0') {
            icon = src;
         }
      }

      jsxc.toNotification = setTimeout(function() {

         if (typeof o.soundFile === 'string') {
            jsxc.notification.playSound(o.soundFile, o.loop, o.force);
         }

         var popup = new Notification($.t(o.title), {
            body: $.t(o.msg),
            icon: icon
         });

         var duration = o.duration || jsxc.options.popupDuration;

         if (duration > 0) {
            setTimeout(function() {
               popup.close();
            }, duration);
         }
      }, jsxc.toNotificationDelay);
   },

   /**
    * Checks if browser has support for notifications and add on chrome to the
    * default api.
    * 
    * @returns {Boolean} True if the browser has support.
    */
   hasSupport: function() {
      if (window.webkitNotifications) {
         // prepare chrome

         window.Notification = function(title, opt) {
            var popup = window.webkitNotifications.createNotification(null, title, opt.body);
            popup.show();

            popup.close = function() {
               popup.cancel();
            };

            return popup;
         };

         var permission;
         switch (window.webkitNotifications.checkPermission()) {
            case 0:
               permission = jsxc.CONST.NOTIFICATION_GRANTED;
               break;
            case 2:
               permission = jsxc.CONST.NOTIFICATION_DENIED;
               break;
            default: // 1
               permission = jsxc.CONST.NOTIFICATION_DEFAULT;
         }
         window.Notification.permission = permission;

         window.Notification.requestPermission = function(func) {
            window.webkitNotifications.requestPermission(func);
         };

         return true;
      } else if (window.Notification) {
         return true;
      } else {
         return false;
      }
   },

   /**
    * Ask user on first incoming message if we should inform him about new
    * messages.
    */
   prepareRequest: function() {

      if (jsxc.notice.has('gui.showRequestNotification')) {
         return;
      }

      $(document).one('postmessagein.jsxc', function() {
         setTimeout(function() {
            jsxc.notice.add($.t('Notifications') + '?', $.t('Should_we_notify_you_'), 'gui.showRequestNotification');
         }, 1000);
      });
   },

   /**
    * Request notification permission.
    */
   requestPermission: function() {
      window.Notification.requestPermission(function(status) {
         if (window.Notification.permission !== status) {
            window.Notification.permission = status;
         }

         if (jsxc.notification.hasPermission()) {
            $(document).trigger('notificationready.jsxc');
         } else {
            $(document).trigger('notificationfailure.jsxc');
         }
      });
   },

   /**
    * Check permission.
    * 
    * @returns {Boolean} True if we have the permission
    */
   hasPermission: function() {
      return window.Notification.permission === jsxc.CONST.NOTIFICATION_GRANTED;
   },

   /**
    * Plays the given file.
    * 
    * @memberOf jsxc.notification
    * @param {string} soundFile File relative to the sound directory
    * @param {boolean} loop True for loop
    * @param {boolean} force Play even if a tab is visible. Default: false.
    */
   playSound: function(soundFile, loop, force) {
      if (!jsxc.master) {
         // only master plays sound
         return;
      }

      if (jsxc.options.get('muteNotification') || jsxc.storage.getUserItem('presence') === 'dnd') {
         // sound mute or own presence is dnd
         return;
      }

      if (jsxc.hasFocus() && !force) {
         // tab is visible
         return;
      }

      // stop current audio file
      jsxc.notification.stopSound();

      var audio = new Audio(jsxc.options.root + '/sound/' + soundFile);
      audio.loop = loop || false;
      audio.play();

      jsxc.notification.audio = audio;
   },

   /**
    * Stop/remove current sound.
    * 
    * @memberOf jsxc.notification
    */
   stopSound: function() {
      var audio = jsxc.notification.audio;

      if (typeof audio !== 'undefined' && audio !== null) {
         audio.pause();
         jsxc.notification.audio = null;
      }
   },

   /**
    * Mute sound.
    * 
    * @memberOf jsxc.notification
    * @param {boolean} external True if triggered from external tab. Default:
    *        false.
    */
   muteSound: function(external) {
      $('#jsxc_menu .jsxc_muteNotification').text($.t('Unmute'));

      if (external !== true) {
         jsxc.options.set('muteNotification', true);
      }
   },

   /**
    * Unmute sound.
    * 
    * @memberOf jsxc.notification
    * @param {boolean} external True if triggered from external tab. Default:
    *        false.
    */
   unmuteSound: function(external) {
      $('#jsxc_menu .jsxc_muteNotification').text($.t('Mute'));

      if (external !== true) {
         jsxc.options.set('muteNotification', false);
      }
   }
};

/**
 * Set some options for the chat.
 * 
 * @namespace jsxc.options
 */
jsxc.options = {

   /** name of container application (e.g. owncloud or SOGo) */
   app_name: 'web applications',

   /** Timeout for the keepalive signal */
   timeout: 3000,

   /** Timeout for the keepalive signal if the master is busy */
   busyTimeout: 15000,

   /** OTR options */
   otr: {
      enable: true,
      ERROR_START_AKE: false,
      debug: false,
      SEND_WHITESPACE_TAG: true,
      WHITESPACE_START_AKE: true
   },

   /** xmpp options */
   xmpp: {
      url: null,
      jid: null,
      domain: null,
      password: null,
      overwrite: false,
      onlogin: true
   },

   /** default xmpp priorities */
   priority: {
      online: 0,
      chat: 0,
      away: 0,
      xa: 0,
      dnd: 0
   },

   /** If all 3 properties are set, the login form is used */
   loginForm: {
      /** jquery object from form */
      form: null,

      /** jquery object from input element which contains the jid */
      jid: null,

      /** jquery object from input element which contains the password */
      pass: null,

      /** manipulate JID from input element */
      preJid: function(jid) {
         return jid;
      },

      /**
       * Action after login was called: dialog [String] Show wait dialog, false [boolean] | 
       * quiet [String] Do nothing
       */
      onConnecting: 'dialog',

      /**
       * Action after connected: submit [String] Submit form, false [boolean] Do
       * nothing, continue [String] Start chat
       */
      onConnected: 'submit',

      /**
       * Action after auth fail: submit [String] Submit form, false [boolean] | quiet [String] Do
       * nothing, ask [String] Show auth fail dialog
       */
      onAuthFail: 'submit'
   },

   /** jquery object from logout element */
   logoutElement: null,

   /** How many messages should be logged? */
   numberOfMsg: 10,

   /** Default language */
   defaultLang: 'en',

   /** auto language detection */
   autoLang: true,

   /** Place for roster */
   rosterAppend: 'body',

   /** Should we use the HTML5 notification API? */
   notification: true,

   /** duration for notification */
   popupDuration: 6000,

   /** Absolute path root of JSXC installation */
   root: '',

   /** Timeout for restore in ms */
   loginTimeout: 1000 * 60 * 10,

   /**
    * This function decides wether the roster will be displayed or not if no
    * connection is found.
    */
   displayRosterMinimized: function() {
      return false;
   },

   /** Set to true if you want to hide offline buddies. */
   hideOffline: false,

   /** Mute notification sound? */
   muteNotification: false,

   /**
    * If no avatar is found, this function is called.
    * 
    * @param jid Jid of that user.
    * @this {jQuery} Elements to update with probable .jsxc_avatar elements
    */
   defaultAvatar: function(jid) {
      jsxc.gui.avatarPlaceholder($(this).find('.jsxc_avatar'), jid);
   },

   /**
    * Returns permanent saved settings and overwrite default jsxc.options.
    * 
    * @memberOf jsxc.options
    * @param username String username
    * @param password String password
    * @returns {object} at least xmpp.url
    */
   loadSettings: function() {

   },

   /**
    * Call this function to save user settings permanent.
    * 
    * @memberOf jsxc.options
    * @param data Holds all data as key/value
    * @returns {boolean} false if function failes
    */
   saveSettinsPermanent: function() {

   },

   carbons: {
      /** Enable carbon copies? */
      enable: false
   },

   /**
    * Processes user list.
    * 
    * @callback getUsers-cb
    * @param {object} list List of users, key: username, value: alias
    */

   /**
    * Returns a list of usernames and aliases
    * 
    * @function getUsers
    * @memberOf jsxc.options
    * @param {string} search Search token (start with)
    * @param {getUsers-cb} cb Called with list of users
    */
   getUsers: null
};

/**
 * @namespace jsxc.otr
 */
jsxc.otr = {
   /** list of otr objects */
   objects: {},

   dsaFallback: null,
   /**
    * Handler for otr receive event
    * 
    * @memberOf jsxc.otr
    * @param {Object} d
    * @param {string} d.bid
    * @param {string} d.msg received message
    * @param {boolean} d.encrypted True, if msg was encrypted.
    * @param {boolean} d.forwarded
    * @param {string} d.stamp timestamp
    */
   receiveMessage: function(d) {
      var bid = d.bid;

      if (jsxc.otr.objects[bid].msgstate !== OTR.CONST.MSGSTATE_PLAINTEXT) {
         jsxc.otr.backup(bid);
      }

      if (jsxc.otr.objects[bid].msgstate !== OTR.CONST.MSGSTATE_PLAINTEXT && !d.encrypted) {
         jsxc.gui.window.postMessage(bid, 'sys', $.t('Received_an_unencrypted_message') + '. [' + d.msg + ']', d.encrypted, d.forwarded, d.stamp);
      } else {
         jsxc.gui.window.postMessage(bid, 'in', d.msg, d.encrypted, d.forwarded, d.stamp);
      }
   },

   /**
    * Handler for otr send event
    * 
    * @param {string} jid
    * @param {string} msg message to be send
    */
   sendMessage: function(jid, msg, uid) {
      if (jsxc.otr.objects[jsxc.jidToBid(jid)].msgstate !== 0) {
         jsxc.otr.backup(jsxc.jidToBid(jid));
      }

      jsxc.xmpp._sendMessage(jid, msg, uid);
   },

   /**
    * Create new otr instance
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   create: function(bid) {

      if (jsxc.otr.objects.hasOwnProperty(bid)) {
         return;
      }

      if (!jsxc.options.otr.priv) {
         return;
      }

      // save list of otr objects
      var ol = jsxc.storage.getUserItem('otrlist') || [];
      if (ol.indexOf(bid) < 0) {
         ol.push(bid);
         jsxc.storage.setUserItem('otrlist', ol);
      }

      jsxc.otr.objects[bid] = new OTR(jsxc.options.otr);

      if (jsxc.options.otr.SEND_WHITESPACE_TAG) {
         jsxc.otr.objects[bid].SEND_WHITESPACE_TAG = true;
      }

      if (jsxc.options.otr.WHITESPACE_START_AKE) {
         jsxc.otr.objects[bid].WHITESPACE_START_AKE = true;
      }

      jsxc.otr.objects[bid].on('status', function(status) {
         var data = jsxc.storage.getUserItem('buddy', bid);

         if (data === null) {
            return;
         }

         switch (status) {
            case OTR.CONST.STATUS_SEND_QUERY:
               jsxc.gui.window.postMessage(bid, 'sys', $.t('trying_to_start_private_conversation'));
               break;
            case OTR.CONST.STATUS_AKE_SUCCESS:
               data.fingerprint = jsxc.otr.objects[bid].their_priv_pk.fingerprint();
               data.msgstate = OTR.CONST.MSGSTATE_ENCRYPTED;

               var msg = (jsxc.otr.objects[bid].trust ? $.t('Verified') : $.t('Unverified')) + ' ' + $.t('private_conversation_started');
               jsxc.gui.window.postMessage(bid, 'sys', msg);
               break;
            case OTR.CONST.STATUS_END_OTR:
               data.fingerprint = null;

               if (jsxc.otr.objects[bid].msgstate === OTR.CONST.MSGSTATE_PLAINTEXT) {
                  // we abort the private conversation

                  data.msgstate = OTR.CONST.MSGSTATE_PLAINTEXT;
                  jsxc.gui.window.postMessage(bid, 'sys', $.t('private_conversation_aborted'));

               } else {
                  // the buddy abort the private conversation

                  data.msgstate = OTR.CONST.MSGSTATE_FINISHED;
                  jsxc.gui.window.postMessage(bid, 'sys', $.t('your_buddy_closed_the_private_conversation_you_should_do_the_same'));
               }
               break;
            case OTR.CONST.STATUS_SMP_HANDLE:
               jsxc.keepBusyAlive();
               break;
         }

         jsxc.storage.setUserItem('buddy', bid, data);

         // for encryption and verification state
         jsxc.gui.update(bid);
      });

      jsxc.otr.objects[bid].on('smp', function(type, data) {
         switch (type) {
            case 'question': // verification request received
               jsxc.gui.window.postMessage(bid, 'sys', $.t('Authentication_request_received'));

               if ($('#jsxc_dialog').length > 0) {
                  jsxc.otr.objects[bid].sm.abort();
                  break;
               }

               jsxc.otr.onSmpQuestion(bid, data);
               jsxc.storage.setUserItem('smp_' + bid, {
                  data: data || null
               });

               break;
            case 'trust': // verification completed
               jsxc.otr.objects[bid].trust = data;
               jsxc.storage.updateUserItem('buddy', bid, 'trust', data);
               jsxc.otr.backup(bid);
               jsxc.gui.update(bid);

               if (data) {
                  jsxc.gui.window.postMessage(bid, 'sys', $.t('conversation_is_now_verified'));
               } else {
                  jsxc.gui.window.postMessage(bid, 'sys', $.t('authentication_failed'));
               }
               jsxc.storage.removeUserItem('smp_' + bid);
               jsxc.gui.dialog.close();
               break;
            case 'abort':
               jsxc.gui.window.postMessage(bid, 'sys', $.t('Authentication_aborted'));
               break;
            default:
               jsxc.debug('[OTR] sm callback: Unknown type: ' + type);
         }
      });

      // Receive message
      jsxc.otr.objects[bid].on('ui', function(msg, encrypted, meta) {
         jsxc.otr.receiveMessage({
            bid: bid,
            msg: msg,
            encrypted: encrypted === true,
            stamp: meta.stamp,
            forwarded: meta.forwarded
         });
      });

      // Send message
      jsxc.otr.objects[bid].on('io', function(msg, uid) {
         var jid = jsxc.gui.window.get(bid).data('jid') || jsxc.otr.objects[bid].jid;

         jsxc.otr.objects[bid].jid = jid;

         jsxc.otr.sendMessage(jid, msg, uid);
      });

      jsxc.otr.objects[bid].on('error', function(err) {
         // Handle this case in jsxc.otr.receiveMessage
         if (err !== 'Received an unencrypted message.') {
            jsxc.gui.window.postMessage(bid, 'sys', '[OTR] ' + $.t(err));
         }

         jsxc.error('[OTR] ' + err);
      });

      jsxc.otr.restore(bid);
   },

   /**
    * show verification dialog with related part (secret or question)
    * 
    * @param {type} bid
    * @param {string} [data]
    * @returns {undefined}
    */
   onSmpQuestion: function(bid, data) {
      jsxc.gui.showVerification(bid);

      $('#jsxc_dialog select').prop('selectedIndex', (data ? 2 : 3)).change();
      $('#jsxc_dialog > div:eq(0)').hide();

      if (data) {
         $('#jsxc_dialog > div:eq(2)').find('#jsxc_quest').val(data).prop('disabled', true);
         $('#jsxc_dialog > div:eq(2)').find('.creation').text('Answer');
         $('#jsxc_dialog > div:eq(2)').find('.jsxc_explanation').text($.t('your_buddy_is_attempting_to_determine_') + ' ' + $.t('to_authenticate_to_your_buddy') + $.t('enter_the_answer_and_click_answer'));
      } else {
         $('#jsxc_dialog > div:eq(3)').find('.jsxc_explanation').text($.t('your_buddy_is_attempting_to_determine_') + ' ' + $.t('to_authenticate_to_your_buddy') + $.t('enter_the_secret'));
      }

      $('#jsxc_dialog .jsxc_close').click(function() {
         jsxc.storage.removeUserItem('smp_' + bid);

         if (jsxc.master) {
            jsxc.otr.objects[bid].sm.abort();
         }
      });
   },

   /**
    * Send verification request to buddy
    * 
    * @param {string} bid
    * @param {string} sec secret
    * @param {string} [quest] question
    * @returns {undefined}
    */
   sendSmpReq: function(bid, sec, quest) {
      jsxc.keepBusyAlive();

      jsxc.otr.objects[bid].smpSecret(sec, quest || '');
   },

   /**
    * Toggle encryption state
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   toggleTransfer: function(bid) {
      if (typeof OTR !== 'function') {
         return;
      }

      if (jsxc.storage.getUserItem('buddy', bid).msgstate === 0) {
         jsxc.otr.goEncrypt(bid);
      } else {
         jsxc.otr.goPlain(bid);
      }
   },

   /**
    * Send request to encrypt the session
    * 
    * @param {type} bid
    * @returns {undefined}
    */
   goEncrypt: function(bid) {
      if (jsxc.master) {
         if (jsxc.otr.objects.hasOwnProperty(bid)) {
            jsxc.otr.objects[bid].sendQueryMsg();
         }
      } else {
         jsxc.storage.updateUserItem('buddy', bid, 'transferReq', 1);
      }
   },

   /**
    * Abort encryptet session
    * 
    * @param {type} bid
    * @param cb callback
    * @returns {undefined}
    */
   goPlain: function(bid, cb) {
      if (jsxc.master) {
         if (jsxc.otr.objects.hasOwnProperty(bid)) {
            jsxc.otr.objects[bid].endOtr.call(jsxc.otr.objects[bid], cb);
            jsxc.otr.objects[bid].init.call(jsxc.otr.objects[bid]);

            jsxc.otr.backup(bid);
         }
      } else {
         jsxc.storage.updateUserItem('buddy', bid, 'transferReq', 0);
      }
   },

   /**
    * Backups otr session
    * 
    * @param {string} bid
    */
   backup: function(bid) {
      var o = jsxc.otr.objects[bid]; // otr object
      var r = {}; // return value

      if (o === null) {
         return;
      }

      // all variables which should be saved
      var savekey = [ 'jid', 'our_instance_tag', 'msgstate', 'authstate', 'fragment', 'their_y', 'their_old_y', 'their_keyid', 'their_instance_tag', 'our_dh', 'our_old_dh', 'our_keyid', 'sessKeys', 'storedMgs', 'oldMacKeys', 'trust', 'transmittedRS', 'ssid', 'receivedPlaintext', 'authstate', 'send_interval' ];

      var i;
      for (i = 0; i < savekey.length; i++) {
         r[savekey[i]] = JSON.stringify(o[savekey[i]]);
      }

      if (o.their_priv_pk !== null) {
         r.their_priv_pk = JSON.stringify(o.their_priv_pk.packPublic());
      }

      if (o.ake.otr_version && o.ake.otr_version !== '') {
         r.otr_version = JSON.stringify(o.ake.otr_version);
      }

      jsxc.storage.setUserItem('otr', bid, r);
   },

   /**
    * Restore old otr session
    * 
    * @param {string} bid
    */
   restore: function(bid) {
      var o = jsxc.otr.objects[bid];
      var d = jsxc.storage.getUserItem('otr', bid);

      if (o !== null || d !== null) {
         var key;
         for (key in d) {
            if (d.hasOwnProperty(key)) {
               var val = JSON.parse(d[key]);
               if (key === 'their_priv_pk' && val !== null) {
                  val = DSA.parsePublic(val);
               }
               if (key === 'otr_version' && val !== null) {
                  o.ake.otr_version = val;
               } else {
                  o[key] = val;
               }
            }
         }

         jsxc.otr.objects[bid] = o;

         if (o.msgstate === 1 && o.their_priv_pk !== null) {
            o._smInit.call(jsxc.otr.objects[bid]);
         }
      }

      jsxc.otr.enable(bid);
   },

   /**
    * Create or load DSA key
    * 
    * @returns {unresolved}
    */
   createDSA: function() {
      if (jsxc.options.otr.priv) {
         return;
      }

      if (typeof OTR !== 'function') {
         jsxc.warn('OTR support disabled');

         OTR = {};
         OTR.CONST = {
            MSGSTATE_PLAINTEXT : 0,
            MSGSTATE_ENCRYPTED : 1,
            MSGSTATE_FINISHED  : 2
         };

         jsxc._onMaster();

         return;
      }

      if (jsxc.storage.getUserItem('key') === null) {
         var msg = $.t('Creating_your_private_key_');
         var worker = null;

         if (Worker) {
            // try to create web-worker

            try {
               worker = new Worker(jsxc.options.root + '/lib/otr/build/dsa-webworker.js');
            } catch (err) {
               jsxc.warn('Couldn\'t create web-worker.', err);
            }
         }

         jsxc.otr.dsaFallback = (worker === null);

         if (!jsxc.otr.dsaFallback) {
            // create DSA key in background

            jsxc._onMaster();

            worker.onmessage = function(e) {
               var type = e.data.type;
               var val = e.data.val;

               if (type === 'debug') {
                  jsxc.debug(val);
               } else if (type === 'data') {
                  jsxc.otr.DSAready(DSA.parsePrivate(val));
               }
            };

            // start worker
            worker.postMessage({
               imports: [ jsxc.options.root + '/lib/otr/vendor/salsa20.js', jsxc.options.root + '/lib/otr/vendor/bigint.js', jsxc.options.root + '/lib/otr/vendor/crypto.js', jsxc.options.root + '/lib/otr/vendor/eventemitter.js', jsxc.options.root + '/lib/otr/lib/const.js', jsxc.options.root + '/lib/otr/lib/helpers.js', jsxc.options.root + '/lib/otr/lib/dsa.js' ],
               seed: BigInt.getSeed(),
               debug: true
            });

         } else {
            // fallback

            jsxc.gui.dialog.open(jsxc.gui.template.get('waitAlert', null, msg), {
               noClose: true
            });

            jsxc.debug('DSA key creation started.');

            // wait until the wait alert is opened
            setTimeout(function() {
               var dsa = new DSA();
               jsxc.otr.DSAready(dsa);
            }, 500);
         }
      } else {
         jsxc.debug('DSA key loaded');
         jsxc.options.otr.priv = DSA.parsePrivate(jsxc.storage.getUserItem('key'));

         jsxc.otr._createDSA();
      }
   },

   /**
    * Ending of createDSA().
    */
   _createDSA: function() {

      jsxc.storage.setUserItem('priv_fingerprint', jsxc.options.otr.priv.fingerprint());

      if (jsxc.otr.dsaFallback !== false) {
         jsxc._onMaster();
      }
   },

   /**
    * Ending of DSA key generation.
    * 
    * @param {DSA} dsa DSA object
    */
   DSAready: function(dsa) {
      jsxc.storage.setUserItem('key', dsa.packPrivate());
      jsxc.options.otr.priv = dsa;

      // close wait alert
      if (jsxc.otr.dsaFallback) {
         jsxc.gui.dialog.close();
      } else {
         $.each(jsxc.storage.getUserItem('windowlist'), function(index, val) {
            jsxc.otr.create(val);
         });
      }

      jsxc.otr._createDSA();
   },

   enable: function(bid) {
      jsxc.gui.window.get(bid).find('.jsxc_otr').removeClass('jsxc_disabled');
   }
};



   /**
    * Handle long-live data
    * 
    * @namespace jsxc.storage
    */
   jsxc.storage = {
      /**
       * Prefix for localstorage
       * 
       * @privat
       */
      PREFIX: 'jsxc',

      SEP: ':',

      /**
       * @param {type} uk Should we generate a user prefix?
       * @returns {String} prefix
       * @memberOf jsxc.storage
       */
      getPrefix: function(uk) {
         var self = jsxc.storage;

         return self.PREFIX + self.SEP + ((uk && jsxc.bid) ? jsxc.bid + self.SEP : '');
      },

      /**
       * Save item to storage
       * 
       * @function
       * @param {String} key variablename
       * @param {Object} value value
       * @param {String} uk Userkey? Should we add the bid as prefix?
       */
      setItem: function(key, value, uk) {

         // Workaround for non-conform browser
         if (jsxc.storageNotConform > 0 && key !== 'rid' && key !== 'lastActivity') {
            if (jsxc.storageNotConform > 1 && jsxc.toSNC === null) {
               jsxc.toSNC = window.setTimeout(function() {
                  jsxc.storageNotConform = 0;
                  jsxc.storage.setItem('storageNotConform', 0);
               }, 1000);
            }

            jsxc.ls.push(JSON.stringify({
               key: key,
               value: value
            }));
         }

         if (typeof (value) === 'object') {
            value = JSON.stringify(value);
         }

         localStorage.setItem(jsxc.storage.getPrefix(uk) + key, value);
      },

      setUserItem: function(type, key, value) {
         var self = jsxc.storage;

         if (arguments.length === 2) {
            value = key;
            key = type;
            type = '';
         } else if (arguments.length === 3) {
            key = type + self.SEP + key;
         }

         return jsxc.storage.setItem(key, value, true);
      },

      /**
       * Load item from storage
       * 
       * @function
       * @param {String} key variablename
       * @param {String} uk Userkey? Should we add the bid as prefix?
       */
      getItem: function(key, uk) {
         key = jsxc.storage.getPrefix(uk) + key;

         var value = localStorage.getItem(key);
         try {
            return JSON.parse(value);
         } catch (e) {
            return value;
         }
      },

      /**
       * Get a user item from storage.
       * 
       * @param key
       * @returns user item
       */
      getUserItem: function(type, key) {
         var self = jsxc.storage;

         if (arguments.length === 1) {
            key = type;
         } else if (arguments.length === 2) {
            key = type + self.SEP + key;
         }

         return jsxc.storage.getItem(key, true);
      },

      /**
       * Remove item from storage
       * 
       * @function
       * @param {String} key variablename
       * @param {String} uk Userkey? Should we add the bid as prefix?
       */
      removeItem: function(key, uk) {

         // Workaround for non-conform browser
         if (jsxc.storageNotConform && key !== 'rid' && key !== 'lastActivity') {
            jsxc.ls.push(JSON.stringify({
               key: jsxc.storage.prefix + key,
               value: ''
            }));
         }

         localStorage.removeItem(jsxc.storage.getPrefix(uk) + key);
      },

      /**
       * Remove user item from storage.
       * 
       * @param key
       */
      removeUserItem: function(type, key) {
         var self = jsxc.storage;

         if (arguments.length === 1) {
            key = type;
         } else if (arguments.length === 2) {
            key = type + self.SEP + key;
         }

         jsxc.storage.removeItem(key, true);
      },

      /**
       * Updates value of a variable in a saved object.
       * 
       * @function
       * @param {String} key variablename
       * @param {String|object} variable variablename in object or object with
       *        variable/key pairs
       * @param {Object} [value] value
       * @param {String} uk Userkey? Should we add the bid as prefix?
       */
      updateItem: function(key, variable, value, uk) {

         var data = jsxc.storage.getItem(key, uk) || {};

         if (typeof (variable) === 'object') {

            $.each(variable, function(key, val) {
               if (typeof (data[key]) === 'undefined') {
                  jsxc.debug('Variable ' + key + ' doesn\'t exist in ' + variable + '. It was created.');
               }

               data[key] = val;
            });
         } else {
            if (typeof (data[variable]) === 'undefined') {
               jsxc.debug('Variable ' + variable + ' doesn\'t exist. It was created.');
            }

            data[variable] = value;
         }

         jsxc.storage.setItem(key, data, uk);
      },

      /**
       * Updates value of a variable in a saved user object.
       * 
       * @param {String} key variablename
       * @param {String|object} variable variablename in object or object with
       *        variable/key pairs
       * @param {Object} [value] value
       */
      updateUserItem: function(type, key, variable, value) {
         var self = jsxc.storage;

         if (arguments.length === 4 || (arguments.length === 3 && typeof variable === 'object')) {
            key = type + self.SEP + key;
         } else {
            value = variable;
            variable = key;
            key = type;
         }

         return jsxc.storage.updateItem(key, variable, value, true);
      },

      /**
       * Inkrements value
       * 
       * @function
       * @param {String} key variablename
       * @param {String} uk Userkey? Should we add the bid as prefix?
       */
      ink: function(key, uk) {

         jsxc.storage.setItem(key, Number(jsxc.storage.getItem(key, uk)) + 1, uk);
      },

      /**
       * Remove element from array or object
       * 
       * @param {string} key name of array or object
       * @param {string} name name of element in array or object
       * @param {String} uk Userkey? Should we add the bid as prefix?
       * @returns {undefined}
       */
      removeElement: function(key, name, uk) {
         var item = jsxc.storage.getItem(key, uk);

         if ($.isArray(item)) {
            item = $.grep(item, function(e) {
               return e !== name;
            });
         } else if (typeof (item) === 'object') {
            delete item[name];
         }

         jsxc.storage.setItem(key, item, uk);
      },

      removeUserElement: function(type, key, name) {
         var self = jsxc.storage;

         if (arguments.length === 2) {
            name = key;
            key = type;
         } else if (arguments.length === 3) {
            key = type + self.SEP + key;
         }

         return jsxc.storage.removeElement(key, name, true);
      },

      /**
       * Triggered if changes are recognized
       * 
       * @function
       * @param {event} e Storageevent
       * @param {String} e.key Keyname which triggered event
       * @param {Object} e.oldValue Old Value for key
       * @param {Object} e.newValue New Value for key
       * @param {String} e.url
       */
      onStorage: function(e) {

         // skip
         if (e.key === jsxc.storage.PREFIX + jsxc.storage.SEP + 'rid' || e.key === jsxc.storage.PREFIX + jsxc.storage.SEP + 'lastActivity') {
            return;
         }

         var re = new RegExp('^' + jsxc.storage.PREFIX + jsxc.storage.SEP + '(?:[^' + jsxc.storage.SEP + ']+@[^' + jsxc.storage.SEP + ']+' + jsxc.storage.SEP + ')?(.*)', 'i');
         var key = e.key.replace(re, '$1');

         // Workaround for non-conform browser: Triggered event on every page
         // (own)
         if (jsxc.storageNotConform > 0 && jsxc.ls.length > 0) {

            var val = e.newValue;
            try {
               val = JSON.parse(val);
            } catch (err) {
            }

            var index = $.inArray(JSON.stringify({
               key: key,
               value: val
            }), jsxc.ls);

            if (index >= 0) {

               // confirm that the storage event is not fired regularly
               if (jsxc.storageNotConform > 1) {
                  window.clearTimeout(jsxc.toSNC);
                  jsxc.storageNotConform = 1;
                  jsxc.storage.setItem('storageNotConform', 1);
               }

               jsxc.ls.splice(index, 1);
               return;
            }
         }

         // Workaround for non-conform browser
         if (e.oldValue === e.newValue) {
            return;
         }

         var n, o;
         var bid = key.replace(new RegExp('[^' + jsxc.storage.SEP + ']+' + jsxc.storage.SEP + '(.*)', 'i'), '$1');

         // react if someone ask, if there is a master
         if (jsxc.master && key === 'alive') {
            jsxc.debug('Master request.');

            jsxc.storage.ink('alive');
            return;
         }

         // master alive
         if (!jsxc.master && (key === 'alive' || key === 'alive_busy') && !jsxc.triggeredFromElement) {

            // reset timeout
            window.clearTimeout(jsxc.to);
            jsxc.to = window.setTimeout(jsxc.checkMaster, ((key === 'alive') ? jsxc.options.timeout : jsxc.options.busyTimeout) + jsxc.random(60));

            // only call the first time
            if (!jsxc.role_allocation) {
               jsxc.onSlave();
            }

            return;
         }

         if (key.match(/^notices/)) {
            jsxc.notice.load();
         }

         if (key.match(/^presence/)) {
            jsxc.gui.changePresence(e.newValue, true);
         }

         if (key.match(/^options/) && e.newValue) {
            n = JSON.parse(e.newValue);

            if (typeof n.muteNotification !== 'undefined' && n.muteNotification) {
               jsxc.notification.muteSound(true);
            } else {
               jsxc.notification.unmuteSound(true);
            }
         }

         if (key.match(/^hidden/)) {
            if (jsxc.master) {
               clearTimeout(jsxc.toNotification);
            } else {
               jsxc.isHidden();
            }
         }

         if (key.match(/^focus/)) {
            if (jsxc.master) {
               clearTimeout(jsxc.toNotification);
            } else {
               jsxc.hasFocus();
            }
         }

         if (key.match(new RegExp('^chat' + jsxc.storage.SEP))) {

            var posts = JSON.parse(e.newValue);
            var data, el;

            while (posts.length > 0) {
               data = posts.pop();
               el = $('#' + data.uid);

               if (el.length === 0) {
                  if (jsxc.master && data.direction === 'out') {
                     jsxc.xmpp.sendMessage(bid, data.msg, data.uid);
                  }

                  jsxc.gui.window._postMessage(bid, data);
               } else if (data.received) {
                  el.addClass('jsxc_received');
               }
            }
            return;
         }

         if (key.match(new RegExp('^window' + jsxc.storage.SEP))) {

            if (!e.newValue) {
               jsxc.gui.window._close(bid);
               return;
            }

            if (!e.oldValue) {
               jsxc.gui.window.open(bid);
               return;
            }

            n = JSON.parse(e.newValue);

            if (n.minimize) {
               jsxc.gui.window._hide(bid);
            } else {
               jsxc.gui.window._show(bid);
            }

            jsxc.gui.window.setText(bid, n.text);

            return;
         }

         if (key.match(new RegExp('^smp' + jsxc.storage.SEP))) {

            if (!e.newValue) {

               jsxc.gui.dialog.close();

               if (jsxc.master) {
                  jsxc.otr.objects[bid].sm.abort();
               }

               return;
            }

            n = JSON.parse(e.newValue);

            if (typeof (n.data) !== 'undefined') {

               jsxc.otr.onSmpQuestion(bid, n.data);

            } else if (jsxc.master && n.sec) {
               jsxc.gui.dialog.close();

               jsxc.otr.sendSmpReq(bid, n.sec, n.quest);
            }
         }

         if (!jsxc.master && key.match(new RegExp('^buddy' + jsxc.storage.SEP))) {

            if (!e.newValue) {
               jsxc.gui.roster.purge(bid);
               return;
            }
            if (!e.oldValue) {
               jsxc.gui.roster.add(bid);
               return;
            }

            n = JSON.parse(e.newValue);
            o = JSON.parse(e.oldValue);

            jsxc.gui.update(bid);

            if (o.status !== n.status || o.sub !== n.sub) {
               jsxc.gui.roster.reorder(bid);
            }
         }

         if (jsxc.master && key.match(new RegExp('^deletebuddy' + jsxc.storage.SEP)) && e.newValue) {
            n = JSON.parse(e.newValue);

            jsxc.xmpp.removeBuddy(n.jid);
            jsxc.storage.removeUserItem(key);
         }

         if (jsxc.master && key.match(new RegExp('^buddy' + jsxc.storage.SEP))) {

            n = JSON.parse(e.newValue);
            o = JSON.parse(e.oldValue);

            if (o.transferReq !== n.transferReq) {
               jsxc.storage.updateUserItem('buddy', bid, 'transferReq', -1);

               if (n.transferReq === 0) {
                  jsxc.otr.goPlain(bid);
               }
               if (n.transferReq === 1) {
                  jsxc.otr.goEncrypt(bid);
               }
            }

            if (o.name !== n.name) {
               jsxc.gui.roster._rename(bid, n.name);
            }
         }

         // logout
         if (key === 'sid') {
            if (!e.newValue) {
               // if (jsxc.master && jsxc.xmpp.conn) {
               // jsxc.xmpp.conn.disconnect();
               // jsxc.triggeredFromElement = true;
               // }
               jsxc.xmpp.logout();

            }
            return;
         }

         if (key === 'friendReq') {
            n = JSON.parse(e.newValue);

            if (jsxc.master && n.approve >= 0) {
               jsxc.xmpp.resFriendReq(n.jid, n.approve);
            }
         }

         if (jsxc.master && key.match(new RegExp('^add' + jsxc.storage.SEP))) {
            n = JSON.parse(e.newValue);

            jsxc.xmpp.addBuddy(n.username, n.alias);
         }

         if (key === 'roster') {
            jsxc.gui.roster.toggle();
         }

         if (jsxc.master && key.match(new RegExp('^vcard' + jsxc.storage.SEP)) && e.newValue !== null && e.newValue.match(/^request:/)) {

            jsxc.xmpp.loadVcard(bid, function(stanza) {
               jsxc.storage.setUserItem('vcard', bid, {
                  state: 'success',
                  data: $('<div>').append(stanza).html()
               });
            }, function() {
               jsxc.storage.setUserItem('vcard', bid, {
                  state: 'error'
               });
            });
         }

         if (!jsxc.master && key.match(new RegExp('^vcard' + jsxc.storage.SEP)) && e.newValue !== null && !e.newValue.match(/^request:/)) {
            n = JSON.parse(e.newValue);

            if (typeof n.state !== 'undefined') {
               $(document).trigger('loaded.vcard.jsxc', n);
            }

            jsxc.storage.removeUserItem('vcard', bid);
         }
      },

      /**
       * Save message to storage.
       * 
       * @memberOf jsxc.storage
       * @param bid
       * @param direction
       * @param msg
       * @param encrypted
       * @param forwarded
       * @param sender
       * @return post
       */
      saveMessage: function(bid, direction, msg, encrypted, forwarded, stamp, sender) {
         var chat = jsxc.storage.getUserItem('chat', bid) || [];

         var uid = new Date().getTime() + ':msg';

         if (chat.length > jsxc.options.get('numberOfMsg')) {
            chat.pop();
         }

         var post = {
            direction: direction,
            msg: msg,
            uid: uid.replace(/:/, '-'),
            received: false,
            encrypted: encrypted || false,
            forwarded: forwarded || false,
            stamp: stamp || new Date().getTime(),
            sender: sender
         };

         chat.unshift(post);
         jsxc.storage.setUserItem('chat', bid, chat);

         return post;
      },

      /**
       * Save or update buddy data.
       * 
       * @memberOf jsxc.storage
       * @param bid
       * @param data
       * @returns {String} Updated or created
       */
      saveBuddy: function(bid, data) {

         if (jsxc.storage.getUserItem('buddy', bid)) {
            jsxc.storage.updateUserItem('buddy', bid, data);

            return 'updated';
         }

         jsxc.storage.setUserItem('buddy', bid, $.extend({
            jid: '',
            name: '',
            status: 0,
            sub: 'none',
            msgstate: 0,
            transferReq: -1,
            trust: false,
            fingerprint: null,
            res: [],
            type: 'chat'
         }, data));

         return 'created';
      }
   };

/* global SDPUtil, getUserMediaWithConstraints, setupRTC, MediaStreamTrack, RTC, RTCPeerconnection */
/* jshint -W020 */

jsxc.gui.template.incomingCall = '<h3 data-i18n="Incoming_call"></h3>\
        <p><span data-i18n="Do_you_want_to_accept_the_call_from"></span> {{bid_name}}?</p>\
        <p class="jsxc_right">\
            <a href="#" class="button jsxc_reject" data-i18n="Reject"></a> <a href="#" class="button creation jsxc_accept" data-i18n="Accept"></a>\
         </p>';

jsxc.gui.template.allowMediaAccess = '<p data-i18n="Please_allow_access_to_microphone_and_camera"></p>';

jsxc.gui.template.videoWindow = '<div class="jsxc_webrtc">\
            <div class="jsxc_chatarea">\
                <ul></ul>\
            </div>\
            <div class="jsxc_videoContainer">\
                <video class="jsxc_localvideo" autoplay></video>\
                <video class="jsxc_remotevideo" autoplay></video>\
                <div class="jsxc_status"></div>\
               <div class="bubblingG">\
                  <span id="bubblingG_1">\
                  </span>\
                  <span id="bubblingG_2">\
                  </span>\
                  <span id="bubblingG_3">\
                  </span>\
               </div>\
                <div class="jsxc_noRemoteVideo">\
                   <div>\
                     <div></div>\
                     <p data-i18n="No_video_signal"></p>\
                     <div></div>\
                   </div>\
                </div>\
            </div>\
            <div class="jsxc_controlbar">\
                <button type="button" class="jsxc_hangUp" data-i18n="hang_up"></button>\
                <input type="range" class="jsxc_volume" min="0.0" max="1.0" step="0.05" value="0.5" />\
                <div class="jsxc_buttongroup">\
                    <button type="button" class="jsxc_snapshot" data-i18n="snapshot"></button><button type="button" class="jsxc_snapshots">&#9660;</button>\
                </div>\
                <!-- <button type="button" class="jsxc_mute_local" data-i18n="mute_my_audio"></button>\
                <button type="button" class="jsxc_pause_local" data-i18n="pause_my_video"></button> --> \
                <button type="button" class="jsxc_showchat" data-i18n="chat"></button>\
                <button type="button" class="jsxc_fullscreen" data-i18n="fullscreen"></button>\
                <button type="button" class="jsxc_info" data-i18n="Info"></button>\
            </div>\
            <div class="jsxc_multi">\
               <div class="jsxc_snapshotbar">\
                   <p>No pictures yet!</p>\
               </div>\n\
               <!--<div class="jsxc_chatarea">\
                   <ul></ul>\
               </div>-->\
               <div class="jsxc_infobar"></div>\
            </div>\
        </div>';

   /**
    * WebRTC namespace for jsxc.
    * 
    * @namespace jsxc.webrtc
    */
   jsxc.webrtc = {
      /** strophe connection */
      conn: null,

      /** local video stream */
      localStream: null,

      /** remote video stream */
      remoteStream: null,

      /** jid of the last caller */
      last_caller: null,

      /** should we auto accept incoming calls? */
      AUTO_ACCEPT: false,

      /** required disco features */
      reqVideoFeatures: [ 'urn:xmpp:jingle:apps:rtp:video', 'urn:xmpp:jingle:apps:rtp:audio', 'urn:xmpp:jingle:transports:ice-udp:1', 'urn:xmpp:jingle:apps:dtls:0' ],

      /** bare jid to current jid mapping */
      chatJids: {},

      /**
       * Initialize webrtc plugin.
       * 
       * @private
       * @memberOf jsxc.webrtc
       */
      init: function() {
         var self = jsxc.webrtc;

         // shortcut
         self.conn = jsxc.xmpp.conn;

         if (RTC.browser === 'firefox') {
            self.conn.jingle.media_constraints.mandatory.MozDontOfferDataChannel = true;
         }

         if (!self.conn.jingle) {
            jsxc.error('No jingle plugin found!');
            return;
         }

         // jingle configuration
         self.conn.jingle.PRANSWER = false;
         self.conn.jingle.AUTOACCEPT = false;
         self.conn.jingle.ice_config = jsxc.storage.getUserItem('iceConfig');
         self.conn.jingle.MULTIPARTY = false;
         self.conn.jingle.pc_constraints = RTC.pc_constraints;

         $(document).on('message.jsxc', $.proxy(self.onMessage, self));
         $(document).on('presence.jsxc', $.proxy(self.onPresence, self));

         $(document).on('mediaready.jingle', $.proxy(self.onMediaReady, self));
         $(document).on('mediafailure.jingle', $.proxy(self.onMediaFailure, self));
         $(document).on('callincoming.jingle', $.proxy(self.onCallIncoming, self));
         $(document).on('callterminated.jingle', $.proxy(self.onCallTerminated, self));
         $(document).on('ringing.jingle', $.proxy(self.onCallRinging, self));

         $(document).on('remotestreamadded.jingle', $.proxy(self.onRemoteStreamAdded, self));
         $(document).on('remotestreamremoved.jingle', $.proxy(self.onRemoteStreamRemoved, self));
         $(document).on('iceconnectionstatechange.jingle', $.proxy(self.onIceConnectionStateChanged, self));
         $(document).on('nostuncandidates.jingle', $.proxy(self.noStunCandidates, self));

         $(document).on('error.jingle', function(ev, sid, error) {
            jsxc.error('[JINGLE]', error);
         });

         if (self.conn.disco) {
            self.conn.disco.addFeature('urn:xmpp:jingle:apps:dtls:0');
         }

         if (self.conn.caps) {
            $(document).on('caps.strophe', $.proxy(self.onCaps, self));
         }

         self.getTurnCrendentials();
      },

      /**
       * Checks if cached configuration is valid and if necessary update it.
       * 
       * @memberOf jsxc.webrtc
       */
      getTurnCrendentials: function() {

         if (!jsxc.options.turnCredentialsPath) {
            jsxc.debug('No path for TURN credentials defined!');
            return;
         }

         var ttl = (jsxc.storage.getUserItem('iceValidity') || 0) - (new Date()).getTime();
         if (ttl > 0) {
            // credentials valid

            window.setTimeout(jsxc.webrtc.getTurnCrendentials, ttl + 500);
            return;
         }

         $.ajax(jsxc.options.turnCredentialsPath, {
            async: true,
            success: function(data) {
               var iceConfig = {
                  iceServers: [ {
                     url: 'turn:' + data.url,
                     credential: data.credential,
                     username: data.username
                  } ]
               };

               jsxc.webrtc.conn.jingle.ice_config = iceConfig;
               jsxc.storage.setUserItem('iceConfig', iceConfig);
               jsxc.storage.setUserItem('iceValidity', (new Date()).getTime() + 1000 * data.ttl);
            },
            dataType: 'json'
         });
      },

      /**
       * Return list of video capable resources.
       * 
       * @memberOf jsxc.webrtc
       * @param jid
       * @returns {Array}
       */
      getCapableRes: function(jid) {
         var self = jsxc.webrtc;
         var bid = jsxc.jidToBid(jid);
         var res = jsxc.storage.getUserItem('res', bid) || [];

         var available = [];
         $.each(res, function(r) {
            if (self.conn.caps.hasFeatureByJid(bid + '/' + r, self.reqVideoFeatures)) {
               available.push(r);
            }
         });

         return available;
      },

      /**
       * Add "video" button to roster
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param bid bid of roster item
       * @param data data wich belongs to bid
       * @param el the roster item
       */
      onAddRosterItem: function(event, bid, data, el) {
         var self = jsxc.webrtc;

         if (!self.conn) {
            $(document).one('connectionReady.jsxc', function() {
               self.onAddRosterItem(null, bid, data, el);
            });
            return;
         }

         var videoIcon = $('<div class="jsxc_video jsxc_disabled" title="' + $.t("Start_video_call") + '"></div>');

         videoIcon.click(function() {
            self.startCall(data.jid);
            return false;
         });

         el.find('.jsxc_options.jsxc_left').append(videoIcon);

         el.on('extra.jsxc', function() {
            self.updateIcon(bid);
         });
      },

      /**
       * Add "video" button to window menu.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param win jQuery window object
       */
      initWindow: function(event, win) {
         var self = jsxc.webrtc;

         if (win.hasClass('jsxc_groupchat')) {
            return;
         }

         jsxc.debug('webrtc.initWindow');

         if (!self.conn) {
            $(document).one('connectionReady.jsxc', function() {
               self.initWindow(null, win);
            });
            return;
         }

         var div = $('<div>').addClass('jsxc_video');
         win.find('.jsxc_transfer:eq(1)').after(div);

         self.updateIcon(jsxc.jidToBid(win.data('jid')));
      },

      /**
       * Enable or disable "video" icon and assign full jid.
       * 
       * @memberOf jsxc.webrtc
       * @param bid CSS conform jid
       */
      updateIcon: function(bid) {
         jsxc.debug('Update icon', bid);

         var self = jsxc.webrtc;

         if (bid === jsxc.jidToBid(self.conn.jid)) {
            return;
         }

         var win = jsxc.gui.window.get(bid);
         var jid = win.data('jid');
         var ls = jsxc.storage.getUserItem('buddy', bid);

         if (typeof jid !== 'string') {
            if (ls && typeof ls.jid === 'string') {
               jid = ls.jid;
            } else {
               jsxc.debug('[webrtc] Could not update icon, because could not find jid for ' + bid);
               return;
            }
         }

         var el = win.find('.jsxc_video').add(jsxc.gui.roster.getItem(bid).find('.jsxc_video'));

         var capableRes = self.getCapableRes(jid);
         var targetRes = Strophe.getResourceFromJid(jid);

         if (targetRes === null) {
            $.each(jsxc.storage.getUserItem('buddy', bid).res || [], function(index, val) {
               if (capableRes.indexOf(val) > -1) {
                  targetRes = val;
                  return false;
               }
            });

            jid = jid + '/' + targetRes;
         }

         el.off('click');

         if (capableRes.indexOf(targetRes) > -1) {
            el.click(function() {
               self.startCall(jid);
            });

            el.removeClass('jsxc_disabled');

            el.attr('title', $.t('Start_video_call'));
         } else {
            el.addClass('jsxc_disabled');

            el.attr('title', $.t('Video_call_not_possible'));
         }
      },

      /**
       * Check if full jid changed.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param e
       * @param from full jid
       */
      onMessage: function(e, from) {
         var self = jsxc.webrtc;
         var bid = jsxc.jidToBid(from);

         jsxc.debug('webrtc.onmessage', from);

         if (self.chatJids[bid] !== from) {
            self.updateIcon(bid);
            self.chatJids[bid] = from;
         }
      },

      /**
       * Update icon on presence.
       * 
       * @memberOf jsxc.webrtc
       * @param ev
       * @param status
       * @private
       */
      onPresence: function(ev, jid, status, presence) {
         var self = jsxc.webrtc;

         if ($(presence).find('c[xmlns="' + Strophe.NS.CAPS + '"]').length === 0) {
            jsxc.debug('webrtc.onpresence', jid);

            self.updateIcon(jsxc.jidToBid(jid));
         }
      },

      /**
       * Display status message to user.
       * 
       * @memberOf jsxc.webrtc
       * @param txt message
       * @param d duration in ms
       */
      setStatus: function(txt, d) {
         var status = $('.jsxc_webrtc .jsxc_status');
         var duration = (typeof d === 'undefined' || d === null) ? 4000 : d;

         jsxc.debug('[Webrtc]', txt);

         if (status.html()) {
            // attach old messages
            txt = status.html() + '<br />' + txt;
         }

         status.html(txt);

         status.css({
            'margin-left': '-' + (status.width() / 2) + 'px',
            opacity: 0,
            display: 'block'
         });

         status.stop().animate({
            opacity: 1
         });

         clearTimeout(status.data('timeout'));

         if (duration === 0) {
            return;
         }

         var to = setTimeout(function() {
            status.stop().animate({
               opacity: 0
            }, function() {
               status.html('');
            });
         }, duration);

         status.data('timeout', to);
      },

      /**
       * Update "video" button if we receive cap information.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param jid
       */
      onCaps: function(event, jid) {
         var self = jsxc.webrtc;

         if (jsxc.gui.roster.loaded) {
            self.updateIcon(jsxc.jidToBid(jid));
         } else {
            $(document).on('cloaded.roster.jsxc', function() {
               self.updateIcon(jsxc.jidToBid(jid));
            });
         }
      },

      /**
       * Called if video/audio is ready. Open window and display some messages.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param stream
       */
      onMediaReady: function(event, stream) {
         jsxc.debug('media ready');

         var self = jsxc.webrtc;

         self.localStream = stream;
         self.conn.jingle.localStream = stream;

         jsxc.gui.showVideoWindow(self.last_caller);

         var i;
         for (i = 0; i < stream.getAudioTracks().length; i++) {
            self.setStatus((stream.getAudioTracks().length > 0) ? 'Use local audio device.' : 'No local audio device.');

            jsxc.debug('using audio device "' + stream.getAudioTracks()[i].label + '"');
         }
         for (i = 0; i < stream.getVideoTracks().length; i++) {
            self.setStatus((stream.getVideoTracks().length > 0) ? 'Use local video device.' : 'No local video device.');

            jsxc.debug('using video device "' + stream.getVideoTracks()[i].label + '"');
            $('#jsxc_dialog .jsxc_localvideo').show();
         }

         $(document).one('cleanup.dialog.jsxc', $.proxy(self.hangUp, self));
         $(document).trigger('finish.mediaready.jsxc');
      },

      /**
       * Called if media failes.
       * 
       * @private
       * @memberOf jsxc.webrtc
       */
      onMediaFailure: function(ev, err) {
         this.setStatus('media failure');

         jsxc.gui.window.postMessage(jsxc.jidToBid(jsxc.webrtc.last_caller), 'sys', $.t('Media_failure') + err.name);
         jsxc.debug('media failure: ' + err.name);
      },

      /**
       * Called on incoming call.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param sid Session id
       */
      onCallIncoming: function(event, sid) {
         jsxc.debug('incoming call' + sid);

         var self = this;
         var sess = this.conn.jingle.sessions[sid];
         var bid = jsxc.jidToBid(sess.peerjid);

         jsxc.gui.window.postMessage(bid, 'sys', $.t('Incoming_call'));

         // display notification
         jsxc.notification.notify($.t('Incoming_call'), $.t('from') + ' ' + bid);

         // send signal to partner
         sess.sendRinging();

         jsxc.webrtc.last_caller = sess.peerjid;

         jsxc.switchEvents({
            'mediaready.jingle': function(event, stream) {
               self.setStatus('Accept call');

               sess.localStream = stream;
               sess.peerconnection.addStream(stream);

               sess.sendAnswer();
               sess.accept();
            },
            'mediafailure.jingle': function() {
               sess.sendTerminate('decline');
               sess.terminate();
            }
         });

         if (jsxc.webrtc.AUTO_ACCEPT) {
            self.reqUserMedia();
            return;
         }

         var dialog = jsxc.gui.dialog.open(jsxc.gui.template.get('incomingCall', bid), {
            noClose: true
         });

         dialog.find('.jsxc_accept').click(function() {
            $(document).trigger('accept.call.jsxc');

            self.reqUserMedia();
         });

         dialog.find('.jsxc_reject').click(function() {
            jsxc.gui.dialog.close();
            $(document).trigger('reject.call.jsxc');

            sess.sendTerminate('decline');
            sess.terminate();
         });
      },

      /**
       * Called if call is terminated.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param sid Session id
       * @param reason Reason for termination
       * @param [text] Optional explanation
       */
      onCallTerminated: function(event, sid, reason, text) {
         this.setStatus('call terminated ' + sid + (reason ? (': ' + reason + ' ' + text) : ''));

         var bid = jsxc.jidToBid(jsxc.webrtc.last_caller);

         if (this.localStream) {
            this.localStream.stop();
         }

         if ($('.jsxc_videoContainer').length) {
            $('.jsxc_remotevideo')[0].src = "";
            $('.jsxc_localvideo')[0].src = "";
         }

         this.conn.jingle.localStream = null;
         this.localStream = null;
         this.remoteStream = null;

         var win = $('#jsxc_dialog .jsxc_chatarea > ul > li');
         $('#jsxc_windowList > ul').prepend(win.detach());
         win.find('.slimScrollDiv').resizable('enable');

         $(document).off('cleanup.dialog.jsxc');
         $(document).off('error.jingle');
         jsxc.gui.dialog.close();

         jsxc.gui.window.postMessage(bid, 'sys', ($.t('Call_terminated') + (reason ? (': ' + $.t(reason)) : '') + '.'));
      },

      /**
       * Remote station is ringing.
       * 
       * @private
       * @memberOf jsxc.webrtc
       */
      onCallRinging: function() {
         this.setStatus('ringing...', 0);
      },

      /**
       * Called if we receive a remote stream.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param data
       * @param sid Session id
       */
      onRemoteStreamAdded: function(event, data, sid) {
         this.setStatus('Remote stream for session ' + sid + ' added.');

         var stream = data.stream;
         this.remoteStream = stream;

         var sess = this.conn.jingle.sessions[sid];

         var isVideoDevice = stream.getVideoTracks().length > 0;
         var isAudioDevice = stream.getAudioTracks().length > 0;

         sess.remoteDevices = {
            video: isVideoDevice,
            audio: isAudioDevice
         };

         this.setStatus(isVideoDevice ? 'Use remote video device.' : 'No remote video device');
         this.setStatus(isAudioDevice ? 'Use remote audio device.' : 'No remote audio device');

         if ($('.jsxc_remotevideo').length) {
            RTC.attachMediaStream($('#jsxc_dialog .jsxc_remotevideo'), stream);

            $('#jsxc_dialog .jsxc_' + (isVideoDevice ? 'remotevideo' : 'noRemoteVideo')).addClass('jsxc_deviceAvailable');
         }
      },

      /**
       * Called if the remote stream was removed.
       * 
       * @private
       * @meberOf jsxc.webrtc
       * @param event
       * @param data
       * @param sid Session id
       */
      onRemoteStreamRemoved: function(event, data, sid) {
         this.setStatus('Remote stream for session ' + sid + ' removed.');
      },

      /**
       * Extracts local and remote ip and display it to the user.
       * 
       * @private
       * @memberOf jsxc.webrtc
       * @param event
       * @param sid session id
       * @param sess
       */
      onIceConnectionStateChanged: function(event, sid, sess) {
         var sigState = sess.peerconnection.signalingState;
         var iceCon = sess.peerconnection.iceConnectionState;

         jsxc.debug('iceGat state for ' + sid, sess.peerconnection.iceGatheringState);
         jsxc.debug('iceCon state for ' + sid, iceCon);
         jsxc.debug('sig state for ' + sid, sigState);

         if (sigState === 'stable' && (iceCon === 'connected' || iceCon === 'completed')) {

            $('#jsxc_dialog .jsxc_deviceAvailable').show();
            $('#jsxc_dialog .bubblingG').hide();

            var localSDP = sess.peerconnection.localDescription.sdp;
            var remoteSDP = sess.peerconnection.remoteDescription.sdp;

            sess.local_fp = SDPUtil.parse_fingerprint(SDPUtil.find_line(localSDP, 'a=fingerprint:')).fingerprint;
            sess.remote_fp = SDPUtil.parse_fingerprint(SDPUtil.find_line(remoteSDP, 'a=fingerprint:')).fingerprint;

            var text = '<p>';
            text += '<b>' + $.t('Local_Fingerprint') + ': </b>' + sess.local_fp + '<br />';
            text += '<b>' + $.t('Remote_Fingerprint') + ': </b>' + sess.remote_fp;
            text += '</p>';

            $('#jsxc_dialog .jsxc_infobar').html(text);
         } else if (iceCon === 'failed') {
            jsxc.gui.window.postMessage(jsxc.jidToBid(sess.peerjid), 'sys', $.t('ICE_connection_failure'));

            $(document).off('cleanup.dialog.jsxc');

            sess.sendTerminate('failed-transport');
            sess.terminate();

            $(document).trigger('callterminated.jingle');
         }
      },

      /**
       * No STUN candidates found
       * 
       * @private
       * @memberOf jsxc.webrtc
       */
      noStunCandidates: function() {

      },

      /**
       * Start a call to the specified jid.
       * 
       * @memberOf jsxc.webrtc
       * @param jid full jid
       * @param um requested user media
       */
      startCall: function(jid, um) {
         var self = this;

         if (Strophe.getResourceFromJid(jid) === null) {
            jsxc.debug('We need a full jid');
            return;
         }

         self.last_caller = jid;

         jsxc.switchEvents({
            'finish.mediaready.jsxc': function() {
               self.setStatus('Initiate call');

               jsxc.gui.window.postMessage(jsxc.jidToBid(jid), 'sys', $.t('Call_started'));

               $(document).one('error.jingle', function(e, sid, error) {
                  if (error.source !== 'offer') {
                     return;
                  }

                  $(document).off('cleanup.dialog.jsxc');
                  setTimeout(function() {
                     jsxc.gui.showAlert("Sorry, we couldn't establish a connection. Maybe your buddy is offline.");
                  }, 500);
               });

               self.conn.jingle.initiate(jid, self.conn.jid.toLowerCase());
            },
            'mediafailure.jingle': function() {
               jsxc.gui.dialog.close();
            }
         });

         self.reqUserMedia(um);
      },

      /**
       * Hang up the current call.
       * 
       * @memberOf jsxc.webrtc
       */
      hangUp: function(reason, text) {
         $(document).off('cleanup.dialog.jsxc');

         jsxc.webrtc.conn.jingle.terminate(null, reason, text);
         $(document).trigger('callterminated.jingle');
      },

      /**
       * Request video and audio from local user.
       * 
       * @memberOf jsxc.webrtc
       */
      reqUserMedia: function(um) {
         if (this.localStream) {
            $(document).trigger('mediaready.jingle', [ this.localStream ]);
            return;
         }

         um = um || [ 'video', 'audio' ];

         jsxc.gui.dialog.open(jsxc.gui.template.get('allowMediaAccess'), {
            noClose: true
         });
         this.setStatus('please allow access to microphone and camera');

         if (typeof MediaStreamTrack !== 'undefined' && typeof MediaStreamTrack.getSources !== 'undefined') {
            MediaStreamTrack.getSources(function(sourceInfo) {
               var availableDevices = sourceInfo.map(function(el) {

                  return el.kind;
               });

               um = um.filter(function(el) {
                  return availableDevices.indexOf(el) !== -1;
               });

               getUserMediaWithConstraints(um);
            });
         } else {
            getUserMediaWithConstraints(um);
         }
      },

      /**
       * Make a snapshot from a video stream and display it.
       * 
       * @memberOf jsxc.webrtc
       * @param video Video stream
       */
      snapshot: function(video) {
         if (!video) {
            jsxc.debug('Missing video element');
         }

         $('.jsxc_snapshotbar p').remove();

         var canvas = $('<canvas/>').css('display', 'none').appendTo('body').attr({
            width: video.width(),
            height: video.height()
         }).get(0);
         var ctx = canvas.getContext('2d');

         ctx.drawImage(video[0], 0, 0);
         var img = $('<img/>');
         var url = null;

         try {
            url = canvas.toDataURL('image/jpeg');
         } catch (err) {
            jsxc.warn('Error', err);
            return;
         }

         img[0].src = url;
         var link = $('<a/>').attr({
            target: '_blank',
            href: url
         });
         link.append(img);
         $('.jsxc_snapshotbar').append(link);

         canvas.remove();
      }
   };

   /**
    * Display window for video call.
    * 
    * @memberOf jsxc.gui
    */
   jsxc.gui.showVideoWindow = function(jid) {
      var self = jsxc.webrtc;

      $(document).one('complete.dialog.jsxc', function() {

         // mute own video element to avoid echoes
         $('#jsxc_dialog .jsxc_localvideo')[0].muted = true;
         $('#jsxc_dialog .jsxc_localvideo')[0].volume = 0;

         var rv = $('#jsxc_dialog .jsxc_remotevideo');
         var lv = $('#jsxc_dialog .jsxc_localvideo');

         lv.draggable({
            containment: "parent"
         });

         RTC.attachMediaStream(lv, self.localStream);

         var w_dialog = $('#jsxc_dialog').width();
         var w_remote = rv.width();

         // fit in video
         if (w_remote > w_dialog) {
            var scale = w_dialog / w_remote;
            var new_h = rv.height() * scale;
            var new_w = w_dialog;
            var vc = $('#jsxc_dialog .jsxc_videoContainer');

            rv.height(new_h);
            rv.width(new_w);

            vc.height(new_h);
            vc.width(new_w);

            lv.height(lv.height() * scale);
            lv.width(lv.width() * scale);
         }

         if (self.remoteStream) {
            RTC.attachMediaStream(rv, self.remoteStream);

            $('#jsxc_dialog .jsxc_' + (self.remoteStream.getVideoTracks().length > 0 ? 'remotevideo' : 'noRemoteVideo')).addClass('jsxc_deviceAvailable');
         }

         var toggleMulti = function(elem, open) {
            $('#jsxc_dialog .jsxc_multi > div').not(elem).slideUp();

            var opt = {
               complete: jsxc.gui.dialog.resize
            };

            if (open) {
               elem.slideDown(opt);
            } else {
               elem.slideToggle(opt);
            }
         };

         var win = jsxc.gui.window.open(jsxc.jidToBid(jid));

         win.find('.slimScrollDiv').resizable('disable');
         win.find('.jsxc_textarea').slimScroll({
            height: 413
         });
         win.find('.jsxc_emoticons').css('top', (413 + 6) + 'px');

         $('#jsxc_dialog .jsxc_chatarea ul').append(win.detach());

         $('#jsxc_dialog .jsxc_hangUp').click(function() {
            jsxc.webrtc.hangUp();
         });

         $('#jsxc_dialog .jsxc_snapshot').click(function() {
            jsxc.webrtc.snapshot(rv);
            toggleMulti($('#jsxc_dialog .jsxc_snapshotbar'), true);
         });

         $('#jsxc_dialog .jsxc_snapshots').click(function() {
            toggleMulti($('#jsxc_dialog .jsxc_snapshotbar'));
         });

         $('#jsxc_dialog .jsxc_showchat').click(function() {
            var chatarea = $('#jsxc_dialog .jsxc_chatarea');

            if (chatarea.is(':hidden')) {
               chatarea.show();
               $('#jsxc_dialog .jsxc_webrtc').width('900');
               jsxc.gui.dialog.resize({
                  width: '920px'
               });
            } else {
               chatarea.hide();
               $('#jsxc_dialog .jsxc_webrtc').width('650');
               jsxc.gui.dialog.resize({
                  width: '660px'
               });
            }
         });

         $('#jsxc_dialog .jsxc_info').click(function() {
            toggleMulti($('#jsxc_dialog .jsxc_infobar'));
         });

         $('#jsxc_dialog .jsxc_fullscreen').click(function() {

            if ($.support.fullscreen) {
               // Reset position of localvideo
               $(document).one('disabled.fullscreen', function() {
                  lv.removeAttr('style');
               });

               $('#jsxc_dialog .jsxc_videoContainer').fullscreen();
            }
         });

         $('#jsxc_dialog .jsxc_volume').change(function() {
            rv[0].volume = $(this).val();
         });

         $('#jsxc_dialog .jsxc_volume').dblclick(function() {
            $(this).val(0.5);
         });
      });

      jsxc.gui.dialog.open(jsxc.gui.template.get('videoWindow'), {
         noClose: true
      });
   };

   $.extend(jsxc.CONST, {
      KEYCODE_ENTER: 13,
      KEYCODE_ESC: 27
   });

   $(document).ready(function() {
      RTC = setupRTC();

      if (RTC !== null) {
         RTCPeerconnection = RTC.peerconnection;

         $(document).on('add.roster.jsxc', jsxc.webrtc.onAddRosterItem);
         $(document).on('init.window.jsxc', jsxc.webrtc.initWindow);
         $(document).on('attached.jsxc', jsxc.webrtc.init);
      }
   });


/**
 * Handle XMPP stuff.
 * 
 * @namespace jsxc.xmpp
 */
jsxc.xmpp = {
   conn: null, // connection

   /**
    * Create new connection or attach to old
    * 
    * @name login
    * @memberOf jsxc.xmpp
    */
   /**
    * Create new connection with given parameters.
    * 
    * @name login^2
    * @param {string} jid
    * @param {string} password
    * @memberOf jsxc.xmpp
    */
   /**
    * Attach connection with given parameters.
    * 
    * @name login^3
    * @param {string} jid
    * @param {string} sid
    * @param {string} rid
    * @memberOf jsxc.xmpp
    */
   login: function() {

      if (jsxc.xmpp.conn && jsxc.xmpp.conn.authenticated) {
         return;
      }

      var jid = null, password = null, sid = null, rid = null;

      switch (arguments.length) {
         case 2:
            jid = arguments[0];
            password = arguments[1];
            break;
         case 3:
            jid = arguments[0];
            sid = arguments[1];
            rid = arguments[2];
            break;
         default:
            sid = jsxc.storage.getItem('sid');
            rid = jsxc.storage.getItem('rid');

            if (sid !== null && rid !== null) {
               jid = jsxc.storage.getItem('jid');
            } else {
               sid = null;
               rid = null;
               jid = jsxc.options.xmpp.jid;
            }
      }

      var url = jsxc.options.get('xmpp').url;

      if (!(jsxc.xmpp.conn && jsxc.xmpp.conn.connected)) {
        // Register eventlistener
        $(document).on('connected.jsxc', jsxc.xmpp.connected);
        $(document).on('attached.jsxc', jsxc.xmpp.attached);
        $(document).on('disconnected.jsxc', jsxc.xmpp.disconnected);
        $(document).on('ridChange', jsxc.xmpp.onRidChange);
        $(document).on('connfail.jsxc', jsxc.xmpp.onConnfail);
        $(document).on('authfail.jsxc', jsxc.xmpp.onAuthFail);

        Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
      }

      // Create new connection (no login)
      jsxc.xmpp.conn = new Strophe.Connection(url);

      // Override default function to preserve unique id
      var stropheGetUniqueId = jsxc.xmpp.conn.getUniqueId;
      jsxc.xmpp.conn.getUniqueId = function(suffix) {
         var uid = stropheGetUniqueId.call(jsxc.xmpp.conn, suffix);
         jsxc.storage.setItem('_uniqueId', jsxc.xmpp.conn._uniqueId);

         return uid;
      };

      if (jsxc.storage.getItem('debug') === true) {
         jsxc.xmpp.conn.xmlInput = function(data) {
            console.log('<', data);
         };
         jsxc.xmpp.conn.xmlOutput = function(data) {
            console.log('>', data);
         };
      }

      var callback = function(status, condition) {

         jsxc.debug(Object.getOwnPropertyNames(Strophe.Status)[status] + ': ' + condition);

         switch (status) {
            case Strophe.Status.CONNECTING:
               $(document).trigger('connecting.jsxc');
               break;
            case Strophe.Status.CONNECTED:
               jsxc.bid = jsxc.jidToBid(jsxc.xmpp.conn.jid.toLowerCase());
               $(document).trigger('connected.jsxc');
               break;
            case Strophe.Status.ATTACHED:
               $(document).trigger('attached.jsxc');
               break;
            case Strophe.Status.DISCONNECTED:
               $(document).trigger('disconnected.jsxc');
               break;
            case Strophe.Status.CONNFAIL:
               $(document).trigger('connfail.jsxc');
               break;
            case Strophe.Status.AUTHFAIL:
               $(document).trigger('authfail.jsxc');
               break;
         }
      };

      if (jsxc.xmpp.conn.caps) {
         jsxc.xmpp.conn.caps.node = 'http://jsxc.org/';
      }

      if (jsxc.restore && sid && rid) {
         jsxc.debug('Try to attach');
         jsxc.debug('SID: ' + sid);
         jsxc.xmpp.conn.attach(jid, sid, rid, callback);
      } else {
         jsxc.debug('New connection');

         if (jsxc.xmpp.conn.caps) {
            // Add system handler, because user handler isn't called before
            // we are authenticated
            jsxc.xmpp.conn._addSysHandler(function(stanza) {
               var from = jsxc.xmpp.conn.domain, c = stanza.querySelector('c'), ver = c.getAttribute('ver'), node = c.getAttribute('node');

               var _jidNodeIndex = JSON.parse(localStorage.getItem('strophe.caps._jidNodeIndex')) || {};

               jsxc.xmpp.conn.caps._jidVerIndex[from] = ver;
               _jidNodeIndex[from] = node;

               localStorage.setItem('strophe.caps._jidVerIndex', JSON.stringify(jsxc.xmpp.conn.caps._jidVerIndex));
               localStorage.setItem('strophe.caps._jidNodeIndex', JSON.stringify(_jidNodeIndex));
            }, Strophe.NS.CAPS);
         }

         jsxc.xmpp.conn.connect(jid || jsxc.options.xmpp.jid, password || jsxc.options.xmpp.password, callback);
      }
   },

   /**
    * Logs user out of his xmpp session and does some clean up.
    * 
    * @param {boolean} complete If set to false, roster will not be removed
    * @returns {Boolean}
    */
   logout: function(complete) {

      // instruct all tabs
      jsxc.storage.removeItem('sid');

      // clean up
      jsxc.storage.removeUserItem('buddylist');
      jsxc.storage.removeUserItem('windowlist');
      jsxc.storage.removeItem('_uniqueId');

      if (!jsxc.master) {
         $('#jsxc_roster').remove();
         $('#jsxc_windowlist').remove();
         return true;
      }

      if (jsxc.xmpp.conn === null) {
         return true;
      }

      // Hide dropdown menu
      $('body').click();

      jsxc.triggeredFromElement = (typeof complete === 'boolean')? complete : true;

      // restore all otr objects
      $.each(jsxc.storage.getUserItem('otrlist') || {}, function(i, val) {
         jsxc.otr.create(val);
      });

      var numOtr = Object.keys(jsxc.otr.objects || {}).length + 1;
      var disReady = function() {
         if (--numOtr <= 0) {
            jsxc.xmpp.conn.flush();

            setTimeout(function() {
               jsxc.xmpp.conn.disconnect();
            }, 600);
         }
      };

      // end all private conversations
      $.each(jsxc.otr.objects || {}, function(key, obj) {
         if (obj.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED) {
            obj.endOtr.call(obj, function() {
               obj.init.call(obj);
               jsxc.otr.backup(key);

               disReady();
            });
         } else {
            disReady();
         }
      });

      disReady();

      // Trigger real logout in jsxc.xmpp.disconnected()
      return false;
   },

   /**
    * Triggered if connection is established
    * 
    * @private
    */
   connected: function() {

      jsxc.xmpp.conn.pause();

      var nomJid = Strophe.getBareJidFromJid(jsxc.xmpp.conn.jid).toLowerCase() + '/' + Strophe.getResourceFromJid(jsxc.xmpp.conn.jid);

      // Save sid and jid
      jsxc.storage.setItem('sid', jsxc.xmpp.conn._proto.sid);
      jsxc.storage.setItem('jid', nomJid);

      jsxc.storage.setItem('lastActivity', (new Date()).getTime());

      // make shure roster will be reloaded
      jsxc.storage.removeUserItem('buddylist');

      jsxc.storage.removeUserItem('windowlist');
      jsxc.storage.removeUserItem('own');
      jsxc.storage.removeUserItem('avatar', 'own');
      jsxc.storage.removeUserItem('otrlist');

      if (jsxc.options.loginForm.triggered) {
         switch (jsxc.options.loginForm.onConnected || 'submit') {
            case 'submit':
               jsxc.submitLoginForm();
               /* falls through */
            case false:
               jsxc.xmpp.connectionReady();
               return;
         }
      }

      // start chat

      jsxc.gui.init();
      $('#jsxc_roster').removeClass('jsxc_noConnection');
      jsxc.onMaster();
      jsxc.xmpp.conn.resume();
      jsxc.gui.dialog.close();
      $(document).trigger('attached.jsxc');
   },

   /**
    * Triggered if connection is attached
    * 
    * @private
    */
   attached: function() {

      jsxc.xmpp.conn.addHandler(jsxc.xmpp.onRosterChanged, 'jabber:iq:roster', 'iq', 'set');
      jsxc.xmpp.conn.addHandler(jsxc.xmpp.onMessage, null, 'message', 'chat');
      jsxc.xmpp.conn.addHandler(jsxc.xmpp.onReceived, null, 'message');
      jsxc.xmpp.conn.addHandler(jsxc.xmpp.onPresence, null, 'presence');

      var caps = jsxc.xmpp.conn.caps;
      var domain = jsxc.xmpp.conn.domain;

      if (caps && jsxc.options.get('carbons').enable) {
         var conditionalEnable = function() {
            if (jsxc.xmpp.conn.caps.hasFeatureByJid(domain, jsxc.CONST.NS.CARBONS)) {
               jsxc.xmpp.carbons.enable();
            }
         };

         if (typeof caps._knownCapabilities[caps._jidVerIndex[domain]] === 'undefined') {
            var _jidNodeIndex = JSON.parse(localStorage.getItem('strophe.caps._jidNodeIndex')) || {};

            $(document).on('caps.strophe', function onCaps(ev, from) {

               if (from !== domain) {
                  return;
               }

               conditionalEnable();

               $(document).off('caps.strophe', onCaps);
            });

            caps._requestCapabilities(jsxc.xmpp.conn.domain, _jidNodeIndex[domain], caps._jidVerIndex[domain]);
         } else {
            // We know server caps
            conditionalEnable();
         }
      }

      // Only load roaster if necessary
      if (!jsxc.restore || !jsxc.storage.getUserItem('buddylist')) {
         // in order to not overide existing presence information, we send
         // pres first after roster is ready
         $(document).one('cloaded.roster.jsxc', jsxc.xmpp.sendPres);

         $('#jsxc_roster > p:first').remove();

         var iq = $iq({
            type: 'get'
         }).c('query', {
            xmlns: 'jabber:iq:roster'
         });

         jsxc.xmpp.conn.sendIQ(iq, jsxc.xmpp.onRoster);
      } else {
         jsxc.xmpp.sendPres();
      }

      jsxc.xmpp.connectionReady();
   },

   /**
    * Triggered if the connection is ready
    */
   connectionReady: function() {

      // Load saved unique id
      jsxc.xmpp.conn._uniqueId = jsxc.storage.getItem('_uniqueId') || new Date().getTime();

      $(document).trigger('connectionReady.jsxc');
   },

   /**
    * Sends presence stanza to server.
    */
   sendPres: function() {
      // disco stuff
      if (jsxc.xmpp.conn.disco) {
         jsxc.xmpp.conn.disco.addIdentity('client', 'web', 'JSXC');
         jsxc.xmpp.conn.disco.addFeature(Strophe.NS.DISCO_INFO);
         jsxc.xmpp.conn.disco.addFeature(Strophe.NS.RECEIPTS);
      }

      // create presence stanza
      var pres = $pres();

      if (jsxc.xmpp.conn.caps) {
         // attach caps
         pres.c('c', jsxc.xmpp.conn.caps.generateCapsAttrs()).up();
      }

      var presState = jsxc.storage.getUserItem('presence') || 'online';
      if (presState !== 'online') {
         pres.c('show').t(presState).up();
      }

      var priority = jsxc.options.get('priority');
      if (priority && typeof priority[presState] !== 'undefined' && parseInt(priority[presState]) !== 0) {
         pres.c('priority').t(priority[presState]).up();
      }

      jsxc.debug('Send presence', pres.toString());
      jsxc.xmpp.conn.send(pres);
   },

   /**
    * Triggered if lost connection
    * 
    * @private
    */
   disconnected: function() {
      jsxc.debug('disconnected');

      jsxc.storage.removeItem('sid');
      jsxc.storage.removeItem('rid');
      jsxc.storage.removeItem('lastActivity');
      jsxc.storage.removeItem('hidden');
      jsxc.storage.removeUserItem('avatar', 'own');
      jsxc.storage.removeUserItem('otrlist');

      $(document).off('connected.jsxc', jsxc.xmpp.connected);
      $(document).off('attached.jsxc', jsxc.xmpp.attached);
      $(document).off('disconnected.jsxc', jsxc.xmpp.disconnected);
      $(document).off('ridChange', jsxc.xmpp.onRidChange);
      $(document).off('connfail.jsxc', jsxc.xmpp.onConnfail);
      $(document).off('authfail.jsxc', jsxc.xmpp.onAuthFail);

      jsxc.xmpp.conn = null;

      $('#jsxc_windowList').remove();

      if (jsxc.triggeredFromElement) {
         $(document).trigger('toggle.roster.jsxc', [ 'hidden', 0 ]);
         $('#jsxc_roster').remove();

         if (jsxc.triggeredFromLogout) {
            window.location = jsxc.options.logoutElement.attr('href');
         }
      } else {
         jsxc.gui.roster.noConnection();
      }

      window.clearInterval(jsxc.keepalive);
   },

   /**
    * Triggered on connection fault
    * 
    * @param {String} condition information why we lost the connection
    * @private
    */
   onConnfail: function(ev, condition) {
      jsxc.debug('XMPP connection failed: ' + condition);

      if (jsxc.options.loginForm.triggered) {
         jsxc.submitLoginForm();
      }
   },

   /**
    * Triggered on auth fail.
    * 
    * @private
    */
   onAuthFail: function() {

      if (jsxc.options.loginForm.triggered) {
         switch (jsxc.options.loginForm.onAuthFail || 'ask') {
            case 'ask':
               jsxc.gui.showAuthFail();
               break;
            case 'submit':
               jsxc.submitLoginForm();
               break;
            case 'quiet':
            case false:
               return;
         }
      }
   },

   /**
    * Triggered on initial roster load
    * 
    * @param {dom} iq
    * @private
    */
   onRoster: function(iq) {
      /*
       * <iq from='' type='get' id=''> <query xmlns='jabber:iq:roster'> <item
       * jid='' name='' subscription='' /> ... </query> </iq>
       */

      jsxc.debug('Load roster', iq);

      var buddies = [];

      $(iq).find('item').each(function() {
         var jid = $(this).attr('jid');
         var name = $(this).attr('name') || jid;
         var bid = jsxc.jidToBid(jid);
         var sub = $(this).attr('subscription');

         buddies.push(bid);

         jsxc.storage.removeUserItem('res', bid);

         jsxc.storage.saveBuddy(bid, {
            jid: jid,
            name: name,
            status: 0,
            sub: sub,
            res: []
         });

         jsxc.gui.roster.add(bid);
      });

      if (buddies.length === 0) {
         jsxc.gui.roster.empty();
      }

      jsxc.storage.setUserItem('buddylist', buddies);

      jsxc.gui.roster.loaded = true;
      jsxc.debug('Roster loaded');
      $(document).trigger('cloaded.roster.jsxc');
   },

   /**
    * Triggerd on roster changes
    * 
    * @param {dom} iq
    * @returns {Boolean} True to preserve handler
    * @private
    */
   onRosterChanged: function(iq) {
      /*
       * <iq from='' type='set' id=''> <query xmlns='jabber:iq:roster'> <item
       * jid='' name='' subscription='' /> </query> </iq>
       */

      jsxc.debug('onRosterChanged', iq);

      $(iq).find('item').each(function() {
         var jid = $(this).attr('jid');
         var name = $(this).attr('name') || jid;
         var bid = jsxc.jidToBid(jid);
         var sub = $(this).attr('subscription');
         // var ask = $(this).attr('ask');

         if (sub === 'remove') {
            jsxc.gui.roster.purge(bid);
         } else {
            var bl = jsxc.storage.getUserItem('buddylist');

            if (bl.indexOf(bid) < 0) {
               bl.push(bid); // (INFO) push returns the new length
               jsxc.storage.setUserItem('buddylist', bl);
            }

            var temp = jsxc.storage.saveBuddy(bid, {
               jid: jid,
               name: name,
               sub: sub
            });

            if (temp === 'updated') {

               jsxc.gui.update(bid);
               jsxc.gui.roster.reorder(bid);
            } else {
               jsxc.gui.roster.add(bid);
            }
         }

         // Remove pending friendship request from notice list
         if (sub === 'from' || sub === 'both') {
            var notices = jsxc.storage.getUserItem('notices');
            var noticeKey = null, notice;

            for (noticeKey in notices) {
               notice = notices[noticeKey];

               if (notice.fnName === 'gui.showApproveDialog' && notice.fnParams[0] === jid) {
                  jsxc.debug('Remove notice with key ' + noticeKey);

                  jsxc.notice.remove(noticeKey);
               }
            }
         }
      });

      if (!jsxc.storage.getUserItem('buddylist') || jsxc.storage.getUserItem('buddylist').length === 0) {
         jsxc.gui.roster.empty();
      } else {
         $('#jsxc_roster > p:first').remove();
      }

      // preserve handler
      return true;
   },

   /**
    * Triggered on incoming presence stanzas
    * 
    * @param {dom} presence
    * @private
    */
   onPresence: function(presence) {
      /*
       * <presence xmlns='jabber:client' type='unavailable' from='' to=''/>
       * 
       * <presence xmlns='jabber:client' from='' to=''> <priority>5</priority>
       * <c xmlns='http://jabber.org/protocol/caps'
       * node='http://psi-im.org/caps' ver='caps-b75d8d2b25' ext='ca cs
       * ep-notify-2 html'/> </presence>
       * 
       * <presence xmlns='jabber:client' from='' to=''> <show>chat</show>
       * <status></status> <priority>5</priority> <c
       * xmlns='http://jabber.org/protocol/caps' node='http://psi-im.org/caps'
       * ver='caps-b75d8d2b25' ext='ca cs ep-notify-2 html'/> </presence>
       */
      jsxc.debug('onPresence', presence);

      var ptype = $(presence).attr('type');
      var from = $(presence).attr('from');
      var jid = Strophe.getBareJidFromJid(from).toLowerCase();
      var r = Strophe.getResourceFromJid(from);
      var bid = jsxc.jidToBid(jid);
      var data = jsxc.storage.getUserItem('buddy', bid);
      var res = jsxc.storage.getUserItem('res', bid) || {};
      var status = null;
      var xVCard = $(presence).find('x[xmlns="vcard-temp:x:update"]');

      if (jid === Strophe.getBareJidFromJid(jsxc.storage.getItem("jid"))) {
         return true;
      }

      if (ptype === 'error') {
         $(document).trigger('error.presence.jsxc', [ from, presence ]);

         jsxc.error('[XMPP] ' + $(presence).attr('code'));
         return true;
      }

      // incoming friendship request
      if (ptype === 'subscribe') {
         jsxc.storage.setUserItem('friendReq', {
            jid: jid,
            approve: -1
         });
         jsxc.notice.add($.t('Friendship_request'), $.t('from') + ' ' + jid, 'gui.showApproveDialog', [ jid ]);

         return true;
      } else if (ptype === 'unavailable' || ptype === 'unsubscribed') {
         status = jsxc.CONST.STATUS.indexOf('offline');
      } else {
         var show = $(presence).find('show').text();
         if (show === '') {
            status = jsxc.CONST.STATUS.indexOf('online');
         } else {
            status = jsxc.CONST.STATUS.indexOf(show);
         }
      }

      if (status === 0) {
         delete res[r];
      } else {
         res[r] = status;
      }

      var maxVal = [];
      var max = 0, prop = null;
      for (prop in res) {
         if (res.hasOwnProperty(prop)) {
            if (max <= res[prop]) {
               if (max !== res[prop]) {
                  maxVal = [];
                  max = res[prop];
               }
               maxVal.push(prop);
            }
         }
      }

      if (data.status === 0 && max > 0) {
         // buddy has come online
         jsxc.notification.notify({
            title: data.name,
            msg: $.t('has_come_online'),
            source: bid
         });
      }

      data.status = max;
      data.res = maxVal;
      data.jid = jid;

      // Looking for avatar
      if (xVCard.length > 0) {
         var photo = xVCard.find('photo');

         if (photo.length > 0 && photo.text() !== data.avatar) {
            jsxc.storage.removeUserItem('avatar', data.avatar);
            data.avatar = photo.text();
         }
      }

      // Reset jid
      if (jsxc.gui.window.get(bid).length > 0) {
         jsxc.gui.window.get(bid).data('jid', jid);
      }

      jsxc.storage.setUserItem('buddy', bid, data);
      jsxc.storage.setUserItem('res', bid, res);

      jsxc.debug('Presence (' + from + '): ' + status);

      jsxc.gui.update(bid);
      jsxc.gui.roster.reorder(bid);

      $(document).trigger('presence.jsxc', [ from, status, presence ]);

      // preserve handler
      return true;
   },

   /**
    * Triggered on incoming message stanzas
    * 
    * @param {dom} presence
    * @returns {Boolean}
    * @private
    */
   onMessage: function(stanza) {

      var forwarded = $(stanza).find('forwarded[xmlns="' + jsxc.CONST.NS.FORWARD + '"]');
      var message, carbon;

      if (forwarded.length > 0) {
         message = forwarded.find('> message');
         forwarded = true;
         carbon = $(stanza).find('> [xmlns="' + jsxc.CONST.NS.CARBONS + '"]');

         if (carbon.length === 0) {
            carbon = false;
         }

         jsxc.debug('Incoming forwarded message', message);
      } else {
         message = stanza;
         forwarded = false;
         carbon = false;

         jsxc.debug('Incoming message', message);
      }

      var body = $(message).find('body:first').text();

      if (!body || (body.match(/\?OTR/i) && forwarded)) {
         return true;
      }

      var type = $(message).attr('type');
      var from = $(message).attr('from');
      var mid = $(message).attr('id');
      var bid;

      var delay = $(message).find('delay[xmlns="urn:xmpp:delay"]');

      var stamp = (delay.length > 0) ? new Date(delay.attr('stamp')) : new Date();
      stamp = stamp.getTime();

      if (carbon) {
         var direction = (carbon.prop("tagName") === 'sent') ? 'out' : 'in';
         bid = jsxc.jidToBid((direction === 'out') ? $(message).attr('to') : from);

         jsxc.gui.window.postMessage(bid, direction, body, false, forwarded, stamp);

         return true;

      } else if (forwarded) {
         // Someone forwarded a message to us

         body = from + ' ' + $.t('to') + ' ' + $(stanza).attr('to') + '"' + body + '"';

         from = $(stanza).attr('from');
      }

      var jid = Strophe.getBareJidFromJid(from);
      bid = jsxc.jidToBid(jid);
      var data = jsxc.storage.getUserItem('buddy', bid);
      var request = $(message).find("request[xmlns='urn:xmpp:receipts']");

      if (data === null) {
         // jid not in roster

         var chat = jsxc.storage.getUserItem('chat', bid) || [];

         if (chat.length === 0) {
            jsxc.notice.add($.t('Unknown_sender'), $.t('You_received_a_message_from_an_unknown_sender') + ' (' + bid + ').', 'gui.showUnknownSender', [ bid ]);
         }

         var msg = jsxc.removeHTML(body);
         msg = jsxc.escapeHTML(msg);

         jsxc.storage.saveMessage(bid, 'in', msg, false, forwarded, stamp);

         return true;
      }

      var win = jsxc.gui.window.init(bid);

      // If we now the full jid, we use it
      if (type === 'chat') {
         win.data('jid', from);
         jsxc.storage.updateUserItem('buddy', bid, {
            jid: from
         });
      }

      $(document).trigger('message.jsxc', [ from, body ]);

      // create related otr object
      if (jsxc.master && !jsxc.otr.objects[bid]) {
         jsxc.otr.create(bid);
      }

      if (!forwarded && mid !== null && request.length && data !== null && (data.sub === 'both' || data.sub === 'from') && type === 'chat') {
         // Send received according to XEP-0184
         jsxc.xmpp.conn.send($msg({
            to: from
         }).c('received', {
            xmlns: 'urn:xmpp:receipts',
            id: mid
         }));
      }

      if (jsxc.otr.objects.hasOwnProperty(bid)) {
         jsxc.otr.objects[bid].receiveMsg(body, {
            stamp: stamp,
            forwarded: forwarded
         });
      } else {
         jsxc.gui.window.postMessage(bid, 'in', body, false, forwarded, stamp);
      }

      // preserve handler
      return true;
   },

   /**
    * Triggerd if the rid changed
    * 
    * @param {event} ev
    * @param {obejct} data
    * @private
    */
   onRidChange: function(ev, data) {
      jsxc.storage.setItem('rid', data.rid);
   },

   /**
    * response to friendship request
    * 
    * @param {string} from jid from original friendship req
    * @param {boolean} approve
    */
   resFriendReq: function(from, approve) {
      if (jsxc.master) {
         jsxc.xmpp.conn.send($pres({
            to: from,
            type: (approve) ? 'subscribed' : 'unsubscribed'
         }));

         jsxc.storage.removeUserItem('friendReq');
         jsxc.gui.dialog.close();

      } else {
         jsxc.storage.updateUserItem('friendReq', 'approve', approve);
      }
   },

   /**
    * Add buddy to my friends
    * 
    * @param {string} username jid
    * @param {string} alias
    */
   addBuddy: function(username, alias) {
      var bid = jsxc.jidToBid(username);

      if (jsxc.master) {
         // add buddy to roster (trigger onRosterChanged)
         var iq = $iq({
            type: 'set'
         }).c('query', {
            xmlns: 'jabber:iq:roster'
         }).c('item', {
            jid: username,
            name: alias || ''
         });
         jsxc.xmpp.conn.sendIQ(iq);

         // send subscription request to buddy (trigger onRosterChanged)
         jsxc.xmpp.conn.send($pres({
            to: username,
            type: 'subscribe'
         }));

         jsxc.storage.removeUserItem('add_' + bid);
      } else {
         jsxc.storage.setUserItem('add_' + bid, {
            username: username,
            alias: alias || null
         });
      }
   },

   /**
    * Remove buddy from my friends
    * 
    * @param {type} jid
    */
   removeBuddy: function(jid) {
      var bid = jsxc.jidToBid(jid);

      // Shortcut to remove buddy from roster and cancle all subscriptions
      var iq = $iq({
         type: 'set'
      }).c('query', {
         xmlns: 'jabber:iq:roster'
      }).c('item', {
         jid: Strophe.getBareJidFromJid(jid),
         subscription: 'remove'
      });
      jsxc.xmpp.conn.sendIQ(iq);

      jsxc.gui.roster.purge(bid);
   },

   onReceived: function(message) {
      var from = $(message).attr('from');
      var jid = Strophe.getBareJidFromJid(from);
      var bid = jsxc.jidToBid(jid);
      var received = $(message).find("received[xmlns='urn:xmpp:receipts']");

      if (received.length) {
         var receivedId = received.attr('id').replace(/:/, '-');
         var chat = jsxc.storage.getUserItem('chat', bid);
         var i;

         for (i = chat.length - 1; i >= 0; i--) {
            if (chat[i].uid === receivedId) {
               chat[i].received = true;

               $('#' + receivedId).addClass('jsxc_received');

               jsxc.storage.setUserItem('chat', bid, chat);
               break;
            }
         }
      }

      return true;
   },

   /**
    * Public function to send message.
    * 
    * @memberOf jsxc.xmpp
    * @param bid css jid of user
    * @param msg message
    * @param uid unique id
    */
   sendMessage: function(bid, msg, uid) {
      if (jsxc.otr.objects.hasOwnProperty(bid)) {
         jsxc.otr.objects[bid].sendMsg(msg, uid);
      } else {
         jsxc.xmpp._sendMessage(jsxc.gui.window.get(bid).data('jid'), msg, uid);
      }
   },

   /**
    * Create message stanza and send it.
    * 
    * @memberOf jsxc.xmpp
    * @param jid Jabber id
    * @param msg Message
    * @param uid unique id
    * @private
    */
   _sendMessage: function(jid, msg, uid) {
      var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(jid)) || {};
      var isBar = (Strophe.getBareJidFromJid(jid) === jid);
      var type = data.type || 'chat';

      var xmlMsg = $msg({
         to: jid,
         type: type,
         id: uid
      }).c('body').t(msg);

      if (jsxc.xmpp.carbons.enabled && msg.match(/^\?OTR/)) {
         xmlMsg.up().c("private", {
            xmlns: jsxc.CONST.NS.CARBONS
         });
      }

      if (type === 'chat' && (isBar || jsxc.xmpp.conn.caps.hasFeatureByJid(jid, Strophe.NS.RECEIPTS))) {
         // Add request according to XEP-0184
         xmlMsg.up().c('request', {
            xmlns: 'urn:xmpp:receipts'
         });
      }

      jsxc.xmpp.conn.send(xmlMsg);
   },

   /**
    * This function loads a vcard.
    * 
    * @memberOf jsxc.xmpp
    * @param bid
    * @param cb
    * @param error_cb
    */
   loadVcard: function(bid, cb, error_cb) {
      if (jsxc.master) {
         jsxc.xmpp.conn.vcard.get(cb, bid, error_cb);
      } else {
         jsxc.storage.setUserItem('vcard', bid, 'request:' + (new Date()).getTime());

         $(document).one('loaded.vcard.jsxc', function(ev, result) {
            if (result && result.state === 'success') {
               cb($(result.data).get(0));
            } else {
               error_cb();
            }
         });
      }
   },

   /**
    * Retrieves capabilities.
    * 
    * @memberOf jsxc.xmpp
    * @param jid
    * @returns List of known capabilities
    */
   getCapabilitiesByJid: function(jid) {
      if (jsxc.xmpp.conn) {
         return jsxc.xmpp.conn.caps.getCapabilitiesByJid(jid);
      }

      var jidVerIndex = JSON.parse(localStorage.getItem('strophe.caps._jidVerIndex')) || {};
      var knownCapabilities = JSON.parse(localStorage.getItem('strophe.caps._knownCapabilities')) || {};

      if (jidVerIndex[jid]) {
         return knownCapabilities[jidVerIndex[jid]];
      }

      return null;
   }
};

/**
 * Handle carbons (XEP-0280);
 * 
 * @namespace jsxc.xmpp.carbons
 */
jsxc.xmpp.carbons = {
   enabled: false,

   /**
    * Enable carbons.
    * 
    * @memberOf jsxc.xmpp.carbons
    * @param cb callback
    */
   enable: function(cb) {
      var iq = $iq({
         type: 'set'
      }).c('enable', {
         xmlns: jsxc.CONST.NS.CARBONS
      });

      jsxc.xmpp.conn.sendIQ(iq, function() {
         jsxc.xmpp.carbons.enabled = true;

         jsxc.debug('Carbons enabled');

         if (cb) {
            cb.call(this);
         }
      }, function(stanza) {
         jsxc.warn('Could not enable carbons', stanza);
      });
   },

   /**
    * Disable carbons.
    * 
    * @memberOf jsxc.xmpp.carbons
    * @param cb callback
    */
   disable: function(cb) {
      var iq = $iq({
         type: 'set'
      }).c('disable', {
         xmlns: jsxc.CONST.NS.CARBONS
      });

      jsxc.xmpp.conn.sendIQ(iq, function() {
         jsxc.xmpp.carbons.enabled = false;

         jsxc.debug('Carbons disabled');

         if (cb) {
            cb.call(this);
         }
      }, function(stanza) {
         jsxc.warn('Could not disable carbons', stanza);
      });
   },

   /**
    * Enable/Disable carbons depending on options key.
    * 
    * @memberOf jsxc.xmpp.carbons
    * @param err error message
    */
   refresh: function(err) {
      if (err === false) {
         return;
      }

      if (jsxc.options.get('carbons').enable) {
         return jsxc.xmpp.carbons.enable();
      }

      return jsxc.xmpp.carbons.disable();
   }
};

}(jQuery));