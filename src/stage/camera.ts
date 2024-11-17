import { mat4, vec3 } from 'gl-matrix';
import { toRadians } from '../math_utils';

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
    yaw: number;
    pitch: number;
    sensitivity: number;

    constructor(
        aspectRatio: number,
        fovY: number = 45 * (Math.PI / 180),
        near: number = 0.1,
        far: number = 100.0
    ) {
        this.position = vec3.fromValues(0, 20, 100); // Camera starting position
        this.target = vec3.fromValues(0, 0, 0);   // Look at the origin
        this.up = vec3.fromValues(0, 1, 0);       // Up direction

        this.aspectRatio = aspectRatio;
        this.fovY = fovY;
        this.near = near;
        this.far = far;

        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();

        this.yaw = -90; 
        this.pitch = 0;
        this.sensitivity = 0.1;

        this.updateProjectionMatrix();
        this.updateViewMatrix();
    }

    updateProjectionMatrix() {
        mat4.perspective(this.projectionMatrix, this.fovY, this.aspectRatio, this.near, this.far);
    }

    updateViewMatrix() {
        const front = vec3.create();
        front[0] = Math.cos(toRadians(this.yaw)) * Math.cos(toRadians(this.pitch));
        front[1] = Math.sin(toRadians(this.pitch));
        front[2] = Math.sin(toRadians(this.yaw)) * Math.cos(toRadians(this.pitch));

        vec3.normalize(front, front);
        vec3.add(this.target, this.position, front);

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

    look(deltaX: number, deltaY: number) {
        this.yaw += deltaX * this.sensitivity;
        this.pitch += deltaY * this.sensitivity;

        if (this.pitch > 89.0) this.pitch = 89.0;
        if (this.pitch < -89.0) this.pitch = -89.0;

        this.updateViewMatrix();
    }
}

//export default Camera;