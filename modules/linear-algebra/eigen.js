import { VizHub } from '../../js/viz-engine.js';

export function render(container) {
    const template = `
        <div class="professor-container fade-in">
            <div class="professor-avatar"></div>
            <div class="professor-dialogue">
                <h3>The Eigen-Search</h3>
                <p>Matrices transform space. They stretch and rotate vectors. But some vectors are special—they don't rotate. They only stretch.
                <br><br>
                These are <strong>Eigenvectors</strong>. Use the slider to rotate the blue vector (v). Can you align it with the purple vector (Av)?</p>
            </div>
        </div>

        <div class="card-glass fade-in" style="animation-delay: 0.1s">
            <h2>Linear Transformation: Av = λv</h2>
            <div id="viz-eigen" class="viz-container"></div>
            
            <div class="controls-panel">
                <div class="control-group">
                    <label>Vector Angle (θ): <span id="val-angle" class="text-accent">0°</span></label>
                    <input type="range" id="input-angle" min="0" max="360" step="1" value="0">
                </div>
                <div class="control-group" style="margin-left: auto;">
                    <div style="font-family: monospace; font-size: 1.2rem;">
                         Matrix A = 
                         <span style="color:var(--text-secondary)">[ 2  1 ]</span>
                         <br>
                         <span style="visibility:hidden">Matrix A = </span>
                         <span style="color:var(--text-secondary)">[ 1  2 ]</span>
                    </div>
                </div>
            </div>
            <div id="status-msg" style="margin-top: 10px; height: 20px; font-weight: bold; color: var(--accent-amber)"></div>
        </div>
    `;
    container.innerHTML = template;

    // --- Visualization Logic ---
    const viz = new VizHub('viz-eigen');
    const { xScale, yScale } = viz.createCartesianGrid([-5, 5], [-5, 5]);

    // Matrix A = [[2, 1], [1, 2]] (Symmetric, eigenvalues 3 and 1)
    const A = { a: 2, b: 1, c: 1, d: 2 };

    // Function to apply matrix
    const transform = (v) => ({
        x: A.a * v.x + A.b * v.y,
        y: A.c * v.x + A.d * v.y
    });

    const origin = { x: 0, y: 0 };

    // Draw Vectors
    const vectorGroup = viz.mainGroup.append("g");

    // Helper to draw arrow
    const drawArrow = (id, color, label) => {
        const g = vectorGroup.append("g").attr("id", id);
        g.append("line")
            .attr("stroke", color)
            .attr("stroke-width", 3)
            .attr("marker-end", `url(#arrow-${id})`); // Needs defs, but simple line ok for MVP or add arrow head

        // Add minimal arrow head manually if defs too complex for this quick setup
        g.append("circle").attr("r", 4).attr("fill", color); // Tip

        return g;
    };

    const vArrow = drawArrow("vec-v", "#00f0ff", "v");
    const AvArrow = drawArrow("vec-Av", "#bd00ff", "Av");

    const update = (angleDeg) => {
        const rad = angleDeg * (Math.PI / 180);
        const v = { x: Math.cos(rad), y: Math.sin(rad) }; // Unit vector
        const Av = transform(v);

        document.getElementById('val-angle').textContent = angleDeg + "°";

        // Update v
        vArrow.select("line")
            .attr("x1", xScale(0))
            .attr("y1", yScale(0))
            .attr("x2", xScale(v.x))
            .attr("y2", yScale(v.y));
        vArrow.select("circle")
            .attr("cx", xScale(v.x))
            .attr("cy", yScale(v.y));

        // Update Av
        AvArrow.select("line")
            .attr("x1", xScale(0))
            .attr("y1", yScale(0))
            .attr("x2", xScale(Av.x))
            .attr("y2", yScale(Av.y));
        AvArrow.select("circle")
            .attr("cx", xScale(Av.x))
            .attr("cy", yScale(Av.y));

        // Check for Eigenvector (Parallelism)
        // Cross product 2D: x1*y2 - x2*y1 should be close to 0
        const cross = v.x * Av.y - v.y * Av.x;
        const isEigen = Math.abs(cross) < 0.1;

        if (isEigen) {
            document.getElementById('status-msg').textContent = "EIGENVECTOR FOUND! (Scale Factor λ approx " + (Math.sqrt(Av.x ** 2 + Av.y ** 2)).toFixed(1) + ")";
            AvArrow.select("line").attr("stroke-width", 6);
        } else {
            document.getElementById('status-msg').textContent = "";
            AvArrow.select("line").attr("stroke-width", 3);
        }
    };

    update(0);

    document.getElementById('input-angle').addEventListener('input', (e) => {
        update(e.target.value);
    });
}
