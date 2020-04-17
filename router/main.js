module.exports = function(app, fs)
{
    //////////////////////////////////////////////////////////////
    //var mysql = require('mysql');
    //var dbconfig = require('../public/config/database.js');
    //var db = mysql.createConnection(dbconfig);
    //db.connect();
    ///////////////////////////////////////////////////////////////

    var cate_arr;
    var userjsonDir = __dirname + "/../data/user.json";
    app.get('/',function(req,res){
            var sess = req.session;
            res.render(test,{

            });
            /*db.query(`SELECT * FROM category_table`, function(err, categories){
               if(err) throw err;
               cate_arr = categories;
               db.query(`SELECT * FROM link_table`, function(err, links){
                 if(err) throw err;
                 var string=JSON.stringify(links);
                 res.render('index', {
                  title: "HoneyLinks",
                  category_arr: categories,
                  category_array : categories,
                  link_arr : JSON.parse(string),
                  length: 5,
                  name: sess.name,
                  username: sess.username
                 });
              });
            });*/
    });
    app.get('/game',function(req,res){
            var sess = req.session;
            res.render(game,{

            });
            /*db.query(`SELECT * FROM category_table`, function(err, categories){
               if(err) throw err;
               cate_arr = categories;
               db.query(`SELECT * FROM link_table`, function(err, links){
                 if(err) throw err;
                 var string=JSON.stringify(links);
                 res.render('index', {
                  title: "HoneyLinks",
                  category_arr: categories,
                  category_array : categories,
                  link_arr : JSON.parse(string),
                  length: 5,
                  name: sess.name,
                  username: sess.username
                 });
              });
            });*/
    });

    // signUp page API
    app.get('/signUp', function(req,res){
      res.render('signUp', {
          title: "SignUp New ID",
          length: 5
      })
    });
    // about page API
    app.get('/about', function(req,res){
      res.render('about', {
          title: "About...",
          length: 5
      })
    });
    // USER-get_list API
    app.get('/list', function (req, res) {
      var sql = 'SELECT * FROM member_table';
      db.query(sql, function(err, result, fields){
        if(err){
          console.log(err);
          res.status(500).send('Internal Server Error');
        } else {
          console.log(result);
          res.send(result);
        }
      });
    });

    //////////////////////////////////////////////////////////////
    // Search API

    ////////////////////////////////////////////////////////////////

    // USER-get API
    app.get('/getUser/:username', function(req, res){
      var sql = 'SELECT * FROM member_table where username = ?';
      db.query(sql,[req.params.username], function(err, result, fields){
        if(err){
          console.log(err);
          res.status(500).send('Internal Server Error');
        } else {
          console.log(result);
          res.send(result);
        }
      });
    });

    // USER-add API
    app.post('/addUser', function(req, res){

        var result = {  };

        // CHECK REQ VALIDITY
        if(!req.body["password"] || !req.body["name"]){
            result["success"] = 0;
            result["error"] = "invalid request";
            res.json(result);
            return;
        }

        // LOAD DATA & CHECK DUPLICATION
        var username = req.body.username;
        var name = req.body.name;
        var password = req.body.password;
        var email = req.body.email;
        var sql = 'SELECT * FROM member_table WHERE username=?';
        db.query(sql, [username], function(err, result, fields){
          if(err){
            console.log(err);
            res.status(500).send('Internal Server Error');
          } else {
            if(result.length >= 1){
              result["success"] = 0;
              result["error"] = "duplicate";
              res.json(result);
              return;
            }
            else{
              var sql = `INSERT INTO member_table (username,nickname,password,email)
              VALUES(?,?,?,?)`;
              db.query(sql,[username,name,password,email],function(err,insert_result,fields){
                if(err){
                console.log(err);
                res.status(500).send('Internal Server Error');
                } else{
                  result = {"success": 1};
                  //res.json(result);
                  res.redirect('/');
                }
              });
            }
          }
        });
      });
    // USER-update API
    app.put('/updateUser/:username', function(req, res){

        var result = {  };
        var username = req.params.username;

        // CHECK REQ VALIDITY
        if(!req.body["password"] || !req.body["name"]){
            result["success"] = 0;
            result["error"] = "invalid request";
            res.json(result);
            return;
        }

        // LOAD DATA
        fs.readFile(userjsonDir, 'utf8',  function(err, data){
            var users = JSON.parse(data);
            // ADD/MODIFY DATA
            users[username] = req.body;

            // SAVE DATA
            fs.writeFile(userjsonDir,
                         JSON.stringify(users, null, '\t'), "utf8", function(err, data){
                result = {"success": 1};
                res.json(result);
            })
        })
    });

    // USER-delete API
    app.delete('/deleteUser/:username', function(req, res){
        var result = { };
        //LOAD DATA
        fs.readFile(userjsonDir, "utf8", function(err, data){
            var users = JSON.parse(data);

            // IF NOT FOUND
            if(!users[req.params.username]){
                result["success"] = 0;
                result["error"] = "not found";
                res.json(result);
                return;
            }

            // DELETE FROM DATA
            delete users[req.params.username];

            // SAVE FILE
            fs.writeFile(userjsonDir,
                         JSON.stringify(users, null, '\t'), "utf8", function(err, data){
                result["success"] = 1;
                res.json(result);
                return;
            })
        })

    });

    // LOGIN API
    app.post('/login', function(req, res){
        var sess;
        sess = req.session;
        var username = req.body.username;
        var password = req.body.password;
        var sql = 'SELECT * FROM member_table WHERE username=?';
        db.query(sql, [username], function(err, user, fields){
          if(err){
            console.log(err);
            res.status(500).send('Internal Server Error');
          } else{
            console.log(user[0]["password"]);
            var result = {};
            if(!user){
                // USERNAME NOT FOUND
                result["success"] = 0;
                result["error"] = "not found";
                // login Failed
                res.redirect('/?fail=2');
                return;
            }
            if(user[0]["password"] == password){
                result["success"] = 1;
                sess.username = username;
                sess.name = user[0]["nickname"];
                res.redirect('/?fail=1');
                //res.json(result);
            }else{
                result["success"] = 0;
                result["error"] = "incorrect";
                res.redirect('/?fail=2');
                //res.json(result);
            }
          }
        });
    });

    // LOGOUT API
    app.get('/logout', function(req, res){
        sess = req.session;
        if(sess.username){
            req.session.destroy(function(err){
                if(err){
                    console.log(err);
                }else{
                    res.redirect('/');
                }
            })
        }else{
            res.redirect('/');
        }
    })

}
