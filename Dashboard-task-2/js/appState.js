/**
 * appState.js
 * Global state manager and event bus.
 */

class AppState {
    constructor() {
        this.state = {
            brushedData:   [],
            brushedRanges: {},
            selectedPoint: null,
            colorBy:       null,
        };
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    /** Remove a specific callback (use named function references) */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /** Nuclear option — remove ALL listeners for an event. Use sparingly. */
    clearListeners(event) {
        this.listeners[event] = [];
    }

    emit(event, data) {
        if (this.listeners[event]) {
            [...this.listeners[event]].forEach(cb => cb(data));
        }
    }

    // --- State Setters ---

    setBrushedData(data, ranges = {}) {
        this.state.brushedData   = data;
        this.state.brushedRanges = ranges;
        this.emit("brushChange", { data, ranges });
    }

    setSelectedPoint(point) {
        this.state.selectedPoint = point;
        this.emit("pointSelected", point);
    }

    setColorBy(column) {
        this.state.colorBy = column;
        this.emit("colorChange", column);
    }
}

const appState = new AppState();
