var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');

/* GET */
/*
router.route('/').get(function(req, res, next) {
    var id = req.query.user_id;
    var pw = req.query.user_pw;
    var name = req.query.user_name;
    var email = req.query.user_email;
    console.log("## get request");
    res.render('result_page', { title: 'Express', id: id, pw : pw, name: name, email: email, method: "get" });
});*/

/* POST */
router.post('/', function(req, res, next) {
    var id = req.body.user_id;
    var pw = req.body.user_pw;
    var name = req.body.user_name;
    var email = req.body.user_email;
    var eosid = req.body.eosid;
    console.log("## post request");
    console.log(id);

    //DB Query
    var mysql = require('mysql');
    var dbconfig = {
          host:'kiseonbus.cgxsy1aopkq7.us-east-2.rds.amazonaws.com',
          user:'kiseon',
          password:'rltjsqjtm',
          database:'KOS'
      };
      var db = mysql.createConnection(dbconfig);
    db.connect();

    var sql = `INSERT INTO USER (USER_REAL_ID,USER_PASSWORD,USER_NAME,USER_EMAIL,EOS_ID)
              VALUES(?,?,?,?,?)`;
              db.query(sql,[id,pw,name,email,eosid],function(err,insert_result,fields){
                console.log("hi");
              });

    //create_account(id, masteraccount, masterPrivateKey);
    res.redirect('login');
});

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
