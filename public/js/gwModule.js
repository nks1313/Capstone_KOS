// Game Window (gW) Module
// gwModule.js
// Version 2.2.13 (7:52 PM Wed May 1, 2019)
// Written by: James D. Miller

// The demos, and their multi-player functionality, are dependent on two additional
// JavaScript modules: hostAndClient.js (referenced here as hC) and server.js.
// Discussion and links to these files are at www.timetocode.org/multiplayer.html

var gW = (function() {

   // To insist on tighter code: e.g. globals, etc...
   "use strict";

   // Short names for Box2D functions
   var b2Vec2 = Box2D.Common.Math.b2Vec2

   ,   b2BodyDef = Box2D.Dynamics.b2BodyDef
   ,   b2Body = Box2D.Dynamics.b2Body
   ,   b2FixtureDef = Box2D.Dynamics.b2FixtureDef
   ,   b2Fixture = Box2D.Dynamics.b2Fixture
   ,   b2World = Box2D.Dynamics.b2World

   ,   b2DistanceJointDef = Box2D.Dynamics.Joints.b2DistanceJointDef
   ,   b2DistanceJoint = Box2D.Dynamics.Joints.b2DistanceJoint

   ,   b2MassData = Box2D.Collision.Shapes.b2MassData
   ,   b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape
   ,   b2CircleShape = Box2D.Collision.Shapes.b2CircleShape
   ,   b2AABB = Box2D.Collision.b2AABB
   ;

   // Common variables inside of gW (game window) module //////////////////////////////

   var g_2d_mps2, g_mps2 = 9.8;

   // The Air Table (aT): a place to call home for pucks, pins, springs, and walls.
   var aT = {};

   aT.puckMap = {}; // keyed by puck name.
   aT.jelloPucks = []; // An array for use in testing for tangled jello.

   aT.pinMap = {};  // keyed by pin name.

   aT.springMap = {}; // keyed by spring name.

   aT.wallMap = {}; // keyed by wall name.

   // Make a separate container for constants (c) and control flags used by aT objects. This avoids
   // circular references (and associated problems) with JSON capturing.
   var c = {};
   c.restitution_default_gOn =  0.7;
   c.friction_default_gOn =  0.6;

   c.restitution_default_gOff = 1.0;
   c.friction_default_gOff = 0.1;

   c.g_ON = false;

   c.bulletAgeLimit_ms = 1000;

   // This 60 corresponds with the selected (default) value on the index.html page.
   c.frameRate = 0;
   // Seconds per frame
   c.deltaT_s = 1.0/c.frameRate;
   c.dtFloating = false;

   c.demoIndex = null;
   c.demoVersion = null;
   c.leaderBoardIndex = 0;

   //c.contactCounter = 0;
   c.jello = {};
   c.jello.tangleTimer_s = 0;
   c.jello.reported = false;
   c.jello.verifyingDeTangle = false;

   c.puckPopperTimer_s = 0;
   c.puckPopperPlayers = {'human':0,'drone':0};

   c.npcSleep = false;
   c.npcSleepUsage = false;

   c.lastClientToScoreHit = null;

   c.chatLayoutState = 'notSetYet';

   c.singleStep = false;
   c.softContraints_default = false;

   c.comSelection_previous = {};
   c.comSelection_previous.value = null;
   c.comSelection_previous.enabled = true;

   c.canvasColor = 'black';

   c.scoreTip = '+200: win,\n+100: pop client or drone,\n+50: pop regular puck,\n+10: hit a puck with your bullet,\n-10: get hit by somebody else&#39;s bullet,\n-1: bad shot';

   c.startingPosAndVels = [];

   // Client map keyed by client name.
   var clients = {};

   var tableMap = new Map();  // Special map where keys can be objects.
   var world, worldAABB;
   var myRequest, time_previous, dt_frame_ms, dt_frame_previous_ms, dt_frame_s, resumingAfterPause;
   var canvas, canvasDiv, ctx, px_per_m;
   var helpMessage, scoreMessage, ppTimerMessage, winMessage, gameTitle, videoTitle;

   var hostMSelect, hostSelectBox;

   var popSounds;

   // Document Controls (dC).
   var dC = {};
   dC.gravity = null;
   dC.pause = null;
   dC.comSelection = null;
   dC.multiplayer = null;
   dC.stream = null;
   dC.editor = null;
   dC.localCursor = null;

   // Key values.
   var keyMap = {'48':'key_0', '49':'key_1', '50':'key_2', '51':'key_3', '52':'key_4', '53':'key_5', '54':'key_6', '55':'key_7', '56':'key_8', '57':'key_9',
                 '65':'key_a', '66':'key_b', '67':'key_c', '68':'key_d', '69':'key_e', '70':'key_f', '71':'key_g',
                 '73':'key_i', '74':'key_j', '75':'key_k', '76':'key_l', '77':'key_m', '78':'key_n', '79':'key_o',
                 '80':'key_p', '81':'key_q', '82':'key_r', '83':'key_s',
                 '84':'key_t', '86':'key_v', '87':'key_w', '88':'key_x', '90':'key_z',
                 '16':'key_shift', '17':'key_ctrl',
                 '18':'key_alt', // both left and right alt key on Windows
                 '32':'key_space',

                 // Note that default behavior is blocked on all these arrow-key type keys. Search on
                 // arrowKeysMap in the handler for the keydown event.
                 // Exceptions to this are the key_+ and key_- number-pad keys that are in the allowDefaultKeysMap.
                 // This allows the desired native zoom feature when using the ctrl key along with these keys.
                 '33':'key_pageUp', '34':'key_pageDown',
                 '37':'key_leftArrow', '38':'key_upArrow', '39':'key_rightArrow', '40':'key_downArrow',
                 // These are the number pad +/- keys.
                 '107':'key_+', '109':'key_-',
                 // These are the +/- keys on the main keyboard.
                 '187':'key_=+', '189':'key_-_', // Chrome
                 '61':'key_=+',  '173':'key_-_', // Firefox

                 '188':'key_lt', '190':'key_gt',

                 '191':'key_questionMark',

                 '219':'key_[', '221':'key_]',

                 '225':'key_alt'};   // right-side alt key, needed for RPi

   var fileName = "gwModule.js";

   // Switch to enable debugging...
   var db = {};
   // ...of the WebRTC stuff.
   db.rtc = false;


   /////////////////////////////////////////////////////////////////////////////
   ////
   ////  Object Prototypes
   ////
   /////////////////////////////////////////////////////////////////////////////


   function Vec2D(x, y) {
      this.x = x;
      this.y = y;
   }
   Vec2D.areEqual = function( p1_2d, p2_2d) {
      if ((p1_2d.x == p2_2d.x) && (p1_2d.y == p2_2d.y)) {
         return true;
      } else {
         return false;
      }
   }
   Vec2D.prototype.addTo = function( vectorToAdd) {
      // Modify the base vector.
      this.x += vectorToAdd.x;
      this.y += vectorToAdd.y;
   }
   Vec2D.prototype.add = function( vectorToAdd) {
      // Return a new vector.
      var x_sum = this.x + vectorToAdd.x;
      var y_sum = this.y + vectorToAdd.y;
      return new Vec2D( x_sum, y_sum);
   }
   Vec2D.prototype.subtract = function( vectorToSubtract) {
      // Return a new vector.
      var x_diff = this.x - vectorToSubtract.x;
      var y_diff = this.y - vectorToSubtract.y;
      return new Vec2D( x_diff, y_diff);
   }
   Vec2D.prototype.scaleBy = function( scalingFactor) {
      var x_prod = this.x * scalingFactor;
      var y_prod = this.y * scalingFactor;
      return new Vec2D( x_prod, y_prod);
   }
   Vec2D.prototype.length = function() {
      return Math.sqrt(this.x*this.x + this.y*this.y);
   }
   Vec2D.prototype.normal = function() {
      var length = this.length();
      var x = this.x / length;
      var y = this.y / length;
      return new Vec2D(x, y);
   }
   Vec2D.prototype.dot = function( vector) {
      return (this.x * vector.x) + (this.y * vector.y);
   }
   Vec2D.prototype.projection_onto = function( vec_B) {
      var vB_dot_vB = vec_B.dot( vec_B);
      if (vB_dot_vB > 0) {
         return vec_B.scaleBy( this.dot( vec_B) / vB_dot_vB );
      } else {
         // Must catch this null when dealing with pinned springs (can have
         // zero separation)
         return null;
      }
   }
   Vec2D.prototype.rotate90 = function() {
      return new Vec2D(-this.y, this.x);
   }
   Vec2D.prototype.rotated_by = function( angle_degrees) {
      var angle_radians = (Math.PI/180) * angle_degrees;
      var cos = Math.cos( angle_radians);
      var sin = Math.sin( angle_radians);
      // The rotation transformation.
      var x = this.x * cos - this.y * sin;
      var y = this.x * sin + this.y * cos;
      // Modify the original vector.
      this.x = x;
      this.y = y;
   }
   Vec2D.prototype.length_squared = function() {
      return (this.x*this.x + this.y*this.y);
   }
   Vec2D.prototype.get_angle = function() {
      // Determine the angle (in degrees) that this vector makes with the x axis. Measure
      // counterclockwise from the x axis.
      if (this.length_squared() == 0) {
         return 0;
      } else {
         // Yes, this is correct, y is the first parameter.
         return Math.atan2(this.y, this.x) * (180/Math.PI);
      }
   }
   Vec2D.prototype.set_angle = function( angle_degrees) {
      // Set the direction of the vector to a specific angle.
      this.x = this.length();
      this.y = 0;
      this.rotated_by( angle_degrees);
   }
   Vec2D.prototype.angleBetween_r = function( p1_2d, p2_2d) {
      // Find the angle formed by the two vectors that originate at this vector, with end points at
      // p1 and p2.

      // Angle (degrees relative to x axis) of the differential vector between this vector p1_2d.
      var angle_1_d = p1_2d.subtract(this).get_angle();

      // Angle (degrees relative to x axis) of the differential vector between this vector p2_2d.
      var angle_2_d = p2_2d.subtract(this).get_angle();

      // Change in angle (radians) from p1 to p2.
      var delta_r = (angle_2_d - angle_1_d) * (Math.PI/180.0);

      return delta_r;
   }
   Vec2D.prototype.matchAngle = function( p_2d) {
      var newAngle_d = p_2d.get_angle();
      this.set_angle( newAngle_d);
      return newAngle_d;
   }


   function HelpMessage( pars) {
      this.message = setDefault( pars.message, "");
      this.timeLimit_s = setDefault( pars.timeLimit_s, 2.0);
      this.font = setDefault( pars.font, "20px Arial");
      this.color = setDefault( pars.color, 'yellow');
      this.loc_px = setDefault( pars.loc_px, {x:30, y:40});

      this.messageSeries = null;
      this.index = 0;

      this.timeType = setDefault( pars.timeType, 'system'); //'game'

      this.birthTime = window.performance.now();
      this.time_s = 0.0;

      this.popAtEnd = setDefault( pars.popAtEnd, false);
   }
   HelpMessage.prototype.resetMessage = function( message, timeLimit_s) {
      this.message = "";
      this.messageSeries = null;
   }
   HelpMessage.prototype.newMessage = function( message, timeLimit_s) {
      this.time_s = 0.0;
      this.birthTime = window.performance.now();
      this.timeLimit_s = timeLimit_s;
      this.message = message;
   }
   HelpMessage.prototype.newMessageSeries = function( message) {
      this.messageSeries = message;
      // Initialize the first message.
      this.time_s = 0.0;
      this.birthTime = window.performance.now();
      this.index = 1;
      this.message = this.messageSeries[this.index].message;
      this.timeLimit_s = this.messageSeries[this.index].tL_s;
   }
   HelpMessage.prototype.addToIt = function( moreText) {
      this.message = this.message + moreText;
   }
   HelpMessage.prototype.displayIt = function() {
      if (this.timeType == 'system') {
         this.time_s = (window.performance.now() - this.birthTime)/1000.0;
      } else {
         this.time_s += c.deltaT_s;
      }

      if ((this.message != "") && (this.time_s < this.timeLimit_s)) {
         var lines = this.message.split("\\");
         for (var line_index in lines) {
            //ctx.font = this.font;
            //ctx.fillStyle = this.color;
            var y_px = this.loc_px.y + (line_index * parseInt(this.font.substring(0,3)) * 1.20);
            //ctx.fillText(lines[ line_index], this.loc_px.x, y_px);
         }

      } else {
         // Before ending the message, make an optional pop sound.
         if (this.popAtEnd && (this.message != "")) popSounds.play('low');

         this.message = "";
         this.time_s = 0;

         // If it's a series, check to see if there's another message...
         if (this.messageSeries) {
            this.index += 1;
            if (this.messageSeries[this.index]) {
               // Update the characteristics of the text if changes have been supplied in the series.
               if (this.messageSeries[this.index].loc_px) this.loc_px = this.messageSeries[this.index].loc_px;
               if (this.messageSeries[this.index].font) this.font = this.messageSeries[this.index].font;
               this.popAtEnd = setDefault( this.messageSeries[this.index].popAtEnd, false);

               this.message = this.messageSeries[this.index].message;
               this.timeLimit_s = this.messageSeries[this.index].tL_s;
               this.time_s = 0;
               this.birthTime = window.performance.now();
            }
         }
      }
   }


   function MultiSelect() {
      this.map = null;
      this.center_2d_m = null;
      this.findCenterEnabled = null;
      this.resetAll();
   }
   // A method that loops over the selected objects (this.map) of this instance of MultiSelect
   MultiSelect.prototype.applyToAll = function( doThis) {
      for (var objName in this.map) {
         var tableObj = this.map[ objName];
         doThis( tableObj);
      }
   }
   MultiSelect.prototype.resetAll = function() {
      this.applyToAll( msObject => msObject.selectionPoint_l_2d_m = new Vec2D(0,0) );
      this.map = {};
      this.resetCenter();
   }
   MultiSelect.prototype.resetCenter = function() {
      this.center_2d_m = new Vec2D(0,0);
      this.findCenterEnabled = true;
   }
   MultiSelect.prototype.count = function() {
      return Object.keys(this.map).length;
   }
   MultiSelect.prototype.findCenter = function() {
      this.center_2d_m = new Vec2D(0,0);
      this.applyToAll( tableObj => {
         this.center_2d_m = this.center_2d_m.add( tableObj.position_2d_m);
      });
      this.center_2d_m = this.center_2d_m.scaleBy( 1.0 / this.count());
   }
   MultiSelect.prototype.removeOne = function( theBody) {
      // un-dash the springs
      Spring.findAll_InMultiSelect( spring => spring.dashedLine = false );
      delete this.map[ theBody.name];
      // re-dash the springs
      Spring.findAll_InMultiSelect( spring => spring.dashedLine = true );
   }
   MultiSelect.prototype.pasteCopyAtCursor = function() {
      if (this.count() < 1) {
         helpMessage.newMessage("Nothing in multi-select. Use shift (or alt) key to multi-select.", 1.0);
         return;
      }
      this.findCenter();
      // Offset between the center of the group and the cursor position.
      var changeInPosition_2d_m = clients['local'].mouse_2d_m.subtract( this.center_2d_m);
      // A temporary map to associated the original pucks to the copies.
      var copyMap = {};
      // Copy pucks, pins, and walls to the cursor position.
      this.applyToAll( tableObj => {
         // Exclude navigation pins and client pucks.
         if ( ! (tableObj.nextPinName || tableObj.clientName) ) {
            var newPosition_2d_m = tableObj.position_2d_m.add( changeInPosition_2d_m);
            var newTableObj = tableObj.copyThisOne({'position_2d_m':newPosition_2d_m});
            copyMap[tableObj.name] = newTableObj;
         } else {
            helpMessage.newMessage("Note: client pucks and navigation pins are excluded\\   from multi-select replication.", 2.0);
         }
      });
      // Copy all the springs onto the newly created pucks. Use the copyMap to determine
      // correspondence.
      Spring.findAll_InMultiSelect( spring => {
         // Exclude navigation springs
         if ( ! (spring.navigationForNPC)) {
            // Copy this spring onto these two pucks.
            var targetPuck1 = copyMap[ spring.spo1.name];
            var targetPuck2 = copyMap[ spring.spo2.name];
            spring.copyThisOne( targetPuck1, targetPuck2);
         }
      });
   }


   function SelectBox( pars) {
      this.clickPoint_2d_px   = setDefault( pars.clickPoint_2d_px, new Vec2D(0,0));
      this.currentMouse_2d_px = setDefault( pars.currentMouse_2d_px, new Vec2D(0,0));
      this.enabled = false;
      this.limits = {};
   }
   // Make this a module-level function, not part of the prototype, so it can be used in the callback of the QueryAABB.
   // Check if this point is inside the bounding limits of the box.
   SelectBox.pointInside = function( p_2d_m, limits) {
      if (( p_2d_m.x > limits.min_x ) && ( p_2d_m.x < limits.max_x ) && ( p_2d_m.y > limits.min_y ) && ( p_2d_m.y < limits.max_y )) {
         return true;
      } else {
         return false;
      }
   }
   SelectBox.prototype.selectBodiesInBox = function() {
      var aabb = new b2AABB();

      // The two corners of the box, 1 and 2, in world coordinates.
      var c1_2d_m = worldFromScreen( this.clickPoint_2d_px);
      var c2_2d_m = worldFromScreen( this.currentMouse_2d_px);

      this.limits.min_x = Math.min(c1_2d_m.x, c2_2d_m.x);
      this.limits.max_x = Math.max(c1_2d_m.x, c2_2d_m.x);
      this.limits.min_y = Math.min(c1_2d_m.y, c2_2d_m.y);
      this.limits.max_y = Math.max(c1_2d_m.y, c2_2d_m.y);

      // Provide the corners with the lowest values (lower left) and the highest values (upper right)
      aabb.lowerBound.Set( this.limits.min_x, this.limits.min_y);
      aabb.upperBound.Set( this.limits.max_x, this.limits.max_y);

      // Query the world for overlapping shapes.
      var objectCount = 0;

      // The callback function can't use "this" so make a reference in the local scope.
      var limits = this.limits;

      // This runs the box query. The function gets called once for each fixture found
      // to be overlapping the box.
      world.QueryAABB( function( fixture) {

         var bd2_Body = fixture.GetBody();
         var table_body = tableMap.get( bd2_Body);

         // COM of this body.
         var p_2d_m = table_body.position_2d_m;

         // Check if Center-Of-Mass of this object is within the selection box. This is needed because the
         // query returns all bodies for which their bounding box is overlapping the selection box. So this
         // give more selection control to avoid nearby objects.
         var itsInside = SelectBox.pointInside( p_2d_m, limits);

         // Don't select walls or pins if the editor is off.
         if (itsInside && !(!dC.editor.checked && ((table_body.constructor.name == "Wall") || (table_body.constructor.name == "Pin")))) {
            objectCount += 1;
            // Add this body to the hostMSelect map.
            hostMSelect.map[ table_body.name] = table_body;
         }

         // Keep looking at all the fixtures found in the query.
         return true;
      }, aabb);
      /*
      Check each point in hostMSelect map. Remove any that are no longer in the box.

      Wrote this in three different ways below: (1) with a loop over the map, (2) passing
      a function to the applyToAll method, and (3) binding the function to the hostMSelect
      object (setting "this") then passing it to applyToAll. The 3rd one is being used.

      for (var objName in hostMSelect.map) {
         var tableObj = hostMSelect.map[ objName];
         if ( ! SelectBox.pointInside(tableObj.position_2d_m, this.limits)) {
            hostMSelect.removeOne( tableObj);
         }
      }

      or

      hostMSelect.applyToAll( function( tableObj) {
         if ( ! SelectBox.pointInside(tableObj.position_2d_m, limits)) {
            hostMSelect.removeOne( tableObj);
         };
      });

      or

      Note "limits" is defined in the surrounding scope here. The "this"
      reference points to the hostMSelect object as dictated in the call
      to bind method of the function that's being passed in.

      hostMSelect.applyToAll( function( tableObj) {
         if ( ! SelectBox.pointInside(tableObj.position_2d_m, limits)) {
            this.removeOne( tableObj);
         };
      }.bind( hostMSelect));

      or

      Using arrow-function notation. And without using bind and the "this" to get at the removeone method.
      Note you can't (and shouldn't want to) bind to an arrow function. Must use a regular function (see above).
      Generally the arrow functions are nice for passing in a function so that the "this" in the function
      refers to the surrounding context. Of course, can't use "this", and the surrounding context here, to
      get at removeOne, since it is part of the MultiSelect class.
      */
      hostMSelect.applyToAll( tableObj => {
         if (!SelectBox.pointInside( tableObj.position_2d_m, limits)) hostMSelect.removeOne( tableObj);
      });
   }
   SelectBox.prototype.start = function() {
      Puck.applyToAll( puck => puck.selectionPoint_l_2d_m = new Vec2D(0,0) );
      this.enabled = true;
      this.clickPoint_2d_px = clients['local'].mouse_2d_px;
   }
   SelectBox.prototype.stop = function() {
      this.enabled = false;
   }
   SelectBox.prototype.update = function() {
      this.currentMouse_2d_px = clients['local'].mouse_2d_px;
      this.selectBodiesInBox();
   }
   SelectBox.prototype.draw = function() {
      var corners_2d_px = [this.clickPoint_2d_px,   new Vec2D(this.currentMouse_2d_px.x, this.clickPoint_2d_px.y),
                           this.currentMouse_2d_px, new Vec2D(this.clickPoint_2d_px.x,   this.currentMouse_2d_px.y)];
      drawPolygon( ctx, corners_2d_px, {'borderColor':'red', 'fillIt':false});
   }


   function Client( pars) {
      this.parsAtBirth = pars;
      //this.alsoThese = [];
      this.color = setDefault( pars.color, "red");

      // Incrementing the network client name is done in server.js.
      this.name = setDefault( pars.name, "manWithNoName");

      // Increment the NPC index, but use the higher value.
      if (this.name.slice(0,3) == 'NPC') {
         Client.npcIndex += 1;
         Client.npcIndex = Math.max(Client.npcIndex, Number(this.name.slice(3)));
         this.name = 'NPC' + Client.npcIndex;
      }
      // Add this client to the map.
      clients[this.name] = this;

      this.puck = null;
      this.player = setDefault( pars.player, true);
      this.nickName = setDefault( pars.nickName, null);
      this.twoThumbs = false;

      this.isMouseDown = false;
      this.mouseUsage = false;
      this.button = null;

      // Initially put the drawn cursor (for the local user) out of range of the canvas. That way the cursor doesn't
      // render there initially if the page is refreshed, looks cleaner when first coming to the page.
      if (this.name == 'local') {
         this.mouseX_px = -20;
         this.mouseY_px = -20;
      } else {
         this.mouseX_px = +10;
         this.mouseY_px = +10;
      }

      this.mouse_2d_px = new Vec2D(this.mouseX_px, this.mouseY_px);
      this.mouse_2d_m = worldFromScreen( this.mouse_2d_px);

      // Make a cursor pin for all human clients.
      if (this.name.slice(0,3) != 'NPC') {
         this.pin = new Pin( Object.assign({}, this.mouse_2d_m), {'name':this.name, 'cursorPin':true, 'borderColor':'white', 'fillColor':this.color});
      } else {
         this.pin = null;
      }

      this.selectedBody = null;

      // Selection point (in the local coordinate system of the selected object).
      this.selectionPoint_l_2d_m = null;
      // Selection point (in the world coordinates).
      this.selectionPoint_w_2d_m = null;
      this.selectionPoint_w_2d_px = null;

      this.cursorSpring = null;

      // Initialize all the key values to be Up.
      for (var key in keyMap) this[keyMap[key]] = 'U';

      /*
      The following enable/disable feature is needed for keys that do
      something that should only be done once while the key is down (not each
      frame). This technique is needed in cases where action is potentially
      triggered each frame and it is not possible to compare the new key state
      (coming from a client or the local keyboard) with the current key state.

      Examples where this is NOT needed are the tube rotation keys. In
      those cases, something must be done in each frame while the key is down.
      The action repeats as the key state is inspected each frame (and seen to
      be down).

      Note there is an area in this code where pure-local-client key events
      are handled to avoid repetition; see the keydown area in this file.
      There, repetition is caused by holding the key down and the associated
      repeated firing of the keydown event. There, new and current states can
      be compared to avoid repetition.

      See also the updateClientState function and how it suppressed
      unwanted repetition by comparing new and current states.
      */
      this.key_s_enabled = true;  // Flip the jet.
      this.key_k_enabled = true;  // Change the gun orientation by 1 large increment.
      this.key_i_enabled = true;  // Start a bullet stream.

      // This client-cursor triangle is oriented like an arrow pointing to 10 o'clock.
      //this.triangle_raw_2d_px = [new Vec2D(0,0), new Vec2D(14,8), new Vec2D(8,14)];
      this.triangle_raw_2d_px = [new Vec2D(0,0), new Vec2D(11,12), new Vec2D(3,16)];

      this.NPC_guncooling_timer_s = 0.0;
      this.NPC_guncooling_timer_limit_s = 2.0;
      this.NPC_shield_timer_s = 0.0;
      this.NPC_shield_timer_limit_s = 0.5;
      this.NPC_pin_timer_s = setDefault( pars.NPC_pin_timer_s, 0.0);
      this.NPC_pin_timer_limit_s = setDefault( pars.NPC_pin_timer_limit_s, 5.0);

      this.NPC_aimStepCount = 0;
      this.NPC_aimStepCount_limit = 20;
      this.NPC_skipFrame = false;

      // rtc contains WebRTC peer connection and data channel objects.
      this.rtc = new hC.RTC({});

      // Score for the leaderboard
      this.score = 0;
   }
   // Variables common to all instances of Client...
   Client.npcIndex = 0;
   Client.countAtGameStart = 0;
   Client.mouse_springs = {'0':{'drag_c':   2.0, 'strength_Npm':   60.0, 'unstretched_width_m':0.060},
                           '1':{'drag_c':   0.1, 'strength_Npm':    2.0, 'unstretched_width_m':0.002},
                           '2':{'drag_c':  20.0, 'strength_Npm': 1000.0, 'unstretched_width_m':0.200}};
   Client.colors = {'1':'yellow','2':'blue','3':'green','4':'pink','5':'orange',
                    '6':'brown','7':'greenyellow','8':'cyan','9':'tan','0':'purple'};

   Client.applyToAll = function ( doThis) {
      for (var clientName in clients) {
         var client = clients[ clientName];
         doThis( client);
      }
   }
   Client.deleteNPCs = function() {
      Client.applyToAll( client => {if (client.name.slice(0,3) == 'NPC') delete clients[ client.name]});
      Client.npcIndex = 0;
   }
   Client.scoreSummary = [];
   Client.winnerBonusGiven = false;
   Client.resetScores = function() {
      Client.applyToAll( client => {
         client.mouseUsage = false;
         client.score = 0;
         client.twoThumbs = false;
      });
      // If still paused, indicate pause usage.
      if (c.npcSleep) {
         c.npcSleepUsage = true;
      } else {
         c.npcSleepUsage = false;
      }
      c.puckPopperTimer_s = 0;
      Client.winnerBonusGiven = false;
      Client.countAtGameStart = Object.keys(clients).length;
      Client.scoreSummary = [];
   }
   // Sometimes it's just better to see 'host' displayed instead of 'local'.
   Client.translateIfLocal = function( clientName) {
      var nameString;
      if (clientName == 'local') {
         nameString = 'host';
      } else {
         nameString = clientName;
      }
      return nameString;
   }
   Client.makeNPCtracks = function( nTracks, pinIndexStart, npcIndexStart, initialLocation_2d_m) {
      // Make multiple NPC clients, each on its own navigation track (single pin). Use editor to add
      // more pins as wanted.
      var pinIndex, pinName, npcIndex, npcName, x_m;
      for (var i = 0, len = nTracks; i < len; i++) {
         pinIndex = pinIndexStart + i;
         npcIndex = npcIndexStart + i;
         pinName = 'pin' + pinIndex;
         npcName = 'NPC' + npcIndex;
         console.log(pinName + ',' + npcName);
         // Pin is referenced by the NPC puck (so do this before instantiating the puck)
         new Pin( initialLocation_2d_m, {'radius_px':3, 'NPC':true, 'previousPinName':pinName, 'name':pinName, 'nextPinName':pinName});
         // NPC client is referenced by the NPC puck (so do this before instantiating the puck)
         new Client({'name':npcName, 'color':'purple'});
         new Puck( initialLocation_2d_m, new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':npcName, 'linDamp':1.0, 'hitLimit':20, 'pinName':pinName} );
         // Put the next one a little more to the right
         initialLocation_2d_m.x += 1.0;
      }
   }
   Client.prototype.addScoreToSummary = function( winnerTimeString) {
      var nameString, finalNameString, mouseString, npcSleepString, virtualGamePadString;
      nameString = Client.translateIfLocal(this.name);
      if (this.nickName) {
         finalNameString = this.nickName + ' (' + nameString + ')';
      } else {
         finalNameString = nameString;
      }
      // Clear the mouseString warning for Jello Madness. Mouse is always used.
      if (c.demoIndex == 6) {
         mouseString = '';
      } else {
         mouseString = (this.mouseUsage) ? 'x':'';
      }
      npcSleepString = (c.npcSleepUsage) ? 'x':'';
      virtualGamePadString = (this.twoThumbs) ? 'x':'';
      // The randomIndex provides a way to nearly uniquely associate records in the leaderboard report with the local game summary.
      Client.scoreSummary.push( {'score':this.score, 'rawName':this.name, 'name':finalNameString, 'virtualGamePad':virtualGamePadString,
                                 'winner':winnerTimeString, 'mouse':mouseString, 'npcSleep':npcSleepString, 'randomIndex':Math.floor((Math.random() * 100000))} );
   }
   Client.prototype.checkForMouseSelection = function() {
      // Deal with selection.
      if (this.selectedBody === null) {
         if (this.isMouseDown) {

            // Check for a body at the mouse position.
            var selected_b2d_Body = b2d_getBodyAt( this.mouse_2d_m);

            if (selected_b2d_Body) {
               var selectedBody = tableMap.get( selected_b2d_Body);
               //console.log("body=" + selectedBody.name + ", pin=" + selectedBody.pinName);

               // Block the selection on kinematic bodies (like walls and pins) by a network client.
               if ( ((selected_b2d_Body.GetType() == b2Body.b2_kinematicBody) && (this.name != 'local')) ||
                    // Block wall and pin selection if the wall/pin editor is off.
                    (!dC.editor.checked && ((selectedBody.constructor.name == "Wall") || (selectedBody.constructor.name == "Pin"))) ) {

                  selected_b2d_Body = null;

               } else {
                  // Consider the case where local client is trying to edit multiple objects (only shift key is down).
                  if ((this.name == 'local') && (this.key_shift == "D") && (this.key_ctrl == "U") && (this.key_alt == "U")) {

                     // Add this body to the multiple-select map (if not already there).
                     if (!(selectedBody.name in hostMSelect.map) && (this.button == 0)) {
                        // Record the local selection point on the body.
                        if (dC.comSelection.checked) {
                           selectedBody.selectionPoint_l_2d_m = new Vec2D(0,0);
                        } else {
                           selectedBody.selectionPoint_l_2d_m = selected_b2d_Body.GetLocalPoint( this.mouse_2d_m);
                        }

                        hostMSelect.map[ selectedBody.name] = selectedBody;

                     // Remove this body from the map if doing a right-button (2) mouse click.
                     } else if ((selectedBody.name in hostMSelect.map) && (this.button == 2)) {
                        hostMSelect.removeOne( selectedBody);
                     }

                  // If using the box-selection feature...
                  } else if ((this.name == 'local') && (this.key_alt == "D") && (this.key_ctrl == "U")) {
                     if ((selectedBody.name in hostMSelect.map) && (this.button == 2)) {
                        hostMSelect.removeOne( selectedBody);
                     }

                  // Normal single-body selection:
                  // Allow single-body pin selection only if the wall/pin editor is on.
                  } else if (!(!dC.editor.checked && (selectedBody.constructor.name == "Pin"))) {
                     // Which body object has been selected?
                     this.selectedBody = tableMap.get( selected_b2d_Body);
                     console.log('\nbody,gI=' + this.selectedBody.name + ',' + this.selectedBody.groupIndex);
                     if (this.selectedBody.clientName) console.log('client,gI = ' + this.selectedBody.clientName +','+ this.selectedBody.groupIndex);

                     // Mark it as selected and record the local point.
                     this.selectionPoint_l_2d_m = selected_b2d_Body.GetLocalPoint( this.mouse_2d_m);
                     this.modifyCursorSpring('attach');

                     // If selecting a small puck with right-button on mouse, warn user about stability:
                     if ((this.selectedBody.mass_kg < 0.15) && (this.button == 2)) {
                        helpMessage.newMessage("For a small puck, use the middle or left mouse button.", 3.0);
                     }

                     // If using the control key (deterministic drag or rotation) and there already are
                     // some bodies in the multi-select, add this body to the multi-select group. This
                     // insures normal group-rotation behaviors.
                     if ((this.key_ctrl == "D") && (hostMSelect.count() > 0)) {
                        hostMSelect.map[ selectedBody.name] = selectedBody;
                     }
                  }
               }
            }
         }
      } else {
         // Released the mouse button:
         if (!this.isMouseDown) {
            this.modifyCursorSpring('dettach');
            this.selectionPoint_l_2d_m = null;
            this.selectionPoint_w_2d_m = null;
            this.selectionPoint_w_2d_px = null;
            this.selectedBody = null;
         }
      }
   }
   Client.prototype.modifyCursorSpring = function( mode) {
      // If there isn't already a cursor spring, add one.
      if ((mode == 'attach') && (!this.cursorSpring)) {

         // Local selection point on puck.
         if (dC.comSelection.checked) {
            var selectionPoint_l_2d_m = new Vec2D(0.0,0.0);
         } else {
            var selectionPoint_l_2d_m = this.selectionPoint_l_2d_m;
         }
         // Always use a normal spring for the cursor ('softContraints':false). I have played around with using the distance joints but they
         // seem to have similar instability problems with small masses and strong springs.
         this.cursorSpring = new Spring(this.pin, this.selectedBody, Object.assign({}, Client.mouse_springs[this.button],
            {'spo2_ap_l_2d_m':selectionPoint_l_2d_m, 'color':this.color, 'forCursor':true, 'softContraints':false, 'name':this.name}));

      } else if ((mode == 'dettach') && (this.cursorSpring)) {
         this.cursorSpring.deleteThisOne({});
         this.cursorSpring = null;
      }
   }
   Client.prototype.moveSBtoPosition = function(theBody, pos_2d_m) {
      theBody.position_2d_m = pos_2d_m;
      theBody.position_2d_px = screenFromWorld( theBody.position_2d_m);
      theBody.b2d.SetPosition( pos_2d_m);
      // If it's a puck, freeze it, for more predictable put-it-here behavior.
      if (theBody.constructor.name == "Puck") {
         theBody.velocity_2d_mps = new Vec2D(0.0,0.0);
         theBody.b2d.SetLinearVelocity( new Vec2D(0.0,0.0));
         theBody.angularSpeed_rps = 0.0;
         theBody.b2d.SetAngularVelocity( theBody.angularSpeed_rps);
      }
   }
   Client.prototype.moveToCursorPosition = function() {
      // For manipulating kinematic objects (walls and pins)
      if (dC.comSelection.checked) {
         // If COM selection, simply position the object (its center) at the mouse position.
         var newPosition_2d_m = this.mouse_2d_m;
      } else {
         // If not COM selection, calculate the world (w) delta between the current mouse position and the original selection point.
         // This delta is especially useful for positioning (dragging) a kinematic body (like a wall) so that it's selection point
         // follows the moving mouse location.
         var delta_w_2d_m = this.mouse_2d_m.subtract( this.selectionPoint_w_2d_m);
         // Adding the delta to the body position, moves the body so that the original selection point is at the mouse position.
         var newPosition_2d_m = this.selectedBody.position_2d_m.add( delta_w_2d_m);
      }
      // Before actually moving it, keep track of the calculated amount of movement.
      var movement_2d_m = newPosition_2d_m.subtract( this.selectedBody.position_2d_m);

      // Move the single selected body (SB) to the mouse position.
      this.moveSBtoPosition( this.selectedBody, newPosition_2d_m);

      // If control key is down, move all the other selected bodies by a similar amount.
      if (this.key_ctrl == "D") {
         // Note: the arrow function, used here, will take "this" from the surrounding context.
         hostMSelect.applyToAll( tableObj => {
            if (tableObj !== this.selectedBody) this.moveSBtoPosition( tableObj, tableObj.position_2d_m.add( movement_2d_m));
         });

         // If just one object selected (nothing in multi-select), output its position and elasticity characteristics (if a puck);
         if (hostMSelect.count() == 0) {
            var objReport = this.selectedBody.name + " @ x:" + this.selectedBody.position_2d_m.x.toFixed(2) + ", " + "y:" + this.selectedBody.position_2d_m.y.toFixed(2);
            if (this.selectedBody.constructor.name == "Puck") {
               objReport += "\\  restitution = " + this.selectedBody.restitution.toFixed(3) +
                            "\\  surface friction = " + this.selectedBody.friction.toFixed(3) +
                            "\\  translational drag = " + this.selectedBody.linDamp.toFixed(3) +
                            "\\  rotational drag = " + this.selectedBody.angDamp.toFixed(3);
            }
            helpMessage.newMessage(objReport, 0.05);
         }
      }
   }
   Client.prototype.rotateSB = function(theBody, delta_angle_r) {
      if (theBody.constructor.name == "Puck") {
         theBody.velocity_2d_mps = new Vec2D(0.0,0.0);
         theBody.b2d.SetLinearVelocity( new Vec2D(0.0,0.0));
         theBody.angularSpeed_rps = 0.0;
         theBody.b2d.SetAngularVelocity( theBody.angularSpeed_rps);
      }
      // Everything but pins... If you don't exclude pins here, they become un-selectable after
      // a rotation with the editor.
      if (theBody.constructor.name != "Pin") {
         theBody.angle_r += delta_angle_r;
         theBody.b2d.SetAngle( theBody.angle_r);
      }
   }
   Client.prototype.rotateToCursorPosition = function() {
      var delta_r;

      // Rotate about the center of the group.
      if (hostMSelect.count() > 1) {
         // Find the center only at the beginning of the rotation action.
         if (hostMSelect.findCenterEnabled) {
            hostMSelect.findCenter();
            // Don't do this again until one of the keys is released.
            hostMSelect.findCenterEnabled = false;
         }
         // Measure the rotation relative to the center of the group.
         delta_r = hostMSelect.center_2d_m.angleBetween_r(this.selectionPoint_w_2d_m, this.mouse_2d_m);

         hostMSelect.applyToAll( tableObj => {
            // Rotate the vector that runs from the hostMSelect center out to the object center.
            var center_to_center_2d = tableObj.position_2d_m.subtract( hostMSelect.center_2d_m);
            center_to_center_2d.rotated_by( delta_r * 180.0/ Math.PI );

            // Then reassemble the object vector and put the object there.
            this.moveSBtoPosition( tableObj, hostMSelect.center_2d_m.add( center_to_center_2d));

            // Rotate the object about its center.
            this.rotateSB( tableObj, delta_r);
         });

      // Rotate about the center of the single object.
      } else {
         // Things get weird if you do single body rotation about the body's center. So avoid that here
         // by insisting that the COM feature is unchecked. If COM-selection is checked, just translate the body.
         if ( ! dC.comSelection.checked) {
            // Find the angle formed by these three points (angle based at the center of this selected body). This is the angle formed
            // as the mouse moves from the old selection point.
            delta_r = this.selectedBody.position_2d_m.angleBetween_r(this.selectionPoint_w_2d_m, this.mouse_2d_m);
            this.rotateSB(this.selectedBody, delta_r);
         } else {
            this.moveToCursorPosition();
         }
      }
   }
   Client.prototype.rotateEachAboutItself = function() {
      var delta_r = this.selectedBody.position_2d_m.angleBetween_r(this.selectionPoint_w_2d_m, this.mouse_2d_m);
      if (hostMSelect.count() > 0) {
         hostMSelect.applyToAll( tableObj => {
            if ( ! dC.comSelection.checked) {
               this.rotateSB(tableObj, delta_r);
            } else {
               this.moveToCursorPosition();
            }
         });
      } else {
         this.rotateSB(this.selectedBody, delta_r);
      }
   }
   Client.prototype.drawCursor = function() {
      // Draw a triangle for the network client's cursor.
      // Before you can draw it, you have to know where it is on the screen.
      this.triangle_2d_px = [];
      var offset_2d_px = new Vec2D(0,1); //tweak the positioning of the cursor.
      for (var i = 0, len = this.triangle_raw_2d_px.length; i < len; i++) {
         // Put it at the mouse position: mouse + triangle-vertex + offset.
         var p_2d_px = this.mouse_2d_px.add(this.triangle_raw_2d_px[i]).add(offset_2d_px);
         // Put it in the triangle array.
         this.triangle_2d_px.push( p_2d_px);
      }

      // Move the client pin (part of the cursor) to that position also.
      this.mouse_2d_m = worldFromScreen( this.mouse_2d_px);

      if (this.pin) this.pin.b2d.SetPosition( Object.assign({}, this.mouse_2d_m));

      if (this.isMouseDown) {
         if ((this.key_shift == "D") || (this.key_alt == "D")) {
            this.pin.draw_MultiSelectPoint();
         } else {
            this.pin.draw( 4);
         }
      }

      var fillColor = (ctx.globalCompositeOperation == 'screen') ? 'white' : this.color;
      drawPolygon( ctx, this.triangle_2d_px, {'borderColor':'white', 'borderWidth_px':1, 'fillColor':fillColor});
   }
   Client.prototype.updateAndDrawSelectionPoint = function() {
      // Calculate (update) the world location of the selection point (for use in force calculations)
      if (dC.comSelection.checked) {
         this.selectionPoint_w_2d_m = this.selectedBody.position_2d_m;
      } else {
         // Convert the local selection-point vector to a world vector.
         this.selectionPoint_w_2d_m = Vec2D_from_b2Vec2( this.selectedBody.b2d.GetWorldPoint( this.selectionPoint_l_2d_m));
      }
      this.selectionPoint_w_2d_px = screenFromWorld( this.selectionPoint_w_2d_m);
      var sP_2d_px = this.selectionPoint_w_2d_px;

      // Draw small selection circle.
      var fillColor = (ctx.globalCompositeOperation == 'screen') ? this.selectedBody.color : this.color;
      drawCircle( ctx, sP_2d_px, {'borderColor':'white', 'borderWidth_px':2, 'fillColor':fillColor, 'radius_px':6});
   }
   Client.prototype.AimToLead = function() {
      // Point gun along the ray-cast line and lead for target movement.
      if (this.puck.gun.rayBody) {
         // Vector from the shooting NPC to the target
         var NPC_to_TargetPuck_2d_m = this.puck.gun.rayBody.position_2d_m.subtract( this.puck.position_2d_m);
         var parallel_unit_vector = NPC_to_TargetPuck_2d_m.normal();

         // Target's velocity as seen by the shooting NPC (in the NPC reference frame).
         var target_inNPCrf_2d_mps = this.puck.gun.rayBody.velocity_2d_mps.subtract( this.puck.velocity_2d_mps);

         // Component of the target's velocity along (parallel to) the line between the shooting NPC and the target.
         var target_parallel_2d_mps = target_inNPCrf_2d_mps.projection_onto( parallel_unit_vector);

         if (target_parallel_2d_mps) {
            // Component of target's relative (to shooter) velocity that is perpendicular to the line between the shooting NPC and the target
            var target_perpendicular_2d_mps = target_inNPCrf_2d_mps.subtract( target_parallel_2d_mps);
            var perpendicular_unit_vector = target_perpendicular_2d_mps.normal();
            /*
            This next line of code is the clever part. Find the angle, at which the
            bullet needs to fire, such that its perpendicular component matches the
            perpendicular component of the target. Then, in cases where the parallel
            component of the bullet is larger than that of the target, the bullet
            will overtake and hit the target. These words can be represented with a
            right triangle where the bullet speed is the hypotenuse and the target's
            perpendicular speed is one of the legs. Use Pythagorean equation to find
            the parallel component of the bullet velocity vector (the third leg of
            the triangle). This defines the orientation of the bullet vector.
            */
            var bullet_parallelSpeed_mps = Math.sqrt( Math.pow( this.puck.gun.bulletSpeed_mps, 2) - Math.pow( target_perpendicular_2d_mps.length(), 2));
            // The bullet vector (relative to the shooting NPC) needed to intercept the target.
            var bullet_2d_mps = target_perpendicular_2d_mps.add( parallel_unit_vector.scaleBy( bullet_parallelSpeed_mps));
            var bullet_angle_deg = bullet_2d_mps.get_angle();

            if (bullet_angle_deg) {
               if (this.puck.gun.rayBody.linDamp > 0.0) {
                  // If the body has some linear damping drag, simply (easiest to) take the average of the leading angle
                  // and the line-of-sight angle. Otherwise, the leading aim will overshoot the target as it slows
                  // down under drag forces.
                  var gun_angle_deg = (bullet_angle_deg + this.puck.gun.angleToFoundPuck)/2.0
               } else {
                  var gun_angle_deg = bullet_angle_deg;
               }
               this.puck.gun.setTubeAngle(gun_angle_deg);
            }
         }
      } else {
         this.puck.gun.setTubeAngle( this.puck.gun.angleToFoundPuck);
      }
   }
   Client.prototype.thinkForNPC = function() {

      // If a hit is detected, turn the shield on for a while.
      if ((this.puck.inComing) && (this.NPC_shield_timer_s < this.NPC_shield_timer_limit_s)) {
         this.key_space = "D";
         this.NPC_shield_timer_s += c.deltaT_s;
      } else {
         this.key_space = "U";
         this.NPC_shield_timer_s = 0.0;
         this.puck.inComing = false;
      }

      // If found a target.
      if (!this.puck.gun.scanning) {
         // Note that thinkForNPC runs every frame, so this aiming adjustment continuously updates
         // during a bullet-firing sequence, adjusting the aim for each bullet that fires. This will
         // give a curved look to the bullet group unless both shooter and target have the same velocity.
         // The gun tube updates its orientation even when not shooting.
         this.AimToLead();
         if (this.NPC_guncooling_timer_s < this.NPC_guncooling_timer_limit_s) {
            // Keep shooting
            this.key_i = "D";
            this.NPC_guncooling_timer_s += c.deltaT_s;
         } else {
            // Release the i key.
            this.key_i = "U";
            this.NPC_guncooling_timer_s = 0.0;
         }
      } else {
         this.key_i = "U";
      }

      // This flag forces a needed update to navSpringOnly_force_2d_N before drawing
      // the jet along the direction of the spring force.
      this.NPC_skipFrame = false;

      // Move NPC to the next pin
      if (this.NPC_pin_timer_s < this.NPC_pin_timer_limit_s) {
         this.NPC_pin_timer_s += c.deltaT_s;
      } else {
         // First aim the jet gradually toward the next pin.
         if (this.NPC_aimStepCount < this.NPC_aimStepCount_limit) {
            this.puck.stepTheJetAngle();
            this.NPC_aimStepCount += 1;
         } else {
            this.puck.attachNavSpringToNextPin();
            this.NPC_aimStepCount = 0;
            this.NPC_pin_timer_s = 0.0;
            this.NPC_skipFrame = true;
         }
      }

      // Aim the jet in the direction opposite to the spring force.
      if (this.NPC_aimStepCount == 0 && !this.NPC_skipFrame) {
         this.puck.jet.rotateTubeAndScaleJetToThis( this.puck.navSpringOnly_force_2d_N.scaleBy(-1));
      }
   }


   // For use in sound field, demo #2.
   function PuckTail( pars) {
      this.firstPoint_2d_m = setDefault( pars.firstPoint_2d_m, new Vec2D(1.0, 1.0));
      this.initial_radius_m = setDefault( pars.initial_radius_m, 1.0);

      /*
      this.emitFrequency_hz = setDefault( pars.emitFrequency_hz, 60); //60 c.frameRate
      this.emitInterval_s = 1.0/this.emitFrequency_hz;
      this.emitTimer_s = 0.0;
      */

      this.propSpeed_mps = setDefault( pars.propSpeed_mps, 3.0);
      this.length_limit = setDefault( pars.length_limit, 25);
      this.color = setDefault( pars.color, 'lightgrey');

      // The wait (time in seconds) before making a pure white color ping.
      this.markerPingTimerLimit_s = setDefault( pars.markerPingTimerLimit_s, 1.0);
      this.markerPingTimer_s = 0.0;

      this.values = [];

      this.update( this.firstPoint_2d_m);
   }
   PuckTail.prototype.update = function( newPoint_2d_m) {

      // Mark one ring specially so to see ring propagation better.
      this.markerPingTimer_s += c.deltaT_s;
      if (this.markerPingTimer_s < this.markerPingTimerLimit_s) {
         this.pingColor = this.color;
      } else {
         this.pingColor = 'white';
         this.markerPingTimer_s = 0.0;
      }

      /*
      This commented block is here as a reminder that an adjustable emit frequency doesn't render
      well. Can play with this to be convinced. Best to emit once per frame as is done in the single
      line that follows. Also commented out the corresponding three attribute lines (above) in the
      constructor for this.

      // Ping out a new ring (at the rate of the emit frequency). Each value is a position vector and radius.
      this.emitTimer_s += c.deltaT_s;
      if (this.emitTimer_s >= this.emitInterval_s) {
         this.values.push({'p_2d_px':screenFromWorld( newPoint_2d_m), 'r_px':px_from_meters(this.initial_radius_m), 'color':this.pingColor});
         this.emitTimer_s = 0.0;
      }
      */
      // Ping out a new ring (once per frame). Each value is a position vector and radius.
      this.values.push({'p_2d_px':screenFromWorld( newPoint_2d_m), 'r_px':px_from_meters(this.initial_radius_m), 'color':this.pingColor});

      // Remove the oldest value if needed.
      if (this.values.length > this.length_limit) {
         this.values.shift();
      }

      // Loop through the tail.
      for (var t = 0, len = this.values.length; t < len; t++) {

         // Expand the radius of the ping (like a sound wave propagating). Note: doing this addition in pixels (not meters)
         // to yield a more consistent and pleasing rendering.
         this.values[t].r_px += px_from_meters( this.propSpeed_mps * c.deltaT_s);
         //this.values[t].r_px += 5;

         // Draw the sound circle (make the 'white' marker ring even more visible, using green, if single stepping).
         var lineColor = (c.singleStep && (this.values[t].color == 'white')) ? 'red' : this.values[t].color;  //#008080 cyan yellow magenta orange
         drawCircle( ctx, this.values[t].p_2d_px, {'radius_px':this.values[t].r_px, 'borderColor':lineColor, 'borderWidth_px':2, 'fillColor':'noFill'});
      }
   }



   function Puck( position_2d_m, velocity_2d_mps, pars) {
      this.parsAtBirth = pars;
      //this.alsoThese = [];

      this.bullet = setDefault( pars.bullet, false);
      // If a bullet puck never hits another puck, this stays false.
      this.atLeastOneHit = false;

      this.jello = setDefault( pars.jello, false);

      this.clientName = setDefault( pars.clientName, null);
      if (this.clientName) {
         // Don't allow a client puck if there is not already a client. Client first, then puck.
         // Throwing an error forces an exit from this constructor.
         if (!(clients[this.clientName])) {
            var errorObj = new Error('Constructor declines to create a puck for a non-existent client.');
            errorObj.name = 'from Puck constructor';
            throw errorObj;
         }
         Puck.playerCount += 1;
         if (this.clientName.includes('NPC')) Puck.npcCount += 1;
      }
      if (pars.name) {
         this.name = pars.name;
         Puck.nameIndex = Math.max(Puck.nameIndex, Number(this.name.slice(4)));
      } else {
         Puck.nameIndex += 1;
         this.name = 'puck' + Puck.nameIndex;
      }
      //console.log("n-puck = " + Puck.nameIndex);
      aT.puckMap[this.name] = this;

      // Position of Center of Mass (COM)
      this.position_2d_m = Vec2D_check( position_2d_m);
      // Position (in pixels).
      this.position_2d_px = screenFromWorld( this.position_2d_m);

      // Velocity of COM
      this.velocity_2d_mps = Vec2D_check( velocity_2d_mps);

      // Parse out the parameters in the pars object. The values on the right
      // are the defaults (used if pars value is undefined).
      this.color = setDefault( pars.color, "DarkSlateGray");
      this.shape = setDefault( pars.shape, "circle");
      this.colorSource = setDefault( pars.colorSource, false);
      this.density = setDefault( pars.density, 1.5);
      // Linear damping is like a drag force from translational movement through a surrounding fluid.
      // Note that springs have the attribute drag_c, with an effect similar to linDamp.
      this.linDamp = setDefault( pars.linDamp, 0.0);
      // Rotational drag
      this.angDamp = setDefault( pars.angDamp, 0.0);
      this.hitLimit = setDefault( pars.hitLimit, 10);
      // This is used if the puck is a bullet. It identifies the owner of this bullet
      // (so you can't shoot yourself in the foot).
      this.clientNameOfShooter = setDefault( pars.clientNameOfShooter, null);
      this.ageLimit_ms = setDefault( pars.ageLimit_ms, null);

      this.createTail = setDefault( pars.createTail, false);
      this.tailPars = setDefault( pars.tailPars, null);
      this.tail = null;

      // www.iforce2d.net/b2dtut/collision-filtering
      // For client pucks, assign a negative group index that is based on the puck's name
      // This group index can be used to prevent collisions with bullets (having the same negative group index)
      // coming from a gun hosted by this puck.
      if (this.clientName) {
         this.groupIndex = -this.name.slice(4)-1000;
      } else {
         this.groupIndex = setDefault( pars.groupIndex, 0);
      }
      // The following are defaults for Box2D.
      this.categoryBits = setDefault( pars.categoryBits, 0x0001);
      this.maskBits = setDefault( pars.maskBits, 0xFFFF);

      // Rotational state
      this.angle_r = setDefault( pars.angle_r, 0);
      this.angularSpeed_rps = setDefault( pars.angularSpeed_rps, 0);
      this.angleLine = setDefault( pars.angleLine, true);

      this.borderWidth_px = setDefault( pars.borderWidth_px, 3);

      // Put a reference to this puck in the client.
      if (this.clientName) {
         clients[this.clientName].puck = this;
      }

      this.age_ms = 0;
      //this.createTime = window.performance.now();

      // Note that a call to setGravityRelatedParameters() may override the restitution and friction settings
      // in what follows unless they have been "fixed" (set to be constant).

      // Restitution (elasticity) of the object in collisions
      if (typeof pars.restitution === 'undefined') {
         if (c.g_ON) {
            this.restitution = c.restitution_gOn;
         } else {
            this.restitution = c.restitution_gOff;
         }
      } else {
         this.restitution = pars.restitution;
      }
      // Option to fix restitution to be independent of the g toggle.
      this.restitution_fixed = setDefault( pars.restitution_fixed, false);

      // Friction (tangential tackiness) of the object in collisions
      if (typeof pars.friction === 'undefined') {
         if (c.g_ON) {
            this.friction = c.friction_gOn;
         } else {
            this.friction = c.friction_gOff;
         }
      } else {
         this.friction = pars.friction;
      }
      // Option to fix friction to be independent of the g toggle.
      this.friction_fixed = setDefault( pars.friction_fixed, false);

      // Dimensions
      this.radius_m = setDefault( pars.radius_m, 1.0);
      this.aspectR = setDefault( pars.aspectR, 1.0);
      this.half_height_m = setDefault( pars.half_height_m, null);
      this.half_width_m = setDefault( pars.half_width_m, null);

      if (this.shape == 'circle') {
         this.radius_px = px_from_meters( this.radius_m);

      // Rectangular
      } else {
         // Height and width given explicitly.
         if (this.half_height_m) {
            this.half_width_px = px_from_meters( this.half_width_m);
            this.half_height_px = px_from_meters( this.half_height_m);

         // Aspect ratio given.
         } else {
            this.half_width_m = this.radius_m * this.aspectR;
            this.half_width_px = px_from_meters( this.half_width_m);

            this.half_height_m = this.radius_m;
            this.half_height_px = px_from_meters( this.half_height_m);
         }
      }

      // Tail
      if (this.createTail) {
         var tailPars = {'firstPoint_2d_m':this.position_2d_m, 'initial_radius_m':this.radius_m};
         // Add any specified characteristics to the tail parameters.
         if (this.tailPars) {
            tailPars = Object.assign({}, tailPars, this.tailPars);
         } else {
            // Add these defaults (for a tail) to the puck attributes. Then these
            // can be edited after capturing.
            this.tailPars = {'propSpeed_mps':3.0, 'length_limit':25};
         }
         this.tail = new PuckTail( tailPars);
      }

      this.b2d = null;
      this.create_Box2d_Puck();
      // Create a reference back to this puck from the b2d puck.
      // Note that a Map allows any type of object for the key!
      tableMap.set(this.b2d, this);

      this.cursorString_spring_force_2d_N = new Vec2D(0.0,0.0);
      this.cursorString_puckDrag_force_2d_N = new Vec2D(0.0,0.0);
      this.nonCOM_2d_N = [];

      this.sprDamp_force_2d_N = new Vec2D(0.0,0.0);
      // This vector is needed for aiming the NPC's navigation jets.
      this.navSpringOnly_force_2d_N = new Vec2D(0.0,0.0);
      this.jet_force_2d_N = new Vec2D(0.0,0.0);
      this.impulse_2d_Ns = new Vec2D(0.0,0.0);

      // Puck-popper features
      this.gun = null, this.jet = null;
      this.rayCastLineLength_m = setDefault( pars.rayCastLineLength_m, 3.5);
      this.rayCast_init_deg = setDefault( pars.rayCast_init_deg, 0);
      this.rayRotationRate_dps = setDefault( pars.rayRotationRate_dps, 80);
      // Disables and hides the jet
      this.disableJet = setDefault( pars.disableJet, false);
      this.noRecoil = setDefault( pars.noRecoil, false);
      this.bullet_restitution = setDefault( pars.bullet_restitution, 0.92);
      this.bulletAgeLimit_ms = setDefault( pars.bulletAgeLimit_ms, c.bulletAgeLimit_ms);
      if (this.clientName) {
         // Add client controls and give each control a reference to this puck.
         this.jet = new Jet(this, {'initial_angle':-20});
         this.gun = new Gun(this, {'initial_angle':200, 'indicator':true, 'tube_color':'gray',
             'rayCast_init_deg':this.rayCast_init_deg, 'rayRotationRate_dps':this.rayRotationRate_dps, 'rayCastLineLength_m':this.rayCastLineLength_m});
      }
      this.shield = new Shield(this, {'color':'yellow'});

      this.hitCount =  0;
      this.poorHealthFraction = 0;
      // Keep track of the owner of the last bullet that hit.
      this.whoShotBullet = null;
      this.flash = false;
      this.inComing = false;
      this.flashCount = 0;

      // Navigation spring (not generally the name of any attached spring). There can be only
      // one navigation spring.
      if (this.clientName && this.clientName.includes('NPC')) {
         this.navSpringName = null;
         this.pinName = setDefault( pars.pinName, null);
         // If there's named pin and it still exists...
         if (this.pinName && (aT.pinMap[ this.pinName])) {
            this.disableJet = false;
            this.attachNavSpring();
         } else {
            this.disableJet = true;
         }
      }

      // Local selection point where candidate springs are to be attached.
      this.selectionPoint_l_2d_m = new Vec2D(0,0);

      this.deleted = false;
   }
   Puck.nameIndex = 0;
   Puck.playerCount = 0;
   Puck.npcCount = 0;
   Puck.applyToAll = function ( doThis) {
      for (var puckName in aT.puckMap) {
         var puck = aT.puckMap[ puckName];
         doThis( puck);
      }
   }
   Puck.deleteAll = function() {
      Client.applyToAll( client => client.puck = null);
      Puck.applyToAll( puck => {
         tableMap.delete( puck.b2d);
         if (puck.b2d) world.DestroyBody( puck.b2d);
      });
      aT.jelloPucks = [];
      aT.puckMap = {};
      Puck.nameIndex = 0;
      Puck.playerCount = 0;
      Puck.npcCount = 0;
   }
   Puck.prototype.attachNavSpring = function() {
      var navSpringName = "s" + (100 + Puck.nameIndex);
      // Note that instantiation adds the new spring to the spring map.
      var temp = new Spring(this, aT.pinMap[this.pinName], {strength_Npm:8.0, unstretched_width_m:0.1, color:'brown', damper_Ns2pm2:5.0, navigationForNPC:true, 'name':navSpringName});
      this.navSpringName = temp.name;
   }
   Puck.prototype.stepTheJetAngle = function() {
      var spring = aT.springMap[this.navSpringName];
      // If this spring still exists.
      if (spring) {
         // Use the end of the spring that's attached to the pin.
         if (spring.spo1.nextPinName) {
            var nextPinName = spring.spo1.nextPinName;
         } else {
            var nextPinName = spring.spo2.nextPinName;
         }
         // Gradually rotate jet to be in the direction of the next pin.
         // Vector between this puck and the next pin.
         var toNextPin_2d_m = this.position_2d_m.subtract( aT.pinMap[ nextPinName].position_2d_m);
         var angleOfNextPin_deg = toNextPin_2d_m.get_angle();
         var angleOfJet_deg = this.jet.rel_position_2d_m.get_angle();
         var changeNeeded_deg = angleOfNextPin_deg - angleOfJet_deg;

         // Take the short way around.
         if (changeNeeded_deg >  180.0) changeNeeded_deg = changeNeeded_deg - 360;
         if (changeNeeded_deg < -180.0) changeNeeded_deg = changeNeeded_deg + 360;

         // Rotate by a percentage in this single step. This will yield a gradual sweep-to-target effect.
         this.jet.rotateTubeAndJet( 0.15 * changeNeeded_deg);
      }
   }
   Puck.prototype.attachNavSpringToNextPin = function() {
      var spring = aT.springMap[this.navSpringName];
      // If this spring still exists.
      if (spring) {
         // Use the end of the spring that's attached to the pin.
         if (spring.spo1.nextPinName) {
            var nextPinName = spring.spo1.nextPinName;
         } else {
            var nextPinName = spring.spo2.nextPinName;
         }

         // If there's a pin in the map by that name, attach to it.
         if (aT.pinMap[ nextPinName]) {
            // Move the end of the spring that's attached to the pin.
            if (aT.springMap[this.navSpringName].spo1.constructor.name == "Pin")
               aT.springMap[this.navSpringName].spo1 = aT.pinMap[ nextPinName];
            else {
               aT.springMap[this.navSpringName].spo2 = aT.pinMap[ nextPinName];
            }
            this.pinName = nextPinName;
         }
      } else {
         //console.log('no spring to use.');
      }
   }
   Puck.prototype.deleteThisOne = function( pars) {
      var deleteMode = setDefault( pars.deleteMode, 'fromBullet');

      // Add this player's score to the summary.
      if (this.clientName) clients[this.clientName].addScoreToSummary('');

      // But first, give credit to the owner of the bullet that last hit you.
      // Ignore old bullets that are being removed. Don't give any credit for
      // deletion by the editor. Make sure the client is still there before
      // changing its score.
      if ((! this.bullet) && (deleteMode != 'fromEditor')) {
         if ((!Client.winnerBonusGiven) && (clients[this.whoShotBullet])) {
            // Give 100 for client and drone pucks, 50 for regular pucks.
            if (this.clientName) {
               clients[this.whoShotBullet].score += 100;
            } else {
               clients[this.whoShotBullet].score += 50;
            }
         }
      }

      // JavaScript uses garbage collection. Deleting a puck involves
      // mainly nullifying all references to the puck. (Also removing references
      // from the puck.)

      // Note that springs are checked, in the updateAirTable function, to
      // see if either of the two objects it is attached to has been deleted.
      // If so, the spring is deleted. So that's not needed here.

      this.deleted = true;
      this.jet = null;
      this.gun = null;
      this.shield = null;

      // Sound effect
      if (! this.bullet) popSounds.play('high');

      // For pucks that are driven by clients (users or NPC)
      if (this.clientName) {
         if (this.clientName == 'local') {
            // Must keep the local client. Just null out the puck reference in the local client.
            clients[this.clientName].puck = null;
         } else {
            // Recently decided to turn off (for now) the client disconnect when the client puck gets
            // destroyed in a game of Puck Popper. So the following line is commented and then added
            // the next line where the puck on the client is nulled.
            //deleteRTC_onClientAndHost( this.clientName);
            clients[this.clientName].puck = null;

            // Remove the client if it's an NPC.
            if (this.clientName.slice(0,3) == 'NPC') {
               delete clients[ this.clientName];
               Puck.npcCount -= 1;
            }
         }
         Puck.playerCount -= 1;
      }

      // Delete the corresponding Box2d object.
      tableMap.delete( this.b2d);
      world.DestroyBody( this.b2d);

      // Remove this puck from our puck map.
      delete aT.puckMap[ this.name];
      // ...and from the multi-select map.
      hostMSelect.removeOne( this);

      // Filter out this puck from the jelloPuck array.
      if (this.jello) {
         aT.jelloPucks = aT.jelloPucks.filter( function( eachPuck) {
            // Keep these (those NOT deleted)
            return (!eachPuck.deleted == true);
         });
      }
   }
   Puck.prototype.copyThisOne = function( pars) {
      // If the position is not specified in pars, put the copy at the same position as the original.
      var position_2d_m = setDefault( pars.position_2d_m, this.position_2d_m);

      // Make a copy of the mutable objects that are passed into the Puck constructor.
      var p_2d_m =          Object.assign({}, position_2d_m);
      var v_2d_mps =        Object.assign({}, this.velocity_2d_mps);
      var parsForNewBirth = Object.assign({}, this.parsAtBirth);

      // Make sure the name is nulled so the auto-naming feature is used in the constructor.
      parsForNewBirth.name = null;
      // Don't allow any network client or NPC features.
      parsForNewBirth.clientName = null;
      parsForNewBirth.pinName = null;

      /*
      Update pars to reflect any edits or state changes. For example,
      this loop, for the first element in the array, does the following:
      parsForNewBirth.angle_r = this.angle_r;
      */
      var parsToCopy = ['angle_r','angularSpeed_rps','friction','restitution','linDamp','angDamp','bullet_restitution','jello'];
      for (var i = 0, len = parsToCopy.length; i < len; i++) {
         parsForNewBirth[ parsToCopy[i]] = this[ parsToCopy[i]];
      }

      if (this.shape == 'circle') {
         parsForNewBirth.radius_m = this.radius_m;
      } else {
         parsForNewBirth.half_height_m = this.half_height_m;
         parsForNewBirth.half_width_m = this.half_width_m;
      }

      // If this is a drone puck, make a new NPC client for the copy.
      if (this.clientName && (this.clientName.slice(0,3) == 'NPC')) {
         // Sync the navigation timer of the copy to that of the original.
         // Note: instantiating with the current NPC name will increment the NPC counter (and the name).
         var theClientForTheCopy = new Client({'name':this.clientName, 'color':'purple',
                                               'NPC_pin_timer_s':clients[this.clientName].NPC_pin_timer_s,
                                               'NPC_pin_timer_limit_s':clients[this.clientName].NPC_pin_timer_limit_s});
         // Add the client name to the birth parameters for the puck.
         parsForNewBirth.clientName = theClientForTheCopy.name;
      }

      var newPuck = new Puck( p_2d_m, v_2d_mps, parsForNewBirth);
      if (newPuck.jello) aT.jelloPucks.push( newPuck);

      return newPuck;
   }
   Puck.prototype.updateState = function() {
      this.getPosition();
      this.getVelocity();

      this.getAngle();
      this.getAngularSpeed();
   }
   Puck.prototype.create_Box2d_Puck = function() {
      var bodyDef = new b2BodyDef;
      bodyDef.type = b2Body.b2_dynamicBody;

      // Make it be.
      this.b2d = world.CreateBody(bodyDef);
      this.b2d.CreateFixture( this.define_fixture( {}) );

      // Set the state: position and velocity (angle and angular speed).
      this.b2d.SetPosition( this.position_2d_m);
      this.b2d.SetLinearVelocity( this.velocity_2d_mps);
      this.b2d.SetAngle( this.angle_r);
      this.b2d.SetAngularVelocity( this.angularSpeed_rps);

      // Use the mass calculated by box2d.
      this.mass_kg = this.b2d.GetMass();

      this.b2d.SetLinearDamping( this.linDamp);
      this.b2d.SetAngularDamping( this.angDamp);
      this.b2d.SetBullet( this.bullet);
   }
   Puck.prototype.define_fixture = function( pars) {
      this.width_scaling = setDefault( pars.width_scaling, 1.0);
      this.height_scaling = setDefault( pars.height_scaling, 1.0);
      this.radius_scaling = setDefault( pars.radius_scaling, 1.0);
      this.restitution_scaling = setDefault( pars.restitution_scaling, 1.0);
      this.friction_scaling = setDefault( pars.friction_scaling, 1.0);
      this.linDamp_scaling = setDefault( pars.linDamp_scaling, 1.0);

      // Create a circular or rectangular dynamic box2d object.

      var fixDef = new b2FixtureDef;
      fixDef.density = this.density;

      // Adjust elasticity (bounciness).
      if (this.restitution_scaling != 1.0) {
         // If restitution is zero, bump it up a little so the scaling factor has something to work with.
         if (this.restitution == 0.0) this.restitution = 0.01;
         // Apply the scaling factor.
         this.restitution *= this.restitution_scaling;
         // Keep it between 0.0 and 1.0.
         if (this.restitution > 1.00) this.restitution = 1.0;
         if (this.restitution < 0.01) this.restitution = 0.0;

         // Keep this new restitution value independent of the gravity toggle.
         this.restitution_fixed = true;

         helpMessage.newMessage("puck restitution = " + this.restitution.toFixed(4), 0.5);
      }
      fixDef.restitution = this.restitution;

      // Adjust friction (surface tackiness).
      if (this.friction_scaling != 1.0) {
         // If friction is zero, bump it up a little so the scaling factor has something to work with.
         if (this.friction == 0.0) this.friction = 0.01;
         // Apply the scaling factor.
         this.friction *= this.friction_scaling;
         // Stop at zero.
         if (this.friction < 0.01) this.friction = 0.0;

         // Keep this new friction value independent of the gravity toggle.
         this.friction_fixed = true;

         helpMessage.newMessage("puck friction = " + this.friction.toFixed(4), 0.5);
      }
      fixDef.friction = this.friction;

      // Adjust linear damping (damping from fluid drag).
      if (this.linDamp_scaling != 1.0) {
         // If linear damping is zero, bump it up a little so the scaling factor has something to work with.
         if (this.linDamp == 0.0) this.linDamp = 0.01;
         // Apply the scaling factor.
         this.linDamp *= this.linDamp_scaling;
         // Stop at zero.
         if (this.linDamp < 0.01) this.linDamp = 0.0;
         helpMessage.newMessage("puck drag coefficient = " + this.linDamp.toFixed(4), 0.5);
      }
      // Note: linearDamping is a body property (not fixture property)
      this.b2d.SetLinearDamping( this.linDamp);

      fixDef.filter.groupIndex = this.groupIndex;
      fixDef.filter.categoryBits = this.categoryBits;
      fixDef.filter.maskBits = this.maskBits;

      if (this.shape == 'circle') {
         // Apply the radius scaling factor.
         this.radius_m *= this.radius_scaling;
         this.radius_px = px_from_meters( this.radius_m);

         // Don't let it get too small.
         if ((this.radius_px < 9) && (!this.bullet)) {
            this.radius_px = 9;
            this.radius_m = meters_from_px( this.radius_px);
         }

         // Don't let client pucks get so big that their bullets can collide with the body of their ship.
         if (this.clientName) {
            if (this.radius_m > this.parsAtBirth.radius_m) {
               this.radius_m = this.parsAtBirth.radius_m;
               this.radius_px = px_from_meters( this.radius_m);
            }
         }

         fixDef.shape = new b2CircleShape( this.radius_m);

      // Rectangular shapes
      } else {
         // Apply the scaling factors to the current width and height.
         this.half_width_m *= this.width_scaling;
         this.half_height_m *= this.height_scaling;

         this.half_width_px = px_from_meters( this.half_width_m);
         // Don't let it get too skinny because it becomes hard to select.
         if (this.half_width_px < 3) {
            this.half_width_px = 3;
            this.half_width_m = meters_from_px( this.half_width_px);
         }

         this.half_height_px = px_from_meters( this.half_height_m);
         if (this.half_height_px < 3) {
            this.half_height_px = 3;
            this.half_height_m = meters_from_px( this.half_height_px);
         }

         fixDef.shape = new b2PolygonShape;
         fixDef.shape.SetAsBox(this.half_width_m, this.half_height_m);
      }

      return fixDef;
   }
   Puck.prototype.modify_fixture = function( mode) {
      // For shape editing...

      // If you are going to modify the fixture dimensions you have to delete
      // the old one and make a new one. The m_fixtureList linked list always
      // points to the most recent addition to the linked list. If there's only
      // one fixture, then m_fixtureList is a reference to that single fixture.

      var width_factor = 1.0;
      var height_factor = 1.0;
      var restitution_factor = 1.0;
      var friction_factor = 1.0;
      var drag_factor = 1.0;

      if (mode == 'wider') {
         width_factor = 1.1;
      } else if (mode == 'thinner') {
         width_factor = 0.9;

      } else if (mode == 'taller') {
         height_factor = 1.1;
      } else if (mode == 'shorter') {
         height_factor = 0.9;

      } else if (mode == 'moreDamping') {
         restitution_factor = 0.95;
      } else if (mode == 'lessDamping') {
         restitution_factor = 1.05;

      } else if (mode == 'moreFriction') {
         friction_factor = 1.05;
      } else if (mode == 'lessFriction') {
         friction_factor = 0.95;

      } else if (mode == 'moreDrag') {
         drag_factor = 1.05;
      } else if (mode == 'lessDrag') {
         drag_factor = 0.95;

      } else if (mode == 'noChange') {
         // don't change anything.
      }

      this.b2d.DestroyFixture( this.b2d.m_fixtureList);
      if (this.shape == 'circle') {
         // Use either left/right or up/down to change the circle radius.
         if (width_factor == 1.0) width_factor = height_factor;
         this.b2d.CreateFixture( this.define_fixture({'radius_scaling':width_factor,                                'restitution_scaling':restitution_factor,
                                                      'friction_scaling':friction_factor, 'linDamp_scaling':drag_factor}));
      } else {
         this.b2d.CreateFixture( this.define_fixture({'width_scaling':width_factor, 'height_scaling':height_factor, 'restitution_scaling':restitution_factor,
                                                      'friction_scaling':friction_factor, 'linDamp_scaling':drag_factor}));
      }

      // Update the mass.
      this.mass_kg = this.b2d.GetMass();
      if ((height_factor != 1.0) || (width_factor != 1.0)) {
         helpMessage.newMessage('puck mass = ' + this.mass_kg.toFixed(3) + ' kg', 1.0);
      }

      // If there's a spring that has one (or both) of its ends attached to THIS puck,
      // and it's a b2d spring, update that spring.
      Spring.applyToAll( spring => {
         if (((this == spring.spo1) || (this == spring.spo2)) && (spring.softContraints)) {
            //console.log('puck=' + this.name + ',' + spring.spo1.name + ',' + spring.spo2.name + ':' + spring.name);
            spring.updateB2D_spring();
         }
      });

      // Update the puck tail
      if (this.tail) {
         this.tail.initial_radius_m = this.radius_m;
      }
   }
   Puck.prototype.getPosition = function() {
      this.position_2d_m = Vec2D_from_b2Vec2( this.b2d.GetPosition());
   }
   Puck.prototype.getVelocity = function() {
      // COM velocity
      this.velocity_2d_mps = Vec2D_from_b2Vec2( this.b2d.GetLinearVelocity());
   }
   Puck.prototype.getAngle = function() {
      // COM angle (radians)
      this.angle_r = this.b2d.GetAngle();
   }
   Puck.prototype.getAngularSpeed = function() {
      // COM angular speed (radians per second)
      this.angularSpeed_rps = this.b2d.GetAngularVelocity();
   }
   Puck.prototype.draw = function() {
      this.position_2d_px = screenFromWorld( this.position_2d_m);
      var borderColor;

      if (this.shape == 'circle') {

         // Draw the main circle.
         // If hit, color the border red for a few frames.
         if (this.flash) {
            borderColor = 'red';
            this.flashCount += 1;
            if (this.flashCount >= 3) {
               this.flash = false;
               this.flashCount = 0;
            }
         } else {
            borderColor = 'white';
         }
         drawCircle( ctx, this.position_2d_px, {'borderColor':borderColor, 'borderWidth_px':this.borderWidth_px, 'fillColor':this.color, 'radius_px':this.radius_px});

         // Draw the health circle.
         this.poorHealthFraction = this.hitCount / this.hitLimit;
         var poorHealthRadius = this.radius_px * this.poorHealthFraction;
         if (poorHealthRadius > 0) {
            drawCircle( ctx, this.position_2d_px, {'borderColor':'black', 'borderWidth_px':1, 'fillColor':'chocolate', 'radius_px':poorHealthRadius});
         }

         // Update and draw the shield.
         if (clients[this.clientName]) {
            this.shield.updateState();
            // Draw the client finder circle. Big fat one. Easy to see. So to find your puck.
            if (clients[this.clientName].key_questionMark == "D") {
               drawCircle( ctx, this.position_2d_px, {'borderColor':clients[this.clientName].color, 'borderWidth_px':10, 'fillColor':'noFill', 'radius_px':this.radius_px+15});
            }
         }

         // Show rotational orientation: draw a line segment along the line from the center out to a local point on the radius.
         if (!this.gun && this.angleLine) {
            var pointOnEdge_2d_px = screenFromWorld( this.b2d.GetWorldPoint( new b2Vec2(0.0, this.radius_m) ) );
            var pointAtHalfRadius_2d_px = screenFromWorld( this.b2d.GetWorldPoint( new b2Vec2(0.0, this.radius_m * (1.0/2.0)) ) );

            drawLine(ctx, pointAtHalfRadius_2d_px, pointOnEdge_2d_px, {'width_px':2, 'color':'white'});
         }

         // Draw the tail if we have one.
         if (this.tail) this.tail.update( this.position_2d_m);

      } else {
         // Draw the rectangle.
         drawPolygon( ctx, b2d_getPolygonVertices( this.b2d), {'borderColor':'white','borderWidth_px':2,'fillColor':this.color});
      }
   }
   Puck.prototype.draw_MultiSelectPoint = function() {
      var selectionPoint_2d_px;
      if (!dC.comSelection.checked) {
         selectionPoint_2d_px = screenFromWorld( this.b2d.GetWorldPoint( this.selectionPoint_l_2d_m));
      } else {
         selectionPoint_2d_px = this.position_2d_px;
      }
      drawCircle( ctx, selectionPoint_2d_px, {'borderColor':'black', 'borderWidth_px':1, 'fillColor':'yellow', 'radius_px':5});
   }
   Puck.prototype.applyForces = function() {
      // Net resulting force on the puck.

      // First consider all forces acting on the COM.

      // F = acc * mass
      var puck_forces_2d_N = g_2d_mps2.scaleBy( this.mass_kg);
          puck_forces_2d_N.addTo( this.cursorString_spring_force_2d_N);
          puck_forces_2d_N.addTo( this.cursorString_puckDrag_force_2d_N);

          puck_forces_2d_N.addTo( this.sprDamp_force_2d_N);
          puck_forces_2d_N.addTo( this.jet_force_2d_N);
          puck_forces_2d_N.addTo( this.impulse_2d_Ns.scaleBy(1.0/c.deltaT_s));


      // Apply this force to the puck's center of mass (COM) in the Box2d world
      this.b2d.ApplyForce( puck_forces_2d_N, this.position_2d_m);


      // Apply any non-COM forces in the array.
      for (var j = 0, len = this.nonCOM_2d_N.length; j < len; j++) {
         //console.log("force.force_2d_N.x = " + nonCOM_2d_N[j].force_2d_N.x);
         this.b2d.ApplyForce( this.nonCOM_2d_N[j].force_2d_N, this.nonCOM_2d_N[j].point_w_2d_m);
      }

      /*
      // Apply torques.   #b2d
      //this.b2d.ApplyTorque( this.cursorString_torque_force_Nm, wake=True)
      */

      // Now reset the aggregate forces.
      this.cursorString_spring_force_2d_N = new Vec2D(0.0,0.0);
      this.cursorString_puckDrag_force_2d_N = new Vec2D(0.0,0.0);
      this.nonCOM_2d_N = [];

      this.sprDamp_force_2d_N = new Vec2D(0.0,0.0);
      this.impulse_2d_Ns = new Vec2D(0.0,0.0);

      /*
      this.cursorString_torque_force_Nm = 0.0;
      */
   }



   function Shield( puck, pars) {
      // Make a (circular) reference to the host puck.
      this.puck = puck;

      // Optional parameters and defaults.
      this.color = setDefault( pars.color, 'lime');

      // Make a direct reference to the client.
      this.client = clients[this.puck.clientName];

      this.radius_px = px_from_meters( this.puck.radius_m * 1.15);

      this.ON = false;
      this.STRONG = true;
      this.STRONG_timer_s = 0;
      this.STRONG_time_limit_s = 3.0;
      this.CHARGING_timer_s = 0;
      this.CHARGING_time_limit_s = 2.0;
      this.charge_level = 1.0;
   }
   Shield.prototype.updateState = function() {
      // Let the client control the state and draw if ON.
      if (this.client.key_space == "D") {
         this.ON = true;
         if (this.STRONG) {
            var dashArray = [ 0];
         } else {
            // Shields are weak.
            var dashArray = [10];
         }
         drawCircle( ctx, this.puck.position_2d_px, {'borderColor':this.color, 'borderWidth_px':2, 'fillColor':'noFill', 'radius_px':this.radius_px, 'dashArray':dashArray});
      } else {
         this.ON = false;
      }

      // Drain the shield
      if (this.ON && this.STRONG) {
         this.STRONG_timer_s += c.deltaT_s;
         this.charge_level = 1.00 - (this.STRONG_timer_s / this.STRONG_time_limit_s);
         if (this.STRONG_timer_s > this.STRONG_time_limit_s) {
            this.STRONG = false;
            this.STRONG_timer_s = 0.0;
         }
      }

      // Recharge the shield only if completely drained.
      if (!this.STRONG) {
         this.CHARGING_timer_s += c.deltaT_s;
         this.charge_level = this.CHARGING_timer_s / this.CHARGING_time_limit_s;
         if (this.CHARGING_timer_s > this.CHARGING_time_limit_s) {
            this.STRONG = true;
            this.CHARGING_timer_s = 0.0;
         }
      }

      // Display the shield timer on the gun tube.
      this.puck.gun.indicatorFraction = this.charge_level;
   }



   function Tube( puck, pars) {
      // Circular reference back to the puck.
      this.puck = puck;

      // Optional parameters and defaults.
      this.initial_angle = setDefault( pars.initial_angle, 20);
      this.indicator = setDefault( pars.indicator, false);

      // Make a direct reference to the client.
      this.client = clients[this.puck.clientName];

      // 360 degrees/second  /  60 frames/second = 6 degrees/frame
      this.rotationRate_dps = 240.0; //4.0dpf;

      this.tube_color = 'blue';
      this.length_m = 1.05 * this.puck.radius_m;
      this.width_m =  0.30 * this.puck.radius_m;
      this.width_px = px_from_meters( this.width_m);

      // Establish the relative-position vector (for the end of the tube) using the length of the tube.
      this.rel_position_2d_m = new Vec2D(0.0, this.length_m);
      this.rel_position_2d_m.set_angle( this.initial_angle);
      this.AbsPositionOfEnds();

      this.indicatorWidth_px = px_from_meters( this.width_m * 0.40);
      this.indicatorFraction = 0.00;
   }
   Tube.prototype.AbsPositionOfEnds = function() {
      // Determine the absolute positions of the base and the end of the tube.
      this.base_2d_px = screenFromWorld( this.puck.position_2d_m);
      this.end_2d_m = this.puck.position_2d_m.add( this.rel_position_2d_m);
      this.end_2d_px = screenFromWorld( this.end_2d_m);
   }
   Tube.prototype.AbsPositionOfIndicator = function() {
      // The starting point will indicate the "amount" of the indicator.
      this.indicatorBase_2d_m = this.puck.position_2d_m.add( this.rel_position_2d_m.scaleBy(1 - this.indicatorFraction));
      this.indicatorBase_2d_px = screenFromWorld( this.indicatorBase_2d_m);

      // Draw to the end of the tube.
      this.indicatorEnd_2d_m = this.puck.position_2d_m.add( this.rel_position_2d_m.scaleBy( 1.00));
      this.indicatorEnd_2d_px = screenFromWorld( this.indicatorEnd_2d_m);
   }
   Tube.prototype.rotateTube = function( deg) {
      this.rel_position_2d_m.rotated_by( deg);
   }
   Tube.prototype.setTubeAngle = function( deg) {
      this.rel_position_2d_m.set_angle( deg);
   }
   Tube.prototype.drawTube = function() {
      this.AbsPositionOfEnds();
      drawLine(ctx, this.base_2d_px, this.end_2d_px, {'width_px':this.width_px, 'color':this.tube_color});

      if (this.indicator) {
         this.AbsPositionOfIndicator();
         drawLine(ctx, this.indicatorBase_2d_px, this.indicatorEnd_2d_px, {'width_px':this.indicatorWidth_px, 'color':this.puck.shield.color});
      }
   }



   function Jet( puck, pars) {
      // Call the Tube constructor. Bind it to "this" jet. Pass the puck and pars to the constructor.
      Tube.call(this, puck, pars);

      // Add properties specific to Jet.
      this.width_m  = 0.17 * this.puck.radius_m;
      this.height_m = 1.00 * this.puck.radius_m;

      // This jet-flame triangle is oriented like an arrow pointing the positive x direction.
      this.initializeFlame( this.height_m);

      // Point the jet in the same direction as the tube.
      this.rotateJet( this.initial_angle);

      // Set the tube color to match the client color.
      this.tube_color = this.client.color;

      this.flame_color = 'red';
      this.flameEdge_color = 'blue';

      // Scaler magnitude
      this.jet_force_N = 1.3 * this.puck.mass_kg * Math.abs( g_mps2);
      // Controlled by the Two Thumbs interface.
      this.throttle = 1.0;

      this.rotationCounter = 0;
   }
   // Use the Tube prototype as starting point for the Jet (inheritance). This brings
   // in all the methods and attributes from Tube.
   Jet.prototype = Object.create( Tube.prototype, {
      // This object, passed as the second parameter (propertiesObject argument), is another way that you can
      // add in properties for Jet.
      'example2': {value: 22, writable:true},
      'example3': {value:333, writable:true}
   });
   // Set the constructor name to Jet, so it is not "Tube" (default).
   Jet.prototype.constructor = Jet;
   // Define any new methods for Jet.
   Jet.prototype.rotateJet = function( degrees) {
      for (var i = 0, len = this.triangle_2d_m.length; i < len; i++) {
         // Rotate each vertex.
         this.triangle_2d_m[i].rotated_by( degrees);
      }
   }
   Jet.prototype.rotateTubeAndJet = function( deg) {
      this.rotateTube( deg);
      this.rotateJet( deg);
   }
   Jet.prototype.rotateTubeAndJetToAngle = function( degrees) {
      var current_deg = this.rel_position_2d_m.get_angle();
      this.rotateTubeAndJet( -current_deg + degrees);
   }
   Jet.prototype.rotateTubeAndScaleJetToThis = function( f_2d_N) {
      // Rotate the jet to be in the same direction as the supplied vector
      var current_deg = this.rel_position_2d_m.get_angle();

      // Orient the jet along the x axis so it is simple to scale it. The
      // angle will be 0 after this.
      this.rotateTubeAndJet( -current_deg);

      // Scale the jet relative to the length of the supplied vector.
      var height_m = this.height_m * (f_2d_N.length() / this.jet_force_N);
      if (height_m < 0.10) height_m = 0.10;
      this.initializeFlame( height_m);

      var target_deg  = f_2d_N.get_angle();
      var change_deg = target_deg - 0;

      // Rotate, starting from 0, by this amount.
      this.rotateTubeAndJet( change_deg);
   }
   Jet.prototype.rotateJetByClient = function() {
      // The Rate, degrees per frame (dpf), gives the degrees of rotation in one frame.

      // Left/Right pointing control
      if ((this.client.key_d == "D") && (this.client.key_shift != 'D')) {
         this.rotateTubeAndJet(-this.rotationRate_dps * c.deltaT_s);
      }
      if (this.client.key_a == "D") {
         this.rotateTubeAndJet(+this.rotationRate_dps * c.deltaT_s);
      }

      // For use in stopping the puck...
      if ((this.client.key_s == "D") && (this.client.key_shift != "D") && (this.client.key_s_enabled)) {
         // This rotates the rel_position vector (the tube pointer) by the amount that it differs from the direction of motion.
         // The result being that it flips the tube to be in a direction opposite of the motion.
         // After the first flip, the subsequent s pressed rotate by -90 degrees. The rotationCounter is reset
         // when the jet is used.
         if (this.rotationCounter == 0) {
            this.rotateTubeAndJet(this.puck.velocity_2d_mps.get_angle() - this.rel_position_2d_m.get_angle());
         } else {
            this.rotateTubeAndJet(-90);
         }
         this.rotationCounter += 1;
         this.client.key_s_enabled = false;
      }
      if ((this.client.key_s == "U") && (!this.client.key_s_enabled)) {
         this.client.key_s_enabled = true;
      }
   }
   Jet.prototype.initializeFlame = function( height_m) {
      // This jet-flame triangle is oriented like an arrow pointing the positive x direction.
      this.triangle_2d_m = [new Vec2D(0,0),             new Vec2D(0,-this.width_m),
                            new Vec2D(height_m,0), new Vec2D(0,this.width_m)];
   }
   Jet.prototype.drawJetFlame = function() {

      // Before you can draw it, you have to know where it is on the screen.
      this.triangle_2d_px = [];
      for (var i = 0, len = this.triangle_2d_m.length; i < len; i++) {
         // Put it on the end of the tube.
         var p_2d_m = this.end_2d_m.add(this.triangle_2d_m[i]);
         var p_2d_px = screenFromWorld( p_2d_m);
         // Put it in the triangle array.
         this.triangle_2d_px.push( p_2d_px);
      }

      drawPolygon( ctx, this.triangle_2d_px, {'borderColor':this.flameEdge_color,'borderWidth_px':3,'fillColor':this.flame_color});

   }
   Jet.prototype.updateAndDraw = function() {
      // Jet is always on for NPCs (unless floating free from navigational track).
      if (this.client.name.slice(0,3) == 'NPC') {
         if (!dC.editor.checked && !this.puck.disableJet) {
            this.drawTube();
            this.drawJetFlame();
         }
      // Jet is controlled to be on/off for human (non NPC) users
      } else {
         // Respond to client controls to rotate the Tube and Jet.
         this.rotateJetByClient();

         // Always draw the tube.
         this.drawTube();

         // If the jet is on (w key down), draw it, and calculate jet forces.
         if (this.client.key_w == "D") {
            this.puck.jet_force_2d_N = this.rel_position_2d_m.scaleBy( -this.jet_force_N*this.throttle/this.length_m);
            // Set the length of the jet flame to be proportional to the strength of the jet.
            this.rotateTubeAndScaleJetToThis( this.puck.jet_force_2d_N.scaleBy(-1));
            this.drawJetFlame();
            // If the jet is used, reset the rotation event counter.
            this.rotationCounter = 0;
         } else {
            this.puck.jet_force_2d_N = this.rel_position_2d_m.scaleBy( 0);
         }
      }
   }



   function Gun( puck, pars) {
      // Call the Tube constructor. Bind it to "this" gun. Pass the puck and pars to the constructor.
      Tube.call(this, puck, pars);

      this.tube_color = setDefault( pars.tube_color, 'white');

      // Add properties specific to Gun.
      this.width_m  = 0.17 * this.puck.radius_m;
      this.height_m = 1.00 * this.puck.radius_m;

      // This overrides the rotationRate_dps inherited from the tube.
      this.rotationRate_dps = 90.0; //1.5dpf
      this.bulletSpeed_mps = 7.0;
      this.bulletCountLimit = 5;

      this.bulletWaitTimer_ms;
      this.timeBetweenBullets_ms = 70; //70

      this.rayCastLineLength_m = pars.rayCastLineLength_m; //always provided when a new gun is made for the host's puck.
      this.rayCast_init_deg = setDefault( pars.rayCast_init_deg, 0.0);
      // Orient this along the x-axis, zero degrees.
      this.rayCastLine_2d_m = new Vec2D(this.rayCastLineLength_m, 0);
      this.rayCastLine_2d_m.rotated_by( this.rayCast_init_deg);

      this.rayRotationRate_dps = setDefault( pars.rayRotationRate_dps, 80);
      this.scanning = setDefault( pars.scanning, true);
      this.rayBody = null;
      this.angleToFoundPuck = 0;

      // Attributes controlled only by the Two Thumbs interface (not the keyboard).
      this.scopeRotRateFrac = 0.0;
      this.scopeTrigger = 'U';
      this.scopeBreak = false;
      this.breakTimer_ms = 0;
      this.breakTimer_limit_ms = 100;
   }
   // Use the Tube prototype as starting point for the Gun (inheritance). This brings
   // in all the methods and attributes from Tube.
   Gun.prototype = Object.create( Tube.prototype);
   // Set the constructor name to Gun, so it is not "Tube" (default).
   Gun.prototype.constructor = Gun;
   // Define any new methods for Gun.
   Gun.prototype.rotateGunByClient = function() {
      // The Rate, degrees per frame (dpf), gives the degrees of rotation in one frame.

      // Left/Right pointing control using the keyboard
      if (this.client.key_l == "D") {
         this.rotateTube(-this.rotationRate_dps * c.deltaT_s);
      }
      if (this.client.key_j == "D") {
         this.rotateTube(+this.rotationRate_dps * c.deltaT_s);
      }

      // Similar, but using the Two-Thumbs interface.
      //if (this.scopeTrigger == "D") {
      if (this.scopeRotRateFrac != 0.0) {
         //console.log('rF='+this.scopeRotRateFrac);
         this.rotateTube((-1) * this.rotationRate_dps * this.scopeRotRateFrac * c.deltaT_s);
      }

      if ((this.client.key_k == "D") && (this.client.key_k_enabled)) {
         if (this.client.key_shift == "D") {
            this.rotateTube(+90.0);
         } else {
            this.rotateTube(-90.0);
         }

         this.client.key_k_enabled = false;
      }
      if ((this.client.key_k == "U") && (!this.client.key_k_enabled)) {
         this.client.key_k_enabled = true;
      }
   }
   Gun.prototype.fireBullet = function() {
      // The bullet velocity as seen from the puck (dividing by length produces a normalized vector)
      var relativeVel_2D_mps = this.rel_position_2d_m.scaleBy( this.bulletSpeed_mps/this.length_m);

      // Absolute velocity of bullet as seen from the world.
      var absoluteVel_2D_mps = relativeVel_2D_mps.add( this.puck.velocity_2d_mps);

      // Setting bullet friction, to be near 0.0, and bullet restitution, to be near 1.0,
      // gives simple and symmetric collision behavior when the bullets hit the walls.

      // Set the group index of the bullets to equal the negative value assigned by default to the
      // host puck. That will prevent bullets (from this gun) from colliding with each other and the host puck.

      // Note that the target-leading algorithm for the NPCs is more accurate if you use puck.position_2d_m as compared to end_2d_m (tube end).
      // So, for NPC clients, this will fire the bullet (to fly free) starting from the base of the tube not starting from the end of the tube.
      if (this.client.name.slice(0,3) == 'NPC') {
         var bulletStartPosition_2d_m = this.puck.position_2d_m;
      } else {
         var bulletStartPosition_2d_m = this.end_2d_m;
      }
      // Make this bullet with the same groupIndex as the host puck (so no collisions with the host).
      var bullet = new Puck( bulletStartPosition_2d_m, absoluteVel_2D_mps,
         {'radius_m':0.04, 'bullet':true, 'color':this.client.color, 'borderWidth_px':1, 'clientNameOfShooter':this.client.name,
          'ageLimit_ms':this.puck.bulletAgeLimit_ms, 'restitution_fixed':true , 'restitution':this.puck.bullet_restitution, 'friction_fixed':true, 'friction':0.0,
          'groupIndex':this.puck.groupIndex});

      // Calculate the recoil impulse from firing the gun (opposite the direction of the bullet).
      if ((this.scopeTrigger == 'U') && (!this.puck.noRecoil)) {
         this.puck.impulse_2d_Ns.addTo( relativeVel_2D_mps.scaleBy(-1 * bullet.mass_kg));
      }
   }
   Gun.prototype.start_BulletStream = function() {
      this.bulletCount = 1;
      this.bulletStream = 'on';
      // This allows the gun to immediately fire the first bullet.
      this.bulletWaitTimer_ms = 0;
   }
   Gun.prototype.stop_BulletStream = function() {
      this.bulletStream = 'off';
   }
   Gun.prototype.update_BulletStream = function() {
      this.bulletWaitTimer_ms += c.deltaT_s * 1000;

      // If ok to fire, do so.
      if ((this.bulletStream == 'on') && (this.bulletWaitTimer_ms >= this.timeBetweenBullets_ms) && (this.bulletCount <= this.bulletCountLimit)) {
         // If the shields are down.
         if (!this.puck.shield.ON) {
            this.fireBullet();
         }
         this.bulletWaitTimer_ms = 0;
         this.bulletCount += 1;
      }
   }
   Gun.prototype.drawRayCastLine = function() {
      // Update the angle of the ray.
      if (this.client.name.slice(0,3) == 'NPC') {
         if (this.scanning && !c.npcSleep) {
            this.rayCastLine_2d_m.rotated_by( +this.rayRotationRate_dps * c.deltaT_s);
         }
      } else {
         this.rayCastLine_2d_m.matchAngle(this.rel_position_2d_m);
      }

      var ray_end_2d_m = this.puck.position_2d_m.add( this.rayCastLine_2d_m);

      var rayBody = null;
      // Set an endpoint in case nothing is hit in the raycast.
      var raycast_end_2d_m = ray_end_2d_m;
      var minFraction = 1.0;

      world.RayCast( function( fixture, point, outputNormal, fraction) {

         var fixtureBody = tableMap.get( fixture.GetBody());
         /*
         This "if" block updates the ray cast results only if it finds something closer.
         I didn't expect to have to do this when returning "fraction". But without
         this block, the callback will run multiple times and the last fixture to run it
         will determine the point vector. Last object always wins. So this block makes
         the closest object (along the ray) win out in identifying the fixture and point.
         */
         if ((fraction < minFraction) && (!((fixtureBody.bullet) || (fixtureBody.constructor.name == "Pin")))) {
            minFraction = Math.min(fraction, minFraction);
            rayBody = fixtureBody;
            raycast_end_2d_m = Vec2D_from_b2Vec2( point);
         }
         return fraction;
      }, b2Vec2_from_Vec2D( this.puck.position_2d_m), b2Vec2_from_Vec2D( ray_end_2d_m) );

      //console.log(this.client.NPC_guncooling_timer_s);
      if (rayBody && (rayBody.constructor.name == "Puck")) {
         // Make a reference to this rayBody on the gun
         this.rayBody = rayBody;
         //this.rayBody.color = 'green';
         this.scanning = false;

         // Point the ray at the center of the found puck.
         this.angleToFoundPuck = this.rayBody.position_2d_m.subtract( this.puck.position_2d_m).get_angle();
         this.rayCastLine_2d_m.set_angle( this.angleToFoundPuck);

         //console.log( "this.rayBody.name = " + this.rayBody.name);

      // This time check keeps you from sweeping during the bullet stream. Something about the small bullets
      // and their speed that yields occasional errors from the raycast.
      } else if (this.client.NPC_guncooling_timer_s >= this.client.NPC_guncooling_timer_limit_s) {
         this.scanning = true;
         this.rayBody = null;
      }

      // Draw it.
      var raycast_end_2d_px = screenFromWorld( raycast_end_2d_m);
      drawLine(ctx, this.puck.position_2d_px, raycast_end_2d_px, {'width_px':1, 'color':'yellow', 'dashArray':[4]});
   }
   Gun.prototype.updateAndDraw = function() {
      // Respond to client controls to rotate the Gun.
      this.rotateGunByClient();

      // Always draw the tube.
      this.drawTube();
      // Cast and draw ray based on gun orientation.
      var scopeRayOn = (this.scopeTrigger == "D") || (this.scopeRotRateFrac !=0);
      if ((this.client.name.slice(0,3) == 'NPC') || scopeRayOn) {
         this.drawRayCastLine();
      }

      if (this.scopeBreak) {
         if (this.breakTimer_ms > this.breakTimer_limit_ms) {
            this.breakTimer_ms = 0;
            this.scopeBreak = false;
         } else {
            drawCircle( ctx, this.puck.position_2d_px, {'borderColor':'red', 'borderWidth_px':10, 'fillColor':'noFill', 'radius_px':40});
            this.breakTimer_ms += c.deltaT_s * 1000;
         }
      }

      // Fire the gun:
      // This draw method gets called every frame. If the i key is down, you
      // don't want it to fire a bullet every frame. The following logic allows one
      // call to fireBullet and then disables the i key. To enable, must release
      // the key to the up position.
      if ((this.client.key_i == "D") || (this.scopeTrigger == "D")) {
         if (this.client.key_i_enabled) {
            this.start_BulletStream();
            this.client.key_i_enabled = false;
            //console.log("gun draw: i down and disabled.");
         }
         this.update_BulletStream();

         // Reseting this counter here allows you to compensate for recoil with the s key (align opposite the motion)
         // then w (some jet).
         this.puck.jet.rotationCounter = 0;

      } else if (((this.client.key_i == "U") && (this.scopeTrigger == "U")) && (!this.client.key_i_enabled)) {
         this.stop_BulletStream();
         this.client.key_i_enabled = true;
         //console.log("gun draw: i up and enabled.");
      }
   }



   // Static spring anchors (no collisions)
   function Pin( position_2d_m, pars) {
      this.parsAtBirth = pars;
      //this.alsoThese = [];
      this.cursorPin = setDefault( pars.cursorPin, false);

      if (pars.name) {
         this.name = pars.name;
         // Get the number part of the name
         var numberInName = this.name.slice(3);
         // Don't change the index if no number in name.
         if (isNaN( numberInName)) {
            numberInName = 0;
         } else {
            numberInName = Number( numberInName);
         }
         Pin.nameIndex = Math.max( Pin.nameIndex, numberInName);
      } else {
         Pin.nameIndex += 1;
         this.name = 'pin' + Pin.nameIndex;
      }
      //console.log("pin name, index = " + this.name + ',' + Pin.nameIndex);

      // Don't put cursor pins in the map.
      if (!this.cursorPin) aT.pinMap[this.name] = this;

      this.position_2d_m = Vec2D_check( position_2d_m);
      this.position_2d_px = screenFromWorld( this.position_2d_m);

      // Local selection point for a pin is always at its center.
      this.selectionPoint_l_2d_m = new Vec2D(0.0, 0.0);

      this.velocity_2d_mps =  setDefault( pars.velocity_2d_mps, new Vec2D(0.0, 0.0));

      this.radius_px = setDefault( pars.radius_px, 6);
      // Make the radius in box2d a little larger so can select it easier.
      this.radius_m = meters_from_px( this.radius_px + 2);

      // www.iforce2d.net/b2dtut/collision-filtering
      this.groupIndex = setDefault( pars.groupIndex, 0);
      this.categoryBits = setDefault( pars.categoryBits, 0x0001);
      // Masking parameters for b2d object for the pin:
      // The default Box2D values are 0xFFFF for maskBits (collide with everything).
      // Default here, 0x0000, will prevent collisions with the pin (collide with nothing).
      this.maskBits = setDefault( pars.maskBits, 0x0000);

      this.b2d = null;
      this.create_b2d_pin();
      // Create a reference back to this pin from the b2d pin.
      tableMap.set(this.b2d, this);

      this.deleted = false;

      // For creating a circular linked-list of pins to guide the NPC movement.
      this.NPC = setDefault( pars.NPC, false);
      this.nextPinName = setDefault( pars.nextPinName, null);
      this.previousPinName = setDefault( pars.previousPinName, null);

      this.visible = setDefault( pars.visible, true);
      this.fillColor = setDefault( pars.fillColor, 'blue');
      this.borderColor = setDefault( pars.borderColor, 'gray');
   }
   Pin.nameIndex = 0;
   Pin.applyToAll = function ( doThis) {
      for (var pinName in aT.pinMap) {
         var pin = aT.pinMap[ pinName];
         doThis( pin);
      }
   }
   Pin.deleteAll = function () {
      Pin.applyToAll( pin => {
         tableMap.delete( pin.b2d);
         if (pin.b2d) world.DestroyBody( pin.b2d);
      });
      aT.pinMap = {};
      Pin.nameIndex = 0;
   }
   Pin.prototype.deleteThisOne = function( pars) {
      var deleteMode = setDefault( pars.deleteMode, null);

      // Note that springs are checked, in the updateAirTable function, to
      // see if either of the two objects it is attached to has been deleted.
      // If so, the spring is deleted. So that's not needed here.

      // Reassign the surrounding pins (if they are part of an NPC path)
      if (this.NPC) {
         // Point the next pin back at the previous pin.
         aT.pinMap[this.nextPinName].previousPinName = aT.pinMap[this.previousPinName].name;
         // Point the previous pin forward to the next pin.
         aT.pinMap[this.previousPinName].nextPinName = aT.pinMap[this.nextPinName].name;
      }

      // Delete reference in the tableMap.
      tableMap.delete( this.b2d);

      // Delete the corresponding Box2d object.
      world.DestroyBody( this.b2d);

      // Mark this pin as deleted.
      this.deleted = true;

      // Remove this pin from the pin map.
      delete aT.pinMap[ this.name];
      // ...and from the multi-select map.
      hostMSelect.removeOne( this);
   }
   Pin.prototype.copyThisOne = function( pars) {
      var position_2d_m = setDefault( pars.position_2d_m, this.position_2d_m);

      var p_2d_m = Object.assign({}, position_2d_m);
      var parsForNewBirth =   Object.assign({}, this.parsAtBirth);
      // Make sure the name is nulled so the auto-naming feature is used in the constructor.
      parsForNewBirth.name = null;

      var newPin = new Pin( p_2d_m, parsForNewBirth);

      // Slide the new pin in front of the old one if it's in a NPC.
      if (this.NPC) {
         // Set the two links for the new pin.
         newPin.nextPinName = this.nextPinName;
         newPin.previousPinName = this.name;

         // Update the backward link of the original next pin.
         aT.pinMap[this.nextPinName].previousPinName = newPin.name;

         // Update the forward link of the original pin.
         this.nextPinName = newPin.name;
      }
      return newPin;
   }
   Pin.prototype.define_fixture = function() {

      var fixDef = new b2FixtureDef;

      fixDef.filter.groupIndex = this.groupIndex;
      fixDef.filter.categoryBits = this.categoryBits;
      fixDef.filter.maskBits = this.maskBits;

      fixDef.shape = new b2CircleShape( this.radius_m);

      return fixDef;
   }
   Pin.prototype.create_b2d_pin = function() {
      // Create a rectangular and static box2d object.

      var bodyDef = new b2BodyDef;
      bodyDef.type = b2Body.b2_kinematicBody; // b2_kinematicBody b2_staticBody

      this.b2d = world.CreateBody(bodyDef);
      this.b2d.CreateFixture( this.define_fixture());

      // Set the state: position.
      this.b2d.SetPosition( this.position_2d_m);
      this.b2d.SetLinearVelocity( this.velocity_2d_mps);
   }
   Pin.prototype.getPosition = function() {
      this.position_2d_m = Vec2D_from_b2Vec2( this.b2d.GetPosition());
      this.position_2d_px = screenFromWorld( this.position_2d_m);
   }
   Pin.prototype.draw_MultiSelectPoint = function() {
      this.getPosition();
      drawCircle( ctx, this.position_2d_px, {'borderColor':'black', 'borderWidth_px':1, 'fillColor':'yellow', 'radius_px':5});
   }
   Pin.prototype.draw = function( radius_px) {
      radius_px = setDefault( radius_px, this.radius_px);
      if (dC.editor.checked || this.visible) {
         this.getPosition();
         var fillColor = (ctx.globalCompositeOperation == 'screen') ? 'white' : this.fillColor;
         drawCircle( ctx, this.position_2d_px, {'borderColor':this.borderColor, 'borderWidth_px':2, 'fillColor':fillColor, 'radius_px':radius_px});
      }

      // Draw lines to indicate the relationships in the NPC navigation map.
      if (this.NPC && dC.editor.checked) {
         if (aT.pinMap[this.nextPinName]) {
            drawLine(ctx, this.position_2d_px, aT.pinMap[this.nextPinName].position_2d_px, {'width_px':1, 'color':this.color, 'dashArray':[3]});
         }
      }
   }



   function Spring(puckOrPin1, puckOrPin2, pars) {
      // Must have both objects to attach the spring.
      // Throwing an error forces an exit from this constructor.
      if ( !((puckOrPin1) && (puckOrPin2)) ) {
         var errorObj = new Error('Attempting to construct a spring with one or both connected objects missing.');
         errorObj.name = 'from Spring constructor';
         throw errorObj;
      }
      this.parsAtBirth = pars;
      //this.alsoThese = [];

      if (pars.name) {
         this.name = pars.name;
         // Get the number part of the name
         var numberInName = this.name.slice(1);
         // Don't change the index if no number in name.
         if (isNaN( numberInName)) {
            numberInName = 0;
         } else {
            numberInName = Number( numberInName);
         }
         Spring.nameIndex = Math.max( Spring.nameIndex, numberInName);
      } else {
         Spring.nameIndex += 1;
         this.name = 's' + Spring.nameIndex;
      }
      //console.log("n-spring = " + Spring.nameIndex + ',' + this.name);

      aT.springMap[this.name] = this;

      this.color = setDefault( pars.color, "red");
      this.visible = setDefault( pars.visible, true);
      this.length_m = setDefault( pars.length_m, 0.0);
      this.strength_Npm = setDefault( pars.strength_Npm, 0.5);
      this.unstretched_width_m = setDefault( pars.unstretched_width_m, 0.025);
      // Note that pucks have an attribute linDamp, with an effect similar to drag_c. Both can be
      // used to model a drag force on the pucks at the end of the spring.
      this.drag_c = setDefault( pars.drag_c, 0.0);
      this.damper_Ns2pm2 = setDefault( pars.damper_Ns2pm2, 0.5);
      this.dashedLine = setDefault( pars.dashedLine, false);
      this.roundedEnds = setDefault( pars.roundedEnds, true);

      this.navigationForNPC = setDefault( pars.navigationForNPC, false);
      this.forCursor = setDefault( pars.forCursor, false);

      // Spring-puck/pin Object (spo1, not p1). Giving this a distinctive name so that it can be filtered
      // out in the JSON capture. This filtering avoids some wordiness in the capture.
      this.spo1 = puckOrPin1;
      this.p1_name = puckOrPin1.name;
      // Pin one end of the spring to a fixed location.
      if (this.spo1.constructor.name == "Pin") {
         this.pinned = true;
      } else {
         this.pinned = false;
      }
      // local point where spring is attached on spo1
      this.spo1_ap_l_2d_m = setDefault( pars.spo1_ap_l_2d_m, new Vec2D(0,0));

      // Same reasoning here for the distinctive name (spo2, not p2).
      this.spo2 = puckOrPin2;
      this.p2_name = puckOrPin2.name;
      // Pin one end of the spring to a fixed location.
      if (this.spo2.constructor.name == "Pin") {
         this.pinned = true;
      } else {
         this.pinned = false;
      }
      // local point where spring is attached on spo2
      this.spo2_ap_l_2d_m = setDefault( pars.spo2_ap_l_2d_m, new Vec2D(0,0));

      this.p1p2_separation_2d_m = new Vec2D(0,0);
      this.p1p2_separation_m = 0;
      this.p1p2_normalized_2d = new Vec2D(0,0);

      // To model the spring as a distance joint in b2d. Don't allow this
      // for the navigation springs.
      this.b2d = null;
      this.softContraints = setDefault( pars.softContraints, c.softContraints_default);
      this.collideConnected = setDefault( pars.collideConnected, true);

      if (this.softContraints && ( ! this.navigationForNPC)) {
         this.createDistanceJoint();
      } else if (this.navigationForNPC) {
         this.softContraints = false;
      }
   }
   Spring.nameIndex = 0;
   Spring.applyToAll = function ( doThis) {
      // Run the doThis code on each spring.
      for (var springName in aT.springMap) {
         var spring = aT.springMap[ springName];
         doThis( spring);
      }
   }
   Spring.deleteAll = function () {
      // If any of these springs are b2d distance joints, remove these from the b2d world.
      Spring.applyToAll( spring => {
         if (spring.softContraints) {
            world.DestroyJoint( spring.b2d);
            spring.b2d = null;
         }
      });
      aT.springMap = {};
      Spring.nameIndex = 0;
   }
   Spring.findAll_InMultiSelect = function ( doThis) {
      // Find all the springs that have both ends (puck or pin) in the multi-select map.
      // Then run the doThis function that has been passed in here.
      Spring.applyToAll( spring => {
         if ((spring.spo1.name in hostMSelect.map) && (spring.spo2.name in hostMSelect.map)) {
            // For each spring you find.
            doThis( spring);
         }
      });
   }
   Spring.prototype.createDistanceJoint = function() {
      var distance_joint = new b2DistanceJointDef;

      // Identify the connected bodies.
      distance_joint.bodyA = this.spo1.b2d;
      distance_joint.bodyB = this.spo2.b2d;

      // Connect to the attachment point on each body.
      distance_joint.localAnchorA = new b2Vec2_from_Vec2D( this.spo1_ap_l_2d_m);
      distance_joint.localAnchorB = new b2Vec2_from_Vec2D( this.spo2_ap_l_2d_m);

      // Initialize the soft constraints.
      distance_joint.length = this.length_m;
      distance_joint.frequencyHz  = 1.0;
      distance_joint.dampingRatio = 0.0;

      // Will the connected bodies collide?
      distance_joint.collideConnected = this.collideConnected;

      // Add the joint to the world. And keep a reference to it here (this spring) as b2d.
      this.b2d = world.CreateJoint( distance_joint);

      // Update it to reflect the traditional spring parameters and the effective mass.
      this.updateB2D_spring();
   }
   Spring.prototype.updateB2D_spring = function() {
      // Use the smaller of the two pucks in the frequency calculation.
      var smallerMass_kg = 10000;
      if (this.spo1.constructor.name == 'Puck') smallerMass_kg = Math.min(this.spo1.mass_kg, smallerMass_kg);
      if (this.spo2.constructor.name == 'Puck') smallerMass_kg = Math.min(this.spo2.mass_kg, smallerMass_kg);

      this.b2d.SetLength( this.length_m);

      // The frequency and damping ratio expressions are based on the equations on page 45 of this
      // presentation by Erin Catto.
      // http://box2d.org/files/GDC2011/GDC2011_Catto_Erin_Soft_Constraints.pdf

      // omega = (k/m)^0.5
      // f = omega / 2Pi = (k/m)^0.5 / 2Pi
      var freq_hz = Math.sqrt( this.strength_Npm/ smallerMass_kg)/(2.0 * Math.PI);
      this.b2d.SetFrequency( freq_hz);

      // dampingRatio = c / (2 * m * omega)
      var dampingRatio = this.damper_Ns2pm2 / (2.0 * smallerMass_kg * (2.0 * Math.PI * this.b2d.GetFrequency()));
      var dampingRatio_tweaked = dampingRatio /1.0 ;
      this.b2d.SetDampingRatio( dampingRatio_tweaked);
   }
   Spring.prototype.deleteThisOne = function( pars) {
      var deleteMode = setDefault( pars.deleteMode, null);

      if (this.softContraints) {
         world.DestroyJoint( this.b2d);
         this.b2d = null;
      }

      if (this.navigationForNPC) {
         // Dissociate the NPC puck from the navigation pin. Do this to prevent the
         // navigation spring from regenerating when the capture is restored.
         // Also disable the jet, since the NPC puck won't be motoring until attached to navigation again.
         if (this.spo1.constructor.name == "Puck") {
            this.spo1.pinName = null;
            this.spo1.parsAtBirth.pinName = null;
            this.spo1.disableJet = true;
         }
         if (this.spo2.constructor.name == "Puck") {
            this.spo2.pinName = null;
            this.spo2.parsAtBirth.pinName = null;
            this.spo2.disableJet = true;
         }
      }

      // Remove this spring from the spring map.
      delete aT.springMap[ this.name];
   }
   Spring.prototype.copyThisOne = function(p1, p2, copyMode) {
      copyMode = setDefault( copyMode, "regular");

      // Make a copy of the mutable objects that are passed into the Spring constructor.
      var pars = Object.assign({}, this.parsAtBirth);
      // Null the name so the auto-naming feature is used in the constructor.
      pars.name = null;
      pars.length_m = this.length_m;
      pars.unstretched_width_m = this.unstretched_width_m
      pars.strength_Npm = this.strength_Npm;
      pars.damper_Ns2pm2 = this.damper_Ns2pm2;
      // factor for drag force on attached pucks (proportional to velocity)
      pars.drag_c = this.drag_c;

      // Set local attachment points when pasting a spring.
      if (copyMode == "pasteSingle") {
         if (dC.comSelection.checked) {
            pars.spo1_ap_l_2d_m = new Vec2D(0,0);
            pars.spo2_ap_l_2d_m = new Vec2D(0,0);
         } else {
            // Always paste onto the center of a pin.
            pars.spo1_ap_l_2d_m = (p1.constructor.name == "Pin") ? new Vec2D(0,0) : p1.selectionPoint_l_2d_m;
            pars.spo2_ap_l_2d_m = (p2.constructor.name == "Pin") ? new Vec2D(0,0) : p2.selectionPoint_l_2d_m;
         }
      }
      // Note that this instantiation adds this new spring to the spring map.
      var tempSpring = new Spring( p1, p2, pars);

      // Also enable the jet for NPC pucks, since the NPC puck will be motoring now that it is attached to navigation again.
      if (tempSpring.navigationForNPC) {
         if (tempSpring.spo1.constructor.name == "Puck") {
            tempSpring.spo1.disableJet = false;
         }
         if (tempSpring.spo2.constructor.name == "Puck") {
            tempSpring.spo2.disableJet = false;
         }
      }

      return tempSpring.name;
   }
   Spring.prototype.modify_fixture = function( mode) {
      var width_factor = 1.0;
      var length_factor = 1.0;
      var damping_factor = 1.0;

      if (mode == 'wider') {
         width_factor = 1.1;
      } else if (mode == 'thinner') {
         width_factor = 0.9;
      } else if (mode == 'taller') {
         length_factor = 1.1;
      } else if (mode == 'shorter') {
         length_factor = 0.9;
      } else if (mode == 'moreDamping') {
         damping_factor = 1.1;
      } else if (mode == 'lessDamping') {
         damping_factor = 0.9;
      } else if (mode == 'noChange') {
         // don't change anything.
      }

      // First, the special case of the pinned puck that is using a zero length spring. Give
      // it a little length to start with, otherwise the zero will always scale to zero (it will never
      // get longer).
      if (mode=='shorter' || mode=='taller') {
         if (this.length_m == 0.0) this.length_m = 0.1;
         this.length_m *= length_factor;
         if (this.length_m < 0.1) this.length_m = 0.0;
         helpMessage.newMessage('length = ' + this.length_m.toFixed(4), 0.5);

      } else if (mode=='thinner' || mode=='wider') {
         // Use the wider/thinner width_factor to affect both the visual width and strength of the spring.
         this.unstretched_width_m *= width_factor;
         this.strength_Npm *= width_factor;
         helpMessage.newMessage('k = ' + this.strength_Npm.toFixed(4), 0.5);

      } else if (mode=='lessDamping' || mode=='moreDamping') {
         // If at zero, give the scaling factor something to work with.
         if (this.damper_Ns2pm2 == 0.0) this.damper_Ns2pm2 = 0.1;
         // Apply the scaling factor.
         this.damper_Ns2pm2 *= damping_factor;
         // A lower limit.
         if (this.damper_Ns2pm2 < 0.1) this.damper_Ns2pm2 = 0.0;
         helpMessage.newMessage('spring damping = ' + this.damper_Ns2pm2.toFixed(4), 0.5);
      }

      // If you're using a distance joint in Box2D...
      if (this.softContraints) {
         this.updateB2D_spring();
      }
   }
   Spring.prototype.force_on_pucks = function() {
      /*
      If springs are modeled with Hooke's law, determine all the forces
      (related to the spring) that act on the two attached bodies. This
      includes forces acting at the attachment points and those acting at the
      COMs. Calculate:
      -- separation distance (length) and vector between the two attachment points for calculating the spring forces
      -- relative speed of the attachment points for use in calculating the damping forces
      -- absolute speed of each attachment point for use in calculating drag forces

      Some of this is also needed for drawing the springs modeled as distance
      joints (in Box2D engine).
      */
      // Find the world position of the attachment points.
      if ((this.spo1_ap_l_2d_m.x != 0) || (this.spo1_ap_l_2d_m.y != 0)) {
         this.spo1_ap_w_2d_m = Vec2D_from_b2Vec2( this.spo1.b2d.GetWorldPoint( this.spo1_ap_l_2d_m));
      } else {
         this.spo1_ap_w_2d_m = this.spo1.position_2d_m;
      }
      this.spo1_ap_w_2d_px = screenFromWorld( this.spo1_ap_w_2d_m);
      if ((this.spo2_ap_l_2d_m.x != 0) || (this.spo2_ap_l_2d_m.y != 0)) {
         this.spo2_ap_w_2d_m = Vec2D_from_b2Vec2( this.spo2.b2d.GetWorldPoint( this.spo2_ap_l_2d_m));
      } else {
         this.spo2_ap_w_2d_m = this.spo2.position_2d_m;
      }
      this.spo2_ap_w_2d_px = screenFromWorld( this.spo2_ap_w_2d_m);

      // Separation vector and its length:
      // Need these two results for both distance joints and regular springs:
      this.p1p2_separation_2d_m = this.spo1_ap_w_2d_m.subtract( this.spo2_ap_w_2d_m);
      this.p1p2_separation_m = this.p1p2_separation_2d_m.length();

      //  If not using the native spring modeling (distance joints) in b2d, calculate the spring and damping forces.
      if ( ! this.softContraints) {
         /*
         First, calculate the forces that don't necessarily act on the center of the body, non COM.

         The pinned case needs to be able to handle the zero length spring. The
         separation distance will be zero when the pinned spring is at rest.
         This will cause a divide by zero error if not handled here.

         The second clause in this if statement checks for use of the editor,
         the control key. Block cursor-spring forces when doing deterministic
         movements. This only blocks traditional springs. If in distance-joint
         mode, the cursor movement will drag the selected puck some (a little)
         even when control key is down (and using shift or alt keys for
         rotation).
         */
         if (((this.p1p2_separation_m == 0.0) && (this.length_m == 0.0)) ||
             ((clients['local'].key_ctrl == "D") && this.forCursor) ) {
            var spring_force_on_1_2d_N = new Vec2D(0.0,0.0);
         } else {
            this.p1p2_normalized_2d = this.p1p2_separation_2d_m.scaleBy( 1/this.p1p2_separation_m);
            // Spring force:  acts along the separation vector and is proportional to the separation distance.
            var spring_force_on_1_2d_N = this.p1p2_normalized_2d.scaleBy( (this.length_m - this.p1p2_separation_m) * this.strength_Npm);
         }

         /*
         These non-COM spring forces must be applied individually, at the
         attachment points. That's why these are appended to the puck's
         nonCOM_2d_N force array. This array is reset (emptied) after the
         movements are calculated in the physics engine.
         */

         if (this.spo1.constructor.name == "Puck") {
            this.spo1.nonCOM_2d_N.push({'force_2d_N': spring_force_on_1_2d_N.scaleBy( +1), 'point_w_2d_m': this.spo1_ap_w_2d_m});
            /*
            The following vector is used for aiming the NPC's navigation jets. (Note
            navigation springs are always conventional springs.) Check to see that
            this is on a navigation pin before updating navSpringOnly_force_2d_N. We
            only want the navigation spring force to be affecting the drawing of the
            navigation jet. This will exclude other springs, like cursor springs,
            from affecting the jet representation.
            */
            if ((this.spo2.constructor.name == "Pin") && (this.spo2.NPC)) this.spo1.navSpringOnly_force_2d_N = spring_force_on_1_2d_N.scaleBy( +1);
         }
         if (this.spo2.constructor.name == "Puck") {
            this.spo2.nonCOM_2d_N.push({'force_2d_N': spring_force_on_1_2d_N.scaleBy( -1), 'point_w_2d_m': this.spo2_ap_w_2d_m});
            // (see explanation in spo1 block above)
            if ((this.spo1.constructor.name == "Pin") && (this.spo1.NPC)) this.spo2.navSpringOnly_force_2d_N = spring_force_on_1_2d_N.scaleBy( -1);
         }

         // Damper force: acts along the separation vector and is proportional to the relative speed.
         // First, get the velocity at each attachment point.
         var v_spo1_ap_2d_mps = Vec2D_from_b2Vec2( this.spo1.b2d.GetLinearVelocityFromWorldPoint( this.spo1_ap_w_2d_m));
         var v_spo2_ap_2d_mps = Vec2D_from_b2Vec2( this.spo2.b2d.GetLinearVelocityFromWorldPoint( this.spo2_ap_w_2d_m));

         var v_relative_2d_mps = v_spo1_ap_2d_mps.subtract( v_spo2_ap_2d_mps);
         var v_relative_alongNormal_2d_mps = v_relative_2d_mps.projection_onto( this.p1p2_separation_2d_m);
         if (v_relative_alongNormal_2d_mps == null) v_relative_alongNormal_2d_mps = v_relative_2d_mps.scaleBy(0.0);

         var damper_force_on_1_2d_N = v_relative_alongNormal_2d_mps.scaleBy( this.damper_Ns2pm2);
         // This damper force acts in opposite directions for each of the two pucks.
         if (this.spo1.constructor.name == "Puck") {
            // Again, notice the negative sign here, opposite to the spring force.
            this.spo1.nonCOM_2d_N.push({'force_2d_N': damper_force_on_1_2d_N.scaleBy( -1), 'point_w_2d_m': this.spo1_ap_w_2d_m});
         }
         if (this.spo2.constructor.name == "Puck") {
            this.spo2.nonCOM_2d_N.push({'force_2d_N': damper_force_on_1_2d_N.scaleBy( +1), 'point_w_2d_m': this.spo2_ap_w_2d_m});
         }
      }
      /*
      The following drag forces act at the puck's COM.

      These forces are not calculated for the b2d distance joints. So,
      need these in order to reproduce the behavior of the old cursor strings
      (now springs). These are based on the velocity of the pucks (not
      relative speed as is the case above for damper forces).

      This adds to (vector add using addTo) the puck's sprDamp_force_2d_N
      vector. By the time you've looped through all the springs, you get the
      NET damping force, on each puck COM, applied by all the individual springs.
      This aggregate is reset (zeroed) after the movements are calculated.
      */
      if (this.spo1.constructor.name == "Puck") {
         this.spo1.sprDamp_force_2d_N.addTo( this.spo1.velocity_2d_mps.scaleBy( -1 * this.drag_c));
      }
      if (this.spo2.constructor.name == "Puck") {
         this.spo2.sprDamp_force_2d_N.addTo( this.spo2.velocity_2d_mps.scaleBy( -1 * this.drag_c));
      }
   }
   Spring.prototype.draw = function() {
      if ((this.navigationForNPC && dC.editor.checked) || (!this.visible && dC.editor.checked) || (this.visible && !this.navigationForNPC)) {
         // These two width calculations will cause some discontinuity in how the springs look if they are being
         // length adjusted between zero and non-zero, especially for a puck in gravity on a zero-length spring. It's a compromise.
         if (this.length_m == 0) {
            // This version looks better for zero-length (pinned pucks)
            var width_m = this.unstretched_width_m * (1 - (0.40 * this.p1p2_separation_m));
         } else {
            // This version of the width calculation conserves the area of the spring.
            var width_m = (this.unstretched_width_m * this.length_m) / this.p1p2_separation_m;
         }
         // Prevent the width value from getting too large.
         if (width_m > (3 * this.unstretched_width_m)) width_m = 3 * this.unstretched_width_m;

         var width_px = px_from_meters( width_m);
         if (width_px < 2) width_px = 2;

         if (this.dashedLine) {
            var dashArray = [3];
            // Must use the default 'butt' ends if the lines are dashed.
            // Note: dashed lines require surprising CPU drain.
            var lineCap = 'butt';
         } else {
            var dashArray = [0];
            // If not dashed, you can use the fancy 'round' ends. Nice.
            var lineCap = 'round';
         }

         var fillColor = (ctx.globalCompositeOperation == 'screen') ? 'white' : this.color;
         drawLine(ctx, this.spo1_ap_w_2d_px, this.spo2_ap_w_2d_px,
            {'width_px':width_px, 'color':fillColor, 'dashArray':dashArray, 'alpha':0.7, 'lineCap':lineCap} );
      }
   }



   function Wall( position_2d_m, pars) {
      this.parsAtBirth = pars;
      //this.alsoThese = [];

      if (pars.name) {
         this.name = pars.name;
         // Set nameIndex to the max of the two indexes. Do this to avoid issues related to holes
         // in the name sequence caused by state captures after object deletions. This insures a
         // unique new name for any new wall.
         Wall.nameIndex = Math.max(Wall.nameIndex, Number(this.name.slice(4)));
      } else {
         Wall.nameIndex += 1;
         this.name = 'wall' + Wall.nameIndex;
      }
      //console.log("n-wall = " + Wall.nameIndex);
      aT.wallMap[this.name] = this;

      // Position of Center of Mass (COM)
      this.position_2d_m = Vec2D_check( position_2d_m);
      this.position_2d_px = screenFromWorld( this.position_2d_m);

      this.fence = setDefault( pars.fence, false);

      this.velocity_2d_mps = setDefault( pars.velocity_2d_mps, new Vec2D(0.0, 0.0));
      this.angle_r = setDefault( pars.angle_r, 0.0);
      this.angularSpeed_rps = setDefault( pars.angularSpeed_rps, 0.0);

      // Dimensions (as specified in box2D)
      this.half_width_m  = setDefault( pars.half_width_m , 0.5);
      this.half_height_m = setDefault( pars.half_height_m, 2.5);

      // Calculate these characteristics in screen units (pixels).
      this.half_width_px = px_from_meters( this.half_width_m);
      this.half_height_px = px_from_meters( this.half_height_m);

      this.b2d = null;
      this.create_b2d_wall();
      // Create a reference back to this wall from the b2d wall.
      tableMap.set(this.b2d, this);

      Wall.color_default = "white";
      this.color = setDefault( pars.color, Wall.color_default);

      this.deleted = false;
   }
   Wall.nameIndex = 0;
   Wall.applyToAll = function( doThis) {
      for (var wallName in aT.wallMap) {
         var wall = aT.wallMap[ wallName];
         doThis( wall);
      }
   }
   Wall.deleteAll = function() {
      Wall.applyToAll( wall => {
         tableMap.delete( wall.b2d);
         if (wall.b2d) world.DestroyBody( wall.b2d);
      });
      aT.wallMap = {};
      Wall.nameIndex = 0;
   }
   Wall.prototype.deleteThisOne = function( pars) {
      var deleteMode = setDefault( pars.deleteMode, null);

      // Delete reference in the tableMap.
      tableMap.delete( this.b2d);

      // Delete the corresponding Box2d object.
      world.DestroyBody( this.b2d);

      // Mark this wall as deleted.
      this.deleted = true;

      // Remove this wall from the wall map.
      delete aT.wallMap[ this.name];
      // ...and from the multi-select map.
      hostMSelect.removeOne( this);
   }
   Wall.prototype.copyThisOne = function( pars) {
      var position_2d_m = setDefault( pars.position_2d_m, this.position_2d_m);

      return new Wall( position_2d_m,
                        {'half_width_m':this.half_width_m,
                         'half_height_m':this.half_height_m,
                         'angle_r':this.angle_r,
                         'angularSpeed_rps':this.angularSpeed_rps});
   }
   Wall.prototype.define_fixture = function( pars) {
      this.width_scaling = setDefault( pars.width_scaling, 1.0);
      this.height_scaling = setDefault( pars.height_scaling, 1.0);

      var fixDef = new b2FixtureDef;
      fixDef.shape = new b2PolygonShape;

      // Apply the scaling factors to the current width and height.
      this.half_width_m *= this.width_scaling;
      this.half_height_m *= this.height_scaling;

      this.half_width_px = px_from_meters( this.half_width_m);
      // Don't let it get too skinny because it becomes hard to select.
      if (this.half_width_px < 1) {
         this.half_width_px = 1;
         this.half_width_m = meters_from_px( this.half_width_px);
      }

      this.half_height_px = px_from_meters( this.half_height_m);
      if (this.half_height_px < 1) {
         this.half_height_px = 1;
         this.half_height_m = meters_from_px( this.half_height_px);
      }

      fixDef.shape.SetAsBox(this.half_width_m, this.half_height_m);

      return fixDef;
   }
   Wall.prototype.create_b2d_wall = function() {
      // Create a rectangular and static box2d object.

      var bodyDef = new b2BodyDef;
      bodyDef.type = b2Body.b2_kinematicBody; // b2_kinematicBody b2_staticBody

      this.b2d = world.CreateBody(bodyDef);
      this.b2d.CreateFixture( this.define_fixture({}));

      // Set the state: position and velocity (angle and angular speed).
      this.b2d.SetPosition( this.position_2d_m);
      this.b2d.SetLinearVelocity( this.velocity_2d_mps);
      this.b2d.SetAngle( this.angle_r);
      this.b2d.SetAngularVelocity( this.angularSpeed_rps);
   }
   Wall.prototype.modify_fixture = function( mode) {
      // If you are going to modify the fixture dimensions you have to delete
      // the old one and make a new one. The m_fixtureList linked list always
      // points to the most recent addition to the linked list. If there's only
      // one fixture, then m_fixtureList is a reference to that single fixture.

      var width_factor = 1.0;
      var height_factor = 1.0;

      if (mode == 'wider') {
         width_factor = 1.1;
      } else if (mode == 'thinner') {
         width_factor = 0.9;
      } else if (mode == 'taller') {
         height_factor = 1.1;
      } else if (mode == 'shorter') {
         height_factor = 0.9;
      }

      this.b2d.DestroyFixture( this.b2d.m_fixtureList);
      this.b2d.CreateFixture( this.define_fixture({'width_scaling':width_factor,'height_scaling':height_factor}));
   }
   Wall.prototype.draw_MultiSelectPoint = function() {
      drawCircle( ctx, this.position_2d_px, {'borderColor':'black', 'borderWidth_px':1, 'fillColor':'yellow', 'radius_px':5});
   }
   Wall.prototype.updateState = function() {
      this.angle_r = this.b2d.GetAngle();
   }
   Wall.prototype.draw = function() {
      drawPolygon( ctx, b2d_getPolygonVertices( this.b2d), {'borderColor':this.color, 'borderWidth_px':0, 'fillColor':this.color});
   }



   function RunningAverage( n_target) {
      this.n_target = n_target;
      this.reset();
   }
   RunningAverage.prototype.reset = function() {
      this.n_in_avg = 0;
      this.result = 0.0;
      this.values = [];
      this.total = 0.0;
      this.totalSinceReport = 0.0;
   }
   RunningAverage.prototype.update = function( new_value) {
      // Only process good stuff.
      if (new_value) {
         if (this.n_in_avg < this.n_target) {
            this.total += new_value;
            this.n_in_avg += 1;
         } else {
            // Add the new value and subtract the oldest.
            this.total += new_value - this.values[0];
            // Discard the oldest value.
            this.values.shift();
         }
         this.values.push( new_value);

         this.totalSinceReport += new_value;

         this.result = this.total / this.n_in_avg;
         return this.result;

      } else {
         return new_value;
      }
   }



   function PopSounds() {
      this.low = new Audio("sounds/puckpop_lower.mp3");
      this.high = new Audio("sounds/puckpop.mp3");
   }
   PopSounds.prototype.play = function( pitch) {
      // The play method returns a promise
      var playPromise = this[pitch].play();

      playPromise.then( function() {
         // Sound clip played.
         //console.log('sound worked');
      }).catch( function(error) {
         // Sound clip failed to play.
         //console.log('sound failed');
         helpMessage.newMessage('Popping sounds are disabled until you type or click.\\  Go ahead; interact.', 2.0);
      });
   }



   /////////////////////////////////////////////////////////////////////////////
   ////
   ////  Functions
   ////
   /////////////////////////////////////////////////////////////////////////////

   // Misc utility stuff

   function setDefault( theValue, theDefault) {
      // Return the default if the value is undefined.
      return (typeof theValue !== "undefined") ? theValue : theDefault;
   }

   function pointInCanvas( p_2d_px) {
      var theRectangle = { 'UL_2d':{'x':0,'y':0}, 'LR_2d':{'x':canvas.width,'y':canvas.height} };
      return pointInRectangle( p_2d_px, theRectangle);
   }

   function pointInRectangle( p_2d, rect) {
      // UL: upper left corner, LR: lower right corner.
      if ( (p_2d.x > rect.UL_2d.x) && (p_2d.x < rect.LR_2d.x) && (p_2d.y > rect.UL_2d.y) && (p_2d.y < rect.LR_2d.y) ) {
         return true;
      } else {
         return false;
      }
   }


   // Support for the network client ///////////////////////////////////////////

   function createNetworkClient( pars) {
      var clientName = setDefault( pars.clientName, 'theInvisibleMan');
      // "player" is true/false to indicate if the client is requesting that a player puck be
      // added to the client instance.
      var player = setDefault( pars.player, true);
      var nickName = setDefault( pars.nickName, null);

      var n = clientName.slice(1);
      // Repeat the color index every 10 users (10 colors in Client.colors)
      var colorIndex = n - Math.trunc(n/10)*10;

      var clientPars = {};
      clientPars.player = player;
      clientPars.nickName = nickName;
      clientPars.color = Client.colors[ colorIndex];
      clientPars.name = clientName;

      new Client( clientPars);
   }

   function deleteNetworkClient( clientName) {
      // This function does not directly remove the client socket at the node server, but
      // that does happen at the server...
      if (db.rtc) console.log('in gW.deleteNetworkClient, clientName=' + clientName + ", fileName="+fileName);

      if (clients[clientName]) {
         // If it's driving a puck. First, delete that.
         if (clients[clientName].puck) {
            var thePuck = clients[clientName].puck

            // Remove this puck and do associated clean-up.
            thePuck.jet = null;
            thePuck.gun = null;
            thePuck.shield = null;
            tableMap.delete( thePuck.b2d);
            world.DestroyBody( thePuck.b2d);
            delete aT.puckMap[ thePuck.name];
         }
         deleteRTC_onHost( clientName);
      }
   }

   function deleteRTC_onHost( clientName) {
      if (db.rtc) console.log('in deleteRTC_onHost');

      // Shutdown and nullify any references to the host side of this WebRTC p2p connection.
      if (clients[clientName].rtc) {
         clients[ clientName].rtc.shutdown();
      }

      // Remove the client in the clients map.
      if (clients[clientName]) {
         delete clients[ clientName];
      }
   }

   function deleteRTC_onClientAndHost( clientName) {
      if (db.rtc) console.log('in deleteRTC_onClientAndHost');

      // Remove network clients on the node server.
      // (Note: this is one of the several places where hC is used inside of gW.)
      if (clientName.slice(0,1) == 'u') {
         // Send message to the server and then to the client to disconnect.
         hC.forceClientDisconnect( clientName);
      }

      // Remove the client in the clients map.
      deleteRTC_onHost( clientName);
   }

   function updateClientState( clientName, state) {
      /*
      This is mouse and keyboard input as generated from non-host-client (network)
      events. Note that this can happen at anytime as triggered by events on
      the client. This is not fired each frame.

      Repetition can be an issue here as mouse movement will repeatedly send
      the state. If you want to avoid repeating actions, it may be appropriate
      here to compare the incoming state with the current client state (or
      make use of a key_?_enabled properties) to stop after the first act.
      This blocking of repetition does not necessarily need to happen here.
      For an example of this, search on key_i_enabled.

      It is handy to do the blocking here because you have access to the incoming
      state and don't need the key_?_enabled properties. But for actions that are
      repeating each frame, you need to use the key_?_enabled approach.
      */

      if (clients[ clientName]) {
         var client = clients[ clientName];
         client.mouseX_px = state.mX;
         client.mouseY_px = state.mY;
         client.isMouseDown = state.MD;
         if (client.isMouseDown && pointInCanvas( client.mouse_2d_px)) {
            // If there's been a click inside the canvas area, flag it as mouse usage.
            // Indirectly, this also prevents cell-phone users from getting flagged here unless they
            // touch the canvas before getting into virtual game pad.
            client.mouseUsage = true;
         }
         client.button = state.bu;
         client.mouse_2d_px = new Vec2D(client.mouseX_px, client.mouseY_px);
         client.mouse_2d_m = worldFromScreen( client.mouse_2d_px);

         client.key_a = state.a;
         client.key_s = state.s;  // uses key_s_enabled
         client.key_d = state.d;
         client.key_w = state.w;
         client.key_j = state.j;
         client.key_k = state.k;  // uses key_k_enabled
         client.key_l = state.l;
         client.key_i = state.i;  // uses key_i_enabled

         client.key_space = state.sp;
         client.key_questionMark = state.cl; //cl short for color

         client.key_shift = state.sh;

         // Compare incoming state with the current state. Only act if changing from U to D.
         if ((state['1'] == "D") && (client.key_1 == "U")) demoStart(1);
         client.key_1 = state['1'];

         if ((state['2'] == "D") && (client.key_2 == "U")) demoStart(2);
         client.key_2 = state['2'];

         if ((state['3'] == "D") && (client.key_3 == "U")) demoStart(3);
         client.key_3 = state['3'];

         if ((state['4'] == "D") && (client.key_4 == "U")) demoStart(4);
         client.key_4 = state['4'];

         if ((state['5'] == "D") && (client.key_5 == "U")) demoStart(5);
         client.key_5 = state['5'];

         if ((state['6'] == "D") && (client.key_6 == "U")) demoStart(6);
         client.key_6 = state['6'];

         if ((state['7'] == "D") && (client.key_7 == "U")) demoStart(7);
         client.key_7 = state['7'];

         if ((state['8'] == "D") && (client.key_8 == "U")) demoStart(8);
         client.key_8 = state['8'];

         if ((state['9'] == "D") && (client.key_9 == "U")) demoStart(9);
         client.key_9 = state['9'];

         if ((state['f'] == "D") && (client.key_f == "U")) freeze();
         client.key_f = state['f'];

         // Specific angle being sent from client in TwoThumbs mode.
         if (client.puck && state['jet_d']) {
            client.puck.jet.rotateTubeAndJetToAngle( state['jet_d']);
         }
         if (client.puck && state['gun_d']) {
            client.puck.gun.rel_position_2d_m.set_angle( state['gun_d']);
            // Flag this client as using the virtual game pad during this game.
            client.twoThumbs = true;
         }

         // Special Two Thumbs controls.
         if (client.puck) {
            // Jet throttle
            client.puck.jet.throttle = state['jet_t'];

            // Gun Scope: rotation rate fraction   and   firing trigger
            // Freeze the puck at the first press of the scope trigger or rotator. If external forces
            // move the puck after this freeze event, so be it.
            if ((client.puck.gun.scopeTrigger == 'U')     && (state['ScTr']  == 'D') ||
                (client.puck.gun.scopeRotRateFrac == 0.0) && (state['ScRrf'] != 0.0)) {

               // Check if it's moving before breaking (and drawing the break circle).
               var v_2d_mps = client.puck.velocity_2d_mps;
               if ((Math.abs( v_2d_mps.x) > 0) || (Math.abs( v_2d_mps.y) > 0)) {
                  client.puck.b2d.SetLinearVelocity( new b2Vec2(0.0,0.0));
                  client.puck.gun.scopeBreak = true;
               }
            }
            client.puck.gun.scopeRotRateFrac = state['ScRrf'];
            client.puck.gun.scopeTrigger = state['ScTr'];
         }
         /*
         var stateString = "";
         for (var key in state) stateString += key + ":" + state[ key] + ",";
         console.log("stateString=" + stateString);
         */
      }
   }


   // box2d functions to interact with the engine //////////////////////////////

   function b2d_getBodyAt( mousePVec_2d_m) {
      var x = mousePVec_2d_m.x;
      var y = mousePVec_2d_m.y;
      var aabb = new b2AABB();
      var size_m = 0.001;
      aabb.lowerBound.Set(x - size_m, y - size_m);
      aabb.upperBound.Set(x + size_m, y + size_m);

      // Query the world for overlapping bodies. Where the body's bounding box overlaps
      // with the aabb box defined above. Run the function provided to QueryAABB for each
      // body found to overlap the aabb box.

      var selectedBody = null;
      world.QueryAABB( function( fixture) {
         // Don't consider any static bodies or cursor pins.
         if ((fixture.GetBody().GetType() != b2Body.b2_staticBody) && (!tableMap.get( fixture.GetBody()).cursorPin)) {
            // Take the first fixture where this point can be found locally on it.
            if (fixture.GetShape().TestPoint(fixture.GetBody().GetTransform(), mousePVec_2d_m)) {
               selectedBody = fixture.GetBody();
               return false; // stop checking the query results
            }
         }
         // return true to continue checking at the rest of the fixtures returned by the query
         return true;
      }, aabb);
      return selectedBody;
   }

   function b2d_getPolygonVertices( b2d_body) {
      // Make an array that has the world vertices scaled to screen coordinates.
      var poly_px = [];
      for (var i = 0; i < b2d_body.m_fixtureList.m_shape.m_vertices.length; i++) {
         var p_2d_px = screenFromWorld( b2d_body.GetWorldPoint( b2d_body.m_fixtureList.m_shape.m_vertices[i]));
         poly_px.push( p_2d_px);
      }
      return poly_px;
   }


   // Relationships between the screen and the b2d world ///////////////////////

   // Scaler conversions
   function meters_from_px( length_px) {
      return length_px / px_per_m;
   }

   function px_from_meters( length_m) {
      return Math.round(length_m * px_per_m);
   }

   // Vector conversions.
   function screenFromWorld( position_2d_m) {
      var x_px = px_from_meters( position_2d_m.x);
      var y_px = px_from_meters( position_2d_m.y);
      return new Vec2D( x_px, canvas.height - y_px);
   }

   function worldFromScreen( position_2d_px) {
      var x_m = meters_from_px(                 position_2d_px.x);
      var y_m = meters_from_px( canvas.height - position_2d_px.y);
      return new Vec2D( x_m, y_m);
   }

   // Convert raw mouse value into the coordinates of the imaging element (iE), like the canvas for example.
   // ...and then nudge it a little to make our mouse tip align with the Windows' mouse tip.
   function screenFromRaw_2d_px( imagingElement, raw_2d_px) {
      var mouse_iE_2d_px = new Vec2D(0, 0);
      mouse_iE_2d_px.x = raw_2d_px.x - imagingElement.getBoundingClientRect().left - 5;
      mouse_iE_2d_px.y = raw_2d_px.y - imagingElement.getBoundingClientRect().top - 4;
      return mouse_iE_2d_px;
   }

   // Functions to convert between vector types
   function Vec2D_from_b2Vec2( b2Vector) {
      return new Vec2D( b2Vector.x, b2Vector.y);
   }
   function b2Vec2_from_Vec2D( vec2D) {
      return new b2Vec2( vec2D.x, vec2D.y);
   }

   // This check is useful to prevent problems (objects stripped of their methods) when reconstructing from a
   // JSON capture.
   function Vec2D_check( vector_2d) {
      if (vector_2d.constructor.name == "Vec2D") {
         return vector_2d;
      } else {
         return new Vec2D( vector_2d.x, vector_2d.y);
      }
   }


   // High-level functions for drawing to the Canvas

   function drawLine( canvas_2d, p1_2d_px, p2_2d_px, pars) {
     /*
      canvas_2d.strokeStyle = setDefault( pars.color, 'white');
      canvas_2d.lineWidth = setDefault( pars.width_px, 2);
      var dashArray = setDefault( pars.dashArray, [0]);
      var alpha = setDefault( pars.alpha, 1.0);
      var lineCap = setDefault( pars.lineCap, 'butt');

      canvas_2d.globalAlpha = alpha;
      canvas_2d.setLineDash( dashArray);
      canvas_2d.lineCap = lineCap;

      canvas_2d.beginPath();

      canvas_2d.moveTo(p1_2d_px.x, p1_2d_px.y);
      canvas_2d.lineTo(p2_2d_px.x, p2_2d_px.y);

      canvas_2d.stroke();
      canvas_2d.globalAlpha = 1.0;
      canvas_2d.lineCap = 'butt';*/
   }

   function drawCircle( canvas_2d, center_2d_px, pars) {
     /*
      var radius_px = setDefault( pars.radius_px, 6);
      canvas_2d.strokeStyle = setDefault( pars.borderColor, 'white');
      canvas_2d.lineWidth = setDefault( pars.borderWidth_px, 2);
      var fillColor = setDefault( pars.fillColor, 'red');
      var dashArray = setDefault( pars.dashArray, [0]);

      canvas_2d.setLineDash( dashArray);

      canvas_2d.beginPath();

      canvas_2d.arc(center_2d_px.x, center_2d_px.y, radius_px, 0, 2 * Math.PI);

      if (fillColor != 'noFill') {
         canvas_2d.fillStyle = fillColor;
         canvas_2d.fill();
      }
      if (pars.borderWidth_px > 0) {
         canvas_2d.stroke();
      }

      // Turn off the dashes
      canvas_2d.setLineDash([0]);*/
   }

   function drawPolygon( canvas_2d, poly_px, pars) {
     /*
      canvas_2d.strokeStyle = setDefault( pars.borderColor, 'white');
      canvas_2d.lineWidth = setDefault( pars.borderWidth_px, 2);
      canvas_2d.fillStyle = setDefault( pars.fillColor,  'red');
      var fillIt = setDefault( pars.fillIt, true);

      canvas_2d.setLineDash([0]);

      canvas_2d.beginPath();

      canvas_2d.moveTo(poly_px[0].x, poly_px[0].y);
      for (var i = 1, len = poly_px.length; i < len; i++) {
         canvas_2d.lineTo(poly_px[i].x, poly_px[i].y);
      }
      //canvas_2d.lineTo(poly_px[0].x, poly_px[0].y);

      canvas_2d.closePath();
      if (fillIt) canvas_2d.fill();
      canvas_2d.stroke();*/
   }


   // Functions called by the buttons //////////////////////////////////////////

   function toggleMultiplayerStuff() {
      // This double toggle has the effect of switching between the following two divs.
      toggleElementDisplay("multiPlayer", "table-cell");
      toggleElementDisplay("ttcIntro", "table-cell");

      // This toggles (displays/hides) the client links.
      toggleElementDisplay("clientLinks", "inline");
   }

   function toggleElementDisplay( id, displayStyle) {
      var e = document.getElementById( id);
      // Use ternary operator (?):   condition ? expr1 : expr2
      // If the current style isn't equal to the incoming displayStyle, set it to be displayStyle.
      // If it is equal, set it to 'none'. When the value is 'none', the element is hidden.
      // The effect of this function is that repeated calls to it, with the same displayStyle value, will
      // toggle the style between 'none' and the specified style value.
      e.style.display = (e.style.display != displayStyle) ? displayStyle : 'none';
   }
   function setElementDisplay( id, displayStyle) {
      var e = document.getElementById( id);
      e.style.display = displayStyle;
   }

   function toggleSpanValue( id, value1, value2) {
      var e = document.getElementById( id);
      e.innerText = (e.innerText == value1) ? value2 : value1;
   }

   function getSpanValue( id) {
      var e = document.getElementById( id);
      return e.innerText;
   }

   function resetFenceColor( newColor) {
      Wall.applyToAll( wall => {
         if (wall.fence) {
            wall.color = newColor;
            wall.draw();
         }
      });
   }

   function fenceIsClientColor( clientName) {
      var theyMatch = true;
      Wall.applyToAll( wall => {
         if (wall.fence) {
            if (wall.color != clients[clientName].color) {
                  theyMatch = false;
            }
         }
      });
      return theyMatch;
   }

   function setPauseState( e) {
      // Make the pause state agree with the check box.
      if (dC.pause.checked) {
         stopit();
         setElementDisplay("fps_wrapper", "none");
         setElementDisplay("stepper_wrapper", "inline");
      } else {
         startit();
         c.singleStep = false;
         setElementDisplay("fps_wrapper", "inline");
         setElementDisplay("stepper_wrapper", "none");
      }
   }

   function startit() {
      // Only start a game loop if there is no game loop running.
      if (myRequest === null) {
         resetFenceColor( "white");
         if (!c.singleStep) dC.pause.checked = false;

         // Start the game loop.
         myRequest = window.requestAnimationFrame( gameLoop);
      }
   }

   function stopit() {
      resetFenceColor( "red");
      aT.dt_RA_ms.reset();
      dC.fps.innerHTML = '0';

      window.cancelAnimationFrame( myRequest);
      myRequest = null;
      resumingAfterPause = true;
   }

   function stepAnimation() {
      dC.pause.checked = true;
      // Set flag to allow only one step.
      c.singleStep = true;
      startit();
   }

   function setFrameRateBasedOnDisplayRate() {
      console.log("fps=" + dC.fps.innerHTML);
      var current_fps = dC.fps.innerHTML;
      var fps_choices = [60,85,100,120,144,240];
      var min_diff = 1000;
      var min_diff_index = null;
      var len = fps_choices.length;
      for (var i = 0; i < len; i++) {
         var diff = Math.abs( fps_choices[i] - current_fps);
         if (diff < min_diff) {
            min_diff = diff;
            min_diff_index = i;
         }
      }
      var bestMatch = fps_choices[ min_diff_index];
      // Set the value in the pulldown control.
      $('#FrameRate').val( bestMatch);
      setFrameRate();
   }

   function setFrameRate() {
      var frameRate = $('#FrameRate').val();
      if (frameRate != 'float') {
         c.frameRate = frameRate;
         c.deltaT_s = 1.0 / frameRate;
         c.dtFloating = false;

         // experiment with setting puck tail length for each frame rate
         var tail_length = {30:25, 60:25, 85:25 ,100:25 ,120:25, 144:25};
         Puck.applyToAll( puck => {
            if (puck.tail) puck.tail.length_limit = tail_length[ frameRate];
         });

      } else {
         c.dtFloating = true;
      }
   }

   function freeze() {
      Puck.applyToAll( puck => puck.b2d.SetLinearVelocity( new b2Vec2(0.0,0.0)) );
   }
   function stopRotation() {
      Puck.applyToAll( puck => puck.b2d.SetAngularVelocity( 0.0) );
   }
   function reverseDirection() {
      Puck.applyToAll( puck => {
         puck.b2d.SetAngularVelocity( -1 * puck.angularSpeed_rps);
         puck.b2d.SetLinearVelocity( b2Vec2_from_Vec2D( puck.velocity_2d_mps.scaleBy( -1)) );
      });
   }


   function json_scrubber( key, value) {
      /*
      Use this function to exclude the b2d objects in the stringify process.
      Apparently the b2d and rtc objects have circular references that
      stringify doesn't like. So have to regenerate the b2d objects in the
      demo area when the json capture is restored.

      Also have to avoid the client related addons: jet, gun, and shield.
      These have references back their pucks, this too causes circular issues
      for stringify.

      Also remove keys like spo1 and spo2 (in Springs object) mainly to keep
      the wordiness down; many keys are not needed in the reconstruction
      process.

      So be careful here: any key with a name in the OR list of json_scrubber
      (see if block below) will be excluded from the capture.
      */
      if ( (key == 'b2d') || (key == 'rtc') ||
           (key == 'jet') || (key == 'gun') || (key == 'shield') ||
           (key == 'spo1') || (key == 'spo2') ||
           (key == 'parsAtBirth') ||
           (key == 'cursorString_puckDrag_force_2d_N') || (key == 'cursorString_spring_force_2d_N') ||
           (key == 'puck') || (key.includes('key_')) || (key.includes('_scaling')) || (key.includes('selectionPoint')) ||
           (key == 'position_2d_px') || (key == 'nonCOM_2d_N') ) {
         return undefined;
      } else {
         return value;
      }
   }

   function saveState( dataForCleaning = null) {
      var timeString = new Date();
      if (dataForCleaning) {
         if ( ! (dataForCleaning.startingPosAndVels)) dataForCleaning.startingPosAndVels = null;
         var tableState = {'demoIndex':dataForCleaning.demoIndex,
                           'demoVersion':dataForCleaning.demoVersion,
                           'date':timeString.toLocaleString(),
                           'gravity':dataForCleaning.gravity,
                           'globalCompositeOperation':dataForCleaning.globalCompositeOperation,
                           'wallMapData':dataForCleaning.wallMapData,
                           'puckMapData':dataForCleaning.puckMapData,
                           'pinMapData':dataForCleaning.pinMapData,
                           'springMapData':dataForCleaning.springMapData,
                           'startingPosAndVels':dataForCleaning.startingPosAndVels,
                           'clients':dataForCleaning.clients};
      } else {
         c.demoVersion = c.demoVersion + '.' + Math.floor((Math.random() * 1000) + 1);
         var tableState = {'demoIndex':c.demoIndex,
                           'demoVersion':c.demoVersion,
                           'date':timeString.toLocaleString(),
                           'gravity':c.g_ON,
                           'globalCompositeOperation':ctx.globalCompositeOperation,
                           'wallMapData':aT.wallMap,
                           'puckMapData':aT.puckMap,
                           'pinMapData':aT.pinMap,
                           'springMapData':aT.springMap,
                           'startingPosAndVels':c.startingPosAndVels,
                           'clients':clients};
      }

      // See comments in the json_scrubber function above.
      var table_JSON = JSON.stringify( tableState, json_scrubber, 3);

      // Parsing after JSON.stringify makes a deep copy, with no references back to the original objects. So can delete stuff without
      // mangling the current running demo.
      var tableState_copy = JSON.parse( table_JSON);

      // Remove some non-editable puck keys.
      var generalPuckKeys = ['tail','age_ms','radius_px'];
      var simplePuckKeys =  ['rayCast_init_deg','rayRotationRate_dps','rayCastLineLength_m',
                             'disableJet','noRecoil','bulletAgeLimit_ms','bullet_restitution',
                             'sprDamp_force_2d_N','springOnly_force_2d_N','jet_force_2d_N','impulse_2d_Ns','navSpringOnly_force_2d_N',
                             'poorHealthFraction','whoShotBullet','flash','inComing','flashCount',
                             'hitCount','deleted','clientNameOfShooter','age_ms'];
      for (var p_key in tableState_copy.puckMapData) {
         var puck = tableState_copy.puckMapData[ p_key];
         // All pucks.
         for (var key of generalPuckKeys) {
            delete puck[ key];
         }
         // Simple pucks (no client controls)
         if (!puck.clientName) {
            for (var key of simplePuckKeys) {
               delete puck[ key];
            }
         }
      }

      // Remove some non-editable pin keys.
      var pinKeys = ['radius_m'];
      for (var pin_key in tableState_copy.pinMapData) {
         var pin = tableState_copy.pinMapData[ pin_key];
         for (var key of pinKeys) {
            delete pin[ key];
         }
      }

      // Remove some non-editable wall keys.
      var wallKeys = ['color','deleted','half_height_px','half_width_px'];
      for (var wall_key in tableState_copy.wallMapData) {
         var wall = tableState_copy.wallMapData[ wall_key];
         for (var key of wallKeys) {
            delete wall[ key];
         }
      }

      // Remove some non-editable spring keys.
      var springKeys = ['p1p2_separation_2d_m','p1p2_separation_m','p1p2_normalized_2d','spo1_ap_w_2d_px','spo2_ap_w_2d_px'];
      for (var spring_key in tableState_copy.springMapData) {
         var spring = tableState_copy.springMapData[ spring_key];
         for (var key of springKeys) {
            delete spring[ key];
         }
      }

      // For client objects, clean off all keys EXCEPT these (i.e. SAVE these):
      var saveTheseClientKeys = ['color','name','player','nickName','NPC_pin_timer_s','NPC_pin_timer_limit_s'];
      for (var client_key in tableState_copy.clients) {
         var client = tableState_copy.clients[ client_key];
         if (client.name.slice(0,1) == 'u') {
            // Delete network clients...
            delete tableState_copy.clients[ client_key];
         } else {
            // Clean-up everyone else.
            for (var clientKey in client) {
               if ( ! saveTheseClientKeys.includes( clientKey)) {
                  delete client[ clientKey];
               }
            }
         }
      }

      // Exit if state data was passed in to be cleaned.
      if (dataForCleaning) return tableState_copy;
      //----------------------------------------------------------------------

      // Once again, put it in a string...
      table_JSON = JSON.stringify( tableState_copy, null, 3);

      // Write the json string to this visible input field.
      dC.json.value = table_JSON;
      // Wait 0.5 seconds, then scroll the input field to the top.
      window.setTimeout( function() { scrollCaptureArea();}, 500);

      // Select, copy to clipboard, and then remove focus from the input field.
      dC.json.select();
      document.execCommand('copy');
      window.getSelection().removeAllRanges(); // this is necessary for the blur method to work in MS Edge.
      dC.json.blur();
   }

   function clearState() {
      dC.json.value = '';
   }

   function cleanCapture() {
      // Clean up an old capture
      // This can be run from a hidden button (to the right of the clear button) on the index page.
      if (c.demoVersion == '8.a') {
         var state_data = demo_8_fromFile;
      } else if (c.demoVersion == '6.a') {
         var state_data = demo_6_fromFile;
      } else {
         if (dC.json.value != "") {
            var state_data = JSON.parse( dC.json.value);
         } else {
            console.log('no capture to clean');
            return;
         }
      }

      // first, process (clean) the capture with saveState
      state_data = saveState( state_data);

      // Special loop for pucks.
      for (var p_key in state_data.puckMapData) {
         var puck = state_data.puckMapData[ p_key];

         if (puck.clientName) {
            puck.groupIndex = -puck.name.slice(4) - 1000;
         } else {
            if ((state_data.demoVersion == '3.b') || (state_data.demoVersion == '3.c')) {
               // leave these alone...
            } else {
               puck.groupIndex = 0;
            }
         }
      }

      // For all the maps.
      var mapList = ['puckMapData','pinMapData','springMapData','wallMapData','clients'];
      for (var map of mapList) {
         for (var key in state_data[ map]) {
            var element = state_data[ map][ key];

            delete element['parsAtBirth'];
            delete element['alsoThese'];
            delete element['cursorString_puckDrag_force_2d_N'];
            delete element['cursorString_spring_force_2d_N'];
            delete element['popsound'];

            // Put the alsoThese key at the beginning of the object. Commented this
            // out for now. Could be useful if want to force an attribute to be recognized
            // in the capture.
            //state_data[ map][ key] = Object.assign({'alsoThese':[]}, element);
         }
      }

      dC.json.value = JSON.stringify( state_data, null, 3);

      // Select, copy to clipboard, and then remove focus from the input field.
      dC.json.select();
      document.execCommand('copy');
      window.getSelection().removeAllRanges(); // this is necessary for the blur method to work in MS Edge.
      dC.json.blur();
   }

   function newBirth( captureObj, type) {
      // Update the birth object (based on the capture state) and use it for restoration.
      var newBirthState = {}, par_list;

      // If there's a parameter that is getting into the capture but should be blocked in the birth process:
      var forgetList = {
         'puck': ['position_2d_m','velocity_2d_mps'], // These are explicitly passed to constructor via arguments (so not needed in birth object)
         'wall': ['position_2d_m'],  // Position is passed via arguments. Velocity can be specified in birth object.
         'pin':  ['position_2d_m'],  // Position is passed via arguments. Velocity can be specified in birth object.
         's':    [],
         'NPC':  []
      };
      for (var birthParm in captureObj) {
         if (!forgetList[ type].includes( birthParm)) {
            newBirthState[ birthParm] = captureObj[ birthParm];
         }
      }

      // For all types, override the default naming process, specify a name in the birth parameters. This gives
      // the new object the name used in the capture object. This is needed in reconstructing
      // springs (that use the original puck name). This is also needed if pucks are
      // deleted in a jello matrix.
      if (captureObj.name) {
         newBirthState.name = captureObj.name;
      }
      return newBirthState;
   }

   function restoreFromState( state_data) {
      try {
         restoreFromState_main( state_data);
      } catch (err) {
         stopit();
         window.alert(c.demoVersion +
                     "\nUnable to restore this capture. " +
                     "\n   Looks like you've been boldly editing the JSON text. Good try!" +
                     "\n   Please refine your edits or start from a new capture." +
                     "\n" +
                     "\n" + err.name +
                     "\nmessage:  " + err.message);
         //clearState();  // clear out the JSON text in the capture cell.
         demoStart(0); // c.demoIndex
      }
   }

   function restoreFromState_main( state_data) {
      // Environmental parameters...
      if (state_data.globalCompositeOperation) {
         ctx.globalCompositeOperation = state_data.globalCompositeOperation;
      } else {
         ctx.globalCompositeOperation = 'source-over';
      }

      if (typeof state_data.demoVersion !== "undefined") {
         c.demoVersion = state_data.demoVersion;
      }

      // Rebuild the walls from the capture data.
      for (var wallName in state_data.wallMapData) {
         // wall is one specific wall (from the captured state)
         var wall = state_data.wallMapData[ wallName];
         // Create the new Wall and add it to the wallMap (via its constructor).
         new Wall( wall.position_2d_m, newBirth( wall, 'wall'));
      }

      // NPC clients...
      for (var clientName in state_data.clients) {
         var client = state_data.clients[ clientName];
         if (clientName.slice(0,3) == 'NPC') {
            new Client( newBirth( client, 'NPC'));
         }
      }

      // Rebuild the pins.
      for (var pinName in state_data.pinMapData) {
         // "pin" is one pin (captured state)
         var pin = state_data.pinMapData[ pinName];
         // Create the new Pin and add it to the pinMap (via its constructor).
         new Pin( pin.position_2d_m, newBirth( pin, 'pin'));
      }

      // Rebuild the pucks (and the puck map).
      var localHostPuckName = null;
      for (var p_key in state_data.puckMapData) {
         // puck is a single puck (captured state)
         var puck = state_data.puckMapData[ p_key];

         // If there's a puck for the local host, record the name for use in returning a puck template.
         if (puck.clientName == 'local') localHostPuckName = puck.name;

         // Now create the puck and give it the old name (see the end of the newBirth function).
         // The "Host player" option must be checked to enable the creation of a puck for the local client.
         // Network-client pucks are not recreation here (because it depends on active network clients for assignment).
         if ( (!puck.bullet) &&                                               // NOT a bullet   AND
              ( (puck.clientName == null) ||                                  // (Regular puck  OR
                (puck.clientName.slice(0,3) == 'NPC') ||                      //  Drone puck    OR
                ((puck.clientName == 'local') && (dC.player.checked)) ) ) {   //  Local host and puck requested)

            if ( (puck.clientName) && (!(clients[ puck.clientName])) ) {
               console.log('WARNING: Attempting to restore a puck that has a client name, but that client does not exist.');
            } else {
               var newPuck = new Puck( puck.position_2d_m, puck.velocity_2d_mps, newBirth( puck, 'puck'));
               if (puck.jello) aT.jelloPucks.push( newPuck);
            }
         }
      }

      // Rebuild the spring.
      for (var springName in state_data.springMapData) {
         var theSpring = state_data.springMapData[ springName];

         // Don't try and restore navigation springs. Those are created
         // when the NPC pucks are restored.
         if (!theSpring.navigationForNPC) {
            var p1_type = theSpring.p1_name.slice(0,3);
            if (p1_type == "pin") {
               var p1 = aT.pinMap[ theSpring.p1_name];
            } else {
               var p1 = aT.puckMap[ theSpring.p1_name];
            }

            var p2_type = theSpring.p2_name.slice(0,3);
            if (p2_type == "pin") {
               var p2 = aT.pinMap[ theSpring.p2_name];
            } else {
               var p2 = aT.puckMap[ theSpring.p2_name];
            }

            if ((p1) && (p2)) {
               new Spring(p1, p2, newBirth( theSpring, 's'));
            } else {
               console.log('WARNING: Attempting to rebuild a spring with one or both connected objects missing.');
            }

         }
      }
      // Have this at the end because need the objects instantiated before setting the restitution values
      // in the pucks (side effect of setGravityRelatedParameters)
      c.g_ON = state_data.gravity;
      dC.gravity.checked = c.g_ON;
      setGravityRelatedParameters({});

      return state_data.puckMapData[ localHostPuckName];
   }



   // Functions in support of the demos ////////////////////////////////////////

   function scrollDemoHelp( targetID) {
      var container = $('#helpScroller');
      var scrollTo  = $(targetID);
      var tweak_px = -6;
      /*
      console.log('--------');
      console.log('scrollTo.offset().top: '  + scrollTo.offset().top);
      console.log('container.offset().top: ' + container.offset().top);
      console.log('container.scrollTop(): '  + container.scrollTop());
      console.log('tweak_px: '               + tweak_px);
      */
      container.animate( {scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop() + tweak_px}, 500 );
   }

   function scrollCaptureArea() {
      dC.json.scrollTop = 30;
      dC.json.scrollLeft = 130;
   }

   // Editor help toggle
   function openDemoHelp() {
      // Not using this anymore. A bit confusing. Might bring it back.

      if (dC.multiplayer.checked) {
         dC.multiplayer.checked = !dC.multiplayer.checked;
         toggleMultiplayerStuff();
      }

      toggleElementDisplay('outline1','block');

      toggleSpanValue('moreOrLess','More','Less');
      toggleSpanValue('moreOrLess2','More','Less');

      scrollDemoHelp('#editorMark');
   }

   function resetRestitutionAndFrictionParameters() {
      c.restitution_gOn = c.restitution_default_gOn;
      c.friction_gOn = c.friction_default_gOn;

      c.restitution_gOff = c.restitution_default_gOff;
      c.friction_gOff = c.friction_default_gOff;
   }

   function setGravityRelatedParameters( pars) {
      var showMessage = setDefault( pars.showMessage, false);

      if (c.g_ON) {
         // Box2D velocityThreshold setting is needed for settling stacks of pucks.
         Box2D.Common.b2Settings.b2_velocityThreshold = 1.0;
         g_2d_mps2 = new Vec2D(0.0, -g_mps2); // module-level
         var restitution = c.restitution_gOn;
         var friction =    c.friction_gOn;
      } else {
         // But here, with no gravity, it's better to turn the velocityThreshold setting off
         // so pucks don't stick to walls.
         Box2D.Common.b2Settings.b2_velocityThreshold = 0.0;
         g_2d_mps2 = new Vec2D(0.0, 0.0); // module-level
         var restitution = c.restitution_gOff;
         var friction =    c.friction_gOff;
      }
      if (showMessage) {
         helpMessage.newMessage('Gravity = ' + g_2d_mps2.y, 1.0);
      }

      // If there are some existing pucks on the table:
      // If not fixed, set restitution and friction properties.
      Puck.applyToAll( puck => {
         if (!puck.restitution_fixed) {
            puck.b2d.m_fixtureList.m_restitution = restitution;
            puck.restitution = restitution;
         }
         if (!puck.friction_fixed) {
            puck.b2d.m_fixtureList.m_friction    = friction;
            puck.friction = friction;
         }
         //console.log(puck.name + ',rest,fric = ' + puck.restitution + puck.restitution_fixed + "," + puck.friction + puck.friction_fixed);
      });
   }

   function make_fence(pars = {}) {
      // Build perimeter fence (4 walls) using the canvas dimensions.

      var width_m  = meters_from_px( canvas.width );
      var half_width_m = width_m / 2.0;

      var height_m = meters_from_px( canvas.height);
      var half_height_m = height_m / 2.0;

      var wall_thickness_m = 0.10;

      var pull_in_m = 0.0;

      // Handy way to produce a half fence (hF) for use in video intros...
      var hF = setDefault( pars.hF, false);

      var short_wide_dimensions  = {'fence':true, 'half_width_m':half_width_m,         'half_height_m':wall_thickness_m/2.0};
      var tall_skinny_dimensions = {'fence':true, 'half_width_m':wall_thickness_m/2.0, 'half_height_m':half_height_m};

      // Add four bumper walls to the table.
      // top
      if (!hF) new Wall( new Vec2D( half_width_m, height_m - pull_in_m), short_wide_dimensions);
      // bottom
      new Wall( new Vec2D( half_width_m,     0.00 + pull_in_m), short_wide_dimensions);
      // left
      new Wall( new Vec2D(    0.00 + pull_in_m, half_height_m), tall_skinny_dimensions);
      // right
      if (!hF) new Wall( new Vec2D( width_m - pull_in_m, half_height_m), tall_skinny_dimensions);
   }

   function em( px) {
      // Convert to em units based on a font-size of 16px.
      return px/16.0;
   }

   function getChatLayoutState() {
      // This (exposed) function is needed to share this parameter with the other module.
      return c.chatLayoutState;
   }

   function adjustSizeOfChatDiv( mode) {
      // Input fields
      dC.nodeServer = document.getElementById('nodeServer');
      dC.roomName = document.getElementById('roomName');
      dC.inputField = document.getElementById('inputField');

      dC.connectionCanvas = document.getElementById('connectionCanvas');

      // The two divs that toggle
      dC.multiPlayer = document.getElementById('multiPlayer');
      dC.ttcIntro = document.getElementById('ttcIntro');

      var divW_Large = em(540);
      var divW_Small = em(540-118);

      var tweek = -8;
      var nodeServer_Large = em(332+tweek);
      var roomName_Large   = em( 70+0);
      var inputField_Large = em(527+tweek);
      var connectionCanvas_Large_px = 518 + tweek;

      var shrink_px = 141;
      var shrink = em( shrink_px);

      var nodeServer_Small = nodeServer_Large - shrink;
      var roomName_Small   = roomName_Large   -  em(0);
      var inputField_Small = inputField_Large - shrink;
      var connectionCanvas_Small_px = connectionCanvas_Large_px - 117;

      if (mode == 'small') {
         dC.nodeServer.style.width = (nodeServer_Small) + 'em';
         dC.roomName.style.width   = (roomName_Small  ) + 'em';
         dC.inputField.style.width = (inputField_Small) + 'em';
         // The connectionCanvas is only on the client. So check here before the resize attempt.
         if (dC.connectionCanvas) {
            dC.connectionCanvas.width = connectionCanvas_Small_px;
            dC.connectionCanvas.height = 15;
            hC.refresh_P2P_indicator({'mode':'p2p'});
         }

         dC.ttcIntro.style.maxWidth    = divW_Small + 'em';
         dC.ttcIntro.style.minWidth    = divW_Small + 'em';

         dC.multiPlayer.style.maxWidth = divW_Small + 'em';
         dC.multiPlayer.style.minWidth = divW_Small + 'em';

      } else {
         dC.nodeServer.style.width = (nodeServer_Large) + 'em';
         dC.roomName.style.width   = (roomName_Large  ) + 'em';
         dC.inputField.style.width = (inputField_Large) + 'em';
         if (dC.connectionCanvas) {
            dC.connectionCanvas.width = connectionCanvas_Large_px;
            dC.connectionCanvas.height = 15;
            hC.refresh_P2P_indicator({'mode':'p2p'});
         }

         dC.ttcIntro.style.maxWidth    = divW_Large + 'em';
         dC.ttcIntro.style.minWidth    = divW_Large + 'em';

         dC.multiPlayer.style.maxWidth = divW_Large + 'em';
         dC.multiPlayer.style.minWidth = divW_Large + 'em';
      }
   }

   function makeJello( pars) {
      var pinned = setDefault( pars.pinned, false);
      var gridsize = setDefault( pars.gridsize, 4);

      var offset_2d_m = new Vec2D(2.0, 2.0);

      var spacing_factor_m = 0.9;

      var v_init_2d_mps = new Vec2D(0.0, 0.0);

      var puckParms = {'radius_m':0.20, 'density':5.0, 'jello':true};

      var springParms = {
         'unstretched_width_m': 0.07,
         'strength_Npm': 350.0,
         'length_m': spacing_factor_m * 1.0,
         'damper_Ns2pm2': 5.0};

      // Grid of pucks.
      for (var j = 0; j < gridsize; j++) {
         for (var k = 0; k < gridsize; k++) {
            if ((j==2) && (k==2)) {
               puckParms.color = "orange";
            } else {
               puckParms.color = undefined;  // use default
            }
            var pos_2d_m = new Vec2D( spacing_factor_m * j, spacing_factor_m * k);
            pos_2d_m.addTo( offset_2d_m);
            aT.jelloPucks.push( new Puck( Object.assign({}, pos_2d_m), Object.assign({}, v_init_2d_mps), Object.assign({}, puckParms)));
         }
      }
      // Horizontal springs (between neighbors)
      for (var m = 0; m < gridsize*(gridsize-1); m++) {
         springParms.color = "blue";
         // Note: Object.assign is used here to make a copy of the springParms object (mutable). This avoids the multiple reference to springParms
         // and any associated mutation side effects (from this and the following color changes) when the state is captured.
         new Spring(aT.jelloPucks[m], aT.jelloPucks[m+gridsize], Object.assign({}, springParms));
      }
      // Vertical springs
      for (var m = 0; m < gridsize-1; m++) {
         for (var n = 0; n < gridsize; n++) {
            var o_index = m + (n * gridsize);
            springParms.color = "blue";
            new Spring(aT.jelloPucks[o_index], aT.jelloPucks[o_index+1], Object.assign({}, springParms));
         }
      }
      // Diagonal springs (yellow)
      for (var m = 0; m < gridsize-1; m++) {
         for (var n = 1; n < gridsize; n++) {
            var o_index = m + (n * gridsize);
            springParms.color = "yellow";
            springParms.length_m = spacing_factor_m * 1.41;  // A diagonal
            new Spring(aT.jelloPucks[o_index], aT.jelloPucks[o_index-(gridsize-1)], Object.assign({}, springParms));
         }
      }
      // Diagonal springs (perpendicular to the other diagonals)
      for (var m = 0; m < gridsize-1; m++) {
         for (var n = 0; n < gridsize-1; n++) {
            var o_index = m + (n * gridsize);
            springParms.color = "yellow";
            springParms.length_m = spacing_factor_m * 1.41; // A diagonal
            new Spring(aT.jelloPucks[o_index], aT.jelloPucks[o_index+(gridsize+1)], Object.assign({}, springParms));
         }
      }

      // Add two pinned springs.
      if (pinned) {
         var corner_puck = (gridsize * gridsize) - 1;
         new Spring(aT.jelloPucks[ 0], new Pin( new Vec2D( 0.5, 0.5), {radius_px:4}), {strength_Npm:800.0, unstretched_width_m:0.3, color:'brown',damper_Ns2pm2:5.0});
         new Spring(aT.jelloPucks[ corner_puck], new Pin( new Vec2D( 9.0, 9.0), {radius_px:4}), {strength_Npm:800.0, unstretched_width_m:0.3, color:'brown',damper_Ns2pm2:5.0});
      }
   }

   function checkForJelloTangle() {
      // Determine if tangled by looking for balls that are fairly close to
      // each other. This does not require puck contact to detect a tangle.

      // A looping structure that avoids self reference and repeated puck-otherpuck references.
      var stillTangled = false;
      for (var j = 0, len = aT.jelloPucks.length; j < len; j++) {
         for (var k = j+1; k < len; k++) {
            // Check distance between j and k pucks.
            var diff_2d_m = aT.jelloPucks[j].position_2d_m.subtract( aT.jelloPucks[k].position_2d_m);

            // Square of the vector length.
            var lenSquared = diff_2d_m.length_squared();

            // Make the separation test a little more than the sum of the radii (add 30% of the radius of the smaller puck).
            // Then square it for comparison with the length squared.
            var radiiSum_m = aT.jelloPucks[j].radius_m + aT.jelloPucks[k].radius_m;
            var minRadius_m = Math.min( aT.jelloPucks[j].radius_m, aT.jelloPucks[k].radius_m )
            var separation_check = Math.pow(radiiSum_m + (minRadius_m * 0.30), 2);

            if (lenSquared < separation_check) {
               // This one is too close to be in a non-tangled jello block.
               stillTangled = true;
               c.jello.tangleTimer_s += c.deltaT_s;
               j = k = 10000; // break out of the two loops.
            }
         }
      }
      ctx.font = "25px Arial";
      ctx.fillStyle = 'lightgray';
      ctx.fillText(c.jello.tangleTimer_s.toFixed(2),15,40);

      if (!stillTangled) {
         // Get a timestamp for use in verification.
         if (!c.jello.verifyingDeTangle) {
            c.jello.timerAtDetangle_s = c.jello.tangleTimer_s;
         }
         // Wait 1.000 seconds and verify (that there has been no timer change).
         if (!c.jello.reported && !c.jello.verifyingDeTangle) {
            c.jello.verifyingDeTangle = true;
            //console.log('a new verification');
            //console.log('timer=' + c.jello.tangleTimer_s.toFixed(3) + ", t@dt=" + c.jello.timerAtDetangle_s.toFixed(3));
            window.setTimeout( function() {
               // If the timer hasn't advanced, must still be detangled.
               if (c.jello.tangleTimer_s == c.jello.timerAtDetangle_s) {
                  if (!c.jello.reported) {

                     // leaderboard stuff
                     Client.applyToAll( client => {
                        client.addScoreToSummary( c.jello.tangleTimer_s.toFixed(2));
                     });
                     reportGameResults();
                     // Send a score for each human player to the leaderboard. Build leaderboard report at the end.
                     submitScoresThenReport();
                     // Open up the multi-player panel so you can see the leader-board report.
                     if (!dC.multiplayer.checked) {
                        dC.multiplayer.checked = !dC.multiplayer.checked;
                        toggleMultiplayerStuff();
                     }

                     console.log('jello game over, ' + c.jello.tangleTimer_s.toFixed(2));
                     //console.log('timer=' + c.jello.tangleTimer_s.toFixed(3) + ", t@dt=" + c.jello.timerAtDetangle_s.toFixed(3));
                     // Make sure this gets reported only once (per demo #6 start).
                     c.jello.reported = true;
                     winMessage.newMessage("That's better. Thank you.", 3.5);
                  }
               } else {
                  console.log('not sustainably detangled...');
                  //console.log('timer=' + c.jello.tangleTimer_s.toFixed(3) + ", t@dt=" + c.jello.timerAtDetangle_s.toFixed(3));
               }
               c.jello.verifyingDeTangle = false;
            }, 1000);
         }
      }
   }

   function setNickNameWithoutConnecting() {
      var nickName = hC.checkForNickName('normal','host');
      if (nickName.status == 'too long') {
         hC.displayMessage('Nicknames must have fewer than 10 characters. Shorten the name and then try again.');
      } else if (nickName.value) {
         hC.displayMessage('Your nickname is ' + nickName.value + '.');
      }
   }

   function leaderBoardReport( lbResp, gameVersion) {
      c.leaderBoardIndex += 1;
      var scoreCell_id = 'scoresCell' + c.leaderBoardIndex;
      var timeCell_id = 'timesCell' + c.leaderBoardIndex;
      var scoreOrTime_id = 'scoreOrTime' + c.leaderBoardIndex;

      // Simplify the reporting for Jello Madness because there is only the time-based result (no scoring result).
      if (c.demoIndex == 6) {
         var rankString = "";
         rankString = "On a time basis, " + lbResp.userName + " placed " + lbResp.timeSortedResults.userRank + ' of ' + lbResp.timeSortedResults.scoreCount +
                             ", " + lbResp.timeSortedResults.winTime + " seconds.</br><br class='score'>";
         var leaderBoardReportHTML = "Leader Board Report: " + gameVersion + "</br><br class='score'>" + rankString;

      } else {
         if (lbResp.userRank != 'mouse or npcSleep usage') {
            var rankString = "Highest human scorer, " + lbResp.userName + ', placed ' + lbResp.userRank + ' of ' + lbResp.scoreCount + ' with a score of ' + lbResp.userScore + ". ";
            if (lbResp.timeSortedResults.winTime != '') {
               rankString += "On a time basis, placed " + lbResp.timeSortedResults.userRank + ' of ' + lbResp.timeSortedResults.scoreCount +
                             ", " + lbResp.timeSortedResults.winTime + " seconds.";
            }
         } else {
            var rankString = "Highest human scorer, " + lbResp.userName + ', scored ' + lbResp.userScore + " (mouse or npc-sleep used).";
         }

         rankString += "</br><br class='score'>";
         // Note the use of the escape \ to get three levels of quotations in the following string.
         var leaderBoardReportHTML = "Leader Board Report: " + gameVersion + "&nbsp;&nbsp;&nbsp;(" +
              "<a title = 'toggle between low-time and high-score based queries' onclick=\"gW.toggleElementDisplay('" + timeCell_id +  "','block'); " +
                           "gW.toggleElementDisplay('" + scoreCell_id + "','block'); " +
                           "gW.toggleSpanValue('" + scoreOrTime_id + "','time','score');\">" +
              "<span id='" + scoreOrTime_id + "'>score</span></a>" +
              ")</br><br class='score'>" + rankString;
      }

      // Add the tables
      var scoreTable = leaderBoardTable( "score",   lbResp,                   gameVersion);
      var timeTable  = leaderBoardTable( "winTime", lbResp.timeSortedResults, gameVersion);
      leaderBoardReportHTML +=
         "<table><tr>" +
         "<td id='" + scoreCell_id + "' style='display:none'>" + scoreTable + "</td>" +
         "<td id='" + timeCell_id +  "'  style='vertical-align:text-top; display:block'>" + timeTable + "</td>" +
         "</tr></table>";

      // Find the most recent game report element (in the chat panel).
      var gameReportElement = document.getElementById("gR" + hC.getGameReportCounter());
      // Append the leader-board report to the game report.
      gameReportElement.innerHTML = gameReportElement.innerHTML + "<br>" + leaderBoardReportHTML;

      // Send this, the combo of the game summary and leader-board report, to everyone else in the
      // room so they can see it in their chat panel.
      hC.chatToNonHostPlayers( gameReportElement.innerHTML);
   }

   function checkIfInGameTable( userName, winTime, userScore, index) {
      // This compares one row from the leaderboard report to each row in the game table.
      var inTable = false;
      for (let scoreRecord of Client.scoreSummary) {
         if ((scoreRecord['name'] == userName) && (scoreRecord['winner'] == winTime) && (scoreRecord['score'] == userScore) && (scoreRecord['randomIndex'] == index)) {
            inTable = true;
         }
      }
      return inTable;
   }

   function leaderBoardTable( mode, lbResp, gameVersion) {
      var rowIndex = 1;

      // If no records in the report, return with this simple warning.
      if (lbResp.users.length < 1) return "(no " + mode + " records)";

      var colHighLightStyle = "style='background-color:#ffffef;'"; // #FFFFFF #e2e2b7 #f7f7d7 #f9f9e5 #ffffef
      var rowHighLightStyle = "style='background-color:darkgray; color:white'";
      if (mode == 'score') {
         var style_score = colHighLightStyle;
         var style_winTime = "";
         var tableClass = "score";
      } else {
         var style_winTime = colHighLightStyle;
         var style_score = "";
         var tableClass = "score";
      }
      if (c.demoIndex == 6) {
         var tableString = "<table class='" + tableClass + "'><tr align='right'>" +
            "<td class='leaderboardHeader'></td>" +
            "<td class='leaderboardHeader' title='client name \n or \nnickname (client name)'>name</td>" +
            "<td class='leaderboardHeader' title='time (seconds) to untangle the jello (separate the pucks)' " +style_winTime+ ">time</td>" +
            "<td class='leaderboardHeader' title='human players'>p</td>" +
            "<td class='leaderboardHeader' title='monitor frames per second'>fps</td>" +
            "<td class='leaderboardHeader' title='inverse of the physics timestep'>ipt</td>" +
            "</tr>";
      } else {
         var tableString = "<table class='" + tableClass + "'><tr align='right'>" +
            "<td class='leaderboardHeader'></td>" +
            "<td class='leaderboardHeader' title='client name \n or \nnickname (client name)'>name</td>" +
            "<td class='leaderboardHeader' title='time (seconds) to win game (last puck standing)' " +style_winTime+ ">time</td>" +
            "<td class='leaderboardHeader' title='" +c.scoreTip+ "' " +style_score+ ">score</td>" +
            "<td class='leaderboardHeader' title='human players'>p</td>" +
            "<td class='leaderboardHeader' title='drones'>d</td>" +
            "<td class='leaderboardHeader' title='monitor frames per second'>fps</td>" +
            "<td class='leaderboardHeader' title='inverse of the physics timestep'>ipt</td>" +
            "<td class='leaderboardHeader' title='virtual gamepad was used during game'>vgp</td>" +
            "<td class='leaderboardHeader' title='friendly fire was prevented during game'>nff</td>" +
            "</tr>";

      }

      for (let score of lbResp.users) {
         // Highlight each row in the leader-board report that matches any row in the game result report.
         if ( checkIfInGameTable( score['userName'], score['winTime'], score['score'], score['index']) ) {
            var rowStyle = rowHighLightStyle;
            var style_score_td = "";
            var style_winTime_td = "";
         } else {
            var rowStyle = "";
            var style_score_td = style_score;
            var style_winTime_td = style_winTime;
         }

         if (typeof score['winTime'] == 'number') {
            if (mode == 'score') {
               var timeResult = score['winTime'].toFixed(2);
            } else {
               var timeResult = score['winTime'].toFixed(2);
            }
         } else {
            var timeResult = score['winTime'];
         }

         if (c.demoIndex == 6) {
            tableString += "<tr align='right' " + rowStyle + ">" +
               "<td class='leaderboardIndex'>" + rowIndex + "</td>" +
               "<td class='leaderboardName'                        >" + score['userName'].replace('(host)','(h)') + "</td>" +
               "<td class='leaderboardScore' " +style_winTime_td+ ">" + timeResult +                                "</td>" +
               "<td class='leaderboardScore'                       >" + score['nPeople'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['frMonitor'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['hzPhysics'] + "</td>" +
               "</tr>";
         } else {
            tableString += "<tr align='right' " + rowStyle + ">" +
               "<td class='leaderboardIndex'>" + rowIndex + "</td>" +
               "<td class='leaderboardName'                        >" + score['userName'].replace('(host)','(h)') + "</td>" +
               "<td class='leaderboardScore' " +style_winTime_td+ ">" + timeResult +                                "</td>" +
               "<td class='leaderboardScore' " +style_score_td+   ">" + score['score'] +                            "</td>" +
               "<td class='leaderboardScore'                       >" + score['nPeople'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['nDrones'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['frMonitor'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['hzPhysics'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['virtualGamePad'] + "</td>" +
               "<td class='leaderboardScore'                       >" + score['noFriendlyFire'] + "</td>" +
               "</tr>";
         }
         rowIndex += 1;
      }
      tableString += "</table>";
      return tableString;
   }

   function submitScoresThenReport() {
      var nR = 0;
      var peopleClients = [];

      // Define the spreadsheet function within this submitScoresThenReport scope so it has access to nR
      // and peopleClients.
      function sendScoreToSpreadSheet( mode, userName, userScore, gameVersion, winner, mouse, npcSleep, n_people, n_drones, frameRate_monitor, frameRate_physics, virtualGamePad, noFriendlyFire, index) {
         var sheetURL = 'https://script.google.com/macros/s/AKfycbz2DWA7VNas0M4ZwIADjPBSxF9SLqX64PxnwpF-bbM0xECDZrhS/exec';

         // AJAX
         var xhttp = new XMLHttpRequest();
         xhttp.open('GET', sheetURL + '?mode=' + mode +
                                      '&userName=' + userName + '&score=' + userScore +  '&gameVersion=' + gameVersion +
                                      '&winTime=' + winner +    '&mouse=' + mouse +      '&npcSleep=' + npcSleep +
                                      '&nPeople=' + n_people +  '&nDrones=' + n_drones + '&frMonitor=' + frameRate_monitor + '&hzPhysics=' + frameRate_physics +
                                      '&virtualGamePad=' + virtualGamePad + '&noFriendlyFire=' + noFriendlyFire + '&index=' + index, true);
         xhttp.send();
         xhttp.onreadystatechange = function () {
            // If there is a response from the spreadsheet:
            if (this.readyState == 4 && this.status == 200) {
               // lbResp is short for leaderBoardResponse
               var lbResp = JSON.parse( this.responseText);

               if (lbResp.result == 'report') {
                  /*
                  // useful for testing:
                  console.log('You, ' + lbResp.userID + ', placed ' + lbResp.userRank + ' of ' + lbResp.scoreCount + ' with a score of ' + lbResp.userScore);
                  for (var i = 0; i < lbResp.users.length; i++) {
                     // Convert the date so can display it.
                     var recordDate = new Date(lbResp.users[i].date);
                     var recordDateString = recordDate.getDate() +'/'+ (recordDate.getMonth() + 1) +'/'+ recordDate.getFullYear() +' '+ recordDate.getHours() +':'+ recordDate.getMinutes();
                     console.log(recordDateString + ', ' + lbResp.users[i].id + ', ' + lbResp.users[i].score);
                  }
                  */

                  // Assemble the html needed to display the leaderboard query results in the chat panel.
                  leaderBoardReport( lbResp, gameVersion);

               } else {
                  console.log( lbResp.result);
                  if (lbResp.error) console.log( lbResp.error);
               }

               // Keep (recursively) sending data until the last score (highest), ask for a report for that last one.
               nR += 1;
               console.log('rC='+nR);

               if (nR < n_people-1) {
                  // Make another non-report entry
                  sendScoreToSpreadSheet( 'noReport', peopleClients[ nR]['name'], peopleClients[ nR]['score'], c.demoVersion,
                                          peopleClients[ nR]['winner'], peopleClients[ nR]['mouse'], peopleClients[ nR]['npcSleep'],
                                          n_people, n_drones, frameRate_monitor, frameRate_physics, peopleClients[ nR]['virtualGamePad'], noFriendlyFire, peopleClients[ nR]['randomIndex']);

               } else if (nR == n_people-1) {
                  // Do a final submission, and ask for a report (see first parameter) from the spreadsheet this time.
                  sendScoreToSpreadSheet( 'report',   peopleClients[ nR]['name'], peopleClients[ nR]['score'], c.demoVersion,
                                          peopleClients[ nR]['winner'], peopleClients[ nR]['mouse'], peopleClients[ nR]['npcSleep'],
                                          n_people, n_drones, frameRate_monitor, frameRate_physics, peopleClients[ nR]['virtualGamePad'], noFriendlyFire, peopleClients[ nR]['randomIndex']);
               }
            }
         }
      }

      // Ascending sort (this way the report gets issued on the highest score, last one.)
      Client.scoreSummary.sort((a, b) => a['score'] - b['score']);

      // Make a subset of the scores to only include real people.
      for (let score of Client.scoreSummary) {
         // Filter out the NPC pucks here.
         if ( ! score['name'].includes('NPC')) {
            peopleClients.push( score);
         }
      }
      var n_people = peopleClients.length;
      var n_drones = Client.scoreSummary.length - n_people;
      var frameRate_monitor = dC.fps.innerHTML; //current observed refresh rate of the monitor
      var frameRate_physics = $('#FrameRate').val(); //timestep for engine
      var noFriendlyFire = (dC.friendlyFire.checked) ? '':'x';

      // Recursively send the scores. If only one player, go right to 'report' mode.
      if (n_people > 0) {
         var reportMode = (n_people == 1) ? 'report':'noReport';
         sendScoreToSpreadSheet( reportMode, peopleClients[0]['name'], peopleClients[0]['score'], c.demoVersion,
                                             peopleClients[0]['winner'], peopleClients[0]['mouse'], peopleClients[0]['npcSleep'],
                                             n_people, n_drones, frameRate_monitor, frameRate_physics, peopleClients[0]['virtualGamePad'], noFriendlyFire, peopleClients[0]['randomIndex']);
      }
   }

   function reportGameResults() {
      if (c.demoIndex == 6) {
         var summaryString = "Game Summary: " + c.demoVersion + "</br><br class='score'>" +
            "<table class='score'><tr align='right'>" +
            "<td class='scoreHeader' title='client name \n or \nnickname (client name)'>name</td>" +
            "<td class='scoreHeader' title='time (seconds) to untangle the jello (separate the pucks)'>time</td>" +
            "</tr>";
         for (let score of Client.scoreSummary) {
            summaryString += "<tr align='right'>" +
            "<td class='score'>" + score['name']     + "</td>" +
            "<td class='score'>" + score['winner']   + "</td>" +
            "</tr>";
         }

      } else {
         Client.scoreSummary.sort((a, b) => b['score'] - a['score']);
         var summaryString = "Game Summary: " + c.demoVersion + "</br><br class='score'>" +
            "<table class='score'><tr align='right'>" +
            "<td class='scoreHeader' title='client name \n or \nnickname (client name)'>name</td>" +
            "<td class='scoreHeader' title='time (seconds) to win game (last puck standing)'>time</td>" +
            "<td class='scoreHeader' title='" +c.scoreTip+ "'>score</td>" +
            "<td class='scoreHeader' title='mouse usage in the canvas area'>m</td>" +
            "<td class='scoreHeader' title='NPCs have been sleeping (ctrl-q)'>s</td>" +
            "<td class='scoreHeader' title='virtual gamepad used during game'>vgp</td>" +
            "</tr>";
         // Check for any mouse usage by the players as you write out the rows.
         var someMouseFunnyBz = false;
         for (let score of Client.scoreSummary) {
            if (score['mouse'] == 'x') someMouseFunnyBz = true;
            summaryString += "<tr align='right'>" +
            "<td class='score'>" + score['name']     + "</td>" +
            "<td class='score'>" + score['winner']   + "</td>" +
            "<td class='score'>" + score['score']    + "</td>" +
            "<td class='score'>" + score['mouse']    + "</td>" +
            "<td class='score'>" + score['npcSleep'] + "</td>" +
            "<td class='score'>" + score['virtualGamePad'] + "</td>" +
            "</tr>";
         }
      }

      // Now report the sorted score summary (pass in function to give descending numeric sort)
      summaryString += "</table>"
      hC.displayMessage( summaryString);

      // If any of the players or the host (without a puck player) used the mouse, mark everyone
      // as suspect before doing the submission to the leaderboard. This appropriately blocks the case where the host
      // turns off his player and uses his mouse to delete the drones and lets one network player win.
      // That's clever, but that's not allowed.
      // (Notice the word "of" here. This type of for-of loop works nicely on arrays, and presents the item, not simply the index.)
      for (let score of Client.scoreSummary) {
         // For Jello Madness, don't check for mouse usage. Mouse is always used.
         if (c.demoIndex == 6) {
            score['mouse'] = '';
         } else {
            if (someMouseFunnyBz || clients['local'].mouseUsage) score['mouse'] = 'x';
         }
      }
   }

   // Note that this check gets called every frame (if running #7 or #8).
   function checkForPuckPopperWinnerAndReport() {
      // Check for a puck-popper winner. Do this check on the pucks because the human clients
      // are not removed when their pucks are popped.
      if ((Puck.playerCount == 1) || (!dC.friendlyFire.checked && (Puck.npcCount == 0))) {
         // Get the name of the client scoring the last hit. The check, to see if the winner (last client to produce a hit)
         // is still there, prevents a failed reference (to nickname) if the host uses the mouse to delete the last NPC. Usually, with
         // mouse deletion of the NPC, they are the last hitter, and so the applyToAll loop will run.
         var winnerClientName = c.lastClientToScoreHit;
         var winnerDescString = 'scoring winning hit';
         if ( ! clients[ winnerClientName]) {
            // Looks like the last hitting client is not there (host is probably using the mouse for NPC deletes).
            // There might be multiple players left (if friendly fire is off). So take the highest scorer as the winner.
            var highestScore = -10000;
            Puck.applyToAll( puck => {
               if (puck.clientName) {
                  if (clients[ puck.clientName].score > highestScore) {
                     winnerClientName = puck.clientName;
                     highestScore = clients[ puck.clientName].score;
                  }
               }
            });
            winnerDescString = 'with highest score';
         }
         var winnerNickName = clients[ winnerClientName].nickName;

         // If the winner is still around (hasn't disconnected)
         if (clients[ winnerClientName] || (winnerClientName == 'Team')) {

            if (winnerNickName) {
               var displayName = winnerNickName + ' (' + Client.translateIfLocal( winnerClientName) + ')';
            } else {
               var displayName = Client.translateIfLocal( winnerClientName);
            }

            if (Client.countAtGameStart > 1) {

               // Give a bonus (only once, not every frame) for winning.
               if ( ! Client.winnerBonusGiven) {
                  Client.winnerBonusGiven = true;

                  // Yes, now add the winner(s) to the summary too. The losers got added when their puck was popped.
                  if (dC.friendlyFire.checked) {
                     // Can only be one puck standing in this case.
                     clients[ winnerClientName].score += 200;
                     clients[ winnerClientName].addScoreToSummary( c.puckPopperTimer_s.toFixed(2));
                  } else {
                     // Assign the winning time to all the client pucks on the no-friendly-fire team.
                     Puck.applyToAll( puck => {
                        if (puck.clientName) {
                           clients[ puck.clientName].score += 200;
                           clients[ puck.clientName].addScoreToSummary( c.puckPopperTimer_s.toFixed(2));
                        }
                     });
                  }

                  reportGameResults();

                  // Send a score to the leaderboard for each human player. Build leaderboard report at the end.
                  submitScoresThenReport();

                  // Open up the multi-player panel so you can see the leader-board report.
                  if (!dC.multiplayer.checked) {
                     // Note: to directly call the click handler function, toggleMultiplayerStuff, it must be put in
                     // module-level scope, which has been done. So this can be explicitly controlled as follows:
                     dC.multiplayer.checked = !dC.multiplayer.checked;
                     toggleMultiplayerStuff();
                     /*
                     // Another approach is to get at the function via the module-level, dC.multiplayer. The following
                     // are alternate ways to do what the two statements above do. These approaches to not
                     // require toggleMultiplayerStuff to be in the module-level scope.
                     dC.multiplayer.click();
                     $("#chkMultiplayer").trigger("click");
                     // Note: the following also works. But don't think it's necessary to provide
                     // the 'this' context here.
                     dC.multiplayer.click.apply( dC.multiplayer);
                     */
                  }
                  // only displayed once per win (because this block only runs once per win)
                  helpMessage.resetMessage();

                  if (winnerClientName.includes('NPC')) {
                     var congratsString = "Only one player remaining...";
                     var summaryString = "Bad guy wins (oh man, that's not good)" +
                                         "\\   color = " + clients[ winnerClientName].color +
                                         "\\   time = " + c.puckPopperTimer_s.toFixed(2) + "s" +
                                         "\\   score = " + clients[ winnerClientName].score;
                  } else {
                     if (dC.friendlyFire.checked) {
                        var congratsString = "Only one player remaining...";
                        var summaryString = "" + displayName + " wins" +
                                            "\\   color = " + clients[ winnerClientName].color +
                                            "\\   time = " + c.puckPopperTimer_s.toFixed(2) + "s" +
                                            "\\   score = " + clients[ winnerClientName].score;
                     } else {
                        var congratsString = "Only good guys remaining...";
                        var summaryString = "The team wins" +
                                            "\\   name of player " + winnerDescString + " = " + displayName +
                                            "\\   color that player = " + clients[ winnerClientName].color +
                                            "\\   time to win = " + c.puckPopperTimer_s.toFixed(2) + "s";
                     }
                  }

                  var theSeries = {
                     1:{'tL_s':2.0, 'message':congratsString},
                     2:{'tL_s':2.5, 'message':"...so that's a win!"},
                     3:{'tL_s':1.0, 'message':"Summary:"},
                     4:{'tL_s':5.0, 'message': summaryString},
                     5:{'tL_s':2.0, 'message':"Reports are in the left panel."},
                     6:{'tL_s':4.0, 'message':"Click the \"multiplayer\" checkbox (or use the m key) \\to toggle back to the help."}};
                  if ( (!winnerClientName.includes('NPC')) && dC.friendlyFire.checked) {
                     Object.assign( theSeries, {
                        7:{'tL_s':1.0, 'message':"One last thing to try..."},
                        8:{'tL_s':2.5, 'message':"pop any left-over pucks..."},
                        9:{'tL_s':2.0, 'message':"then navigate..."},
                       10:{'tL_s':3.0, 'message':"to bounce off the four walls."}
                     });
                  }
                  Object.assign( theSeries, {
                     12:{'tL_s':1.0, 'message':"That's it..."},
                     13:{'tL_s':1.0, 'message':"...the end."},
                     15:{'tL_s':1.0, 'message':"."},
                     16:{'tL_s':1.0, 'message':".."},
                     17:{'tL_s':1.0, 'message':"..."},
                     18:{'tL_s':1.0, 'message':"...."},
                     19:{'tL_s':1.0, 'message':"....."},
                     20:{'tL_s':3.0, 'message':"You're still there?"},
                     21:{'tL_s':2.0, 'message':"Till next time."}
                  });
                  winMessage.newMessageSeries( theSeries);
               }

               // Turn off (zero out the message string) the little score display for the local client (if they're the winner).
               if (winnerClientName == 'local') scoreMessage.newMessage("", 0.0);

            }
            // This one is every frame, so it stays there until one of the walls changes from the client color or the winner gets deleted.
            if (fenceIsClientColor( winnerClientName)) {
               winMessage.newMessage("...nice job marking your territory...", 0.2);
            }
         }
      } else if (Puck.playerCount > 1) {
         // Display host score as long as the corresponding puck remains...
         if (clients['local'].puck) {
            scoreMessage.newMessage('host score = ' + clients['local'].score, 0.2);
            scoreMessage.displayIt();
         }

         c.puckPopperTimer_s += c.deltaT_s;
         ppTimerMessage.newMessage( c.puckPopperTimer_s.toFixed(2), 0.2);
         ppTimerMessage.displayIt();
      }
   }

   /*
   Tried using the B2D contact listener to detect tangle. But this
   approach fails to deal with a tangled state where the balls are not quite
   touching... So the approach above is used.

   function checkForJelloTangle2() {
      if (c.contactCounter > 0) {
         c.jello.tangleTimer_s += c.deltaT_s;
      }
      ctx.font = "30px Arial";
      ctx.fillStyle = 'yellow';
      ctx.fillText(c.jello.tangleTimer_s.toFixed(2),10,50);
   }
   */

   // For loading and running a capture from a web page link.
   function demoStart_fromCapture( index, pars) {
      var fileName = setDefault( pars.fileName, 'null');
      $.getScript( fileName, function() {
         console.log('fetching '+ fileName +' from main server');
         // Note: demo_capture is a page level global and is assigned a value, the capture object, in the first line of the loading file.
         // Put the capture into the capture input box on the page.
         dC.json.value = JSON.stringify( demo_capture, null, 3);
         window.setTimeout( function() { scrollCaptureArea();}, 500);
         demoStart( index);
      }).fail( function() {
         // Try the local web server. Maybe the file hasn't been published yet. This will
         // only work for the developer (that's me).
         console.log('fetching '+ fileName +' from local server');
         $.getScript( 'http://localhost/ttc-root/'+fileName, function() {
            dC.json.value = JSON.stringify( demo_capture, null, 3);
            window.setTimeout( function() { scrollCaptureArea();}, 500);
            demoStart( index);
         }).fail( function() {
            console.log('capture file not found');
            demoStart( 1);
         });
      });
   }


   function createPucksForNetworkClients( networkPuckTemplate, startingPosAndVels) {
      /*
      Make a controlled puck for each network client (that wants one). Copy
      some of the attributes of the host player (local) puck (if there is
      one). Note: when playing without a local-player puck (e.g. when the host
      is using the virtual game pad), this will force all players to have a
      puck as defined in the "else if" or "else" blocks below. An alternative,
      is to allow the local puck (controlled by the host's keyboard), to be
      generated, and serve as a model for all network players, but ignored by
      the host, who can and will use his cell phone instead.
      */
      var position_2d_m, velocity_2d_mps;
      var networkClientIndex = 1;

      function randomPandV( position_2d_m, velocity_2d_mps) {
         // Randomize the position as constrained by the boundary of the canvas.
         position_2d_m.x = (meters_from_px( canvas.width) -0.3) * Math.random();
         position_2d_m.y = (meters_from_px( canvas.height)-0.3) * Math.random();
         // Randomize the initial velocity
         velocity_2d_mps.x = 5.0 * (Math.random() - 0.5);
         velocity_2d_mps.y = 5.0 * (Math.random() - 0.5);
      }

      Client.applyToAll( client => {
         if ( (client.name.slice(0,1) == 'u') && (client.player) ) {

            // If the host has a puck for keyboard play. Use the local puck as a template.
            if (clients['local'].puck) {

               if ((networkClientIndex - 1) <= (startingPosAndVels.length - 1)) {
                   // Use the array for the starting positions of all the network clients.
                  position_2d_m = startingPosAndVels[ networkClientIndex - 1].position_2d_m;
                  velocity_2d_mps = startingPosAndVels[ networkClientIndex - 1].velocity_2d_mps;
               } else {
                  randomPandV(position_2d_m, velocity_2d_mps);
               }

               new Puck( position_2d_m, velocity_2d_mps, {'radius_m':0.30, 'color':'black', 'colorSource':true, 'clientName':client.name,
                   'hitLimit':    clients['local'].puck.hitLimit,
                   'linDamp':     clients['local'].puck.linDamp,
                   'angDamp':     clients['local'].puck.angDamp,
                   'restitution': clients['local'].puck.restitution,
                   'friction':    clients['local'].puck.friction });

            // If the host is using the virtual game pad and a template has been established from the 'local' puck in the capture.
            } else if (networkPuckTemplate) {

               if ((networkClientIndex - 2) <= (startingPosAndVels.length - 1)) {
                  if (networkClientIndex == 1) {
                     // Use the template for the first client.
                     position_2d_m = networkPuckTemplate.position_2d_m;
                     velocity_2d_mps = networkPuckTemplate.velocity_2d_mps;
                  } else {
                     // Use the array of starting conditions for the rest of the clients, 2nd, 3rd, etc. So when
                     // networkClientIndex is 2, this will use the 0th element in the array.
                     position_2d_m = startingPosAndVels[ networkClientIndex - 2].position_2d_m;
                     velocity_2d_mps = startingPosAndVels[ networkClientIndex - 2].velocity_2d_mps;
                  }
               } else {
                  randomPandV(position_2d_m, velocity_2d_mps);
               }

               new Puck( position_2d_m, velocity_2d_mps, {'radius_m':0.30, 'color':'black', 'colorSource':true, 'clientName':client.name,
                   'hitLimit':    networkPuckTemplate.hitLimit,
                   'linDamp':     networkPuckTemplate.linDamp,
                   'angDamp':     networkPuckTemplate.angDamp,
                   'restitution': networkPuckTemplate.restitution,
                   'friction':    networkPuckTemplate.friction });

            } else {
               console.log('can not find anything to use as a puck template.');
            }
            // Increment only for network clients (inside the if block)
            networkClientIndex++;
         }
      });
   }

   function hL( id) {
      // hL is short for highlighting...
      // For inserting a style string in the links of the "Plus" row below the button cluster.
      if (c.demoVersion == id) {
         return "style='color:white; background-color:gray;'";
      } else {
         return "";
      }
   }

   function demoStart( index) {
      var v_init_2d_mps, buttonColor, buttonTextColor;
      var p1, p2, p3, p4;

      // by default no blending
      ctx.globalCompositeOperation = 'source-over';

      // So you can see the name of the capture if it's there.
      // However, nice to be able to edit the capture and run it without losing the spot where
      // you're working. So maybe comment this out in the future...
      scrollCaptureArea();

      // Set this module-level value to support the JSON capture.
      c.demoIndex = index;
      var networkPuckTemplate = null;

      dC.extraDemos.innerHTML = '';

      // Scaling factor between the Box2d world and the screen (pixels per meter)
      px_per_m = 100;  // a module-level value

      canvas.width = 600, canvas.height = 600;
      //canvas.style.borderColor = '#008080';

      adjustSizeOfChatDiv('normal');
      hC.resizeClients('normal');
      // Set this module-level value to help new connecting clients adjust their layout.
      c.chatLayoutState = 'normal';

      // Change the color of the demo button that was clicked.
      for (var j = 1; j <= 9; j++) {
         if (j == index) {
            buttonColor = "yellow";
            buttonTextColor = "black";
         } else {
            // Darkgray (with white text) for the game buttons
            if ((j == 6) || (j == 7) || (j == 8)) {
               buttonColor = "darkgray";
               buttonTextColor = "white";
            } else {
               buttonColor = "lightgray";
               buttonTextColor = "black";
            }
         }
         document.getElementById('b'+j).style.backgroundColor = buttonColor;
         document.getElementById('b'+j).style.color = buttonTextColor;
      }

      // Delete pucks (and references to them) from the previous demo.
      Puck.deleteAll();

      // Clean out the old springs.
      Spring.deleteAll();
      c.springNameForPasting = null;

      // Clean out the non-player clients
      Client.deleteNPCs();

      // Clean out the old pins and their representation in the b2d world.
      Pin.deleteAll();

      // Clean out the old walls and their representation in the b2d world.
      Wall.deleteAll();

      // De-select anything still selected.
      clients['local'].selectedBody = null;
      hostMSelect.resetAll();

      resetFenceColor( "white");
      if (dC.pause.checked) {
         dC.pause.checked = false;
      }
      setPauseState();

      // Turn gravity off by default.
      if (c.g_ON) {
         c.g_ON = false;
         dC.gravity.checked = false;
      }

      resetRestitutionAndFrictionParameters();
      setGravityRelatedParameters({});

      c.bulletAgeLimit_ms = 1000;

      // These message resets shut down any lingering messages from prior demos.
      helpMessage.resetMessage();
      helpMessage.loc_px = {'x':15,'y':30}; // The help location for all the non-game demos.
      winMessage.resetMessage();
      gameTitle.resetMessage();
      if (videoTitle) videoTitle.resetMessage();

      // By default, use the simple index as the demoVersion. When state capture is
      // used, it will add to this.
      c.demoVersion = index + '.a';

      // Convert (parse) the json capture into a local object.
      if (dC.json.value != '') {
         try {
            var state_capture = JSON.parse( dC.json.value);
         } catch (err) {
            var state_capture = null;
            window.alert("There's a formatting error in the state capture. Try clicking the 'Clear' button.");
         }
      } else {
         var state_capture = null;
      }

      if (index == 0) {

         // keep this one blank for observing the framerate.

         /*
         //canvas.width = 1250, canvas.height = 950;
         //canvas.width = 1920, canvas.height = 1080;
         canvas.width = 1850, canvas.height = 1060;
         make_fence({'hF':true});

         videoTitle.font = "35px Arial";
         videoTitle.loc_px = {'x':300,'y':400};
         videoTitle.popAtEnd = false;
         var theSeries = {
            1:{'tL_s':1.5, 'message':"an introduction..."},
            2:{'tL_s':1.5, 'message':"maybe less...",            'loc_px':{'x':300,'y':400} },
            3:{'tL_s':1.5, 'message':"maybe more...",            'loc_px':{'x':300,'y':450} },
            4:{'tL_s':1.5, 'message':"than you should know...",  'loc_px':{'x':300,'y':400} },
            6:{'tL_s':1.5, 'message':"about...",                 'loc_px':{'x':300,'y':450},                      'popAtEnd':true},
            7:{'tL_s':1.3, 'message':"Puck",                     'loc_px':{'x':250,'y':350}, 'font':"90px Arial", 'popAtEnd':true},
            8:{'tL_s':1.5, 'message':"Popper",                   'loc_px':{'x':300,'y':450},                      'popAtEnd':false},

            9:{'tL_s':1.0, 'message':"...",                                 'loc_px':{'x':300,'y':450}, 'font':"35px Arial"},
            10:{'tL_s':1.5, 'message':"but first...",                       'loc_px':{'x':300,'y':450}, 'font':"35px Arial"},
            11:{'tL_s':3.0, 'message':"a game of the #8c version...", 'loc_px':{'x':300,'y':450} },
         };
         videoTitle.newMessageSeries( theSeries);

         var nBalls = 36; //100 36 180
         var angle_step_deg = 360.0 / nBalls;
         var v_2d_mps = new Vec2D(0, 2.0);
         // 12.5/2, 9.5/2
         for (var i = 1; i <= nBalls; i++) {
               new Puck(new Vec2D(3.0, 3.0), v_2d_mps, {'radius_m':0.1, 'groupIndex':-1, 'color':'white', 'friction':0.0});
               // Rotate for the next ball.
               v_2d_mps.rotated_by( angle_step_deg);
         }
         */

      } else if (index == 1) {

         scrollDemoHelp('#d1234');

         if ((getSpanValue('moreOrLess') == 'More') && (!dC.multiplayer.checked)) {
            helpMessage.newMessageSeries({
               1:{'tL_s':2.0, 'message':"To learn more about the demos and the games..."},
               2:{'tL_s':2.0, 'message':"click on the 'More' link in the left panel..."},
               3:{'tL_s':2.0, 'message':"then restart the demo (click it's number again)."}
            });
         }

         if ((state_capture) && (state_capture.demoIndex == 1)) {
            restoreFromState( state_capture);
         } else {
            make_fence();

            var v_init_2d_mps = new Vec2D(0.0, -2.0);
            new Puck( new Vec2D(2.0, 3.99),       v_init_2d_mps, {'radius_m':0.10, 'color':'GoldenRod', 'colorSource':true});
            new Puck( new Vec2D(2.0, 3.00),       v_init_2d_mps, {'radius_m':0.80});

            var v_init_2d_mps = new Vec2D(0.0,  2.0);
            new Puck( new Vec2D(5.00, 1.60+1.5*2), v_init_2d_mps, {'radius_m':0.35});
            new Puck( new Vec2D(5.00, 1.60+1.5),   v_init_2d_mps, {'radius_m':0.35, 'color':'GoldenRod', 'colorSource':true});
            new Puck( new Vec2D(5.00, 1.60),       v_init_2d_mps, {'radius_m':0.35});

            new Puck( new Vec2D(0.50, 5.60), new Vec2D(0.40, 0.00), {'radius_m':0.15});
         }

         dC.extraDemos.innerHTML =
            "<a title='big and little'     " + hL('1.a') + " onclick=\"gW.clearState(); gW.demoStart(1)\">1a,</a>" +
            "<a title='a gentle landing' " + hL('1.b') + " onclick=\"gW.demoStart_fromCapture(1, {'fileName':'demo1b.js'})\">&nbsp;b&nbsp;</a>";

      } else if (index == 2) {

         scrollDemoHelp('#d2');

         c.restitution_gOn =  0.7;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 1.0;
         c.friction_gOff = 0.0;

         if ((state_capture) && (state_capture.demoIndex == 2)) {
            restoreFromState( state_capture);

         } else {
            make_fence();
            new Puck( new Vec2D(4.5, 4.5), new Vec2D(-4.0, 4.0), {'radius_m':0.20, 'friction':0.0, 'angleLine':false, 'color':'yellow', 'colorSource':true,
                                                                  'createTail':true, 'tailPars':{'propSpeed_mps':1.5, 'length_limit':25} });

            new Puck( new Vec2D(3.0, 3.0), new Vec2D( 0.0, 0.0), {'radius_m':0.60, 'friction':0.0, 'angleLine':false, 'color':'GoldenRod', 'colorSource':true });

            new Puck( new Vec2D(1.5, 1.5), new Vec2D( 0.0, 0.0), {'radius_m':0.20, 'friction':0.0, 'angleLine':false, 'color':'blue', 'colorSource':true,
                                                                  'createTail':true, 'tailPars':{'propSpeed_mps':1.5, 'length_limit':25} });
         }

         dC.extraDemos.innerHTML =
            "<a title='sound field'                          " + hL('2.a') + " onclick=\"gW.clearState(); gW.demoStart(2)\">2a,</a>" +
            "<a title='pretty'                               " + hL('2.b') + " onclick=\"gW.demoStart_fromCapture(2, {'fileName':'demo2b.js'})\">&nbsp;b,</a>" +
            "<a title='wave speed is zero for the blue puck' " + hL('2.c') + " onclick=\"gW.demoStart_fromCapture(2, {'fileName':'demo2c.js'})\">&nbsp;c,</a>" +
            "<a title='like tag'                             " + hL('2.d') + " onclick=\"gW.demoStart_fromCapture(2, {'fileName':'demo2d.js'})\">&nbsp;d&nbsp;</a>";

      } else if (index == 3) {

         scrollDemoHelp('#d1234');

         c.restitution_gOn =  0.7;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 1.0;
         c.friction_gOff = 0.0;

         v_init_2d_mps = new Vec2D(0.0, 2.0);

         if ((state_capture) && (state_capture.demoIndex == 3)) {
            restoreFromState( state_capture);

         } else {
            make_fence();

            var grid_order = 7;
            var grid_spacing_m = 0.45;
            var startPosition_2d_m = new Vec2D(0.0, 0.0);

            for (var i = 1; i <= grid_order; i++) {
               for (var j = 1; j <= grid_order; j++) {
                  var delta_2d_m = new Vec2D( i * grid_spacing_m, j * grid_spacing_m);
                  var position_2d_m = startPosition_2d_m.add( delta_2d_m);
                  new Puck(position_2d_m, v_init_2d_mps, {'radius_m':0.10, 'groupIndex':0});
               }
            }

            v_init_2d_mps = new Vec2D(0.2, 0.0);
            new Puck( new Vec2D(5.5, 3.5), v_init_2d_mps, {'radius_m':0.10, 'color':'GoldenRod', 'colorSource':true, 'groupIndex':0} );

            /*
            // Expanding ring of non-colliding balls.
            var nBalls = 36; //100 36 180
            var angle_step_deg = 360.0 / nBalls;
            var v_2d_mps = new Vec2D(0, 2.0);
            for (var i = 1; i <= nBalls; i++) {
                  new Puck(new Vec2D(3, 3), v_2d_mps, {'radius_m':0.1, 'groupIndex':-1, 'color':'white'});
                  // Rotate for the next ball.
                  v_2d_mps.rotated_by( angle_step_deg);
            }
            window.setTimeout( function() {
               saveState();
            }, 1);
            */
         }

         dC.extraDemos.innerHTML =
            "<a title='order and disorder'      " + hL('3.a') + " onclick=\"gW.clearState(); gW.demoStart(3)\">3a,</a>" +
            "<a title='no puck-puck collisions' " + hL('3.b') + " onclick=\"gW.demoStart_fromCapture(3, {'fileName':'demo3b.js'})\">&nbsp;b,</a>" +
            "<a title='no puck-puck collisions' " + hL('3.c') + " onclick=\"gW.demoStart_fromCapture(3, {'fileName':'demo3c.js'})\">&nbsp;c&nbsp;</a>";

      } else if (index == 4) {

         scrollDemoHelp('#d4');

         c.restitution_gOn =  0.7;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 1.0;
         c.friction_gOff = 0.0;

         if ((state_capture) && (state_capture.demoIndex == 4)) {
            restoreFromState( state_capture);

         } else {
            make_fence();

            new Puck( new Vec2D(3.00, 3.00), new Vec2D( 0.0, 0.0),
               {'radius_m':0.40, 'color':'GoldenRod', 'colorSource':true , 'shape':'rect', 'angularSpeed_rps':25.0});

            new Puck( new Vec2D(0.25, 3.00), new Vec2D( 2.0, 0.0),
               {'radius_m':0.15, 'shape':'rect', 'aspectR':4.0, 'angularSpeed_rps':0, 'angle_r': Math.PI/2});
            new Puck( new Vec2D(5.75, 3.00), new Vec2D(-2.0, 0.0),
               {'radius_m':0.15, 'shape':'rect', 'aspectR':4.0, 'angularSpeed_rps':0, 'angle_r': Math.PI/2});

            // Include two pins and a spring as a source for replicating.
            new Spring( new Pin( new Vec2D( 0.1, 0.2),{}), new Pin( new Vec2D( 0.1, 1.2),{}),
                 {'length_m':1.5, 'strength_Npm':10.0, 'unstretched_width_m':0.1, 'color':'yellow', 'damper_Ns2pm2':1.0});
         }

         dC.extraDemos.innerHTML =
            "<a title='rectangular symmetry'                " + hL('4.a') + " onclick=\"gW.clearState(); gW.demoStart(4)\">4a,</a>" +
            "<a title='conservation of angular momentum...' " + hL('4.b') + " onclick=\"gW.demoStart_fromCapture(4, {'fileName':'demo4b.js'})\">&nbsp;b&nbsp;</a>";

      } else if (index == 5) {

         scrollDemoHelp('#d5');

         c.restitution_gOn =  0.7;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 1.0;
         c.friction_gOff = 0.0;

         v_init_2d_mps = new Vec2D(0.0,0.0);

         if ((state_capture) && (state_capture.demoIndex == 5)) {
            restoreFromState( state_capture);

         } else {
            make_fence();

            // Spring triangle.
            var tri_vel_mps = new Vec2D( 5.0, 0.0);
            var d5_puckPars_triangle = {'radius_m':0.20, 'restitution':0.0, 'friction':1.0}
            new Puck( new Vec2D(1.00, 0.80 + Math.sin(60.0*Math.PI/180)), tri_vel_mps, Object.assign({}, d5_puckPars_triangle, {'name':'puck1'}));

            tri_vel_mps.rotated_by(-240.0);
            new Puck( new Vec2D(0.50, 0.80                             ), tri_vel_mps, Object.assign({}, d5_puckPars_triangle, {'name':'puck2'}));

            tri_vel_mps.rotated_by(-240.0);
            new Puck( new Vec2D(1.50, 0.80                             ), tri_vel_mps, Object.assign({}, d5_puckPars_triangle, {'name':'puck3'}));

            var springColor1 = 'blue';
            new Spring(aT.puckMap['puck1'], aT.puckMap['puck2'],
                                        {'length_m':1.1, 'strength_Npm':60.0, 'unstretched_width_m':0.1, 'color':springColor1});
            new Spring(aT.puckMap['puck1'], aT.puckMap['puck3'],
                                        {'length_m':1.1, 'strength_Npm':60.0, 'unstretched_width_m':0.1, 'color':springColor1});
            new Spring(aT.puckMap['puck2'], aT.puckMap['puck3'],
                                        {'length_m':1.1, 'strength_Npm':60.0, 'unstretched_width_m':0.1, 'color':springColor1});

            var springColor2 = 'yellow';

            // Single puck with two springs and pins.
            new Puck( new Vec2D(4.0, 5.0), new Vec2D(0.0, 0.0), {'radius_m':0.55, 'name':'puck4', 'restitution':0.0, 'angDamp':0.0, 'linDamp':2.0, 'friction':1.0});
            var d5_springPars_onePuck = {'strength_Npm':20.0, 'unstretched_width_m':0.2, 'color':springColor2, 'damper_Ns2pm2':0.0, 'drag_c':0.0};
            new Spring(aT.puckMap['puck4'], new Pin( new Vec2D( 3.0, 5.0),{borderColor:'yellow'}),
                  Object.assign({}, d5_springPars_onePuck, {'spo1_ap_l_2d_m':new Vec2D( 0.54, 0.01)}) );
            new Spring(aT.puckMap['puck4'], new Pin( new Vec2D( 5.0, 5.0),{borderColor:'yellow'}),
                  Object.assign({}, d5_springPars_onePuck, {'spo1_ap_l_2d_m':new Vec2D(-0.54, 0.00)}) );

            // Two pucks (one bigger than the other) on spring orbiting each other (upper left corner)
            new Puck( new Vec2D(0.75, 5.00), new Vec2D(0.0, -5.00                          * 1.2), {'radius_m':0.15, 'name':'puck5'});
            // Scale the y velocity by the square of the radius ratio. This gives a net momentum of zero (so it stays in one place as it spins).
            new Puck( new Vec2D(1.25, 5.00), new Vec2D(0.0, +5.00 * Math.pow(0.15/0.25, 2) * 1.2), {'radius_m':0.25, 'name':'puck6'});
            new Spring(aT.puckMap['puck5'], aT.puckMap['puck6'],
                                        {'length_m':0.5, 'strength_Npm':5.0, 'unstretched_width_m':0.05, 'color':springColor2});

            // Same thing (lower right corner)
            new Puck( new Vec2D(4.70, 0.55), new Vec2D(+4.90, 0.0), {'radius_m':0.20, 'name':'puck7'});
            new Puck( new Vec2D(4.70, 1.55), new Vec2D(-4.90, 0.0), {'radius_m':0.20, 'name':'puck8'});
            new Spring(aT.puckMap['puck7'], aT.puckMap['puck8'],
                                        {'length_m':0.5, 'strength_Npm':5.0, 'unstretched_width_m':0.05, 'color':springColor2});

         }

         dC.extraDemos.innerHTML =
            "<a title='stretchy things'          " + hL('5.a') + " onclick=\"gW.clearState(); gW.demoStart(5)\">5a,</a>" +
            "<a title='Rube would like this...'  " + hL('5.b') + " onclick=\"gW.demoStart_fromCapture(5, {'fileName':'demo5b.js'})\">&nbsp;b,</a>" +
            "<a title='spring pendulum'          " + hL('5.c') + " onclick=\"gW.demoStart_fromCapture(5, {'fileName':'demo5c.js'})\">&nbsp;c,</a>" +
            "<a title='traditional springs (left side) and \nBox2D distance joints (right side)' " +
                                                     hL('5.d') + " onclick=\"gW.demoStart_fromCapture(5, {'fileName':'demo5d.js'})\">&nbsp;d&nbsp;</a>";

      } else if (index == 6) {

         scrollDemoHelp('#d6');

         setNickNameWithoutConnecting();

         c.g_ON = false;
         dC.gravity.checked = false;

         c.restitution_gOn =  0.0;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 0.0;
         c.friction_gOff = 0.6;

         Client.resetScores();

         if ((state_capture) && (state_capture.demoIndex == 6)) {
            restoreFromState( state_capture);

         } else if ( demo_6_fromFile) {
            restoreFromState( demo_6_fromFile);

         } else {
            make_fence();
            makeJello({});
         }

         // For 6.a or 6.d or any capture based on them, run them like the Jello game.
         helpMessage.loc_px = {'x':15,'y': 75};
         winMessage.loc_px =  {'x':15,'y':100};
         c.jello.reported = true;
         c.jello.tangleTimer_s = 0.0;
         if ((c.demoVersion.slice(0,3) == "6.a") || (c.demoVersion.slice(0,3) == "6.d")) {
            helpMessage.newMessage("Detangle the jello:\\    Try the f key. Try right-click mouse drags.", 3.0);

            gameTitle.newMessage("Jello Madness", 1.0);
            gameTitle.loc_px = {'x':15,'y':200};
            gameTitle.popAtEnd = false;

            c.jello.reported = false;
            c.jello.verifyingDeTangle = false;
         }

         setGravityRelatedParameters({});

         // An extra puck to play with.
         //puckParms.restitution = 0.0;
         //new Puck( 3.8, 5.5, v_init_2d_mps, puck_radius_m * 2.8, puckParms);

         dC.extraDemos.innerHTML =
            "<a title='Jello Madness'                            " + hL('6.a') + " onclick=\"gW.clearState(); gW.demoStart(6)\">6a,</a>" +
            "<a title='the editor turned the jello into this...' " + hL('6.b') + " onclick=\"gW.demoStart_fromCapture(6, {'fileName':'demo6b.js'})\">&nbsp;b,</a>" +
            "<a title='the editor turned the jello into this...' " + hL('6.c') + " onclick=\"gW.demoStart_fromCapture(6, {'fileName':'demo6c.js'})\">&nbsp;c,</a>" +
            "<a title='a tough tangle...' " + hL('6.d') + " onclick=\"gW.demoStart_fromCapture(6, {'fileName':'demo6d.js'})\">&nbsp;d&nbsp;</a>";

      } else if (index == 7) {

         scrollDemoHelp('#d7');

         helpMessage.newMessageSeries({
            1:{'tL_s':2.0, 'message':"Pop the other pucks..."},
            2:{'tL_s':2.0, 'message':"Use your keyboard to move and shoot..."},
            3:{'tL_s':5.0, 'message':"move (w, a,d, s)\\  shoot (i, j,l, k)\\    shield (spacebar)\\      find you (?)..."},
            4:{'tL_s':3.0, 'message':"Place your middle fingers \\  on the \"w\" and \"i\" keys."}
         });
         helpMessage.loc_px    = {'x':15,'y':75};

         gameTitle.newMessage("Puck \\Popper", 1.0);
         gameTitle.loc_px =      {'x':15,'y':200};
         gameTitle.popAtEnd = true;

         scoreMessage.loc_px =   {'x':15,'y': 25};
         ppTimerMessage.loc_px = {'x':15,'y': 45};
         winMessage.loc_px =     {'x':15,'y':125};

         setNickNameWithoutConnecting();

         c.restitution_gOn =  0.6;
         c.friction_gOn =  0.0;

         c.restitution_gOff = 0.6;
         c.friction_gOff = 0.0;

         c.bulletAgeLimit_ms = 1000;

         if ((state_capture) && (state_capture.demoIndex == 7)) {
            networkPuckTemplate = restoreFromState( state_capture);

         } else {
            make_fence();

            // Normal pucks
            new Puck( new Vec2D(0.35, 0.35), new Vec2D( 0.0, 4.0), {'radius_m':0.25}); //   , 'categoryBits':'0x0000', 'maskBits':'0x0000', 'color':'pink'
            new Puck( new Vec2D(5.65, 0.35), new Vec2D( 0.0, 4.0), {'radius_m':0.25}); //   , 'categoryBits':'0x0000', 'maskBits':'0x0000', 'color':'pink'

            new Puck( new Vec2D(2.75, 0.35), new Vec2D(+2.0, 0.0), {'radius_m':0.25});
            new Puck( new Vec2D(3.25, 0.35), new Vec2D(-2.0, 0.0), {'radius_m':0.25});

            new Puck( new Vec2D(0.35, 5.65), new Vec2D(+2.0, 0.0), {'radius_m':0.25});
            new Puck( new Vec2D(5.65, 5.65), new Vec2D(-2.0, 0.0), {'radius_m':0.25});

            // Shelter
            //    Vertical part
            new Wall( new Vec2D( 3.0, 3.0), {'half_width_m':0.02, 'half_height_m':0.50});
            //    Horizontal part
            new Wall( new Vec2D( 3.0, 3.0), {'half_width_m':0.50, 'half_height_m':0.02});

            // Note the 'bullet_restitution':0.85 in what follows for the local and NPC client pucks. I have
            // also changed the 7b,c,d (captures) to include this parameter and value for all the driven pucks.

            // Puck for the local client (the host) to drive.
            var position_2d_m = new Vec2D(3.0, 4.5);
            var velocity_2d_mps = new Vec2D(0.0, 0.0);
            var pars = {'radius_m':0.30, 'color':'black', 'colorSource':true, 'clientName':'local', 'hitLimit':20, 'bullet_restitution':0.85, 'linDamp':1.0};
            if (dC.player.checked) {
               new Puck( position_2d_m, velocity_2d_mps, pars);
            } else {
               // Don't actually create a puck for the host. But collect parameters needed for creating the network pucks in a
               // way that reflects the birth parameters here.
               networkPuckTemplate = Object.assign({}, {'position_2d_m':position_2d_m, 'velocity_2d_mps':velocity_2d_mps}, pars);
            }

            // A 4-pin track for NPC client navigation.
            var pinRadius = 3;
            var e1 = 1.5, e2 = 4.5;
            p1 = new Pin( new Vec2D( e1, e1), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin4', 'name':'pin1', 'nextPinName':'pin2'});
            p2 = new Pin( new Vec2D( e2, e1), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin1', 'name':'pin2', 'nextPinName':'pin3'});
            p3 = new Pin( new Vec2D( e2, e2), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin2', 'name':'pin3', 'nextPinName':'pin4'});
            p4 = new Pin( new Vec2D( e1, e2), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin3', 'name':'pin4', 'nextPinName':'pin1'});

            // Add some local non-player clients (NPCs or drones) and their associated pucks to drive. Assign
            // a starting pin.
            new Client({'name':'NPC1', 'color':'purple'});
            new Puck( p1.position_2d_m, new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':'NPC1', 'hitLimit':20, 'pinName':'pin1', 'rayCast_init_deg':100,
                'bullet_restitution':0.85, 'linDamp':1.0} );
            //new Client({'name':'NPC2', 'color':'purple'});
            //new Puck( p3.position_2d_m, new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':'NPC2', 'linDamp':1.0, 'hitLimit':20, 'pinName':'pin3', 'rayCast_init_deg':-90} );

            // A 2-pin navigation track for a single client.
            //var p5 = new Pin( new Vec2D( 5.0, 2.5), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin6', 'name':'pin5', 'nextPinName':'pin6'});
            //var p6 = new Pin( new Vec2D( 5.0, 3.5), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin5', 'name':'pin6', 'nextPinName':'pin5'});
            //new Client({'name':'NPC3', 'color':'purple'});
            //new Puck( new Vec2D( 5.0, 2.5), new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':'NPC3', 'linDamp':1.0, 'hitLimit':20, 'pinName':'pin5', 'rayCast_init_deg':0} );

            // Make a one single-pin track and corresponding NPC client.
            //Client.makeNPCtracks(1, Pin.nameIndex + 1, Client.npcIndex + 1, new Vec2D( 1.0, 1.0));
         }

         Client.resetScores();

         if (state_capture && state_capture.startingPosAndVels) {
            c.startingPosAndVels = state_capture.startingPosAndVels;
         } else {
            c.startingPosAndVels = [ {'position_2d_m':new Vec2D(2.6, 3.4), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                     {'position_2d_m':new Vec2D(3.4, 3.4), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                     {'position_2d_m':new Vec2D(3.4, 2.6), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                     {'position_2d_m':new Vec2D(2.6, 2.6), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
         }
         createPucksForNetworkClients( networkPuckTemplate, c.startingPosAndVels);

         dC.extraDemos.innerHTML =
            "<a title='Puck Popper (1 drone on 4 pins)'  " + hL('7.a') + "  onclick=\"gW.clearState(); gW.demoStart(7)\">7a,</a>" +
            "<a title='2 drones on 4 pins'               " + hL('7.b') + "  onclick=\"gW.demoStart_fromCapture(7, {'fileName':'demo7b.js'})\">&nbsp;b,</a>" +
            "<a title='4 drones on 5 pins'               " + hL('7.c') + "  onclick=\"gW.demoStart_fromCapture(7, {'fileName':'demo7c.js'})\">&nbsp;c,</a>" +
            "<a title='1 drone on 2 pins'                " + hL('7.d') + "  onclick=\"gW.demoStart_fromCapture(7, {'fileName':'demo7d.js'})\">&nbsp;d&nbsp;</a>";

      } else if (index == 8) {

         canvas.width = 1250, canvas.height = 950;
         adjustSizeOfChatDiv('small');
         hC.resizeClients('small');
         // Set this module-level value to help new connecting clients adjust their layout.
         c.chatLayoutState = 'small';

         // Must do this AFTER the chat-div adjustment.
         scrollDemoHelp('#d8');

         helpMessage.newMessage("move (w, a,d, s)   shoot (i, j,l, k)   shield (spacebar)   find you (?)", 3.0);
         helpMessage.loc_px    = {'x':55,'y': 84};

         gameTitle.newMessage("Puck Popper", 1.0);
         gameTitle.loc_px =      {'x':55,'y':200};
         gameTitle.popAtEnd = true;

         scoreMessage.loc_px   = {'x':55,'y': 35};
         ppTimerMessage.loc_px = {'x':55,'y': 55};
         winMessage.loc_px =     {'x':55,'y':120};

         setNickNameWithoutConnecting();

         c.g_ON = false;
         dC.gravity.checked = false;

         c.restitution_gOn =  0.7;  //0.7
         c.friction_gOn =  0.6;

         // Keep the restitution 0.0 for gOff operation in all the 8 version demos. That way the drones fly
         // smoothly through the navigation channels in the terrain. setGravityRelatedParameters runs after
         // the drones are restored.
         c.restitution_gOff = 0.0;  //1.0
         c.friction_gOff = 0.6;

         //setGravityRelatedParameters({});

         c.bulletAgeLimit_ms = 1500;

         if ((state_capture) && (state_capture.demoIndex == 8)) {
            networkPuckTemplate = restoreFromState( state_capture);

         } else if (demo_8_fromFile) {
            // Don't need to parse here because read in from a file.
            networkPuckTemplate = restoreFromState( demo_8_fromFile);

            // Some little walls in the middle.
            /*
            new Wall( new Vec2D( 2.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02, 'angularSpeed_rps':3.14});
            new Wall( new Vec2D( 3.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 4.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02, 'angularSpeed_rps':3.14/2});
            new Wall( new Vec2D( 5.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 6.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02, 'angularSpeed_rps':3.14});
            new Wall( new Vec2D( 7.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 8.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02, 'angularSpeed_rps':3.14/2});
            */

            /*
            // Puck for the local client (the host) to drive.
            if (dC.player.checked) {
               new Puck( new Vec2D(3.0, 4.5), new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'black', 'colorSource':true, 'clientName':'local', 'linDamp':1.0, 'hitLimit':20} );
            }

            var pinRadius = 3;
            p1 = new Pin( new Vec2D( 1.0, 2.0), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin103', 'name':'pin101', 'nextPinName':'pin102'});
            p2 = new Pin( new Vec2D( 1.0, 4.0), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin101', 'name':'pin102', 'nextPinName':'pin103'});
            p3 = new Pin( new Vec2D( 1.0, 5.0), {'radius_px':pinRadius, 'NPC':true, 'previousPinName':'pin102', 'name':'pin103', 'nextPinName':'pin101'});
            */

            /*
            // Add some local non-player clients (NPCs)
            new Client({'name':'NPC3', 'color':'purple'});
            new Client({'name':'NPC4', 'color':'purple'});

            // Controllable pucks for these NPC clients; assign a starting pin.
            new Puck( new Vec2D( 1.0, 2.0), new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':'NPC3', 'linDamp':1.0, 'hitLimit':20, 'pinName':'pin102'} );
            new Puck( new Vec2D( 1.0, 2.0), new Vec2D(0.0, 0.0), {'radius_m':0.30, 'color':'darkblue', 'colorSource':false, 'clientName':'NPC4', 'linDamp':1.0, 'hitLimit':20, 'pinName':'pin103'} );
            */

            // Make a set of drones and single-pin navigation tracks (use editor to add more pins if wanted).
            //Client.makeNPCtracks(3, Pin.nameIndex + 1, Client.npcIndex + 1, new Vec2D( 1.0, 1.0));

         } else {

            makeJello({'pinned':true, 'gridsize':4});

            make_fence();

            // Some little walls in the middle.
            new Wall( new Vec2D( 2.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02, 'angularSpeed_rps':3.14/2});
            new Wall( new Vec2D( 3.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 4.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 5.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 6.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 7.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});
            new Wall( new Vec2D( 8.0, 0.5), {'half_width_m':0.4, 'half_height_m':0.02});

         }

         Client.resetScores();

         if (state_capture && state_capture.startingPosAndVels) {
            c.startingPosAndVels = state_capture.startingPosAndVels;
         } else {
            if        (c.demoVersion == '8.a') {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D( 9.34, 5.23), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(10.21, 7.61), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(10.21, 4.46), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D( 9.34, 6.84), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            } else if (c.demoVersion == '8.b') {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D(1.3, 2.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(2.0, 2.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(3.0, 2.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(4.0, 2.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            } else if (c.demoVersion == '8.c') {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D(2.77, 4.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(2.77, 3.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(2.77, 2.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(2.77, 1.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            } else if (c.demoVersion == '8.d') {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D(4.95, 4.91), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(5.95, 4.91), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(6.95, 4.91), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(7.95, 4.91), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            } else if (c.demoVersion == '8.e') {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D(2.0, 5.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(3.0, 5.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(4.0, 5.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(5.0, 5.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            } else {
               c.startingPosAndVels = [ {'position_2d_m':new Vec2D(2.0, 6.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(3.0, 6.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(4.0, 6.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)},
                                        {'position_2d_m':new Vec2D(5.0, 6.0), 'velocity_2d_mps':new Vec2D(0.0, 0.0)} ];
            }
         }
         createPucksForNetworkClients( networkPuckTemplate, c.startingPosAndVels);

         // Removing the old version of 8c (similar to 8b).
         // File is still out there for running from a URL query string. Old one runs as 8f now.
         dC.extraDemos.innerHTML =
           "<a title='Puck Popper (with jello)' " + hL('8.a') + " onclick=\"gW.clearState(); gW.demoStart(8)\" style='cursor: pointer'>8a,</a>" +
           "<a title='high-noon maze' " + hL('8.b') + " onclick=\"gW.demoStart_fromCapture(8, {'fileName':'demo8b.js'})\">&nbsp;b,</a>" +
           "<a title='wide open spaces (no drag)' " + hL('8.c') + " onclick=\"gW.demoStart_fromCapture(8, {'fileName':'demo8c.js'})\">&nbsp;c,</a>" +
           "<a title='bullet energy (no drag, and elastic collisions)' " + hL('8.d') +
                                                   " onclick=\"gW.demoStart_fromCapture(8, {'fileName':'demo8d.js'})\">&nbsp;d,</a>" +
           "<a title='target-leading demo (no recoil, no drag, and elastic collisions)' " + hL('8.e') +
                                                   " onclick=\"gW.demoStart_fromCapture(8, {'fileName':'demo8e.js'})\">&nbsp;e&nbsp;</a>";

      } else if (index == 9) {
         scrollDemoHelp('#d9');

         canvas.style.borderColor = 'black';

         c.restitution_gOn =  0.7;
         c.friction_gOn =  0.6;

         c.restitution_gOff = 1.0;
         c.friction_gOff = 0.6;

         if ((state_capture) && (state_capture.demoIndex == 9)) {
            restoreFromState( state_capture);

         } else {
            make_fence();

            // To simulate additive color mixing.
            ctx.globalCompositeOperation = 'screen'; // 'source-over' 'screen'

            // pucks
            var puckStart_2d_m = new Vec2D( 3.0, 3.0);
            var puckBasePars = {'radius_m':1.1, 'borderWidth_px':0, 'angleLine':false, 'colorSource':true, 'linDamp':1.0, 'angDamp':0.2, 'friction':1.0};
            // Green, Red, and Blue
            // Use Object.assign to make an independent pars object (a copy) that builds off the puckBasePars object. Note: it is important to
            // have the {} target in order to make a copy. If you use puckBasePars as the target, you'll just keep updating the reference to
            // puckBasePars (not good).
            new Puck( puckStart_2d_m, new Vec2D(+0.08, -0.04),   Object.assign({}, puckBasePars, {'name':'puck1', 'color':'#00ff00'}));
            new Puck( puckStart_2d_m, new Vec2D(-0.08, -0.04),   Object.assign({}, puckBasePars, {'name':'puck2', 'color':'#ff0000'}));
            new Puck( puckStart_2d_m, new Vec2D( 0.00,  0.0894), Object.assign({}, puckBasePars, {'name':'puck3', 'color':'#0000ff'}));

            // Springs between the three pucks
            var springPars = {'length_m':1.0, 'strength_Npm':25.0, 'unstretched_width_m':0.125, 'visible':false, 'damper_Ns2pm2':0.5,
                              'softContraints':true, 'collideConnected':false, 'color':'white'};
            new Spring( aT.puckMap['puck1'], aT.puckMap['puck2'], springPars);
            new Spring( aT.puckMap['puck2'], aT.puckMap['puck3'], springPars);
            new Spring( aT.puckMap['puck3'], aT.puckMap['puck1'], springPars);

            // Wait 5 seconds and then print out all the puck positions.
            //window.setTimeout(()=> Puck.applyToAll( (p) => console.log(p.name + ":" + p.position_2d_m.x + "," + p.position_2d_m.y) ), 5000);

            // Three weaker springs (on final-position pins) that bring the triangle back to a nice center position.
            var centeringSpringPars = {'length_m':0.0, 'strength_Npm':10.0, 'unstretched_width_m':0.05, 'visible':false, 'damper_Ns2pm2':0.5,
                                       'softContraints':true, 'collideConnected':false, 'color':'white'};
            p1 = new Pin( new Vec2D( 3.5, 2.711), {'visible':false, 'borderColor':'white', 'fillColor':'black'});
            p2 = new Pin( new Vec2D( 2.5, 2.711), {'visible':false, 'borderColor':'white', 'fillColor':'black'});
            p3 = new Pin( new Vec2D( 3.0, 3.577), {'visible':false, 'borderColor':'white', 'fillColor':'black'});
            new Spring( aT.puckMap['puck1'], p1, centeringSpringPars);
            new Spring( aT.puckMap['puck2'], p2, centeringSpringPars);
            new Spring( aT.puckMap['puck3'], p3, centeringSpringPars);
         }

         dC.extraDemos.innerHTML =
            "<a title='color mixer' " + hL('9.a') + " onclick=\"gW.clearState(); gW.demoStart(9)\">9a,</a>" +
            "<a title='colorful' " + hL('9.b') + " onclick=\"gW.demoStart_fromCapture(9, {'fileName':'demo9b.js'})\">&nbsp;b&nbsp;</a>";

      }
      console.log('c.demoVersion=' + c.demoVersion);
   }

   ///////////////////////////////////////////////////////
   // Initialize almost everything ///////////////////////
   ///////////////////////////////////////////////////////

   // init() is called from the index.html page. This delays the
   // execution of this code until after all the page elements have loaded in.

   function init() {
      popSounds = new PopSounds();

      // Demo specified in URL query string.
      var queryStringInURL = window.location.search;
      var demoFromURL = {};
      // e.g. www.timetocode.org/?7b  or  www.timetocode.org/index.html?7b
      if (queryStringInURL.length == 3) {
         // Take everything after the ?
         demoFromURL.file = 'demo' + queryStringInURL.slice(1) + '.js';
         // Take only the first character after the ?
         demoFromURL.index = queryStringInURL.slice(1,2);
      // e.g. www.timetocode.org/?7
      } else if (queryStringInURL.length == 2) {
         demoFromURL.index = queryStringInURL.slice(1,2);
      }

      // Make a world in Box2D

      // Constraint on space in world
      worldAABB = new b2AABB();
      worldAABB.lowerBound.Set(-20.0, -20.0);
      worldAABB.upperBound.Set( 20.0,  20.0);

      // b2d world: set gravity vector to 0, allow sleep.
      world = new b2World( new b2Vec2(0, -0.0), true);

      // Event handlers for Box2D. Get collision information.

      var listener = new Box2D.Dynamics.b2ContactListener;
      listener.BeginContact = function (contact) {
         // Use the table map to get a reference back to a gW object.
         var body_A = tableMap.get(contact.GetFixtureA().GetBody());
         var body_B = tableMap.get(contact.GetFixtureB().GetBody());
         //console.log("");
         //console.log("A=" + body_A.constructor.name);
         //console.log("B=" + body_B.constructor.name);

         // Set the wall color to that of the puck hitting it.
         if (body_A.constructor.name == "Wall" || body_B.constructor.name == "Wall") {
            if (body_B.constructor.name == "Puck") {
               var body_Puck = body_B, body_Wall = body_A;
            } else {
               var body_Puck = body_A, body_Wall = body_B;
            }

            // If it's a puck designated as a color source, use its client color for the wall.
            if (body_Puck.colorSource) {
               if (body_Puck.clientName && body_Wall.fence) {
                  body_Wall.color = clients[body_Puck.clientName].color;
               } else if (body_Wall.fence) {
                  body_Wall.color = body_Puck.color;
               }
            } else {
               // Reset the wall color to it's default.
               body_Wall.color = Wall.color_default;
            }
         } else if (body_A.constructor.name == "Puck" && body_B.constructor.name == "Puck") {
            //c.contactCounter++;

            // Handle the case where one body is a bullet and one is not.
            if ((body_A.bullet && !body_B.bullet) || (body_B.bullet && !body_A.bullet)) {

               if (body_A.bullet && !body_B.bullet) {
                  var bullet = body_A;
                  var target = body_B;
               } else if (body_B.bullet && !body_A.bullet) {
                  var bullet = body_B;
                  var target = body_A;
               }

               // Check for restrictions on friendly fire AND that both target and shooter are human.
               var friendlyFire = false;
               if (! dC.friendlyFire.checked) {
                  if (target.clientName && !target.clientName.includes('NPC') && !bullet.clientNameOfShooter.includes('NPC')) {
                     friendlyFire = true;
                  }
               }

               // Can't shoot yourself in the foot and can't be friendly fire.
               if ((bullet.clientNameOfShooter != target.clientName) && !friendlyFire) {
                  if (!target.shield.ON || (target.shield.ON && !target.shield.STRONG)) {
                     target.hitCount += 1;
                     target.inComing = true;
                     target.flash = true;
                     bullet.atLeastOneHit = true;

                     // Give credit to the shooter (owner of the bullet).
                     if (!Client.winnerBonusGiven && clients[ bullet.clientNameOfShooter]) {
                        clients[ bullet.clientNameOfShooter].score += 10;
                        // Keep track of the last successful hit to a client. Useful with multiple players and when friendly fire is blocked.
                        if (target.clientName) c.lastClientToScoreHit = bullet.clientNameOfShooter;
                     }
                     target.whoShotBullet = bullet.clientNameOfShooter;
                     // Remove credit from the puck that got hit (the not-bullet body).
                     if (!Client.winnerBonusGiven && target.clientName && clients[ target.clientName]) {
                        clients[ target.clientName].score -= 10;
                     }
                  }
               }
            }
         }
      }
      /*
      listener.EndContact = function (contact) {
         // Use the table map to get a reference back to a gW object.
         var body_A = tableMap.get(contact.GetFixtureA().GetBody());
         var body_B = tableMap.get(contact.GetFixtureB().GetBody());

         if (body_A.constructor.name == "Puck" && body_B.constructor.name == "Puck") {
            c.contactCounter--;
         }
      }
      */
      world.SetContactListener(listener);


      // Initialize the canvas display window.

      myRequest = null;
      resumingAfterPause = false;
      time_previous = performance.now(); // Initialize the previous time variable to now.
      canvas = document.getElementById('hostCanvas');
      canvasDiv = document.getElementById('hostCanvasDiv');

      ctx = canvas.getContext('2d');

      ppTimerMessage = new HelpMessage({'font':'14px Arial', 'color':'lightgray'});
      scoreMessage =   new HelpMessage({'font':'14px Arial', 'color':'lightgray'});
      helpMessage =    new HelpMessage({'font':'20px Arial', 'color':'lightgray'});
      winMessage =     new HelpMessage({'font':'20px Arial', 'color':'yellow'});
      gameTitle =      new HelpMessage({'font':'50px Arial', 'color':'lightgray'});
      videoTitle =     new HelpMessage({'color':'lightgray'});

      hostSelectBox = new SelectBox({});
      hostMSelect = new MultiSelect();

      // Miscellaneous pointers to DOM elements

      dC.json = document.getElementById('jsonCapture');

      /////////////////////////////////////////////////////
      // Event handlers for local client (user input)
      /////////////////////////////////////////////////////

      // Inhibit the context menu that pops up when right clicking (third button).
      // Do this on mainDiv to prevent the menu from appearing when you drag the
      // mouse off the canvas.
      var mainDiv = document.getElementById('mainDiv');
      mainDiv.addEventListener("contextmenu", function(e) {
         //console.log('contextmenu event');
         e.preventDefault();
         return false;
      }, {capture: false});

      // Start a listener for the mousemove event.
      //
      // Note: This call to addEventListener could be put (and was for a while) inside the mousedown handler.
      // Then, if there is a corresponding removeEventListen for this in the mouseup handler, effectively the
      // the mousemove listener would only run while a mouse button is down. That works out
      // nicely if you are using the native Windows cursor. But if you are drawing a cursor into
      // the canvas, you need to keep track of it even if the mouse isn't clicked down. I've commented
      // out the corresponding removeEventListen (in the mouseup handler) that is no longer in use.
      document.addEventListener("mousemove", handleMouseOrTouchMove, {capture: false});

      canvas.addEventListener("mousedown", function(e) {
         clients['local'].isMouseDown = true;

         // If there's been a click inside the canvas area, flag it as mouse usage for the local user (host).
         // Indirectly, this also prevents cell-phone users from getting flagged here unless they
         // touch the canvas before getting into virtual game pad.
         if ( pointInCanvas( clients['local'].mouse_2d_px)) clients['local'].mouseUsage = true;

         clients['local'].button = e.button;

         // Pass this first mouse position to the move handler. This will establish
         // the world position of the mouse.
         handleMouseOrTouchMove( e);

         // (Note: also see the checkForMouseSelection method in the Client prototype.)

         // Check for body at the mouse position. If nothing there, and shift (and alt) keys are UP, reset the
         // multi-select map. So, user needs to release the shift (and alt) key and click on open area to
         // flush out the multi-select.
         var selected_b2d_Body = b2d_getBodyAt( clients['local'].mouse_2d_m);
         var selectedBody = tableMap.get( selected_b2d_Body);

         if ((clients['local'].key_shift == "U") && (clients['local'].key_alt == "U") && (clients['local'].key_ctrl == "U")) {
            // Un-dash all the springs.
            Spring.findAll_InMultiSelect( spring => spring.dashedLine = false );

            // Clicked on blank space on air table (un-selecting everything)
            if (!selected_b2d_Body) {
               // Un-select everything in the multi-select map.
               hostMSelect.resetAll();
            }
         }

         // start a cursor-based selection box.
         if ((clients['local'].key_alt == 'D') && (clients['local'].key_ctrl == 'U') && ([0,1,2].includes(clients['local'].button)) && (!hostSelectBox.enabled)) {
            hostSelectBox.start();
            hostSelectBox.update();
         }

         // This prevents the middle mouse button from doing scrolling operations.
         e.preventDefault();

      }, {capture: false});

      canvas.addEventListener("touchstart", function(e) {
         // Note: e.preventDefault() not needed here if the following canvas style is set
         // touch-action: none;

         clients['local'].isMouseDown = true;
         clients['local'].button = 0;

         // Start a listener for the touchmove event.
         document.addEventListener("touchmove", handleMouseOrTouchMove, {passive: true, capture: false});
         //Pass this first mouse position to the move handler.
         handleMouseOrTouchMove(e);

      }, {passive: true, capture: false});

      function handleMouseOrTouchMove( e) {
         // Determine if mouse or touch.
         // Mouse
        /*
         var allData = { "mouseX" :  e.clientX, "mouseY" : e.clientY };
         $.ajax({
             url: "http://192.168.56.1:3000/mouse_move",
             type: "GET",
             dataType: "json",
             data: allData,
             success: function(data){
               console.log("sex");

             },
             error: function (request, status, error){
                console.log("gg");
             }
           });
           */
         if (e.clientX) {
            var raw_x_px = e.clientX;
            var raw_y_px = e.clientY;
         // Touch
         } else if (e.touches) {
            var raw_x_px = e.touches[0].clientX;
            var raw_y_px = e.touches[0].clientY;
         }
         // Prevent NaN (non numeric) values from getting processed. This can happen when the mouse is moved over
         // the left edge of the screen. A rapid mouse fling can lead to this.
         if (!isNaN( raw_x_px) && !isNaN( raw_y_px)) {

            clients['local'].mouse_2d_px = screenFromRaw_2d_px( canvas, new Vec2D( raw_x_px, raw_y_px));
            //helpMessage.newMessage('x,y='+clients['local'].mouse_2d_px.x+","+clients['local'].mouse_2d_px.y,0.1);
            clients['local'].mouseX_px = clients['local'].mouse_2d_px.x;
            clients['local'].mouseY_px = clients['local'].mouse_2d_px.y;

            clients['local'].mouse_2d_m = worldFromScreen( clients['local'].mouse_2d_px);
         }
      };

      document.addEventListener("mouseup", function(e) {
         // Remove focus from checkboxes after use (release mouse button). This is needed for
         // the canvas to get immediate attention when using the control and shift keys.
         dC.gravity.blur();
         dC.pause.blur();
         dC.comSelection.blur();
         dC.multiplayer.blur();
         dC.stream.blur();
         dC.player.blur();
         dC.editor.blur();
         dC.localCursor.blur();

         if (!clients['local'].isMouseDown) return;

         // Stop (using cpu) watching the mouse position.
         // Note the following code line is necessarily commented now that the mousemove listener is created
         // outside of the mousedown event.
         //document.removeEventListener("mousemove", handleMouseOrTouchMove, {capture: false});

         resetMouseOrFingerState( e);

         // Close the selection box.
         hostSelectBox.stop();

      }, {capture: false});

      canvas.addEventListener("touchend", function(e) {
         // Note: e.preventDefault() not needed here if the following canvas style is set
         // touch-action: none;

         if (!clients['local'].isMouseDown) return;

         // Stop (using cpu) watching the position.
         document.removeEventListener("touchmove", handleMouseOrTouchMove, {passive: true, capture: false});

         resetMouseOrFingerState(e);
      }, {passive: true, capture: false});

      function resetMouseOrFingerState(e) {
         clients['local'].isMouseDown = false;
         clients['local'].button = null;
         clients['local'].mouseX_m = null;
         clients['local'].mouseY_m = null;
      }

      var arrowKeysMap = {'key_leftArrow':'thinner', 'key_rightArrow':'wider', 'key_upArrow':'taller', 'key_downArrow':'shorter',
                          'key_[':'lessDamping', 'key_]':'moreDamping',
                          'key_-':'lessFriction',  'key_+':'moreFriction',
                          'key_-_':'lessFriction', 'key_=+':'moreFriction',
                          'key_lt':'lessDrag',     'key_gt':'moreDrag'};
      var allowDefaultKeysMap = {'key_-':null, 'key_+':null, 'key_-_':null, 'key_=+':null};

      document.addEventListener("keydown", function(e) {
         // Uncomment the following line for an easy test to see if the default key behavior can be inhibited.
         //e.preventDefault();

         //console.log(e.keyCode + " down/repeated, " + keyMap[e.keyCode]);

         // The following is necessary in Firefox to avoid the spacebar from re-clicking
         // page controls (like the demo buttons) if they have focus.
         // This also prevents some unwanted spacebar-related button behavior in Chrome.
         if ((document.activeElement.tagName != 'BODY') && (document.activeElement.tagName != 'INPUT')) {
            document.activeElement.blur();
         }
         //console.log("activeElement tagName = " + document.activeElement.tagName);

         /*
         Anything in this first group of blocks will repeat if the key is held down for a
         while. Holding it down will fire the keydown event repeatedly. Of course
         this area only affects the local client. Note there is another area in
         this code where repetition is avoided though use of the key_?_enabled
         attributes; search on key_s_enabled for example. That repetition is of
         a different nature in that it comes from action triggered by observing
         the key state (up/down) each frame.
         */

         // Note: the activeElement clause avoids acting on keystrokes while typing in the input cells in MS Edge.
         if ((e.keyCode in keyMap) && (document.activeElement.tagName != 'INPUT')) {
            // If you want down keys to repeat, put them here.

            // Inhibit default behaviors.
            if (['key_space', 'key_s', 'key_q', 'key_alt', 'key_questionMark'].includes( keyMap[e.keyCode])) {
               // Inhibit page scrolling that results from using the spacebar (when using puck shields)
               // Also inhibit repeat presses of the demo keys when using the spacebar.
               // Inhibit ctrl-s behavior in Firefox (save page).
               // Inhibit ctrl-q behavior in Edge (history panel).
               // Inhibit questionMark key behavior in Firefox (brings up text-search box)
               // Inhibit alt key behavior. Prevents a problem where if the alt key is depressed during the middle of a mouse drag, it
               // prevents the box select from working on the next try.
               e.preventDefault();

            } else if ((keyMap[e.keyCode] in arrowKeysMap) && !(keyMap[e.keyCode] in allowDefaultKeysMap)) {
               // Prevent page scrolling when using the arrow keys in the editor.
               e.preventDefault();

            } else if (keyMap[e.keyCode] == 'key_o') {
               if (! dC.pause.checked) {
                  setElementDisplay("fps_wrapper", "none");
                  setElementDisplay("stepper_wrapper", "inline");
               }
               stepAnimation();

            // Change body rotation when editing.
            } else if ((keyMap[e.keyCode] == 'key_t')) {

               hostMSelect.applyToAll( function( tableObj) {
                  if (clients['local'].key_shift == 'D') {
                     // Increase rate counterclockwise
                     var rotRate_change_dps = +5; // degrees per second
                  } else {
                     // Increase rate clockwise
                     var rotRate_change_dps = -5;
                  }
                  var current_rotRate_rps = tableObj.b2d.GetAngularVelocity();
                  var new_rotRate_rps = current_rotRate_rps + rotRate_change_dps*(Math.PI/180);
                  /*
                  If not currently rotating, will need to delete and recreate the body.
                  This is an oddity of b2d in that you can't change the rotation rate on
                  an existing kinematic body that currently is NOT rotating.
                  */
                  if ((tableObj.constructor.name == "Wall") && (current_rotRate_rps == 0.0)) {
                     // Make a temporary reference to the selected body.
                     var oldWall = tableObj;
                     // Delete the selected wall (this will delete it from the multi-select map also)
                     tableObj.deleteThisOne({});
                     // Point the client reference to a new wall. Rebuild the wall at the new rotational rate (all other parameters are equal to those of the old wall).
                     tableObj = new Wall( oldWall.position_2d_m,
                        {'half_width_m':oldWall.half_width_m, 'half_height_m':oldWall.half_height_m, 'angle_r':oldWall.angle_r, 'angularSpeed_rps':new_rotRate_rps});
                     // Add this new wall to the multi-select map.
                     hostMSelect.map[ tableObj.name] = tableObj;

                  } else {
                     tableObj.angularSpeed_rps = new_rotRate_rps;
                     tableObj.b2d.SetAngularVelocity( new_rotRate_rps);
                  }
               });
            }

            // Use the keys in the arrow-keys map to change the characteristics of the selected body.
            if (keyMap[e.keyCode] in arrowKeysMap) {

               // Multi-select
               if (hostMSelect.count() > 0) {
                  // Direct the edit actions at the springs (s key down)
                  if (clients['local'].key_s == 'D') {
                     // Arrow keys and page-up/page-down.
                     var mode = arrowKeysMap[ keyMap[e.keyCode]];
                     Spring.findAll_InMultiSelect( spring => spring.modify_fixture( mode) );
                  // All other object types
                  } else {
                     hostMSelect.applyToAll( msObject => {
                        if (msObject.constructor.name != "Pin") {
                           msObject.modify_fixture( arrowKeysMap[ keyMap[e.keyCode]]);
                        }
                     });
                  }
               }

               // Single-body selection (client spring)
               if (clients['local'].selectedBody) {
                  if (clients['local'].selectedBody.constructor.name != "Pin") {
                     clients['local'].selectedBody.modify_fixture( arrowKeysMap[ keyMap[e.keyCode]]);
                  }
               }
            }

            /*
            Keys that are held down will NOT repeat in this next block. Current key
            state must be UP before it will change the state to DOWN and perform the
            action. This is for cases where you are toggling the state of the
            client's key parameter. Also see comment paragraph on repetition above.
            */

            // If the current key state is UP...
            if (clients['local'][keyMap[e.keyCode]] == 'U') {

               // Set the key state to be DOWN.
               clients['local'][keyMap[e.keyCode]] = 'D';
               //console.log(e.keyCode + "(down)=" + keyMap[e.keyCode]);

               // Immediate execution on keydown (that's the event that got you in here.):

               if (keyMap[e.keyCode] == 'key_ctrl') {
                  // Turn COM selection OFF (better for the deterministic drag operations when control key is down.)
                  if (c.comSelection_previous.enabled) c.comSelection_previous.value = dC.comSelection.checked;
                  c.comSelection_previous.enabled = false;
                  dC.comSelection.checked = false;
                  comSelection_Toggle();

               } else if ((keyMap[e.keyCode] == 'key_c') && (clients['local'].key_ctrl != 'D')) {
                  dC.comSelection.checked = !dC.comSelection.checked;
                  comSelection_Toggle();

               } else if (keyMap[e.keyCode] == 'key_f') {
                  freeze();

               } else if (keyMap[e.keyCode] == 'key_r') {
                  stopRotation();

               } else if (keyMap[e.keyCode] == 'key_g') {
                  c.g_ON = !c.g_ON;
                  if (c.g_ON) {
                     dC.gravity.checked = true;
                  } else {
                     dC.gravity.checked = false;
                  }
                  setGravityRelatedParameters({'showMessage':true});

                  /*
                  // If there is only one fixture, m_fixtureList (a linked list) is a reference to that single fixture.
                  console.log(' ');
                  console.log("fixture count=" + aT.wallMap['wall1'].b2d.m_fixtureCount);
                  // also might want to look here: m_fixtureList, m_fixtureList.m_shape, m_fixtureList.m_shape.m_vertices
                  for (var x in aT.wallMap['wall1'].b2d.m_fixtureList) {
                     console.log("name=" + x);
                  }
                  */

               } else if (keyMap[e.keyCode] == 'key_m') {
                  dC.multiplayer.checked = !dC.multiplayer.checked;
                  toggleMultiplayerStuff();

               } else if (keyMap[e.keyCode] == 'key_n') {
                  hC.changeFullScreenMode(canvas, 'on');

               } else if (keyMap[e.keyCode] == 'key_e') {
                  dC.editor.checked = !dC.editor.checked;
                  toggleEditorStuff();

               } else if ((keyMap[e.keyCode] == 'key_p') && (clients['local'].key_shift != 'D')) {
                  dC.pause.checked = !dC.pause.checked;
                  setPauseState();

               // Toggle the default spring type
               } else if ((keyMap[e.keyCode] == 'key_s') && (clients['local'].key_shift == 'D')) {
                  c.softContraints_default = !c.softContraints_default;
                  if (c.softContraints_default) {
                     helpMessage.newMessage("springs: DISTANCE JOINT (soft constraints)", 1.0);
                  } else {
                     helpMessage.newMessage("springs: TRADITIONAL (Hooke's law)", 1.0);
                  }

               // Pause NPC navigation.
               } else if ((keyMap[e.keyCode] == 'key_q') && (clients['local'].key_ctrl == 'D')) {
                  c.npcSleep = !c.npcSleep;
                  if (c.npcSleep) {
                     // Keep track of this during game play.
                     c.npcSleepUsage = true;
                     helpMessage.newMessage("drones are sleeping", 1.0);
                  } else {
                     helpMessage.newMessage("drones are awake", 1.0);
                  }

               // Delete stuff
               } else if ((keyMap[e.keyCode] == 'key_x') && (clients['local'].key_ctrl == 'D')) {

                  // First process multi-select
                  var foundSpring = false;
                  if (hostMSelect.count() > 0) {

                     // Delete each spring that has both it's pucks (or pins) in the multi-select.
                     Spring.findAll_InMultiSelect( spring => {
                        spring.deleteThisOne({});
                        // This function includes the scope of the function in which is being defined.
                        // So foundSpring, defined in the surrounding function, is accessible (and changeable) here.
                        foundSpring = true;
                     });

                     // If springs have been cleared during first delete, now remove pucks, pins and walls that are still selected.
                     if (!foundSpring) {
                        hostMSelect.applyToAll( msObject => msObject.deleteThisOne({}) );
                     }

                  } else if (clients['local'].selectedBody) {
                     // A single-object selection.
                     clients['local'].selectedBody.deleteThisOne({'deleteMode':'fromEditor'}); // Pucks, pins, and walls all have there own version of this method.
                     clients['local'].selectedBody = null;
                     clients['local'].cursorSpring.deleteThisOne({});
                     clients['local'].cursorSpring = null;
                  }

               // Copy stuff
               } else if ((keyMap[e.keyCode] == 'key_c') && (clients['local'].key_ctrl == 'D')) {
                  if ((hostMSelect.count() > 0) && (hostMSelect.count() != 2)) {
                     helpMessage.newMessage( hostMSelect.count() + " selected; need 2 to select a spring", 1.0);
                  }
                  // Clear this out each time ctrl-c is used.
                  c.springNameForPasting = null;

                  // Copy a Spring for pasting.
                  // First deal with multi-select case (a length of 2 indicates trying to copy a spring)
                  if (hostMSelect.count() == 2) {
                     // Make a copy of the spring (if there is one connected to these two objects).
                     helpMessage.newMessage("2 selected, but no spring", 1.0);
                     Spring.findAll_InMultiSelect( spring => {
                        // Make a reference to this existing spring.
                        c.springNameForPasting = spring.name;
                        helpMessage.newMessage("2 selected, spring = " + spring.name, 3.0);
                        // De-select the source spring and its pucks (so the user doesn't have to click on empty space).
                        aT.springMap[ c.springNameForPasting].dashedLine = false;
                        hostMSelect.resetAll();
                     });

                  // Normal copying of an object that is identified by single-object selection
                  } else if (clients['local'].selectedBody) {
                     var cn = clients['local'].selectedBody.constructor.name;
                     if ((cn == "Wall") || (cn == "Pin") || (cn == "Puck")) {
                        // Put the copy a little to the right of the original. The engine will separate them
                        // if they overlap (colliding).
                        var pos_forCopy_2d_m = clients['local'].selectedBody.position_2d_m.addTo( new Vec2D(0.1, 0.0));
                        clients['local'].selectedBody.copyThisOne({'position_2d_m':pos_forCopy_2d_m});
                     }
                  }

               // Paste a spring onto a pair of pucks.
               } else if ((keyMap[e.keyCode] == 'key_s') && (clients['local'].key_ctrl == 'D')) {

                  var p = [];
                  hostMSelect.applyToAll( msObject => {
                     // Unselect the walls (don't allow the user to attach springs to the walls).
                     if (msObject.constructor.name == 'Wall') {
                        delete hostMSelect.map[ msObject.name];
                     } else {
                        // Populate the p array so you can pass the pucks and pins as parameters (see call to copyThisOne).
                        p.push( msObject);
                     }
                  });

                  // Only consider the case where there are two pucks selected.
                  if (hostMSelect.count() == 2) {
                     var deleteWarning = "";
                     var springToDelete = null;
                     if (c.springNameForPasting in aT.springMap) {
                        // Check each spring, between these two pucks in the multi-select, to see if trying to paste
                        // onto the same attachment points of an existing spring (don't allow multiple springs on the same points).
                        // Note: had to put the areEqual function at the module level because these point objects were sometimes
                        // losing their methods (it's a mystery).
                        Spring.findAll_InMultiSelect( spring => {
                           if (( Vec2D.areEqual( spring.spo1_ap_l_2d_m, p[0].selectionPoint_l_2d_m) &&  Vec2D.areEqual( spring.spo2_ap_l_2d_m, p[1].selectionPoint_l_2d_m) ) ||
                               ( Vec2D.areEqual( spring.spo2_ap_l_2d_m, p[0].selectionPoint_l_2d_m) &&  Vec2D.areEqual( spring.spo1_ap_l_2d_m, p[1].selectionPoint_l_2d_m) ) ) {
                              deleteWarning = spring.name + " deleted, ";
                              springToDelete = spring.name;
                           }
                        });
                        // Delete any spring attached in the same spots.
                        if (springToDelete) aT.springMap[ springToDelete].deleteThisOne({});
                        // Paste a copy of the source spring onto these two selected pucks (or pins).
                        var newSpringName = aT.springMap[ c.springNameForPasting].copyThisOne( p[0], p[1], "pasteSingle");

                        // If one of these is a NPC puck and the other a NPC navigation pin, supply the puck attributes needed for navigation.
                        if ((p[0].clientName) && (p[0].constructor.name == 'Puck') && (p[0].clientName.slice(0,3) == 'NPC') && (p[1].NPC)) {
                           p[0].navSpringName = newSpringName;
                           p[0].pinName = p[1].name;
                        } else if ((p[1].clientName) && (p[1].constructor.name == 'Puck') && (p[1].clientName.slice(0,3) == 'NPC') && (p[0].NPC)) {
                           p[1].navSpringName = newSpringName;
                           p[1].pinName = p[0].name;
                        }
                        helpMessage.newMessage(deleteWarning + newSpringName+' copied from '+c.springNameForPasting, 2.0);
                        // De-select the pasted spring (and other selected springs) and its pucks (so the user doesn't have to click on empty space).
                        Spring.findAll_InMultiSelect( spring => spring.dashedLine = false );
                        hostMSelect.resetAll();

                     } else {
                        helpMessage.newMessage('No spring was selected (maybe deleted)', 1.0);
                        c.springNameForPasting = null;
                     }
                  } else if ((hostMSelect.count() != 2) && (c.springNameForPasting in aT.springMap)) {
                     helpMessage.newMessage("Need 2 pucks to paste a spring; "+hostMSelect.count()+" selected", 1.0);
                  }

               // A general copy and paste of all the bodies in hostMSelect.
               } else if ((keyMap[e.keyCode] == 'key_v') && (clients['local'].key_ctrl == 'D')) {
                     //console.log('Trying to paste a compound body.');
                     hostMSelect.pasteCopyAtCursor();

               } else if ((clients['local'].key_shift == 'D') && (clients['local'].key_p == 'D') && (clients['local'].key_d == 'D')) {
                     // Make a single-pin drone track at the cursor location (for Puck Popper demos only).
                     if (c.demoIndex == 7 || c.demoIndex == 8) {
                        Client.makeNPCtracks(1, Pin.nameIndex + 1, Client.npcIndex + 1, clients['local'].mouse_2d_m);
                     } else {
                        helpMessage.newMessage('This feature is only available for demos 7 and 8 (Puck Popper).', 1.0);
                     }

               // numbers 0 to 9, run a demo
               } else if ((e.keyCode >= 48) && (e.keyCode <= 57)) {
                  if (document.activeElement.tagName == 'BODY') {
                     demoStart(e.keyCode - 48);
                  }
               }
            }
         }
      }, {capture: false}); //This "false" makes this fire in the bubbling phase (not capturing phase).

      document.addEventListener("keyup", function(e) {
         if (e.keyCode in keyMap) {
            // Set the key state to be UP.
            clients['local'][keyMap[e.keyCode]] = 'U';
            //console.log(e.keyCode + "(up)=" + keyMap[e.keyCode]);

         // numbers 0 to 9
         } else if ((e.keyCode >= 48) && (e.keyCode <= 57)) {

         }

         // Some specific actions.

         // Done with box-based selection.
         if (keyMap[e.keyCode] == 'key_alt') {
            hostSelectBox.stop();

         } else if (keyMap[e.keyCode] == 'key_ctrl') {
            // Done with the rotation action. Get ready for the next one.
            hostMSelect.resetCenter();
            // Done forcing non-COM state.
            dC.comSelection.checked = c.comSelection_previous.value;
            c.comSelection_previous.enabled = true;
            comSelection_Toggle();
         } else if (keyMap[e.keyCode] == 'key_shift') {
            // Done with the rotation action. Get ready for the next one.
            hostMSelect.resetCenter();
         }

      }, {capture: false}); //This "false" makes this fire in the bubbling phase (not capturing phase).


      // Gravity toggle
      dC.gravity = document.getElementById('chkGravity');
      function gravityToggle(e) {
         if (dC.gravity.checked) {
            c.g_ON = true;
         } else {
            c.g_ON = false;
         }
         setGravityRelatedParameters({'showMessage':true});
      }
      dC.gravity.addEventListener("click", gravityToggle, {capture: false});

      // COM (Center of Mass) selection toggle
      dC.comSelection = document.getElementById('chkCOM_Selection');
      function comSelection_Toggle(e) {
         if (dC.comSelection.checked) {
            // Change the attachment point of the cursor springs to be at the center of the selected body.
            Client.applyToAll( client => {if (client.selectedBody) client.cursorSpring.spo2_ap_l_2d_m = new Vec2D(0,0)});
         } else {
            // Change back to the actual selection points.
            Client.applyToAll( client => {if (client.selectedBody) client.cursorSpring.spo2_ap_l_2d_m = client.selectionPoint_l_2d_m});
         }
      }
      dC.comSelection.addEventListener("click", comSelection_Toggle, {capture: false});

      // Multi-player toggle
      dC.multiplayer = document.getElementById('chkMultiplayer');
      dC.multiplayer.addEventListener("click", toggleMultiplayerStuff, {capture: false});

      // Stream choke
      dC.stream = document.getElementById('chkStream');
      dC.stream.addEventListener("click", toggleStream, {capture: false});
      function toggleStream() {
         // Turn the stream On/Off.
         if (dC.stream.checked) {
            hC.setCanvasStream('on');
         } else {
            hC.setCanvasStream('off');
         }
      }

      // Player option
      dC.player = document.getElementById('chkPlayer');
      dC.player.addEventListener("click", toggleLocalPlayer, {capture: false});
      function toggleLocalPlayer() {
         if (dC.player.checked) {
            clients['local'].player = true;
         } else {
            clients['local'].player = false;
         }
      }

      // Friendly-fire option
      dC.friendlyFire = document.getElementById('chkFriendlyFire');

      // Editor checkbox
      dC.editor = document.getElementById('chkEditor');
      function toggleEditorStuff() {
         // The editor checkbox is mainly passive. No direct actions taken at this time.
      }
      dC.editor.addEventListener("click", toggleEditorStuff, {capture: false});

      // Pause toggle
      dC.pause = document.getElementById('chkPause');
      dC.pause.addEventListener("click", setPauseState, {capture: false});

      // Local cursor toggle
      dC.localCursor = document.getElementById('chkLocalCursor');
      dC.localCursor.checked = false;
      dC.localCursor.addEventListener("click", function() {
         if (dC.localCursor.checked) {
            canvas.style.cursor = 'default';
         } else {
            canvas.style.cursor = 'none';
         }
      }, {capture: false});

      // Fullscreen button (on host)
      dC.fullScreen = document.getElementById('btnFullScreen');
      dC.fullScreen.addEventListener("click", function() {
         hC.changeFullScreenMode(canvas, 'on');
      }, {capture: false});

      // For handling full-screen mode changes
      $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange msfullscreenchange', function(e) {
         // Check the state:
         // Starting fullscreen
         if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            console.log('fullscreen state: TRUE');
            canvas.style.borderWidth = '0px';

         // Exiting fullscreen
         } else {
            console.log('fullscreen state: FALSE');
            canvas.style.borderWidth = '5px';
         }
      });

      // The running average.
      aT.dt_RA_ms = new RunningAverage(60);
      dC.fps = document.getElementById("fps");

      dC.extraDemos = document.getElementById("extraDemos");

      // Add a local user to the clients dictionary.
      new Client({'name':'local', 'color':'tomato'});

      // Start the blank demo for frame rate testing.
      demoStart( 0);
      var fpsTestDelay = 1800;
      var startupDelay =  2000;

      // Wait about 2 seconds for the blank demo (#0) to settle in, then set the physics time-step (frame rate)
      // based on the observed display rate.
      helpMessage.newMessage('starting...', startupDelay/1000.0);
      window.setTimeout( function() {
         setFrameRateBasedOnDisplayRate();
      }, fpsTestDelay);

      window.setTimeout( function() {
         // Start the "ready" message about 0.5 seconds before the demo starts.
         helpMessage.newMessage('...ready.', 0.8);
      }, startupDelay - 500);

      // Now, about 0.2 seconds after the framerate measurement, start the demo.
      window.setTimeout( function() {
         if (demoFromURL.file) {
            demoStart_fromCapture( demoFromURL.index, {'fileName':demoFromURL.file});
         } else if (!demoFromURL.file && demoFromURL.index) {
            demoStart( demoFromURL.index);
         } else {
            demoStart( 9);
         }
      }, startupDelay);

   } // End of init()


   // It's alive. MuuuUUuuuAhhhh Haaaaaa Ha Ha Ha.
   function gameLoop( timeStamp_ms) {
      // Note: The time-stamp argument can have any name.

      dt_frame_ms = timeStamp_ms - time_previous;
      //dt_frame_ms = c.deltaT_s * 1000;
      //dt_frame_ms = 1000 * 1/60.0
      dt_frame_s = dt_frame_ms / 1000.0;

      if (resumingAfterPause || (dt_frame_s > 0.1)) {
         // Use the dt info saved in last frame before it was paused.
         dt_frame_ms = dt_frame_previous_ms;
         dt_frame_s = dt_frame_ms / 1000.0;
         time_previous = performance.now();
         resumingAfterPause = false;
      }

      if (c.dtFloating) c.deltaT_s = dt_frame_s;

      var dt_avg_ms = aT.dt_RA_ms.update( dt_frame_ms);

      // Report frame-rate every half second.
      if (aT.dt_RA_ms.totalSinceReport > 500.0) {
         dC.fps.innerHTML = (1/(dt_avg_ms/1000)).toFixed(0);
         aT.dt_RA_ms.totalSinceReport = 0.0;
      }

      // Draw the walls, step the engine, draw the pucks.
      updateAirTable();

      //console.log("timeStamp_ms = " + timeStamp_ms);
      //console.log("performance.now = " + performance.now());
      //console.log("dt_frame_ms = " + dt_frame_ms.toFixed(2) + " ms");

      time_previous = timeStamp_ms;
      dt_frame_previous_ms = dt_frame_ms

      //console.log("5");
      myRequest = window.requestAnimationFrame( gameLoop);
      if (c.singleStep) stopit();

   }

   function updateAirTable() {

      // Clear the canvas (from one corner to the other)
      if (ctx.globalCompositeOperation == 'screen') {
         ctx.clearRect(0,0, canvas.width, canvas.height);

         ctx.fillStyle = 'black';
         ctx.fillRect(0,0, canvas.width, canvas.height);

      } else {
         ctx.fillStyle = c.canvasColor;
         ctx.fillRect(0,0, canvas.width, canvas.height);
      }

      // Calculate the state of the objects.
      world.Step( c.deltaT_s, 10, 10);  // dt_frame_s c.deltaT_s
      world.ClearForces();

      // Draw the walls first (render these on the bottom).
      Wall.applyToAll( wall => {
         wall.updateState();
         wall.draw();
      });

      /*
      Leaving this commented block here as an example of a technique for deleting elements
      from an array when looping over it.

      // Clean out old bullets and unhealthy pucks. Note this loops
      // in reverse order over the array to avoid indexing problems as the
      // array elements are deleted.
      for (var j = aT.pucks.length - 1; j >= 0; j--) {
         if (aT.pucks[j].bullet) {
            var age_ms = window.performance.now() - aT.pucks[j].createTime;
            if (age_ms > aT.pucks[j].ageLimit_ms) {
               deletePuckAndParts( aT.pucks[j]);
               aT.pucks.splice(j, 1);
            }
         } else if (aT.pucks[j].poorHealthFraction >= 1.0) {
            deletePuckAndParts( aT.pucks[j]);
            aT.pucks.splice(j, 1);
         }
      }
      */

      // Clean out old bullets and unhealthy pucks.
      if (c.demoIndex == 7 || c.demoIndex == 8) {
         Puck.applyToAll( puck => {
            if (puck.bullet) {
               //var age_ms = window.performance.now() - puck.createTime;
               puck.age_ms += c.deltaT_s * 1000;
               if (puck.age_ms > puck.ageLimit_ms) {
                  // First penalize the shooter if no hits by this bullet.
                  if ((!puck.atLeastOneHit) && (!Client.winnerBonusGiven)) {
                     // Make sure the client is still there...
                     if (clients[ puck.clientNameOfShooter]) {
                        // Now the penalty.
                        clients[ puck.clientNameOfShooter].score -= 1;
                     }
                  }

                  // Then remove it.
                  puck.deleteThisOne({});
               }
            } else if (puck.poorHealthFraction >= 1.0) {
               puck.deleteThisOne({});
            }
         });
      }

      Puck.applyToAll( puck => {
         puck.updateState();
         puck.draw();
      });

      Spring.applyToAll( spring => {
         // If either puck/pin has been deleted, remove the spring.
         if (spring.spo1.deleted || spring.spo2.deleted) {
            // Remove this spring from the spring map.
            spring.deleteThisOne({});
         } else {
            // Otherwise, business as usual.
            spring.force_on_pucks();
            spring.draw();
         }
      });

      Pin.applyToAll( pin => pin.draw() );

      if ((c.demoIndex == 6) && (aT.jelloPucks.length > 0)) {
         checkForJelloTangle();
      }

      // Jets and Guns
      Client.applyToAll( client => {
         if (client.puck) {
            // Tell the NPCs what to do.
            if (client.name.slice(0,3) == 'NPC') {
               if (!c.npcSleep) client.thinkForNPC();
            }
            // Respond to client controls, calculate corresponding jet and gun recoil forces, and draw.
            client.puck.jet.updateAndDraw();
            client.puck.gun.updateAndDraw();
         }
      });

      // Draw a marking circle on each object in the multi-select map.
      if (hostMSelect.count() > 0) {
         hostMSelect.applyToAll( msObject => msObject.draw_MultiSelectPoint() );
      }

      // Dash the lines of the selected springs.
      Spring.findAll_InMultiSelect( spring => spring.dashedLine = true );

      // Consider all client-mouse influences on a selected object.
      Client.applyToAll( client => {
         // Check to see if the mouse button is down and if there's a body under the cursor.
         // Select it and/or add it to the multi-select group.
         client.checkForMouseSelection();

         // Note that network clients are NOT allowed to select walls and pins (see checkForMouseSelection).
         // So only the local client will get into the following block in those (wall and pin) cases.
         if (client.selectedBody) {
            // World position of selection points are needed for direct movements and for spring calculations.
            client.updateAndDrawSelectionPoint();

            var bodyType = client.selectedBody.b2d.GetType();

            // Direct movement.
            // This is default for walls and pins. Need to use the control key for pucks.
            if ((client.key_ctrl == 'D') || (bodyType == b2Body.b2_kinematicBody)) {

               // Translation
               if ((client.key_shift == 'U') && (client.key_alt == 'U')) {
                  client.moveToCursorPosition();

               // Rotation
               } else if (client.key_shift == 'D') {
                  client.rotateToCursorPosition();

               } else if (client.key_alt == 'D') {
                  client.rotateEachAboutItself();
               }
            }
         }
         // Draw a cursor for the local and network clients.
         if ((client.name.slice(0,1) == 'u') || (client.name == 'local')) {
            client.drawCursor();
         }
      });

      // Sum up all the forces and apply them to the pucks.
      Puck.applyToAll( puck => puck.applyForces() );

      if (c.demoIndex == 7 || c.demoIndex == 8) {
         checkForPuckPopperWinnerAndReport();
      }

      helpMessage.displayIt();
      gameTitle.displayIt();
      winMessage.displayIt();
      // See demo #0
      if (videoTitle) videoTitle.displayIt();

      // Display the selection box.
      if (hostSelectBox.enabled) {
         hostSelectBox.update();
         hostSelectBox.draw();
      }
   }


   // Reveal public pointers to private functions and properties.
   // Note: the clients object is revealed as expected, but had to make a getChatLayoutState
   //       function to reveal the c.chatLayoutState value. You can directly reveal the c object but not
   //       c.something. Must reveal either an object or function, not a simple variable.
   // All the other entries below are functions.
   return {
      Vec2D: Vec2D,
      screenFromRaw_2d_px: screenFromRaw_2d_px,
      drawLine: drawLine,
      drawCircle: drawCircle,
      startit: startit,
      stopit: stopit,
      setFrameRate: setFrameRate,
      init: init,
      freeze: freeze,
      stepAnimation: stepAnimation,
      stopRotation: stopRotation,
      reverseDirection: reverseDirection,
      createNetworkClient: createNetworkClient,
      deleteNetworkClient: deleteNetworkClient,
      updateClientState: updateClientState,
      toggleElementDisplay: toggleElementDisplay,
      toggleSpanValue: toggleSpanValue,
      saveState: saveState,
      clearState: clearState,
      cleanCapture: cleanCapture,
      scrollDemoHelp: scrollDemoHelp,
      adjustSizeOfChatDiv: adjustSizeOfChatDiv,
      openDemoHelp: openDemoHelp,
      clients: clients,
      deleteRTC_onHost: deleteRTC_onHost,
      deleteRTC_onClientAndHost: deleteRTC_onClientAndHost,
      getChatLayoutState: getChatLayoutState,
      demoStart_fromCapture: demoStart_fromCapture,
      demoStart: demoStart
   };

})();;
