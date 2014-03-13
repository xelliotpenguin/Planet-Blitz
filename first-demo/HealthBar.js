var HealthBar = Sprite.extend({
	init: function(sceneAddCmd, sceneRemoveCmd, tileSize, position, barAspectRatio, maxHealth) {
		this._super(sceneAddCmd, sceneRemoveCmd);

		this.tileSize = tileSize;
		this.barAspectRatio = barAspectRatio;

		var canvas = document.createElement('canvas');
		this.canvas2d = canvas.getContext('2d');

		this.healthBarTexture = new THREE.Texture(canvas);
		this.healthBarTexture.needsUpdate = true;

		var healthBarMaterial = new THREE.SpriteMaterial({
			map: this.healthBarTexture,
			useScreenCoordinates: false,
			alignment: THREE.SpriteAlignment.center
		});

		this.healthBarXOffset = this.tileSize / 2;
		this.healthBarZOffset = 0;
		this.healthBarYOffset = 69;
		this.healthBar = new THREE.Sprite(healthBarMaterial);

		this.maximumHealth = maxHealth;

		this.canvas2d.rect(150, 0, 600, 150);
		this.canvas2d.fillStyle = "red";
		this.canvas2d.fill();
		this.healthBar.position.set(position.x + this.healthBarXOffset,
			position.y + this.healthBarYOffset,
			position.z + this.healthBarZOffset);
		this.healthBar.scale.set(this.tileSize * 2, this.tileSize / this.barAspectRatio, 1.0);
	},

	getRepr: function() {
		return this.healthBar;
	},

	onUnitHealthChanged: function(health) {
		this.healthBar.scale.set(this.tileSize * 2 * (1.0 * health) / this.maximumHealth,
			this.tileSize / this.barAspectRatio, 1.0);
	},

	onUnitPositionChanged: function(position) {
		this.healthBar.position.x = position.x + this.healthBarXOffset;
		this.healthBar.position.y = position.y + this.healthBarYOffset;
		this.healthBar.position.z = position.z + this.healthBarZOffset;
	},

	reset: function(position) {
		this.healthBar.position.set(position.x + this.healthBarXOffset,
			position.y + this.healthBarYOffset,
			position.z + this.healthBarZOffset);
		this.healthBar.scale.set(this.tileSize * 2, this.tileSize / this.barAspectRatio, 1.0);
	},

});