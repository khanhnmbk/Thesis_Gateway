//Return variable index
function getVariableIndex(variableName){
    var plcName = variableName.split(/_(.+)/)[0];
    console.log(plcName)
}

var opcua = require('../module/opcua_module')

var testJson = JSON.stringify({
    name : 'PLC1',
    address : 'ns=3;s="Int2"'
})

