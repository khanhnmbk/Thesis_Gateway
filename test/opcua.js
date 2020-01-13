var opcua = require('../module/opcua_module');

var endpoint = 'opc.tcp://192.168.100.150:4840';

var nodeId = 'ns=3;s="Int1"';
var nodeArr = ['ns=3;s="Int1"' , 'ns=3;s="Int2"', 'ns=3;s="Real1"'];
var nullArr = [];

opcua.initConnection('S7-1500' ,endpoint, function(result){
    if (result.opcuaNode) {
        //var int1 = opcua.readValue(result.opcuaNode, nodeId);
        opcua.readMultipleValue(result.opcuaNode, nullArr, function(data){
            console.log(data);
        });

        opcua.writeData(result.opcuaNode, nodeId, 'sInt', 0, function(res) {
            console.log(res)
        });
    }
});


