// @ts-nocheck
const ANIMATION_TIME = 300;

export type Point = [number, number]

let easeOutQuad = (t : number) : number => {
  return t * (2 - t);
};

export class Scroller {
    _isAnimating: boolean;

    constructor() {
        this._isAnimating = false;
        this.scrollPixelsForZoomLevel = 150;
        this.zoomSnap = true;
    }

    wheel(event: MouseEvent) : void {
        const addToZoom = -event.deltaY / this.scrollPixelsForZoomLevel;
        this.zoomAroundMouse(addToZoom,event);
    }

    onZoom(func) {
        this._onZoom = func
    }

    zoomAroundMouse(zoomDiff: number,event: MouseEvent) : void {
        let zoom = this.map.getZoom()
        let zoomTarget = zoom + zoomDiff; 
        this._wheelMousePosition = this.map.mouseEventToContainerPoint(event);
        this._centerPoint = this.map.getSize()._divideBy(2);
        this._startLatLng = this.map.getCenter()
        this._wheelStartLatLng = this.map.containerPointToLatLng(this._wheelMousePosition);

        if (this.zoomSnap) zoomTarget = zoomDiff < 0 ? Math.floor(zoomTarget) : Math.ceil(zoomTarget);
        zoomTarget = Math.floor(zoomTarget * 100) / 100;
        zoomTarget = Math.max(this.map.getMinZoom(), Math.min(zoomTarget, this.map.getMaxZoom()));
        this.setCenterZoomTarget(zoomTarget, this._wheelStartLatLng)
    }

    setCenterZoomTarget(zoom: number,zoomAround: Point) : void {
        if (this._isAnimating) {
            cancelAnimationFrame(this._animFrame)
            const { centerStep, zoomStep } = this.animationStep(performance.now())
            this._centerStart = centerStep
            this._zoomStart = zoomStep
        } else {
            this._isAnimating = true
            this._centerStart = this.map.getCenter()
            this._zoomStart = this.map.getZoom()
        }

        this._animationStart = performance.now()
        this._animationEnd = this._animationStart + 300


        // set center target
        this._centerTarget = zoomAround
        this._zoomTarget = zoom
        this._animFrame = requestAnimationFrame(this.animate)
    }

    animate = (timestamp: number): void => {
        if (!this._animationEnd || timestamp >= this._animationEnd) {
            this._isAnimating = false
            this.setCenterZoom(this.map.getCenter(),this._zoomTarget);
            this.map._moveEnd(true);
            if (this._onZoom) this._onZoom(this._zoomTarget);

        } else {
            const { centerStep, zoomStep } = this.animationStep(timestamp);
            this.setCenterZoom(centerStep, zoomStep)
            this._animFrame = requestAnimationFrame(this.animate)
            if (this._onZoom) this._onZoom(zoomStep);
        }
    }

    setCenterZoom(center: Point,zoom: number) : void {
        this.map._move(center, zoom);
    }

    animationStep = (timestamp: number) : void => {
        const length = this._animationEnd - this._animationStart;
        const progress = Math.max(timestamp - this._animationStart, 0);
        const percentage = easeOutQuad(progress / length);
        const zoomDiff = (this._zoomTarget - this._zoomStart) * percentage;
        var zoomStep = this._zoomStart + zoomDiff;
        zoomStep = Math.round(zoomStep * 100) / 100;
        var delta = this._wheelMousePosition.subtract(this._centerPoint);
        let centerStep = this.map.unproject(this.map.project(this._wheelStartLatLng, zoomStep).subtract(delta), zoomStep);
        return { centerStep: centerStep, zoomStep:zoomStep }
    }
}

export const leafletHandler = (scroller) => {
    return L.Handler.extend({
        addHooks: function() {
            scroller.map = this._map
            L.DomEvent.on(this._map._container, 'wheel', this._wheel, this);
        },

        removeHooks: function() {
            L.DomEvent.off(this._map._container, 'wheel', this._wheel, this);
        },

        _wheel: function(event) {
            scroller.wheel(event);
            L.DomEvent.preventDefault(event);
            L.DomEvent.stopPropagation(event);
        }
    })
}