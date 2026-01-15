import { VizHub } from '../../js/viz-engine.js';

export function render(container, uniqueId) {
    const template = `
        <div class="professor-container fade-in">
            <div class="professor-avatar"></div>
            <div class="professor-dialogue">
                <h3>The Secret of the Slope</h3>
                <p>Calculus is the study of <em>change</em>. The derivative tells us exactly how fast something is changing at a specific instant.
                <br><br>
                Observe the curve below. As you move the point, watch the straight line (the <strong>tangent</strong>). Its steepness is the Derivative.</p>
            </div>
        </div>

        <div class="card-glass fade-in" style="animation-delay: 0.1s">
            <h2>Instantaneous Rate of Change</h2>
            <div id="viz-derivative-${uniqueId}" class="viz-container"></div>
            
            <div class="controls-panel">
                <div class="control-group">
                    <label>Position (x): <span id="val-x-${uniqueId}" class="text-accent">0.00</span></label>
                    <input type="range" id="input-x-${uniqueId}" min="-3" max="3" step="0.01" value="0">
                </div>
                <div class="control-group">
                    <label>Slope (dy/dx): <span id="val-slope-${uniqueId}" class="text-accent">?</span></label>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = template;

    // --- Visualization Logic ---
    const viz = new VizHub(`viz-derivative-${uniqueId}`);
    const { xScale, yScale } = viz.createCartesianGrid([-4, 4], [-10, 10]);

    // Function: f(x) = x^3 - 3x (Classic cubic with peaks/valleys)
    const f = x => Math.pow(x, 3) - 3 * x;
    const df = x => 3 * Math.pow(x, 2) - 3; // Derivative

    // Plot Base Function
    const data = d3.range(-3.2, 3.2, 0.05).map(x => ({ x, y: f(x) }));
    viz.plotFunction(data, xScale, yScale, "rgba(255, 255, 255, 0.5)");

    // Tangent Line Group
    const tangentGroup = viz.mainGroup.append("g");
    const tangentLine = tangentGroup.append("line")
        .attr("stroke", "#bd00ff") // Purple accent
        .attr("stroke-width", 2);

    // Focus Point
    const point = tangentGroup.append("circle")
        .attr("r", 6)
        .attr("fill", "#00f0ff")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    // Update Function
    const update = (x) => {
        const y = f(x);
        const slope = df(x);

        // Update Text
        const valX = document.getElementById(`val-x-${uniqueId}`);
        const valSlope = document.getElementById(`val-slope-${uniqueId}`);

        if (valX) valX.textContent = parseFloat(x).toFixed(2);
        if (valSlope) {
            valSlope.textContent = slope.toFixed(2);
            // Dynamic slope coloring
            const slopeColor = slope > 0 ? "#00f0ff" : (slope < 0 ? "#ff3366" : "#ffffff");
            valSlope.style.color = slopeColor;
            tangentLine.attr("stroke", slopeColor);
        }

        // Update Point
        point
            .attr("cx", xScale(x))
            .attr("cy", yScale(y));

        // Update Tangent Line (draw a segment around x)
        const delta = 2; // Length of line segment in x-units
        const x1 = parseFloat(x) - delta;
        const x2 = parseFloat(x) + delta;
        const y1 = slope * (x1 - x) + y;
        const y2 = slope * (x2 - x) + y;

        tangentLine
            .attr("x1", xScale(x1))
            .attr("y1", yScale(y1))
            .attr("x2", xScale(x2))
            .attr("y2", yScale(y2));
    };

    // Initial State
    update(0);

    // Event Listener
    const inputX = document.getElementById(`input-x-${uniqueId}`);
    if (inputX) {
        inputX.addEventListener('input', (e) => {
            update(e.target.value);
        });
    }
}
