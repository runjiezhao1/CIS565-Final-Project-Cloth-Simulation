import { mat4, vec3 } from 'gl-matrix';

export class Camera {
    position: vec3;
    target: vec3;
    up: vec3;
    aspectRatio: number;
    fovY: number;
    near: number;
    far: number;
    projectionMatrix: mat4;
    viewMatrix: mat4;

    constructor(
        aspectRatio: number,
        fovY: number = 45 * (Math.PI / 180),
        near: number = 0.1,
        far: number = 100.0
    ) {
        this.position = vec3.fromValues(0, 0, 5); // Camera starting position
        this.target = vec3.fromValues(0, 0, 0);   // Look at the origin
        this.up = vec3.fromValues(0, 1, 0);       // Up direction

        this.aspectRatio = aspectRatio;
        this.fovY = fovY;
        this.near = near;
        this.far = far;

        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();

        this.updateProjectionMatrix();
        this.updateViewMatrix();
    }

    updateProjectionMatrix() {
        mat4.perspective(this.projectionMatrix, this.fovY, this.aspectRatio, this.near, this.far);
    }

    updateViewMatrix() {
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }

    moveForward(amount: number) {
        const forward = vec3.subtract(vec3.create(), this.target, this.position);
        vec3.normalize(forward, forward);
        vec3.scale(forward, forward, amount);
        vec3.add(this.position, this.position, forward);
        vec3.add(this.target, this.target, forward);
        this.updateViewMatrix();
    }

    moveRight(amount: number) {
        const forward = vec3.subtract(vec3.create(), this.target, this.position);
        const right = vec3.cross(vec3.create(), forward, this.up);
        vec3.normalize(right, right);
        vec3.scale(right, right, amount);
        vec3.add(this.position, this.position, right);
        vec3.add(this.target, this.target, right);
        this.updateViewMatrix();
    }

    moveUp(amount: number) {
        const up = vec3.fromValues(0, 1, 0);
        vec3.scale(up, up, amount);
        vec3.add(this.position, this.position, up);
        vec3.add(this.target, this.target, up);
        this.updateViewMatrix();
    }
}

//export default Camera;