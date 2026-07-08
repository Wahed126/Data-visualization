/**
 * appState.js
 * Global state manager and event bus.
 * Allows independent charts to communicate (e.g. brushing in Parallel Coords
 * updates the Scatter Plot and Radar Chart).
 */

class AppState {
    constructor() {
        this.state = {
            brushedData: [],     // Points selected by brush (or all if none)
            selectedPoint: null, // A single point clicked by the user
            colorBy: null,       // Current property used for coloring
        };
        this.listeners = {};
    }

    // Subscribe to an event
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Fire an event
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    // --- State Setters ---

    setBrushedData(data) {
        this.state.brushedData = data;
        this.emit("brushChange", data);
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

// Export singleton instance
const appState = new AppState();
