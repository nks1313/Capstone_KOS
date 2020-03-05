// Host and Client (hC) Module
// hostAndClient.js
// Version 2.2.0 (9:50 PM Tue August 21, 2018)
// Written by: James D. Miller

// This module is dependent on gwModule.js (referenced here as gW).

var hC = (function() {

    // To insist on tighter code: e.g. globals, etc...
    "use strict";
 
    // A few globals within hC. /////////////////////////////////////////////////
 
    var socket = null;
    var nodeServerURL, serverArray;
    var chatStyleToggle = true;
 
    var timer = {};
    timer.start = null;
    timer.end = null;
    timer.pingArray = [];
 
    var clientCanvas, ctx;
    var clientCanvas_tt, ctx_tt;
    var videoMirror, videoStream;
    var chkRequestStream, chkLocalCursor;
 
    var chkTwoThumbs, btnTwoThumbs, twoThumbs;
    var btnFullScreen;
    var chkPlayer;
 
    var myRequest;
 
    // Key values.
    var keyMap = {'49':'1', '50':'2', '51':'3', '52':'4', '53':'5', '54':'6', '55':'7', '56':'8', '57':'9',
                  '70':'f',
                  '65':'a', '83':'s', '68':'d', '87':'w',
                  '74':'j', '75':'k', '76':'l', '73':'i',
                  '16':'sh','32':'sp',  //sh:shift, sp:space
                  '191':'cl'};  // cl (short for color), 191 is the question-mark key.
    // Mouse and keyboard (mK) from non-host clients.
    var mK = {};
    mK.name = null;
 
    // Key values, cso (client side only) for use only by the client, not to be sent over network
    // to the host.
    var keyMap_cso = {'16':'key_shift', '17':'key_ctrl', '27':'key_esc', '80':'key_p'}
    var mK_cso = {};
 
 
    // The client name of this user. This global is only used on the client page and
    // is some increment of u1, u2, etc for network clients.
    var newClientName = null;
    // cl is a global that points at a "Client" or clientlike object. For the host, this will point at the
    // "Client" object of the client that most recently attempts to connect. On the client page,
    // this will simply keep this structure and replace the 'notyetnamed' with the name of that
    // client.
    var cl = {'name':null, 'previous_name':null};
    var rtc_choke = false;
 
    var fileName = "hostAndClient.js";
 
    // Pacifier (connecting status) string for connecting...
    var pacifier = {};
 
    // Switch to enable debugging...
    var db = {};
    // ...of the WebRTC stuff.
    db.rtc = false;
 
    var gameReportCounter = 0;
 
    //////////////////////////////////////////////////
    // Object prototypes
    //////////////////////////////////////////////////
 
    function RTC( pars) {
       this.user1 = setDefault( pars.user1, null);
       this.user2 = setDefault( pars.user2, null);
       this.streamRequested = setDefault( pars.streamRequested, null);
 
       this.pc = null;
       this.dataChannel = null;
    }
    RTC.prototype.shutdown = function() {
       //console.log('pc:'+JSON.stringify(this.pc));
       //console.log('dataChannel:'+JSON.stringify(this.dataChannel));
 
       // Close then nullify any references to the datachannel and the p2p connection.
       if (this.dataChannel) {
          this.dataChannel.close();
       }
       if (this.pc) {
          var senders = this.pc.getSenders();
          if (senders.length >= 1) {
             //console.log('senders length = ' + senders.length);
             this.pc.removeTrack( senders[0]);
 
             senders = this.pc.getSenders();
             //console.log('senders length = ' + senders.length);
          }
          this.pc.close();
       }
       if (this.dataChannel) {
          this.dataChannel = null;
       }
       if (this.pc) {
          this.pc = null;
       }
    }
    // This method works only on the host side of the WebRTC connection. So, that's why there's a check here
    // to see if user1 is the host.
    RTC.prototype.turnVideoStreamOff = function() {
       if (this.pc && (this.user1 == 'host')) {
          var senders = this.pc.getSenders();
          //console.log('senders length (before) = ' + senders.length);
          if (senders.length >= 1) {
             this.pc.removeTrack( senders[0]);
             //senders = this.pc.getSenders();
             //console.log('senders length (after) = ' + senders.length);
          }
       }
    }
 
 
    function TwoThumbs( pars) {
       // Not yet using this adjustment point feature (TBD).
       this.adjustmentPoint_2d = new gW.Vec2D(0, 0);
       this.enabled = false;
 
       // Grid of rectangles.
       this.grid = {
          'jet_360':     {'active':false , 'mK':'w',   'UL':null, 'LR':null, 'dir_2d':null},
          'gun_360':     {'active':false , 'mK':'i',   'UL':null, 'LR':null, 'dir_2d':null},
          'shield':      {'active':false , 'mK':'sp',  'UL':null, 'LR':null},
          'color':       {'active':false , 'mK':'cl',  'UL':null, 'LR':null},
 
          'alt':         {'active':false , 'mK':null,  'UL':null, 'LR':null},
 
          // Controls that are dependent on the alt rectangle being touched.
          'esc':         {'active':false , 'mK':null,  'UL':null, 'LR':null},
          'demo7':       {'active':false , 'mK':'7',   'UL':null, 'LR':null},
          'demo8':       {'active':false , 'mK':'8',   'UL':null, 'LR':null},
          'freeze':      {'active':false , 'mK':'f',   'UL':null, 'LR':null},
 
          // Secondary control that fires the gun. Changes angle by controlling the rotation rate.
          'gun_scope':   {'active':false , 'mK':'ScTr','UL':null, 'LR':null}
       };
 
       // This is the same for both the jet and the gun.
       this.dirDotRadius_fraction =  0.020;
 
       // Control radius in units of screen fraction. The jet has four
       // strength levels: <1, >1 && <2, >2 && <3, >3.
       this.grid['jet_360'].cRadius_1_f = 0.090;
       this.grid['jet_360'].cRadius_2_f = 0.130;
       this.grid['jet_360'].cRadius_3_f = 0.170;
 
       this.jetRadiusColor_3 = "rgb(255,   0,   0)";
       this.jetRadiusColor_2 = "rgb(200,   0,   0)";
       this.jetRadiusColor_1 = "rgb(140,   0,   0)";
       this.jetRadiusColor_0 = "rgb( 50,   0,   0)";
 
       // The gun has zero level, for bluffing. All touches outside that ring
       // are firing.
       this.grid['gun_360'].cRadius_0_f = 0.060;
 
       this.gunRadiusColor_0 = "rgb(255,   0,   0)";
 
       this.bgColor = 'lightgray';
       this.gridColor = '#232323'; // very dark gray // #008080 dark green
       clientCanvas_tt.style.borderColor = this.gridColor;
 
       // 0.10 uses 10% of the rectangle width for the dead spot.
       this.scopeShootSpot = 0.20;
 
       this.updateAndDrawTouchGrid('updateOnly');
    }
    // Calculate point position in canvas coordinates as a function of fractional position.
    TwoThumbs.prototype.absPos_x_px = function( fraction) {
       return Math.round(fraction * clientCanvas_tt.width);
    }
    TwoThumbs.prototype.absPos_y_px = function( fraction) {
       return Math.round(fraction * clientCanvas_tt.height);
    }
    TwoThumbs.prototype.resetRectangle = function( rectName) {
       var rect = this.grid[ rectName];
       // The alt rectangle cases:
       if ((rectName =='esc' || rectName =='demo7' || rectName =='demo8' || rectName =='freeze')) {
          if (this.grid['alt'].active) {
             this.updateDirectionDot( rectName, this.gridColor);
          } else {
             this.updateDirectionDot( rectName, this.bgColor);
          }
       // The others...
       } else {
          if ((rectName == 'alt') || (rectName == 'shield')) {
             this.updateDirectionDot( rectName, this.gridColor);
 
          } else if (rectName == 'color') {
             if (cl.name) this.colorClientRect( clientColor( cl.name));
 
          } else if (rectName == 'jet_360') {
             this.updateDirectionDot( rectName, this.gridColor);
             mK.jet_d = null; // jet angle in degrees
 
          } else if (rectName == 'gun_360') {
             this.updateDirectionDot( rectName, this.gridColor);
             mK.gun_d = null; // gun angle in degrees
 
          } else if (rectName == 'gun_scope') {
             this.updateDirectionDot( rectName, this.gridColor);
             // Rotation rate fraction.
             mK.ScRrf = 0.00;
          }
       }
       // For all rectangles: deactivate and reset the primary mK attribute for that square.
       rect.active = false;
       if (rect.mK) mK[rect.mK] = 'U';
    }
    TwoThumbs.prototype.processMultiTouch = function( touchVectors_2d_px) {
       for (var rectName in this.grid) {
          var rect = this.grid[ rectName];
 
          var atLeastOnePointInRect = false;
          for (var i = 0, len = touchVectors_2d_px.length; i < len; i++) {
             var p_2d = touchVectors_2d_px[i];
 
             if ( (p_2d.x > rect.UL.x) && (p_2d.x < rect.LR.x) && (p_2d.y > rect.UL.y) && (p_2d.y < rect.LR.y) ) {
                this.updateRectangle( rectName, p_2d);
                atLeastOnePointInRect = true;
                break;
             }
          }
          if (!atLeastOnePointInRect) {
             this.resetRectangle( rectName);
          }
       }
       handle_sending_mK_data( mK);
    }
    TwoThumbs.prototype.processSingleTouchRelease = function( touchVector_2d_px) {
       for (var rectName in this.grid) {
          var rect = this.grid[ rectName];
          var p_2d = touchVector_2d_px;
          if ( (p_2d.x > rect.UL.x) && (p_2d.x < rect.LR.x) && (p_2d.y > rect.UL.y) && (p_2d.y < rect.LR.y) ) {
 
             this.resetRectangle( rectName);
 
             // When you release the alt rectangle, show as sleeping (not listening),
             // those rectangles that are dependent on the alt rectangle.
             if (rectName == 'alt') {
                this.updateDirectionDot('esc',   this.bgColor);
                this.updateDirectionDot('demo7', this.bgColor);
                this.updateDirectionDot('demo8', this.bgColor);
                this.updateDirectionDot('freeze',this.bgColor);
             }
             break;
          }
       }
    }
    TwoThumbs.prototype.updateDirectionDot = function( rectName, dirDotColor) {
       var rect = this.grid[ rectName];
       // Draw a square over the prior direction dot. This prevents a jagged edge when the direction
       // dot is drawn. And is a little more efficient then drawing the whole rectangle for each update.
       ctx_tt.fillStyle = this.bgColor;
       // The eraser rectangle is one pixel larger than the dot on each side.
       //              -----------upper left corner------------------------------------------------------------, -----width--------------------, ----height---------------------
       ctx_tt.fillRect(rect.center_2d.x - this.dirDotRadius_px - 1, rect.center_2d.y - this.dirDotRadius_px - 1, (this.dirDotRadius_px * 2) + 2, (this.dirDotRadius_px * 2) + 2);
 
       if (dirDotColor != this.bgColor) {
          // Draw the dot.
          gW.drawCircle( ctx_tt, rect.center_2d, {'radius_px':this.dirDotRadius_px, 'fillColor':dirDotColor} );
       }
    }
    TwoThumbs.prototype.updateRectangle = function( rectName, point_2d) {
       var rect = this.grid[ rectName];
       var dirDotColor;
 
       var relativeToCenter_2d = point_2d.subtract( rect.center_2d);
 
       if (rectName == 'jet_360' || rectName == 'gun_360') {
          var rTC_lengthSquared = relativeToCenter_2d.length_squared();
          // Orient dir_2d to match the direction of relativeToCenter_2d
          // Note the negative sign correction (on the angle result) is necessary because of the
          // negative orientation of the y axis with the screen (pixels) representation (not world here).
          var angle_d = -rect.dir_2d.matchAngle( relativeToCenter_2d);
          // End point for drawing the orientation vector
          var endPoint_2d = rect.center_2d.add( rect.dir_2d);
 
          if (rectName == 'jet_360') {
             // Check where the point is relative to the control rings.
 
             // Always use at least the minimum jet power.
             dirDotColor = this.jetRadiusColor_0;
             mK.jet_t = 0.1; // Jet throttle
 
             // Stronger jet
             if (rTC_lengthSquared > Math.pow(this.grid['jet_360'].cRadius_1_px, 2)) {
                dirDotColor = this.jetRadiusColor_1;
                mK.jet_t = 0.4;
 
                // Even stronger jet
                if (rTC_lengthSquared > Math.pow(this.grid['jet_360'].cRadius_2_px, 2)) {
                   dirDotColor = this.jetRadiusColor_2;
                   mK.jet_t = 0.7;
 
                   // Even stronger jet
                   if (rTC_lengthSquared > Math.pow(this.grid['jet_360'].cRadius_3_px, 2)) {
                      dirDotColor = this.jetRadiusColor_3;
                      mK.jet_t = 1.0;
                   }
                }
             }
             // Update mK for sending to the host.
             mK.w = 'D';
             mK.jet_d = angle_d + 0; // + 180 to reverse it...
 
          } else if (rectName == 'gun_360') {
             // Check is the point is outside the control ring...
             if (rTC_lengthSquared > Math.pow(this.grid['gun_360'].cRadius_0_px, 2)) {
                dirDotColor = this.gunRadiusColor_0;
                mK.i = 'D';
             } else {
                dirDotColor = this.gridColor;
                mK.i = 'U';
             }
             // Update mK for sending to the host.
             mK.gun_d = angle_d;
          }
 
          this.updateDirectionDot( rectName, dirDotColor);
          // Draw the direction line.
          gW.drawLine(   ctx_tt, rect.center_2d, endPoint_2d, {'width_px':3, 'color':'white'} );
 
       } else if (rectName == 'shield') {
          if (rect.mK) mK[rect.mK] = 'D';
          this.updateDirectionDot( rectName, 'yellow');
 
       } else if (rectName == 'color') {
          //           mK.cl       = 'D'
          if (rect.mK) mK[rect.mK] = 'D';
          this.colorClientRect( this.bgColor);
 
       } else if (rectName == 'gun_scope') {
          // Rotation rate fraction (Rrf) for the scope control (Sc), where x_fraction varies
          // from -1 to +1;
          var x_fraction = relativeToCenter_2d.x / ((rect.LR.x - rect.UL.x)/2.0);
          var x_fraction_abs = Math.abs( x_fraction);
          if (x_fraction_abs > 0) {
             var x_fraction_sign = x_fraction / x_fraction_abs;
          } else {
             var x_fraction_sign = 1.0;
          }
 
          // Shooting spot in the middle where it will only shoot, not rotate.
          if (x_fraction_abs < this.scopeShootSpot) {
             var x_fraction_mapped = 0.00;
             mK[rect.mK] = 'D';
             this.updateDirectionDot( rectName, 'red');
 
          // The outer areas will only rotate, not shoot.
          } else {
             // Map the x_fraction value so that near the edge of the dead zone, the rate is small. At the
             // outer edge of the rectangle, the rate is 1.5 times the normal keyboard rotation rate.
             var x_fraction_mapped = x_fraction_sign * (x_fraction_abs - this.scopeShootSpot - 0.01) * 1.0;
             mK[rect.mK] = 'U';
             this.updateDirectionDot( rectName, 'yellow');
          }
 
          mK['ScRrf'] = x_fraction_mapped.toFixed(2);
 
       } else if (rectName == 'alt') {
          this.updateDirectionDot( rectName, 'yellow');
          // Show the alt-dependent rectangles as awake (ready to receive a touch). Don't do this
          // if the alt rectangle is already active. This check is necessary to allow the alt keys
          // to show yellow after they are touched. Remember, the updateRectangle function fires
          // twice when using the alt feature.
          if (!this.grid['alt'].active) {
             this.updateDirectionDot('esc',   this.gridColor);
             this.updateDirectionDot('demo7', this.gridColor);
             this.updateDirectionDot('demo8', this.gridColor);
             this.updateDirectionDot('freeze',this.gridColor);
          }
 
       // Must use the alt button for these:
       } else if (this.grid['alt'].active && (rectName =='esc' || rectName =='demo7' || rectName =='demo8' || rectName =='freeze')) {
          if (rectName =='esc') {
             clientCanvas_tt.width  = videoMirror.width;
             clientCanvas_tt.height = videoMirror.height;
             // Note: the alt and esc rectangles get "released" in this call to changeDisplay.
             this.changeDisplay('exit');
             return;
          }
          if (rect.mK) mK[rect.mK] = 'D';
          this.updateDirectionDot( rectName, 'yellow');
       }
 
       // No matter what, set this rectangle to be active.
       rect.active = true;
    }
    // Color the rectangle that indicates the client color.
    TwoThumbs.prototype.colorClientRect = function( color) {
       // Draw this a little smaller than the actual rectangle.
       var shrink_px = 8;
       var ULx = this.grid['color'].UL.x + shrink_px;
       var ULy = this.grid['color'].UL.y + shrink_px;
       var LRx = this.grid['color'].LR.x - shrink_px;
       var LRy = this.grid['color'].LR.y - shrink_px;
 
       var width_px = LRx - ULx;
       var height_px = LRy - ULy;
 
       ctx_tt.fillStyle = color;
       ctx_tt.fillRect(ULx, ULy, width_px, height_px);
    }
    TwoThumbs.prototype.updateAndDrawTouchGrid = function( mode) {
       ctx_tt.fillStyle = this.bgColor;
       ctx_tt.fillRect(0,0, clientCanvas_tt.width, clientCanvas_tt.height);
 
       this.adjustmentPoint_2d.x = this.absPos_x_px( 0.47);
       this.adjustmentPoint_2d.y = this.absPos_y_px( 0.90);
 
       this.dirDotRadius_px = this.absPos_x_px(this.dirDotRadius_fraction);
 
       this.grid['jet_360'].cRadius_1_px = this.absPos_x_px(this.grid['jet_360'].cRadius_1_f);
       this.grid['jet_360'].cRadius_2_px = this.absPos_x_px(this.grid['jet_360'].cRadius_2_f);
       this.grid['jet_360'].cRadius_3_px = this.absPos_x_px(this.grid['jet_360'].cRadius_3_f);
 
       this.grid['gun_360'].cRadius_0_px = this.absPos_x_px(this.grid['gun_360'].cRadius_0_f);
 
       // x position of the vertical lines (from left to right).
       var x0 = this.absPos_x_px( 0.00);
       var x0a = this.absPos_x_px( 0.10);
       var x0b = this.absPos_x_px( 0.20);
       var x0c = this.absPos_x_px( 0.30);
       var x0d = this.absPos_x_px( 0.315);
       var x0e = this.absPos_x_px( 0.455);
 
       var x1 = this.adjustmentPoint_2d.x;
       var x2 = this.absPos_x_px( 0.60);    // ...1.00) - this.adjustmentPoint_2d.x;
       var x3 = this.absPos_x_px( 1.00);
       // Center +/- the half width of the scope spot.
       var x2a = (x3 + x2)/2.0 - ((x3-x2) * this.scopeShootSpot/2.0);
       var x2b = (x3 + x2)/2.0 + ((x3-x2) * this.scopeShootSpot/2.0);
 
       // y position of the horizontal lines (from top to bottom).
       var y0 = this.absPos_y_px( 0.00);
       var y0a = this.absPos_y_px( 0.65);
       var y0b = this.absPos_y_px( 0.85);
       var y1 = this.adjustmentPoint_2d.y;
       var y2 = this.absPos_y_px( 1.00);
 
       // Define all the rectangles in the grid. UL: upper left, LR: lower right.
       this.grid['jet_360'].UL = new gW.Vec2D(x0, y0);
       this.grid['jet_360'].LR = new gW.Vec2D(x1, y1);
       this.grid['jet_360'].dir_2d = new gW.Vec2D(0, this.dirDotRadius_px);
 
       this.grid['gun_360'].UL = new gW.Vec2D(x2, y0);
       this.grid['gun_360'].LR = new gW.Vec2D(x3, y1);
       this.grid['gun_360'].dir_2d = new gW.Vec2D(0, this.dirDotRadius_px);
 
       this.grid['shield'].UL = new gW.Vec2D(x1, y0);
       this.grid['shield'].LR = new gW.Vec2D(x2, y0a);
 
       this.grid['color'].UL = new gW.Vec2D(x1, y0a);
       this.grid['color'].LR = new gW.Vec2D(x2, y0b);
 
       this.grid['freeze'].UL = new gW.Vec2D(x0, y1);
       this.grid['freeze'].LR = new gW.Vec2D(x0a, y2);
 
       this.grid['demo7'].UL = new gW.Vec2D(x0a, y1);
       this.grid['demo7'].LR = new gW.Vec2D(x0b, y2);
 
       this.grid['demo8'].UL = new gW.Vec2D(x0b, y1);
       this.grid['demo8'].LR = new gW.Vec2D(x0c, y2);
 
       this.grid['esc'].UL = new gW.Vec2D(x0d, y1);
       this.grid['esc'].LR = new gW.Vec2D(x0e, y2);
 
       this.grid['alt'].UL = new gW.Vec2D(x1, y1);
       this.grid['alt'].LR = new gW.Vec2D(x2, y2);
 
       this.grid['gun_scope'].UL = new gW.Vec2D(x2, y0b);
       this.grid['gun_scope'].LR = new gW.Vec2D(x3, y2);
 
       // Calculate the center point of each rectangle.
       for (var rectName in this.grid) {
          var rect = this.grid[ rectName];
          rect.center_2d = rect.UL.add( rect.LR).scaleBy(1.0/2.0);
       }
 
       if (mode == 'draw') {
          // Draw grid...
          // Vertical lines
          gW.drawLine( ctx_tt, new gW.Vec2D(x0a, y1), new gW.Vec2D(x0a, y2), {'width_px':3, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x0b, y1), new gW.Vec2D(x0b, y2), {'width_px':3, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x0c, y1), new gW.Vec2D(x0c, y2), {'width_px':3, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x0d, y1), new gW.Vec2D(x0d, y2), {'width_px':3, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x0e, y1), new gW.Vec2D(x0e, y2), {'width_px':3, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x1, y0),  new gW.Vec2D(x1, y2),  {'width_px':5, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x2, y0),  new gW.Vec2D(x2, y2),  {'width_px':5, 'color':this.gridColor});
 
          // Vertical lines in the scope rectangle
          gW.drawLine( ctx_tt, new gW.Vec2D(x2a, y0b), new gW.Vec2D(x2a, y2), {'width_px':1, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x2b, y0b), new gW.Vec2D(x2b, y2), {'width_px':1, 'color':this.gridColor});
 
          // Draw the vertical gradient lines in the scope rectangle.
          var width_px = x2a - x2;
          var step_px = Math.round(width_px/3);
          var length_px = Math.round((y2 - y0b)/3);
          for (var i = step_px; i < width_px; i += step_px) {
             gW.drawLine( ctx_tt, new gW.Vec2D(x2 + i, y2-length_px), new gW.Vec2D(x2 + i, y2), {'width_px':1, 'color':this.gridColor});
             gW.drawLine( ctx_tt, new gW.Vec2D(x3 - i, y2-length_px), new gW.Vec2D(x3 - i, y2), {'width_px':1, 'color':this.gridColor});
             step_px *= 0.60;
             step_px = Math.round( step_px);
             if (step_px < 3) step_px = 3;
          }
 
          // Horizontal lines
          // First two run only the width of the shield rectangle.
          gW.drawLine( ctx_tt, new gW.Vec2D(x1, y0a), new gW.Vec2D(x2, y0a), {'width_px':5, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x1, y0b), new gW.Vec2D(x2, y0b), {'width_px':5, 'color':this.gridColor});
          // The next pair do the main bottom line: second segment is at a higher y level for the scope rectangle.
          gW.drawLine( ctx_tt, new gW.Vec2D(x0, y1),  new gW.Vec2D(x2, y1),  {'width_px':5, 'color':this.gridColor});
          gW.drawLine( ctx_tt, new gW.Vec2D(x2, y0b), new gW.Vec2D(x3, y0b), {'width_px':5, 'color':this.gridColor});
 
          // Adjustment Point
          //gW.drawCircle( ctx_tt, this.adjustmentPoint_2d, {'fillColor': 'red', 'radius_px':5} );
 
          // Direction dots
          gW.drawCircle( ctx_tt, this.grid['jet_360'].center_2d, {'fillColor':this.gridColor, 'radius_px':this.dirDotRadius_px} );
          gW.drawCircle( ctx_tt, this.grid['gun_360'].center_2d, {'fillColor':this.gridColor, 'radius_px':this.dirDotRadius_px} );
          gW.drawCircle( ctx_tt, this.grid['shield'].center_2d, {'fillColor':this.gridColor, 'radius_px':this.dirDotRadius_px} );
          gW.drawCircle( ctx_tt, this.grid['alt'].center_2d, {'fillColor':this.gridColor, 'radius_px':this.dirDotRadius_px} );
          gW.drawCircle( ctx_tt, this.grid['gun_scope'].center_2d, {'fillColor':this.gridColor, 'radius_px':this.dirDotRadius_px} );
 
          // Control ring
          gW.drawCircle( ctx_tt, this.grid['jet_360'].center_2d,
             {'fillColor':'noFill', 'radius_px':this.grid['jet_360'].cRadius_1_px, 'borderWidth_px':3, 'borderColor':this.jetRadiusColor_1} );
          gW.drawCircle( ctx_tt, this.grid['jet_360'].center_2d,
             {'fillColor':'noFill', 'radius_px':this.grid['jet_360'].cRadius_2_px, 'borderWidth_px':3, 'borderColor':this.jetRadiusColor_2} );
          gW.drawCircle( ctx_tt, this.grid['jet_360'].center_2d,
             {'fillColor':'noFill', 'radius_px':this.grid['jet_360'].cRadius_3_px, 'borderWidth_px':3, 'borderColor':this.jetRadiusColor_3} );
 
          gW.drawCircle( ctx_tt, this.grid['gun_360'].center_2d,
             {'fillColor':'noFill', 'radius_px':this.grid['gun_360'].cRadius_0_px, 'borderWidth_px':3, 'borderColor':this.gunRadiusColor_0} );
 
          // Text labels
          ctx_tt.font = "25px Arial";
          ctx_tt.fillStyle = this.gridColor;
 
          // Scale the positioning on this text using the x-axis scaling (not a mix of x and y) and include
          // a pixel offset on the y coordinate to account for the pixel height of the font.
          ctx_tt.fillText('jet', this.grid['jet_360'].UL.x + this.absPos_x_px(0.018), this.grid['jet_360'].UL.y + this.absPos_x_px( 0.018) + 20);
          ctx_tt.fillText('pea shooter', this.grid['gun_360'].UL.x + this.absPos_x_px(0.018), this.grid['gun_360'].UL.y + this.absPos_x_px( 0.018) + 20);
 
          ctx_tt.font = "20px Arial";
          ctx_tt.fillText('shield', this.grid['shield'].UL.x + this.absPos_x_px(0.018), this.grid['shield'].UL.y + this.absPos_x_px( 0.018) + 20);
 
          ctx_tt.font = "15px Arial";
          ctx_tt.fillText('esc', this.grid['esc'].UL.x + this.absPos_x_px(0.009), this.grid['esc'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('7', this.grid['demo7'].UL.x + this.absPos_x_px(0.009), this.grid['demo7'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('8', this.grid['demo8'].UL.x + this.absPos_x_px(0.009), this.grid['demo8'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('f', this.grid['freeze'].UL.x + this.absPos_x_px(0.009), this.grid['freeze'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('alt', this.grid['alt'].UL.x + this.absPos_x_px(0.009), this.grid['alt'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('ccw', this.grid['gun_scope'].UL.x + this.absPos_x_px(0.009), this.grid['gun_scope'].UL.y + this.absPos_x_px( 0.018) + 10);
          ctx_tt.fillText('cw', x2b + this.absPos_x_px(0.009), this.grid['gun_scope'].UL.y + this.absPos_x_px( 0.018) + 10);
 
          if (cl.name) this.colorClientRect( clientColor( cl.name));
       }
    }
    // Functions supporting full-screen display mode
    TwoThumbs.prototype.changeDisplay = function( mode) {
       if ((mode == 'fullScreen') || (mode == 'normal')) {
 
          if (window.innerWidth < window.innerHeight) {
             var orientationMessage = "The Two-Thumbs client requests that your phone be oriented for landscape viewing. Please turn it sideways, then try touching the Two-Thumbs button again."
             alert( orientationMessage);
             displayMessage( orientationMessage);
             return;
          }
 
          this.enabled = true;
 
          // If there's a stream active, shut it down.
          if (chkRequestStream.checked) {
             chkRequestStream.click();
          }
          // Reveal the canvas.
          videoMirror.setAttribute("hidden", null);
          clientCanvas_tt.removeAttribute("hidden");
 
          // A reference to the HTML root element.
          //changeFullScreenMode( document.documentElement, 'on');
          if (mode == 'fullScreen') {
             changeFullScreenMode( clientCanvas_tt, 'on');
 
             // Delay is needed with FireFox.
             window.setTimeout(function() {
                clientCanvas_tt.width  = window.innerWidth - 10;
                clientCanvas_tt.height = window.innerHeight - 10;
             }, 600);
 
             // Wait a little longer than the canvas-resize delay above.
             // Notice "this" context is passed in with bind.
             window.setTimeout(function() {
                this.updateAndDrawTouchGrid('draw');
             }.bind(this), 700);
 
          } else if (mode == 'normal') {
             this.updateAndDrawTouchGrid('draw');
          }
 
       } else if (mode == 'exit') {
          changeFullScreenMode( clientCanvas_tt, 'off');
 
          // De-activate the two rectangles that may have gotten you in here (remember, you didn't have to lift
          // your fingers). This effectively resets these rectangles (like releasing your touch).
          this.grid['esc'].active = false;
          this.grid['alt'].active = false;
 
          // Reveal the video element (and hide the canvas).
          videoMirror.removeAttribute("hidden");
          clientCanvas_tt.setAttribute("hidden", null);
 
          chkTwoThumbs.checked = false;
          this.enabled = false;
       }
    }
 
    //////////////////////////////////////////////////
    // Functions supporting the socket.io connections
    //////////////////////////////////////////////////
 
    function disableClientControls( diableMode) {
       // diableMode: true (disable it) or false
       if (diableMode) {
          $('#ConnectButton').html('Wait');
          $('#ConnectButton').prop('disabled', true);
          $('#chkRequestStream').prop('disabled', true);
          $('#twoThumbsButton').prop('disabled', true);
          $('#ChatButton').prop('disabled', true);
       } else {
          // Change the label from 'Wait' to 'Connect'.
          $('#ConnectButton').html('Connect');
          $('#ConnectButton').prop('disabled', false);
          // Note: the streaming checkbox opens when the p2p data-channel opens (see cl.rtc.dataChannel.onopen).
          //       the two-thumbs button opens when the room is successfully joined.
          //       the chat button opens when the room is successfully joined.
       }
    }
 
    function checkForNickName( mode, hostOrClient) {
       var nickName = {'status':'ok', 'value':null};
       //return nickName;
 
       // Check the chat input field, e.g. nn:Jimbo (that's how the user inputs it).
       var chatString = $('#inputField').val();
       if (mode =='normal') {
          // New nick name in the chat input field.
          if (chatString.includes('nn:') || chatString.includes('Nn:')) {
             nickName.value = chatString.slice(3, chatString.length);
 
             if (nickName.value.length > 9) {
                nickName.status = "too long";
                return nickName;
 
             } else {
                if (hostOrClient == 'client') {
                   // Make the nickName accessible from the client. Remember, this cl object
                   // exists on the client.
                   cl.nickName = nickName.value;
                } else if (hostOrClient == 'host') {
                   gW.clients['local'].nickName = nickName.value;
                }
                // Clear out the input field where the nick name was entered.
                $('#inputField').val('');
             }
 
          // Nothing new, so use the current nick name if it's there.
          } else {
             if (hostOrClient == 'client') {
                nickName.value = cl.nickName;
             } else if (hostOrClient == 'host') {
                nickName.value = gW.clients['local'].nickName;
             }
          }
 
       } else if ((mode == 're-connect') && cl.nickName) {
          nickName.value = cl.nickName;
       }
       return nickName;
    }
 
    function connect_and_listen( hostOrClient, mode) {
 
       // First, run some checks on the room name.
       var roomName = $('#roomName').val();
       // Gotta have something...
       if (roomName == "") {
          var buttonName = (hostOrClient == 'client') ? '"Connect"' : '"Create"';
          displayMessage('Type in a short "Room" name, then click the ' + buttonName + ' button.');
          document.getElementById("roomName").style.borderColor = "red";
          return;
       // the HTML limit is set to 9 (so you can try a little more then 7, but then get some advice to limit it to 7)
       } else if (roomName.length > 7) {
          displayMessage('The name should have 7 characters or less.');
          document.getElementById("roomName").style.borderColor = "red";
          return;
       }
 
       // Check to see if there's a nickname in the chat input field.
       var nickName = checkForNickName( mode, hostOrClient);
       if (nickName.status == 'too long') {
          displayMessage('Nicknames must have fewer than 10 characters. Shorten the name and then try connecting again.');
          return;
       }
 
       if (hostOrClient == 'client') {
          // Disable some of the client controls to keep users from repeatedly
          // clicking the connect button.
          disableClientControls(true);
          refresh_P2P_indicator({'mode':'connecting'});
 
          // Open the connect button after 4 seconds. Sometimes there are network delays.
          // Note: most of the disabled controls open based on events. For example: the
          // streaming checkbox opens when the p2p data-channel opens (see cl.rtc.dataChannel.onopen).
          window.setTimeout(function() {
             disableClientControls( false);
          }, 4000);
       } else {
          displayMessage('Connecting as host. Please wait up to 20 seconds...');
       }
 
       var nodeString = $('#nodeServer').val();
       if (nodeString == "") {
          // Use one in the list as a default.
          nodeString = serverArray[0];  // [0] or [2]
          $('#nodeServer').val( nodeString);
       }
       if (nodeString.includes("heroku")) {
          var urlPrefix = "https://"
       } else {
          var urlPrefix = "http://"
       }
       nodeServerURL = urlPrefix + nodeString;
       //console.log("URL=" + nodeServerURL);
 
       // Use jquery to load the socket.io client code.
 
       $.getScript( nodeServerURL + "/socket.io/socket.io.js", function() {
 
          // This callback function will run after the getScript finishes loading the socket.io client.
          console.log("socket.io script has loaded.");
 
          // If there are already active network connections, close them before making new ones. This is
          // the case if the client repeatedly clicks the connect button trying to get a preferred color.
          if (socket) {
             if (hostOrClient != 'host') {
                // Send a message to the host (via socket.io server) to shutdown RTC connections.
                if (newClientName) {
                   if (videoMirror.srcObject) videoMirror.srcObject = null;
                   // Trigger client shutdown at the host.
                   socket.emit('shutDown-p2p-deleteClient', newClientName);
                }
             }
             window.setTimeout( function() {
                // Close socket.io connection after waiting a bit for the p2p connections to close.
                socket.disconnect();
             }, 500);
          }
 
          // Delay this (connection to the server) even longer than the socket.disconnect() above (to be sure the disconnect is done).
          window.setTimeout( function() {
             // When starting a new normal connection, turn off the stream.
             if (mode =='normal' && (hostOrClient != 'host')) chkRequestStream.checked = false;
 
             // Here is where the socket.io client initiates it's connection to the server. The 'query' parameter
             // shows the form of the query string needed for a multi-parameter example. This is how you pass parameters
             // to the connection handler in server.js.
             if (nickName.value) {
                var nickNameString = '&nickName='+ nickName.value;
             } else {
                var nickNameString = '';
             }
             var queryString = 'mode=' + mode + '&currentName=' + cl.name + nickNameString;
             socket = io.connect( nodeServerURL, {'forceNew':true, 'query':queryString});
 
             init_socket_listeners( roomName, hostOrClient);
          }, 600);
 
 
       // Use the "fail" method of getScript to report a connection problem.
       }).fail(function( jqxhr, settings, exception) {
          displayMessage('The node server is not responding. Try changing to a different server.');
          document.getElementById("roomName").style.borderColor = "red";
          refresh_P2P_indicator({'mode':'reset'});
       });
    }
 
    function getGameReportCounter() {
       return gameReportCounter;
    }
    function displayMessage( msgText) {
       if (msgText.includes("Game Summary")) {
          gameReportCounter += 1;
          var idString = " id='gR" + gameReportCounter + "'";
       } else {
          var idString = "";
       }
 
       // Every other line, toggle the background shading.
       if (chatStyleToggle) {
          var styleString = "style='background: #efefef;'";
       } else {
          var styleString = "style='background: #d9d9d9;'";
       }
 
       $("#messages").prepend("<li " + styleString + idString + ">"+ msgText +"</li>");
       chatStyleToggle = !chatStyleToggle;
    }
 
    // Used for broadcasting a message to non-host players.
    function chatToNonHostPlayers( msgTxt) {
       if (socket) socket.emit('chat message but not me', msgTxt + '</br>');
    }
 
    function init_chatFeatures( hostOrClient) {
 
       serverArray = ['secure-retreat-15768.herokuapp.com',
                          'localhost:3000',
                          '192.168.1.106:3000',
                          '192.168.1.109:3000',  //David's computer
                          '192.168.1.116:3000',  //RPi
                          '192.168.1.117:3000']; //Laptop
       // Use jquery to loop over the serverArray and build the URL datalist.
       jQuery.each( serverArray, function( i, val ) {
          $('#nodeServerList').append("<option value='" + val + "'>");
       });
 
       var pingTestHelp = "Your ping test has started.<br><br>" +
                          "Please wait about 10 seconds for the results of the 100-ping test to return. Each time you hit enter or click the chat button " +
                          "a new 100-ping test will be queued. Please manually clear out the words 'ping' or 'ping:host' to stop pinging and start chatting.";
 
       // Function that emits (if a socket has been established) the text in the form's input field.
       $('#chatForm').submit(function() {
          var chatString = $('#inputField').val();
          if (socket) {
             if (chatString == 'ping') {
                echoTest('server');
                displayMessage( pingTestHelp);
             } else if (chatString == 'ping:host') {
                echoTest('host');
                displayMessage( pingTestHelp);
             } else {
                socket.emit('chat message', chatString);
                $('#inputField').val(''); //clear out the input field.
             }
          } else {
             var buttonName = (hostOrClient == 'client') ? '"Connect"' : '"Create"';
             displayMessage('Type in a short "Room" name, then click the ' + buttonName + ' button.');
          }
          return false;
       });
 
       // Prevent typing in the input fields from triggering document level keyboard events.
       $('#inputField, #nodeServer, #roomName, #jsonCapture').on('keyup keydown keypress', function( e) {
          e.stopPropagation(); // stops bubbling...
       });
 
       // A first message in the chat area
       var helloMessage;
       if (hostOrClient == 'host') {
          helloMessage = '' +
          'This is the host page for multiplayer.</br></br>'+
 
          'Click the multiplayer checkbox to toggle between this chat panel and the discussion/help panel. Doing so will not disable connections.</br></br>'+
 
          'From here you can host a multiplayer room. '+
          'Please notice the links to the client page in the right panel below the multiplayer checkbox. '+
          'You can also get to the client page from the three-line menu icon in the upper left corner.</br></br>'+
 
          'To get started, type a short room name into the red box, then click the "Create" button.</br></br>'+
 
          'Please note, when setting up the room as host, you might not get an immediate response from the server. It can take a little while for the Heroku node application to wake up. '+
          'If waking, give it 10 to 20 seconds before expecting a confimation message in this chat area.</br></br>'+
 
          'To start over, or disconnect from the server, please reload the page.';
 
       } else {
          helloMessage = '' +
          'This is the client page for multiplayer.</br></br>'+
 
          'From here you can be a client in a multiplayer room. The room must be started (hosted) from the main www.timetocode.org page. '+
          'Generally, a separate computer is used for hosting. For testing, the host and multiple clients can be run in separate windows on the same computer.</br></br>'+
 
          'To connect as a client, type, into the red box (here, on this client page), the room name provided to you by the host, then click the "Connect" button.</br></br>' +
 
          'To start over, or disconnect from the server, please reload the page.';
       }
       displayMessage( helloMessage);
    }
 
    function clientColor( clientName) {
       var colors = {'1':'yellow','2':'blue','3':'green','4':'pink','5':'orange',
                     '6':'brown','7':'greenyellow','8':'cyan','9':'tan','0':'purple'};
       var n = clientName.slice(1);
       var colorIndex = n - Math.trunc(n/10)*10;
       return colors[ colorIndex];
    }
 
    function init_socket_listeners( roomName, hostOrClient) {
 
       // Listeners needed by both the client and the host.
 
       // Listen for chat being forwarded by the server.
       socket.on('chat message', function(msg) {
          displayMessage( msg);
       });
 
       // Change the border color of the roomName input box depending on the
       // message from the node server. And add additional info to the message.
       socket.on('room-joining-message', function(msg) {
          if (msg.includes('You have joined room')) {
             // Some visual indicators that all is well.
             document.getElementById("roomName").style.borderColor = "#008080"; //Dark green.
             if (hostOrClient == 'client') $('#twoThumbsButton').prop('disabled', false);
             $('#ChatButton').prop('disabled', false);
 
             // If the names are the same, it indicates the network client has rejoined with a video stream.
             if ((hostOrClient == 'client') && (cl.name == cl.previous_name)) {
                if (cl.nickName) {
                   var nNstring = ' ('  + cl.nickName + ').';
                } else {
                   var nNstring = '.';
                }
                msg = 'You have reconnected with a video stream. Your name is still ' + cl.name + nNstring;
 
             // Additional instructions if this is a non-host client
             } else if (hostOrClient == 'client') {
                msg += ''+
                "</br></br>"+
                "You are in <strong>normal desktop</strong> mode. Your mouse and keyboard events get sent to the host. You must have direct visual access to the host's monitor."+
                "</br></br>"+
 
                "Two other options:</br></br>"+
 
                "<strong>Stream:</strong> This is like normal mode, but the host's canvas is rendered in the video element here. "+
                "So you can play out-of-sight of the host's monitor, in a separate room, city, country...</br></br>"+
 
                "<strong>Two Thumbs:</strong> touch-screen interface for your phone. Similar to normal mode, this requires line-of-sight to the host's monitor. "+
                "However, you can start up a second client (on a second device) and stream to it if you don't have line-of-sight.</br>";
             }
 
          // Client might get this warning...
          } else if (msg.includes('Sorry, there is no host')) {
             document.getElementById("roomName").style.borderColor = "red";
             refresh_P2P_indicator({'mode':'reset'});
 
          // A candidate host might get this warning...
          } else if (msg.includes('Sorry, there is already a host')) {
             document.getElementById("roomName").style.borderColor = "red";
 
          // Additional instructions for the new host. This room-joining-message event will have to be triggered a second time to get this message to the host after
          // the "You have joined room" message above.
          } else if (msg.includes('You are the host')) {
             var openWindowString = '"' + "window.open('indexClient.html', '_blank', 'width=1320, height=650') " + '"';
             msg += ''+
             "</br></br>"+
             "You can open a test <a href='#' onClick=" + openWindowString + "title='Open a client page in a new window.'>client</a> in a new window. "+
             "Connect using the same room name on the client page. Then the client mouse and keyboard events will render to the canvas of the host.";
          }
          displayMessage( msg);
       });
 
       // Once your connection succeeds, join a room.
       socket.on('connect', function() {
 
          if (hostOrClient == 'host') {
             socket.emit('roomJoin', JSON.stringify({'hostOrClient':hostOrClient,'roomName':roomName}));
 
          } else if (hostOrClient == 'client') {
             socket.emit('roomJoin', JSON.stringify({'hostOrClient':hostOrClient,'roomName':roomName,
                                                     'player':chkPlayer.checked,
                                                     'requestStream':chkRequestStream.checked}));
          }
       });
 
       // Listen for echo response from the server.
       socket.on('echo-from-Server-to-Client', function( msg) {
          var echoTarget = msg;
 
          // Stop timer (measure the round trip).
          timer.stop = window.performance.now();
          var elapsed_time = timer.stop - timer.start;
          // Add this new timing result to the array.
          timer.pingArray.push( elapsed_time);
 
          // The echo series STOPs here.
          if (timer.pingArray.length > 99) {
             var timeAvg = Math.mean( timer.pingArray).toFixed(1);
             var timeSTD = Math.std( timer.pingArray).toFixed(1);
             var timeLen = timer.pingArray.length;
             var timeMax = Math.max( timer.pingArray).toFixed(1);
             var timeMin = Math.min( timer.pingArray).toFixed(1);
             displayMessage('Echo test to '+ echoTarget +': '+ timeAvg +' ms '+
                            '(std='+  timeSTD +
                            ', min='+ timeMin +
                            ', max='+ timeMax +
                            ', n='+   timeLen +')');
             timer.pingArray = [];
             return;
          }
 
          // Ping it again (continue the series).
          echoTest( echoTarget);
 
          // Do this after the timer starts (don't slow it down with a write to the console.)
          console.log( echoTarget);
       });
 
       // WebRTC Signaling.
       // This handles signaling from both sides of the peer-to-peer connection.
       socket.on('signaling message', function(msg) {
          // Convert it back to a usable object (parse it).
          var signal_message = JSON.parse(msg);
 
          // Note that signalData needs to be in a stringified form when writing to the console.
          //console.log("signal message from " + signal_message.from + ", to " + signal_message.to + ": " + JSON.stringify(signal_message.signalData));
 
          // Offers and Answers
          if (signal_message.signalData.sdp) {
             //console.log('sdp in signal from host: ' + JSON.stringify(signal_message.signalData));
 
             if (signal_message.signalData.type == 'offer') {
                //console.log("an offer");
                handleOffer( signal_message.signalData);
 
             } else if (signal_message.signalData.type == 'answer') {
                //console.log("an answer");
                handleAnswer( signal_message.signalData);
 
             } else {
                console.log("Woooooo-HoHo-Hoooooo, something is screwed up. This can't be good.");
             }
 
          // ICE candidates
          } else if (signal_message.signalData.candidate) {
 
             // handle ICE stuff.
             cl.rtc.pc.addIceCandidate( signal_message.signalData)
             .catch( function( reason) {
                // An error occurred, so...
                console.log('Error while handling ICE stuff:' + reason);
             });
 
             //console.log('signaling state after handling ICE = ' + cl.rtc.pc.signalingState);
 
          } else {
             //No WebRTC stuff found in the signaling message. Maybe you are testing...
             console.log("In final else block of 'signaling message' handler.");
          }
 
       });
 
       socket.on('control message', function( msg) {
          // General receiver of control messages. This can be used by either the host or a client to
          // receive messages from anyone.
 
          // Convert the raw msg back to a usable object (parse it).
          var message = JSON.parse( msg);
 
          // Control message directed to the host.
          if (message.to == 'host') {
             if (message.data.videoStream == 'off') {
                gW.clients[ message.from].rtc.turnVideoStreamOff();
 
             } else if (message.data.fullScreen == 'off') {
                console.log('full screen requested off by client');
                // Tried to do something here, but browsers fullscreen API requires that the
                // a change starts with a gesture. The error: '...API can only be initiated by a user gesture.'
             }
          // Control message directed to a non-host client.
          } else {
 
          }
 
       });
 
       // Listeners needed by the client only.
 
       if (hostOrClient == 'client') {
          socket.on('your name is', function( msg) {
             var message = JSON.parse( msg);
 
             var name = setDefault( message.name, null);
             // Note: not (yet) doing anything with nickName that comes back from the socket.io server.
             // cl.nickName gets set for the client on the front end of the connection. Just including it
             // here for completeness.
             var nickName = setDefault( message.nickName, null);
 
             // Put this name in the mouse and keyboard (mK) global that is used to send
             // state data from the client.
             mK.name = name;
 
             // Put your name in this global (on the client side) for (possible) use by the WebRTC functions.
             newClientName = name;
 
             // Before updating cl.name with the new client name, store it's current value in previous_name.
             cl.previous_name = cl.name;
             cl.name = newClientName;
 
             console.log('names: current='+cl.name+ ', previous='+ cl.previous_name +', nick='+nickName);
 
             // Initialize this global container for the WebRTC stuff.
             cl.rtc = new RTC({'user1':newClientName,'user2':'host'});
          });
 
          socket.on('disconnectByServer', function(msg) {
             if (db.rtc) console.log('in client disconnectByServer, msg='+msg);
 
             var clientName = msg;
             displayMessage("This client (" + clientName + ") is being disconnected by the host.");
             document.getElementById("roomName").style.borderColor = "red";
 
             // When the server gets this one, it will remove the socket.
             socket.emit('okDisconnectMe', clientName);
 
             // Shutdown and delete the client side of the WebRTC p2p connection.
             cl.rtc.shutdown();
             initialize_mK();
             //mK = {};
 
             // Delay this so it takes effect after the p2p toggle finishes.
             window.setTimeout( function() {
                displayMessage("");
                displayMessage("Shutdown of the p2p connection for " + clientName + " has finished.");
                displayMessage("");
                displayMessage("");
                displayMessage("");
             }, 100);
          });
 
          socket.on('command-from-host-to-all-clients', function( msg) {
             // Clients (only) do something based on the message from the host.
             var command_message = JSON.parse( msg);
             var type = command_message.type;
             var command = command_message.command;
 
             if (type == 'resize') {
                gW.adjustSizeOfChatDiv( command);
                if (command == 'normal') {
                   videoMirror.width = 600, videoMirror.height = 600;
                } else {
                   videoMirror.width = 1250, videoMirror.height = 950;
                }
             } else {
                console.log("I don't recognize that command; hey, I'm just saying...");
             }
          });
       }
 
 
       // Listeners needed by the host only.
 
       if (hostOrClient == 'host') {
          // (Note: this is the one place where calls to gW are made inside of hC.)
 
          // Listen for client mouse and keyboard (mk) events broadcast from the server.
          // StH: Server to Host
          socket.on('client-mK-StH-event', function(msg) {
             var msg_parsed = JSON.parse( msg);
             //console.log('State('+ msg_parsed.name +'):'+ msg_parsed.MD +','+ msg_parsed.bu +'): '+ msg_parsed.mX + "," + msg_parsed.mY);
             // Send this mouse-and-keyboard state to the engine.
             gW.updateClientState( msg_parsed.name, msg_parsed);
          });
 
          // As host, create a new client in gW framework.
          socket.on('new-game-client', function(msg) {
             var msgParsed = JSON.parse(msg);
 
             var streamRequested = msgParsed.requestStream;
 
             var clientName = msgParsed.clientName;
             var player = msgParsed.player;
             var nickName = msgParsed.nickName;
 
             gW.createNetworkClient({'clientName':clientName, 'player':player, 'nickName':nickName});
 
             // WebRTC. Start the p2p connection here (from the host) when we hear (from the server)
             // that a client is trying to connect to a room.
             // Make a global reference to this new (the most recent) client's RTC object.
             cl = gW.clients[clientName];
             cl.rtc.user1 = 'host';
             cl.rtc.user2 = clientName;
             cl.rtc.streamRequested = streamRequested;
             if (db.rtc) console.log('in new-game-client, cl.rtc.user2 = ' + cl.rtc.user2);
 
             // Start the WebRTC signaling exchange with the new client.
             // Diagnostic tools: chrome://webrtc-internals (in Chrome) and about:webrtc (in Firefox)
             try {
                openDataChannel( true); // open as the initiator
                createOffer();
             } catch(e) {
                console.log("WebRTC startup: " + e);
             }
 
             // Someone just connected. Send the layout state to them (actually to everyone, but that
             // should, of course, cover the connecting user also). Delay it a bit...
             window.setTimeout( function() {
                resizeClients( gW.getChatLayoutState());
             }, 300);
          });
 
          socket.on('client-disconnected', function(msg) {
             var clientName = msg;
             if (db.rtc) console.log('in client-disconnected, clientName=' + clientName);
 
             // Null out any WebRTC references in c object (most recent connection on the host page) if it happens to be
             // this client.
             nullReferences_toRTC_on_c( clientName);
 
             // Do corresponding cleanup in gwModule.
             gW.deleteNetworkClient( clientName);
          });
 
          socket.on('echo-from-Server-to-Host', function(msg) {
             // Bounce this back to server.
             // The msg string is the client id.
             socket.emit('echo-from-Host-to-Server', msg);
          });
 
          socket.on('shutDown-p2p-deleteClient', function( msg) {
             if (db.rtc) console.log('in shutDown-p2p-deleteClient');
             var clientName = msg;
             // First check for the case where the host has reloaded their page and
             // then a client attempts to reconnect. In that case the clients map will be empty and
             // this clientName won't be found in there.
             if (gW.clients[ clientName]) {
                // Check for a puck controlled by this client. Delete it first.
                if (gW.clients[ clientName].puck) gW.clients[ clientName].puck.deleteThisOne({});
                // Then start shutting down the WebRTC connection.
                gW.deleteRTC_onClientAndHost( clientName);
             }
          });
       }
    } // end of init_socket_listeners
 
 
    // The following two functions are exposed for external use and are called from within gwModule.js.
    function forceClientDisconnect( clientName) {
       if (db.rtc) console.log('in forceClientDisconnect');
       socket.emit('clientDisconnectByHost', clientName);
    }
    function resizeClients( command){
       if (socket) {
          socket.emit('command-from-host-to-all-clients', JSON.stringify({'type':'resize', 'command':command}));
       }
    }
 
    function echoTest( hostOrServer) {
       // Start the timer for one echo.
       timer.start = window.performance.now();
 
       // The echo series STARTs here.
       socket.emit('echo-from-Client-to-Server', hostOrServer);
    }
 
 
 
    ////////////////////////////////////////////////
    // Functions supporting the WebRTC connections.
    ////////////////////////////////////////////////
 
    var configuration = { 'iceServers': [{'urls': 'stun:stun1.l.google.com:19302'}] };
 
    function openDataChannel( isInitiator) {
       cl.rtc.pc = new RTCPeerConnection( configuration);
       console.log("openDataChannel success");
       // send any ice candidates to the other peer
       cl.rtc.pc.onicecandidate = function (evt) {
          if (evt.candidate) {
             var signal_message = {'from':cl.rtc.user1, 'to':cl.rtc.user2, 'signalData':evt.candidate};
             socket.emit('signaling message', JSON.stringify( signal_message));
          }
       };
       console.log("onicecandidate success");
       // Host-side data channel
       if (isInitiator) {
          var dc_id = cl.rtc.user2.slice(1);
          var dc_options = {'id':dc_id, 'ordered':false, 'maxRetransmits':1};
          var dc_label = "dc-" + cl.rtc.user2;
          cl.rtc.dataChannel = cl.rtc.pc.createDataChannel(dc_label, dc_options);
 
          cl.rtc.dataChannel.onmessage = function( e) {
             handle_RTC_message( e);
          };
          cl.rtc.dataChannel.onopen    = function( ){console.log("------ RTC DC(H) OPENED ------");};
          cl.rtc.dataChannel.onclose   = function( ){console.log("------ RTC DC(H) closed ------");};
          cl.rtc.dataChannel.onerror   = function( ){console.log("RTC DC(H) error.....");};
 
          if (cl.rtc.streamRequested) {
             startVideoStream();
          }
 
       // Client-side data channel
       } else {
          // This side of the data channel gets established in response to the channel initialization
          // on the host side.
          console.log("client ondatachannel success");
          cl.rtc.pc.ondatachannel = function(evt) {
 
             cl.rtc.dataChannel = evt.channel;
 
             // Must set up an onmessage handler for the clients too.
             cl.rtc.dataChannel.onmessage = function(e) {
                console.log("DC (@client) message:" + e.data);
             };
             cl.rtc.dataChannel.onopen = function() {
                console.log("------ RTC DC(C) OPENED ------");
                rtc_choke = false;
                $('#chkRequestStream').prop('disabled', false);
                refresh_P2P_indicator({});
             };
             cl.rtc.dataChannel.onclose = function() {
                console.log("------ RTC DC(C) closed ------");
                rtc_choke = true;
             };
             cl.rtc.dataChannel.onerror = function() {
                console.log("RTC DC(C) error.....");
             };
          }
          console.log("client ontrack first : " + cl.rtc.pc.ontrack);
          // Respond to a new track by sending the stream to the video element.
          cl.rtc.pc.ontrack = function (evt) {
            console.log("client ontrack123 : " + evt.streams[0]);
             videoMirror.srcObject = evt.streams[0];
          };
       }
       //console.log('signaling state after openDataChannel = ' + cl.rtc.pc.signalingState);
    }
    async function startCapture(displayMediaOptions) {
         let captureStream = null;
 
         try {
           if(navigator.getDisplayMedia){
             captureStream = await navigator.getDisplayMedia(displayMediaOptions);
           }else if(navigator.mediaDevices.getDisplayMedia){
             captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
           }
         } catch(err) {
           console.error("getDisplayMedia Error: " + err);
         }
 
         return captureStream;
       }
    const clientdisplayMediaOptions = {
               video: {
                 width: 600,  // 최대 너비
                 height: 600, // 최대 높이
                 frameRate: 60 // 최대 프레임
               }
             };
 
    // This function is used (only) by the host when someone connects and wants a stream.
    function startVideoStream() {
       if (!videoStream) {
         var hostvideo = document.getElementById('hostvideo');
         var hostCanvas = document.getElementById('hostCanvas');
         hostvideo.width = hostCanvas.width;
         hostvideo.height = hostCanvas.height;
         var ctx = hostCanvas.getContext('2d');
         startCapture(clientdisplayMediaOptions).then(function(stream){
           hostvideo.srcObject = stream;
           console.log("stream success");
         });
 
         hostvideo.addEventListener('play', function() {
           var $this = this; //cache
           (function loop() {
             if (!$this.paused && !$this.ended) {
               ctx.drawImage($this, 0, 0);
               setTimeout(loop, 3); // drawing at 60fps
             }
           })();
         }, 0);
          videoStream = hostCanvas.captureStream(); //60
          console.log('host stream123 : ' + videoStream);
       }
       console.log("host track : " +videoStream.getVideoTracks()[0]);
       try {
               var rtpSender = cl.rtc.pc.addTrack( videoStream.getVideoTracks()[0], videoStream);
                    console.log("rtpSender : " + rtpSender);
           } catch(err) {
                   console.error("addTrack Error: " + err);
                }
                  // The chkStream is on the host page only (index.html)
                  document.getElementById("chkStream").checked = true;
                  videoStream.getVideoTracks()[0].enabled = true;
                  console.log("startVideoStream success");
       }
 
    function setCanvasStream( newState) {
       if (videoStream) {
          if (newState == 'on') {
             videoStream.getVideoTracks()[0].enabled = true;
          } else {
             videoStream.getVideoTracks()[0].enabled = false;
          }
       }
    }
 
    function handle_RTC_message( msg) {
       //var user2 = Object.assign({}, cl.rtc.user2);
 
       /*
       var user2 = JSON.stringify(cl.rtc.user2);
       console.log("I am (cl.rtc.user2) = " + user2);
       console.log("DC ID = " + JSON.stringify(cl.rtc.dataChannel.id));
       console.log("DC (@host) message: " + e.data);
       */
 
       // Process mK events from the client on the other end of this peer-to-peer connection.
       var mK_string = msg.data;
       var mK_data = JSON.parse( mK_string);
       // Send this mouse-and-keyboard state to the engine.
       gW.updateClientState( mK_data.name, mK_data);
    }
 
    function createOffer() {
       cl.rtc.pc.createOffer()
       .then( function( offer) {
          return cl.rtc.pc.setLocalDescription( offer);
       })
       .then( function() {
          var signal_message = {'from':cl.rtc.user1, 'to':cl.rtc.user2, 'signalData':cl.rtc.pc.localDescription};
          socket.emit('signaling message', JSON.stringify( signal_message));
       })
       .catch( function(reason) {
          // An error occurred, so handle the failure to connect
          console.log('Error while creating offer:' + reason);
       });
       //console.log('signaling state after createOffer = ' + cl.rtc.pc.signalingState);
    }
 
    function handleOffer( msg) {
       openDataChannel( false); // Open as NOT the initiator
 
       cl.rtc.pc.setRemoteDescription( msg)
       .then(function() {
          return cl.rtc.pc.createAnswer( );
       })
       .then(function( answer) {
          return cl.rtc.pc.setLocalDescription( answer);
       })
       .then(function() {
          // Send the answer (localDescription) to the remote peer
          var signal_message = {'from':cl.rtc.user1, 'to':cl.rtc.user2, 'signalData':cl.rtc.pc.localDescription};
          socket.emit('signaling message', JSON.stringify( signal_message));
       })
       .catch( function( reason) {
          console.log('Error while handling offer:' + reason);
       });
       //console.log('signaling state after handleOffer = ' + cl.rtc.pc.signalingState);
    }
 
    function handleAnswer( answer) {
       cl.rtc.pc.setRemoteDescription( answer)
       .catch( function( reason) {
          console.log('Error while handling answer:' + reason);
       });
       //console.log('signaling state after handleAnswer = ' + cl.rtc.pc.signalingState);
    }
 
    function logError( error) {
       console.log(error.name + ': ' + error.message);
    }
 
    function nullReferences_toRTC_on_c( clientName) {
       // Check the global "c" pointer (to the most recently connected client) to see if it happens to
       // be pointed at this client.
       //console.log('cl.rtc='+JSON.stringify( cl.rtc) + ", newClientName=" + clientName);
       if (cl.rtc && (cl.rtc.user2 == clientName)) {
          cl.rtc = new RTC({});
       }
    }
 
    function refresh_P2P_indicator( pars) {
       var mode = setDefault( pars.mode, 'p2p');
 
       // Stop the pacifier (note: pacifier is a global object)
       clearInterval( pacifier.intFunction);
 
       // If connected, there will be a name (assigned from the server)
       if ((mode == 'p2p') && cl.name) {
          // Show (flood/erase the canvas with) the client's color.
          ctx.fillStyle = clientColor( cl.name);
          ctx.fillRect(0, 0, clientCanvas.width, clientCanvas.height);
 
          ctx.font = "12px Arial";
          // Use dark letters for the lighter client colors.
          var lightColors = ['yellow', 'greenyellow', 'pink', 'cyan', 'tan'];
          if (lightColors.includes( clientColor( cl.name))) {
             ctx.fillStyle = 'black';
          } else {
             ctx.fillStyle = 'white';
          }
          // If choke, RTC, data channel, and readyState are ok, display the "P2P" text.
          if (!rtc_choke && cl.rtc && cl.rtc.dataChannel && (cl.rtc.dataChannel.readyState == 'open')) {
             ctx.fillText('P2P', 10, 12);
          } else {
             ctx.fillText('socket.io', 10, 12);
          }
 
       } else if (mode == 'connecting') {
          ctx.fillStyle = 'darkgray';
          ctx.fillRect(0, 0, clientCanvas.width, clientCanvas.height);
 
          ctx.font = "12px Arial";
          ctx.fillStyle = 'white';
          ctx.fillText('CONNECTING', 10, 12);
 
          // Start the pacifier
          pacifier.string = '';
          pacifier.intFunction = setInterval( function() {
             pacifier.string += '--';
             ctx.fillText(pacifier.string, 95, 12);
          }, 200);
 
       } else if (mode == 'reset') {
          // Light gray fill.
          ctx.fillStyle = '#EFEFEF';
          ctx.fillRect(0, 0, clientCanvas.width, clientCanvas.height);
       }
    }
 
    ////////////////////////////////////////////////////////////////////////////////
    // Functions supporting canvas animation
    ////////////////////////////////////////////////////////////////////////////////
 
    // Currently not using this steady animation loop approach. Instead, update the canvas
    // as input events get fired. Refer to the methods in the TwoThumbs class.
 
    /*
 
    function canvasLoop( timeStamp_ms) {
       updateCanvas();
 
       myRequest = window.requestAnimationFrame( canvasLoop);
    }
 
    function updateCanvas() {
       // Clear the canvas (from one corner to the other)
       if (ctx_tt.globalCompositeOperation == 'screen') {
          ctx_tt.clearRect(0,0, clientCanvas_tt.width, clientCanvas_tt.height);
       } else {
          ctx_tt.fillStyle = 'blue';
          ctx_tt.fillRect(clientCanvas_tt.width/8, clientCanvas_tt.width/8, clientCanvas_tt.width/4, clientCanvas_tt.height/4);
       }
 
       if (twoThumbs.enabled) {
          // Draw the two-thumb state
          if (cl.name) {
             var circleColor = clientColor( cl.name);
          } else {
             var circleColor = 'white';
          }
          gW.drawCircle( ctx_tt, {'x':mK.mX, 'y':mK.mY}, {'fillColor': circleColor} );
       }
    }
 
    function startAnimation() {
       // Only start a game loop if there is no game loop running.
       if (myRequest === null) {
          // Start the canvas loop.
          myRequest = window.requestAnimationFrame( canvasLoop);
       }
    }
 
    function stopAnimation() {
       window.cancelAnimationFrame( myRequest);
       myRequest = null;
    }
 
    */
 
 
    ////////////////////////////////////////////////////////////////////////////////
    // Misc functions
    ////////////////////////////////////////////////////////////////////////////////
 
    function init_nonHostClients() {
       init_eventListeners_nonHostClients();
       init_chatFeatures('client');
       twoThumbs = new TwoThumbs({});
    }
 
    function setDefault( theValue, theDefault) {
       // Return the default if the value is undefined.
       return (typeof theValue !== "undefined") ? theValue : theDefault;
    }
 
    function changeFullScreenMode( targetElement, mode) {
       if (mode == 'on') {
          if (targetElement.requestFullscreen) {
              targetElement.requestFullscreen();
          } else if (targetElement.mozRequestFullScreen) {
              targetElement.mozRequestFullScreen();
          } else if (targetElement.webkitRequestFullScreen) {
              targetElement.webkitRequestFullScreen();
          } else if (targetElement.msRequestFullscreen) {
              targetElement.msRequestFullscreen();
          }
       } else if (mode == 'off') {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen();
          } else if (document.webkitCancelFullScreen) {
              document.webkitCancelFullScreen();
          } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
          }
       }
    }
 
    function handle_sending_mK_data( mK) {
       // Use WebRTC datachannel if available
       if (cl.rtc && cl.rtc.dataChannel && (cl.rtc.dataChannel.readyState == 'open') && (rtc_choke == false)) {
          cl.rtc.dataChannel.send( JSON.stringify( mK));
 
       // Otherwise use socket.io (WebSocket)
       } else if (socket) {
          socket.emit('client-mK-event', JSON.stringify( mK));
       }
    }
 
    ////////////////////////////////////////////////////////////////////////////////
    // Event listeners to capture mouse and keyboard (m & K) state from the non-host
    // clients.
    ////////////////////////////////////////////////////////////////////////////////
 
    function initialize_mK() {
       // Initialize the Mouse and Keyboard (mK) state object.
 
       // isMouseDown
       mK.MD = false;
       // mouse button number (which of the three: 0,1,2)
       mK.bu = 0;
       // mouse position in pixels: X_px, Y_px
       mK.mX = 5;
       mK.mY = 5;
 
       // Use the keyMap to define and initialize all the key states (to UP) in the
       // mK (mouse and keyboard state) object that is sent to the host.
       for (var key in keyMap) {
          mK[keyMap[key]] = 'U';
       }
       for (var key in keyMap_cso) {
          mK_cso[keyMap_cso[key]] = 'U';
       }
       // Initialize non-keyboard attributes (for the Two Thumbs interface)
       // Gun scope
       mK['ScRrf'] = 0.00;
       mK['ScTr'] = 'U';
       // Jet throttle (the full throttle)
       mK['jet_t'] = 1.0;
    }
 
    function init_eventListeners_nonHostClients() {
       initialize_mK();
 
       clientCanvas = document.getElementById('connectionCanvas');
       ctx = clientCanvas.getContext('2d');
 
       clientCanvas_tt = document.getElementById('twoThumbsCanvas');
       ctx_tt = clientCanvas_tt.getContext('2d');
 
       myRequest = null;
 
       videoMirror = document.getElementById('videoMirror');
 
       // Event handlers for this network client (user input)
 
       // Inhibit the context menu that pops up when right clicking (third button).
       // Alternatively, could apply this only to the canvas. That way you can still
       // source the page.
       document.addEventListener("contextmenu", function(e) {
          e.preventDefault();
          return false;
       }, {capture: false});
 
       // For the client, keep these listeners on all the time so you can see the client cursor.
       // To avoid scrolling behavior on the video element, had to set up specific event handlers
       // for that element (videoMirror) and use preventDefault. This wasn't necessary on the host
       // side because no video element there (just a canvas).
       videoMirror.addEventListener("touchmove", function(e) {
          e.preventDefault();
          handleMouseOrTouchMove(e, 'touchmove');
       }, {capture: false});
       videoMirror.addEventListener("mousemove", function(e) {
          e.preventDefault();
          handleMouseOrTouchMove(e, 'mousemove');
       }, {capture: false});
 
       clientCanvas_tt.addEventListener("touchmove", function(e) {
          e.preventDefault();
          handleMouseOrTouchMove(e, 'touchmove');
       }, {capture: false});
 
       document.addEventListener("mousedown", function(e) {
          // Keep mousedown from firing in the TwoThumbs interface. Necessary for Android where this
          // would fire after the touchstart and screw up the direction dot. This of course prevents
          // use of the mouse in TwoThumbs, but that's fine, need fingers there...
          if (twoThumbs.enabled) return;
 
          mK.MD = true;  // Mouse Down
          mK.bu = e.button; // Mouse button
 
          //Pass this first mouse position to the move handler.
          handleMouseOrTouchMove(e, 'mousedown');
 
          //if (cl.rtc && cl.rtc.dataChannel) cl.rtc.dataChannel.send( 'mouse-down event, id = ' + cl.rtc.dataChannel.id);
 
       }, {capture: false});
 
       document.addEventListener("mouseup", function(e) {
          // Keep mousedown from firing in the TwoThumbs interface. Necessary for Android where this
          // would fire after the touchstart and screw up the direction dot. This of course prevents
          // use of the mouse in TwoThumbs, but that's fine, need fingers there...
          if (twoThumbs.enabled) return;
 
          mK.MD = false;  // Mouse Down
          mK.bu = e.button; // Mouse button
 
          //Pass this first mouse position to the move handler.
          handleMouseOrTouchMove(e, 'mouseup');
 
          //if (cl.rtc && cl.rtc.dataChannel) cl.rtc.dataChannel.send( 'mouse-down event, id = ' + cl.rtc.dataChannel.id);
 
       }, {capture: false});
 
       document.addEventListener("touchstart", function(e) {
          // Note: the following canvas style is set:
          // touch-action: none;
          // This keep the canvas from sliding when flinging objects.
 
          // Prevent the mousedown event from firing. But in the end decided to put the check-and-return
          // statement in the first line of mousedown. That works in all devices and all browsers. The following
          // statement problematically blocked touch operations in off-canvas areas of the client when running in
          // Firefox.
          //e.preventDefault(); // works great (to prevent mousedown) for laptop but not Android.
 
          mK.MD = true;  // Mouse Down
          mK.bu = 0; // Mouse button
 
          //Pass this first mouse position to the move handler.
          handleMouseOrTouchMove( e, 'touchstart');
 
       }, {capture: false});
 
       function handleMouseOrTouchMove( e, fromListener) {
          /*if (twoThumbs.enabled) {
             var touchPoints_2d_px = [];
 
             // Determine event type
             // Mouse (single contact point)
             if (e.clientX && (mK.MD == true)) {
                touchPoints_2d_px[0] = gW.screenFromRaw_2d_px( clientCanvas_tt, new gW.Vec2D( e.clientX, e.clientY));
 
             // Touch screen (possibly multiple contact points)
             } else if (e.touches) {
                // Tried this but can't. Must start with a gesture on the host.
                // Use 4-finger touch to toggle fullscreen on the host.
                if ((e.touches.length == 4) && (fromListener != 'touchmove')) {
                   var control_message = {'from':cl.name, 'to':'host', 'data':{'fullScreen':'off'} };
                   socket.emit('control message', JSON.stringify( control_message));
                }
 
                for (var i = 0, len = e.touches.length; i < len; i++) {
                   touchPoints_2d_px[i] = gW.screenFromRaw_2d_px( clientCanvas_tt, new gW.Vec2D( e.touches[i].clientX, e.touches[i].clientY));
                }
             }
             // Interpret the touch and mouse events using the twoThumbs interface.
             twoThumbs.processMultiTouch( touchPoints_2d_px);
 
          } */
             // Determine event type
             // Mouse
             if (e.clientX) {
                var raw_x_px = e.clientX;
                var raw_y_px = e.clientY;
             // Touch screen
             } else if (e.touches) {
                // Only consider the first touch event.
                var raw_x_px = e.touches[0].clientX;
                var raw_y_px = e.touches[0].clientY;
             }
 
             // Convert the raw mouse position into coordinated relative to the corner of the imaging element.
             var screen_2d_px = gW.screenFromRaw_2d_px( videoMirror, new gW.Vec2D( raw_x_px, raw_y_px));
 
             // Send the state to the server (there it will be relayed to the host client).
             mK.mX = screen_2d_px.x;
             mK.mY = screen_2d_px.y;
             var Type = e.type;
             var keyInput = e.key;
             if(Type == 'mousedown') console.log("hi3");
             if(Type == 'mouseup') console.log("hi4");
             if(Type == 'keydown' || Type == 'keyup')
             {
                keyInput = keyInput.toLowerCase();
                console.log("hi5");
             }
 
             var allData = { "mouseX" :  mK.mX, "mouseY" : mK.mY, "eventType" : Type, "key" : keyInput };
             $.ajax({
                 url: "http://192.168.0.107:3000/mouse_move",
                 type: "GET",
                 dataType: "json",
                 data: allData,
                 success: function(data){
                   console.log("success");
                 },
                 error: function (request, status, error){
                   //console.log("gg");
                 }
               });
 
             handle_sending_mK_data( mK);
 
       };
 
       document.addEventListener("mouseup", function( e) {
          if (!mK.MD) return;
 
          // Unlike for the host client, DO NOT shut down the mousemove listener. That
          // way we can see the mouse position even if the buttons are released.
 
          resetMouseOrFingerState( e);
       }, {capture: false});
 
       document.addEventListener("touchend", function( e) {
          // Don't seem to need this...
          //if (!mK.MD) return;
 
          // Note: e.preventDefault() not needed here if the following canvas style is set
          // touch-action: none;
 
          resetMouseOrFingerState( e);
       }, {capture: false});
 
       function resetMouseOrFingerState( e) {
          if (e.changedTouches) {
             var releasePoint_2d_px = gW.screenFromRaw_2d_px( clientCanvas_tt, new gW.Vec2D( e.changedTouches[0].clientX, e.changedTouches[0].clientY));
             twoThumbs.processSingleTouchRelease(  releasePoint_2d_px);
          }
 
          mK.MD = false; // Mouse Down
          mK.bu = null;  // Mouse button number
          handle_sending_mK_data( mK);
       }
 
       document.addEventListener("keydown", function( e) {
          //console.log("e.keyCode = " + e.keyCode);
 
          handleMouseOrTouchMove( e, 'keydown');
 
          // This allows the spacebar to be used for the puck shields.
          if (keyMap[e.keyCode] == 'sp') {
             // Inhibit page scrolling that results from using the spacebar.
             e.preventDefault();
             // The following is necessary in Firefox to avoid the spacebar from re-clicking
             // page controls (like the demo buttons) if they have focus.
             if (document.activeElement != document.body) document.activeElement.blur();
          }
 
          //console.log(e.keyCode + "(down)=" + String.fromCharCode(e.keyCode));
 
          if (e.keyCode in keyMap_cso) {
             console.log("keyMap value = " + e.keyCode + ", " + keyMap_cso[e.keyCode]);
             if (mK_cso[keyMap_cso[e.keyCode]] == 'U') {
                // Set the key to DOWN.
                mK_cso[keyMap_cso[e.keyCode]] = 'D';
             }
          }
 
          // Toggle the p2p connection
          if ((mK_cso.key_p == 'D') && (mK_cso.key_shift == 'D')) {
             rtc_choke = !rtc_choke;
             refresh_P2P_indicator({});
 
          // Esc out of full-screen mode (only mildly useful if the twothumbs checkbox is not hidden)
          // If you're in fullscreen mode, this one won't
          // be the first to fire. The fullscreenchange handler fires first. Then, after
          // a second esc key press, this block will execute.
          } else if (keyMap_cso[e.keyCode] == 'key_esc') {
             //console.log('in key_esc block');
 
             // Reveal the video element (and hide the canvas).
             videoMirror.removeAttribute("hidden");
             clientCanvas_tt.setAttribute("hidden", null);
 
             chkTwoThumbs.checked = false;
             twoThumbs.enabled = false;
          }
 
          if (e.keyCode in keyMap) {
             //console.log("keyMap value = " + keyMap[e.keyCode]);
             if (mK[keyMap[e.keyCode]] == 'U') {
                // Set the key to DOWN.
                mK[keyMap[e.keyCode]] = 'D';
                handle_sending_mK_data( mK);
             }
          }
 
       }, {capture: false}); //"false" makes this fire in the bubbling phase (not capturing phase).
 
       document.addEventListener("keyup", function(e) {
 
          handleMouseOrTouchMove( e, 'keyup');
          //console.log(e.keyCode + "(up)=" + String.fromCharCode(e.keyCode));
          if (e.keyCode in keyMap) {
             // Set the key to UP.
             mK[keyMap[e.keyCode]] = 'U';
             handle_sending_mK_data( mK);
          }
          if (e.keyCode in keyMap_cso) {
             // Set the key to UP.
             mK_cso[keyMap_cso[e.keyCode]] = 'U';
          }
       }, {capture: false}); //"false" makes this fire in the bubbling phase (not capturing phase).
 
       // Video stream checkbox.
       chkRequestStream = document.getElementById('chkRequestStream');
       chkRequestStream.checked = false;
       chkRequestStream.addEventListener("click", function() {
 
          // You checked it.
          if (chkRequestStream.checked) {
             $('#FullScreen').prop('disabled', false);
             if ($('#roomName').val() == "") {
                displayMessage('');
                displayMessage('You must have a room name in the red box. Try again.');
                displayMessage('');
                chkRequestStream.checked = false;
             } else {
 
                if (chkTwoThumbs.checked) {
                   // Uncheck twoThumbs (but it's probably hidden unless I'm testing)
                   chkTwoThumbs.click();
                }
 
                // re-negotiate the connection.
                window.setTimeout(function() {
                   connect_and_listen('client', 're-connect');
                }, 100);
             }
          // You unchecked it.
          } else {
             $('#FullScreen').prop('disabled', true);
             if (socket) {
                var control_message = {'from':cl.name, 'to':'host', 'data':{'videoStream':'off'} };
                socket.emit('control message', JSON.stringify( control_message));
 
                // Wait a bit for the above message to get to the host. Then clean out the
                // video element.
                window.setTimeout(function() {
                   if (videoMirror.srcObject) videoMirror.srcObject = null;
                }, 200);
 
             } else {
                displayMessage('');
                displayMessage("If you haven't already, please connect to the host.");
             }
          }
       }, {capture: false});
 
       // This control can be useful for testing but is normally hidden. Edit indexClient.html
       // to un-hide it.
       chkTwoThumbs = document.getElementById('chkTwoThumbs');
       chkTwoThumbs.checked = false;
       chkTwoThumbs.addEventListener("click", function() {
          if (chkTwoThumbs.checked) {
             twoThumbs.changeDisplay('normal');
          } else {
             twoThumbs.changeDisplay('exit');
          }
       }, {capture: false});
 
       // Button for entering the mobile client interface
       btnTwoThumbs = document.getElementById('twoThumbsButton');
       btnTwoThumbs.addEventListener("click", function() {
          twoThumbs.changeDisplay('fullScreen');
       }, {capture: false});
 
       // Full screen button (on client)
       btnFullScreen = document.getElementById('FullScreen');
       btnFullScreen.addEventListener('click', function() {
          changeFullScreenMode(videoMirror, 'on');
       }, {capture: false});
 
       // Local cursor is handy if the engine is paused. Also give visual indicator of lag.
       chkLocalCursor = document.getElementById('chkLocalCursor');
       chkLocalCursor.checked = true;
       chkLocalCursor.addEventListener("click", function() {
          //console.log("chkLocalCursor.checked=" + chkLocalCursor.checked);
          //console.log('in chkLocalCursor, cursor=' + videoMirror.style.cursor + '|');
          if (chkLocalCursor.checked) {
             videoMirror.style.cursor = 'default';
             clientCanvas_tt.style.cursor = 'default';
          } else {
             videoMirror.style.cursor = 'none';
             clientCanvas_tt.style.cursor = 'none';
          }
       }, {capture: false});
 
       // Option for connecting without a puck.
       chkPlayer = document.getElementById('chkPlayer');
       chkPlayer.checked = true;
 
       // For handling the first press of the ESC key (exiting fullscreen mode)
       $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange msfullscreenchange', function(e) {
          // Check the fullscreen state.
 
          // Starting fullscreen
          if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
             console.log('fullscreen state: TRUE');
 
          // Exiting fullscreen
          } else {
             console.log('fullscreen state: FALSE');
             clientCanvas_tt.width  = videoMirror.width;
             clientCanvas_tt.height = videoMirror.height;
             twoThumbs.changeDisplay('exit');
          }
       });
 
    }
 
 
    // Reveal public pointers to private functions and properties ///////////////
 
    return {
       //nodeServerURL: nodeServerURL,
       forceClientDisconnect: forceClientDisconnect,
       resizeClients: resizeClients,
       init_chatFeatures: init_chatFeatures,
       init_nonHostClients: init_nonHostClients,
       connect_and_listen: connect_and_listen,
       refresh_P2P_indicator: refresh_P2P_indicator,
       setCanvasStream: setCanvasStream,
       changeFullScreenMode: changeFullScreenMode,
       chatToNonHostPlayers: chatToNonHostPlayers,
       displayMessage: displayMessage,
       getGameReportCounter: getGameReportCounter,
       checkForNickName: checkForNickName,
       RTC: RTC
    };
 
 })();
 