$(function () {

    var App = {};

    App = function(containerName) {
        // create a scene, that will hold all our elements such as objects, cameras and lights.
        this.scene = new THREE.Scene();

        // create a render and set the size
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // add the output of the renderer to the html element
        $(containerName).append(this.renderer.domElement);

        this.init();
    };

    App.prototype = {
        init: function() {

            this.setupCamera();

            this.stats = this.initStats();
            this.clock = new THREE.Clock();

            this.setupGameGrid();
            this.addLighting();

            this.setupControls();
            this.addControlGUI();

            // begin animation loop
            this.animate();
        }, 

        panForward: function(event) {
            this.camera.position.z -= 1;
        },

        panLeft: function(event) {
            this.camera.position.x -= 1;
        }, 

        panRight: function(event) {
            this.camera.position.x += 1;
        }, 

        panBackward: function(event) {
            this.camera.position.z += 1;
        },

        setupCamera: function() {
            // create a camera, which defines where we're looking at
            this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
            this.camera.position.x = 0;
            this.camera.position.y = 150;
            this.camera.position.z = 270;

            var origin = new THREE.Vector3(0, 0, 0);
            this.camera.lookAt(origin);
        },

        addLighting: function() {
            var ambientLight = new THREE.AmbientLight( 0x404040 );
            this.scene.add( ambientLight );

            var directionalLight = new THREE.DirectionalLight( 0xffffff );
            directionalLight.position.x = 1;
            directionalLight.position.y = 1;
            directionalLight.position.z = 0.75;
            directionalLight.position.normalize();
            this.scene.add( directionalLight );

            var directionalLight = new THREE.DirectionalLight( 0x808080 );
            directionalLight.position.x = - 1;
            directionalLight.position.y = 1;
            directionalLight.position.z = - 0.75;
            directionalLight.position.normalize();
            this.scene.add( directionalLight );
        },

        setupControls: function() {
            var controls = new THREE.MapControls(this.camera);
            controls.panSpeed = .31;

            // ensure that camera can't rotate too far down or up
            controls.minPolarAngle = 0.3;
            controls.maxPolarAngle = 1.26;

            this.controls = controls;
        },

        addControlGUI: function() {
            this.datGuiControls = new function() {
                this.perspective = "Perspective";
                this.switchCamera = function() {
                    if (app.camera instanceof THREE.PerspectiveCamera) {
                        app.camera = new THREE.OrthographicCamera( window.innerWidth / - 16, window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / - 16, -200, 500 );
                        app.camera.position.x = 3;
                        app.camera.position.y = 1;
                        app.camera.position.z = 3;

                        // app.camera.lookAt(app.scene.position);
                        app.perspective = "Orthographic";
                    } else {
                        app.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
                        app.camera.position.x = 120;
                        app.camera.position.y = 60;
                        app.camera.position.z = 180;

                        // app.camera.lookAt(app.scene.position);
                        app.perspective = "Perspective";
                    }
                };
            }

            var gui = new dat.GUI();

            gui.add(this.datGuiControls, 'switchCamera');
            gui.add(this.datGuiControls, 'perspective').listen();
        },

        setupGameGrid: function() {
            var squareSize = 40;
            this.grid = new Grid(400, 400, squareSize, this.scene, this.camera);
        }, 

        animate: function() {
            TWEEN.update();
            this.stats.update();

            var delta = this.clock.getDelta();
            this.controls.update(delta);
            this.grid.motion();

            // standard: render using requestAnimationFrame
            var me = this;
            requestAnimationFrame(function() {
                me.animate();
            });


            this.renderer.render(this.scene, this.camera);
        }, 

        initStats: function() {
            var stats = new Stats();

            stats.setMode(0); // 0: fps, 1: ms

            // Align top-left
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.left = '0px';
            stats.domElement.style.top = '0px';

            $("#Stats-output").append( stats.domElement );

            return stats;
        }

    };

    var app = new App("#WebGL-output");
    var MAPGAME = app;

});

