/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, browser: true */
/*global $, define, brackets, Mustache */

define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager"),
        Menus = brackets.getModule("command/Menus"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        WorkspaceManager = brackets.getModule("view/WorkspaceManager"),
        AppInit = brackets.getModule("utils/AppInit"),
        NodeDomain = brackets.getModule("utils/NodeDomain"),
        Resizer = brackets.getModule("utils/Resizer"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        DocumentManager = brackets.getModule("document/DocumentManager");

    // Panel
    var ext_id = "deddy.dbmanager",
        panel;

    // Templates
    var panelTemplate = require("text!templates/database-panel.html"),
        panelTabTemplate = require("text!templates/panel-tab.html"),
        connectTemplate = require("text!templates/database-connect.html"),
        sidebarTemplate = require("text!templates/database-sidebar.html"),
        dbListTemplate = require("text!templates/database-list.html"),
        tableListTemplate = require("text!templates/table-list.html"),
        tablePanelTemplate = require("text!templates/table-panel.html"),
        tableFieldsTemplate = require("text!templates/table-fields.html"),
        tableDataTemplate = require("text!templates/table-data-result.html"),
        tableTemplate = require("text!templates/table-result.html");

    // Html Templates
    var connectHtml = Mustache.render(connectTemplate);

    // Styles
    ExtensionUtils.loadStyleSheet(module, "styles/database.less");

    // Global Vars
    var db_connect = null,
        is_connected = false;

    function handlePanel() {
        if (panel.isVisible()) {
            panel.hide();
            $('#dbsidebar').hide();
        } else {
            panel.show();
            $('#dbsidebar').show();
            if (!is_connected) {
                $("#database-panel .table-container").html(connectHtml);
				initConnectView();
            }
        }
    }

    var simpleDomain;

    function connect() {
		
        simpleDomain = new NodeDomain("simple", ExtensionUtils.getModulePath(module, "node/"+$("#dbinstance").val()));
        db_connect = {
            host: $("#dbhost").val(),
            //serverinstance: $("#dbhost").val().split('\\')[1],/*$("#dbserverinstance").val(),*/
            port: $("#dbport").val(),
            user: $("#dbuser").val(),
            userName: $("#dbuser").val(),
            pass: $("#dbpassword").val(),
            password: $("#dbpassword").val(),
            database: $("#dbdatabase").val()
        };
        
        $('#dboptions')[0].dboptions = db_connect;
        $('#dboptions').text(db_connect.database + ' @ ' + db_connect.host);
        
        simpleDomain.exec("connect", $('#dboptions')[0].dboptions).done(function (data) {
			var database = data[0], dblist = data[1];
			if($('#dbsidebar').length === 0){
				$('#sidebar').append(sidebarTemplate);
                Resizer.makeResizable($('#dbsidebar'), "vert", "top", 75);
            }
			$('#dblist-container').empty().append(Mustache.render(dbListTemplate, dblist));
            
            $('#db-active-database').empty().append('<option value="------">------</option>');
            $.each(dblist.database, function(i, val){
                $('#db-active-database').append('<option value="'+val.dbname+'">'+val.dbname+'</option>');
            });
			
            $('.db-tree-text').parent().off('click').on('click', function(e){
                if($('#dboptions')[0].dboptions.database != $(this).find('.db-tree-text').attr('name')){
                    $('#db-active-database').off('change')
                    changeDatabase($(this).find('.db-tree-text').attr('name'), $(this), $(e.target).hasClass('db-tree-text'));
                    $('#db-active-database').on('change', function(e){
                        changeDatabase($(this).val(), false, false);
                    });
                }
                else {
                    if($(e.target).hasClass('db-tree-text')){
                       if(!$(this).find('.db-tree-text').next().is(':visible')){
                            getTableList($(this).find('.db-tree-text').next().find('.db-show-table-list'));
                            $(this).find('.db-tree-text').next().show();
                        }
                        else{
                            $(this).find('.db-tree-text').next().hide();
                        }
                    }
                }
			});
			
            $('#db-active-database').off('change').on('change', function(e){
                changeDatabase($(this).val(), false, false);
			});
			
			$('#dbdatabaselist').empty().append(database);
			
            $(".db-connect").attr("disabled", "disabled");
            $(".db-disconnect").removeAttr("disabled");
            $(".db-query").removeAttr("disabled");
            $(".db-run-query").removeAttr("disabled");
            $(".db-list-tables").removeAttr("disabled");

            is_connected = true;

            $("#database-panel .table-container").html("");
        }).fail(function (err) {
            console.error("[Brackets-Database] failed to connect database", err);
        });
    }

    function disconnect() {
        simpleDomain.exec("disconnect").done(function () {
            $(".db-connect").removeAttr("disabled");
            $(".db-disconnect").attr("disabled", "disabled");
            $(".db-query").attr("disabled", "disabled");
            $(".db-run-query").attr("disabled", "disabled");
            $(".db-list-tables").attr("disabled", "disabled");

            $(".db-query").val("");

            is_connected = false;
			
            $("#database-panel .table-container").html(connectHtml);
			
			initConnectView();
        }).fail(function (err) {
			$('#dbquerymessage').text(err);
        });
    }
	
	function changeDatabase(dbName, el, toggle){
        $('#dboptions')[0].dboptions.database = dbName;
        simpleDomain.exec("changedb", $('#dboptions')[0].dboptions, dbName).done(function (data) {
            $('#dbquerymessage').empty();
            if(data.status){
                if(el != false && toggle != false){
                    el.find('.db-tree-text').next().find('.db-show-table-list').off('click').on('click', function(){
                        if($(this).parent().find('ul').length > 0)
                            $(this).parent().find('ul').remove();
                        else{
                            getTableList(this);
                        }
                    });
                    $('#db-active-database').val(dbName);
                    if(toggle)
                        $(el).find('.db-tree-text').next().toggle();
                }
            }
            else{
                $('#dbquerymessage').append('<span style="color: #F37124;">'+data.message+'</span>');
                $('#db-active-database').val('------');
            }
        });
	}
    
    function getTableList(el){
       simpleDomain.exec("gettables").done(function (data) {
            $(el).parent().find('ul').remove();
            $(Mustache.render(tableListTemplate, data)).insertAfter(el);
            $(el).next().children().click(function(){
                var tablePanel = Mustache.render(tablePanelTemplate, {table: $(this).attr('name')}), name = $(this).attr('name'), el = $(tablePanel);
                el.find('.db-panel-tab-fields').off('click').on('click', function(){
                    getFieldList(name);
                });
                el.find('.db-panel-tab-data').off('click').on('click', function(){
                    getDataTable([name, 0, 1]);
                });
                
                addContent('table-'+name, 'Table '+name, el);
                el.find('.db-panel-tab-fields').trigger('click');
            });
            $(el).next().find('.db-table-text').off('click').on('click', function(){
                $(this).next().toggle();
            });
        });
    }
    
    function getFieldList(tablename){
       simpleDomain.exec("getfields", tablename).done(function (data) {
           $('.db-tab-table-'+tablename+' .db-panel-content').empty().append(Mustache.render(tableFieldsTemplate, data));
        });
    }

    
    function getDataTable(param){
        simpleDomain.exec("getdatatable", param).done(function (data) {
            if(data[1].length == 0 && (data[3]/100)>0){
                param[1] = param[1] - 100;
                getDataTable(param);
            }
            else{
                var tableHtml, 
                rows_array = [],
                result_array = [];

                var i = 1 + param[1];
                data[1].forEach(function (row) {
                    result_array = [];
                    $.each(row, function (key, value) {
                        if (value === null) {
                            result_array.push('null');
                        } else if (value === 0) {
                            result_array.push('0');
                        } else if (value.length === 0) {
                            result_array.push(' ');
                        } else {
                            result_array.push(value);
                        }
                    });

                    result_array.unshift(i);
                    rows_array.push(result_array);
                    i++;
                });

                tableHtml = $(Mustache.render(tableDataTemplate, {fields: data[0], rows: rows_array, page: param[2]}));

                $('.db-tab-table-'+param[0]+' .db-panel-content').empty().append(tableHtml);

                tableInit2(tableHtml);

                tableHtml.find('.db-table-data-prev').click(function(){
                    var val = $('.db-table-data-page').val(), offset = val-2 * 100;

                    if(val == 1){
                        offset = 0;
                    }
                    else
                        val--;

                    getDataTable([param[0], offset, val]);
                });

                tableHtml.find('.db-table-data-next').click(function(){
                    var val = $('.db-table-data-page').val(), offset = val * 100;
                    val++;
                    //$('.db-table-data-page').val(val);
                    getDataTable([param[0], offset, val]);
                });
            }
        });
    }

    function querying(query) {
    
        var rows = [],
            rows_array = [],
            result_array = [];

        simpleDomain.exec("query", $('#dboptions')[0].dboptions, query).done(function (table) {

            rows = table[1];
			
			$('#dbquerymessage').text(table[2]+' rows retrieved.');
            
            var i = 1;
            rows.forEach(function (row) {
                result_array = [];
                $.each(row, function (key, value) {
                    if (value === null) {
                        result_array.push('null');
                    } else if (value === 0) {
                        result_array.push('0');
                    } else if (value.length === 0) {
                        result_array.push(' ');
                    } else {
                        result_array.push(value);
                    }
                });

                result_array.unshift(i);
                rows_array.push(result_array);
                i++;
            });

            var tableHtml = $(Mustache.render(tableTemplate, {fields: table[0], rows: rows_array}));

            addContent('result', 'Result', tableHtml);

            tableInit2(tableHtml);
            
        }).fail(function (err) {
			$('#dbquerymessage').text(err);
        });
    }

    (function($) {
        $.fn.hasScrollBar = function() {
            return this.get(0).scrollHeight > this.height();
        }
    })($);
    
    function getScrollbarWidth() {
        var outer = document.createElement("div");
        outer.style.visibility = "hidden";
        outer.style.width = "100px";
        outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

        document.body.appendChild(outer);

        var widthNoScroll = outer.offsetWidth;
        // force scrollbars
        outer.style.overflow = "scroll";

        // add innerdiv
        var inner = document.createElement("div");
        inner.style.width = "100%";
        outer.appendChild(inner);        

        var widthWithScroll = inner.offsetWidth;

        // remove divs
        outer.parentNode.removeChild(outer);

        return widthNoScroll - widthWithScroll;
    }

    function tableInit2(el){
        var totalW = 0;
        $(el).find('tbody tr:first-child td').each(function(i, val){
            var w = 0, targetTh = $(el).find('thead th:nth-child('+(i+1)+')');
            if( targetTh.innerWidth() >$(val).innerWidth() ){
                w = targetTh.innerWidth();
            }
            else{
                w = $(val).innerWidth();
            }
            $(val).innerWidth(w);
            targetTh.innerWidth(w);
            totalW += $(val).outerWidth();
        });
        
        var h = $(el).parent().innerHeight();
        h = h - $(el).find('.db-table-head').outerHeight(true) - $(el).find('.db-table-foot').outerHeight(true);
        $(el).find('.db-table-body').height(h).css('overflow', 'auto');
        $(el).find('.db-table-head').css('overflow', 'hidden');
        $(el).find('.db-table-head table').outerWidth(totalW);
        $(el).find('.db-table-body table').outerWidth(totalW);
        $(el).find('.db-table-body').scroll(function(){
            $(el).find('.db-table-head').scrollLeft($(this).scrollLeft());
        });
        if($(el).find('.db-table-body').hasScrollBar()){
            $(el).find('.db-table-head thead tr').find('.db-scrollbar-th').remove();
            $(el).find('.db-table-head thead tr').append('<th class="db-scrollbar-th" style="width:'+getScrollbarWidth()+'px; margin: 0 !important; padding: 0px !important"></th>');
            $(el).find('.db-table-head table').outerWidth(totalW+getScrollbarWidth());
        }
    }
    
    function addContent(id, name, content){
        $('.db-container').children().hide();
        $('.db-tabs').children().addClass('tab-inactive');
        $('.db-container').children('.db-tab-'+id).remove();
        $('.db-tabs').children('#db-tab-'+id).remove();
        $('.db-tabs').append(Mustache.render(panelTabTemplate, {tabid: id, tabname: name}));
        $('.db-container').append('<div class="db-tab-'+id+'" style="height: 100%;overflow: auto;display: flex;flex-direction: column;"></div>');
        $('.db-container').find('.db-tab-'+id).append(content);
    }
    
    function run_query() {
        var editor = EditorManager.getCurrentFullEditor();
        var str_query = editor.getSelectedText();
        if (str_query === '') {
            str_query = DocumentManager.getCurrentDocument().getText();
        }
        querying(str_query);
    }

    function initActions() {
        panel.$panel.on("click", ".close", handlePanel);
        panel.$panel.on("click", ".db-disconnect", disconnect);
        //panel.$panel.on("click", ".db-run-query", run_query););
        $('.db-run-query').click(function(){
            run_query();
        });
        /*panel.$panel.on("keydown", function (event) {
            if (event.which === 13) {
                run_query();
            }
        });*/
        $('.db-tabs').click(function(e){
            if($(e.target).hasClass('db-tab')){
                $('.db-container').children().hide();
                $('.'+$(e.target).attr('id')).show();
                $(e.target).removeClass('tab-inactive').siblings().addClass('tab-inactive');
            }
            else if($(e.target).hasClass('db-tab-close')){
                $('.'+$(e.target).parent().attr('id')).remove();
                $(e.target).parent().remove();
            }
        });
    }
	
	function loadSavedConnection(){
		
		var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");

		var path = ExtensionUtils.getModulePath(module);
		
		$.getJSON(path+'connection.json', function(data){
			$('#dbSelectConnection').empty();
            $('#dbSelectConnection').append("<option value='' data-name=''>List of connection</option>");
			$.each(data, function(i, val){
				$('#dbSelectConnection').append("<option value='"+val.value+"' data-name='"+val.name+"'>"+val.name+"</option>");
			});
		});
	}
	
	function saveConnection(){
		var conn = {
            host: $("#dbhost").val(),
            port: $("#dbport").val(),
            user: $("#dbuser").val(),
            userName: $("#dbuser").val(),
            pass: $("#dbpassword").val(),
            password: $("#dbpassword").val(),
            name: $("#dbname").val(),
            database: $("#dbdatabase").val(),
            //serverinstance: $("#dbserverinstance").val(),
            instance: $("#dbinstance").val()
        },
		data = [];
		
		$('#dbSelectConnection option[data-name='+conn.name+']').remove();
		
		$('#dbSelectConnection').append("<option value='"+JSON.stringify(conn)+"' data-name='"+conn.name+"'>"+conn.name+"</option>");
		
		$('#dbSelectConnection option').each(function(i, val){
			data.push({name: $(val).text(), value: $(val).attr('value')});
		});
		
		saveFile('connection.json', JSON.stringify(data));
	}
	
	function setConnection(){
		var data = JSON.parse($('#dbSelectConnection').val());
		
		$("#dbhost").val(data.host);
		$("#dbport").val(data.port);
		$("#dbuser").val(data.user);
		$("#dbpassword").val(data.pass);
		$("#dbname").val(data.name);
		$("#dbdatabase").val(data.database);
		$("#dbinstance").val(data.instance);
        //$("#dbserverinstance").val(data.serverinstance);
	}
	
	function saveFile(filename, content){
		
		var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");

		var path = ExtensionUtils.getModulePath(module);
		
		brackets.fs.writeFile(path+ filename, content, "utf8", function(err) {
			if(err){
				console.log(err);
            }
		});
	}
	
	function initConnectView(){
		loadSavedConnection();
		$('#dbsaveconnection').click(function(){
			saveConnection();
		});
		$('#dbSelectConnection').change(function(){
			setConnection();
		});
        $(".db-connect").click(function(){
            connect();
        });
        $('#database-panel').on('panelResizeEnd', function(){
            $('.db-table-result-container').each(function(i, val){
                tableInit2(val);
            });
        });
	}

    AppInit.appReady(function () {
        var panelHtml = Mustache.render(panelTemplate);
        var $panelHtml = $(panelHtml);

        panel = WorkspaceManager.createBottomPanel(ext_id, $panelHtml, 100);
        
		ExtensionUtils.loadStyleSheet(module, "css/db.css");
		
        CommandManager.register("Database Manager", ext_id, handlePanel);

        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuItem(ext_id);

        initActions();
    });
});
