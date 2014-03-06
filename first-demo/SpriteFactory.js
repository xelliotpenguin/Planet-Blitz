// controls initialization of all sprites
// also the place to access all sprite lists
var SpriteFactory = Class.extend({

	init: function(sceneAddCmd, sceneRemoveCmd) {
		this.sceneAddCmd = sceneAddCmd;
		this.sceneRemoveCmd = sceneRemoveCmd;

		this.robots = [];
		this.bullets = [];
	},

	removeFromContainer: function(sprite, container) {
		var index = container.indexOf(sprite);

		if (index > -1) {
			container.splice(sprite);
		}

		if (index == -1) {
			console.error("Could not delete a sprite");
		}
	},

	removeRobot: function(robot) {
		var index = this.robots.indexOf(robot);

		if (index > -1) {
			this.robots.splice(index, -1);
		}
	},

	removeBullet: function(bullet) {
		var index = this.bullets.indexOf(bullet);

		if (index > -1) {
			this.bullets.splice(index, -1);
		}
	},

	createRobot: function(world, team, characterSize) {
		var scope = this;

		// decorator - allow character to add itself to its container
		var postInitCmd = new SpriteCmd(function(sprite) {
			scope.sceneAddCmd.execute(sprite);
			scope.robots.push(sprite);
		});

		// decorator - allow character to remove itself form the container
		var postDestroyCmd = new SpriteCmd(function(sprite) {
			scope.sceneRemoveCmd.execute(sprite);
			// scope.removeFromContainer(sprite, scope.robots);
			scope.removeRobot(sprite);
		});

		var robot = new Character(postInitCmd, postDestroyCmd, this, world, team, characterSize);
		robot.setup();

		return robot;
	},

	createBullet: function(cameraPosition, owner, from, to) {
		var scope = this;

		// duplicated code TODO - but the "more general version" doesn't work
		// decorator - allow character to add itself to its container
		var postInitCmd = new SpriteCmd(function(sprite) {
			scope.sceneAddCmd.execute(sprite);
			scope.bullets.push(sprite);
		});

		// decorator - allow character to remove itself form the container
		var postDestroyCmd = new SpriteCmd(function(sprite) {
			scope.sceneRemoveCmd.execute(sprite);
			scope.removeBullet(sprite);
		});

		var bullet = new Bullet(postInitCmd, postDestroyCmd, cameraPosition, owner, from, to);
		bullet.setup();

		return bullet;
	},

	createAmmoBar: function(characterSize, position, barAspectRatio) {
		var ammoBar = new AmmoBar(this.sceneAddCmd, this.sceneRemoveCmd, characterSize, position, barAspectRatio);
		ammoBar.setup();

		return ammoBar;
	},

	createHealthBar: function(characterSize, position, barAspectRatio, maximumHealth) {
		var healthBar = new HealthBar(this.sceneAddCmd, this.sceneRemoveCmd, characterSize, position, barAspectRatio, maximumHealth);
		healthBar.setup();

		return healthBar;
	},

	createCooldownBar: function(characterSize, position, barAspectRatio, coolDownCount) {
		var cooldownBar = new CooldownBar(this.sceneAddCmd, this.sceneRemoveCmd, characterSize, position, 10, coolDownCount);
		cooldownBar.setup();

		return cooldownBar;
	},

	getCharacters: function() {
		return this.robots;
	},

	getBullets: function() {
		return this.bullets;
	}

});