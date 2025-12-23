(function () {
  if (typeof THREE === 'undefined') {
    throw new Error('THREE is required for OrbitControls');
  }

  THREE.OrbitControls = function (object, domElement) {
    this.object = object;
    this.domElement = domElement || document;
    this.enabled = true;

    this.target = new THREE.Vector3();

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    this.enableZoom = true;
    this.zoomSpeed = 1.2;

    this.enablePan = true;
    this.panSpeed = 0.3;

    const scope = this;

    function onMouseMove(event) {
      if (!scope.enabled) return;
      if (event.buttons !== 1) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      scope.object.rotation.y -= movementX * 0.002;
      scope.object.rotation.x -= movementY * 0.002;
    }

    function onWheel(event) {
      if (!scope.enabled) return;
      scope.object.position.z += event.deltaY * 0.01;
    }

    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('wheel', onWheel);
  };
})();
