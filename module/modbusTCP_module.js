const modbus = require('jsmodbus')
const net = require('net')






//Initialize connection
function initConnection(serverName, ipAddress, port, callback) {
    var socket = new net.Socket();
    var option = {host : ipAddress, port : port};
    var client = new modbus.client.TCP(socket);
    socket.on('connect' , function() {
        callback({
            name : serverName,
            address : ipAddress,
            port: port,
            node : client
        })
    });
    socket.connect(option);
}


initConnection('Modbus', '127.0.0.1', 504, function(obj) {
    obj.node.readCoils(00100, 1).then(function(data){
        console.log(data);
    })
})

module.exports.initConnection = initConnection;