import { VizHub } from './viz-engine.js';

class App {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.mainContent = document.getElementById('main-content');
        this.vizHub = null;

        this.initEventListeners();
        this.loadTopic('welcome'); // Default load
    }

    initEventListeners() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // UI update
                this.navItems.forEach(nav => nav.classList.remove('active'));
                e.target.classList.add('active');

                // Load content
                const topic = e.target.getAttribute('data-topic');
                this.loadTopic(topic);
            });
        });
    }

    async loadTopic(topic) {
        // Clear previous content
        this.mainContent.innerHTML = '';

        switch (topic) {
            case 'welcome':
                this.renderWelcome();
                break;
            case 'calculus':
                await this.loadModule('calculus');
                break;
            case 'linear-algebra':
                await this.loadModule('linear-algebra');
                break;
            case 'signals':
                this.renderPlaceholder("Signals & Systems coming soon...");
                break;
            default:
                this.renderWelcome();
        }
    }

    renderWelcome() {
        // Professor Intro
        const template = `
            <div class="professor-container fade-in">
                <div class="professor-avatar"></div>
                <div class="professor-dialogue">
                    <h3>Greetings, Future Legend!</h3>
                    <p>I am the Professor. Mastering engineering mathematics is not about memorizing formulas—it is about seeing the hidden patterns of the universe.
                    <br><br>
                    Below is a simple Sine wave, the building block of all signals. Play with the slider to see how <strong>frequency</strong> changes the world.</p>
                </div>
            </div>

            <div class="card-glass fade-in" style="animation-delay: 0.2s">
                <h2>The Pulse of Reality</h2>
                <div id="viz-welcome" class="viz-container"></div>
                
                <div class="controls-panel">
                    <div class="control-group">
                        <label>Frequency</label>
                        <input type="range" id="freq-slider" min="1" max="10" step="0.1" value="1">
                    </div>
                </div>
            </div>
        `;
        this.mainContent.innerHTML = template;

        // Init Viz
        this.vizHub = new VizHub('viz-welcome');
        const { xScale, yScale } = this.vizHub.createCartesianGrid([0, 10], [-2, 2]);

        // Initial Plot
        const plot = (freq) => {
            const data = d3.range(0, 10, 0.05).map(x => ({
                x: x,
                y: Math.sin(freq * x)
            }));

            // Remove old path if any (simple redraw for now)
            this.vizHub.mainGroup.selectAll("path").remove();
            this.vizHub.plotFunction(data, xScale, yScale, "#00f0ff");
        };

        plot(1);

        // Interactive
        document.getElementById('freq-slider').addEventListener('input', (e) => {
            plot(e.target.value);
        });
    }

    renderPlaceholder(text) {
        this.mainContent.innerHTML = `
            <div class="professor-container fade-in">
                <div class="professor-avatar"></div>
                <div class="professor-dialogue">
                    ${text}
                </div>
            </div>
        `;
    }

    // Dynamic module loader
    async loadModule(name) {
        let modulePath = '';
        if (name === 'calculus') modulePath = '../modules/calculus/derivative.js';
        if (name === 'linear-algebra') modulePath = '../modules/linear-algebra/eigen.js';

        if (modulePath) {
            import(modulePath).then(module => {
                module.render(this.mainContent);
            }).catch(err => {
                this.renderPlaceholder(`Error loading module: ${err}`);
            });
        }
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
