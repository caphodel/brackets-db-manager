/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";

    var connection, version;
    
    function getVersion(){
        var Request = require('tedious').Request;
        var request = new Request("DECLARE @ver nvarchar(128); SET @ver = CAST(serverproperty('ProductVersion') AS nvarchar); SET @ver = SUBSTRING(@ver, 1, CHARINDEX('.', @ver) - 1); SELECT @ver", function(err, rowCount) {
            if (err) {
            } else {
            }
        });

        request.on('row', function(columns) {
            columns.forEach(function(column) {
                version = column.value;
            });
        });

        connection.execSql(request);
    }
    
    function cmdConnect(db_connect, callback) {
        var config = {
            userName: db_connect.user,
            password: db_connect.password,
            server: db_connect.host.split('\\')[0],
            options: {
                instanceName: db_connect.host.split('\\')[1]
            }
        };
        var Connection = require('tedious').Connection;

        connection = new Connection(config);

        connection.on('connect', function(err) {
            if (err != false && typeof err != 'undefined') {
                callback(err);
            }

			var Request = require('tedious').Request, opt = '', dbname = [];
			
			var request = new Request("SELECT name FROM master..sysdatabases order by name", function(err, rowCount) {
                getVersion();
				if (err) {
					callback(err.message);
				} else {
					callback(null, [opt, {database: dbname}]);
				}
			});
			
			request.on('row', function(columns) {
				columns.forEach(function(column) {
					opt+='<option value="'+column.value+'">'+column.value+'</option>';
					dbname.push({"dbname": column.value});
				});
			});

			connection.execSql(request);
        });
    }
	
    function cmdDisconnect(callback) {
        connection.close();
        callback(null, 1);
    }
	
    function cmdChangeDatabase(db_connect, database, callback){
		if(connection)
			if(connection.close)
				connection.close();
		
		var config = {
            userName: db_connect.user,
            password: db_connect.password,
            server: db_connect.host.split('\\')[0],
            options: {
                database: database,
                instanceName: db_connect.host.split('\\')[1]
            }
        };
        
        var Connection = require('tedious').Connection;

        connection = new Connection(config);
		
		connection.on('connect', function(err) {
            if (typeof err != 'undefined') {
                callback(null, {
                    status: false,
                    message: err.message,
                    name: err.name,
                    code: err.code,
                });
            }
            else{
                callback(null, {
                    status: true
                });
            }
		});
	}
	
	function cmdTableList(callback){
        var Request = require('tedious').Request, tablename = [];
        var request = new Request("SELECT sobjects.name FROM sysobjects sobjects WHERE sobjects.xtype = 'U' order by name", function(err, rowCount) {
            if (err) {
                callback(null, {
                    status: false,
                    message: err.message
                });
            } else {
                callback(null, {
                    status: true,
                    table: tablename
                });
            }
        });

        request.on('row', function(columns) {
            columns.forEach(function(column) {
                tablename.push({"tablename": column.value});
            });
        });

        connection.execSql(request);
	}
	
	function cmdViewList(callback){
        var Request = require('tedious').Request, viewname = [];
        var request = new Request("SELECT sobjects.name FROM sysobjects sobjects WHERE sobjects.xtype = 'V' order by name", function(err, rowCount) {
            if (err) {
                callback(null, {
                    status: false,
                    message: err.message
                });
            } else {
                callback(null, {
                    status: true,
                    view: viewname
                });
            }
        });

        request.on('row', function(columns) {
            columns.forEach(function(column) {
                viewname.push({"viewname": column.value});
            });
        });

        connection.execSql(request);
	}

	function cmdFieldList(tableName, callback){
        var Request = require('tedious').Request, fieldsName = [];
        var request = new Request("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'"+tableName+"'", function(err, rowCount) {
            if (err) {
                callback(null, {
                    status: false,
                    message: err.message
                });
            } else {
                callback(null, {
                    status: true,
                    fields: fieldsName
                });
            }
        });

        request.on('row', function(columns) {
            var val = {};
            columns.forEach(function(column) {
                val[column.metadata.colName.toLowerCase()] = column.value;
            });
            fieldsName.push(val);
        });

        connection.execSql(request);
	}

    function cmdQuerying(db_options, query, callback) {
        var Request = require('tedious').Request, rows = [], fields = [], f = 0;
        var request = new Request(query, function(err, rowCount) {
            if (err) {
                callback(err.message);
            } else {
                callback(null, [fields, rows, rowCount]);
            }
        });

        request.on('row', function(columns) {
            var r = [];
            columns.forEach(function(column) {
                r.push(column.value);
                if(f==0)
                    fields.push({name: column.metadata.colName});
            });
            f++;
            rows.push(r);
        });

        connection.execSql(request);

    }

    function cmdPaging( param, callback) {
        var Request = require('tedious').Request, rows = [], fields = [], f = 0, query, pk, table = param[0], offset = param[1];

        if( version >= 11 ){
            query = "SELECT column_name FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE OBJECTPROPERTY(OBJECT_ID(constraint_name), 'IsPrimaryKey') = 1 AND table_name = '"+table+"'";
            
            var request = new Request(query, function(err, rowCount) {
                if (err) {
                    callback(err.message);
                } else {
                    query = "SELECT * FROM "+table+" ORDER BY "+pk+" OFFSET "+offset+" ROWS FETCH NEXT 100 ROWS ONLY;";
                    var request2 = new Request(query, function(err, rowCount) {
                        if (err) {
                            callback(err.message);
                        }
                        else{
                            callback(null, [fields, rows, rowCount, offset]);
                        }
                    });

                    request2.on('row', function(columns) {
                        var r = [];
                        columns.forEach(function(column) {
                            r.push(column.value);
                            if(f==0)
                                fields.push({name: column.metadata.colName});
                        });
                        f++;
                        rows.push(r);
                    });
                    
                    connection.execSql(request2);
                }
            });

            request.on('row', function(columns) {
                columns.forEach(function(column) {
                    pk = column.value;
                });
            });
        }

        connection.execSql(request);

    }

    function init(domainManager) {
        if (!domainManager.hasDomain("simple")) {
            domainManager.registerDomain("simple", {major: 0, minor: 1});
        }

        domainManager.registerCommand(
            "simple",       // domain name
            "connect",    // command name
            cmdConnect,   // command handler function
            true,          // this command is synchronous in Node
            "Connect to a database"
        );

        domainManager.registerCommand(
            "simple",
            "disconnect",
            cmdDisconnect,
            true,
            "Disconnect from database"
        );

        domainManager.registerCommand(
            "simple",
            "query",
            cmdQuerying,
            true,
            "Querying a database"
        );

        domainManager.registerCommand(
            "simple",
            "changedb",
            cmdChangeDatabase,
            true,
            "Change selected database"
        );

        domainManager.registerCommand(
            "simple",
            "gettables",
            cmdTableList,
            true,
            "Get table list"
        );

        domainManager.registerCommand(
            "simple",
            "getviews",
            cmdViewList,
            true,
            "Get view list"
        );

        domainManager.registerCommand(
            "simple",
            "getfields",
            cmdFieldList,
            true,
            "Get fields list"
        );

        domainManager.registerCommand(
            "simple",
            "getdatatable",
            cmdPaging,
            true,
            "Get data paging"
        );
    }

    exports.init = init;

}());
