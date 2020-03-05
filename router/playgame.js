// Node Server Script
// Version 2.0.04 (9:37 AM Wed March 21, 2018)
// Written by: James D. Miller
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var robot = require('robotjs');
var router = express.Router();
const port = process.env.PORT || 3000;

/*app.get('/', function(req, res) {
   // In a browser, if you set the URL to localhost:3000, you'll get this page:
   res.sendfile('links.html');
});*/
router.post('/', function(req, res, next) {
    var gamename = req.body.gamename;
    var cost = req.body.cost;

    transfer_token(masteraccount,'kisun1234155',masterPrivateKey,cost);

    if(req.session.user){
    }
    else{
    }
    //res.render('payment', { title: 'Express', gamename: gamename, cost : cost, method: "post" });
    res.render('indexClient');
});

app.get('/mouse_move', function(req, res){
  robot.moveMouse(req.query.mouseX * 1920 / 600, req.query.mouseY * 1080 / 600);
  /*if(req.query.mouseClick) {
    robot.mouseToggle("down");
  }else {
    robot.mouseToggle("up");
  }*/
  //console.log('x = ' + req.query.mouseX + '/ y = ' + req.query.mouseY);
  res.json({'status' : 'OK'});
})

app.use(express.static(__dirname));


// Put various client data and maps in a global.
var cD = {};
cD.userIndex = 0;

// Map: userName[ socket.id]
cD.userName = {};
cD.nickName = {};

// Map: id[ userName]
cD.id = {};

// Map: room[ socket.id]
cD.room = {};

// Map: hostID[ roomName]
cD.hostID = {};


// Miscellaneous support functions...

function setDefault( theValue, theDefault) {
   // Return the default if the value is undefined.
   return (typeof theValue !== "undefined") ? theValue : theDefault;
}

function removeUserFromMaps( clientID) {
   // Do this first, before removing this user from the maps.
   // Check to see if this is the host.
   var hostID = cD.hostID[ cD.room[ clientID]];
   if (hostID == clientID) {
      delete cD.hostID[ cD.room[ clientID]];
   }

   // In a similar way, make use of the userName map before removing the user from userName.
   delete cD.id[ cD.userName[ clientID]];
   delete cD.userName[ clientID];

   // Not every user will have a nick name.
   if (cD.nickName[ clientID]) delete cD.nickName[ clientID];

   // The room map was used above. Now it's ok to remove the user from the room map.
   delete cD.room[ clientID];
}

function setDisplayName( clientID, mode) {
   var displayNameString;
   if (cD.nickName[clientID]) {
      if (mode == 'comma') {
         displayNameString = cD.nickName[clientID] + ', ' + cD.userName[clientID];
      } else if (mode == 'prens') {
         displayNameString = cD.nickName[clientID] + ' (' + cD.userName[clientID] + ')';
      }
   } else {
      displayNameString = cD.userName[clientID];
   }
   return displayNameString;
}


// Socket.io stuff...
/*
io.on('connection', function(socket) {
   // Example of how to parse out the query string if it is sent in the connection attempt from the client.
   console.log("");
   console.log("Connection starting...");
   console.log("mode=" + socket.handshake.query['mode'] + ", current name=" + socket.handshake.query['currentName'] + ", nickName=" + socket.handshake.query['nickName']);

   // Normal initial connection
   if (socket.handshake.query['mode'] == 'normal') {
      cD.userIndex += 1;
      var user_name = 'u' + cD.userIndex;
   // If re-connecting, re-use the current user name that comes in via the query string.
   } else if (socket.handshake.query['mode'] == 're-connect') {
      var user_name = socket.handshake.query['currentName'];
   }
   var nick_name = socket.handshake.query['nickName'];

   // Two maps
   cD.userName[ socket.id] = user_name;
   if (nick_name) cD.nickName[ socket.id] = nick_name;
   cD.id[ user_name] = socket.id;

   console.log('');
   console.log('Their count=' + io.engine.clientsCount + ', my index=' + cD.userIndex + ', names=' + Object.keys(cD.userName).length + ', nick names=' + Object.keys(cD.nickName).length);

   console.log('New client: '+ cD.userName[socket.id] +', '+ socket.id + '.');

   // Tell the new user their network name.
   io.to(socket.id).emit('your name is', JSON.stringify({'name':cD.userName[socket.id], 'nickName':nick_name}));

   // Now set up the various listeners. I know this seems a little odd, but these listeners
   // need to be defined each time this connection event fires, i.e. for each socket.

   // Echo test...
   socket.on('echo-from-Client-to-Server', function(msg) {
      if (msg == 'server') {
         // This bounces off the SERVER and goes right back to the client.
         io.to(socket.id).emit('echo-from-Server-to-Client', 'server');

      } else if (msg == 'host') {
         // Send this first to the host (the scenic route). Include the id of the client so that we know where to send it
         // when it bounces off the host.
         io.to( cD.hostID[ cD.room[ socket.id]]).emit('echo-from-Server-to-Host', socket.id);
      }

   });
   socket.on('echo-from-Host-to-Server', function(msg) {
      var socket_id = msg;
      // Now that this has come back from the HOST, complete the trip and send this to the originating client.
      io.to(socket_id).emit('echo-from-Server-to-Client', 'host');
   });


   // Broadcast the incoming chat messages that come in.
   socket.on('chat message', function(msg) {
      // General emit to the room.
      io.to( cD.room[ socket.id]).emit('chat message', msg + " (" + setDisplayName(socket.id, 'comma') + ")");
   });


   // Signaling in support of WebRTC.
   socket.on('signaling message', function(msg) {
      var signal_message = JSON.parse(msg);

      if (signal_message.to == 'host') {
         var target = cD.hostID[ cD.room[ socket.id]];
      } else {
         var target = cD.id[ signal_message.to];
      }

      // Relay the message (emit) to the target user.
      io.to( target).emit('signaling message', msg);
   });

   // General control message (note: same structure as the above handler for signaling messages)
   socket.on('control message', function(msg) {
      var control_message = JSON.parse(msg);

      if (control_message.to == 'host') {
         var target = cD.hostID[ cD.room[ socket.id]];
      } else {
         var target = cD.id[ control_message.to];
      }

      // Relay the message (emit) to the target user.
      io.to( target).emit('control message', msg);
   });

   // Send mouse and keyboard states to the host client.
   socket.on('client-mK-event', function(msg) {
      // Determine the id of the room-host for this client. Then send data to the host for that room.
      // socket.id --> room --> room host.
      var hostID = cD.hostID[ cD.room[ socket.id]];

      // StH: Server to Host
      io.to( hostID).emit('client-mK-StH-event', msg);
   });

   socket.on('roomJoin', function(msg) {
      var msgParsed = JSON.parse( msg);

      var roomName = setDefault( msgParsed.roomName, null);
      var requestStream = setDefault( msgParsed.requestStream, false);
      var player = setDefault( msgParsed.player, null);
      var hostOrClient = setDefault( msgParsed.hostOrClient, 'client');

      nickName = cD.nickName[ socket.id];
      var displayName = setDisplayName( socket.id, 'prens');

      if (hostOrClient == 'client') {
         // Check to make sure the room has a host.
         if (cD.hostID[ roomName]) {
            socket.join(roomName);
            cD.room[ socket.id] = roomName;
            console.log('Room ' + roomName + ' joined by ' + cD.userName[ socket.id] + '.');

            // Send message to the individual client that is joining the room.
            io.to(socket.id).emit('room-joining-message', 'You have joined room ' + cD.room[socket.id] + ' and your client name is '+ displayName +'.');

            // Message to the room host.
            // Give the host the name of the new user so a new game client can be created. This is where "player" and "nickName" info gets
            // sent to the host. Notice this is not done, or needed, in the host block below.
            io.to( cD.hostID[ roomName]).emit('new-game-client',
               JSON.stringify({'clientName':cD.userName[socket.id], 'requestStream':requestStream, 'player':player, 'nickName':nickName}));

            // Chat message to the host.
            io.to( cD.hostID[ roomName]).emit('chat message', displayName + ' is a new client in room '+roomName+'.');

         } else {
            io.to(socket.id).emit('room-joining-message', 'Sorry, there is no host yet for room ' + roomName + '.');
         }

      } else if (hostOrClient == 'host') {
         // Should check if the room already has a host.
         if (cD.hostID[ roomName]) {
            // Send warning to the client that is attempting to host.
            io.to(socket.id).emit('room-joining-message', 'Sorry, there is already a host for room ' + roomName + '.');

         } else {
            socket.join(roomName);
            cD.room[ socket.id] = roomName;
            console.log('Room ' + roomName + ' joined by ' + cD.userName[ socket.id] + '.');

            // General you-have-joined-the-room message.
            io.to(socket.id).emit('room-joining-message', 'You have joined room ' + cD.room[socket.id] + ' and your client name is '+ displayName +'.');

            // Set this user as the host for this room.
            cD.hostID[ cD.room[ socket.id]] = socket.id;
            console.log('User '+ displayName +' identified as host for room '+ cD.room[ socket.id] + '.');

            // An oh-by-the-way "you are the host" message.
            io.to(socket.id).emit('room-joining-message', 'You are the host of room ' + cD.room[ socket.id] + '.');
         }
      }
   });

   // This "disconnect" event is fired by the server.
   socket.on('disconnect', function() {
      if (cD.userName[ socket.id]) {

         var displayName = setDisplayName( socket.id, 'prens');

         // Report at the server.
         console.log(' ');
         var message = displayName + ' has disconnected.';
         console.log( message + ' (by self, ' + socket.id + ').');

         // Report to the room host.
         var hostID = cD.hostID[ cD.room[ socket.id]];
         io.to( hostID).emit('chat message', message+'.');
         io.to( hostID).emit('client-disconnected', cD.userName[ socket.id]);

         // Remove this user from the maps.
         removeUserFromMaps( socket.id);
      }
   });

   socket.on('clientDisconnectByHost', function(msg) {
      var clientName = msg;
      var clientID = cD.id[ clientName];

      // Send disconnect message to the client.
      io.to( clientID).emit('disconnectByServer', clientName);

      // Don't do the following. It will disconnect the host socket. Not what we want here!
      //socket.disconnect();
   });

   socket.on('okDisconnectMe', function(msg) {
      // This event indicated the non-host client got the clientDisconnectByHost message (see above) and
      // agrees to go peacefully.
      var clientName = msg;
      var clientID = cD.id[ clientName];

      // Report this at the server.
      console.log(' ');
      var message = clientName + ' has disconnected';
      console.log( message + ' (by host, '+clientID+').');

      // Report to the room host.
      var hostID = cD.hostID[ cD.room[ clientID]];
      io.to( hostID).emit('chat message', message);
      io.to( hostID).emit('client-disconnected', clientName);

      // Remove this user from the maps.
      removeUserFromMaps( socket.id);

      //Finally, go ahead and disconnect this client's socket.
      socket.disconnect();
   });

   socket.on('shutDown-p2p-deleteClient', function( msg) {
      var clientName = msg;
      var clientID = cD.id[ clientName];
      var hostID = cD.hostID[ cD.room[ clientID]];
      io.to( hostID).emit('shutDown-p2p-deleteClient', clientName);
   });

   socket.on('command-from-host-to-all-clients', function( msg) {
      // General emit to the room.
      io.to( cD.room[ socket.id]).emit('command-from-host-to-all-clients', msg);
   });

});*/

/*http.listen(port, function() {
   console.log('listening on *:' + port);
});*/
module.exports = router;

//https://github.com/EOSIO/eosjs/blob/master/docs/2.-Transaction-Examples.md

// 각각의 프로세스 별로, 모듈화? 함수화?할 필요가 있음.
// 1. "로그인 프로세스"
// 2. "사용자 계정생성 프로세스"
// 3. "지불 프로세스(토큰 전송)"

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                // node only
const { TextEncoder, TextDecoder } = require('text-encoding');          // React Native,

///master(운영자)의 testnet과의 연동(운영자의 계정명, privateKey필요)
const masterPrivateKey = "5K1yJAaRRehfp64sQEboQnz3NTcoheCTDiBoVyDdP5chThFzxRb"; // 운영자 privateKey
const masteraccount = 'amjong123415' // 운영자의 계정명
// masteraccount는, 우리 웹 어플리케이션 운영자의 계정명.

//////////////////////////////////////////////////////////////////////////
// 3. "지불 프로세스(토큰 전송)"
// transfer 코드 전체. (user testnet 연동 필요, 즉 "로그인 프로세스" 필요)
// 우리 웹 어플리케이션에서
// 고객이 선택한 이용 시간(기간) - 지불 요금 에 따라서
// 결정되는 지불 요금을 const money << 에 대입.


//임시로 master계정 -> user계정으로 0.0002 EOS 보내는 코드
/*
 var transferquantity = '';
 const cost = 0.0002; // 시간에 따라서
 transferquantity += String(cost) + ' EOS';
transfer_token(masteraccount, useraccount, masterPrivateKey, transferquantity);
*/
///////////////////////////////////////////////////////////////

// usracc == 유저의 계정 명.
// mstacc == 운영자의 계정 명.
// usrpvkey == 유저의 privateKey
// tq == 보낼 토큰 양.
// user의 계정으로 체인에 연동하여, user -> master로 토큰을 전송하는 함수.
async function transfer_token(usracc, mstacc, usrpvkey, tq){
  // user 계정으로 체인에 연동하는 부분.
  const defaultPrivateKey = usrpvkey;
  const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
  const rpc = new JsonRpc('http://api.kylin.eosbeijing.one:8880', { fetch });
  const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  // api라는 변수에 user의 정보가 담김, transact로 체인과 상호작용.
   try {
     const result = await api.transact({
       actions: [{
           account: 'eosio.token',
           name: 'transfer',
           authorization: [{
               actor: usracc,
               permission: 'active',
           }],
           data: {
               from: usracc,
               to: mstacc,
               quantity: tq,
               memo: '',
           },
       }]
     }, {
       blocksBehind: 3,
       expireSeconds: 30,
     });
     console.log(result);
   } catch (e) {
     // 이 부분은 아마 사용자 계정에 지불할 토큰이 없는 경우.
     // 웹페이지에서 토큰 양이 부족하다고 메시지를 띄워주면서
     // 현재 토큰 양을 보여주던 해야할 듯.
     console.log(e);
   }
 }

// 'kisun1234155'라는 계정을 생성하는 코드
// 현재 문제점이, 이 생성한 계정의 privateKey를 알 수가 없음..
// 코드상으로 반환값으로는 이 계정에 관한 정보가 아무것도 없음.
/*
create_account('kisun1234155', masteraccount, masterPrivateKey);*/
//////////////////////

async function create_account(usracc, mstacc, mstpvkey)
{
  // master 계정으로 체인에 연동하는 부분.
  const defaultPrivateKey = mstpvkey;
  const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
  const rpc = new JsonRpc('http://api.kylin.eosbeijing.one:8880', { fetch });
  const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  // api라는 변수에 user의 정보가 담김, transact로 체인과 상호작용.
  try{
      const result = await api.transact({
        actions: [{
          account: 'eosio',
          name: 'newaccount',
          authorization: [{
            actor: mstacc,
            permission: 'active',
          }],
          data: {
            creator: mstacc,
            name: usracc,
            owner: {
              threshold: 1,
              keys: [{
                key: 'PUB_R1_6FPFZqw5ahYrR9jD96yDbbDNTdKtNqRbze6oTDLntrsANgQKZu',
                weight: 1
              }],
              accounts: [],
              waits: []
            },
            active: {
              threshold: 1,
              keys: [{
                key: 'PUB_R1_6FPFZqw5ahYrR9jD96yDbbDNTdKtNqRbze6oTDLntrsANgQKZu',
                weight: 1
              }],
              accounts: [],
              waits: []
            },
          },
        },
        {
          account: 'eosio',
          name: 'buyrambytes',
          authorization: [{
            actor: mstacc,
            permission: 'active',
          }],
          data: {
            payer: mstacc,
            receiver: usracc,
            bytes: 8192,
          },
        },
        {
          account: 'eosio',
          name: 'delegatebw',
          authorization: [{
            actor: mstacc,
            permission: 'active',
          }],
          data: {
            from: mstacc,
            receiver: usracc,
            stake_net_quantity: '1.0000 EOS',
            stake_cpu_quantity: '1.0000 EOS',
            transfer: false,
          }
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 30,
      });
      console.log(result);
    } catch(e) {
    // 이 부분은 아마 아이디 중복 에러일 것,
    // 웹페이지 상에서 사용자에게 중복된 아이디라고 메시지를 띄워줘야 함
    console.log(e);
  }
}
///////////////////////////
