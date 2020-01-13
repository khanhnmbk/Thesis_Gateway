var opcua = require('node-opcua');
var async = require('async');

//Initialize connection
function initConnection(plcName, endpointUrl, callback) {
    var client = new opcua.OPCUAClient();
    var theSession;
    async.series([
        //STEP 1: CONNECT
        function (_callback) {
            client.connect(endpointUrl, function (err) {
                if (err) {
                    console.log("Cannot connect to endpoint: ", endpointUrl);
                } else {
                    console.log("Connected to: ", endpointUrl);
                }
                _callback(err);
            });
        },

        //STEP 2: CREATE SESSION
        function (_callback) {
            client.createSession(function (err, session) {
                if (!err) {
                    theSession = session;
                    console.log('Created session successfully');
                } else console.log('Create session failed');
                _callback(err);
            });
        },
        //FINAL STEP
    ] , function(err, result) {
        if (err) console.log('Fail to create connection');
        else {
            console.log('Create connection successfully');
        }
        callback({
            name : plcName,
            opcuaNode : theSession,
            address : endpointUrl
        });
    })
}

//Read a variable
function readSingleValue(session, nodeId, callback) {
    session.readVariableValue(nodeId, function(err,dataValue) {
        if (err) {
            console.log('Reading error: ', err);
        }
        if (dataValue.value) callback(dataValue.value.value);
        else callback(null);
    });
}

//Read multiple variable
function readMultipleValue(session, arrNodeId, callback){
    var returnArr = [];
    if (!Array.isArray(arrNodeId)) callback(returnArr);
    else {
        if (arrNodeId.length > 0) {
            var index = 0;
            async.whilst(
                //Check condition
                function(){
                    return index < arrNodeId.length;
                },
                //Executing function
                function(_callback) {
                    readSingleValue(session, arrNodeId[index] , function(data){
                        returnArr.push(data);
                        index++;
                        _callback();
                    });
                },
                //Finish function
                function() {
                    callback(returnArr);
                }
            )
        } else callback(returnArr); //If input array is null, return null
    }
}

//Write variable
//Datatype: boolean, sInt, uInt, sDInt, uDInt, Double, String
function writeData(session, nodeId, dataType, value, callback) {
    switch(dataType) {
        case 'Bool' : {
            //opcDataType = opcua.DataType.Boolean;
            value = (value == 1) || (value == true) || (value == 'true');
            break;
        };
        // case 'sByte' : {
        //     opcDataType = opcua.DataType.SByte;
        //     break;
        // };
        // case 'uByte' : {
        //     opcDataType = opcua.DataType.Byte;
        //     break;
        // };
        // case 'sInt' : {
        //     opcDataType = opcua.DataType.Int16;
        //     break;
        // };
        // case 'uInt' : {
        //     opcDataType = opcua.DataType.Int16;
        //     break;
        // };
        // case 'sDInt' : {
        //     opcDataType = opcua.DataType.Int32;
        //     break;
        // };
        // case 'uDInt' : {
        //     opcDataType = opcua.DataType.UInt32;
        //     break;
        // };
    };
    session.readVariableValue(nodeId, function(err, result) {
        if (err) console.log(err);
        else {
            if (result) {
                var nodeToWrite = [{
                    nodeId : nodeId,
                    attributeId: opcua.AttributeIds.Value,
                    value: {
                        value: {
                            dataType : result.value.dataType,
                            value : value
                        }
                    }
                }];
                session.write(nodeToWrite, function(err, statusCodes) {
                    console.log('Status code: ', statusCodes);
                    // if (err || (statusCodes[0].name != 'Good')) callback(false);
                    // else callback(true);
                });
            }
        }
    })


}




module.exports.initConnection = initConnection;
module.exports.readSingleValue = readSingleValue;
module.exports.readMultipleValue = readMultipleValue;
module.exports.writeData = writeData;