/* Game world */
var Grid = Class.extend({
    // Class constructor
    init: function(gameApp, width, length, tileSize, scene, camera, controls) {
        'use strict';

        this.gameApp = gameApp;

        this.GROUND_TEXTURE = "images/Supernova.jpg"

        this.gridWidth = width;
        this.gridLength = length;
        this.tileSize = tileSize;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;

        // information about what's being selected
        this.highlightedTiles = null;
        this.currentMouseOverTile = null;
        this.currentSelectedUnits = [];

        // listeners and state
        this.mouseDownListenerActive = true;
        this.mouseOverListenerActive = true;

        this.gridHelper = new GridHelper(this.camera, this.controls);

        // create sprite factory        
        var scope = this;

        var sceneAddCmd = new SpriteCmd(function(sprite) {
            scope.scene.add(sprite.getRepr());
        });
        var sceneRemoveCmd = new SpriteCmd(function(sprite) {
            scope.scene.remove(sprite.getRepr());
        });
        this.spriteFactory = new SpriteFactory(this, sceneAddCmd, sceneRemoveCmd);

        this.reset();

        // nonessentials
        this.setupMouseMoveListener();
        this.setupMouseDownListener();
        this.setupHotkeys();

        this.unitCycle = 0;
        this.resetInProgress = false;

        this.hotkeys = [];
    },

    getCharacters: function() {
        return this.spriteFactory.getCharacters();
    },

    onGameStart: function() {
        for (var tm = GameInfo.numOfTeams; tm < 4; tm++) {
            for (var i = 0; i < this.numOfCharacters; i++) {
                this.silentlyRemoveCharacter(this.getCharacterById(tm, i));
            }
        }

        console.log("Team id " + GameInfo.myTeamId);

        if (this.getCurrentSelectedUnit()) {
            // TODO: duplicated code

            this.getCurrentSelectedUnit().deselect();
            // deselect tiles if there were any
            this.getCurrentSelectedUnit().highlightedTiles.forEach(function(tile) {
                tile.reset();
            });

            this.currentSelectedUnits[GameInfo.myTeamId] = null;
            this.deselectHighlightedTiles();
        }

        var teamJoinMessage;
        switch (GameInfo.myTeamId) {
            case 0:
                teamJoinMessage = "You spawned at top";
                break;
            case 1:
                teamJoinMessage = "You spawned at bottom";
                break;
            case 2:
                teamJoinMessage = "You spawned at left";
                break;
            case 3:
                teamJoinMessage = "You spawned at right";
                break;
        }

        this.controls.rotateRight(this.getCameraDegreesToRotate());
        // this.displayMessage(teamJoinMessage);

        // focus camera on start position (TODO: hardcoded)
        this.controls.focusOnPosition(this.getMyTeamCharacters()[0].mesh.position);
    },

    onGameFinish: function() {
        console.log("Game finish called");

        // reset the pointerlock
        this.controls.reset();
    },

    getMyTeamCharacters: function() {
        return _.filter(this.getCharacters(), function(character) {
            return character.team == GameInfo.myTeamId && character.active;
        });
    },

    setupHotkeys: function() {
        var scope = this;
        var unitNumbers = [1, 2, 3];

        unitNumbers.forEach(function(number) {
            var hotkey = number.toString();
            KeyboardJS.on(hotkey,
                function(event, keysPressed, keyCombo) {
                    // TODO: replace this with a more readable line. Also, need to account for out of index errors when units get killed
                    var characterSelected = scope.getMyTeamCharacters()[parseInt(keyCombo) - 1];
                    if (characterSelected && characterSelected.active) {
                        characterSelected.onSelect();
                    }
                }
            );
        });

        // unit toggle - cycle forwards
        KeyboardJS.on("t",
            function(event, keysPressed, keyCombo) {
                var myTeamCharacters = scope.getMyTeamCharacters();
                var characterSelected = myTeamCharacters[scope.unitCycle];
                if (characterSelected.active) {
                    characterSelected.onSelect();
                }
                scope.unitCycle = (scope.unitCycle + 1) % myTeamCharacters.length;
            }
        );

        // unit toggle - cycle backwards
        KeyboardJS.on("r",
            function(event, keysPressed, keyCombo) {
                var myTeamCharacters = scope.getMyTeamCharacters();
                var characterSelected = myTeamCharacters[scope.unitCycle];
                if (characterSelected.active) {
                    characterSelected.onSelect();
                }
                if (scope.unitCycle == 0) {
                    scope.unitCycle = myTeamCharacters.length - 1;
                } else {
                    scope.unitCycle -= 1;
                }
            }
        );

        // focus camera on unit
        KeyboardJS.on("space",
            function(event, keysPressed, keyCombo) {
                var character = scope.getCurrentSelectedUnit();
                if (character && character.active) {
                    scope.controls.focusOnPosition(character.mesh.position);
                }
            }
        );

        // rudimentary camera rotation
        KeyboardJS.on("q",
            function(event, keysPressed, keyCombo) {
                scope.controls.rotateLeft(Math.PI / 30);
            }
        );

        KeyboardJS.on("e",
            function(event, keysPressed, keyCombo) {
                scope.controls.rotateRight(Math.PI / 30);
            }
        );

    },

    setupCharacters: function() {
        this.numOfCharacters = 3;
        // The row position.
        this.teamStartPos = [1, 18, 1, 18];

        // Sequence number for synchornization.
        this.seq = 0;

        var scope = this;

        for (var team_id = 0; team_id < 4; team_id++) {
            for (var i = 0; i < this.numOfCharacters; i++) {
                var characterId = i;

                var character;
                if (i == 0) {
                    character = this.spriteFactory.createSoldier(team_id, characterId);
                } else if (i == 1) {
                    character = this.spriteFactory.createArtillerySoldier(team_id, characterId);
                } else {
                    character = this.spriteFactory.createFlamethrowerSoldier(team_id, characterId);
                }

                var startX, startY;
                if (team_id < 2) {
                    startX = i + 9;
                    startY = this.teamStartPos[team_id];
                } else {
                    startX = this.teamStartPos[team_id];
                    startY = i + 9;
                }
                character.placeAtGridPos(startX, startY);

                // TODO: temporary fix until initial rotation is handled properly
                character.getRepr().rotation.y = this.getUnitDegreesToRotate(team_id);

                this.markTileOccupiedByCharacter(startX, startY);
            }
        }
    },

    getUnitDegreesToRotate: function(team_id) {
        switch (team_id) {
            case 0:
                degreesToRotate = 0;
                break;
            case 1:
                degreesToRotate = Math.PI;
                break;
            case 2:
                degreesToRotate = Math.PI / 2; 
                break;
            case 3:
                degreesToRotate = 3 * Math.PI / 2;
                break;
        }

        return degreesToRotate;
    },


    getCameraDegreesToRotate: function() {
        switch (GameInfo.myTeamId) {
            case 0:
                degreesToRotate = Math.PI;
                break;
            case 1:
                degreesToRotate = 0;
                break;
            case 2:
                degreesToRotate = 3 * Math.PI / 2; 
                break;
            case 3:
                degreesToRotate = Math.PI / 2;
                break;
        }

        return degreesToRotate;
    },

    getCharacterById: function(team, id) {
        var characters = this.getCharacters();
        // search through characters
        for (var i = 0; i < characters.length; i++) {
            var character = characters[i];
            if (character.team == team && character.id == id) {
                return character;
            }
        }

        return null;
    },

    displayMessage: function(msg) {
        this.gameApp.displayMessage(msg);
    },

    silentlyRemoveCharacter: function(character) {
        // if the character was the currently selected unit, then reset tile state
        if (this.getCurrentSelectedUnit() == character) {
            // deselect character
            character.deselect();

            // deselect tiles if there were any
            character.highlightedTiles.forEach(function(tile) {
                tile.reset();
            });

            this.currentSelectedUnits[GameInfo.myTeamId] = null;
            this.deselectHighlightedTiles();
        }

        // mark tile position as available
        var xPos = character.getTileXPos();
        var zPos = character.getTileZPos();
        this.getTileAtTilePos(xPos, zPos).hasCharacter = false;

        character.destroy();
    },

    handleCharacterDead: function(character) {
        this.displayMessage("A robot was destroyed!");

        this.silentlyRemoveCharacter(character);
    },

    convertXPosToWorldX: function(tileXPos) {
        return -((this.gridWidth) / 2) + (tileXPos * this.tileSize);
    },

    convertZPosToWorldZ: function(tileZPos) {
        return -((this.gridLength / 2)) + (tileZPos * this.tileSize);
    },

    markCharacterAsSelected: function(character) {
        this.currentSelectedUnits[GameInfo.myTeamId] = character;

        // show character movement speed
        this.displayMovementArea(character);
    },

    markTileAsSelected: function(tile) {
        if (tile == this.currentMouseOverTile) {
            return;
        }

        if (this.currentMouseOverTile) {
            this.currentMouseOverTile.markAsNotSelected();
        }

        this.currentMouseOverTile = tile;
    },

    markTileOccupiedByCharacter: function(xPos, zPos) {

        var tile = this.getTileAtTilePos(xPos, zPos);
        if (tile) {
            tile.hasCharacter = true;
            this.setPFGridCellAccessibility(xPos, zPos, false);
        }
    },

    markTileNotOccupiedByCharacter: function(xPos, zPos) {
        var tile = this.getTileAtTilePos(xPos, zPos);
        if (tile) {
            tile.hasCharacter = false;
            tile.setHasCharacter(false);
            this.setPFGridCellAccessibility(xPos, zPos, true);
        }
    },

    markTileOccupiedByObstacle: function() {

    },

    findPath: function(oldXPos, oldZPos, newXPos, newZPos) {
        return this.pathFinder.findPath(oldXPos, oldZPos, newXPos, newZPos, this.PFGrid.clone());
    },

    displayMovementArea: function(character) {
        // deselect any previously highlighted tiles
        if (this.currentMouseOverTile) {
            this.currentMouseOverTile.reset();
        }

        if (character.isCharacterInRoute == false && character.isCoolDown == false && character.active) {
            this.deselectHighlightedTiles();

            var characterMovementRange = character.getMovementRange();
            // highlight adjacent squares - collect all tiles from radius
            var tilesToHighlight = this.getTilesInArea(character, characterMovementRange);
            this.highlightTiles(tilesToHighlight);
        }
    },

    deselectHighlightedTiles: function() {
        // deselect tiles.
        if (this.highlightedTiles) {
            this.highlightedTiles.forEach(function(tile) {
                tile.reset();
            });
        }
    },

    highlightTiles: function(tilesToHighlight) {
        tilesToHighlight.forEach(function(tile) {
            tile.setSelectable(true);
            tile.setMovable(true);
            tile.markAsMovable();
        });
        this.highlightedTiles = tilesToHighlight;
    },

    setPFGridCellAccessibility: function(x, z, hasObstacleOnCell) {
        this.PFGrid.setWalkableAt(x, z, hasObstacleOnCell);
    },

    getTilesInArea: function(character, radius) {
        // DO A BFS here
        var tilesToHighlight = [];
        var startTile = this.getTileAtTilePos(character.getTileXPos(), character.getTileZPos());
        if (!startTile) return tilesToHighlight;

        startTile.isObstacle();
        var visited = [];
        var nodesInCurrentLevel = [];
        var nodesInNextLevel = [];
        tilesToHighlight.push(startTile);
        nodesInCurrentLevel.push(startTile);

        while (nodesInCurrentLevel.length > 0 && radius > 0) {
            var currentTile = nodesInCurrentLevel.pop();

            var validNeighbors = this.getNeighborTiles(currentTile.xPos, currentTile.zPos);
            for (var i = 0; i < validNeighbors.length; i++) {
                var neighbor = validNeighbors[i];
                if (_.indexOf(visited, neighbor) == -1 && _.indexOf(nodesInNextLevel, neighbor) == -1) {
                    tilesToHighlight.push(neighbor);
                    nodesInNextLevel.push(neighbor);
                }
            }

            if (nodesInCurrentLevel.length == 0) {
                nodesInCurrentLevel = nodesInNextLevel;
                nodesInNextLevel = [];
                radius = radius - 1;
            }
            visited.push(currentTile);
        }

        return tilesToHighlight;
    },

    getNeighborTiles: function(originTileXPos, originTileZPos) {
        var tiles = [];

        tiles.push(this.getTileAtTilePos(originTileXPos - 1, originTileZPos));
        tiles.push(this.getTileAtTilePos(originTileXPos + 1, originTileZPos));
        tiles.push(this.getTileAtTilePos(originTileXPos, originTileZPos - 1));
        tiles.push(this.getTileAtTilePos(originTileXPos, originTileZPos + 1));

        tiles = _.filter(tiles, function(tile) {
            return (tile != null && !tile.isObstacle() && !tile.isCharacter());
        });
        return tiles;
    },

    setupMouseMoveListener: function() {
        var scope = this;

        window.addEventListener('mousemove', function(event) {
            scope.onMouseMove(event);
        }, false);
    },

    onMouseMove: function(event) {
        if (this.mouseMoveListenerActive == false) {
            return;
        }

        // recursively call intersects
        var raycaster = this.gridHelper.getRaycaster();
        var intersectsWithTiles = raycaster.intersectObjects(this.tiles.children);

        for (var i = 0; i < intersectsWithTiles.length; i++) {
            var intersection = intersectsWithTiles[i];
            obj = intersection.object.owner;
            obj.onMouseOver();
        }

        if (this.getCurrentSelectedUnit()) {
            var mouseLocation = this.gridHelper.getMouseProjectionOnGrid();
            this.getCurrentSelectedUnit().onMouseMovement(mouseLocation);
        }
    },

    setupMouseDownListener: function() {
        var scope = this;

        window.addEventListener('mousedown', function(event) {
            if (scope.mouseDownListenerActive) {
                scope.onMouseDown(event);
            }
        }, false);
    },

    handleShootEvent: function() {
        var to = this.gridHelper.getMouseProjectionOnGrid();
        this.getCurrentSelectedUnit().shoot(to, true);
    },

    getCurrentSelectedUnit: function() {
        return this.currentSelectedUnits[GameInfo.myTeamId];
    },

    onMouseDown: function(event) {
        var RIGHT_CLICK = 3;
        var LEFT_CLICK = 1;

        var raycaster = this.gridHelper.getRaycaster();

        // recursively call intersects
        var characterMeshes = _.map(this.getCharacters(), function(character) {
            return character.getRepr();
        });

        var intersects = raycaster.intersectObjects(characterMeshes, true);
        var intersectsWithTiles = raycaster.intersectObjects(this.tiles.children);
        var unitIsCurrentlySelected = (this.getCurrentSelectedUnit() != null);

        if (unitIsCurrentlySelected) {
            // fire on click
            if (event.which == RIGHT_CLICK) {
                this.handleShootEvent();
            }
        }

        // move on click
        if (event.which == LEFT_CLICK) {
            // care about characters first, then tile intersects
            var continueClickHandler = false;

            if (intersects.length > 0) {
                var clickedObject = intersects[0].object.owner;

                // done so that you can click on a tile behind a character easily
                if (clickedObject != this.getCurrentSelectedUnit()) {
                    clickedObject.onSelect();
                } else {
                    continueClickHandler = true;
                }
            } else {
                continueClickHandler = true;
            }

            // case where unit is moving
            if (continueClickHandler) {
                this.handleMoveCase(intersectsWithTiles);
            }
        }
    },

    handleMoveCase: function(intersectsWithTiles) {
        if (intersectsWithTiles.length > 0) {
            var tileSelected = intersectsWithTiles[0].object.owner;
            var coordinate = tileSelected.onMouseOver();

            if (this.getCurrentSelectedUnit() && coordinate) {
                var deltaX = coordinate.x - this.getCurrentSelectedUnit().getTileXPos();
                var deltaY = 0;
                var deltaZ = coordinate.z - this.getCurrentSelectedUnit().getTileZPos();

                var unitMovedToDifferentSquare = !(deltaX == 0 && deltaZ == 0);

                if (unitMovedToDifferentSquare) {
                    // Put the network communication here.
                    if (this.getCurrentSelectedUnit().isCoolDown == 0) {
                        if (!GameInfo.netMode) {
                            this.getCurrentSelectedUnit().setDirection(new THREE.Vector3(deltaX, 0, deltaZ));
                            this.getCurrentSelectedUnit().enqueueMotion();
                        } else {
                            sendMoveMsg(this.getCurrentSelectedUnit().id,
                                deltaX, deltaY, deltaZ);
                        }
                    }
                }
            }
        }
    },

    getTileAtTilePos: function(xPos, zPos) {
        // TODO: better error handling here?
        if (xPos < 0 || zPos < 0) {
            return null;
        }
        if (xPos >= this.numberSquaresOnXAxis || zPos >= this.numberSquaresOnZAxis) {
            return null;
        }

        return this.tilesArray[xPos][zPos];
    },

    loadGround: function() {
        var texture = THREE.ImageUtils.loadTexture(this.GROUND_TEXTURE);

        var groundMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: texture
        });

        var ground = new THREE.Mesh(new THREE.PlaneGeometry(this.gridWidth, this.gridLength), groundMaterial);
        ground.rotation.x = -0.5 * Math.PI;

        var Y_BUFFER = -0.5;
        // needed because otherwise tiles will overlay directly on the grid and will cause glitching during scrolling ("z fighting")
        ground.position.y = Y_BUFFER;
        // offset to fit grid drawing 
        ground.position.x -= this.tileSize / 2;
        ground.position.z -= this.tileSize / 2;

        this.scene.add(ground);
    },

    drawGridSquares: function(width, length, size) {
        this.tileFactory = new TileFactory(this, size);

        this.numberSquaresOnXAxis = width / size;
        this.numberSquaresOnZAxis = length / size;

        this.tilesArray = new Array(this.numberSquaresOnXAxis);
        for (var i = 0; i < this.numberSquaresOnXAxis; i++) {
            this.tilesArray[i] = new Array(this.numberSquaresOnZAxis);
        }

        for (var i = 0; i < this.numberSquaresOnXAxis; i++) {
            for (var j = 0; j < this.numberSquaresOnZAxis; j++) {
                var tile = this.tileFactory.createTile(i, j);

                var tileMesh = tile.getTileMesh();
                this.tilesArray[i][j] = tile;

                this.tiles.add(tileMesh);
            }
        }

        this.PFGrid = new PF.Grid(this.numberSquaresOnXAxis, this.numberSquaresOnZAxis);
        this.pathFinder = new PF.AStarFinder();

        this.scene.add(this.tiles);
    },

    getTileSize: function() {
        return this.tileSize;
    },

    getNumberSquaresOnXAxis: function() {
        return this.numberSquaresOnXAxis;
    },

    getNumberSquaresOnZAxis: function() {
        return this.numberSquaresOnZAxis;
    },

    update: function(delta) {
        var scope = this;
        this.spriteFactory.notifyAll(new SpriteCmd(
            function(sprite) {
                // TODO: extract the dispatcher from the esprite factory
                sprite.update(delta, scope.spriteFactory);
            }
        ));

        this.spriteFactory.updateCharactersContainer();
        this.spriteFactory.updateBulletsContainer();
    },

    syncGameState: function(state) {
        if (this.resetInProgress) return true;

        // This is usd to check ghosts.
        var liveChars = [];
        var liveStates = [];
        for (var t = 0; t < GameInfo.numOfTeams; t++) {
            liveStates.push(new Array());
            for (var i = 0; i < this.numOfCharacters; i++) {
                liveStates[t].push(false);
            }
        }
        // First check the correctness of each position.
        for (var t = 0; t < state.length; t++) {
            var teamId = parseInt(state[t][State.team]);
            var index = parseInt(state[t][State.index]);
            var x = parseInt(state[t][State.X]);
            var z = parseInt(state[t][State.Z]);
            var health = parseInt(state[t][State.health]);
            // Character to check.
            var charToCheck = this.getCharacterById(teamId, index);


            liveStates[teamId][index] = true;
            if (charToCheck != null && charToCheck.active) {
                // Sync the health.
                charToCheck.health = health;
                var dest;
                if (charToCheck.isInRoute()) {
                    dest = charToCheck.getDestination();
                } else {
                    dest = charToCheck.getCurrentPosition();
                }
                if (dest.x != x || dest.z != z) {
                    // Inconsistent with auth state, adjust position.
                    console.log("Inconsi pos ");
                    charToCheck.placeAtGridPos(x, z);
                }
            }
        }

        var isStateGood = true;
        for (var t = 0; t < GameInfo.numOfTeams; t++) {
            for (var i = 0; i < this.numOfCharacters; i++) {
                var charToCheck = this.getCharacterById(t, i);
                if (charToCheck !== null && !liveStates[t][i] && charToCheck.active) {
                    console.log("Zombie character!");
                    // Server says dead but active locally.
                    this.handleCharacterDead(charToCheck);
                    isStateGood = false;
                }
            }
        }
        return isStateGood;
    },

    disableMouseDownListener: function() {
        this.mouseDownListenerActive = false;
    },

    enableMouseDownListener: function() {
        this.mouseDownListenerActive = true;
    },

    disableMouseMoveListener: function() {
        this.mouseMoveListenerActive = false;
    },

    enableMouseMoveListener: function() {
        this.mouseMoveListenerActive = true;
    },

    reset: function() {
        console.log("Game reset");

        this.tiles = new THREE.Object3D();
        this.tilesArray = null;

        this.loadGround();
        this.drawGridSquares(this.gridWidth, this.gridLength, this.tileSize);

        // initialize characters
        this.setupCharacters();
        this.resetInProgress = false;

        this.deselectHighlightedTiles();

        this.camera.position.x = 0;
        this.camera.position.y = 600;
        this.camera.position.z = 400;

        this.controls.reset();
    },
});
