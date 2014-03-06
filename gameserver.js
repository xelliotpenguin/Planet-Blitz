// Web framework.
var express = require('express');
var http = require('http');
var jade = require('jade');
var netconst = require(__dirname + '/server/public/netstate.js');
var app = express();

// IO socket.
var server = http.createServer(app);
var io = require('socket.io').listen(server);

// Engine for render html page.
app.set('views', __dirname + '/server/views');
app.set('view engine', 'jade');
app.set('view options', {layout : false});
app.configure(function() {
  app.use(express.static(__dirname + '/server/public'));
  app.use(express.static(__dirname + '/server/views'));
  app.use(express.static(__dirname + '/first-demo'));
  app.use(express.static(__dirname + '/libs'));
  app.use(express.static(__dirname + '/css'));
  app.use(express.static(__dirname + '/assets'));
});

// Server index page.
app.get('/', function(req, res) {
  res.render('index.jade');
});
server.listen(8080);


var Message = netconst.Message;
var Move = netconst.Move;
var State = netconst.State;
var Hit = netconst.Hit;
var Stat = netconst.Stat;
var Info = netconst.Info;
var games = new Array();
var numPlayers = 0;
var curGameId = 0
var teamStartPos = [1, 18, 1, 18];
var teamSize = 3;

// Increase for each new created game.
var gameIdSeq = 0;

// Room waiting for players.
var emptyGames = {};
var fullGames = new Array();


// IO communication.
io.sockets.on('connection', function(socket) {
  console.log('Player connection, #' + numPlayers);
  numPlayers++;

  socket.on(Message.LISTGAME, function() {
    var info = getAllGameInfo();
    console.log(info);
    socket.emit(Message.LISTGAME, getAllGameInfo());
  });

  socket.on(Message.CREATEGAME, function(gameRequest) {
    var gameName = gameRequest[Message.GAMENAME];
    var username = gameRequest[Message.USERNAME];
    var gameType = parseInt(gameRequest[Message.TYPE]);
    var newGame = new Game(gameIdSeq++, gameName, gameType);
    emptyGames[newGame.gameId] = newGame;
    newGame.addPlayer(socket, username);
    socket.set('username', username, function() {
      socket.set('inGame', newGame, function() {
        console.log('user ' + username + ' create game id ' + newGame.gameId);
        socket.emit(Message.GAME, newGame.getPlayerInfo());
      });
    });
  });


  socket.on(Message.JOIN, function(joinRequest) {
    var gameId = parseInt(joinRequest[Message.GAME]);
    var username = joinRequest[Message.USERNAME];
    var gameToJoin = emptyGames[gameId];
    if (gameToJoin && gameToJoin.numPlayers < gameToJoin.maxNumPlayers) {
      gameToJoin.addPlayer(socket, username);
      var username = joinRequest[Message.USERNAME];
      socket.set('username', username, function() {
        console.log('User ' + username + ' game ' + gameId);
        socket.set('inGame', gameToJoin, function() {
          var playerState = gameToJoin.getPlayerInfo();
          socket.broadcast.to(gameToJoin.room).emit(Message.JOIN, playerState);
          socket.emit(Message.JOIN, playerState);
          if (gameToJoin.isFull()) {
            var playerTeamInfo = gameToJoin.prepareGame();
            socket.broadcast.to(gameToJoin.room).emit(Message.PREPARE, playerTeamInfo);
            socket.emit(Message.PREPARE, playerTeamInfo);
          }
        });
      });
    }
  });


  socket.on(Message.READY, function() {
    socket.get('inGame', function(error, game) {
      game.numReadyPlayers++;
      if (game.isReady()) {
        var score = game.getScoreJSON();
        socket.broadcast.to(game.room).emit(Message.START, score);
        socket.emit(Message.START, score);
      }
    });
  });



  // Game packet handling.
  socket.on(Message.MOVE, function(message) {
    socket.get('inGame', function(error, game) {
      var newState = game.gameState.toJSON();
      // TODO: detect collision
      var validMove = game.gameState.updatePosState(message);
      if (validMove) {
        // Increase the seq for synchronization version.
        game.seq++;
        newState[Message.MOVE] =  message;
        newState[Message.SEQ] = game.seq;
        // When sends back the move update, sends the server state too.
        // Broadcast to the game room.
        socket.broadcast.to(game.room).emit(Message.MOVE, newState);
        socket.emit(Message.MOVE, newState);
      } else {
        socket.emit(Message.MOVE, newState);
      }
    });
  });

  socket.on(Message.SHOOT, function(message) {
    socket.get('inGame', function(error, game) {
      var room = game.room;
      socket.broadcast.to(room).emit(Message.SHOOT, message);
    });
  });

  socket.on(Message.HIT, function(message) {
    socket.get('inGame', function(error, game) {
      var newState = game.gameState.toJSON();
      var isKill = game.gameState.updateHealthState(message);
      if (isKill) {
        socket.get('username', function(error, username) {
          game.score[username].kill++;
          var team = parseInt(message[Hit.team]);
          for (var uname in game.score) {
            if (game.score[uname].teamId == team) {
              game.score[uname].death++;
              break;
            }
          }
        });
        message[Hit.kill] = true;
      }
      game.seq++;
      newState[Message.HIT] = message;
      newState[Message.SEQ] = game.seq;
      var gameScore = game.getScoreJSON();
      if (isKill) {
        newState[Stat.result] = gameScore;
      }
      
      socket.broadcast.to(game.room).emit(Message.HIT, newState);
      socket.emit(Message.HIT, newState);

        // Decide if the game finishes.
      console.log('Live team ' + game.gameState.numLiveTeams);
      if (game.gameState.numLiveTeams == 1) {
        socket.get('username', function(error, username) {
          game.score[username].win++;
          gameStatistics = {};
          gameStatistics[Stat.winner] = username
          var scoreStat = game.getScoreJSON();
          gameStatistics[Stat.result] = scoreStat;
          socket.broadcast.to(game.room).emit(Message.FINISH, gameStatistics);
          socket.emit(Message.FINISH, gameStatistics);
          // Reset the game state.
          game.restart();
        });
      }
    });
  });

  socket.on(Message.RESTART, function(message) {
    socket.get('gameId', function(error, gameId) {
      var curGame = games[gameId];
      // Send the team id to the player.
      var randomTeamId = curGame.teamIds[curGame.numPlayers++];
      socket.get('username', function(error, username) {
        curGame.score[username].teamId = randomTeamId;
      });
      var teamMsg = {};
      teamMsg[Message.TEAM] = randomTeamId;
      var playerState = curGame.numPlayers + '/' + curGame.maxNumPlayers;
      teamMsg[Message.JOIN] = playerState;

      socket.emit(Message.TEAM, teamMsg);
      socket.broadcast.to(curGame.room).emit(Message.JOIN, playerState);

      console.log('cur room players ' + playerState);
      // Start the game when full, and create a new one.
      if (curGame.numPlayers == curGame.maxNumPlayers) {
        console.log('start game for room ' + curGame.room);
        //io.sockets.in(curGame.room).emit(Message.Start);
        var score = curGame.getScoreJSON();
        socket.broadcast.to(curGame.room).emit(Message.START, score);
        socket.emit(Message.START, score);
      } 
    });
  });

  socket.on('disconnect', function(message) {
    socket.get('username', function(error, username) {
      console.log('******player ' + username + ' leave');
      socket.get('inGame', function(error, game) {
        if (game) {
          game.numPlayers--;
          if (game.numPlayers == 0) {
            delete emptyGames[game.gameId];
          }
        }
      });
    });
  });

});
  
function getAllGameInfo() {
  var games = new Array();
  for (var gameId in emptyGames) {
    var info = {};
    var game = emptyGames[gameId];
    info[Info.gameId] = gameId;
    info[Info.gameName] = game.gameName;
    info[Info.player] = game.numPlayers + '/' + game.maxNumPlayers;
    games.push(info);
  }
  return games;
}

/**
 * Class for a Game.
 */
function Game(gameId, gameName, maxNumPlayers) {
  this.usernames = new Array();
  this.gameId = gameId;
  this.gameName = gameName;
  this.isStart = false;
  this.numPlayers = 0;
  this.numReadyPlayers = 0;
  this.maxNumPlayers = maxNumPlayers;
  this.room = maxNumPlayers + 'room' + gameId;
  this.teamIds = new Array();
  this.gameState = new GameState(maxNumPlayers, teamSize);
  this.seq = 0;
  this.score = {};
  for (var t = 0; t < maxNumPlayers; t++) {
    this.teamIds.push(t);
  }
  shuffle(this.teamIds);
  console.log(this.teamIds);
}

// Shuffle an array.
function shuffle(o){
  for(var j, x, i = o.length;
      i; 
      j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
};

Game.prototype.getPlayerInfo = function() {
  return this.numPlayers + '/' + this.maxNumPlayers;
}

Game.prototype.addPlayer = function(sk, username) {
  sk.join(this.room);
  this.usernames.push(username);
  this.numPlayers++;
};

Game.prototype.restart = function() {
  this.isStart = false;
  this.numPlayers = 0;
  shuffle(this.teamIds);
  this.seq = 0;
  console.log(this.teamIds);
  this.gameState.restart();
};

Game.prototype.isFull = function() {
  return this.numPlayers == this.maxNumPlayers;
};

Game.prototype.isReady = function() {
  return this.numReadyPlayers == this.maxNumPlayers;
};

Game.prototype.prepareGame = function() {
  var playerTeamInfo = {};
  // Generate the positions here.
  for (var t = 0; t < this.usernames.length; t++) {
    var username = this.usernames[t];
    this.score[username] = new Score();
    this.score[username].teamId = this.teamIds[t];
    playerTeamInfo[username] = this.teamIds[t];
  }
  return playerTeamInfo;
};

Game.prototype.startGame = function() {
  // Generate the positions here.
};

Game.prototype.getScoreJSON = function() {
  var stat = {};
  for (var username in this.score) {
    var score = this.score[username];
    var detail = {};
    detail[Stat.kill] = score.kill;
    detail[Stat.death] = score.death;
    detail[Stat.win] = score.win;
    stat[username] = detail;
  }
  return stat;
}

function GameState(numOfTeams, teamSize) {
  this.teamSize = teamSize;
  this.numOfTeams = numOfTeams;
  this.numLiveTeams = numOfTeams;
  this.teams = new Array();
  for (var teamId = 0; teamId < numOfTeams; teamId++) {
    this.teams.push(new Array());
    for (var i = 0; i < teamSize; i++) {
        var startX, startZ;
        if (teamId < 2) {
          startX = i + 9;
          startZ = teamStartPos[teamId];
        } else {
          startX = teamStartPos[teamId];
          startZ = i + 9;
        }
        this.teams[teamId].push(new CharState(startX, startZ));
    }
  }
}

GameState.prototype.restart = function(data) {
  this.teams = new Array();
  this.numLiveTeams = this.numOfTeams;
  for (var teamId = 0; teamId < this.numOfTeams; teamId++) {
    this.teams.push(new Array());
    for (var i = 0; i < this.teamSize; i++) {
        var startX, startZ;
        if (teamId < 2) {
          startX = i + 9;
          startZ = teamStartPos[teamId];
        } else {
          startX = teamStartPos[teamId];
          startZ = i + 9;
        }
        this.teams[teamId].push(new CharState(startX, startZ));
    }
  }
}

GameState.prototype.updatePosState = function(data) {
  var teamId = parseInt(data[Move.team]);
  var index = parseInt(data[Move.index]);
  var deltaX = parseInt(data[Move.X]);
  var deltaZ = parseInt(data[Move.Z]);
  var mover = this.teams[teamId][index];
  // Already dead?
  if (!mover.alive) {
    console.log("Dead move...");
    return false;
  }
  var nextX = mover.x + deltaX;
  var nextZ = mover.z + deltaZ;
  for (var teamId = 0; teamId < this.teams.length; teamId++) {
    for (var i = 0; i < this.teamSize; i++) {
      var character = this.teams[teamId][i];
      if (character.alive) {
        if (character.x == nextX && character.z == nextZ) {
          console.log('Position conflict');
          return false;
        }
      }
    }
  }
  mover.x = nextX;
  mover.z = nextZ;
  return true;
};

GameState.prototype.updateHealthState = function(data) {
  var teamId = parseInt(data[Hit.team]);
  var index = parseInt(data[Hit.index]);
  var kill = false;
  if (!this.teams[teamId][index].alive) {
    console.log("Shot a corpus??");
    kill = true;
    return kill;
  }
  this.teams[teamId][index].health -= 30;
  if (this.teams[teamId][index].health < 0) {
    console.log("die");
    kill = true;
    this.teams[teamId][index].alive = false;
    var isTeamLive = false;
    for (var i = 0; i < this.teamSize; i++) {
      if (this.teams[teamId][i].alive) {
        isTeamLive = true;
        break;
      }
    }
    if (!isTeamLive) {
      this.numLiveTeams--;
    }
    console.log('liv team ' + this.numLiveTeams);
  }
  return kill;
};
  
GameState.prototype.toJSON = function() {
  var state = {};
  var teamStates = new Array();
  for (var teamId = 0; teamId < this.teams.length; teamId++) {
    for (var i = 0; i < this.teamSize; i++) {
      var character = this.teams[teamId][i];
      if (character.alive) {
        var characterState = {};
        characterState[State.team] = teamId;
        characterState[State.index] = i;
        characterState[State.X] = character.x;
        characterState[State.Z] = character.z;
        characterState[State.health] = character.health;
        teamStates.push(characterState);
      }
    }
  }
  state[Message.STATE] = teamStates;
  return state;
};

/* Represent a character's current state */
function CharState(x, z) {
  this.alive = true;
  this.x = x;
  this.z = z;
  this.health = 100;
}

/* A class for the summary of each player */
function Score() {
  this.kill = 0;
  this.death = 0;
  this.win = 0;
  // The team of for the player at current game.
  this.teamId;
}


