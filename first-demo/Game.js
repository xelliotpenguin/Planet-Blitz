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

            this.drawGamePlane();
            this.addLighting();

            this.setupControls();
            this.addControlGUI();

            this.addChaseCube();

            // begin animation
            this.animate();

            this.setupMouseMoveListener();
            
        }, 

        setupMouseMoveListener: function() {
            var scope = this;

            window.addEventListener( 'mousemove', 
                function(event) {

                    var projector = new THREE.Projector();
                    var mouseVector = new THREE.Vector3();
        
                    mouseVector.x = 2 * (event.clientX / window.innerWidth) - 1;
                    mouseVector.y = 1 - 2 * ( event.clientY / window.innerHeight );

                    var raycaster = projector.pickingRay( mouseVector.clone(), scope.camera ),
                        intersects = raycaster.intersectObjects( scope.cubes.children );

                    scope.cubes.children.forEach(function( cube ) {
                        cube.material.color.setRGB( cube.grayness, cube.grayness, cube.grayness );
                    });
                    
                    for( var i = 0; i < intersects.length; i++ ) {
                        var intersection = intersects[ i ],
                            obj = intersection.object;

                        obj.material.color.setRGB( 1.0 - i / intersects.length, 0, 0 );
                    }
                }, false );
        },

        addChaseCube: function() {
            // add a cube to the scene, which will be used to implement the chase camera
            var cubeGeometry = new THREE.CubeGeometry(5, 5, 5);
            var cubeMaterial = new THREE.MeshLambertMaterial({color: 0xFF0000});
            this.chaseCamCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            this.scene.add(this.chaseCamCube);
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

        drawGamePlane: function() {
            // create the ground plane
            this.planeGeometry = new THREE.PlaneGeometry(180, 180);
            var planeMaterial = new THREE.MeshLambertMaterial({color: 0xffffff});
            this.plane = new THREE.Mesh(this.planeGeometry, planeMaterial);

            // rotate and position the plane
            this.plane.rotation.x = -0.5 * Math.PI;
            this.plane.position.x = 0;
            this.plane.position.y = 0;
            this.plane.position.z = 0;
            // this.scene.add(this.plane);

            var squareSize = 5;
            this.drawGridSquares(squareSize);
        }, 

        drawGridSquares: function(size) {
            this.grid = new Grid(400, 400, 40, this.camera);

            this.grid.setControls();
            this.cubes = this.grid.cubes;
            this.characters = this.grid.characters;
            this.scene.add(this.grid.cubes);
            this.scene.add(this.grid.characters);
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

