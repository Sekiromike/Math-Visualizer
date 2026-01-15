import { VizHub } from './viz-engine.js';

class App {
    constructor() {
        this.chatStream = document.getElementById('chat-stream');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.chips = document.querySelectorAll('.chip');

        this.initEventListeners();

        // Initial Welcome Message
        this.addMessage('bot', 'normal', `
            <h3>Greetings, Future Legend!</h3>
            <p>I am the Professor. Mastering engineering mathematics is about seeing the hidden patterns of the universe.</p>
            <p>I can visualize concepts in <strong>Calculus</strong>, <strong>Linear Algebra</strong>, or the fundamental <strong>Sine Wave</strong>.</p>
            <p>What would you like to explore today?</p>
        `);
    }

    initEventListeners() {
        // Send Button
        this.sendBtn.addEventListener('click', () => this.handleInput());

        // Enter Key
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleInput();
        });

        // Chips
        this.chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.getAttribute('data-query');
                this.userInput.value = query;
                this.handleInput();
                // Optional: Hide chips after selection or keep them? Keeping them is fine.
            });
        });
    }

    handleInput() {
        const text = this.userInput.value.trim();
        if (!text) return;

        // Add User Message
        this.addMessage('user', 'text', text);
        this.userInput.value = '';

        // Process Query (Simple Intent Matching)
        // Simulate "Thinking" delay
        this.showTypingIndicator(); // Optional: Implement if time permits, else just timeout

        setTimeout(() => {
            this.processQuery(text.toLowerCase());
        }, 600);
    }

    async processQuery(text) {
        if (text.includes('calc') || text.includes('deriv') || text.includes('slope')) {
            await this.loadModule('calculus');
        } else if (text.includes('linear') || text.includes('eigen') || text.includes('matrix')) {
            await this.loadModule('linear-algebra');
        } else if (text.includes('sine') || text.includes('wave') || text.includes('freq')) {
            this.renderSineWave();
        } else {
            this.addMessage('bot', 'text', "I'm focusing on Calculus, Linear Algebra, and Signals right now. Try asking about 'derivatives', 'eigenvectors', or 'sine waves'.");
        }
    }

    addMessage(sender, type, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (type === 'text') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = content;
        }

        if (sender === 'user') {
            msgDiv.appendChild(contentDiv);
            msgDiv.appendChild(avatar);
        } else {
            msgDiv.appendChild(avatar);
            msgDiv.appendChild(contentDiv);
        }

        this.chatStream.appendChild(msgDiv);

        // Scroll to bottom
        this.chatStream.scrollTop = this.chatStream.scrollHeight;

        return contentDiv; // Return content container for dynamic injection
    }

    // --- Module Loaders ---

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    async loadModule(name) {
        const msgContainer = this.addMessage('bot', 'html', '<div class="loading-spinner">Accessing Archives...</div>');

        let modulePath = '';
        if (name === 'calculus') modulePath = '../modules/calculus/derivative.js';
        if (name === 'linear-algebra') modulePath = '../modules/linear-algebra/eigen.js';

        if (modulePath) {
            try {
                const module = await import(modulePath);
                // We pass the container and a unique ID prefix to avoid collisions
                const uniqueId = this.generateId();
                module.render(msgContainer, uniqueId);

                this.chatStream.scrollTop = this.chatStream.scrollHeight;
            } catch (err) {
                console.error(err);
                msgContainer.innerHTML = "Error loading module. Please check the console.";
            }
        }
    }

    // Sine Wave is built-in for now (Welcome demo)
    renderSineWave() {
        const uniqueId = this.generateId();
        const content = `
            <h3>The Pulse of Reality</h3>
            <p>Below is a simple Sine wave. Play with the slider to see how <strong>frequency</strong> changes the world.</p>
            <div id="viz-${uniqueId}" class="viz-container"></div>
            <div class="controls-panel">
                <div class="control-group">
                    <label>Frequency</label>
                    <input type="range" id="slider-${uniqueId}" min="1" max="10" step="0.1" value="1">
                </div>
            </div>
        `;
        const container = this.addMessage('bot', 'html', content);

        // Init Viz
        const viz = new VizHub(`viz-${uniqueId}`);
        const { xScale, yScale } = viz.createCartesianGrid([0, 10], [-2, 2]);

        const plot = (freq) => {
            const data = d3.range(0, 10, 0.05).map(x => ({
                x: x,
                y: Math.sin(freq * x)
            }));
            viz.mainGroup.selectAll("path").remove();
            viz.plotFunction(data, xScale, yScale, "#00f0ff");
        };

        plot(1);

        // Scoped event listener
        const slider = document.getElementById(`slider-${uniqueId}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                plot(e.target.value);
            });
        }
    }

    showTypingIndicator() {
        // Placeholder for typing animation
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
