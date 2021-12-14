/*
* Project: Bootstrap Notify = v4.0.0
* Description: Turns standard Bootstrap alerts into "Growl-like" notifications.
* Author: Mouse0270 aka Robert McIntosh
* License: MIT License
* Website: https://github.com/mouse0270/bootstrap-growl
*/

/* global define:false, require: false, jQuery:false */

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('jquery'));
	} else {
		// Browser globals
		factory(jQuery);
	}
}(function ($) {
	// Create the defaults once
	var defaults = {
		element: 'body',
		position: null,
		type: 'info',
		allowDismiss: true,
		allowDuplicates: true,
		newestOnTop: false,
		showProgressBar: false,
		placement: {
			from: 'top',
			align: 'right'
		},
		restrict: 0,
		offset: 15,
		spacing: 10,
		width: null,
		zIndex: 1031,
		delay: 5000,
		timer: 1000,
		urlTarget: '_blank',
		mouseOver: 'pause',
		animate: {
			enter: 'animated fadeIn',
			exit: 'animated fadeOut faster'
		},
		onShow: null,
		onShown: null,
		onDismiss: null,
		onTimer: null,
		onClose: null,
		onClosed: null,
        onClick: null,
		iconType: 'class',
		template: [
			'<div data-notify="container" class="boostrap-notify d-flex justify-content-{5}">',
			  '<a href="{3}" target="{4}" data-notify="url" class="alert alert-{0} alert-dismissible mb-0" role="alert">',
				  '<button type="button" class="close fas fa-times" data-notify="dismiss" aria-label="close"></button>',
				  '<span data-notify="icon"></span>',
				  '<h4 class="alert-heading mb-1" data-notify="title">{1}</h4>',
				  '<p class="mb-0" data-notify="message">{2}</p>',
				  '<div class="progress" data-notify="progressbar">',
				      '<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%;"></div>',
				  '</div>',
				'</a>',
			'</div>'].join('')
	};

	String.format = function () {
		var args = arguments;
        var str = arguments[0];
        return str.replace(/(\{\{\d\}\}|\{\d\})/g, function (str) {
            if (str.substring(0, 2) === "{{") return str;
            var num = parseInt(str.match(/\d/)[0]);
            return args[num + 1];
        });
	};

	function isDuplicateNotification(notification) {
		var isDupe = false;

		$('[data-notify="container"]').each(function (i, el) {
			var $el = $(el);
			var title = $el.find('[data-notify="title"]').html().trim();
			var message = $el.find('[data-notify="message"]').html().trim();

			// The input string might be different than the actual parsed HTML string!
			// (<br> vs <br /> for example)
			// So we have to force-parse this as HTML here!
			var isSameTitle = title === $("<div>" + notification.settings.content.title + "</div>").html().trim();
			var isSameMsg = message === $("<div>" + notification.settings.content.message + "</div>").html().trim();
			var isSameType = $el.hasClass('alert-' + notification.settings.type);

			if (isSameTitle && isSameMsg && isSameType) {
				//we found the dupe. Set the var and stop checking.
				isDupe = true;
			}
			
			return !isDupe;
		});

		return isDupe;
	}

	function Notify(element, content, options) {
		// Setup Content of Notify
		var contentObj = {
			content: {
				message: typeof content === 'object' ? content.message : content,
				title: content.title ? content.title : '',
				icon: content.icon ? content.icon : '',
				url: content.url ? content.url : '',
				target: content.target ? content.target : '',
				id: content.id ? content.id : ''
			}
		};
		

		options = $.extend(true, {}, contentObj, options);
		this.settings = $.extend(true, {}, defaults, options);
		this._defaults = defaults;
		
		if (this.settings.content.target === '') {
			this.settings.content.target = this.settings.urlTarget;
		}
		
		this.animations = {
			start: 'webkitAnimationStart oanimationstart MSAnimationStart animationstart',
			end: 'webkitAnimationEnd oanimationend MSAnimationEnd animationend'
		};

		if (typeof this.settings.offset === 'number') {
			this.settings.offset = {
				x: this.settings.offset,
				y: this.settings.offset
			};
		}

		//if duplicate messages are not allowed, then only continue if this new message is not a duplicate of one that it already showing
		if (this.settings.allowDuplicates || (!this.settings.allowDuplicates && !isDuplicateNotification(this))) {
			this.init();

			// if restrict
			var _length = $('[data-notify="container"]').length;
			if (this.settings.restrict > 0 && _length >= this.settings.restrict) {
				$('[data-notify="container"]').find('button[data-notify="dismiss"]').slice(0,_length-this.settings.restrict).trigger('click');
			}
		}
	}

	$.extend(Notify.prototype, {
		init: function () {
			var self = this;

			this.buildNotify();
			if (this.settings.content.icon) {
				this.setIcon();
			}
			if (this.settings.content.url != '') {
				this.styleURL();
			}
			this.styleDismiss();
			this.placement();
			this.bind();

			this.notify = {
				$ele: this.$ele,
				update: function (command, update) {
					var commands = {};
					if (typeof command === "string") {
						commands[command] = update;
					} else {
						commands = command;
					}
					for (var cmd in commands) {
						switch (cmd) {
							case "type":
								this.$ele.removeClass('alert-' + self.settings.type).addClass('alert-' + commands[cmd]);
								self.settings.type = commands[cmd];
								break;
							case "icon":
								var $icon = this.$ele.find('[data-notify="icon"]');
								if (self.settings.iconType.toLowerCase() === 'class') {
									$icon.removeClass(self.settings.content.icon).addClass(commands[cmd]);
								} else {
									if (!$icon.is('img')) {
										$icon.find('img');
									}
									$icon.attr('src', commands[cmd]);
								}
								self.settings.content.icon = commands[command];
								break;
							case "progress":
								var newDelay = self.settings.delay - (self.settings.delay * (commands[cmd] / 100));
								this.$ele.data('notify-delay', newDelay);
								this.$ele.find('[data-notify="progressbar"] > div').attr('aria-valuenow', commands[cmd]).css('width', commands[cmd] + '%');
								break;
							case "url":
								if ( commands[cmd] ) {
									this.$ele.find('[data-notify="url"]').attr('href', commands[cmd] );
								}
								else {
									this.$ele.find('[data-notify="url"]').removeAttr('href');
									this.$ele.find('[data-notify="url"]').removeAttr('target');
								}				
								break;
							case "target":
								if ( this.$ele.find('[data-notify="url"]').length > 0 && this.$ele.find('[data-notify="url"]')[0].hasAttribute('url') ) {
									this.$ele.find('[data-notify="url"]').attr('target', commands[cmd]);
								}	
								break;
							default:
								this.$ele.find('[data-notify="' + cmd + '"]').html(commands[cmd]);
						}
					}
					var posX = this.$ele.outerHeight() + parseInt(self.settings.spacing) + parseInt(self.settings.offset.y);
					self.reposition(posX);
				},
				close: function () {
					self.close();
				}
			};

		},
		buildNotify: function () {
			var content = this.settings.content;
			this.$ele = $( String.format(this.settings.template, this.settings.type, content.title, content.message, content.url, content.target,
			    this.settings.placement.align == 'left' ? 'start' : (this.settings.placement.align == 'right' ? 'end' : this.settings.placement.align) ) );
				
			this.$ele.attr('data-notify-position', this.settings.placement.from + '-' + this.settings.placement.align);
			
			if (content.title.length === 0) {
				this.$ele.find('[data-notify="title"]').css('display', 'none');
			}
			
			if (!this.settings.allowDismiss) {
				this.$ele.find('[data-notify="dismiss"]').css('display', 'none');
				this.$ele.children('.alert').removeClass('alert-dismissible');
			}
			
			if ((this.settings.delay <= 0 && !this.settings.showProgressBar) || !this.settings.showProgressBar) {
				this.$ele.find('[data-notify="progressbar"]').remove();
			}
			
			if (content.id.length !== 0) {
				this.$ele.find('[data-notify="dismiss"]').attr('data-notify-id', content.id);
			}
			
			if (content.url.length === 0) {
				this.$ele.find('[data-notify="url"]').removeAttr('href');
				this.$ele.find('[data-notify="url"]').removeAttr('target');
			}
		},
		setIcon: function () {
			if (this.settings.iconType.toLowerCase() === 'class') {
				this.$ele.find('[data-notify="icon"]').addClass(this.settings.content.icon);
			} else {
				if (this.$ele.find('[data-notify="icon"]').is('img')) {
					this.$ele.find('[data-notify="icon"]').attr('src', this.settings.content.icon);
				} else {
					this.$ele.find('[data-notify="icon"]').append('<img src="' + this.settings.content.icon + '" alt="Notify Icon" />');
				}
			}
		},
		styleDismiss: function () {
			/*
			this.$ele.find('[data-notify="dismiss"]').css({
				position: 'absolute',
				right: '10px',
				top: '5px',
				zIndex: this.settings.zIndex + 2
			});
			*/
		},
		styleURL: function () {
			/*
			this.$ele.find('[data-notify="url"]').css({
				backgroundImage: 'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)',
				height: '100%',
				left: 0,
				position: 'absolute',
				top: 0,
				width: '100%',
				zIndex: this.settings.zIndex + 1
			});
			*/
		},
		placement: function () {
			var self = this,
				offsetAmt = this.settings.offset.y,
				css = {
					//display: 'inline-block',
					margin: '0 auto',
					position: this.settings.position ? this.settings.position : (this.settings.element === 'body' ? 'fixed' : 'absolute'),
					transition: 'all .5s ease-in-out',
					// Si la posicion es en el centro se coloca con un indice inferior para no solapar los de los laterales
					zIndex: this.settings.placement.align == 'center' ? this.settings.zIndex - 1 : this.settings.zIndex,
					width: 'auto'
				},
				hasAnimation = false,
				settings = this.settings;

			$('[data-notify-position="' + this.settings.placement.from + '-' + this.settings.placement.align + '"]:not([data-closing="true"])').each(function () {
				offsetAmt = Math.max(offsetAmt, parseInt($(this).css(settings.placement.from)) + parseInt($(this).outerHeight()) + parseInt(settings.spacing));
			});
			
			if (this.settings.newestOnTop === true) {
				offsetAmt = this.settings.offset.y;
			}
			
			css[this.settings.placement.from] = offsetAmt + 'px';

			switch (this.settings.placement.align) {
				case "left":
				case "right":
					css[this.settings.placement.align] = 0;
					break;
				case "center":
					css.left = 0;
					css.right = 0;
					break;
			}		
			
			// se agrega un margen igualitario
			css.marginLeft = this.settings.offset.x + 'px';
			css.marginRight = this.settings.offset.x + 'px';
			
			if ( this.settings.width ) {
				this.$ele.children('.alert').css('width', this.settings.width);
			}

			if ( this.settings.showProgressBar === true ) {
				this.$ele.find('[data-notify="progressbar"] > div')
					.css('webkit-transition', 'width ' + (this.settings.timer/1000) + 's linear')
					.css('o-transition', 'width ' + (this.settings.timer/1000) + 's linear')
					.css('transition', 'width ' + (this.settings.timer/1000) + 's linear');
			}
			
			this.$ele.css(css).addClass(this.settings.animate.enter);
			$.each(Array('webkit-', 'moz-', 'o-', 'ms-', ''), function (index, prefix) {
				self.$ele[0].style[prefix + 'AnimationIterationCount'] = 1;
			});

			$(this.settings.element).append(this.$ele);

			if (this.settings.newestOnTop === true) {
				offsetAmt = (parseInt(offsetAmt) + parseInt(this.settings.spacing)) + this.$ele.outerHeight();
				this.reposition(offsetAmt);
			}

			if ($.isFunction(self.settings.onShow)) {
				self.settings.onShow.call(this.$ele);
			}

			this.$ele.one(this.animations.start, function () {
				hasAnimation = true;
			}).one(this.animations.end, function () {
				self.$ele.removeClass(self.settings.animate.enter);
				if ($.isFunction(self.settings.onShown)) {
					self.settings.onShown.call(this);
				}
			});

			setTimeout(function () {
				if (!hasAnimation) {
					if ($.isFunction(self.settings.onShown)) {
						self.settings.onShown.call(this);
					}
				}
			}, 600);
		},
		bind: function () {
			var self = this;

			this.$ele.find('[data-notify="dismiss"]').on('click', function (event) {
				if ($.isFunction(self.settings.onDismiss)) {
				  self.settings.onDismiss.call(this);
				}

				self.close();
				return false;
			});

			if ($.isFunction(self.settings.onClick)) {
			    this.$ele.children('.alert').on('click', function (event) {
			        if ( event.target != self.$ele.find('[data-notify="dismiss"]')[0] ) {
			            self.settings.onClick.call(this, event);
			        }
			    });
			}

			this.$ele.children('.alert').mouseover(function () {
				$(this).parent().data('data-hover', "true");
			}).mouseout(function () {
				$(this).parent().data('data-hover', "false");
			});
			this.$ele.data('data-hover', "false");

			if (this.settings.delay > 0) {
				self.$ele.data('notify-delay', self.settings.delay);
				
				this.timerInterval = setInterval(function () {
					var delay = parseInt(self.$ele.data('notify-delay')) - self.settings.timer;
					
					if ((self.$ele.data('data-hover') === 'false' && self.settings.mouseOver === "pause") || self.settings.mouseOver != "pause") {
						var percent = ((self.settings.delay - delay) / self.settings.delay) * 100;
						self.$ele.data('notify-delay', delay);
						self.$ele.find('[data-notify="progressbar"] > div').attr('aria-valuenow', percent).css('width', percent + '%');
					}
					
					if (delay <= -(self.settings.timer)) {
						if ($.isFunction(self.settings.onTimer)) {
						  self.settings.onTimer.call(self.$ele);
						}
						self.close();
					}
					
				}, self.settings.timer);
			}
		},
		close: function () {
			clearInterval(this.timerInterval);
			var self = this,
				posX = parseInt(this.$ele.css(this.settings.placement.from)),
				hasAnimation = false;

			this.$ele.attr('data-closing', 'true').addClass(this.settings.animate.exit);
			self.reposition(posX);

			if ($.isFunction(self.settings.onClose)) {
				self.settings.onClose.call(this.$ele);
			}

			this.$ele.one(this.animations.start, function () {
				hasAnimation = true;
			}).one(this.animations.end, function () {
				$(this).remove();
				if ($.isFunction(self.settings.onClosed)) {
					self.settings.onClosed.call(this);
				}
			});

			setTimeout(function () {
				if (!hasAnimation) {
					self.$ele.remove();
					if ($.isFunction(self.settings.onClosed)) {
						self.settings.onClosed.call(this);
					}
				}
			}, 600);
		},
		reposition: function (posX) {
			var self = this,
				notifies = '[data-notify-position="' + this.settings.placement.from + '-' + this.settings.placement.align + '"]:not([data-closing="true"])',
				$elements = this.$ele.nextAll(notifies);
				
			if (this.settings.newestOnTop === true) {
				$elements = this.$ele.prevAll(notifies);
			}
			
			$elements.each(function () {
				$(this).css(self.settings.placement.from, posX);
				posX = (parseInt(posX) + parseInt(self.settings.spacing)) + $(this).outerHeight();
			});
		}
	});

	$.notify = function (content, options) {
		var plugin = new Notify(this, content, options);
		return plugin.notify;
	};
	
	$.notifyDefaults = function (options) {
		defaults = $.extend(true, {}, defaults, options);
		return defaults;
	};

	$.notifyClose = function (selector) {

		if (typeof selector === "undefined" || selector === "all") {
			$('[data-notify]').find('[data-notify="dismiss"]').trigger('click');
		} else if(selector === 'success' || selector === 'info' || selector === 'warning' || selector === 'danger'){
			$('.alert-' + selector + '[data-notify]').find('[data-notify="dismiss"]').trigger('click');
		} else if(selector){
			$(selector + '[data-notify]').find('[data-notify="dismiss"]').trigger('click');
		}
		else {
			$('[data-notify-position="' + selector + '"]').find('[data-notify="dismiss"]').trigger('click');
		}
	};

	$.notifyCloseExcept = function (selector) {

		if(selector === 'success' || selector === 'info' || selector === 'warning' || selector === 'danger'){
			$('[data-notify]').not('.alert-' + selector).find('[data-notify="dismiss"]').trigger('click');
		} else{
			$('[data-notify]').not(selector).find('[data-notify="dismiss"]').trigger('click');
		}
	};

}));
