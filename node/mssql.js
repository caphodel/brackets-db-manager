/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";

    var tds = require('tds'), connection;

    function cmdConnect(db_connect, callback) {

        /*var config = {
            userName: db_connect.user,
            password: db_connect.password,
            server: db_connect.host,
            options: {
                database: db_connect.database
            }
        };
        
        console.log(config)

        var connection = new Connection(config);

        connection.on('connect', function(err) {
            if (err != false) {
                callback(err);
            }
            callback(null, 4);
            connection.close();
        );*/
        
        connection = new tds.Connection(db_connect)
        
        connection.connect(function(err) {
            if (err != null) {
                callback(err.message);
            }
            callback(null, connection._client.state);
            connection.end();
        })
    }

    function cmdDisconnect(callback) {
        connection.end();
        callback(null, 1);
    }

    function cmdQuerying(db_options, query, callback) {
        
        /*var rows = [], fields = [];
        
        function executeStatement() {
            request = new Request(query, function(err, rowCount) {
                if (err) {
                    callback(err);
                } else {
                    
                }
            });
            
            request.on('columnMetadata', function (columns) {
                if(fields.length == 0){
                    columns.forEach(function(column) {
                        fields.push(column.colName)
                    }
                }
            });

            request.on('row', function(columns) {
                var r = []
                columns.forEach(function(column) {
                    r.push(column.value)
                });
                rows.push(r);
            });
                    
            request.on('done', function(){
                callback(null, [fields, rows]);
            })

            connection.execSql(request);
        }
        
        var config = {
            userName: db_connect.user,
            password: db_connect.password,
            server: db_connect.host,
            options: {
                database: db_connect.database
            }
        };*/
        
        connection = new tds.Connection(db_options)

        connection.connect(function(err) {
            if (err != null) {
                callback(err);
            }
            
            var stmt = connection.createStatement(query);

            var rows = [], fields = [];

            stmt.on('row', function(row) {
                var r = []

                for(var i in row.metadata.columnsByName){
                    if(fields.length == 0){
                        fields.push({name: i})
                    }
                    r.push(row.getValue(i))
                }
                rows.push(r);
            });

            stmt.on('done', function(isError, hasRowCount, rowCount){
                if (isError.isError != 0) {
                    callback(isError);
                }
                callback(null, [fields, rows]);
            })

            stmt.execute();
        })
        
        
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
    }

    exports.init = init;

}());
