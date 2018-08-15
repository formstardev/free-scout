var fs_sidebar_menu_applied = false;
var fs_loader_timeout;

// Default validation options
// https://devhints.io/parsley
window.ParsleyConfig = window.ParsleyConfig || {};
$.extend(window.ParsleyConfig, {
	excluded: '.note-codable, [data-parsley-exclude]',
    errorClass: 'has-error',
    //successClass: 'has-success',
    classHandler: function(ParsleyField) {
        return ParsleyField.$element.parents('.form-group:first');
    },
    errorsContainer: function(ParsleyField) {
    	var help_block = ParsleyField.$element.parent().children('.help-block:first');

    	if (help_block) {
    		return help_block;
    	} else {
    		return ParsleyField.$element;
    		//return ParsleyField.$element.parents('.form-group:first');
    	}
    },
    errorsWrapper: '<div class="help-block"></div>',
    errorTemplate: '<div></div>'
});

// Configuring editor
var EditorAttachmentButton = function (context) {
	var ui = $.summernote.ui;

	// create button
	var button = ui.button({
		contents: '<i class="glyphicon glyphicon-paperclip"></i>',
		tooltip: Lang.get("messages.upload_attachments"),
		container: 'body',
		click: function () {
			var element = document.createElement('div');
			element.innerHTML = '<input type="file" multiple>';
			var fileInput = element.firstChild;

			fileInput.addEventListener('change', function() {
				if (fileInput.files) {
					for (var i = 0; i < fileInput.files.length; i++) {
						editorSendFile(fileInput.files[i], true);	
		            }
			    }
			});

			fileInput.click();
		}
	});

	return button.render();   // return button as jquery object
}
var EditorSavedRepliesButton = function (context) {
	var ui = $.summernote.ui;

	// create button
	var button = ui.button({
		contents: '<i class="glyphicon glyphicon-comment"></i>',
		tooltip: Lang.get("messages.saved_replies"),
		container: 'body',
		click: function () {
			alert('todo: implement saved replies');
		}
	});

	return button.render();   // return button as jquery object
}
var EditorSaveDraftButton = function (context) {
	var ui = $.summernote.ui;

	// create button
	var button = ui.button({
		contents: '<i class="glyphicon glyphicon-ok-circle"></i>',
		tooltip: Lang.get("messages.save_draft"),
		container: 'body',
		click: function () {
			alert('todo: implement saving draft');
		}
	});

	return button.render();   // return button as jquery object
}
var EditorDiscardButton = function (context) {
	var ui = $.summernote.ui;

	// create button
	var button = ui.button({
		contents: '<i class="glyphicon glyphicon-trash"></i>',
		tooltip: Lang.get("messages.discard"),
		container: 'body',
		click: function () {
			alert('todo: implement discarding a draft');
		}
	});

	return button.render();   // return button as jquery object
}

$(document).ready(function(){

	// Tooltips
    $('[data-toggle="tooltip"]').tooltip({container: 'body'});

    // Popover
    $('[data-toggle="popover"]').popover({
	    container: 'body'
	});

    // Submenu
    $('.sidebar-menu-toggle').click(function(event) {
    	event.stopPropagation();
		$(this).parent().children('.sidebar-menu:first').toggleClass('active');
		$(this).toggleClass('active');
		if (!fs_sidebar_menu_applied) {
			$('body').click(function() {
				$('.sidebar-menu, .sidebar-menu-toggle').removeClass('active');
			});
		}
	});

	// Floating alerts
	fsFloatingAlertsInit();

	// Editor
	(function($) {
	$.summernote.lang['en-US'].image.dragImageHere = Lang.get("messages.drag_image_file");
	$.summernote.lang['en-US'].image.dropImage = Lang.get("messages.drag_image_file");
})(jQuery);
});

function mailboxUpdateInit(from_name_custom)
{
	$(document).ready(function(){
		// https://github.com/Studio-42/elFinder/wiki/Integration-with-Multiple-Summernote-%28fixed-functions%29
		// https://stackoverflow.com/questions/21628222/summernote-image-upload
		// https://www.kerneldev.com/2018/01/11/using-summernote-wysiwyg-editor-with-laravel/
		// https://gist.github.com/abr4xas/22caf07326a81ecaaa195f97321da4ae
		$('#signature').summernote({
			minHeight: 120,
			dialogsInBody: true,
			disableResizeEditor: true,
			followingToolbar: false,
			toolbar: [
			    // [groupName, [list of button]]
			    ['style', ['bold', 'italic', 'underline', 'ul', 'ol', 'link', 'codeview']],
			]
		});
		$('.note-statusbar').remove();

	    $('#from_name').change(function(event) {
			if ($(this).val() == from_name_custom) {
				$('#from_name_custom_container').removeClass('hidden');
			} else {
				$('#from_name_custom_container').addClass('hidden');
			}
		});
	});
}

function permissionsInit()
{
	$(document).ready(function(){
	    $('.sel-all').click(function(event) {
			$("#permissions-fields input").attr('checked', 'checked');
		});
		$('.sel-none').click(function(event) {
			$("#permissions-fields input").removeAttr('checked');
		});
	});
}

function mailboxConnectionInit(out_method_smtp)
{
	$(document).ready(function(){
	    $(':input[name="out_method"]').on('change', function(event) {
	    	var method = $(':input[name="out_method"]:checked').val();
			$('.out_method_options').addClass('hidden');
			$('#out_method_'+method+'_options').removeClass('hidden');

			if (parseInt(method) == parseInt(out_method_smtp)) {
				$('#out_method_'+out_method_smtp+'_options :input').attr('required', 'required');
			} else {
				$('#out_method_'+out_method_smtp+'_options :input').removeAttr('required');
			}
		});
	});
}

function userCreateInit()
{
	$(document).ready(function(){
	    $('#send_invite').on('change', function(event) {
	    	if ($(this).is(':checked')) {
	    		$('.no-send-invite').addClass('hidden');
	    		$('#password').removeAttr('required');
	    	} else {
				$('.no-send-invite').removeClass('hidden');
				$('#password').attr('required', 'required');
	    	}
		});
	});
}

function logsInit()
{
	$(document).ready(function() {
	    $('#table-logs').DataTable({
	   		"ordering": false
	    });
	} );
}

function multiInputInit()
{
	$(document).ready(function() {
	    $('.multi-add').click(function() {
	    	var clone = $(this).parents('.multi-container:first').children('.multi-item:first').clone(true, true);
	    	clone.find(':input').val('');
	    	clone.insertAfter($(this).parents('.multi-container:first').children('.multi-item:last'));
		});
		$('.multi-remove').click(function() {
	    	if ($(this).parents('.multi-container:first').children('.multi-item').length > 1) {
	    		$(this).parents('.multi-item:first').remove();
	    	} else {
	    		$(this).parents('.multi-item:first').children(':input').val('');
	    	}
		});
	} );
}

function fsAjax(data, url, success_callback, no_loader, error_callback)
{
    // Setup AJAX
	ajaxSetup();

	// Show loader
	if (typeof(no_loader) == "undefined" || !no_loader) {
		loaderShow(true);
	}

	if (typeof(error_callback) == "undefined" || !error_callback) {
		error_callback = function() {
			showFloatingAlert('error', Lang.get("messages.ajax_error"));
			loaderHide();
			$("button[data-loading-text!='']:disabled").button('reset');
		};
	}

	// If this is conversation ajax request, add folder_id to the URL
	if (url.indexOf('/conversation/') != -1) {
		var folder_id = getQueryParam('folder_id');
		if (folder_id) {
			url += '?folder_id='+folder_id;
		}
	}

	$.ajax({
		url: url,
		method: 'post',
		dataType: 'json',
		data: data,
		success: success_callback,
		error: error_callback
   });
}

// Show loader
function loaderShow(delay)
{
	if (typeof(delay) != "undefined" && delay) {
		fs_loader_timeout = setTimeout(function() {
			$("#loader-main").fadeIn();
	    }, 1000);
	} else {
		$("#loader-main").fadeIn();
	}
}

function loaderHide()
{
	$("#loader-main").hide();
	clearTimeout(fs_loader_timeout);
}

// Display floating alerts
function fsFloatingAlertsInit()
{
	var alerts = $(".alert-floating:hidden");
			
	alerts.each(function(i, obj) {
		$(obj).css('display', 'flex');
		setTimeout(function(){
		    obj.remove(); 
		}, 7000);
	});

	if (alerts.length) {
		$('body').click(function() {
			alerts.remove();
		});
	}
}

function showFloatingAlert(type, msg)
{
	var icon = 'ok';
	var alert_class = 'success';

	if (type == 'error') {
		icon = 'exclamation-sign';
		alert_class = 'danger';
	}

	var html = '<div class="alert alert-'+alert_class+' alert-floating">'+
    	'<i class="glyphicon glyphicon-'+icon+'"></i>'+
        '<div>'+msg+'</div>'+
        '</div>';
    $('body:first').append(html);
    fsFloatingAlertsInit();
}

function conversationInit()
{
	$(document).ready(function(){

		// Change conversation assignee
	    jQuery(".conv-user li > a").click(function(e){
			if (!$(this).hasClass('active')) {
				fsAjax({
					action: 'conversation_change_user',
					user_id: $(this).attr('data-user_id'),
					conversation_id: fsGetGlobalAttr('conversation_id')
				}, 
				laroute.route('conversations.ajax'),
				function(response) {
					if (typeof(response.status) != "undefined" && response.status == 'success') {
						if (typeof(response.redirect_url) != "undefined") {
							window.location.href = response.redirect_url;
						} else {
							window.location.href = '';
						}
					} else if (typeof(response.msg) != "undefined") {
						showFloatingAlert('error', response.msg);
					} else {
						showFloatingAlert('error', Lang.get("messages.error_occured"));
					}
					loaderHide();
				});
			}
			e.preventDefault();
		});

		// Change conversation status
	    jQuery(".conv-status li > a").click(function(e){
			if (!$(this).hasClass('active')) {
				fsAjax({
					action: 'conversation_change_status',
					status: $(this).attr('data-status'),
					conversation_id: fsGetGlobalAttr('conversation_id')
				}, 
				laroute.route('conversations.ajax'),
				function(response) {
					if (typeof(response.status) != "undefined" && response.status == 'success') {
						if (typeof(response.redirect_url) != "undefined") {
							window.location.href = response.redirect_url;
						} else {
							window.location.href = '';
						}
					} else if (typeof(response.msg) != "undefined") {
						showFloatingAlert('error', response.msg);
					} else {
						showFloatingAlert('error', Lang.get("messages.error_occured"));
					}
					loaderHide();
				});
			}
			e.preventDefault();
		});

	    // Reply
	    jQuery(".conv-reply").click(function(e){
	    	if ($(".conv-reply-block").hasClass('hidden')) {
	    		// Show
				$(".conv-action-block").addClass('hidden');
				$(".conv-reply-block").removeClass('hidden');
				$(".conv-action").addClass('inactive');
				$(this).removeClass('inactive');
				if (!$('#to').length) {
					$('#body').summernote('focus');
				}
			} else {
				// Hide
				$(".conv-action-block").addClass('hidden');
				$(".conv-action").removeClass('inactive');
			}
			e.preventDefault();
		});
	});
}

function fsGetGlobalAttr(attr)
{
	return $("body:first").attr('data-'+attr);
}

// Initialize conversation body editor
function convEditorInit()
{
	$('#body').summernote({
		minHeight: 200,
		dialogsInBody: true,
		dialogsFade: true,
		disableResizeEditor: true,
		followingToolbar: false,
		toolbar: [
		    // [groupName, [list of button]]
		    ['style', ['attachment', 'bold', 'italic', 'underline', 'ul', 'ol', 'link', 'picture', 'codeview', 'savedreplies']],
		    ['actions', ['savedraft', 'discard']],
		],
		buttons: {
		    attachment: EditorAttachmentButton,
		    savedreplies: EditorSavedRepliesButton,
		    savedraft: EditorSaveDraftButton,
		    discard: EditorDiscardButton
		},
		callbacks: {
	 		onImageUpload: function(files) {
	 			if (!files) {
	 				return;
	 			}
	            for (var i = 0; i < files.length; i++) {
					editorSendFile(files[i]);	
	            }
	        }
	    }
	});
	var html = $('#editor_bottom_toolbar').html();
	$('.note-statusbar').addClass('note-statusbar-toolbar form-inline').html(html);
}

function ajaxSetup()
{
	$.ajaxSetup({
		headers: {
	    	'X-CSRF-TOKEN': $('meta[name="csrf-token"]:first').attr('content')
		}
	});
}

// Generate random unique ID
function generateDummyId()
{
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return '_' + Math.random().toString(36).substr(2, 9);
}

// Save file uploaded in editor
function editorSendFile(file, attach) 
{
	if (!file || typeof(file.type) == "undefined") {
		return false;
	}

	var attachments_container = $(".attachments-upload:first");
	var attachment_dummy_id = generateDummyId();

	ajaxSetup();

 	if (typeof(attach) == "undefined") {
		attach = false;
	}

	// Images are embedded by default, other files attached
	if (file.type.indexOf('image/') == -1) {
		attach = true;
	}

	// Show loader
	if (attach) {
		var attachment_html = '<li class="atachment-upload-'+attachment_dummy_id+'"><img src="'+Vars.public_url+'/img/loader-tiny.gif" width="16" height="16"/> <a href="javascript:void(0);" class="break-words disabled" target="_blank">'+file.name+'<span class="ellipsis">…</span> </a> <span class="text-help">('+formatBytes(file.size)+')</span> <i class="glyphicon glyphicon-remove" onclick="removeAttachment(\''+attachment_dummy_id+'\')"></i></li>';
		$('.attachments-upload:first ul:first').append(attachment_html);
		attachments_container.show();
	} else {
		loaderShow();
	}

	data = new FormData();
	data.append("file", file);
	if (attach) {
		data.append("attach", 1);
	} else {
		data.append("attach", 0);
	}
	$.ajax({
		url: laroute.route('conversations.upload'),
		data: data,
		cache: false,
		contentType: false,
		processData: false,
		type: 'POST',
		success: function(response){
			if (typeof(response.url) == "undefined" || !response.url) {
				showFloatingAlert('error', Lang.get("messages.error_occured"));
				loaderHide();
				removeAttachment(attachment_dummy_id);
				return;
			}
			// Finish loading
			if (attach) {
				$('li.atachment-upload-'+attachment_dummy_id+':first').addClass('attachment-loaded');
				$('li.atachment-upload-'+attachment_dummy_id+':first a').removeClass('disabled').attr('href', response.url);
			} else {
				loaderHide();
			}
			if (typeof(response.status) == "undefined" || response.status != "success") {
				showAjaxError(response);
				removeAttachment(attachment_dummy_id);
				return;
			}
			if (attach) {
				
			} else {
				// Embed image
				$('#body').summernote('insertImage', response.url, function (image) {
					var editor_width = $('.note-editable:first:visible').width();
					if (image.width() > editor_width-85) {
						image.css('width', editor_width-85);
					}
					image.attr('width', image.css('width').replace('px', ''));
				});
			}
			if (typeof(response.attachment_id) != "undefined" || response.attachment_id) {
				var input_html = '<input type="hidden" name="attachments_all[]" value="'+response.attachment_id+'" />';
				input_html += '<input type="hidden" name="attachments[]" value="'+response.attachment_id+'" class="atachment-upload-'+attachment_dummy_id+'" />';
				if (!attach) {
					input_html += '<input type="hidden" name="embeds[]" value="'+response.attachment_id+'" class="atachment-upload-'+attachment_dummy_id+'" />';
				}
				attachments_container.prepend(input_html);
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (attach) {
				removeAttachment(attachment_dummy_id);
			} else {
				loaderHide();
			}
			console.log(textStatus+": "+errorThrown);
			showFloatingAlert('error', Lang.get("messages.error_occured"));
		}
	});
}

function removeAttachment(attachment_dummy_id)
{
	$('.atachment-upload-'+attachment_dummy_id).remove();
}


function formatBytes(size)
{
	precision = 2;
	size = parseInt(size);
    if (!isNaN(size) && size > 0) {
        base = Math.log(size) / Math.log(1024);
        suffixes = [' b', ' KB', ' MB', ' GB', ' TB'];

        return Math.round(Math.pow(1024, base - Math.floor(base)), precision)+''+suffixes[Math.floor(base)];
    } else {
        return size;
    }
}

// New conversation page
function newConversationInit()
{
	$(document).ready(function() {

		convEditorInit();

		// Show CC
	    $('.toggle-cc a:first').click(function() {
			$('.field-cc').removeClass('hidden');
			$(this).parent().remove();
		});

		// After send
		$('.dropdown-after-send a:lt(3)').click(function(e) {
			if (!$(this).parent().hasClass('active')) {
				$("#after_send").val($(this).attr('data-after-send'));
				$('.dropdown-after-send li').removeClass('active');
				$(this).parent().addClass('active');
			}
			e.preventDefault();
		});

		// After send
		$('.after-send-change').click(function(e) {
			showModal($(this));
		});

		// Send reply or new conversation
	    jQuery(".btn-send-text").click(function(e){
	    	var button = $(this);

	    	// Validate before sending
	    	form = $(".form-reply:first");

	    	if (!form.parsley().validate()) {
	    		return;
	    	}

	    	button.button('loading');

	    	data = form.serialize();
	    	data += '&action=send_reply';

			fsAjax(data, laroute.route('conversations.ajax'), function(response) {
				if (typeof(response.status) != "undefined" && response.status == 'success') {
					if (typeof(response.redirect_url) != "undefined") {
						window.location.href = response.redirect_url;
					} else {
						window.location.href = '';
					}
				} else {
					showAjaxError(response);
					button.button('reset');
				}
				loaderHide();
			});
			e.preventDefault();
		});
	});
}

function notificationsInit()
{
	$(document).ready(function() {
	    $('.sel-all').click(function(event) {
	    	if ($(this).is(':checked')) {
				$(".subscriptions-"+$(this).val()+" input").attr('checked', 'checked');
			} else {
				$(".subscriptions-"+$(this).val()+" input").removeAttr('checked');
			}
		});
	});
}

function getQueryParam(name, qs) {
	if (typeof(qs) == "undefined") {
		qs = document.location.search;
	}
    qs = qs.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }

    if (typeof(params[name]) != "undefined") {
    	return params[name];
    } else {
    	return '';
    }
}

// Show bootstrap modal
function showModal(a, onshow)
{
    var options = {};
    var title = a.attr('data-modal-title');
    if (title && title.charAt(0) == '#') {
        title = $(title).html();
    }
    if (!title) {
        title = a.text();
    }
    var remote = a.attr('data-remote');
    var body = a.attr('data-modal-body');
    var footer = a.attr('data-modal-footer');
    var no_close_btn = a.attr('data-no-close-btn');
    var no_footer = a.attr('data-modal-no-footer');
    var modal_class = a.attr('data-modal-class');
    var modal;

    var html = [
    '<div class="modal fade" tabindex="-1" role="dialog" aria-labelledby="jsmodal-label" aria-hidden="true">',
        '<div class="modal-dialog '+modal_class+'">',
            '<div class="modal-content">',
                '<div class="modal-header">',
                    '<button type="button" class="close" data-dismiss="modal" aria-label="'+Lang.get("messages.close")+'"><span aria-hidden="true">&times;</span></button>',
                    '<h3 class="modal-title" id="jsmodal-label">'+title+'</h3>',
                '</div>',
                '<div class="modal-body"><div class="text-center modal-loader"><img src="'+Vars.public_url+'/img/loader-grey.gif" width="31" height="31"/></div></div>',
                '<div class="modal-footer '+(no_footer == 'true' ? 'hidden' : '')+'">',
                    (no_close_btn == 'true' ? '': '<button type="button" class="btn btn-default" data-dismiss="modal">'+Lang.get("messages.close")+'</button>'),
                    footer,
                '</div>',
            '</div>',
        '</div>',
    '</div>'].join('');
    modal = $(html);

    if (typeof(onshow) !== "undefined") {
        modal.on('shown.bs.modal', onshow);
    }

    modal.modal(options);

    if (body) {
        modal.children().find(".modal-body").html($(body).html());
    } else {
        setTimeout(function(){
            $.ajax({
                url: remote,
                success: function(html) {
                    modal.children().find(".modal-body").html(html);
                },
                error: function(data) {
                    modal.children().find(".modal-body").html('<p class="alert alert-danger">'+Lang.get("messages.error_occured")+'</p>');
                }
            });
        }, 500);
    }
}

// Show floating error message on ajax error
function showAjaxError(response)
{
	if (typeof(response.msg) != "undefined") {
		showFloatingAlert('error', response.msg);
	} else {
		showFloatingAlert('error', Lang.get("messages.error_occured"));
	}
}

// Save default redirect
function saveAfterSend(el)
{
	var button = $(el);
	button.button('loading');

	var value = $(el).parents('.modal-body:first').children().find('[name="after_send_default"]:first').val();
	data = {
		value: value,
		mailbox_id: fsGetGlobalAttr('mailbox_id'),
		action: 'save_after_send'
	};

	fsAjax(data, laroute.route('conversations.ajax'), function(response) {
		if (typeof(response.status) != "undefined" && response.status == 'success') {
			// Show selected option in the dropdown
			console.log('.dropdown-after-send [data-after-send='+value+']:first');
			console.log($('.dropdown-after-send [data-after-send='+value+']:first'));
			$('.dropdown-after-send [data-after-send='+value+']:first').click();
			showFloatingAlert('success', Lang.get("messages.settings_saved"));
			$('.modal').modal('hide');
		} else {
			showAjaxError(response);
		}
		button.button('reset');
	}, true);
}