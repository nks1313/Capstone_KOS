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

    /*app.get('/',function(req,res){
            var sess = req.session;
            db.query(`SELECT * FROM category_table`, function(err, categories){
              if(err){
                console.log(err);
                res.status(500).send('Internal Server Error');
              } else{
               cate_arr = result;
               db.query(`SELECT * FROM link_table`, function(err, links){
                 if(err){
                   console.log(err);
                   res.status(500).send('Internal Server Error');
                 } else{
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
               }
               });
              }
            });
    });*/
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
    /*app.get('/list', function (req, res) {

        fs.readFile( userjsonDir, 'utf8', function (err, data) {
           res.end( data );
       });
    });*/

    // Category-detail API
    app.get('/category/:categoryID', function(req, res){
      var categoryID = req.params.categoryID;
      var sess = req.session;
      db.query(`SELECT category_name FROM category_table WHERE category_id = ${categoryID}`,
        function(err1, result1){
          var category_name = result1[0].category_name;
          db.query(`SELECT name, link FROM link_table WHERE category_id = ${categoryID}`,
            function(err2, result2){
              if(err2) throw err;
              res.render('category', {
                  title: "HoneyLinks",
                  link_arr: result2,
                  category_arr: cate_arr,
                  category_name: category_name,
                  length: 5,
                  name: sess.name,
                  username: sess.username
              });
            });
        });
    });

    //////////////////////////////////////////////////////////////
    // Search API
    app.get('/search',function(req,res){
        var keyword = req.query['keyword'];
        var search_opt = req.query['search_opt'];
        var sess = req.session;
        var bool = true;
        var bool_cat = true;
        var bool_name = true;

        if(search_opt == 1){ // search_opt = 1 (통합검색)
            db.query(`SELECT * FROM category_table WHERE category_name like '%${keyword}%'`,
            function(err1,result_cat){
                db.query(`SELECT name, link FROM link_table WHERE name like '%${keyword}%'`,
                function(err2,result_name){
                if(err2) throw err2;
                if(!result_cat.length) bool_cat = false;
                if(!result_name.length) bool_name = false;
                if(!bool_cat && !bool_name) bool = false;
                res.render('search', {
                    title: "HoneyLinks",
                    category_arr: cate_arr,
                    category_array : result_cat,
                    link_arr : result_name,
                    keyword : keyword,
                    search_opt : search_opt,
                    bool : bool,
                    bool_cat : bool_cat,
                    bool_name : bool_name,
                    length: 5,
                    name: sess.name,
                    username: sess.username
                    });
                });
            });
        }
        else if(search_opt ==2){ // search_opt = 2 (카테고리 검색)
            db.query(`SELECT * FROM category_table WHERE category_name like '%${keyword}%'`,
            function(err, result){
            if(err) throw err;
            if(!result.length) bool = false;
            res.render('search', {
                title: "HoneyLinks",
                category_arr: cate_arr,
                category_array : result,
                keyword : keyword,
                search_opt : search_opt,
                bool : bool,
                length: 5,
                name: sess.name,
                username: sess.username
            });
        });
        }
        else{ // search_opt = 3 (사이트 이름으로 검색)
            db.query(`SELECT name, link FROM link_table WHERE name like '%${keyword}%'`,
            function(err, result){
            if(err) throw err;
            if(!result.length) bool = false;
            res.render('search', {
                title: "HoneyLinks",
                link_arr: result,
                category_arr: cate_arr,
                keyword : keyword,
                search_opt : search_opt,
                bool : bool,
                length: 5,
                name: sess.name,
                username: sess.username
            });
        });
        }
    });
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
       /*fs.readFile(userjsonDir, 'utf8', function (err, data) {
            var users = JSON.parse(data);
            res.json(users[req.params.username]);
       });*/
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
    /*app.post('/addUser', function(req, res){

        var result = {  };
        var username = req.body.username;

        // CHECK REQ VALIDITY
        if(!req.body["password"] || !req.body["name"]){
            result["success"] = 0;
            result["error"] = "invalid request";
            res.json(result);
            return;
        }

        // LOAD DATA & CHECK DUPLICATION
        fs.readFile(userjsonDir, 'utf8',  function(err, data){
            var users = JSON.parse(data);
            if(users[username]){
                // DUPLICATION FOUND
                result["success"] = 0;
                result["error"] = "duplicate";
                res.json(result);
                return;
            }

            // ADD TO DATA
            users[username] = req.body;

            // SAVE DATA
            fs.writeFile(userjsonDir,
                         JSON.stringify(users, null, '\t'), "utf8", function(err, data){
                result = {"success": 1};
                //res.json(result);
                res.redirect('/');
            })
        })
    });*/
    /*
    app.post('/addUser/:username', function(req, res){

        var result = {  };
        var username = req.params.username;

        // CHECK REQ VALIDITY
        if(!req.body["password"] || !req.body["name"]){
            result["success"] = 0;
            result["error"] = "invalid request";
            res.json(result);
            return;
        }

        // LOAD DATA & CHECK DUPLICATION
        fs.readFile(userjsonDir, 'utf8',  function(err, data){
            var users = JSON.parse(data);
            if(users[username]){
                // DUPLICATION FOUND
                result["success"] = 0;
                result["error"] = "duplicate";
                res.json(result);
                return;
            }

            // ADD TO DATA
            users[username] = req.body;

            // SAVE DATA
            fs.writeFile(userjsonDir,
                         JSON.stringify(users, null, '\t'), "utf8", function(err, data){
                result = {"success": 1};
                res.json(result);
            })
        })
    });
    */
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
    /*app.post('/login', function(req, res){
        var sess;
        sess = req.session;

        var username = req.body.username;
        var password = req.body.password;

        fs.readFile(userjsonDir, "utf8", function(err, data){
            var users = JSON.parse(data);
            var result = {};
            if(!users[username]){
                // USERNAME NOT FOUND
                result["success"] = 0;
                result["error"] = "not found";
                // login Failed
                res.redirect('/?fail=2');
                return;
            }

            if(users[username]["password"] == password){
                result["success"] = 1;
                sess.username = username;
                sess.name = users[username]["name"];
                res.redirect('/?fail=1');
                //res.json(result);
            }else{
                result["success"] = 0;
                result["error"] = "incorrect";
                res.redirect('/?fail=2');
                //res.json(result);
            }

        })

    });*/
    /*
    app.get('/login/:username/:password', function(req, res){
        var sess;
        sess = req.session;

        fs.readFile(userjsonDir, "utf8", function(err, data){
            var users = JSON.parse(data);
            var username = req.params.username;
            var password = req.params.password;
            var result = {};
            if(!users[username]){
                // USERNAME NOT FOUND
                result["success"] = 0;
                result["error"] = "not found";
                res.json(result);
                return;
            }

            if(users[username]["password"] == password){
                result["success"] = 1;
                sess.username = username;
                sess.name = users[username]["name"];
                res.json(result);

            }else{
                result["success"] = 0;
                result["error"] = "incorrect";
                res.json(result);
            }
        })
    });
*/
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
